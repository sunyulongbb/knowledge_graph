(function () {
  const recent = new Map();
  let pending = null;
  window.recordKnowledgeView = function (id, db) {
    if (!id) return;
    if (!window.authUser?.id) { if(window.authUser===undefined) pending={id,db}; return; }
    id=String(id).replace(/^entity\//,'');
    db=db || new URLSearchParams(location.search).get('db') || 'default';
    const key=`${window.authUser.id}:${db}:${id}`,now=Date.now();
    if(now-(recent.get(key)||0)<2000)return;
    recent.set(key,now);
    const url=new URL('/api/account/knowledge/history',location.origin);url.searchParams.set('db',db);url.searchParams.set('id',id);
    fetch(url,{method:'POST'}).then(response=>{if(!response.ok)recent.delete(key);}).catch(()=>recent.delete(key));
    if(recent.size>500)recent.delete(recent.keys().next().value);
  };
  window.addEventListener('kb-auth-change',()=>{recent.clear();const record=pending;pending=null;if(record&&window.authUser?.id)window.recordKnowledgeView(record.id,record.db);});
})();
