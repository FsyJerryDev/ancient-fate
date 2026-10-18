(() => {
  'use strict';
  const $=x=>document.getElementById(x);
  const apiUrl=window.FATE_CONFIG?.apiUrl||'';
  let jwt=''; // 只保存在当前页面内存，不保存管理员令牌到 localStorage
  const errors=message=>$('error').textContent=message||'';
  async function call(action,extra={}) {
    const res=await fetch(apiUrl,{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+jwt},body:JSON.stringify({action,...extra})});
    const data=await res.json();if(!res.ok)throw new Error(data.error||'操作失败');return data;
  }
  $('signin').onclick=async()=>{
    errors('');try{
      const url=new URL(apiUrl);const origin=url.origin;
      const key=window.FATE_CONFIG?.anonKey;
      if(!key)throw new Error('请在 config.js 中配置公开 anonKey 以支持管理员 Supabase Auth 登录');
      const res=await fetch(origin+'/auth/v1/token?grant_type=password',{method:'POST',headers:{'content-type':'application/json',apikey:key},body:JSON.stringify({email:$('email').value,password:$('password').value})});
      const data=await res.json();if(!res.ok)throw new Error(data.error_description||data.msg||'登录失败');
      jwt=data.access_token;
      await call('admin_list');
      $('login').hidden=true;$('workspace').hidden=false;
    }catch(e){jwt='';errors(e.message);}
  };
  $('issue').onclick=async()=>{
    errors('');try{
      const count=Number($('quantity').value);const d=await call('admin_issue',{count});
      $('issued').textContent=`批次 ${d.batchId}\n已生成 ${d.records.length} 枚兑换码，明文仅展示一次。`;
      const csv='兑换码记录ID,兑换码\n'+d.records.map(x=>`${x.id},${x.code}`).join('\n');
      const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`兑换码-${d.batchId}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),60000);
    }catch(e){errors(e.message);}
  };
  for(const [button,status] of [['freeze','frozen'],['unfreeze','active']]){$(button).onclick=async()=>{errors('');try{if(!confirm('确定修改此码状态吗？'))return;await call('admin_update',{codeId:$('manage-id').value.trim(),status});alert('状态已更新');}catch(e){errors(e.message);}};}
  $('bind').onclick=async()=>{errors('');try{await call('admin_bind_order',{codeId:$('manage-id').value.trim(),orderReference:$('order-ref').value.trim()});alert('绑定成功');}catch(e){errors(e.message);}};
  $('list').onclick=async()=>{errors('');try{
    const d=await call('admin_list');const table=document.createElement('table');
    const head=document.createElement('tr');for(const k of ['创建时间','记录 ID','已用/总量','状态']){const th=document.createElement('th');th.textContent=k;head.append(th);}table.append(head);
    for(const c of d.codes){const row=document.createElement('tr');for(const value of [new Date(c.created_at).toLocaleString(),c.id,c.used_uses+'/'+c.total_uses,c.status]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}table.append(row);}
    $('rows').replaceChildren(table);
  }catch(e){errors(e.message);}};
})();