(function () {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function learningPathLayout(ids, completed, current, availableWidth = 960) {
    const columns = Math.min(5, Math.max(2, Math.floor(availableWidth / 160)), Math.max(1, ids.length));
    const width = columns * 160;
    const points = ids.map((id, index) => {
      const row = Math.floor(index / columns), column = index % columns;
      return { id, x:80 + (row % 2 ? columns - 1 - column : column) * 160, y:70 + row * 150,
        state:completed.includes(id) ? 'completed' : id === current ? 'current' : 'pending' };
    });
    const path = points.map((point, index) => {
      if (!index) return `M ${point.x} ${point.y}`;
      const previous = points[index - 1];
      if (previous.y === point.y) return `L ${point.x} ${point.y}`;
      const bend = point.x + (Math.floor(index / columns) % 2 ? 64 : -64);
      return `C ${bend} ${previous.y}, ${bend} ${point.y}, ${point.x} ${point.y}`;
    }).join(' ');
    return { points, path, width, height:Math.max(180, Math.ceil(ids.length / columns) * 150 + 20) };
  }
  const panel = document.createElement('section'); panel.id = 'knowledgeLearningPage'; panel.setAttribute('aria-label','知识学习');
  document.getElementById('applicationHomePanel').append(panel);
  const nodeDialog=document.createElement('dialog');nodeDialog.id='learningNodeDialog';nodeDialog.setAttribute('aria-label','知识节点信息');document.body.append(nodeDialog);
  let nodeModalOpen=false,quiz=null;
  let screen='home', routes=[], route=null, routeNodes=[], level=null, currentId='', relatedId='';
  let draft=null, mode='auto', results=[], searchTimer, searchVersion=0, viewVersion=0, detailVersion=0;
  let busy=false, loading=false, error='', levelError='', searchError='', discoverNote='';
  const idOf = node => String(node?.id || node?._id || '').replace(/^entity\//,'');
  const nameOf = node => node?.name || node?.label || node?.id || '未命名知识';
  const headers = {'Content-Type':'application/json'};
  async function api(path, body, method) {
    const url = new URL(path.startsWith('/api/') ? path : '/api/kb/learning'+path,location.origin);
    const db = new URLSearchParams(location.search).get('db'); if(db) url.searchParams.set('db',db);
    const response=await fetch(url,{method:method || (body === undefined ? 'GET':'POST'),cache:'no-store',...(body===undefined?{}:{headers,body:JSON.stringify(body)})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) { const failure=new Error(data.error || `加载失败（${response.status}）`); failure.status=response.status; throw failure; }
    return data;
  }
  function writeRoute() {
    if(window.kbViewMode!=='learning')return;
    const url=new URL(location.href);
    for(const key of ['learning_route','learning_screen','learning_level'])url.searchParams.delete(key);
    if(screen!=='home')url.searchParams.set('learning_screen',screen);
    if(route?.id && (screen==='learn'||screen==='quiz'))url.searchParams.set('learning_route',route.id);
    if(draft?.id && screen==='edit')url.searchParams.set('learning_route',draft.id);
    if(currentId && (screen==='learn'||screen==='quiz'))url.searchParams.set('learning_level',currentId);
    window.history.replaceState(window.history.state,'',url);
  }
  function notice() { return error ? `<div class="learning-notice" role="alert">${escape(error)} <button type="button" data-learning-retry>重试</button>${!window.authUser?'<button type="button" data-learning-login>登录</button>':''}</div>`:''; }
  function top(title,subtitle,actions='') {
    return `<header class="learning-heading"><div><p>KNOWLEDGE JOURNEY</p><h1>${escape(title)}</h1><span>${escape(subtitle)}</span></div><div class="learning-heading-actions">${actions}</div></header>`;
  }
  function routeCard(item) {
    return `<article class="learning-journey-portal"><button class="learning-portal-scene" type="button" data-learning-open="${escape(item.id)}" aria-label="打开${escape(item.name)}地图"><svg viewBox="0 0 440 200" aria-hidden="true"><path class="portal-land" d="M-20 130 Q90 45 175 115 T470 90 L470 240H-20Z"/><path class="portal-land-back" d="M-20 165 Q90 90 210 155 T470 130 L470 240H-20Z"/><path class="portal-trail" d="M55 163 Q90 110 150 140 T250 108 T365 50"/>${[[55,163],[150,140],[250,108],[365,50]].map(([x,y],index)=>`<circle cx="${x}" cy="${y}" r="${index===3?15:9}" class="${item.progress>0&&item.progress>=index*33?'is-visited':''}"/>`).join('')}<path class="portal-flag" d="M365 46V17L392 27L365 36"/></svg><span class="learning-portal-badge"><i class="fa-solid fa-compass" aria-hidden="true"></i> ${item.levelCount} 站旅程</span><span class="learning-portal-title">${escape(item.name)}</span><span class="learning-portal-enter">探索地图 <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></button><div class="learning-portal-meta"><span>${item.completedCount} / ${item.levelCount} 站已探索</span><strong>${item.progress}%</strong></div><progress max="100" value="${item.progress}" aria-label="学习进度"></progress><footer><button type="button" data-learning-edit="${escape(item.id)}">编排旅程</button><button type="button" data-learning-delete="${escape(item.id)}">删除</button></footer></article>`;
  }
  function renderHome() {
    return top('知识学习','从一个主题出发，把零散知识连接成自己的学习旅程。','<button class="btn primary" type="button" data-learning-create><i class="fa-solid fa-plus" aria-hidden="true"></i> 创建学习路线</button>')+notice()+
      (loading?'<div class="learning-empty" role="status">正在加载你的学习路线…</div>':routes.length?`<div class="learning-route-grid">${routes.map(routeCard).join('')}</div>`:!error?'<div class="learning-empty"><i class="fa-solid fa-seedling" aria-hidden="true"></i><h2>让好奇心成为一条路线</h2><p>自动发现主题的关联知识，或亲手编排你想学的内容。</p><button class="btn primary" type="button" data-learning-create>创建第一条学习路线</button></div>':'');
  }
  function renderDraft() {
    return draft.nodes.map((node,index)=>`<li class="learning-draft-step"><span>${index+1}</span><div><strong>${escape(nameOf(node))}</strong><small>${node.unavailable?'不可访问，请移除':escape(node._learningRelation || node.description || idOf(node))}</small></div><button type="button" data-learning-move="${index}" data-direction="-1" ${index===0?'disabled':''} aria-label="上移 ${escape(nameOf(node))}"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></button><button type="button" data-learning-move="${index}" data-direction="1" ${index===draft.nodes.length-1?'disabled':''} aria-label="下移 ${escape(nameOf(node))}"><i class="fa-solid fa-arrow-down" aria-hidden="true"></i></button><button type="button" data-learning-remove="${index}" aria-label="移除 ${escape(nameOf(node))}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></li>`).join('');
  }
  function renderEditor() {
    return top(draft.id?'编辑学习路线':'创建学习路线','先选择主题或添加知识，再调整关卡顺序。','<button class="btn" type="button" data-learning-home>返回路线</button>')+notice()+`
      <div class="learning-editor"><section class="learning-editor-picker"><div class="learning-mode-tabs" role="group" aria-label="路线创建方式"><button type="button" data-learning-mode="auto" aria-pressed="${mode==='auto'}">自动发现</button><button type="button" data-learning-mode="manual" aria-pressed="${mode==='manual'}">手动编排</button></div>
      <h2>${mode==='auto'?'选择一个学习主题':'寻找你想学习的知识'}</h2><p>${mode==='auto'?'选择主题后，探索两跳内最多 20 个关联知识。生成后仍可调整。':'搜索当前知识库，逐条添加到右侧学习路线。'}</p>
      <label class="learning-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input class="kb-input" data-learning-search type="search" placeholder="搜索知识名称或描述" aria-label="搜索学习知识" autocomplete="off" maxlength="200"></label><div data-learning-results>${renderResults()}</div></section>
      <section class="learning-editor-sequence"><label class="learning-name-label">路线名称<input class="kb-input" data-learning-name value="${escape(draft.name)}" maxlength="100" placeholder="给这段旅程起个名字"></label><div class="learning-sequence-heading"><h2>关卡顺序</h2><span>${draft.nodes.length} / 100 个知识</span></div>${discoverNote?`<p class="learning-discovery-note">${escape(discoverNote)}</p>`:''}
      <ol class="learning-draft-list">${renderDraft()||'<li class="learning-empty-draft">从左侧选择知识开始编排。</li>'}</ol><button class="btn primary learning-save" type="button" data-learning-save ${busy||!draft.nodes.length?'disabled':''}>${busy?'正在保存…':'保存路线并开始学习'}</button></section></div>`;
  }
  function renderResults() {
    if(searchError)return `<p class="learning-notice" role="alert">${escape(searchError)}</p>`;
    if(!results.length)return '<p class="learning-search-hint">输入关键词搜索知识。</p>';
    return results.map(node=>`<button type="button" class="learning-search-result" data-learning-add="${escape(idOf(node))}" ${busy?'disabled':''}><span><strong>${escape(nameOf(node))}</strong><small>${escape(String(node.description||node.desc_zh||idOf(node)).slice(0,130))}</small></span><b>${mode==='auto'?'生成路线':draft.nodes.some(item=>idOf(item)===idOf(node))?'已添加':'＋'}</b></button>`).join('');
  }
  function map() {
    const active=currentId || route.currentNodeId || route.nodeIds[0];
    const layout=learningPathLayout(route.nodeIds,route.completedIds,active,Math.min(1000,(window.innerWidth || 1024)-64));
    return `<aside class="learning-map"><div class="learning-map-heading"><strong>学习地图</strong><span>${route.completedCount} / ${route.levelCount} 关</span></div><progress max="100" value="${route.progress}" aria-label="路线进度"></progress><ol class="learning-path" style="height:${layout.height}px"><svg viewBox="0 0 ${layout.width} ${layout.height}" preserveAspectRatio="none" aria-hidden="true"><path d="${layout.path}"></path></svg>${layout.points.map((point,index)=>{
      const node=routeNodes.find(item=>idOf(item)===point.id);
      return `<li style="left:${point.x/layout.width*100}%;top:${point.y}px" class="is-${point.state}"><button type="button" data-learning-level="${escape(point.id)}" ${busy?'disabled':''} ${point.id===active?'aria-current="step"':''} title="${escape(nameOf(node))}">${point.state==='completed'?'<i class="fa-solid fa-check" aria-hidden="true"></i>':index+1}</button><span>${escape(nameOf(node))}</span></li>`;
    }).join('')}</ol><div class="learning-map-destination"><i class="fa-solid fa-flag-checkered" aria-hidden="true"></i><strong>旅程终点，新的起点</strong><small>顺序可自由选择，关联距离不代表难度。</small></div></aside>`;
  }
  function valueText(value) {
    if(value==null)return '—';
    if(Array.isArray(value))return value.map(valueText).join('、');
    if(typeof value==='object')return value.label || value.name || value.text || value.id || JSON.stringify(value);
    return String(value);
  }
  function renderLesson() {
    if(loading)return '<div class="learning-empty" role="status">正在读取知识内容…</div>';
    if(levelError)return `${relatedId?'<button class="learning-return" type="button" data-learning-return-level>返回当前学习关卡</button>':''}<div class="learning-notice" role="alert">${escape(levelError)}<button type="button" data-learning-retry-level>重试</button><button type="button" data-learning-edit="${escape(route.id)}">编辑路线</button></div>`;
    if(!level)return '<div class="learning-empty">点击地图中的任意关卡开始学习。</div>';
    const completed=route.completedIds.includes(currentId);
    return `<div class="learning-lesson-content">${relatedId?'<button class="learning-return" type="button" data-learning-return-level><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> 返回当前学习关卡</button>':`<div class="learning-lesson-eyebrow">第 ${route.nodeIds.indexOf(currentId)+1} 关 · ${completed?'已完成，可随时复习':'阅读与探索'}</div>`}
      <h2>${escape(nameOf(level.node))}</h2><p class="learning-lesson-description">${escape(level.node.description||level.node.desc_zh||'这条知识暂无描述，可通过属性与关联知识进一步了解。')}</p>
      <section class="learning-lesson-section"><h3>主要属性</h3>${level.attributes?.length?`<dl>${level.attributes.slice(0,20).map(attr=>`<div><dt>${escape(attr.property_label_zh||attr.property||attr.key)}</dt><dd>${escape(valueText(attr.value))}</dd></div>`).join('')}</dl>`:'<p class="muted">暂无属性信息</p>'}</section>
      ${!relatedId&&screen!=='quiz'?`<div class="learning-complete-bar"><p>通过基于这条知识生成的选择题，完成本站学习。</p><button class="btn primary" type="button" data-learning-start ${busy?'disabled':''}>${completed?'复习练习':'开始学习'} <i class="fa-solid fa-play" aria-hidden="true"></i></button></div>`:''}</div>`;
  }
  function celebration() {
    return `<div class="learning-celebration" aria-hidden="true"><b>🎉</b>${Array.from({length:18},(_,i)=>`<i style="--x:${(i%9-4)*28}px;--y:${-65-(i%4)*24}px;--turn:${i*53}deg;--delay:${i%3*45}ms;--confetti-color:${['#58a879','#e8b34e','#818cf8','#ec899b'][i%4]}"></i>`).join('')}</div>`;
  }
  function renderQuiz() {
    const actions='<button class="btn" type="button" data-learning-exit-quiz><i class="fa-solid fa-xmark" aria-hidden="true"></i> 返回地图</button>';
    if(!quiz)return top('准备练习','正在根据知识内容生成题目…',actions)+notice();
    if(quiz.finished)return top('完成一站！','每一道题，都是知识之间更牢固的连接。',actions)+`<div class="learning-quiz-finish">${celebration()}<span><i class="fa-solid fa-check" aria-hidden="true"></i></span><h2>${escape(quiz.name)}</h2><p>本关 ${quiz.questions.length} 道题全部答对</p><strong>路线进度 ${route.progress}%</strong><p>${escape(quiz.feedback?.explanation || '')}</p>${route.progress===100?'<p>整条路线已完成，随时可以回来复习。</p>':''}<div><button class="btn" type="button" data-learning-exit-quiz>返回地图</button>${route.currentNodeId?'<button class="btn primary" type="button" data-learning-next-level>下一步</button>':''}</div></div>`;
    const question=quiz.questions[quiz.index];
    return top('专注练习',quiz.name,actions)+notice()+`<div class="learning-quiz-shell"><div class="learning-quiz-topline"><span>第 ${quiz.index+1} / ${quiz.questions.length} 题</span><button type="button" data-learning-quiz-reference>查看知识依据</button></div><progress value="${quiz.index}" max="${quiz.questions.length}" aria-label="答题进度"></progress><p class="learning-quiz-tip">${escape(quiz.note || '')}</p><h2>${escape(question.prompt)}</h2><div class="learning-quiz-options">${question.options.map((option,index)=>`<button type="button" data-learning-answer="${escape(option.id)}" ${busy||quiz.feedback?.correct?'disabled':''} class="${quiz.selected===option.id?(quiz.feedback?(quiz.feedback.correct?'is-correct':'is-wrong'):'is-selected'):''}"><b>${String.fromCharCode(65+index)}</b><span>${escape(option.text)}</span>${quiz.selected===option.id&&quiz.feedback?`<i class="fa-solid fa-${quiz.feedback.correct?'check':'xmark'}" aria-hidden="true"></i>`:''}</button>`).join('')}</div>${quiz.feedback?`<div class="learning-quiz-feedback ${quiz.feedback.correct?'is-correct':'is-wrong'}" role="status">${quiz.feedback.correct?celebration():''}<strong>${quiz.feedback.correct?'答对了！':'再试一次'}</strong><p>${escape(quiz.feedback.explanation)}</p>${quiz.feedback.correct?'<button class="btn primary" type="button" data-learning-next-question>下一题 <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>':''}</div>`:'<p class="learning-quiz-tip">选择一个答案。答错可以重试，不扣分。</p>'}</div>`;
  }
  function render() {
    const scroll=panel.scrollTop;panel.setAttribute('data-learning-screen',screen);
    panel.innerHTML=`<div class="learning-content">${screen==='home'?renderHome():screen==='edit'?renderEditor():screen==='quiz'?renderQuiz():top(route?.name||'学习旅程','选择一个站点，开启今天的学习。','<button class="btn" type="button" data-learning-home><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> 我的旅程</button>'+ (route?`<button class="btn" type="button" data-learning-edit="${escape(route.id)}">编排旅程</button>`:''))+notice()+(route?`<div class="learning-world"><span class="learning-world-label">YOUR KNOWLEDGE ADVENTURE</span>${map()}</div>`:'<div class="learning-empty" role="status">正在打开地图…</div>')}</div>`;
    panel.scrollTop=scroll;
    if(nodeModalOpen){nodeDialog.innerHTML=`<div class="learning-node-dialog-head"><span>知识站点</span><button type="button" data-learning-close-node aria-label="关闭节点信息">×</button></div><article class="learning-lesson">${renderLesson()}</article>`;if(!nodeDialog.open)nodeDialog.showModal();}
    const editor=panel.querySelector('.learning-editor'); if(editor)editor.inert=busy;
  }
  function closeNodeDialog(){nodeModalOpen=false;nodeDialog.close();}
  function refreshResults() { const host=panel.querySelector('[data-learning-results]');if(host)host.innerHTML=renderResults(); }
  async function showHome() {
    closeNodeDialog();quiz=null;
    ++viewVersion; ++detailVersion; ++searchVersion; clearTimeout(searchTimer); screen='home';routes=[];loading=true;error='';busy=false;writeRoute();render();
    const token=viewVersion;
    try { routes=(await api('/routes')).routes||[]; } catch(failure){if(token===viewVersion)error=failure.message;}
    if(token===viewVersion){loading=false;render();}
  }
  function newDraft() {
    closeNodeDialog();quiz=null;
    ++viewVersion; ++detailVersion; ++searchVersion;clearTimeout(searchTimer); screen='edit';mode='auto';draft={name:'',nodes:[]};results=[];searchError='';discoverNote='';error='';loading=false;busy=false;writeRoute();render();
  }
  async function editRoute(id) {
    if(busy)return;
    closeNodeDialog();quiz=null;
    const token=++viewVersion; ++detailVersion; error='';loading=true;
    try { const data=await api(`/routes/${encodeURIComponent(id)}`);if(token!==viewVersion)return;
      draft={...data.route,nodes:data.nodes};screen='edit';mode='manual';results=[];searchError='';discoverNote='';writeRoute();
    }catch(failure){if(token===viewVersion)error=failure.message;}
    if(token===viewVersion){loading=false;render();}
  }
  async function search(query) {
    const token=++searchVersion;searchError='';if(!query.trim()){results=[];refreshResults();return;}
    const host=panel.querySelector('[data-learning-results]');if(host)host.innerHTML='<p role="status">正在搜索知识…</p>';
    try { const data=await api(`/api/kb/entity_search?q=${encodeURIComponent(query.trim())}&limit=10&offset=0`);if(token!==searchVersion||screen!=='edit')return;results=data.nodes||data.items||[];if(!results.length)searchError='没有找到匹配知识，请换个关键词。'; }
    catch(failure){if(token===searchVersion)searchError=failure.message;}
    if(token===searchVersion)refreshResults();
  }
  async function addKnowledge(id) {
    if(busy)return;
    const node=results.find(item=>idOf(item)===id);if(!node)return;
    if(mode==='manual'){
      if(draft.nodes.some(item=>idOf(item)===id))return;
      if(draft.nodes.length>=100){error='一条路线最多 100 关';render();return;}
      draft.nodes.push(node);if(!draft.name)draft.name=`${nameOf(node)}学习路线`.slice(0,100);render();return;
    }
    busy=true;error='';render(); const token=viewVersion;
    try {const data=await api('/discover',{nodeId:id});if(token!==viewVersion)return;
      draft.nodes=data.candidates.map(item=>({...item.node,_learningRelation:`${item.depth} 跳 · ${item.relation}`}));
      if(!draft.name)draft.name=data.name.slice(0,100);discoverNote=data.note;
    }catch(failure){if(token===viewVersion)error=failure.message;}
    if(token===viewVersion){busy=false;render();}
  }
  async function saveRoute() {
    if(busy)return;
    if(!draft.name.trim()||!draft.nodes.length){error='请填写路线名称，并至少添加一个知识关卡。';render();return;}
    busy=true;error='';render();const token=viewVersion;
    try {const data=await api('/routes'+(draft.id?'/'+encodeURIComponent(draft.id):''),{name:draft.name,nodeIds:draft.nodes.map(idOf),...(draft.id?{revision:draft.revision}:{})},draft.id?'PUT':'POST');
      if(token!==viewVersion)return;busy=false;await openRoute(data.route.id);
    }catch(failure){if(token===viewVersion){busy=false;error=failure.message;render();}}
  }
  async function openRoute(id,requested='') {
    closeNodeDialog();quiz=null;
    const token=++viewVersion;++detailVersion;error='';loading=true;busy=false;screen='learn';route=null;render();
    try{const data=await api(`/routes/${encodeURIComponent(id)}`);if(token!==viewVersion)return;
      route=data.route;routeNodes=data.nodes;screen='learn';relatedId='';level=null;
      currentId=route.nodeIds.includes(requested)?requested:route.currentNodeId||route.nodeIds.find(key=>!route.completedIds.includes(key))||route.nodeIds[0];
      loading=false;writeRoute();render();
      panel.querySelector('.learning-path button[aria-current="step"]')?.scrollIntoView?.({block:'center',behavior:'auto'});
    }catch(failure){if(token===viewVersion){loading=false;error=failure.message;render();}}
  }
  async function selectLevel(id) {
    if(busy||!route?.nodeIds.includes(id))return;
    const token=++detailVersion;currentId=id;relatedId='';level=null;levelError='';loading=true;nodeModalOpen=true;writeRoute();render();
    try {
      const progress=await api(`/routes/${route.id}/progress`,{nodeId:id});if(token!==detailVersion)return;route=progress.route;
      const data=await api(`/routes/${route.id}/level?nodeId=${encodeURIComponent(id)}`);if(token!==detailVersion)return;level=data;window.recordKnowledgeView?.(id);
    }catch(failure){if(token===detailVersion)levelError=failure.message;}
    if(token===detailVersion){loading=false;render();}
  }
  async function startQuiz() {
    if(busy||!route?.nodeIds.includes(currentId)||relatedId)return;
    closeNodeDialog();screen='quiz';quiz=null;busy=true;error='';panel.scrollTop=0;writeRoute();render();const token=++detailVersion;
    try{const data=await api(`/routes/${route.id}/quiz`,{nodeId:currentId});if(token!==detailVersion)return;
      quiz={...data,index:0,selected:'',feedback:null,finished:false};
    }catch(failure){if(token===detailVersion)error=failure.message;}
    if(token===detailVersion){busy=false;render();}
  }
  async function answerQuiz(optionId) {
    if(busy||!quiz||quiz.finished||quiz.feedback?.correct)return;
    const question=quiz.questions[quiz.index];if(!question.options.some(option=>option.id===optionId))return;
    quiz.selected=optionId;quiz.feedback=null;busy=true;error='';render();const token=detailVersion;
    try{const data=await api(`/routes/${route.id}/answer`,{attemptId:quiz.attemptId,questionId:question.id,optionId});if(token!==detailVersion)return;
      route=data.route;quiz.feedback=data;quiz.finished=data.finished;
      if(data.finished)panel.scrollTop=0;
    }catch(failure){if(token===detailVersion)error=failure.message;}
    if(token===detailVersion){busy=false;render();}
  }
  async function browseRelated(id) {
    if(busy)return;
    const token=++detailVersion;relatedId=id;loading=true;levelError='';nodeModalOpen=true;render();
    try{const [detail,attrs,graph]=await Promise.all([api(`/api/kb/node?id=${encodeURIComponent(id)}`),api(`/api/kb/node/attributes?id=${encodeURIComponent(id)}`),api(`/api/kb/node/graph?id=${encodeURIComponent(id)}`)]);
      if(token!==detailVersion)return;
      level={node:detail.node,attributes:Array.isArray(attrs)?attrs:attrs.items||[],related:(graph.nodes||[]).filter(node=>idOf(node)!==id).map(node=>({node,relation:'关联知识'}))};
    }catch(failure){if(token===detailVersion)levelError=failure.message;}
    if(token===detailVersion){loading=false;render();}
  }
  panel.addEventListener('input',event=>{
    if(event.target.matches('[data-learning-name]'))draft.name=event.target.value;
    if(event.target.matches('[data-learning-search]')){clearTimeout(searchTimer);++searchVersion;const query=event.target.value;searchTimer=setTimeout(()=>search(query),300);}
  });
  async function handleClick(event){
    const button=event.target.closest('button');if(!button||button.disabled||busy)return;
    const data=button.dataset;
    if('learningCreate'in data){newDraft();return;}
    if('learningHome'in data){void showHome();return;}
    if('learningLogin'in data){document.getElementById('btnAuth')?.click();return;}
    if(data.learningOpen){void openRoute(data.learningOpen);return;}
    if(data.learningEdit){void editRoute(data.learningEdit);return;}
    if(data.learningDelete){if(!window.confirm('删除这条个人学习路线及进度？知识库内容会保留。'))return;busy=true;try{await api('/routes/'+data.learningDelete,undefined,'DELETE');busy=false;await showHome();}catch(failure){busy=false;error=failure.message;render();}return;}
    if(data.learningMode){mode=data.learningMode;results=[];searchError='';++searchVersion;clearTimeout(searchTimer);render();return;}
    if(data.learningAdd){void addKnowledge(data.learningAdd);return;}
    if('learningMove'in data){const from=Number(data.learningMove),to=from+Number(data.direction);if(to>=0&&to<draft.nodes.length)[draft.nodes[from],draft.nodes[to]]=[draft.nodes[to],draft.nodes[from]];render();return;}
    if('learningRemove'in data){draft.nodes.splice(Number(data.learningRemove),1);render();return;}
    if('learningSave'in data){void saveRoute();return;}
    if(data.learningLevel){void selectLevel(data.learningLevel);return;}
    if('learningCloseNode'in data){++detailVersion;loading=false;closeNodeDialog();return;}
    if('learningStart'in data){void startQuiz();return;}
    if(data.learningAnswer){void answerQuiz(data.learningAnswer);return;}
    if('learningNextQuestion'in data){if(quiz?.feedback?.correct){quiz.index++;quiz.selected='';quiz.feedback=null;panel.scrollTop=0;render();}return;}
    if('learningExitQuiz'in data){++detailVersion;screen='learn';quiz=null;currentId=route.currentNodeId||currentId;error='';writeRoute();render();return;}
    if('learningNextLevel'in data){if(busy||!quiz?.finished||!route?.currentNodeId)return;currentId=route.currentNodeId;relatedId='';level=null;levelError='';void startQuiz();return;}
    if('learningQuizReference'in data){void selectLevel(currentId);return;}
    if(data.learningRelated){void browseRelated(data.learningRelated);return;}
    if('learningReturnLevel'in data){void selectLevel(currentId);return;}
    if('learningRetryLevel'in data){if(relatedId)void browseRelated(relatedId);else void selectLevel(currentId);return;}
    if('learningRetry'in data){if(screen==='home')void showHome();else if(screen==='edit'){error='';render();}else if(screen==='quiz'){quiz=null;void startQuiz();}else if(route)void openRoute(route.id,currentId);}
  }
  panel.addEventListener('click',handleClick);nodeDialog.addEventListener('click',handleClick);
  nodeDialog.addEventListener('cancel',()=>{++detailVersion;nodeModalOpen=false;loading=false;});
  nodeDialog.addEventListener('close',()=>{nodeModalOpen=false;});
  window.loadKnowledgeLearning=async function(){
    const params=new URLSearchParams(location.search),id=params.get('learning_route'),target=params.get('learning_screen');
    if(id&&target==='edit')await editRoute(id);
    else if(id)await openRoute(id,params.get('learning_level')||'');
    else if(target==='edit')newDraft();else await showHome();
  };
  window.addEventListener('kb-auth-change',()=>{closeNodeDialog();quiz=null;++viewVersion;++detailVersion;++searchVersion;busy=false;route=null;draft=null;results=[];if(window.kbViewMode==='learning')void showHome();});
  window.addEventListener('resize',()=>{if(window.kbViewMode==='learning' && screen==='learn' && route)render();});
  window.stopKnowledgeLearning=()=>{closeNodeDialog();quiz=null;++viewVersion;++detailVersion;++searchVersion;clearTimeout(searchTimer);busy=false;};
  if(window.kbViewMode==='learning')void window.loadKnowledgeLearning();
})();
