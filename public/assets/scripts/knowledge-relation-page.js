(function(){
  const clean=value=>String(value||'').replace(/^entity\//,'');
  function relationElements(data,center){
    const nodes=new Map((data.nodes||[]).filter(Boolean).map(node=>[clean(node.id||node._id),node]));
    const colors=['#6385d6','#5f9d87','#b184c5','#d0a05d','#ca7c88','#639faf'];
    const groups=new Map();
    const appearance=node=>{
      const group=String(node.typeLabel||node.type||'\u77e5\u8bc6');
      if(!groups.has(group))groups.set(group,colors[groups.size%colors.length]);
      const image=(window.homeKnowledgeMediaViewer?.collectMedia(node)||[]).find(item=>item.kind==='image')?.url||'';
      return {group,color:groups.get(group),image};
    };
    return [...Array.from(nodes,([id,node])=>({data:{id,label:node.name||node.label||id,description:node.description||'',center:id===clean(center),...appearance(node)}})),
      ...(data.edges||[]).filter(edge=>nodes.has(clean(edge.source))&&nodes.has(clean(edge.target))).map((edge,index)=>({data:{id:'relation-edge-'+index,source:clean(edge.source),target:clean(edge.target),label:edge.label||edge.property_name||edge.type||'关联'}}))];
  }
  const panel=document.createElement('section');panel.id='knowledgeRelationPage';
  document.getElementById('applicationHomePanel').append(panel);
  panel.innerHTML='<header class="relation-page-heading"><button type="button" data-back class="btn">← 返回</button><div><h1>知识关联关系图</h1><p data-status role="status"></p></div><label class="relation-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input type="search" data-find placeholder="\u67e5\u627e\u56fe\u4e2d\u77e5\u8bc6" aria-label="\u67e5\u627e\u56fe\u4e2d\u77e5\u8bc6"></label><select data-layout aria-label="\u5173\u7cfb\u56fe\u5e03\u5c40"><option value="dagre">\u5206\u5c42\u5e03\u5c40</option><option value="concentric">\u73af\u5f62\u5e03\u5c40</option><option value="cose">\u81ea\u7531\u5e03\u5c40</option></select><button type="button" class="btn" data-fit>适应画布</button><button type="button" class="btn" data-retry>重新加载</button></header><div class="relation-page-body"><div class="relation-canvas-wrap"><div class="relation-page-canvas" role="region" aria-label="知识关联关系图，可拖动和缩放"></div><div class="relation-legend"></div><div class="relation-zoom"><button type="button" data-zoom="1.2" aria-label="\u653e\u5927">+</button><button type="button" data-zoom="0.8333" aria-label="\u7f29\u5c0f">-</button></div></div><aside class="relation-page-inspector"><small>当前知识</small><h2></h2><p></p><button type="button" class="btn" data-detail>查看详情</button><button type="button" class="btn" data-expand>以此知识为中心</button><small>箭头表示关系方向，点击节点查看信息，双击节点继续探索。也可从下方列表选择知识。</small><div class="relation-node-list"></div></aside></div>';
  const status=panel.querySelector('[data-status]'),inspector=panel.querySelector('aside'),canvas=panel.querySelector('.relation-page-canvas');
  let cy=null,controller,version=0,current='',selected='',returnView='app_home',returnNode='',resize=null;
  function layoutOptions(name,animate=false){return {name,animate,animationDuration:450,padding:70,rankDir:'LR',nodeSep:55,rankSep:180,edgeSep:28,nodeDimensionsIncludeLabels:true,concentric:node=>node.data('center')?100:node.degree(),levelWidth:()=>2,minNodeSpacing:80,nodeRepulsion:()=>24000,idealEdgeLength:()=>180,randomize:false};}
  function highlight(id){if(!cy)return;cy.elements().removeClass('is-neighbor is-dimmed');if(!id)return;const node=cy.nodes().filter(item=>item.id()===id);if(!node.length)return;const neighborhood=node.closedNeighborhood();cy.elements().not(neighborhood).addClass('is-dimmed');neighborhood.addClass('is-neighbor');}

  function select(data){highlight(data.id);selected=data.id;inspector.querySelector('h2').textContent=data.label;inspector.querySelector('p').textContent=data.description||'暂无描述';}
  window.closeKnowledgeRelation=()=>{version++;controller?.abort();resize?.disconnect();resize=null;cy?.destroy();cy=null;};
  window.openKnowledgeRelation=(id)=>{
    if(window.kbViewMode!=='knowledge_graph'){returnView=window.kbViewMode||'app_home';returnNode=new URLSearchParams(location.hash.slice(1)).get('node')||'';}
    window.setViewMode('knowledge_graph',{targetNodeId:clean(id)});
  };
  window.loadKnowledgeRelation=async function(id=''){
    id=clean(id||new URLSearchParams(location.hash.slice(1)).get('node'));
    window.closeKnowledgeRelation();const token=version;current=id;selected='';
    inspector.querySelector('h2').textContent='';inspector.querySelector('p').textContent='';panel.querySelector('.relation-node-list').replaceChildren();panel.querySelector('.relation-legend').replaceChildren();panel.querySelector('[data-find]').value='';
    if(!id){status.textContent='请从知识卡片的关系图按钮进入。';return;}
    status.textContent='正在加载关联知识…';controller=new AbortController();
    try{
      const url=new URL('/api/kb/node/graph',location.origin),db=new URLSearchParams(location.search).get('db');if(db)url.searchParams.set('db',db);url.searchParams.set('id',id);url.searchParams.set('direction','both');
      const response=await fetch(url,{signal:controller.signal});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||`加载失败（${response.status}）`);if(token!==version)return;
      const elements=relationElements(data,id),nodes=elements.filter(item=>!item.data.source);
      if(!nodes.length){status.textContent='知识不存在或无权访问。';return;}
      status.textContent=`${nodes.length} 个知识 · ${elements.length-nodes.length} 条关系${elements.length===nodes.length?' · 暂无关联关系':''}`;
      select((nodes.find(item=>item.data.id===id)||nodes[0]).data);
      for(const item of nodes){const button=document.createElement('button');button.type='button';button.textContent=item.data.label;button.onclick=()=>{select(item.data);cy?.nodes().filter(node=>node.id()===item.data.id).select();};panel.querySelector('.relation-node-list').append(button);}
      if(typeof window.cytoscape!=='function')throw Error('图谱组件未加载，请刷新重试');
      const css=getComputedStyle(panel),fg=css.getPropertyValue('--fg').trim()||'#243443',accent=css.getPropertyValue('--accent').trim()||'#527e71',surface=css.getPropertyValue('--surface-0').trim()||'#fff';
      const kinds=new Map(nodes.map(item=>[item.data.group,item.data.color]));
      for(const [group,color] of kinds){const legend=document.createElement('span');legend.textContent=group;legend.style.setProperty('--legend-color',color);panel.querySelector('.relation-legend').append(legend);}
      cy=window.cytoscape({container:canvas,elements, minZoom:.15,maxZoom:4,wheelSensitivity:.18,style:[
        {selector:'node',style:{label:'data(label)','background-color':'data(color)',color:fg,width:62,height:62,'font-size':12,'font-family':'sans-serif','text-valign':'bottom','text-margin-y':12,'text-wrap':'ellipsis','text-max-width':140,'border-width':3,'border-color':surface,'text-background-color':surface,'text-background-opacity':.85,'text-background-padding':4,'transition-property':'opacity, border-width','transition-duration':'180ms'}},
        {selector:'node[image != ""]',style:{'background-image':'data(image)','background-fit':'cover'}},
        {selector:'node[?center]',style:{width:84,height:84,'border-width':5,'border-color':accent,'font-weight':700,'font-size':14,'underlay-color':accent,'underlay-opacity':.12,'underlay-padding':10}},
        {selector:'node:selected',style:{'border-color':'#dfac56','border-width':5}},
        {selector:'edge',style:{label:'data(label)',width:1.6,'line-color':'#a5b4c6','target-arrow-color':'#a5b4c6','target-arrow-shape':'triangle','arrow-scale':.8,'curve-style':'bezier','control-point-step-size':55,'font-size':10,color:fg,'text-background-color':surface,'text-background-opacity':1,'text-background-padding':5,'text-background-shape':'roundrectangle','text-rotation':'autorotate','transition-property':'opacity','transition-duration':'180ms'}},
        {selector:'.is-dimmed',style:{opacity:.2}},
        {selector:'edge.is-neighbor',style:{'line-color':accent,'target-arrow-color':accent,width:2.5}}
      ],layout:layoutOptions(panel.querySelector('[data-layout]').value||'dagre')});
      if(typeof ResizeObserver==='function'){resize=new ResizeObserver(()=>{cy?.resize();});resize.observe(canvas);}
      cy.on('tap','node',event=>select(event.target.data()));
      cy.on('dbltap','node',event=>window.openKnowledgeRelation(event.target.id()));
    }catch(error){if(token===version&&error.name!=='AbortError')status.textContent=error.message;}
  };
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
  panel.querySelector('[data-expand]').onclick=()=>{if(selected)window.openKnowledgeRelation(selected);};
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
