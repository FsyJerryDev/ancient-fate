(() => {
  'use strict';
  // Shared poster renderer for production, Tokyo staging and the offline demo.
  // A two-pass layout keeps the entire report readable without fixed-height clipping.
  const WIDTH=900;
  const X=68;
  const CARD_WIDTH=764;
  const INNER_X=116;
  const INNER_WIDTH=668;
  const SERIF='"Songti SC","STSong","Noto Serif CJK SC",serif';
  const SANS='"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
  const COLORS={
    ink:'#413248', muted:'#8a768a', purple:'#72547e', deep:'#594164',
    gold:'#af8a6b', paper:'#fffaf8', soft:'#f4edf4', line:'#e7dae5'
  };

  function font(ctx,size,weight='400',serif=false){
    ctx.font=weight+' '+size+'px '+(serif?SERIF:SANS);
  }
  function linesFor(ctx,text,maxWidth,size,weight='400',serif=false){
    font(ctx,size,weight,serif);
    const output=[];
    const paragraphs=String(text||'').split('\n');
    for(const paragraph of paragraphs){
      if(!paragraph){output.push('');continue;}
      let line='';
      for(const char of Array.from(paragraph)){
        if(line && ctx.measureText(line+char).width>maxWidth){
          output.push(line);
          line=char;
        } else line+=char;
      }
      if(line)output.push(line);
    }
    return output.length?output:[''];
  }
  function text(ctx,str,x,y,opts,draw){
    const size=opts.size||40;
    const lineHeight=opts.lineHeight||Math.round(size*1.6);
    const weight=opts.weight||'400';
    const serif=!!opts.serif;
    const list=linesFor(ctx,str,opts.width||INNER_WIDTH,size,weight,serif);
    if(draw){
      font(ctx,size,weight,serif);
      ctx.fillStyle=opts.color||COLORS.ink;
      ctx.textBaseline='alphabetic';
      ctx.textAlign=opts.align||'left';
      for(let i=0;i<list.length;i++)ctx.fillText(list[i],x,y+i*lineHeight);
    }
    return y+list.length*lineHeight;
  }
  function rounded(ctx,x,y,w,h,r,fill,stroke){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
  }
  function sectionLabel(ctx,number,label,y,draw){
    if(!draw)return;
    ctx.textAlign='left';ctx.textBaseline='alphabetic';
    font(ctx,28,'700');ctx.fillStyle=COLORS.gold;
    ctx.fillText(number+' / '+label,INNER_X,y);
  }
  function card(ctx,y,h,draw){
    if(draw){
      rounded(ctx,X,y,CARD_WIDTH,h,28,'#fffdfb',COLORS.line);
      ctx.fillStyle=COLORS.gold;
      rounded(ctx,X+28,y+42,5,39,2,COLORS.gold);
    }
  }

  function cover(ctx,data,draw){
    const end=data.ending,ev=data.ev;
    const roleCharacters={strategy:'谋',social:'和',courage:'勇',duty:'守'};
    const headline='第 '+end.episode+' 集';
    const titleLines=linesFor(ctx,end.name,640,76,'700',true);
    const quoteLines=linesFor(ctx,'“'+end.coverQuote+'”',610,40,'400');
    const titleHeight=titleLines.length*98;
    const nameStart=1005;
    const identityBottom=nameStart+titleHeight+72;
    const quoteY=identityBottom+33;
    const quoteHeight=106+quoteLines.length*65;
    const coverBottom=quoteY+quoteHeight+94;
    if(draw){
      const hero=ctx.createLinearGradient(0,0,0,coverBottom);
      hero.addColorStop(0,'#ede3ec');
      hero.addColorStop(.58,'#fbf4f4');
      hero.addColorStop(1,'#fffaf8');
      ctx.fillStyle=hero;ctx.fillRect(0,0,WIDTH,coverBottom);
      ctx.lineWidth=2;ctx.strokeStyle='#ceb6c5';
      ctx.strokeRect(46,48,WIDTH-92,coverBottom-106);

      ctx.textAlign='center';ctx.textBaseline='alphabetic';
      font(ctx,28,'600',true);ctx.fillStyle=COLORS.deep;
      ctx.fillText('大 曜 · 命 运 档 案',450,133);
      font(ctx,26,'400');ctx.fillStyle=COLORS.muted;
      ctx.fillText('穿越古代，你能活到第几集？',450,201);

      ctx.beginPath();ctx.arc(450,361,108,0,Math.PI*2);
      ctx.fillStyle='#f7edf4';ctx.fill();
      ctx.strokeStyle='#b49cb2';ctx.lineWidth=3;ctx.stroke();
      ctx.beginPath();ctx.arc(450,361,97,0,Math.PI*2);
      ctx.strokeStyle='#d5c2cf';ctx.lineWidth=1.5;ctx.stroke();
      font(ctx,139,'400',true);ctx.fillStyle=COLORS.purple;
      ctx.fillText(roleCharacters[ev.role]||'命',450,412);

      font(ctx,34,'400');ctx.fillStyle=COLORS.muted;
      ctx.fillText('你 的 古 代 人 生',450,545);
      font(ctx,123,'700',true);ctx.fillStyle=COLORS.ink;
      ctx.fillText(headline,450,684,660);
      font(ctx,29,'500');ctx.fillStyle=COLORS.muted;
      const pct=Math.round(end.episode/(data.totalEpisodes||90)*100);
      ctx.fillText('全剧 '+(data.totalEpisodes||90)+' 集  ·  命运进度 '+pct+'%',450,759);
      rounded(ctx,165,790,570,16,8,'#e7d8e5');
      rounded(ctx,165,790,570*Math.min(1,Math.max(0,end.episode/(data.totalEpisodes||90))),16,8,'#9875a3');

      rounded(ctx,95,850,710,identityBottom-850,24,'#fdf8fb','#dfceda');
      font(ctx,27,'600');ctx.fillStyle=COLORS.gold;
      ctx.fillText('— 你 的 专 属 命 运 身 份 —',450,919);
      text(ctx,end.name,450,nameStart,{size:76,lineHeight:98,width:640,weight:'700',serif:true,color:COLORS.deep,align:'center'},true);
      font(ctx,30,'400');ctx.fillStyle=COLORS.muted;
      ctx.fillText((data.roleNames[ev.role]||'')+'型 · '+(data.tierNames[ev.tier]||''),450,identityBottom-31);

      rounded(ctx,95,quoteY,710,quoteHeight,24,'#f3eaf1');
      font(ctx,27,'700',true);ctx.fillStyle=COLORS.gold;
      ctx.fillText('命 运 箴 言',450,quoteY+53);
      text(ctx,'“'+end.coverQuote+'”',450,quoteY+113,{size:40,lineHeight:65,width:610,weight:'400',align:'center',color:COLORS.ink},true);
      font(ctx,23,'400');ctx.fillStyle=COLORS.muted;
      ctx.fillText('一场关于选择的架空故事 · 仅供趣味探索',450,coverBottom-49);
    }
    return coverBottom;
  }

  function storyCard(ctx,data,y,draw){
    const end=data.ending;
    const titleLines=linesFor(ctx,end.title,INNER_WIDTH,50,'700',true);
    const paragraphs=end.story.map(t=>linesFor(ctx,t,INNER_WIDTH,41,'400'));
    let cy=y+186+titleLines.length*77;
    for(const p of paragraphs)cy+=p.length*67+29;
    const h=cy-y+35;
    card(ctx,y,h,draw);
    if(draw){
      sectionLabel(ctx,'01','命运终章',y+77,true);
      text(ctx,end.title,INNER_X,y+153,{size:50,lineHeight:77,width:INNER_WIDTH,weight:'700',serif:true,color:COLORS.deep},true);
      let yp=y+186+titleLines.length*77;
      for(let i=0;i<end.story.length;i++){
        text(ctx,end.story[i],INNER_X,yp,{size:41,lineHeight:67,width:INNER_WIDTH,color:COLORS.ink},true);
        yp+=paragraphs[i].length*67+29;
      }
    }
    return y+h+26;
  }

  function scoresCard(ctx,data,y,draw){
    const order=['strategy','social','courage','duty'];
    const h=665;
    card(ctx,y,h,draw);
    if(draw){
      sectionLabel(ctx,'02','你的四维人物画像',y+79,true);
      font(ctx,25,'400');ctx.fillStyle=COLORS.muted;ctx.textAlign='left';
      ctx.fillText('故事里的选择倾向，不代表心理测量分数',INNER_X,y+129);
      order.forEach((k,i)=>{
        const value=Math.max(0,Math.min(100,Math.round(Number(data.ev.scores[k]||0)/32*100)));
        const rowY=y+206+i*111;
        font(ctx,38,'600');ctx.fillStyle=COLORS.ink;ctx.textAlign='left';
        ctx.fillText(data.roleNames[k]||k,INNER_X,rowY);
        font(ctx,32,'700');ctx.fillStyle=COLORS.purple;ctx.textAlign='right';
        ctx.fillText(value+'%',INNER_X+INNER_WIDTH,rowY);
        rounded(ctx,INNER_X,rowY+25,INNER_WIDTH,15,8,'#eee5ed');
        if(value>0)rounded(ctx,INNER_X,rowY+25,INNER_WIDTH*value/100,15,7,'#a884b1');
      });
    }
    return y+h+26;
  }

  function strengthsCard(ctx,data,y,draw){
    const items=[
      ['你的天赋',data.ending.strengths],
      ['可能的盲点',data.ending.shadow],
      ['送给你的话',data.ending.counsel]
    ];
    const dims=items.map(([label,body])=>({label,body,rows:linesFor(ctx,body,INNER_WIDTH,41,'400')}));
    let cy=y+140;
    for(const item of dims)cy+=53+item.rows.length*66+38;
    const h=cy-y+29;
    card(ctx,y,h,draw);
    if(draw){
      sectionLabel(ctx,'03','你的光芒与盲点',y+80,true);
      let py=y+140;
      for(const item of dims){
        font(ctx,34,'700');ctx.fillStyle=COLORS.purple;ctx.textAlign='left';
        ctx.fillText(item.label,INNER_X,py);
        py+=53;
        text(ctx,item.body,INNER_X,py,{size:41,lineHeight:66,width:INNER_WIDTH,color:COLORS.ink},true);
        py+=item.rows.length*66+38;
      }
    }
    return y+h+26;
  }

  function quotesCard(ctx,data,y,draw){
    const items=data.ending.quotes.map(q=>linesFor(ctx,'“'+q+'”',INNER_WIDTH-58,40,'400'));
    let cy=y+150;
    for(const rows of items)cy+=rows.length*66+35;
    const h=cy-y+20;
    card(ctx,y,h,draw);
    if(draw){
      sectionLabel(ctx,'04','写给你的三句台词',y+79,true);
      let py=y+150;
      data.ending.quotes.forEach((q,i)=>{
        font(ctx,28,'700',true);ctx.fillStyle=COLORS.gold;ctx.textAlign='left';
        ctx.fillText('0'+(i+1),INNER_X,py);
        text(ctx,'“'+q+'”',INNER_X+58,py,{size:40,lineHeight:66,width:INNER_WIDTH-58,color:COLORS.ink},true);
        py+=items[i].length*66+35;
      });
    }
    return y+h+26;
  }

  function layout(ctx,data,draw,height){
    if(draw){
      ctx.fillStyle='#f7f1f5';ctx.fillRect(0,0,WIDTH,height);
    }
    let y=cover(ctx,data,draw);
    y=storyCard(ctx,data,y+31,draw);
    y=scoresCard(ctx,data,y,draw);
    y=strengthsCard(ctx,data,y,draw);
    y=quotesCard(ctx,data,y,draw);
    if(draw){
      ctx.textBaseline='alphabetic';ctx.textAlign='center';
      font(ctx,33,'700',true);ctx.fillStyle=COLORS.deep;
      ctx.fillText('你 的 选 择 ， 自 成 一 段 传 奇',450,y+62);
      font(ctx,23,'400');ctx.fillStyle=COLORS.muted;
      ctx.fillText('大曜命运档案 · 全剧共 90 集 · 纯属架空故事',450,y+111);
      ctx.fillText('分享你的结局，看看朋友会活到第几集',450,y+149);
    }
    return y+207;
  }

  async function generate(options){
    const data={
      ev:options.ev, ending:options.ending,
      roleNames:options.roleNames, tierNames:options.tierNames,
      totalEpisodes:options.totalEpisodes||90
    };
    if(!data.ev||!data.ending)throw new Error('测评结果不完整');
    const probe=document.createElement('canvas');
    probe.width=WIDTH;probe.height=1;
    const measure=probe.getContext('2d');
    if(!measure)throw new Error('浏览器不支持海报绘制');
    const needed=Math.ceil(layout(measure,data,false,0));
    if(needed>12000)throw new Error('海报内容过长，请联系客服');
    const canvas=document.createElement('canvas');
    canvas.width=WIDTH;canvas.height=needed;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('浏览器无法创建图片');
    layout(ctx,data,true,needed);
    const blob=await new Promise((resolve,reject)=>{
      try{
        canvas.toBlob(result=>result?resolve(result):reject(new Error('海报导出失败')),'image/png');
      }catch(e){reject(e);}
    });
    return blob;
  }
  let activePreview=null;
  const MAX_UPLOAD_BYTES=5*1024*1024;

  function previewStyles(){
    if(document.getElementById('fate-poster-preview-style'))return;
    const style=document.createElement('style');
    style.id='fate-poster-preview-style';
    style.textContent=`
      #poster-overlay{position:fixed;z-index:10050;inset:0;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:12px;padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom));background:rgba(36,27,45,.76)}
      #poster-overlay .fate-poster-sheet{width:min(100%,680px);max-height:92vh;max-height:calc(100dvh - 32px);overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;background:#fffaf8;color:#413248;border-radius:18px;padding:18px;box-sizing:border-box;box-shadow:0 18px 65px #241b2d55}
      #poster-overlay .fate-poster-header{position:sticky;top:0;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fffaf8;padding:8px 0}
      #poster-overlay .fate-poster-header strong{font-size:18px}
      #poster-overlay button,#poster-overlay .poster-original-link{font:inherit;cursor:pointer;border:1px solid #d8c6d8;border-radius:9px;background:#f5edf5;color:#594164;padding:10px 12px;text-decoration:none;text-align:center}
      #poster-overlay button:focus-visible,#poster-overlay a:focus-visible{outline:3px solid #72547e;outline-offset:3px}
      #poster-overlay .poster-tip{font-size:14px;line-height:1.7;margin:14px 0;overflow-wrap:anywhere}
      #poster-overlay .poster-preview-image{display:block;width:100%;height:auto;max-width:100%;user-select:auto;-webkit-user-select:auto;-webkit-touch-callout:default;border-radius:8px}
      #poster-overlay .fate-poster-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
      #poster-overlay .fate-poster-actions>*{flex:1 1 180px}
      #poster-overlay [hidden]{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function readImage(blob){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>{
        const data=typeof reader.result==='string'?reader.result:'';
        if(!data.startsWith('data:image/png;base64,'))reject(new Error('海报图片编码失败'));
        else resolve(data);
      };
      reader.onerror=()=>reject(new Error('海报图片读取失败'));
      reader.onabort=()=>reject(new Error('海报图片读取已中断'));
      try{reader.readAsDataURL(blob);}catch(error){reject(error);}
    });
  }

  function closePreview(){
    const state=activePreview;
    if(!state)return;
    activePreview=null;
    state.overlay.remove();
    document.removeEventListener('keydown',state.onKeydown);
    if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);
    document.body.style.setProperty('overflow',state.previousOverflow,state.previousOverflowPriority);
    if(state.previousFocus?.isConnected&&typeof state.previousFocus.focus==='function')state.previousFocus.focus({preventScroll:true});
  }

  function open(blob,options={}){
    if(!blob||typeof blob.size!=='number')throw new Error('海报图片无效');
    closePreview();
    previewStyles();
    const ua=navigator.userAgent||'';
    const wechat=/MicroMessenger/i.test(ua);
    const ios=/iPhone|iPad|iPod/i.test(ua)||(/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1);
    const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(ua)||
      (typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches)||window.innerWidth<761;
    const filename=String(options.filename||'命运海报.png');
    const api=options.api;
    const resultId=options.resultId;
    const hasToken=()=>{
      try{return !!(api&&typeof api.getToken==='function'&&api.getToken());}catch{return false;}
    };
    const ownedWechat=wechat&&!!resultId&&hasToken()&&typeof api.call==='function';
    const file=typeof File==='function'?new File([blob],filename,{type:'image/png'}):null;
    let canShare=!!(file&&typeof navigator.share==='function');
    try{if(canShare&&typeof navigator.canShare==='function')canShare=navigator.canShare({files:[file]});}catch{canShare=false;}
    const instructions=wechat
      ? '长按下方海报，选择“保存图片”。若微信没有保存选项，可在右上角菜单选择“在浏览器打开”，再用 Safari / Chrome 保存。'
      : canShare
        ? '点击“系统分享”，在手机系统菜单中选择“存储图像 / 保存到照片”；也可以长按下方海报保存。'
        : ios
          ? '长按下方海报，选择“存储到照片”。若没有此选项，请在 Safari 打开本页保存。'
          : mobile
            ? '长按下方海报，选择“保存图片”。若没有此选项，请在系统 Chrome 浏览器中打开本页保存。'
            : '海报已生成，点击“下载 PNG 到电脑”保存完整图片。';
    const overlay=document.createElement('div');
    overlay.id='poster-overlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-labelledby','poster-preview-title');
    overlay.setAttribute('aria-describedby','poster-tip');
    const sheet=document.createElement('div');
    sheet.className='fate-poster-sheet';
    const header=document.createElement('div');
    header.className='fate-poster-header';
    const title=document.createElement('strong');
    title.id='poster-preview-title';
    title.textContent='保存我的命运海报';
    const makeButton=(action,label)=>{
      const button=document.createElement('button');
      button.type='button';button.id=action;button.dataset.action=action;button.textContent=label;
      return button;
    };
    const close=makeButton('poster-close','返回结果页 ×');
    header.append(title,close);
    const tip=document.createElement('p');
    tip.id='poster-tip';tip.className='poster-tip';tip.setAttribute('aria-live','polite');tip.textContent=instructions;
    const img=document.createElement('img');
    img.className='poster-preview-image';img.alt='完整命运海报，可长按保存';
    const actions=document.createElement('div');actions.className='fate-poster-actions';
    const original=document.createElement('a');
    original.id='poster-original-link';original.dataset.action='poster-original-link';original.className='poster-original-link';
    original.textContent='查看高清原图（长按保存）';original.target='_blank';original.rel='noopener noreferrer';original.hidden=true;
    const retry=makeButton('poster-retry','重试');retry.hidden=true;
    const share=makeButton('poster-share','系统分享 · 保存到照片');share.hidden=!canShare;
    const download=makeButton('poster-download','下载 PNG 到电脑');download.hidden=mobile;
    actions.append(original,retry,share,download);
    sheet.append(header,tip,img,actions);overlay.appendChild(sheet);
    const state={
      overlay,objectUrl:'',dataUrl:'',remoteUrl:'',readPromise:null,retryKind:'',uploadVersion:0,imageVersion:0,
      previousOverflow:document.body.style.getPropertyValue('overflow'),
      previousOverflowPriority:document.body.style.getPropertyPriority('overflow'),
      previousFocus:document.activeElement,onKeydown:null
    };
    const live=()=>activePreview===state&&overlay.isConnected;
    const errorMessage=error=>error?.message?String(error.message):'请稍后重试';
    const showError=(message,kind)=>{
      if(!live())return;
      tip.textContent=message;state.retryKind=kind;retry.hidden=false;retry.disabled=false;
    };
    const localSource=()=>state.dataUrl||state.objectUrl;
    const showLocal=()=>{
      const source=localSource();
      if(!source||!live())return;
      const imageVersion=++state.imageVersion;
      img.onload=null;
      img.onerror=()=>{
        if(live()&&imageVersion===state.imageVersion)showError('本地海报图片未能加载，请重试。','local');
      };
      img.src=source;
    };
    const readLocal=()=>{
      if(state.dataUrl)return Promise.resolve(state.dataUrl);
      if(!state.readPromise){
        state.readPromise=readImage(blob).then(data=>{
          state.dataUrl=data;
          if(live()&&!state.remoteUrl)showLocal();
          return data;
        }).catch(error=>{state.readPromise=null;throw error;});
      }
      return state.readPromise;
    };
    const showRemote=url=>{
      if(!live())return;
      state.remoteUrl=url;
      original.href=url;original.hidden=false;
      const imageVersion=++state.imageVersion;
      img.onload=()=>{
        if(!live()||imageVersion!==state.imageVersion)return;
        tip.textContent=(ios?'iPhone 微信：':'安卓微信：')+'长按下方高清海报，选择“保存图片”。也可点“查看高清原图”后长按保存；原图链接 1 小时有效，过期后请关闭并重新生成海报。';
        retry.hidden=true;retry.disabled=false;state.retryKind='';
      };
      img.onerror=()=>{
        if(!live()||imageVersion!==state.imageVersion)return;
        showLocal();
        showError('微信高清图暂时未能加载，已保留本地海报。可重试加载，或点“查看高清原图”后长按保存。','remote');
      };
      img.src=url;
    };
    const upload=async()=>{
      if(!live()||!ownedWechat)return;
      if(blob.size>MAX_UPLOAD_BYTES){
        tip.textContent='海报超过 5 MB，暂不能生成微信高清原图链接。请长按下方本地海报，或在 Safari / Chrome 中保存。';
        retry.hidden=true;
        return;
      }
      if(!hasToken()){
        showError('登录状态已失效，已保留本地海报。请返回结果页重新验证后再试。','upload');
        return;
      }
      const uploadVersion=++state.uploadVersion;
      retry.hidden=true;retry.disabled=true;
      tip.textContent='正在为微信准备高清海报，请稍候……本地海报已可预览。';
      try{
        const data=await readLocal();
        if(!live()||uploadVersion!==state.uploadVersion)return;
        const uploaded=await api.call('poster_upload',{resultId,image:data.slice('data:image/png;base64,'.length)});
        if(!live()||uploadVersion!==state.uploadVersion)return;
        const url=new URL(uploaded?.imageUrl);
        const apiOrigin=new URL(window.FATE_CONFIG?.apiUrl).origin;
        if(url.protocol!=='https:'||url.origin!==apiOrigin||url.username||url.password)throw new Error('高清海报地址无效');
        showRemote(url.href);
      }catch(error){
        if(!live()||uploadVersion!==state.uploadVersion)return;
        showError('微信高清海报暂时准备失败：'+errorMessage(error)+'。本地海报仍可预览和保存。','upload');
      }
    };
    const retryPreview=()=>{
      if(state.retryKind==='upload'){void upload();return;}
      if(state.retryKind==='remote'){
        // A failed URL may have expired while the page was left open.
        void upload();return;
      }
      retry.hidden=true;tip.textContent=instructions;
      void readLocal().then(()=>{if(live())showLocal();}).catch(error=>showError('海报图片处理失败：'+errorMessage(error),'local'));
    };
    overlay.addEventListener('click',event=>{
      const target=event.target.closest('[data-action]');
      if(event.target===overlay||target?.dataset.action==='poster-close'){closePreview();return;}
      if(!target)return;
      if(target.dataset.action==='poster-retry'){retryPreview();return;}
      if(target.dataset.action==='poster-share'&&file&&typeof navigator.share==='function'){
        // Keep the native share call directly in the click event for iOS user activation.
        try{
          Promise.resolve(navigator.share({files:[file],title:'大曜命运档案'})).catch(error=>{
            if(error?.name!=='AbortError'&&live())tip.textContent='系统分享未能打开：'+errorMessage(error)+'。可长按海报保存，或在 Safari / Chrome 中重试。';
          });
        }catch(error){
          if(error?.name!=='AbortError')tip.textContent='系统分享未能打开：'+errorMessage(error)+'。可长按海报保存。';
        }
      }
      if(target.dataset.action==='poster-download'){
        const source=state.objectUrl||state.dataUrl;
        if(!source)return;
        const link=document.createElement('a');link.href=source;link.download=filename;
        document.body.appendChild(link);link.click();link.remove();
      }
    });
    state.onKeydown=event=>{
      if(!live())return;
      if(event.key==='Escape'){event.preventDefault();closePreview();return;}
      if(event.key!=='Tab')return;
      const controls=Array.from(overlay.querySelectorAll('button,a[href]')).filter(element=>!element.hidden&&!element.disabled);
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&(document.activeElement===first||!overlay.contains(document.activeElement))){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!overlay.contains(document.activeElement))){event.preventDefault();first?.focus();}
    };
    activePreview=state;
    document.body.appendChild(overlay);
    document.body.style.overflow='hidden';
    document.addEventListener('keydown',state.onKeydown);
    close.focus({preventScroll:true});
    try{state.objectUrl=URL.createObjectURL(blob);showLocal();}catch{/* FileReader below still supplies a local preview. */}
    void readLocal().catch(error=>showError('海报图片处理失败：'+errorMessage(error),ownedWechat?'upload':'local'));
    if(ownedWechat)void upload();
    return overlay;
  }

  window.FatePoster={generate,open};
})();

