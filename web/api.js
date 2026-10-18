(() => {
  'use strict';
  const storageKey = 'dayao-fate:access-token';
  const endpoint = window.FATE_CONFIG?.apiUrl?.trim() || '';
  let token = '';
  try { token = localStorage.getItem(storageKey) || ''; } catch {}
  function setToken(value) {
    token = value || '';
    try {if (token) localStorage.setItem(storageKey,token); else localStorage.removeItem(storageKey);}catch{}
  }
  async function call(action, body = {}, anonymous = false) {
    if (!/^https:\/\/.+\/functions\/v1\/fate-api\/?$/.test(endpoint) && !/^http:\/\/localhost:\d+\/functions\/v1\/fate-api\/?$/.test(endpoint)) {
      throw new Error('尚未连接 Supabase：请先在 web/config.js 配置 apiUrl，再部署 Edge Function。');
    }
    const response = await fetch(endpoint, {
      method:'POST',
      headers: { 'content-type':'application/json', ...(token && !anonymous ? {'Authorization':'Bearer '+token}: {}) },
      body:JSON.stringify({action,...body}),
      cache:'no-store',
    });
    let json;
    try {json = await response.json();} catch {throw new Error('服务端未返回有效数据');}
    if (!response.ok) throw new Error(json.error || '服务暂时不可用');
    return json;
  }
  window.FateAPI = {call,setToken,getToken:()=>token,getConfigured:()=>Boolean(endpoint)};
})();