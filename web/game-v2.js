(() => {
  'use strict';
  const root = document.getElementById('root');
  const api = window.FateAPI;
  let screen = 'redeem', sessionId = '', step = null, result = null, dashboard = null, error = '', busy = false;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const call = (action, body, anonymous = false) => api.call(action, body, anonymous);
  function layout(body) { const environment=window.FATE_CONFIG?.environmentName; root.innerHTML = `<div class="app-shell"><header class="app-header"><div class="header-brand"><span class="brand-emblem">曜</span><div><strong>大曜命运档案</strong><small>ANCIENT FATE CHRONICLE</small></div></div><button class="header-link" data-action="dashboard">我的档案 ↗</button></header>${environment&&!environment.startsWith('PRODUCTION')?`<p class="report-demo" style="text-align:center">${esc(environment)}</p>`:''}<main>${body}</main><footer class="site-footer"><span>大 曜 · 命 运 档 案</span><span>CHOICES MAKE THE STORY</span></footer></div>${error ? `<div class="ui-error" role="alert">${esc(error)}</div>` : ''}`; }
  function redeem(code = '') { layout(`<section class="chapter-view enter"><div class="chapter-topline">大曜 · 权益验证</div><div class="chapter-glyph">钥</div><h1>开启你的古代人生</h1><p class="chapter-description" style="text-indent:0;text-align:center">粘贴完整兑换码后开始。验证不会扣除体验次数。</p><form id="redeem-form" class="redeem-form"><label for="redeem-code">专属兑换码</label><textarea id="redeem-code" rows="2" maxlength="80" placeholder="FATE-XXXXX-XXXXX-XXXXX-XXXXX">${esc(code)}</textarea><div class="redeem-row"><button class="primary-button" ${busy?'disabled':''}>${busy?'正在验证…':'验证并进入'}</button></div></form><p class="disclaimer">架空历史互动故事，不属于心理诊断或科学人格评估。</p></section>`); }
  function dash() { const sessions = (dashboard?.sessions || []).filter(s => s.state === 'in_progress'); const reports = dashboard?.results || []; layout(`<section class="dashboard-view enter"><div class="dashboard-head"><p class="overline">大 曜 · 专 属 权 益</p><h1>我的命运档案</h1><p>剩余 <strong>${dashboard?.remaining ?? 0}</strong> / ${dashboard?.total ?? 3} 次新测评机会</p></div><button class="primary-button" data-action="start" ${busy || !(dashboard?.remaining > 0)?'disabled':''}>开始新的一次命运</button><h2>未完成的故事</h2>${sessions.map(s=>`<div class="history-item"><span>已答 ${Object.keys(s.answers||{}).length}/16 题</span><button class="secondary-button" data-resume="${s.id}">继续</button></div>`).join('')||'<p class="empty-history">暂无进行中的故事</p>'}<h2>已完成的档案</h2>${reports.map(r=>`<div class="history-item"><span>第 ${r.episode}/90 集</span><button class="secondary-button" data-result="${r.id}">查看</button></div>`).join('')||'<p class="empty-history">暂无已完成档案</p>'}<button class="text-button" data-action="logout">切换兑换码</button></section>`); }
  function quiz() { const q = step.question; layout(`<section class="quiz-view enter"><div class="progress-box"><div class="progress-top"><span>卷宗进度 · ${esc(step.chapter?.title || '')}</span><strong>${q.id} / 16</strong></div><div class="progress-track"><span style="width:${q.id/16*100}%"></span></div></div><div class="quiz-card ornament-frame"><div class="question-heading"><span class="chapter-pill">第 ${q.episode} 集 · ${esc(step.chapter?.title || '')}</span></div><div class="question-number">命运选择 ${String(q.id).padStart(2,'0')}</div><h2>${esc(q.title)}</h2><p class="question-context">${esc(q.context)}</p><div class="choice-list">${q.choices.map((c,i)=>`<button class="choice-button ${step.selected===c.id?'choice-button--selected':''}" data-choice="${c.id}" ${busy?'disabled':''}><span class="choice-symbol">${['甲','乙','丙','丁'][i]}</span><span class="choice-text">${esc(c.text)}</span></button>${c.feedback?`<p class="reaction-box reaction-box--visible">${esc(c.feedback)}</p>`:''}`).join('')}</div></div><div class="quiz-bottom"><button class="secondary-button" data-action="back" ${q.id===1?'disabled':''}>← 上一题</button><span class="step-hint">选择将由服务器保存</span></div></section>`); }
  function report() { const r=result; const scores=Object.entries(r.scores||{}).map(([name,value])=>`<div class="score-row"><div class="score-header"><strong>${esc(name)}</strong><span>${Math.round(Number(value)/32*100)}%</span></div><div class="score-track"><div style="width:${Math.round(Number(value)/32*100)}%"></div></div></div>`).join(''); layout(`<section class="report-view enter"><div class="report-top"><span class="report-tag">大曜 · 命运终章</span></div><div class="result-hero ornament-frame"><p class="overline">你 的 古 代 人 生 档 案</p><p class="result-episode">第 <strong>${r.episode}</strong> 集</p><h1>${esc(r.name)}</h1><div class="result-sub">${esc(r.role)} · ${esc(r.tier)}</div><blockquote>“${esc(r.coverQuote)}”</blockquote></div><section class="report-section"><h2>${esc(r.title)}</h2><div class="story-paragraphs">${r.story.map(x=>`<p>${esc(x)}</p>`).join('')}</div></section><section class="report-section"><h2>你的四维人物画像</h2><div class="score-list">${scores}</div></section><section class="report-section"><h2>你的光芒与盲点</h2><div class="insight-card"><span>你的天赋</span><p>${esc(r.strengths)}</p></div><div class="insight-card"><span>可能的盲点</span><p>${esc(r.shadow)}</p></div><div class="insight-card"><span>送给你的话</span><p>${esc(r.counsel)}</p></div></section><section class="report-section"><h2>你的三句人物台词</h2><div class="quote-list">${r.quotes.map((x,i)=>`<blockquote><span>0${i+1}</span>“${esc(x)}”</blockquote>`).join('')}</div></section><div class="report-actions"><button class="primary-button" data-action="poster">保存命运海报</button><button class="primary-button" data-action="share">复制专属结果链接</button><button class="secondary-button" data-action="dashboard">返回档案</button></div></section>`); }
  async function refresh() { dashboard = await call('dashboard'); screen='dashboard'; error=''; dash(); }
  async function load(id, question) { sessionId=id; step=await call('get_step',{sessionId:id,question}); screen='quiz'; error=''; quiz(); }
  async function finish() { const done=await call('complete',{sessionId}); result=done.result; const full=await call('get_result',{resultId:result.id}); result=full.result; screen='report'; report(); }
  function render() {
    if (screen === 'quiz') quiz();
    else if (screen === 'dashboard') dash();
    else if (screen === 'report') report();
    else redeem();
  }
  root.addEventListener('submit', async event => {
    if (event.target.id !== 'redeem-form') return;
    event.preventDefault();
    if (busy) return;
    const code = root.querySelector('#redeem-code')?.value || '';
    busy = true;
    error = '';
    redeem(code);
    try {
      const data = await call('redeem', { code }, true);
      api.setToken(data.token);
      await refresh();
    } catch (e) {
      error = e.message;
      screen = 'redeem';
    } finally {
      busy = false;
      if (screen === 'redeem') redeem(code);
      else render();
    }
  });
  root.addEventListener('click', async event => {
    const el = event.target.closest('[data-action],[data-choice],[data-resume],[data-result]');
    if (!el || busy) return;
    busy = true;
    error = '';
    render();
    try {
      if (el.dataset.choice) {
        await call('save_answer', { sessionId, question: step.question.id, choice: el.dataset.choice });
        if (step.question.id === 16) await finish();
        else await load(sessionId, step.question.id + 1);
      } else if (el.dataset.resume) await load(el.dataset.resume, 1);
      else if (el.dataset.result) {
        const data = await call('get_result', { resultId: el.dataset.result });
        result = data.result;
        screen = 'report';
      } else if (el.dataset.action === 'start') {
        const data = await call('start');
        await load(data.sessionId, 1);
      } else if (el.dataset.action === 'back') await load(sessionId, step.question.id - 1);
      else if (el.dataset.action === 'dashboard') await refresh();
      else if (el.dataset.action === 'logout') {
        api.setToken('');
        screen = 'redeem';
      } else if (el.dataset.action === 'poster') {
        if (!window.FatePoster) throw new Error('海报组件未加载');
        const blob = await window.FatePoster.generate({ ev: { role: result.role, scores: result.scores }, ending: result, roleNames: { strategy: '谋略', social: '人心', courage: '胆识', duty: '担当' }, tierNames: { early: '意外退场', middle: '另辟人生', legend: '终局传奇' }, totalEpisodes: 90 });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = '大曜命运档案.png';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else if (el.dataset.action === 'share') {
        const data = await call('share', { resultId: result.resultId });
        const url = location.origin + location.pathname + '#share=' + data.token;
        try { await navigator.clipboard.writeText(url); alert('结果链接已复制。'); }
        catch { prompt('请复制链接：', url); }
      }
    } catch (e) {
      error = e.message;
    } finally {
      busy = false;
      render();
    }
  });
  (async()=>{ const share=(location.hash.match(/^#share=([a-f0-9]{64})$/)||[])[1]; try { if(share){result=(await call('public_result',{token:share},true)).result;screen='report';report();} else if(api.getToken())await refresh(); else redeem(); } catch { api.setToken('');screen='redeem';redeem(); } })();
})();
