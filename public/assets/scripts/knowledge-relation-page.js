(function(){
  const clean=value=>String(value||'').replace(/^entity\//,'');
  function relationElements(data,center){
    const nodes=new Map((data.nodes||[]).filter(Boolean).map(node=>[clean(node.id||node._id),node]));
    const colors=['#6385d6','#5f9d87','#b184c5','#d0a05d','#ca7c88','#639faf'];
    const groups=new Map();
    const appearance=node=>{
      const group=String(node.typeLabel||node.type||'\u77e5\u8bc6');
      if(!groups.has(group)){const hash=Array.from(group).reduce((value,char)=>(Math.imul(value,31)+char.codePointAt(0))>>>0,0);groups.set(group,colors[hash%colors.length]);}
      const image=(window.homeKnowledgeMediaViewer?.collectMedia(node)||[]).find(item=>item.kind==='image')?.url||'';
      return {group,color:groups.get(group),image};
    };
    return [...Array.from(nodes,([id,node])=>({data:{id,label:node.name||node.label||id,description:node.description||'',center:id===clean(center),...appearance(node)}})),
      ...(data.edges||[]).filter(edge=>nodes.has(clean(edge.source))&&nodes.has(clean(edge.target))).map((edge,index)=>({data:{id:'relation-edge-'+JSON.stringify([clean(edge.source),clean(edge.target),edge.id||edge.type||'',edge.label||edge.property_name||edge.type||'']),source:clean(edge.source),target:clean(edge.target),label:edge.label||edge.property_name||edge.type||'关联'}}))];
  }
  function expansionPositions(anchor,sizes,occupied){
    const boxes=occupied.filter(box=>[box.x1,box.x2,box.y1,box.y2].every(Number.isFinite)).map(box=>({...box}));
    return sizes.map(size=>{
      const halfWidth=Math.max(90,size.width/2)+18,halfHeight=Math.max(85,size.height/2)+18;
      for(let ring=0;;ring++){
        const radius=190+ring*85,steps=24+ring*8;
        for(let step=0;step<steps;step++){
          const angle=step*2*Math.PI/steps+ring*.37;
          const position={x:anchor.x+Math.cos(angle)*radius,y:anchor.y+Math.sin(angle)*radius};
          const box={x1:position.x-halfWidth,x2:position.x+halfWidth,y1:position.y-halfHeight,y2:position.y+halfHeight};
          if(boxes.some(other=>box.x1<other.x2&&box.x2>other.x1&&box.y1<other.y2&&box.y2>other.y1))continue;
          boxes.push(box);return {position,box};
        }
      }
    });
  }
  const panel=document.createElement('section');panel.id='knowledgeRelationPage';
  document.getElementById('applicationHomePanel').append(panel);
  panel.innerHTML='<header class="relation-page-heading"><button type="button" data-back class="btn">← 返回</button><div><h1>知识关联关系图</h1><p data-status role="status"></p></div><label class="relation-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input type="search" data-find placeholder="\u67e5\u627e\u56fe\u4e2d\u77e5\u8bc6" aria-label="\u67e5\u627e\u56fe\u4e2d\u77e5\u8bc6"></label><select data-layout aria-label="\u5173\u7cfb\u56fe\u5e03\u5c40"><option value="cose">\u529b\u5bfc\u5411</option><option value="dagre">\u6a2a\u5411\u5206\u5c42</option><option value="dagre-tb">\u7eb5\u5411\u5206\u5c42</option><option value="concentric">\u540c\u5fc3\u73af</option><option value="circle">\u5706\u5f62</option><option value="breadthfirst">\u5c42\u7ea7\u6811</option><option value="grid">\u7f51\u683c</option></select><button type="button" class="btn" data-fit>适应画布</button><button type="button" class="btn" data-retry>重新加载</button></header><div class="relation-page-body"><div class="relation-canvas-wrap"><div class="relation-page-canvas" role="region" aria-label="知识关联关系图，可拖动和缩放"></div><div class="relation-legend"></div><div class="relation-zoom"><button type="button" data-zoom="1.2" aria-label="\u653e\u5927">+</button><button type="button" data-zoom="0.8333" aria-label="\u7f29\u5c0f">-</button></div></div><aside class="relation-page-inspector"><div class="relation-phone"><div class="relation-phone-stage" aria-label="\u77e5\u8bc6\u5a92\u4f53"></div><div class="relation-phone-top"><span>\u77e5\u8bc6</span><span data-media-count></span></div><button type="button" class="relation-media-prev" data-media-prev aria-label="\u4e0a\u4e00\u4e2a\u5a92\u4f53">‹</button><button type="button" class="relation-media-next" data-media-next aria-label="\u4e0b\u4e00\u4e2a\u5a92\u4f53">›</button><div class="relation-phone-caption"><h2></h2><p></p><div><button type="button" data-detail>\u67e5\u770b\u8be6\u60c5</button><button type="button" data-expand>\u5c55\u5f00\u5173\u8054</button></div></div></div><div class="relation-node-list" hidden></div></aside></div>';
  const status=panel.querySelector('[data-status]'),inspector=panel.querySelector('aside'),canvas=panel.querySelector('.relation-page-canvas');
  let cy=null,controller,version=0,current='',selected='',returnView='app_home',returnNode='',resize=null;
  let previewVersion=0,previewMedia=[],previewIndex=0;
  const expanded=new Set(),expanding=new Set(),relationCache=new Map();
  function layoutOptions(name,animate=false){return {name:name==='dagre-tb'?'dagre':name,animate,animationDuration:450,padding:70,rankDir:name==='dagre-tb'?'TB':'LR',nodeSep:55,rankSep:180,edgeSep:28,nodeDimensionsIncludeLabels:true,concentric:node=>node.data('center')?100:node.degree(),levelWidth:()=>2,minNodeSpacing:80,nodeRepulsion:()=>38000,idealEdgeLength:()=>180,randomize:name==='cose'};}
  function highlight(id){if(!cy)return;cy.elements().removeClass('is-neighbor is-dimmed');if(!id)return;const node=cy.nodes().filter(item=>item.id()===id);if(!node.length)return;const neighborhood=node.closedNeighborhood();cy.elements().not(neighborhood).addClass('is-dimmed');neighborhood.addClass('is-neighbor');}

  function centerSelection(id){
    if(!cy)return;
    const node=cy.nodes().filter(item=>item.id()===id);if(!node.length)return;
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    cy.stop();
    const point=node.position(),zoom=cy.zoom();
    const pan={x:cy.width()/2-point.x*zoom,y:cy.height()/2-point.y*zoom};
    if(reduced)cy.pan(pan);else cy.animate({pan,duration:350,easing:'ease-in-out-cubic'});
  }
  function stopPreview(){inspector.querySelectorAll('video').forEach(video=>{video.pause();video.removeAttribute('src');video.load();});}
  function renderPreview(){
    stopPreview();const stage=panel.querySelector('.relation-phone-stage');stage.replaceChildren();
    const item=previewMedia[previewIndex];
    if(item){const el=document.createElement(item.kind==='video'?'video':'img');el.src=item.url;if(item.kind==='video'){el.controls=true;el.playsInline=true;el.preload='metadata';}else el.alt=inspector.querySelector('h2').textContent;stage.append(el);}
    else{const text=document.createElement('div');text.className='relation-phone-empty';text.textContent=inspector.querySelector('h2').textContent;stage.append(text);}
    panel.querySelector('[data-media-count]').textContent=previewMedia.length?`${previewIndex+1} / ${previewMedia.length}`:'';
    panel.querySelector('[data-media-prev]').hidden=panel.querySelector('[data-media-next]').hidden=previewMedia.length<2;
  }
  async function loadPreview(data){
    const token=++previewVersion;previewIndex=0;previewMedia=window.homeKnowledgeMediaViewer?.collectMedia(data)||[];renderPreview();
    try{
      const url=new URL('/api/kb/node',location.origin),db=new URLSearchParams(location.search).get('db');if(db)url.searchParams.set('db',db);url.searchParams.set('id',data.id);
      const response=await fetch(url,{signal:controller?.signal});if(!response.ok)return;const result=await response.json();if(token!==previewVersion||!result.node)return;
      previewMedia=window.homeKnowledgeMediaViewer?.collectMedia(result.node)||[];previewIndex=0;
      inspector.querySelector('p').textContent=result.node.description||data.description||'';renderPreview();
    }catch(error){if(token===previewVersion&&error.name!=='AbortError')panel.querySelector('[data-media-count]').textContent='\u5a92\u4f53\u52a0\u8f7d\u5931\u8d25';}
  }
  function select(data){renderRelationList(data.id);highlight(data.id);centerSelection(data.id);selected=data.id;inspector.querySelector('h2').textContent=data.label;inspector.querySelector('p').textContent=data.description||'暂无描述';}
  window.closeKnowledgeRelation=()=>{version++;previewVersion++;stopPreview();controller?.abort();resize?.disconnect();resize=null;cy?.destroy();cy=null;expanded.clear();expanding.clear();relationCache.clear();};
  window.openKnowledgeRelation=(id)=>{
    if(window.kbViewMode!=='knowledge_graph'){returnView=window.kbViewMode||'app_home';returnNode=new URLSearchParams(location.hash.slice(1)).get('node')||'';}
    window.setViewMode('knowledge_graph',{targetNodeId:clean(id)});
  };
  function refreshGraphSummary(){
    if(!cy)return;
    status.textContent=`${cy.nodes().length} \u4e2a\u77e5\u8bc6 · ${cy.edges().length} \u6761\u5173\u7cfb · ${expanded.size} \u4e2a\u8282\u70b9\u5df2\u5c55\u5f00`;
  }
  function renderRelationList(id){
    const list=panel.querySelector('.relation-node-list'),data=relationCache.get(id);list.replaceChildren();
    if(!data)return;
    const nodes=new Map((data.nodes||[]).map(node=>[clean(node.id||node._id),node]));
    for(const [direction,title] of [['incoming','\u6307\u5411\u6211'],['outgoing','\u6211\u6307\u5411\u7684']]){
      const neighbors=new Map();
      for(const edge of data.edges||[]){const source=clean(edge.source),target=clean(edge.target);if((direction==='incoming'?target:source)!==id)continue;const key=direction==='incoming'?source:target;if(key===id||!nodes.has(key))continue;if(!neighbors.has(key))neighbors.set(key,new Set());neighbors.get(key).add(edge.label||edge.property_name||edge.type||'\u5173\u8054');}
      const heading=document.createElement('small');heading.textContent=`${title} · ${neighbors.size}`;list.append(heading);
      for(const [neighbor,labels] of neighbors){const button=document.createElement('button'),node=nodes.get(neighbor);button.type='button';button.textContent=`${node.name||node.label||neighbor} · ${[...labels].join(' / ')}`;button.title='\u70b9\u51fb\u5c06\u8be5\u77e5\u8bc6\u52a0\u5165\u56fe\u4e2d';button.onclick=()=>{void expandNode(id,neighbor);};list.append(button);}
    }
  }
  async function expandNode(id,onlyId=''){
    if(!cy||expanding.has(id))return;
    if(expanded.has(id)&&!onlyId){renderRelationList(id);return;}
    const token=version,graph=cy;expanding.add(id);
    status.textContent='\u6b63\u5728\u52a0\u8f7d\u5173\u8054\u2026';
    try{
      let data=relationCache.get(id);
      if(!data){
        const url=new URL('/api/kb/node/graph',location.origin),db=new URLSearchParams(location.search).get('db');if(db)url.searchParams.set('db',db);url.searchParams.set('id',id);url.searchParams.set('direction','both');
        const response=await fetch(url,{signal:controller.signal});data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||`\u52a0\u8f7d\u5931\u8d25 (${response.status})`);
      }
      if(token!==version||graph!==cy)return;
      relationCache.set(id,data);
      const incoming=relationElements(data,current),newNodes=incoming.filter(item=>!item.data.source&&graph.getElementById(item.data.id).empty());
      const anchor=graph.getElementById(id).position();
      // Reserve final positions too, so concurrent expansions cannot occupy an animation's destination.
      const occupied=graph.nodes().map(node=>node.scratch('relationReservedBox')||node.boundingBox({includeLabels:true,includeOverlays:false}));
      graph.batch(()=>{
        for(const item of newNodes)graph.add({...item,position:{x:anchor.x,y:anchor.y}});
        for(const item of incoming.filter(item=>item.data.source))if(graph.getElementById(item.data.id).empty())graph.add(item);
      });
      const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const sizes=newNodes.map(item=>{const node=graph.getElementById(item.data.id),box=node.boundingBox({includeLabels:true,includeOverlays:false}),point=node.position();return {width:2*Math.max(Math.abs(box.x1-point.x),Math.abs(box.x2-point.x)),height:2*Math.max(Math.abs(box.y1-point.y),Math.abs(box.y2-point.y))};});
      const placements=expansionPositions(anchor,sizes,occupied);
      newNodes.forEach((item,index)=>{
        const {position,box}=placements[index],node=graph.getElementById(item.data.id);
        node.scratch('relationReservedBox',box);
        const complete=()=>{node.removeScratch('relationReservedBox');};
        if(reduced){node.position(position);complete();}else node.animate({position,duration:450,complete});

      });
      expanded.add(id);graph.getElementById(id).addClass('is-expanded');highlight(selected);refreshGraphSummary();if(selected===id)renderRelationList(id);
      const legend=panel.querySelector('.relation-legend'),seen=new Set(Array.from(legend.children).map(item=>item.textContent));
      for(const item of newNodes)if(!seen.has(item.data.group)){seen.add(item.data.group);const label=document.createElement('span');label.textContent=item.data.group;label.style.setProperty('--legend-color',item.data.color);legend.append(label);}
    }catch(error){if(token===version&&error.name!=='AbortError')status.textContent=error.message;}
    finally{if(token===version)expanding.delete(id);}
  }
  window.loadKnowledgeRelation=async function(id=''){
    id=clean(id||new URLSearchParams(location.hash.slice(1)).get('node'));
    window.closeKnowledgeRelation();const token=version;current=id;selected='';
    inspector.querySelector('h2').textContent='';inspector.querySelector('p').textContent='';panel.querySelector('.relation-node-list').replaceChildren();panel.querySelector('.relation-legend').replaceChildren();panel.querySelector('[data-find]').value='';
    if(!id){status.textContent='请从知识卡片的关系图按钮进入。';return;}
    status.textContent='正在加载关联知识…';controller=new AbortController();
    try{
      const url=new URL('/api/kb/node/graph',location.origin),db=new URLSearchParams(location.search).get('db');if(db)url.searchParams.set('db',db);url.searchParams.set('id',id);url.searchParams.set('direction','both');
      const response=await fetch(url,{signal:controller.signal});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||`加载失败（${response.status}）`);if(token!==version)return;
      relationCache.set(id,data);
      const elements=relationElements(data,id),nodes=elements.filter(item=>!item.data.source);
      if(!nodes.length){status.textContent='知识不存在或无权访问。';return;}
      status.textContent=`${nodes.length} 个知识 · ${elements.length-nodes.length} 条关系${elements.length===nodes.length?' · 暂无关联关系':''}`;
      select((nodes.find(item=>item.data.id===id)||nodes[0]).data);

      if(typeof window.cytoscape!=='function')throw Error('图谱组件未加载，请刷新重试');
      const css=getComputedStyle(panel),fg=css.getPropertyValue('--fg').trim()||'#243443',accent=css.getPropertyValue('--accent').trim()||'#527e71',surface=css.getPropertyValue('--surface-0').trim()||'#fff';
      const kinds=new Map(nodes.map(item=>[item.data.group,item.data.color]));
      for(const [group,color] of kinds){const legend=document.createElement('span');legend.textContent=group;legend.style.setProperty('--legend-color',color);panel.querySelector('.relation-legend').append(legend);}
      cy=window.cytoscape({container:canvas,elements, minZoom:.15,maxZoom:4,wheelSensitivity:.18,style:[
        {selector:'node',style:{label:'data(label)','background-color':'data(color)',color:fg,width:68,height:68,'font-size':12,'font-family':'sans-serif','text-valign':'bottom','text-margin-y':12,'text-wrap':'wrap','text-max-width':140,'border-width':3,'border-color':surface,'text-background-color':surface,'text-background-opacity':.95,'text-background-padding':4,'transition-property':'opacity, border-width','transition-duration':'180ms'}},
        {selector:'node[image != ""]',style:{'background-image':'data(image)','background-fit':'cover'}},
        {selector:'node[?center]',style:{width:84,height:84,'border-width':5,'border-color':accent,'font-weight':700,'font-size':14,'underlay-color':accent,'underlay-opacity':.12,'underlay-padding':10}},
        {selector:'node.is-expanded',style:{'border-style':'double','border-width':6}},
        {selector:'node:selected',style:{'border-color':accent,'border-width':5,'underlay-color':accent,'underlay-opacity':.12,'underlay-padding':8}},
        {selector:'edge',style:{label:'data(label)',width:1.8,'line-color':'#94a3b8','target-arrow-color':'#a5b4c6','target-arrow-shape':'triangle','arrow-scale':.8,'curve-style':'bezier','control-point-step-size':55,'font-size':10,color:fg,'text-background-color':surface,'text-background-opacity':1,'text-background-padding':5,'text-background-shape':'roundrectangle','text-rotation':'none','source-distance-from-node':5,'target-distance-from-node':7,'transition-property':'opacity','transition-duration':'180ms'}},
        {selector:'.is-dimmed',style:{opacity:.45}},
        {selector:'edge.is-neighbor',style:{'line-color':accent,'target-arrow-color':accent,width:2.5}}
      ],layout:layoutOptions(panel.querySelector('[data-layout]').value||'cose')});
      if(typeof ResizeObserver==='function'){resize=new ResizeObserver(()=>{cy?.resize();});resize.observe(canvas);}
      expanded.add(id);
      cy.on('grab','node',event=>{event.target.stop();event.target.removeScratch('relationReservedBox');});
      cy.on('tap','node',event=>{select(event.target.data());void expandNode(event.target.data().id);});
      cy.on('dbltap','node',event=>{void expandNode(event.target.data().id);});
    }catch(error){if(token===version&&error.name!=='AbortError')status.textContent=error.message;}
  };
  panel.querySelector('[data-media-prev]').onclick=()=>{if(previewMedia.length){previewIndex=(previewIndex-1+previewMedia.length)%previewMedia.length;renderPreview();}};
  panel.querySelector('[data-media-next]').onclick=()=>{if(previewMedia.length){previewIndex=(previewIndex+1)%previewMedia.length;renderPreview();}};
  panel.querySelector('[data-layout]').onchange=event=>cy?.layout(layoutOptions(event.target.value,true)).run();
  panel.querySelector('[data-find]').oninput=event=>{
    if(!cy)return;const query=event.target.value.trim().toLocaleLowerCase();
    if(!query){highlight('');return;}
    const matches=cy.nodes().filter(node=>String(node.data('label')).toLocaleLowerCase().includes(query));
    cy.elements().removeClass('is-dimmed is-neighbor');
    if(matches.length){const nearby=matches.closedNeighborhood();cy.elements().not(nearby).addClass('is-dimmed');matches.select();cy.animate({fit:{eles:nearby,padding:80},duration:350});}
  };
  panel.querySelectorAll('[data-zoom]').forEach(button=>button.onclick=()=>{if(cy)cy.zoom({level:cy.zoom()*Number(button.dataset.zoom),renderedPosition:{x:canvas.clientWidth/2,y:canvas.clientHeight/2}});});
  panel.querySelector('[data-back]').onclick=()=>window.setViewMode(returnView,{targetNodeId:returnNode});
  panel.querySelector('[data-fit]').onclick=()=>cy?.fit(undefined,65);
  panel.querySelector('[data-retry]').onclick=()=>window.loadKnowledgeRelation(current);
  panel.querySelector('[data-detail]').onclick=()=>{if(selected)window.setViewMode('knowledge_detail',{targetNodeId:selected});};
  panel.querySelector('[data-expand]').onclick=()=>{if(selected)void expandNode(selected);};
  // Shared entry across the different knowledge card renderers, including appended cards.
  function addEntries(){
    document.querySelectorAll('.for-you-card,.app-home-knowledge-card,.explore-knowledge-card,.home-popular-row,.home-news-card,.app-knowledge-item').forEach(card=>{
      if(card.querySelector('[data-knowledge-graph]'))return;
      const id=card.dataset.knowledgeId||card.dataset.homeNodeId||card.querySelector('[data-explore-node]')?.dataset.exploreNode||card.querySelector('[data-search-node-id]')?.dataset.searchNodeId;
      if(!id)return;
      const button=document.createElement('button');button.type='button';button.className='knowledge-graph-entry';button.dataset.knowledgeGraph=id;button.title='查看知识关联关系图';button.setAttribute('aria-label','查看知识关联关系图');button.innerHTML='<i class="fa-solid fa-diagram-project" aria-hidden="true"></i><span>关系图</span>';
      const placement=card.querySelector('.for-you-card-meta,.app-home-card-footer,.home-popular-actions,.home-news-card-copy') || (card.classList.contains('app-knowledge-item')?card.querySelector('div'):null) || card;
      placement.append(button);
    });
  }
  document.addEventListener('click',event=>{const button=event.target.closest('[data-knowledge-graph]');if(button){event.preventDefault();event.stopPropagation();window.openKnowledgeRelation(button.dataset.knowledgeGraph);}},true);
  new MutationObserver(addEntries).observe(document.getElementById('globalPage'),{childList:true,subtree:true});
  addEntries();
  window.addEventListener('kb-auth-change',()=>{window.closeKnowledgeRelation();if(window.kbViewMode==='knowledge_graph')void window.loadKnowledgeRelation(current);});
  if(window.kbViewMode==='knowledge_graph')void window.loadKnowledgeRelation();
})();
