import type { Database } from 'bun:sqlite';
import { type KnowledgeUser } from './knowledge-access.ts';
import { cleanKnowledgeId } from './enterprise-knowledge.ts';
type Row=Record<string,any>;
type Signal={node:Row;weight:number;seen?:boolean};
type Ranking={ids:string[];hints:Record<string,Row>};
const idOf=(node:Row)=>cleanKnowledgeId(node.id||node._id||node.sqlite_id);
function list(value:any):any[]{if(Array.isArray(value))return value;if(typeof value==='string'){try{const parsed=JSON.parse(value);if(Array.isArray(parsed))return parsed;}catch{}}return value?[value]:[];}
function features(node:Row):string[]{
  return [...new Set([
    ...list(node.tags).map(tag=>`tag:${String(tag).trim().toLocaleLowerCase()}`),
    ...list(node.categoryIds||node.class_ids||node.categories).map(category=>`class:${typeof category==='object'?category.id:category}`),
    ...(node.typeId||node.type?[`type:${node.typeId||node.type}`]:[]),
  ])];
}
function noise(seed:string,id:string){let hash=2166136261;for(const char of seed+'\0'+id)hash=Math.imul(hash^char.charCodeAt(0),16777619);hash^=hash>>>16;hash=Math.imul(hash,0x7feb352d);hash^=hash>>>15;return (hash>>>0)/4294967296;}
export function rankRecommendations(nodes:Row[],signals:Signal[],seed:string,options:{surface?:string;shown?:Set<string>}={}){
  const interests=new Map<string,number>(),seen=new Set<string>();
  for(const signal of signals){if(signal.seen)seen.add(idOf(signal.node));for(const feature of features(signal.node))interests.set(feature,(interests.get(feature)||0)+signal.weight);}
  const unique=new Map(nodes.map(node=>[idOf(node),node]));
  return [...unique.values()].map(node=>{
    const keys=features(node),interest=keys.reduce((sum,key)=>sum+Math.log1p(interests.get(key)||0),0)/Math.sqrt(Math.max(1,keys.length));
    const videos=list(node.videos||node.video).length;
    const score=interest*2.5+noise(seed,idOf(node))*4+(options.surface==='shorts'&&videos?1.5:0)-(seen.has(idOf(node))?3:0)-(options.shown?.has(idOf(node))?5:0);
    return {node,score};
  }).sort((a,b)=>b.score-a.score||idOf(a.node).localeCompare(idOf(b.node))).map(row=>row.node);
}
export function createKnowledgeRecommendations(deps:{
  db:Database;getUser:(req:Request)=>KnowledgeUser|null;getProject:(slug:string)=>{id:number;name:string}|null;
  store:{get:(database:string,id:string)=>Promise<Row|null>;searchAccess:(database:string,user:KnowledgeUser|null)=>Promise<{id:string}[]>;query:(database:string,aql:string,vars:Row)=>Promise<Row[]>}|null;
  search:(req:Request,url:URL,user?:KnowledgeUser|null)=>Promise<Response|null>;now?:()=>number;
}){
  const {db}=deps,now=deps.now||Date.now;
  db.run('CREATE TABLE IF NOT EXISTS knowledge_recommendation_exposures(project_id INTEGER NOT NULL,actor TEXT NOT NULL,node_id TEXT NOT NULL,last_shown INTEGER NOT NULL,PRIMARY KEY(project_id,actor,node_id))');
  db.run('CREATE INDEX IF NOT EXISTS recommendation_exposures_recent ON knowledge_recommendation_exposures(last_shown)');
  db.run('CREATE TABLE IF NOT EXISTS knowledge_recommendation_refresh(project_id INTEGER NOT NULL,actor TEXT NOT NULL,first_id TEXT NOT NULL,PRIMARY KEY(project_id,actor))');
  const cache=new Map<string,Ranking&{created:number}>(),pending=new Map<string,Promise<Ranking>>();
  // Share expensive candidate reads across refresh seeds for the same access context.
  const candidates=new Map<string,{created:number;value:Promise<{nodes:Row[];total:number}>}>();
  function candidateRead(key:string,read:()=>Promise<{nodes:Row[];total:number}>) {
    const existing=candidates.get(key);if(existing && now()-existing.created<30000)return existing.value;
    const value=read();candidates.set(key,{created:now(),value});
    value.catch(()=>{if(candidates.get(key)?.value===value)candidates.delete(key);});
    if(candidates.size>64)candidates.delete(candidates.keys().next().value!);
    return value;
  }
  const has=(table:string)=>!!db.query("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
  async function signals(project:{id:number;name:string},user:KnowledgeUser|null,actor:string):Promise<Signal[]>{
    const weights=new Map<string,{weight:number;seen:boolean}>();
    const add=(id:string,weight:number,seen=false)=>{id=cleanKnowledgeId(id);const previous=weights.get(id);weights.set(id,{weight:(previous?.weight||0)+weight,seen:seen||previous?.seen||false});};
    if(user&&user.id>0){
      if(has('account_knowledge_activity'))for(const row of db.query('SELECT node_id,kind,created_at FROM account_knowledge_activity WHERE user_id=? AND project_id=? ORDER BY created_at DESC LIMIT 150').all(user.id,project.id) as Row[]){
        const age=Math.max(0,now()-Date.parse(row.created_at));const decay=Number.isFinite(age)?Math.exp(-age/(30*86400000)):1;
        add(row.node_id,(row.kind==='favorite'?6:1)*decay,row.kind==='history');
      }

    }
    if(has('knowledge_view_visitors'))for(const row of db.query('SELECT node_id FROM knowledge_view_visitors WHERE project_id=? AND visitor=? ORDER BY last_seen DESC LIMIT 100').all(project.id,actor) as Row[])add(row.node_id,1,true);
    const entries=[...weights].sort((a,b)=>b[1].weight-a[1].weight).slice(0,80),result:Signal[]=[];
    if(entries.length){
      const url=new URL('http://localhost/api/kb/discover/search');url.searchParams.set('db',project.name);
      url.searchParams.set('ids',JSON.stringify(entries.map(([id])=>id)));url.searchParams.set('limit',String(entries.length));
      const response=await deps.search(new Request(url),url,user);if(!response?.ok)throw Error('Elasticsearch signal lookup failed');
      for(const node of (await response.json()).nodes || []){const signal=weights.get(idOf(node));if(signal)result.push({node,...signal});}
    }
    return result;
  }
  return {async handle(req:Request,url:URL):Promise<Response|null>{
    if(url.pathname!=='/api/kb/recommendations')return null;
    const json=(body:unknown,status=200,cookie='')=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
    if(req.method!=='GET')return json({error:'不支持的操作'},405);
    try{
      const project=deps.getProject(url.searchParams.get('db')||'default');if(!project)return json({error:'应用不存在'},404);
      const user=deps.getUser(req),visitor=req.headers.get('cookie')?.match(/(?:^|;\s*)kb_viewer=([a-zA-Z0-9-]{16,80})(?:;|$)/)?.[1]||crypto.randomUUID();
      const actor=user&&user.id>0?`user:${user.id}`:`guest:${visitor}`;
      const cookie=actor.startsWith('guest:')&&!req.headers.get('cookie')?.includes('kb_viewer=')?`kb_viewer=${visitor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${url.protocol==='https:'?'; Secure':''}`:'';
      const seed=(url.searchParams.get('recommendation_seed')||crypto.randomUUID()).slice(0,100);
      const limit=Math.max(1,Math.min(100,Number(url.searchParams.get('limit'))||24)),offset=Math.max(0,Math.min(10000,Number(url.searchParams.get('offset'))||0));
      if(!Number.isSafeInteger(limit)||!Number.isSafeInteger(offset))return json({error:'分页参数无效'},400);
      const filters=['class_id','tag','hide_entity','defined_class_only','has_media'].map(key=>[key,url.searchParams.get(key)||'']);
      const key=JSON.stringify([project.id,actor,seed,filters,url.searchParams.get('surface')||'',user?.role,user?.ownedProjectIds,user?.memberProjectIds,user?.fullAccess]);
      const build=async()=>{
        const base=new URL('/api/kb/discover/search',url.origin);base.searchParams.set('db',project.name);for(const [key,value] of filters)if(value)base.searchParams.set(key!,value);
        async function search(order:string,offset=0,limit=80){const query=new URL(base);query.searchParams.set('order',order);query.searchParams.set('offset',String(offset));query.searchParams.set('limit',String(limit));const response=await deps.search(req,query);if(!response?.ok)throw Error('推荐候选知识加载失败');return await response.json() as {nodes:Row[];total:number};}
        const candidateKey=JSON.stringify([project.id,user?.id || 0,user?.role,user?.ownedProjectIds,user?.memberProjectIds,user?.fullAccess,filters]);
        const [rich,recent,profile]=await Promise.all([
          candidateRead(candidateKey+':rich',()=>search('richness')),
          candidateRead(candidateKey+':recent',()=>search('created_desc')),
          signals(project,user,actor)]);
        const sampleOffset=Math.floor(noise(seed,'sample')*Math.max(1,Math.min(2000,Number(rich.total)-79)));
        const sample=sampleOffset?await search('id',sampleOffset):{nodes:[],total:0};
        const shown=new Set((db.query('SELECT node_id FROM knowledge_recommendation_exposures WHERE project_id=? AND actor=? AND last_shown>?').all(project.id,actor,now()-1800000) as Row[]).map(row=>String(row.node_id)));
        const ranked=rankRecommendations([...rich.nodes,...recent.nodes,...sample.nodes],profile,seed,{surface:url.searchParams.get('surface')||'',shown});
        const previous=db.query('SELECT first_id FROM knowledge_recommendation_refresh WHERE project_id=? AND actor=?').get(project.id,actor) as Row|null;
        if(ranked.length>1&&idOf(ranked[0]!)===previous?.first_id)[ranked[0],ranked[1]]=[ranked[1]!,ranked[0]!];
        const hints:Record<string,Row>={};
        for(const node of ranked){
          const media:Row={};
          for(const key of ['images','videos','covers'])media[key]=list(node[key]).map(value=>typeof value==='string'&&!value.startsWith('data:')?value:'');
          hints[idOf(node)]={updated_at:node.updated_at||'',typeLabel:node.typeLabel,classLabel:node.classLabel,categoryLabels:node.categoryLabels,classes:node.classes,color:node.color,...media};
        }
        return {ids:ranked.map(idOf),hints};
      };
      let snapshot=cache.get(key);
      if(!snapshot||now()-snapshot.created>300000){
        let task=pending.get(key);if(!task){task=build();pending.set(key,task);}
        try{snapshot={...await task,created:now()};cache.set(key,snapshot);}finally{pending.delete(key);}
        if(cache.size>64)cache.delete(cache.keys().next().value!);
      }
      const fresh=new URL('/api/kb/discover/search',url.origin);fresh.searchParams.set('db',project.name);
      const pageIds=snapshot.ids.slice(offset,offset+limit);
      fresh.searchParams.set('ids',JSON.stringify(pageIds));fresh.searchParams.set('limit',String(Math.max(1,pageIds.length)));
      if(!pageIds.length)return json({nodes:[],total:snapshot.ids.length,recommendation_seed:seed,personalized:Boolean(user&&user.id>0)},200,cookie);
      const response=await deps.search(req,fresh,user);if(!response?.ok)throw Error('Elasticsearch recommendation page failed');
      const data=await response.json();const byId=new Map<string,Row>((data.nodes || []).map((node:Row)=>[idOf(node),node]));
      const output=pageIds.filter(id=>byId.has(id)).map(id=>byId.get(id)!);
      db.transaction(()=>{
        for(const node of output)db.run('INSERT INTO knowledge_recommendation_exposures(project_id,actor,node_id,last_shown) VALUES(?,?,?,?) ON CONFLICT(project_id,actor,node_id) DO UPDATE SET last_shown=excluded.last_shown',[project.id,actor,idOf(node),now()]);
        if(offset===0&&output[0])db.run('INSERT INTO knowledge_recommendation_refresh(project_id,actor,first_id) VALUES(?,?,?) ON CONFLICT(project_id,actor) DO UPDATE SET first_id=excluded.first_id',[project.id,actor,idOf(output[0])]);
        db.run('DELETE FROM knowledge_recommendation_exposures WHERE last_shown<?',[now()-7*86400000]);
      })();
      return json({nodes:output,total:snapshot.ids.length,recommendation_seed:seed,personalized:Boolean(user&&user.id>0)},200,cookie);
    }catch(error){console.error('Knowledge recommendations failed',error);return json({error:'推荐服务暂不可用，请重试'},503);}
  }};
}
