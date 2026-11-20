import type { Database } from 'bun:sqlite';
import { applicationPermissions } from './application-access.ts';
import { EnterpriseKnowledgeStore } from './enterprise-knowledge.ts';
import type { KnowledgeUser } from './knowledge-access.ts';
export function createTopicsHandler(deps:{db:Database;store:EnterpriseKnowledgeStore|null;getUser:(req:Request)=>KnowledgeUser|null;getProject:(slug:string)=>any}) {
 const initialized=new Set<string>();
 return async(req:Request,url:URL):Promise<Response|null>=>{
  if(!url.pathname.startsWith('/api/kb/topics'))return null;
  const error=(message:string,status=400)=>Response.json({error:message},{status});
  const match=/^\/api\/kb\/topics(?:\/([a-zA-Z0-9-]+))?$/.exec(url.pathname);if(!match)return error('专题不存在',404);
  const user=deps.getUser(req);if(!user||user.id<=0)return error('请先登录',401);
  const project=deps.getProject(url.searchParams.get('db')||'default');if(!project||!applicationPermissions(deps.db,user,project).member)return error('需要当前应用成员权限',403);
  if(!deps.store)return error('专题需要 ArangoDB 存储',503);
  const store=deps.store,database=String(project.name),id=match[1];
  try{
   if(!initialized.has(database)){try{await store.client.database(database,'/_api/collection',{method:'POST',body:JSON.stringify({name:'topics',type:2})})}catch(e:any){if(e.body?.errorNum!==1207)throw e}initialized.add(database)}
   const scope={owner:Number(user.id),project:Number(project.id)};
   if(req.method==='GET'&&!id){const items=await store.query(database,'FOR t IN topics FILTER t.owner == @owner AND t.project == @project SORT t.updatedAt DESC RETURN UNSET(t,"_key","_id","_rev","owner","project")',scope);return Response.json({items})}
   if(req.method==='DELETE'&&id){const rows=await store.query(database,'FOR t IN topics FILTER t._key == @id AND t.owner == @owner AND t.project == @project REMOVE t IN topics RETURN OLD._key',{...scope,id});return rows.length?Response.json({ok:true}):error('专题不存在',404)}
   if(!['POST','PUT'].includes(req.method)||Boolean(id)!==(req.method==='PUT'))return error('不支持的操作',405);
   const body:any=await req.json();const name=String(body.name||'').trim();if(!name||name.length>100||!body.category||!body.groups)return error('专题名称及属性不能为空');
   const config:any={};for(const field of ['description','category','date','groups','typeId','typeName','query','classId']){config[field]=String(body[field]||'');if(config[field].length>2000)return error('专题配置过长')}
   config.fieldLabels=Object.fromEntries(Object.entries(body.fieldLabels||{}).filter(([k,v])=>k.length<512&&typeof v==='string'&&v.length<512));
   if(JSON.stringify(config).length>100000)return error('专题配置过大',413);
   const topicId=id||(/^[a-zA-Z0-9-]{1,80}$/.test(String(body.id||''))?String(body.id):crypto.randomUUID()),doc={...config,...scope,id:topicId,name,source:'knowledge',rows:[],updatedAt:new Date().toISOString()};
   if(id){const rows=await store.query(database,'FOR t IN topics FILTER t._key == @id AND t.owner == @owner AND t.project == @project REPLACE t WITH @doc IN topics RETURN NEW',{...scope,id,doc});if(!rows.length)return error('专题不存在',404)}else await store.query(database,'INSERT MERGE(@doc,{_key:@id}) INTO topics RETURN NEW',{doc,id:topicId});
   return Response.json({item:doc},{status:id?200:201});
  }catch(e:any){console.error('topics storage failed',e);return error('专题存储失败，请稍后重试',503)}
 };
}
