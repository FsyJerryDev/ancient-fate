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
  window.FatePoster={generate};
})();