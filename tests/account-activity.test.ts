import { Database } from 'bun:sqlite';
import { expect,test } from 'bun:test';
import { createAccountActivity } from '../src/server/account-activity.ts';
import { documentKey } from '../src/server/arangodb.ts';

function setup(){
  const db=new Database(':memory:');
  db.run('CREATE TABLE projects(id INTEGER PRIMARY KEY,name TEXT,title TEXT,owner_user_id INTEGER)');
  db.run("INSERT INTO projects VALUES(1,'a','应用一',2),(2,'b','应用二',2)");
  db.run('CREATE TABLE application_members(project_id INTEGER,user_id INTEGER)');
  db.run('CREATE TABLE nodes(id TEXT PRIMARY KEY,project_id INTEGER,name TEXT)');
  db.run('CREATE TABLE knowledge_favorites(user_id INTEGER,knowledge_id TEXT,created_at TEXT)');
  const docs=new Map(['a','b'].map(name=>[name,{id:'Q1',sqlite_id:'Q1',name:`知识${name}`,visibility:'public',owner_user_id:2,project_id:name==='a'?1:2,interactions:{likes:[1]}}]));
  let user:any={id:1,username:'one'};
  const store:any={get:async(database:string,id:string)=>id==='Q1'?docs.get(database):null,query:async(database:string,_query:string,params:any)=>{const doc=docs.get(database);return doc&&(params.keys?params.keys.includes(documentKey(doc.id)):doc.interactions.likes.includes(params.uid))?[doc]:[];}};
  const service=createAccountActivity({db,store,getUser:()=>user,getProject:slug=>db.query('SELECT * FROM projects WHERE name=?').get(slug)});
  async function call(kind:string,method='POST',project='a',id='Q1'){
    const url=new URL(`http://localhost/api/account/knowledge/${kind}?db=${project}&id=${id}`);
    const response=(await service.handle(new Request(url,{method}),url))!;
    return{status:response.status,data:await response.json()};
  }
  return{db,service,docs,call,user,setUser:(next:any)=>{user=next;}};
}
test('history is per user/application, deduplicated, and only accepts readable knowledge',async()=>{
  const h=setup();try{
    expect((await h.call('history')).status).toBe(200);
    await h.call('history');await h.call('history','POST','b');
    expect((await h.service.records(h.user,'history'))).toHaveLength(2);
    expect((await h.call('history','POST','a','missing')).status).toBe(404);
    expect((h.db.query("SELECT COUNT(*) AS n FROM account_knowledge_activity WHERE kind='history'").get() as any).n).toBe(2);
    expect(await h.service.records({id:2,username:'two'},'history')).toEqual([]);
    h.setUser(null);expect((await h.call('history')).status).toBe(401);
  }finally{h.db.close();}
});
test('favorites persist and cancel independently for identical entity IDs in different apps',async()=>{
  const h=setup();try{
    await h.call('favorites');expect((await h.call('favorites','GET')).data.favorited).toBe(true);
    expect((await h.call('favorites','GET','b')).data.favorited).toBe(false);
    const favorites=await h.service.records(h.user,'favorites');expect(favorites[0]?.name).toBe('知识a');expect(favorites[0]?.project_slug).toBe('a');
    h.docs.get('a')!.visibility='private';
    expect((await h.service.records(h.user,'favorites'))[0]?.id).toBeNull();
    expect(JSON.stringify(await h.service.records(h.user,'favorites'))).not.toContain('知识a');
    expect((await h.call('favorites','DELETE')).data.favorited).toBe(false);
    expect(await h.service.records(h.user,'favorites')).toEqual([]);
  }finally{h.db.close();}
});
test('enterprise profile reads authoritative Arango likes and honors cancellation and access changes',async()=>{
  const h=setup();try{
    expect((await h.service.records(h.user,'likes'))).toHaveLength(2);
    h.docs.get('a')!.interactions.likes=[];
    h.docs.get('b')!.visibility='private';
    const likes=await h.service.records(h.user,'likes');expect(likes).toHaveLength(1);expect(likes[0]?.id).toBeNull();
    expect((await h.service.counts(h.user)).likes).toBe(1);
  }finally{h.db.close();}
});
test('history cap keeps the latest 500 records without deleting other users history',async()=>{
  const h=setup();try{
    for(let index=0;index<501;index++)h.db.run("INSERT INTO account_knowledge_activity VALUES(1,1,?,'history','2000-01-01')",[String(index)]);
    h.db.run("INSERT INTO account_knowledge_activity VALUES(2,1,'other','history','2000-01-01')");
    await h.call('history');
    expect((h.db.query("SELECT COUNT(*) AS n FROM account_knowledge_activity WHERE user_id=1 AND kind='history'").get() as any).n).toBe(500);
    expect((h.db.query('SELECT COUNT(*) AS n FROM account_knowledge_activity WHERE user_id=2').get() as any).n).toBe(1);
  }finally{h.db.close();}
});
