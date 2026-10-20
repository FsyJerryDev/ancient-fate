/** Supabase Edge Function: all code issuance/consumption & report access stay server-side. */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { evaluate, isComplete, GAME_VERSION } from '../_shared/scoring.ts';
import { endingById } from '../_shared/endings.ts';

const URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PUBLIC_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const PEPPER = Deno.env.get('CODE_HASH_PEPPER');
if (!PEPPER || PEPPER.length < 32) throw new Error('Set a random CODE_HASH_PEPPER secret of at least 32 characters');
const db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const allowed = (Deno.env.get('ALLOWED_ORIGINS') || 'http://localhost:8000,http://127.0.0.1:8000').split(',').map(s => s.trim());
const choices = new Set(['A','B','C','D']);
const codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars, no O/0/I/1
const enc = new TextEncoder();

function cors(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    ...(allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization,apikey,content-type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };
}
function output(req: Request, value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: cors(req) });
}
function fail(message: string, status = 400): never { throw { status, message }; }
function normalizeCode(input: unknown): string {
  if (typeof input !== 'string' || input.length > 128) fail('兑换码格式不正确');
  const canonical = input.normalize('NFKC').replace(/[\s\-]/g,'').toUpperCase();
  if (!/^FATE[A-HJ-NP-Z2-9]{20}$/.test(canonical)) fail('兑换码格式不正确');
  return canonical;
}
async function digest(value: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(PEPPER), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
  return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function randomHex(bytes = 32) {
  const out = crypto.getRandomValues(new Uint8Array(bytes));
  return [...out].map(n=>n.toString(16).padStart(2,'0')).join('');
}
function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const str = [...bytes].map(v => codeAlphabet[v & 31]).join('');
  return `FATE-${str.slice(0,5)}-${str.slice(5,10)}-${str.slice(10,15)}-${str.slice(15,20)}`;
}
function requireUuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) fail('ID 无效');
  return value as string;
}
async function activeCode(req: Request) {
  const bearer = req.headers.get('authorization') || '';
  if (!/^Bearer [a-f0-9]{64}$/i.test(bearer)) fail('请重新输入兑换码', 401);
  const token_hash = await digest('SESSION:' + bearer.slice(7));
  const { data: session } = await db.from('access_sessions').select('code_id,expires_at,revoked_at').eq('token_hash', token_hash).maybeSingle();
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) fail('访问授权已失效，请重新验证兑换码', 401);
  const {data: code} = await db.from('redemption_codes').select('id,status,used_uses,total_uses,expires_at').eq('id',session.code_id).maybeSingle();
  if (!code || code.status !== 'active' || new Date(code.expires_at).getTime() <= Date.now()) fail('兑换码已失效或被停用', 403);
  return code;
}
async function checkAdmin(req: Request) {
  const bearer = req.headers.get('authorization') || '';
  if (!bearer.startsWith('Bearer ')) fail('需要管理员登录', 401);
  const auth = createClient(URL, PUBLIC_KEY, { auth: { persistSession:false, autoRefreshToken:false } });
  const {data: {user},error} = await auth.auth.getUser(bearer.substring(7));
  if (error || !user) fail('管理员凭证失效',401);
  const {data:admin} = await db.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!admin) fail('没有管理权限',403);
  return user.id as string;
}
async function getSession(codeId: string, sessionId: unknown) {
  const id = requireUuid(sessionId);
  const {data} = await db.from('game_sessions').select('id,state,answers,game_version,started_at').eq('id',id).eq('code_id',codeId).maybeSingle();
  if (!data) fail('测评会话不存在',404);
  return data;
}
async function getResult(codeId:string, resultId:unknown) {
  const id = requireUuid(resultId);
  const {data} = await db.from('results').select('id,game_session_id,ending_id,episode,evaluation,created_at').eq('id',id).eq('code_id',codeId).maybeSingle();
  if (!data) fail('没有权限查看该结果',404);
  return data;
}
function publicReport(result: any) {
  const end = endingById[result.ending_id as keyof typeof endingById];
  if (!end) fail('暂不支持此报告版本',409);
  const evaluation = result.evaluation || {};
  return {
    resultId: result.id,
    endingId: result.ending_id,
    episode: result.episode,
    role: end.role,
    tier: end.tier,
    name: end.name,
    title: end.title,
    coverQuote: end.coverQuote,
    story: end.story,
    strengths: end.strengths,
    shadow: end.shadow,
    counsel: end.counsel,
    quotes: end.quotes,
    scores: evaluation.scores,
  };
}

