(function () {
  const tabs = document.getElementById('graphCanvasTabs');
  if (!tabs) return;
  const status = document.getElementById('graphCanvasStatus');
  const add = document.getElementById('graphCanvasNew');
  const reloadButton = document.getElementById('graphCanvasRefresh');
  const rename = document.getElementById('graphCanvasRename');
  const remove = document.getElementById('graphCanvasDelete');
  const detach = document.getElementById('graphCanvasDetach');
  let items = [], active = null, scope = '', identity = '', busy = false, applying = false, dirty = false;
  let explore = null, timer = 0, generation = 0, viewGeneration = 0, version = 0, saving = null, bound = null;
  const currentScope = () => new URLSearchParams(location.search).get('db') || 'default';
  const key = () => `kb-canvas-draft:${identity}:${scope}:${active?.id}`;
  function snapshot() {
    const cy = window.kbCy;
    if (!cy) return {nodes:[],edges:[],zoom:1,pan:{x:0,y:0}};
    const fields = ['id','label','name','type','classId','classLabel','color','image'];
    return { nodes:cy.nodes().filter(n => !n.hasClass('eh-handle')).map(n => ({group:'nodes', data:Object.fromEntries(fields.filter(k=>n.data(k)!==undefined).map(k=>[k,n.data(k)])),position:{...n.position()}})),
      edges:cy.edges().filter(e=>!e.hasClass('eh-preview')&&!e.hasClass('eh-ghost-edge')).map(e=>({group:'edges',data:{...e.data()}})), zoom:cy.zoom(),pan:{...cy.pan()} };
  }
  function counters() {
    const cy=window.kbCy; if (!cy) return;
    document.getElementById('cyCountAll').textContent=`全部 (${cy.nodes().length})`;
    document.getElementById('visStatusText').textContent=`节点 ${cy.nodes().length} · 边 ${cy.edges().length}`;
    const empty=document.getElementById('graphCanvasEmpty');if(empty)empty.hidden=!active || cy.nodes().length>0;
    window.kbData={nodes:cy.nodes().map(n=>n.data()),edges:cy.edges().map(e=>e.data())};
  }
  async function api(path='', method='GET', body, db=scope) {
    const url=new URL('/api/graph-canvases'+path,location.origin); url.searchParams.set('db',db);
    const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    const data=await response.json(); if(!response.ok) throw Error(data.error || `HTTP ${response.status}`); return data;
  }
  function render() {
    tabs.replaceChildren();
    for(const item of [{id:null,name:'关系浏览'},...items]) {
      const button=document.createElement('button'); button.type='button';button.setAttribute('role','tab');
      button.setAttribute('aria-selected',String(item.id===(active?.id || null)));button.tabIndex=item.id===(active?.id || null)?0:-1;
      button.textContent=item.name;button.disabled=busy;button.dataset.canvasId=item.id || '';
      button.addEventListener('click',()=>switchTo(item.id).catch(fail));tabs.append(button);
    }
    add.disabled=busy || !window.authUser;
    if(reloadButton) reloadButton.disabled=busy;
    rename.disabled=remove.disabled=busy || !active;
    if(detach){detach.hidden=!active;detach.disabled=busy || !window.kbCy?.elements(':selected').length;}
    add.title=window.authUser?'新建个人画布':'登录后创建个人画布';
  }
  const fail = error => { status.textContent=error.message;status.classList.add('is-error'); };
  function changed() {
    if(applying || !active) return;
    counters();dirty=true;version++;
    try {localStorage.setItem(key(),JSON.stringify({revision:active.revision,graph:snapshot()}));}catch{}
    status.classList.remove('is-error');status.textContent='未保存';
    clearTimeout(timer);timer=setTimeout(()=>save().catch(fail),700);
  }
  async function save() {
    clearTimeout(timer);
    if(saving) {await saving;if(dirty) return save();return;}
    if(!active || !dirty || applying) return;
    const item=active, state=snapshot(), at=version, token=generation, draftKey=key();
    status.textContent='正在保存…';
    saving=api('/'+item.id,'PUT',{name:item.name,graph:state,revision:item.revision}).then(data=>{
      item.revision=data.revision;
      if(token!==generation || active!==item) return;
      if(version===at) {dirty=false;localStorage.removeItem(draftKey);status.textContent='已保存';}
      else {try{localStorage.setItem(draftKey,JSON.stringify({revision:item.revision,graph:snapshot()}));}catch{} }
    });
    try{await saving;}finally{saving=null;}
    if(dirty && token===generation) {clearTimeout(timer);timer=setTimeout(()=>save().catch(fail),700);}
  }
  function bind() {
    if(bound===window.kbCy || !window.kbCy) return;
    bound=window.kbCy;
    bound.on('add remove data position pan zoom',changed);
    bound.on('select unselect',()=>{if(detach)detach.disabled=busy || !active || !bound.elements(':selected').length;});
  }
  async function apply(graph) {
    const token=generation;
    applying=true;
    window.kbGraphConnect?.cancel();
    document.getElementById('btnEdgePropertyCancel')?.click();
    try {
      if(!window.kbCy) await window.kbLoadGraphWithData({nodes:[],edges:[]});
      if(token!==generation)return;
      bind();
      window.kbExpandedOutgoingNodeIds = new Set();
      const cy=window.kbCy;
      cy.stop();cy.elements().stop();
      cy.batch(()=>{cy.elements().remove();cy.add([...(graph.nodes || []),...(graph.edges || [])]);});
      cy.resize();cy.viewport({zoom:graph.zoom || 1,pan:graph.pan || {x:0,y:0}});
      counters();
    } finally {applying=false;}
  }
  async function switchTo(id) {
    if(busy || (active?.id || null)===id) return;
    busy=true;render();
    const token=generation;
    try {
      await save();
      const item=id?items.find(i=>i.id===id):null;
      const data=item?await api('/'+id):null;
      if(token!==generation) return;
      if(!active) explore=snapshot();
      viewGeneration++;active=item;dirty=false;
      if(item) {
        item.revision=data.revision;
        let graph=data.graph;
        try {const draft=JSON.parse(localStorage.getItem(key()) || 'null');if(draft?.revision===item.revision){graph=draft.graph;dirty=true;}}catch{}
        await apply(graph);
        status.textContent=dirty?'已恢复未保存的编辑':'已保存';
        if(dirty) changed();
      } else {await apply(explore || {nodes:[],edges:[],zoom:1,pan:{x:0,y:0}});status.textContent='关系浏览';}
      localStorage.setItem(`kb-canvas-active:${identity}:${scope}`,id || '');
    } finally {busy=false;render();}
  }
  async function create() {
    if(busy || !window.authUser) return;
    busy=true;render();
    try {
      await save();
      const name='画布 '+(items.length+1);
      const item=await api('','POST',{name});items.push(item);
      busy=false;await switchTo(item.id);
    }catch(error){fail(error);}finally{busy=false;render();}
  }
  async function reloadCanvas() {
    if(busy) return;
    busy=true;render();
    const token=generation, item=active;
    window.kbGraphConnect?.cancel();
    status.classList.remove('is-error');
    try {
      // A failed save must leave the current graph intact.
      await save();
      if(token!==generation) return;
      if(dirty) {status.textContent='仍有修改待保存，请稍后刷新';return;}
      const at=version;
      status.textContent='正在刷新…';
      if(item) {
        const data=await api('/'+item.id);
        const list=await api();
        if(token!==generation || active!==item) return;
        if(version!==at || dirty) {status.textContent='已保留刷新期间的修改';return;}
        item.name=data.name;item.revision=data.revision;
        items=list.items.map(entry=>entry.id===item.id?item:entry);
        viewGeneration++;
        await apply(data.graph);
        status.textContent='已刷新';
      } else {
        await window.kbLoadGraphWithData();
        if(token!==generation) return;
        bind();counters();status.textContent='已刷新';
      }
    } catch(error) {if(token===generation)fail(error);}
    finally {busy=false;render();}
  }
  add.addEventListener('click',create);
  reloadButton?.addEventListener('click',reloadCanvas);
  detach?.addEventListener('click',()=>{if(active && !busy){window.kbGraphConnect?.cancel();window.kbCy.elements(':selected').remove();counters();}});
  rename.addEventListener('click',async()=>{
    if(!active || busy) return;
    const name=prompt('画布名称',active.name)?.trim();if(!name || name===active.name)return;
    if(name.length>80){fail(Error('名称最多 80 个字符'));return;}
    active.name=name;changed();render();try{await save();}catch(error){fail(error);}
  });
  remove.addEventListener('click',async()=>{
    if(!active || busy || !confirm(`删除画布「${active.name}」？只删除画布，不删除知识或关系。`))return;
    busy=true;render();
    try{if(saving)await saving.catch(()=>{});await api('/'+active.id,'DELETE');localStorage.removeItem(key());items=items.filter(i=>i.id!==active.id);viewGeneration++;active=null;dirty=false;clearTimeout(timer);await apply(explore || {nodes:[],edges:[],zoom:1,pan:{x:0,y:0}});status.textContent='关系浏览';localStorage.removeItem(`kb-canvas-active:${identity}:${scope}`);}catch(error){fail(error);}finally{busy=false;render();}
  });
  tabs.addEventListener('keydown',e=>{
    const buttons=[...tabs.querySelectorAll('[role=tab]')];let i=buttons.indexOf(document.activeElement);
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
    i=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
    buttons[i]?.focus();buttons[i]?.click();
  });
  async function refresh() {
    const next=currentScope(), uid=window.authUser ? String(window.authUser.id || `user:${window.authUser.username}`) : 'anonymous';
    if(next===scope && uid===identity) {bind();return;}
    generation++;clearTimeout(timer);scope=next;identity=uid;active=null;items=[];dirty=false;explore=null;
    const token=generation;render();
    status.textContent=window.authUser?'正在读取画布…':'登录后可保存个人画布';
    if(!window.authUser)return;
    try{const data=await api();if(token!==generation)return;items=data.items;render();status.textContent='关系浏览';
      const last=localStorage.getItem(`kb-canvas-active:${identity}:${scope}`);if(items.some(i=>i.id===last))await switchTo(last);
    }catch(error){if(token===generation)fail(error);}
  }
  window.kbGraphCanvases={get activeId(){return active?.id || null;},get applying(){return applying;},get contextKey(){return `${identity}:${scope}:${active?.id || 'browse'}:${generation}:${viewGeneration}`;},save,changed,bind,refresh,reload:reloadCanvas};
  window.addEventListener('kb-auth-change',refresh);
  window.addEventListener('kb-application-access-change',refresh);
  window.addEventListener('kb:url-param-changed',refresh);
  window.addEventListener('pagehide',()=>{if(active && dirty){try{localStorage.setItem(key(),JSON.stringify({revision:active.revision,graph:snapshot()}));}catch{}}});
  new MutationObserver(()=>{if(document.getElementById('cywrap').style.display!=='none'){bind();void refresh();}}).observe(document.getElementById('cywrap'),{attributes:true,attributeFilter:['style']});
  render();void refresh();
})();
