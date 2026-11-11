(function () {
  function bigBangPoints(count,width=1200,height=800) {
    const scale=Math.max(1,Math.min(width,height))/1100;
    let seed=19371;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const occupied=[];
    return Array.from({length:count},()=>{
      // Choose irregular positions with breathing room, independently of depth.
      let best=null,bestDistance=-1;
      for(let attempt=0;attempt<10;attempt++){
        const u=.04+random()*.92,v=.08+random()*.84;
        const distance=occupied.length?Math.min(...occupied.map(p=>Math.hypot((u-p.u)*width,(v-p.v)*height))):1;
        if(distance>bestDistance){best={u,v};bestDistance=distance;}
      }
      occupied.push(best);
      const z=-850+Math.pow(random(),.75)*3850;
      const inverse=(1500+z)/(1100*scale);
      return {x:(best.u-.5)*width*inverse,y:(best.v-.5)*height*inverse,z};
    });
  }
  function bigBangFocusTarget(point,yaw,pitch,scale) {
    const x=point.x*Math.cos(yaw)+point.z*Math.sin(yaw),z=point.z*Math.cos(yaw)-point.x*Math.sin(yaw);
    return {x,y:point.y*Math.cos(pitch)-z*Math.sin(pitch),z:point.y*Math.sin(pitch)+z*Math.cos(pitch)+1500-165000*scale/Math.max(120,Math.min(300,scale*550))};
  }
  function bigBangImageSources(node, media = []) {
    const list = value => {
      if (Array.isArray(value)) return value.flatMap(list);
      if (value && typeof value === 'object') return list(value.url || value.src || '');
      const text = String(value || '').trim();
      if (text.startsWith('[')) { try { return list(JSON.parse(text)); } catch {} }
      return /^(https?:\/\/|\/(?!\/)|data:image\/(?:jpeg|png|webp|gif|avif|bmp);)/i.test(text) ? [text] : [];
    };
    return [...new Set([
      ...media.filter(item => item.kind === 'image').flatMap(item => list(item.url)),
      ...list(node.images), ...list(node.image), ...list(node.covers), ...list(node.cover),
    ])];
  }
  function bigBangVideos(node, media = []) {
    const list = value => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string' && value.trim().startsWith('[')) { try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed; } catch {} }
      return value ? [value] : [];
    };
    const urlOf = value => String(typeof value === 'object' && value ? value.url || value.src || '' : value || '').trim();
    const sources = [...new Set([...list(node.videos), ...list(node.video), ...media.filter(item => item.kind === 'video').map(item => item.url)].map(urlOf).filter(url => /^(https?:\/\/|\/(?!\/))/i.test(url)))];
    const covers = list(node.covers).map(urlOf);
    return sources.map((src, index) => {
      const poster = covers[index] || (sources.length === 1 ? urlOf(node.cover) : '');
      return { src, poster: /^(https?:\/\/|\/(?!\/)|data:image\/(?:jpeg|png|webp|gif|avif|bmp);)/i.test(poster) ? poster : '' };
    });
  }
  let active=null;
  const panel=document.createElement('section');
  panel.id='knowledgeBigBangPage';
  document.getElementById('applicationHomePanel').append(panel);
  window.closeKnowledgeBigBang=()=>active?.();
  window.loadKnowledgeBigBang=()=>{
    if(active)return;
    const params=new URLSearchParams(location.search);
    const tag=params.get('explore_tag')||'',category=tag?'':params.get('explore_category')||'';
    return window.knowledgeBigBang.open({host:panel,category,tag,label:tag?'#'+tag:category?'\u5f53\u524d\u5206\u7c7b':'\u5168\u90e8\u77e5\u8bc6'});
  };
  window.knowledgeBigBang={open:async function({category='',tag='',label='\u5168\u90e8\u77e5\u8bc6',host=panel}={}){
    active?.();
    const dialog=document.createElement('section');dialog.className='knowledge-big-bang';dialog.setAttribute('aria-label','Big Bang 知识宇宙');
    dialog.innerHTML='<button type="button" class="big-bang-back" data-close aria-label="返回探索">←</button><canvas tabindex="0" aria-label="知识空间，拖动旋转，滚轮缩放，点击卡片选择知识"></canvas><div class="big-bang-status" role="status"></div><section class="big-bang-selection" hidden><strong></strong><p></p><button type="button" data-unfocus>\u8fd4\u56de\u5b87\u5b99</button><button type="button" data-play hidden>▶ 播放视频</button><button type="button" data-detail>查看知识详情 ↗</button></section><footer><span>拖动旋转 · 滚轮缩放 · 点击知识</span><div><button type="button" data-zoom="1.2" aria-label="放大">＋</button><button type="button" data-zoom="0.8333" aria-label="缩小">−</button><button type="button" data-reset>重新展开</button></div></footer>';
    host.append(dialog);
    const canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d'),status=dialog.querySelector('[role=status]'),selection=dialog.querySelector('section');

    const controller=new AbortController(),images=new Map();
    let palette={cards:['#263d42','#39334b','#3e3830','#283b35'],text:'#fff',accent:'#baf3d0'};
    function updatePalette(){
      if(typeof getComputedStyle==='function'){
        const style=getComputedStyle(dialog);
        palette={cards:[1,2,3,4].map(index=>style.getPropertyValue('--universe-card-'+index).trim()),text:style.getPropertyValue('--fg').trim()||'#fff',accent:style.getPropertyValue('--accent').trim()||'#baf3d0'};
      }
      schedule();
    }
    const themeObserver=typeof MutationObserver==='function'&&document.documentElement?new MutationObserver(updatePalette):null;

    let nodes=[],points=[],hits=[],chosen=null,yaw=0,pitch=0,zoom=1,frame=0,start=performance.now(),closed=false,drag=null,w=0,h=0;
    let camera={x:0,y:0,z:0},flight=null;
    let momentum=null,lastFrame=0;
    let videoCard=null,videoPlayer=null,videoNode=null;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function close(){if(closed)return;closed=true;closeVideo();controller.abort();cancelAnimationFrame(frame);observer.disconnect();themeObserver?.disconnect();window.removeEventListener('popstate',close);window.removeEventListener('hashchange',close);dialog.remove();if(active===close)active=null;}
    active=close;
    function schedule(){if(!frame&&!closed)frame=requestAnimationFrame(draw);}
    function draw(now){
      frame=0;ctx.clearRect(0,0,w,h);
      const elapsed=lastFrame?Math.min(32,now-lastFrame):16.67;lastFrame=now;
      if(momentum&&!drag&&!flight){
        moveScene(momentum.dx*elapsed/16.67,momentum.dy*elapsed/16.67,momentum);
        const friction=Math.pow(.88,elapsed/16.67);momentum.dx*=friction;momentum.dy*=friction;
        if(Math.hypot(momentum.dx,momentum.dy)<.08)momentum=null;
      }
      const progress=reduced?1:Math.min(1,(now-start)/1100),spread=1-Math.pow(1-progress,3);
      const scale=Math.min(w,h)/1100*zoom;
      if(flight){
        const t=reduced?1:Math.min(1,(now-flight.start)/850),ease=t*t*(3-2*t);
        for(const key of ['x','y','z'])camera[key]=flight.from[key]+(flight.to[key]-flight.from[key])*ease;
        if(t===1){flight=null;}
      }
      hits=points.map((p,i)=>{
        const x=p.x*Math.cos(yaw)+p.z*Math.sin(yaw),z=p.z*Math.cos(yaw)-p.x*Math.sin(yaw);
        const y=p.y*Math.cos(pitch)-z*Math.sin(pitch),depth=p.y*Math.sin(pitch)+z*Math.cos(pitch);
        const distance=1500+depth*spread-camera.z;
        if(distance<100)return null;
        const perspective=1100/distance;
        return {i,x:w/2+(x*spread-camera.x)*scale*perspective,y:h/2+(y*spread-camera.y)*scale*perspective,size:Math.max(16,150*scale*perspective),aspect:images.get(i)?.naturalWidth?images.get(i).naturalHeight/images.get(i).naturalWidth:1.15,depth};
      }).filter(Boolean).sort((a,b)=>b.depth-a.depth);
      for(const item of hits){
        const {x,y,size,i}=item,node=nodes[i],image=images.get(i),height=size*item.aspect;
        if(x+size<0||x-size>w||y+height<0||y-height>h)continue;
        ctx.save();ctx.globalAlpha=1;ctx.translate(x-size/2,y-height/2);
        ctx.beginPath();ctx.roundRect(0,0,size,height,2);ctx.clip();
        ctx.fillStyle=palette.cards[i%4];ctx.fillRect(0,0,size,height);
        if(image?.complete&&image.naturalWidth){const ratio=Math.max(size/image.naturalWidth,height/image.naturalHeight);ctx.drawImage(image,(size-image.naturalWidth*ratio)/2,(height-image.naturalHeight*ratio)/2,image.naturalWidth*ratio,image.naturalHeight*ratio);if(chosen===i){ctx.fillStyle='#0009';ctx.fillRect(0,height*.62,size,height*.38);}}
        if(!image?.naturalWidth||chosen===i){
        ctx.fillStyle=image?.naturalWidth?'#fff':palette.text;ctx.font=`500 ${Math.max(9,size*.1)}px sans-serif`;
        const chars=Array.from(node.name||node.label||node.id||'知识');let line='',row=0;
        for(const char of chars){if(ctx.measureText(line+char).width>size-12){ctx.fillText(line,6,height*.75+row*size*.14);row++;line='';if(row===2)break;}line+=char;}if(row<2)ctx.fillText(line,6,height*.75+row*size*.14);
        }
        ctx.restore();
      }
      positionVideo();
      if(progress<1||flight||momentum)schedule();
    }
    const observer=new ResizeObserver(()=>{const rect=canvas.getBoundingClientRect();w=rect.width;h=rect.height;points=bigBangPoints(nodes.length,w,h);if(chosen!==null){camera=bigBangFocusTarget(points[chosen],yaw,pitch,Math.min(w,h)/1100*zoom);flight=null;}const dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);schedule();});observer.observe(canvas);
    themeObserver?.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','class','style']});
    if(document.body)themeObserver?.observe(document.body,{attributes:true,attributeFilter:['data-theme','class','style']});
    updatePalette();
    dialog.querySelector('[data-close]').onclick=()=>window.setViewMode('app_explore');dialog.addEventListener('cancel',event=>{event.preventDefault();close();});

    function stopVideo() {
      if (!videoPlayer) return;
      videoPlayer.pause();videoPlayer.removeAttribute('src');videoPlayer.load();
    }
    function closeVideo() {
      stopVideo();videoPlayer=null;videoNode=null;
      const card=videoCard;videoCard=null;
      card?.remove();
    }
    function positionVideo() {
      if(!videoCard)return;
      const hit=hits.find(item=>item.i===videoNode);
      videoCard.hidden=!hit;
      if(!hit)return;
      Object.assign(videoCard.style,{left:`${hit.x-hit.size/2}px`,top:`${hit.y-hit.size*hit.aspect/2}px`,width:`${hit.size}px`,height:`${hit.size*hit.aspect}px`});
    }
    function playVideo() {
      if(chosen===null||closed)return;
      const node=nodes[chosen],videos=bigBangVideos(node,window.homeKnowledgeMediaViewer?.collectMedia(node)||[]);
      if(!videos.length)return;
      closeVideo();momentum=null;videoNode=chosen;
      videoCard=document.createElement('div');videoCard.className='big-bang-card-video';videoCard.setAttribute('aria-label',`播放 ${node.name||node.label||node.id||'知识视频'}`);
      videoCard.innerHTML='<video playsinline preload="metadata" tabindex="0" role="button" aria-label="点击暂停或播放视频"></video><button type="button" class="big-bang-video-close" data-video-close aria-label="停止播放并显示封面">×</button><div class="big-bang-card-video-controls"><button type="button" data-video-prev aria-label="上一个视频">‹</button><span data-video-position></span><button type="button" data-video-next aria-label="下一个视频">›</button></div><span class="big-bang-card-video-status" data-video-status role="status"></span>';
      dialog.append(videoCard);videoPlayer=videoCard.querySelector('video');
      const player=videoPlayer,card=videoCard;let index=0;
      const message=card.querySelector('[data-video-status]');
      function showVideo(next) {
        if(card!==videoCard)return;
        stopVideo();index=next;
        player.poster=videos[index].poster;player.src=videos[index].src;
        card.querySelector('[data-video-position]').textContent=`${index+1} / ${videos.length}`;
        card.querySelector('[data-video-prev]').disabled=index===0;
        card.querySelector('[data-video-next]').disabled=index===videos.length-1;
        card.querySelector('.big-bang-card-video-controls').hidden=videos.length===1;
        message.textContent='';
        const requestIndex=index,playing=player.play();playing?.catch(error=>{if(card===videoCard&&index===requestIndex&&error?.name!=='AbortError')message.textContent='点击卡片中的播放按钮开始播放。';});
      }
      card.querySelector('[data-video-close]').onclick=closeVideo;
      card.querySelector('[data-video-prev]').onclick=()=>{if(index>0)showVideo(index-1);};
      card.querySelector('[data-video-next]').onclick=()=>{if(index<videos.length-1)showVideo(index+1);};
      card.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeVideo();canvas.focus();}});
      const togglePlayback=()=>{
        if(card!==videoCard)return;
        if(player.paused){const playing=player.play();playing?.catch(()=>{if(card===videoCard)message.textContent='无法播放视频，请重试。';});}
        else player.pause();
      };
      player.addEventListener('click',togglePlayback);
      player.addEventListener('keydown',event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();togglePlayback();}});
      player.addEventListener('error',()=>{if(card===videoCard)message.textContent='视频加载失败，请重试或查看知识详情。';});
      positionVideo();showVideo(0);schedule();
    }
    dialog.querySelector('[data-play]').onclick=playVideo;
    function unfocus(){closeVideo();momentum=null;chosen=null;selection.hidden=true;flight={from:{...camera},to:{x:0,y:0,z:0},start:performance.now()};schedule();}
    dialog.querySelector('[data-unfocus]').onclick=unfocus;
    function changeZoom(factor){zoom=Math.max(.35,Math.min(5,zoom*factor));schedule();}
    dialog.querySelectorAll('[data-zoom]').forEach(button=>button.onclick=()=>changeZoom(Number(button.dataset.zoom)));
    dialog.querySelector('[data-reset]').onclick=()=>{closeVideo();momentum=null;chosen=null;selection.hidden=true;flight=null;camera={x:0,y:0,z:0};yaw=pitch=0;zoom=1;start=performance.now();schedule();};
    canvas.addEventListener('wheel',event=>{event.preventDefault();changeZoom(Math.exp(-event.deltaY*.001));},{passive:false});
    function moveScene(dx,dy,state){
      if(state.pan){
        const scale=Math.max(.001,Math.min(w,h)/1100*zoom);
        const worldPerPixel=state.distance/(1100*scale);
        camera.x-=dx*worldPerPixel;camera.y-=dy*worldPerPixel;
      }else{yaw+=dx*.006;pitch=Math.max(-1.5,Math.min(1.5,pitch+dy*.006));}
    }
    canvas.addEventListener('pointerdown',event=>{
      momentum=null;
      const selected=hits.find(hit=>hit.i===chosen);
      drag={x:event.clientX,y:event.clientY,moved:0,dx:0,dy:0,time:performance.now(),pan:true,distance:Math.max(100,1500+(selected?.depth||0)-camera.z)};
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove',event=>{
      if(!drag)return;
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y,now=performance.now();
      drag.moved+=Math.abs(dx)+Math.abs(dy);
      if(drag.moved>=6){
        closeVideo();chosen=null;selection.hidden=true;flight=null;
        moveScene(dx,dy,drag);
        const elapsed=Math.max(8,now-drag.time);
        drag.dx=dx*16.67/elapsed;drag.dy=dy*16.67/elapsed;
      }
      drag.x=event.clientX;drag.y=event.clientY;drag.time=now;schedule();
    });
    function select(i){closeVideo();momentum=null;chosen=i;const node=nodes[i];window.recordKnowledgeView?.(node.id||node._id);selection.hidden=true;flight={from:{...camera},to:bigBangFocusTarget(points[i],yaw,pitch,Math.min(w,h)/1100*zoom),start:performance.now()};selection.querySelector('strong').textContent=node.name||node.label||node.id;selection.querySelector('p').textContent=node.description||'探索这条知识的详细内容';dialog.querySelector('[data-play]').hidden=!bigBangVideos(node,window.homeKnowledgeMediaViewer?.collectMedia(node)||[]).length;if(!dialog.querySelector('[data-play]').hidden)playVideo();schedule();}
    canvas.addEventListener('pointerup',event=>{if(drag&&drag.moved<6){const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;const hit=[...hits].reverse().find(p=>Math.abs(x-p.x)<p.size/2&&Math.abs(y-p.y)<p.size*p.aspect/2);if(hit)select(hit.i);else if(chosen!==null)unfocus();}else if(drag&&performance.now()-drag.time<90&&!reduced){momentum={dx:drag.dx,dy:drag.dy,pan:drag.pan,distance:drag.distance};schedule();}drag=null;});
    canvas.addEventListener('pointercancel',()=>{drag=null;momentum=null;});
    canvas.addEventListener('keydown',event=>{if(event.key==='Escape'){unfocus();return;}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Enter'].includes(event.key))event.preventDefault();if(event.key==='ArrowLeft')yaw-=.15;if(event.key==='ArrowRight')yaw+=.15;if(event.key==='ArrowUp')pitch-=.15;if(event.key==='ArrowDown')pitch+=.15;if(event.key==='+')changeZoom(1.2);if(event.key==='-')changeZoom(1/1.2);if(event.key==='Enter'&&nodes.length)select(chosen===null?0:(chosen+1)%nodes.length);schedule();});
    dialog.querySelector('[data-detail]').onclick=()=>{if(chosen===null)return;const id=nodes[chosen].id||nodes[chosen]._id;close();window.setViewMode('knowledge_detail',{targetNodeId:id});};
    status.textContent='正在汇聚知识…';
    try{
      const url=new URL('/api/kb/discover/search',location.origin);const db=new URLSearchParams(location.search).get('db');if(db)url.searchParams.set('db',db);url.searchParams.set('limit','120');url.searchParams.set('order','richness');if(category)url.searchParams.set('class_id',category);if(tag)url.searchParams.set('tag',tag);
      const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error('知识加载失败，请关闭后重试');const data=await response.json();if(closed)return;
      nodes=data.nodes||[];points=bigBangPoints(nodes.length,w||1200,h||800);start=performance.now();status.textContent=nodes.length?`${nodes.length} 个知识星点 · Enter 键依次选择`:'当前范围暂无知识';
      nodes.forEach((node,i)=>{
        const media=window.homeKnowledgeMediaViewer?.collectMedia(node)||[];
        const sources=bigBangImageSources(node,media);if(!sources.length)return;
        const image=new Image();let sourceIndex=0;images.set(i,image);image.onload=schedule;
        image.onerror=()=>{if(closed)return;if(++sourceIndex<sources.length)image.src=sources[sourceIndex];else{images.delete(i);schedule();}};
        image.src=sources[0];
      });schedule();
    }catch(error){if(!closed)status.textContent=error.message;}
  }};
  window.addEventListener('kb-auth-change',()=>{
    window.closeKnowledgeBigBang();
    if(window.kbViewMode==='big_bang')void window.loadKnowledgeBigBang();
  });
  if(window.kbViewMode==='big_bang')void window.loadKnowledgeBigBang();
})();
