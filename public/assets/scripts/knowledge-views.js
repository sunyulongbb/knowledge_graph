(function () {
  const recent=new Map();
  const normalize=id=>String(id||'').replace(/^entity\//,'');
  function display(id,db,count) {
    if(!Number.isFinite(count))return;
    document.querySelectorAll('[data-knowledge-views]').forEach(element=>{
      if(normalize(element.dataset.knowledgeViews)!==id)return;
      const scope=element.dataset.db||new URLSearchParams(location.search).get('db')||'default';
      if(scope===db)element.textContent=String(count);
    });
    window.dispatchEvent(new CustomEvent('kb:knowledge-view-count',{detail:{id,db,viewCount:count}}));
  }
  window.recordKnowledgeViewCount=function(rawId,scope) {
    const id=normalize(rawId),db=scope||new URLSearchParams(location.search).get('db')||'default';
    if(!id)return;
    const key=JSON.stringify([db,id]),previous=recent.get(key),now=Date.now();
    if(previous&&now-previous.time<30000){display(id,db,previous.count);return;}
    const entry={time:now,count:undefined};recent.set(key,entry);
    const url=new URL(`/api/knowledge/${encodeURIComponent(id)}/view`,location.origin);url.searchParams.set('db',db);
    fetch(url,{method:'POST',credentials:'same-origin'}).then(async response=>{
      if(!response.ok)throw Error('view count failed');
      const data=await response.json();entry.count=Number(data.viewCount);display(id,db,entry.count);
    }).catch(()=>{if(recent.get(key)===entry)recent.delete(key);});
    if(recent.size>500)recent.delete(recent.keys().next().value);
  };
})();
