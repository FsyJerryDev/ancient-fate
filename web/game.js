(() => {
  'use strict';
  const root = document.getElementById('root');
  const {chapters, chapterOutros, questions, endings, roleNames, roleDescriptions, tierNames} = JSON.parse(document.getElementById('game-data').textContent);
  const endingById = Object.fromEntries(endings.map(e => [e.id,e]));
  const version = engine.GAME_VERSION;
  const key = 'dayao-fate:hosted-session-ui';
  const api = window.FateAPI;
  let sessionId='', resultId='', credits=0, history=[], gameSessions=[], errorText='', publicData=null, busy=false;
  let screen='redeem', index=0, answers={}, pending=false, restartDialogOpen=false, advanceDue=false, advanceTimer=null;
  // 游戏在已有服务器会话内恢复；不再读取旧“免费试玩”的离线身份状态。
  function persist(){try{localStorage.setItem(key,JSON.stringify({version,screen,index,sessionId,resultId}));}catch{/* 本地文件或内嵌预览可能禁用存储；不影响本次内存中的试玩。 */}}
  function requestRestart(){restartDialogOpen=true;render();}
  function cancelRestart(){restartDialogOpen=false;if(pending && advanceDue){advanceDue=false;advance();}else render();}
  async function reset(){if(!sessionId)return; busy=true; render(); try{await api.call('reset_answers',{sessionId}); if(advanceTimer!==null)clearTimeout(advanceTimer);advanceTimer=null;advanceDue=false;pending=false;restartDialogOpen=false;screen='chapter';index=0;answers={};errorText='';}catch(e){errorText=e.message;}finally{busy=false;render();}}
  function html(s){return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');}
  function fateProgress(episode){const pct=Math.round(episode/engine.TOTAL_EPISODES*100);return `<div class="fate-progress" aria-label="全剧共 ${engine.TOTAL_EPISODES} 集，你走到了第 ${episode} 集，约 ${pct}%"><div class="fate-progress-heading"><span>你的命运进度</span><strong>第 ${episode} / ${engine.TOTAL_EPISODES} 集 <em>· ${pct}%</em></strong></div><div class="fate-progress-track" role="progressbar" aria-label="剧集进度" aria-valuemin="0" aria-valuemax="${engine.TOTAL_EPISODES}" aria-valuenow="${episode}"><span style="width:${episode/engine.TOTAL_EPISODES*100}%"></span></div><div class="fate-progress-labels"><span>故事开始</span><span>全剧终 · 第 ${engine.TOTAL_EPISODES} 集</span></div></div>`;}
  function feedbackOverlay(){if(!pending || restartDialogOpen || screen!=='quiz')return '';const selected=answers[index+1], feedback=questions[index].choices.find(c=>c.id===selected)?.feedback||'';const duration=engine.getFeedbackDurationMs(feedback);return `<div class="feedback-overlay" role="dialog" aria-modal="true" aria-label="命运的回响"><div class="feedback-dialog" aria-live="polite"><div class="feedback-seal" aria-hidden="true">✦</div><p class="feedback-kicker">命 运 的 回 响</p><p class="feedback-text">${html(feedback)}</p><div class="feedback-countdown" aria-hidden="true"><span style="animation-duration:${duration}ms"></span></div></div></div>`;}
  function arrow(){return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>';}
  function seal(g){return `<span class="palace-seal"><span>${g}</span></span>`;}
  function block(title,sub,body,no){return `<section class="report-section"><div class="section-index">卷 · ${no}</div><h2>${title}</h2><p class="section-subtitle">${sub}</p>${body}</section>`;}
  function home(){return `<section class="home-view enter"><div class="home-hero ornament-frame"><div class="hero-orbit hero-orbit-one"></div><div class="hero-orbit hero-orbit-two"></div><div class="hero-stamp">大<br>曜</div><p class="overline">一 场 命 运 · 十 六 次 选 择</p><h1>穿越古代<br><em>你能活到第几集？</em></h1><p class="home-sub">一觉醒来，你成了朝廷里最不起眼的记录官。<br>一桩失踪的赈粮案，却正将你推向风暴中心。</p><div class="hero-divider"><span></span>✦<span></span></div><div class="hero-meta"><span>4 幕沉浸剧情</span><i></i><span>16 次命运选择</span><i></i><span>12 种人生结局</span></div><button class="primary-button hero-start" data-action="start">开启我的古代人生 ${arrow()}</button><p class="hero-note">约 4–6 分钟 · 趣味故事测评 · 每码 3 次测评</p></div><div class="intro-grid"><div class="feature-tile"><span>01</span><strong>你的选择，改变命运</strong><p>线索、盟友与最后的决定，会影响故事结局。</p></div><div class="feature-tile"><span>02</span><strong>十二种专属人生</strong><p>有人执掌棋局，有人仗剑远行，每一种都值得被记住。</p></div></div><p class="disclaimer">本产品为架空历史互动故事，不属于心理诊断或科学人格评估。</p></section>`;}
  function chapter(){const c=chapters[Math.floor(index/4)]; const recap=index>0?`<div class="chapter-recap"><span>上回书说</span><p>${html(chapterOutros[c.id-1])}</p><p>${html(engine.getStoryEcho(answers,c.id-1))}</p></div>`:'';return `<section class="chapter-view enter"><div class="chapter-topline">大 曜 朝 · 机 密 卷 宗</div><div class="chapter-glyph">${c.glyph}</div><p class="overline">${c.eyebrow}</p><p class="chapter-episode">${c.episodes}</p><h1>${c.title}</h1><div class="chapter-rule">✦</div>${recap}<p class="chapter-description">${c.description}</p><p class="chapter-hook">“${c.hook}”</p><button class="primary-button" data-action="enter">进入第 ${index+1} 题 ${arrow()}</button>${index>0?'<button class="text-button" data-action="back-chapter">返回上一幕</button>':''}</section>`;}
  function quiz(){const q=questions[index],c=chapters[q.chapter-1],shift=[2,0,3,1][q.id%4], ordered=[...q.choices.slice(shift),...q.choices.slice(0,shift)];return `<section class="quiz-view enter"><div class="progress-box"><div class="progress-top"><span>卷宗进度 · ${c.title}</span><strong>${q.id} / 16</strong></div><div class="progress-track"><span style="width:${Math.round(q.id/16*100)}%"></span></div></div><div class="quiz-card ornament-frame"><div class="question-heading"><span class="chapter-pill">第 ${q.episode} 集 · ${c.title}</span>${q.key?'<span class="key-badge">关键抉择</span>':''}</div><div class="question-number">命运选择 ${String(q.id).padStart(2,'0')}</div><h2>${q.title}</h2><p class="question-context">${q.context}</p><div class="choice-list">${ordered.map((ch,i)=>`<button class="choice-button ${pending&&answers[index+1]===ch.id?'choice-button--selected':''}" data-choice="${ch.id}" ${pending?'disabled':''}><span class="choice-symbol">${['甲','乙','丙','丁'][i]}</span><span class="choice-text">${ch.text}</span><span class="choice-arrow">↗</span></button>`).join('')}</div><p class="question-instruction">请选择此刻最像你的行动，没有标准答案。</p></div><div class="quiz-bottom"><button class="secondary-button" data-action="back">← 上一题</button><span class="step-hint">故事将根据选择继续</span><button class="text-button" data-action="restart">本局重答</button></div><p class="story-note">选择仅用于本次互动故事的角色倾向与结局计算</p></section>`;}
  function evaluation(){return engine.evaluate(answers);}
  function preview(){const e=evaluation(),ending=endingById[e.endingId];return `<section class="preview-view enter"><div class="preview-card ornament-frame">${seal('卷')}<p class="overline">卷 宗 已 解 密 一 半</p><h1>你的古代人生<br>已有定数</h1><p class="preview-label">你在大曜王朝走到了</p><div class="preview-episode">第 <strong>${ending.episode}</strong> 集</div>${fateProgress(ending.episode)}<p class="preview-type">${roleNames[e.role]}型 · ${tierNames[e.tier]}</p><div class="preview-locked"><span>✧</span><div><strong>专属身份尚未揭晓</strong><small>人物称号 · 命运终章 · 四维画像 · 三句台词</small></div></div><div class="payment-notice"><strong>完整档案已解锁</strong><p>已通过兑换码验证，本次完整报告已包含在小红书商品权益中，无需二次支付。</p></div><button class="primary-button" data-action="report">查看完整命运档案 ${arrow()}</button></div></section>`;}
  function report(){const e=evaluation(),ending=endingById[e.endingId];const story=block('你的命运终章',ending.title,`<div class="story-paragraphs">${ending.story.map(t=>`<p>${t}</p>`).join('')}</div><div class="echo-box"><strong>最后一子</strong><p>${engine.getEndingEcho(e)}</p></div>`,'壹');const bars=block('你的四维人物画像','本局选择倾向，非心理学测量分数',`<div class="score-list">${['strategy','social','courage','duty'].map(role=>`<div class="score-row"><div class="score-header"><strong>${roleNames[role]}</strong><span>${Math.round(e.scores[role]/32*100)}%</span></div><div class="score-track"><div style="width:${Math.round(e.scores[role]/32*100)}%"></div></div><p>${roleDescriptions[role]}</p></div>`).join('')}</div>`,'贰'); const retros=['你从密信风波里，作出了改变信任与证据分配的第一步。','你在粮仓危机中选择了自己的方式，为接下来行动留下筹码。','你在夜宴的混乱中站稳脚跟，决定该保护什么、揭露什么。','殿前的最后一刻，你作出了决定，命运因此落笔。'];const recalls=block('改写命运的四次选择','你从故事里留下的真实行动',`<div class="recall-list">${[4,8,12,16].map((id,i)=>`<div class="recall-item"><span class="recall-index">0${i+1}</span><div><h3>${['密信风波','粮仓危机','夜宴惊变','殿前定局'][i]}</h3><p>${questions[id-1].choices.find(c=>c.id===answers[id]).text}。${retros[i]}</p></div></div>`).join('')}</div>`,'叁'); const insight=block('你的光芒与盲点','在故事之外，认识另一面的自己',[['你的天赋',ending.strengths],['可能的盲点',ending.shadow],['送给你的话',ending.counsel]].map(([a,b])=>`<div class="insight-card"><span>${a}</span><p>${b}</p></div>`).join(''),'肆'); const quote=block('专属人物台词','若这是一部古装剧，你会留下的话',`<div class="quote-list">${ending.quotes.map((q,i)=>`<blockquote><span>0${i+1}</span>“${q}”</blockquote>`).join('')}</div>`,'伍');return `<section class="report-view enter"><div class="report-top"><span class="report-tag">大曜 · 命运终章</span><span class="report-demo">兑换码已解锁</span></div><div class="result-hero ornament-frame">${seal(({strategy:'谋',social:'和',courage:'勇',duty:'守'})[e.role])}<p class="overline">你 的 古 代 人 生 档 案</p><p class="result-episode">第 <strong>${ending.episode}</strong> 集</p>${fateProgress(ending.episode)}<h1>${ending.name}</h1><div class="result-sub">${roleNames[e.role]}型 · ${tierNames[e.tier]}</div><blockquote>“${ending.coverQuote}”</blockquote></div>${story}${bars}${recalls}${insight}${quote}<div class="report-actions"><button class="primary-button" data-action="share">保存我的命运海报 ${arrow()}</button><button class="secondary-button" data-action="newgame">再活一次 · 使用剩余次数</button><button class="secondary-button" data-action="share-link">复制专属结果链接</button><button class="text-button" data-action="revoke-share">关闭此前分享链接</button><p>故事设定与角色倾向属于趣味创作，不用于判断真实人格或能力。</p></div></section>`;}
  function accessView(){return `<section class="chapter-view enter"><div class="chapter-topline">大曜 · 权益验证</div><div class="chapter-glyph">钥</div><h1>开启你的古代人生</h1><p class="chapter-description" style="text-indent:0;text-align:center">在小红书购买后，将收到的完整兑换码直接复制粘贴到下方。每个兑换码可发起 3 次独立测评。</p><form id="redeem-form" class="redeem-form"><label for="redeem-code">专属兑换码</label><input type="text" id="redeem-code" autocomplete="off" spellcheck="false" inputmode="text" placeholder="FATE-XXXXX-XXXXX-XXXXX-XXXXX" maxlength="80" aria-label="兑换码" /><div class="redeem-row"><button class="secondary-button" type="button" data-action="paste">粘贴</button><button class="primary-button" type="submit" ${busy?'disabled':''}>${busy?'正在验证…':'验证并进入'}</button></div></form><p class="hero-note">无需逐字输入 · 可长按粘贴 · 验证不扣次数</p>${!api.getConfigured()?'<p class="setup-note">开发环境尚未绑定 Supabase。请按 README 配置 web/config.js。</p>':''}<p class="disclaimer">该产品为架空历史趣味互动故事。购买与售后均在小红书店铺进行。</p></section>`;}
  function dashboard(){const rows=gameSessions.filter(s=>s.state==='in_progress').map(s=>`<div class="history-item"><span>未完成 · 已答 ${Object.keys(s.answers||{}).length}/16 题</span><button class="secondary-button" data-action="resume" data-id="${s.id}">继续上次测评</button></div>`).join('');const reports=history.map(r=>`<div class="history-item"><span>第 ${r.episode}/90 集 · ${html(endingById[r.ending_id]?.name||'命运档案')}</span><button class="secondary-button" data-action="open-result" data-id="${r.id}">查看结果</button></div>`).join('');return `<section class="dashboard-view enter"><div class="dashboard-head"><p class="overline">大 曜 · 专 属 权 益</p><h1>我的命运档案</h1><p>剩余 <strong>${credits}</strong> / 3 次新测评机会</p><div class="progress-track"><span style="width:${(3-credits)/3*100}%"></span></div></div><button class="primary-button" ${credits<1||busy?'disabled':''} data-action="newgame">${busy?'请稍候…':credits>0?'开始新的一次命运':'3 次体验已使用完毕'}</button><p class="dashboard-hint">开始新测评才占用 1 次机会；返回修改和断点续玩不重复扣次。</p><h2>未完成的故事</h2>${rows||'<p class="empty-history">暂无进行中的故事</p>'}<h2>已完成的档案</h2>${reports||'<p class="empty-history">完成 16 道题后，报告会显示在这里</p>'}<button class="text-button" data-action="logout">切换兑换码</button><p class="disclaimer">如果遇到兑换码或订单问题，请回到小红书订单联系店铺客服。</p></section>`;}
  function sharedReport(){if(!publicData)return accessView();const r=publicData;const pct=Math.round(r.episode/90*100);return `<section class="report-view enter"><div class="report-top"><span class="report-tag">朋友分享 · 大曜命运档案</span></div><div class="result-hero ornament-frame">${seal('曜')}<p class="overline">一 个 来 自 大 曜 的 故 事</p><p class="result-episode">第 <strong>${r.episode}</strong> 集</p>${fateProgress(r.episode)}<h1>${html(r.name)}</h1><div class="result-sub">${html(roleNames[r.role]||'')}型 · ${html(tierNames[r.tier]||'')}</div><blockquote>“${html(r.coverQuote)}”</blockquote></div>${block('命运终章',html(r.title),`<div class="story-paragraphs">${r.story.map(s=>`<p>${html(s)}</p>`).join('')}</div>`,'壹')}${block('人物画像','来自这局故事中的选择倾向',`<div class="score-list">${Object.entries(r.scores||{}).map(([k,n])=>`<div class="score-row"><div class="score-header"><strong>${html(roleNames[k]||k)}</strong><span>${Math.round(n/32*100)}%</span></div><div class="score-track"><div style="width:${Math.round(n/32*100)}%"></div></div></div>`).join('')}</div>`,'贰')}${block('专属台词','写在这部古装剧中的三句话',`<div class="quote-list">${r.quotes.map((q,i)=>`<blockquote><span>0${i+1}</span>“${html(q)}”</blockquote>`).join('')}</div>`,'叁')}<div class="report-actions"><button class="primary-button" data-action="share-exit">我也想测</button><p>朋友的分享结果不包含兑换码；自己体验需要单独购买取得兑换码。</p></div></section>`;}
  async function refreshDashboard(){const data=await api.call('dashboard');credits=data.remaining;gameSessions=data.sessions||[];history=data.results||[];screen='dashboard';errorText='';render();}
  async function launch(){busy=true;render();try{const d=await api.call('start');sessionId=d.sessionId;answers={};index=0;resultId='';screen='chapter';errorText='';}catch(e){errorText=e.message;}finally{busy=false;render();}}
  async function resume(id){busy=true;render();try{const d=await api.call('get_session',{sessionId:id});sessionId=id;answers=d.session.answers||{};const missing=Array.from({length:16},(_,i)=>i+1).find(i=>!engine.isChoiceId(answers[i]));index=(missing||16)-1;screen=index%4===0?'chapter':'quiz';if(!missing){const done=await api.call('complete',{sessionId});resultId=done.result.id;screen='preview';}errorText='';}catch(e){errorText=e.message;}finally{busy=false;render();}}
  async function showSavedResult(id){busy=true;render();try{const d=await api.call('get_result',{resultId:id});resultId=id;const existing=history.find(r=>r.id===id);if(existing){const s=gameSessions.find(x=>x.id===existing.game_session_id);if(s&&engine.isComplete(s.answers)){answers=s.answers;screen='report';errorText='';return;}}// 不依赖浏览器旧存档，必要时从会话恢复历史答案
      if(existing){const d2=await api.call('get_session',{sessionId:existing.game_session_id});answers=d2.session.answers;sessionId=existing.game_session_id;}screen='report';errorText='';}catch(e){errorText=e.message;}finally{busy=false;render();}}
  async function showPublic(token){busy=true;render();try{const d=await api.call('public_result',{token},true);publicData=d.result;screen='shared';errorText='';}catch(e){screen='share-error';errorText=e.message;}finally{busy=false;render();}}
  async function copyText(text){try{await navigator.clipboard.writeText(text);alert('结果链接已复制，可以发给朋友了。');}catch{window.prompt('请复制以下链接：',text);}}
  async function shareLink(){if(!resultId)return;try{const d=await api.call('share',{resultId});const url=location.origin+location.pathname+'#share='+d.token;await copyText(url);}catch(e){alert(e.message);}}
  async function revokeShare(){if(!resultId)return;if(!confirm('确定关闭这份结果此前所有分享链接吗？'))return;try{await api.call('revoke_shares',{resultId});alert('旧分享链接已关闭。');}catch(e){alert(e.message);}}
  function render(){persist();root.innerHTML=`<div class="app-shell"><header class="app-header"><div class="header-brand"><span class="brand-emblem">曜</span><div><strong>大曜命运档案</strong><small>ANCIENT FATE CHRONICLE</small></div></div><button class="header-link" data-action="dashboard">${screen==='shared'?'返回验证':'我的档案'} ↗</button></header><main>${({redeem:accessView,dashboard,home,chapter,quiz,preview,report,shared:sharedReport,"share-error":()=>`<section class="chapter-view"><h2>分享链接无法打开</h2><p>${html(errorText)}</p><button class="primary-button" data-action="share-exit">返回首页</button></section>`})[screen]()}</main><footer class="site-footer"><span>大 曜 · 命 运 档 案</span><span>CHOICES MAKE THE STORY</span></footer></div>${errorText&&screen!=="share-error"?`<div class="ui-error" role="alert">${html(errorText)}</div>`:""}${feedbackOverlay()}${restartDialogOpen?`<div class="restart-overlay"><div class="restart-dialog" role="alertdialog" aria-modal="true" aria-labelledby="restart-dialog-title" aria-describedby="restart-dialog-description"><span class="restart-dialog-kicker">大曜 · 命运回溯</span><h2 id="restart-dialog-title">确定重新开始吗？</h2><p id="restart-dialog-description">本次已占用的体验次数不会退回。将清空当前会话答案，从第一幕重新作答。</p><div class="restart-dialog-actions"><button class="secondary-button" data-action="cancel-restart" autofocus>继续当前故事</button><button class="primary-button" data-action="confirm-restart">确认重新开始</button></div></div></div>`:''}`;if(!restartDialogOpen)window.scrollTo(0,0);}
  async function advance(){advanceTimer=null;if(restartDialogOpen){advanceDue=true;return;}const qid=index+1;if(qid===16){try{const done=await api.call('complete',{sessionId});resultId=done.result.id;screen='preview';errorText='';}catch(e){errorText=e.message;screen='quiz';}}else if(qid%4===0){index=qid;screen='chapter';}else index=qid;pending=false;render();}
  
  // Preview stays on this page. Browsers cannot silently write images to Photos.
  let posterUrl='',posterFile=null;
  function closePoster(){
    document.getElementById('poster-overlay')?.remove();
    if(posterUrl)URL.revokeObjectURL(posterUrl);
    posterUrl='';posterFile=null;
    document.body.style.overflow='';
  }
  function openPoster(blob,name){
    closePoster();
    const ua=navigator.userAgent||'';
    const inApp=/MicroMessenger|XiaoHongShu|XHS|RedNote|Weibo|QQ\/|FBAN|FBAV/i.test(ua);
    const isIOS=/iPhone|iPad|iPod/i.test(ua)||(/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1);
    const phoneOrTablet=/Android|iPhone|iPad|iPod|Mobile/i.test(ua)||matchMedia('(pointer:coarse)').matches||innerWidth<761;
    posterUrl=URL.createObjectURL(blob);
    posterFile=typeof File==='function'?new File([blob],name,{type:'image/png'}):null;
    let canShare=false;
    try{canShare=!!(posterFile&&navigator.share&&navigator.canShare&&navigator.canShare({files:[posterFile]}));}catch{}
    const instructions=inApp
      ? '当前是 App 内置浏览器，可能禁止保存网页生成的图片。建议使用右上角菜单选择“在浏览器打开”，然后在 Safari / Chrome 中保存。若没有此选项，请复制当前页面地址到系统浏览器。'
      : canShare
        ? '点击“系统分享”，在弹出的手机系统菜单中选择“存储图像 / 保存到照片”。也可以尝试长按下方海报。'
        : isIOS
          ? '长按下方海报，看看是否出现“存储到照片”。如果没有，请在 Safari 打开本页重试；手机浏览器并不都支持网页直接写入相册。'
          : '长按下方海报，选择“保存图片”。若没有保存选项，请在系统 Chrome 浏览器打开页面重试。';
    const overlay=document.createElement('div');
    overlay.className='poster-overlay';
    overlay.id='poster-overlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','保存命运海报');
    overlay.innerHTML=`<div class="poster-sheet"><div class="poster-header"><strong>保存我的命运海报</strong><button type="button" data-action="poster-close">返回结果页 ×</button></div><p class="poster-tip" id="poster-tip"></p><div class="poster-preview-scroll"><img class="poster-preview-image" alt="完整命运海报，可尝试长按保存"></div><div class="poster-actions">${canShare?'<button type="button" data-action="poster-share">系统分享 · 保存到照片</button>':''}${phoneOrTablet?'':'<button type="button" data-action="poster-download">下载 PNG 到电脑</button>'}</div></div>`;
    overlay.querySelector('#poster-tip').textContent=instructions;
    // Use an image data URL for long-press compatibility. In some WebViews,
    // a blob: URL is treated as a temporary document rather than a saveable photo.
    const img=overlay.querySelector('.poster-preview-image');
    img.src=posterUrl;
    try{
      const reader=new FileReader();
      reader.onload=()=>{if(posterUrl&&document.getElementById('poster-overlay')===overlay&&typeof reader.result==='string')img.src=reader.result;};
      reader.readAsDataURL(blob);
    }catch{}
    overlay.addEventListener('click',event=>{
      const target=event.target.closest('[data-action]');
      if(target)handlePosterClick(target.dataset.action);
      else if(event.target===overlay)closePoster();
    });
    document.body.appendChild(overlay);
    document.body.style.overflow='hidden';
    if(/MicroMessenger/i.test(ua)&&resultId&&api.getToken()){
      const tip=overlay.querySelector('#poster-tip');
      tip.textContent='正在为微信准备高清海报，请稍候……';
      const reader=new FileReader();
      reader.onload=async()=>{
        try{
          const data=String(reader.result||'');
          const base64=data.startsWith('data:image/png;base64,')?data.slice('data:image/png;base64,'.length):'';
          if(!base64)throw new Error('图片编码失败');
          const uploaded=await api.call('poster_upload',{resultId,image:base64});
          if(document.getElementById('poster-overlay')!==overlay)return;
          const img=overlay.querySelector('.poster-preview-image');
          img.onload=()=>{
            if(document.getElementById('poster-overlay')!==overlay)return;
            tip.textContent=/iPhone|iPad|iPod/i.test(ua)?'iPhone 微信：长按下方高清图，选择“保存图片”。若无法保存，点“查看高清原图”后长按。':'安卓微信：长按下方高清图，选择“保存图片”或“下载图片”。若无此选项，点“查看高清原图”后长按。图片链接 1 小时有效。';
          };
          img.onerror=()=>{
            if(document.getElementById('poster-overlay')!==overlay)return;
            tip.textContent='微信加载高清图失败。请尝试在手机系统浏览器中打开测评，再保存图片。';
          };
          img.src=uploaded.imageUrl;
          const btn=document.createElement('a');
          btn.className='poster-original-link';
          btn.href=uploaded.imageUrl;
          btn.target='_blank';btn.rel='noopener noreferrer';
          btn.textContent='查看高清原图（长按保存）';
          overlay.querySelector('.poster-actions').prepend(btn);
        }catch(e){
          if(document.getElementById('poster-overlay')!==overlay)return;
          tip.textContent='微信海报上传暂时失败：'+(e?.message||'请重试')+'。可尝试在手机系统浏览器打开测评保存。';
        }
      };
      reader.onerror=()=>{if(document.getElementById('poster-overlay')===overlay)tip.textContent='海报图片处理失败，请重试。';};
      reader.readAsDataURL(blob);
    }
  }
  function handlePosterClick(action){
    if(action==='poster-close'){closePoster();return true;}
    if(action==='poster-share'){
      if(posterFile&&navigator.share){
        // Call share directly inside the click handler: iOS requires user activation.
        navigator.share({files:[posterFile],title:'大曜命运档案'}).catch(e=>{
          if(e?.name!=='AbortError'){
            const tip=document.getElementById('poster-tip');
            if(tip)tip.textContent='系统分享未能打开。请在 Safari / Chrome 中打开测评页面并重试，或长按海报保存。';
          }
        });
      }
      return true;
    }
    if(action==='poster-download'){
      if(posterUrl){
        const a=document.createElement('a');
        a.href=posterUrl;
        a.download=posterFile?.name||'命运海报.png';
        document.body.appendChild(a);a.click();a.remove();
      }
      return true;
    }
    return false;
  }
  function exportCard(){
    const ev=evaluation(),ending=endingById[ev.endingId];
    if(!window.FatePoster){alert('海报组件未加载，请刷新网页重试');return;}
    window.FatePoster.generate({ev,ending,roleNames,tierNames,totalEpisodes:engine.TOTAL_EPISODES})
      .then(blob=>openPoster(blob,'古代人生-第'+ending.episode+'集.png'))
      .catch(error=>alert('海报生成失败：'+(error?.message||'请稍后重试')));
  }
  root.addEventListener('submit',async ev=>{if(ev.target?.id!=='redeem-form')return;ev.preventDefault();if(busy)return;const value=root.querySelector('#redeem-code')?.value||'';const canonical=value.normalize('NFKC').replace(/[\s\-]/g,'').toUpperCase();if(!/^FATE[A-HJ-NP-Z2-9]{20}$/.test(canonical)){errorText=value.trim()?'兑换码格式不正确，请从管理员导出的 CSV 第二列复制完整兑换码（不是记录 ID）。':'请先粘贴实际生成的兑换码，输入框中的 XXXXX 只是示例。';render();const input=root.querySelector('#redeem-code');if(input)input.value=value;return;}busy=true;errorText='';render();try{const d=await api.call('redeem',{code:value},true);api.setToken(d.token);await refreshDashboard();}catch(e){errorText=e.message;screen='redeem';}finally{busy=false;render();const input=root.querySelector('#redeem-code');if(input)input.value=value;}});
  root.addEventListener('click',async ev=>{
    const el=ev.target.closest('[data-action],[data-choice]');if(!el)return;
    const action=el.dataset.action;
    if(handlePosterClick(action))return;
    if(restartDialogOpen && action!=='cancel-restart' && action!=='confirm-restart')return;
    if(busy || (pending && !['cancel-restart','confirm-restart','restart','dashboard'].includes(action)))return;
    if(pending && (action==='restart' || action==='dashboard')){if(advanceTimer!==null)clearTimeout(advanceTimer);advanceTimer=null;pending=false;}
    if(el.dataset.choice){
      const choice=el.dataset.choice;
      const question=index+1;
      const previousAnswers=answers;
      const feedback=questions[index].choices.find(c=>c.id===choice).feedback;
      const duration=engine.getFeedbackDurationMs(feedback);
      let feedbackFinished=false;
      let answerSaved=false;

      // 立即展示剧情反馈，并行提交答案；网络延迟不再阻塞弹窗。
      // 只有反馈动画结束且服务端确认保存，才能进入下一题。
      answers={...answers,[question]:choice};
      pending=true;busy=true;errorText='';
      render();
      advanceTimer=setTimeout(()=>{
        advanceTimer=null;
        feedbackFinished=true;
        if(answerSaved) void advance();
      },duration);
      try{
        const saved=await api.call('save_answer',{sessionId,question,choice});
        answers=saved.answers;
        answerSaved=true;
        busy=false;
        if(feedbackFinished) await advance();
      }catch(e){
        if(advanceTimer!==null)clearTimeout(advanceTimer);
        advanceTimer=null;
        answers=previousAnswers;
        pending=false;busy=false;
        errorText='答案保存失败，请重新选择。'+(e?.message||'');
        render();
      }
      return;
    }
    switch(action){
      case 'paste': try{const value=await navigator.clipboard.readText();const input=root.querySelector('#redeem-code');if(input){input.value=value;input.focus();}}catch{errorText='浏览器不允许自动读取剪贴板，请长按输入框或使用 Ctrl+V 粘贴。';render();}return;
      case 'newgame': await launch();return;
      case 'resume': await resume(el.dataset.id);return;
      case 'open-result': await showSavedResult(el.dataset.id);return;
      case 'dashboard': if(screen==='shared'){location.hash='';screen='redeem';render();return;} if(api.getToken())await refreshDashboard();else{screen='redeem';render();}return;
      case 'logout': api.setToken('');sessionId='';resultId='';screen='redeem';render();return;
      case 'share-exit': location.hash='';screen=api.getToken()?'dashboard':'redeem';if(api.getToken())await refreshDashboard();else render();return;
      case 'share-link': await shareLink();return;
      case 'revoke-share': await revokeShare();return;
      case 'start': await launch();return;
      case 'enter': screen='quiz';break;
      case 'back': if(index>0)index--;else screen='chapter';break;
      case 'back-chapter': index=Math.max(0,index-1);screen='quiz';break;
      case 'report': screen='report';break;
      case 'share': exportCard();return;
      case 'restart': requestRestart();return;
      case 'cancel-restart': cancelRestart();return;
      case 'confirm-restart': await reset();return;
    }
    render();
  });
  (async()=>{
    const token=(location.hash.match(/^#share=([a-f0-9]{64})$/)||[])[1];
    if(token){await showPublic(token);return;}
    if(api.getToken()){try{await refreshDashboard();}catch{api.setToken('');screen='redeem';render();}}
    else render();
  })();
})();