Deno.serve(async(req) => {
  const headers = cors(req);
  if (req.method === 'OPTIONS') return new Response(null, {status:204,headers});
  if (req.method !== 'POST') return output(req,{error:'仅支持 POST'},405);
  const origin = req.headers.get('origin');
  if (origin && !allowed.includes(origin)) return output(req,{error:'来源未授权'},403);
  try {
    const payload = await req.json().catch(()=>fail('JSON 请求格式错误'));
    const action = payload?.action;
    if (typeof action!=='string') fail('操作不正确');

    if (action === 'public_result') {
      const token = payload?.token;
      if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) fail('分享链接无效',404);
      const hash = await digest('SHARE:' + token);
      const {data:link} = await db.from('share_links').select('result_id').eq('token_hash',hash).is('revoked_at',null).maybeSingle();
      if (!link) fail('分享已失效或已撤销',404);
      const {data:result} = await db.from('results').select('id,ending_id,episode,evaluation').eq('id',link.result_id).single();
      return output(req,{result:publicReport(result)});
    }
    if (action === 'redeem') {
      // 兑换码不直接传入日志。IP 仅被单向哈希并用于有限时长的基础防刷。
      const code = normalizeCode(payload?.code);
      const ip = (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').slice(0,64);
      const fingerprint = await digest('RATELIMIT:' + ip);
      const {data:attempts} = await db.from('redeem_attempts').select('attempts,window_start').eq('fingerprint',fingerprint).maybeSingle();
      if (attempts && Date.now()-new Date(attempts.window_start).getTime()<15*60*1000 && attempts.attempts>=12) fail('尝试过于频繁，请稍后重试',429);
      const lookup_hash = await digest('CODE:' + code);
      const {data:record} = await db.from('redemption_codes').select('id,status,expires_at').eq('lookup_hash',lookup_hash).maybeSingle();
      if (!record || record.status!=='active' || new Date(record.expires_at).getTime()<=Date.now()) {
        await db.from('redeem_attempts').upsert({fingerprint,attempts:attempts && Date.now()-new Date(attempts.window_start).getTime()<15*60*1000 ? attempts.attempts+1 : 1,window_start:attempts && Date.now()-new Date(attempts.window_start).getTime()<15*60*1000 ? attempts.window_start : new Date().toISOString()});
        fail('兑换码不存在或已失效',403);
      }
      await db.from('redeem_attempts').delete().eq('fingerprint',fingerprint);
      const token = randomHex();
      const {error:sessionError} = await db.from('access_sessions').insert({code_id:record.id,token_hash:await digest('SESSION:' + token),expires_at:new Date(Date.now()+30*24*3600*1000).toISOString()});
      if (sessionError) fail('暂时无法登录，请稍后重试',503);
      return output(req,{token});
    }
    if (action.startsWith('admin_')) {
      const actor = await checkAdmin(req);
      if (action === 'admin_issue') {
        const count = Number(payload?.count);
        if (!Number.isInteger(count) || count < 1 || count > 200) fail('一次只能生成 1～200 个兑换码');
        const batchId = crypto.randomUUID();
        const plain = Array.from({length:count},newCode);
        const items = await Promise.all(plain.map(async c=>({lookup_hash:await digest('CODE:'+normalizeCode(c)),batch_id:batchId})));
        const {data:created,error} = await db.from('redemption_codes').insert(items).select('id,lookup_hash');
        if (error || !created || created.length !== count) fail('兑换码生成失败，请重试',503);
        await db.from('audit_logs').insert({actor,action:'issue_codes',reference_id:batchId});
        const byHash = new Map(created.map((row:any)=>[row.lookup_hash,row.id]));
        const records = items.map((item,i)=>({id:byHash.get(item.lookup_hash),code:plain[i]}));
        return output(req,{batchId,records}); // plaintext only returned once, NOT stored in DB
      }
      if (action === 'admin_list') {
        const {data,error} = await db.from('redemption_codes').select('id,batch_id,order_reference,total_uses,used_uses,status,expires_at,created_at').order('created_at',{ascending:false}).limit(100);
        if (error) fail('读取失败',503);
        return output(req,{codes:data});
      }
      if (action === 'admin_update') {
        const id=requireUuid(payload?.codeId);
        const status = payload?.status;
        if (!['active','frozen','revoked'].includes(status)) fail('状态无效');
        const {error} = await db.from('redemption_codes').update({status}).eq('id',id);
        if (error) fail('更新失败',503);
        await db.from('audit_logs').insert({actor,action:`update_${status}`,reference_id:id});
        return output(req,{ok:true});
      }
      if (action === 'admin_bind_order') {
        const id=requireUuid(payload?.codeId);
        const order = String(payload?.orderReference || '').trim();
        if (!/^[a-zA-Z0-9_-]{6,100}$/.test(order)) fail('订单标识格式无效');
        const {error}=await db.from('redemption_codes').update({order_reference:order}).eq('id',id).is('order_reference',null);
        if (error) fail('订单绑定失败，可能已绑定或订单号重复',409);
        await db.from('audit_logs').insert({actor,action:'bind_order',reference_id:id});
        return output(req,{ok:true});
      }
      fail('未知管理操作',404);
    }

    const code = await activeCode(req);
    if (action === 'dashboard') {
      const [{data:sessions},{data:results}] = await Promise.all([
        db.from('game_sessions').select('id,state,answers,started_at').eq('code_id',code.id).order('started_at',{ascending:false}),
        db.from('results').select('id,game_session_id,episode,ending_id,created_at').eq('code_id',code.id).order('created_at',{ascending:false}),
      ]);
      return output(req,{remaining:code.total_uses-code.used_uses,total:code.total_uses,sessions:sessions||[],results:results||[]});
    }
    if (action === 'start') {
      const {data,error} = await db.rpc('reserve_game_session',{p_code_id:code.id});
      if (error) fail('体验次数已用完或兑换码已失效',409);
      return output(req,{sessionId:data,remaining:code.total_uses-code.used_uses-1});
    }
    if (action === 'get_session') {
      const session=await getSession(code.id,payload?.sessionId);
      return output(req,{session});
    }
    if (action === 'save_answer') {
      const gameId = requireUuid(payload?.sessionId);
      const question = Number(payload?.question);
      const choice = payload?.choice;
      if (!Number.isInteger(question) || question<1 || question>16 || !choices.has(choice)) fail('答案无效');
      const {data,error}=await db.rpc('save_game_answer',{p_game_id:gameId,p_code_id:code.id,p_question:question,p_choice:choice});
      if (error) fail('保存答案失败，请刷新后恢复测评',409);
      return output(req,{answers:data});
    }
    if (action === 'reset_answers') {
      const {data,error}=await db.rpc('reset_game_answers',{p_game_id:requireUuid(payload?.sessionId),p_code_id:code.id});
      if (error || !data) fail('当前测评不能重置',409);
      return output(req,{ok:true});
    }
    if (action === 'complete') {
      const s=await getSession(code.id,payload?.sessionId);
      if (s.state==='completed') {
        const {data:old}=await db.from('results').select('id,episode,ending_id,evaluation').eq('game_session_id',s.id).single();
        return output(req,{result:old});
      }
      if (!isComplete(s.answers)) fail('尚未完成所有题目',409);
      if (s.game_version!==GAME_VERSION) fail('游戏版本已更新，请联系客服',409);
      const evaluation=evaluate(s.answers);
      const ending=endingById[evaluation.endingId];
      const {data:id,error}=await db.rpc('finish_game_session',{
        p_game_id:s.id,p_code_id:code.id,p_ending_id:ending.id,p_episode:ending.episode,
        p_evaluation:evaluation,p_game_version:GAME_VERSION,p_expected_answers:s.answers,
      });
      if (error) fail('结算发生冲突，请重试',409);
      const {data:result}=await db.from('results').select('id,episode,ending_id,evaluation').eq('id',id).single();
      return output(req,{result});
    }
    if (action === 'get_result') {
      const result=await getResult(code.id,payload?.resultId);
      return output(req,{result:publicReport(result)});
    }
    if (action === 'poster_upload') {
      // Upload only for a completed result owned by the current access session.
      const result=await getResult(code.id,payload?.resultId);
      const image=payload?.image;
      if(typeof image!=='string' || image.length<100 || image.length>7_100_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image)) fail('海报图片数据无效或过大',413);
      let bytes: Uint8Array;
      try {const binary=atob(image);bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));}
      catch {fail('海报图片数据错误');}
      if(bytes.length>5_242_880 || bytes.length<100 || bytes[0]!==137 || bytes[1]!==80 || bytes[2]!==78 || bytes[3]!==71 || bytes[4]!==13 || bytes[5]!==10 || bytes[6]!==26 || bytes[7]!==10) fail('只支持 5MB 以下的 PNG 图片',413);
      const objectName=`${code.id}/${result.id}/${crypto.randomUUID()}.png`;
      const {error:uploadError}=await db.storage.from('fate-posters').upload(objectName,bytes,{contentType:'image/png',cacheControl:'3600',upsert:false});
      if(uploadError) {console.error('poster upload failed',uploadError.message);fail('海报暂存失败，请稍后重试',503);}
      const {data:signed,error:signError}=await db.storage.from('fate-posters').createSignedUrl(objectName,3600,{download:false});
      if(signError||!signed?.signedUrl) fail('海报链接生成失败',503);
      return output(req,{imageUrl:signed.signedUrl,expiresIn:3600});
    }
    if (action === 'share') {
      const result=await getResult(code.id,payload?.resultId);
      const token=randomHex();
      const {error}=await db.from('share_links').insert({result_id:result.id,token_hash:await digest('SHARE:'+token)});
      if (error) fail('暂时无法分享，请稍后重试',503);
      return output(req,{token});
    }
    if (action === 'revoke_shares') {
      const result=await getResult(code.id,payload?.resultId);
      const {error}=await db.from('share_links').update({revoked_at:new Date().toISOString()}).eq('result_id',result.id).is('revoked_at',null);
      if (error) fail('撤销分享失败',503);
      return output(req,{ok:true});
    }
    fail('操作不存在',404);
  } catch(error) {
    const status = typeof error?.status === 'number' ? error.status : 500;
    // 不记录兑换码、access token 或用户答题内容。
    if (status === 500) console.error('fate-api failure',error?.message || 'internal');
    return output(req,{error:status === 500 ? '服务器暂时繁忙，请稍后重试' : error.message},status);
  }
});