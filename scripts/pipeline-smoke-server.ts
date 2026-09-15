// Isolated UI smoke-test server: all writes go to an in-memory SQLite fixture.
import { Database } from 'bun:sqlite';
import { createPipelineHandler } from '../src/server/pipeline/http.ts';
import { createKnowledgeDatabase, ensureKnowledgeAccessSchema, knowledgeContext } from '../src/server/knowledge-access.ts';
import { resolve, sep } from 'node:path';

const raw = new Database(':memory:');
raw.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE nodes (id TEXT PRIMARY KEY, name TEXT, type TEXT, aliases TEXT, description TEXT, tags TEXT, project_id INTEGER, updated_at TEXT, data TEXT);
CREATE TABLE attributes (id TEXT PRIMARY KEY, node_id TEXT REFERENCES nodes(id), key TEXT, value TEXT, datatype TEXT, property_name_snapshot TEXT, statement_json TEXT);
CREATE TABLE ontologies (id TEXT PRIMARY KEY, name TEXT, parent_id TEXT, project_id INTEGER);
CREATE TABLE properties (id TEXT PRIMARY KEY, name TEXT, datatype TEXT, valuetype TEXT, tail_ontology_id TEXT, project_id INTEGER, status TEXT);
CREATE TABLE ontology_properties (ontology_id TEXT, property_id TEXT);
INSERT INTO ontologies VALUES ('person','人物',NULL,1),('country','国家',NULL,1);
INSERT INTO properties VALUES ('birthday','出生日期','time','time',NULL,1,'active'),('country','国籍','wikibase-item','wikibase-entityid','country',1,'active'),('job','职业','string','string',NULL,1,'active');
INSERT INTO ontology_properties VALUES ('person','birthday'),('person','country'),('person','job');
INSERT INTO nodes(id,name,type,aliases,project_id) VALUES ('existing','张三','person','[]',1);
`);
ensureKnowledgeAccessSchema(raw);
const user = { id:1, username:'test-admin', role:'admin' };
const handler = createPipelineHandler(raw,createKnowledgeDatabase(raw),()=>user,slug=>slug==='demo'?{id:1}:null);
const root = resolve(import.meta.dir,'..');
const server = Bun.serve({ hostname:'127.0.0.1', port:0, async fetch(req) {
  const url = new URL(req.url);
  if (url.pathname === '/sparql') return new Response(Bun.file(resolve(root,'public/sparql.html')), {headers:{'Content-Type':'text/html; charset=utf-8'}});
  if (['/api/sparql/endpoints','/api/sparql/templates','/api/sparql/import/tasks'].includes(url.pathname)) return Response.json({success:true,data:{items:[]}});
  if (url.pathname === '/') return new Response(`<!doctype html><html lang="zh"><meta charset="utf-8"><title>数据流程隔离验证</title><link rel="stylesheet" href="/assets/styles/app.css"><style>:root{--fg:#172033;--border:#dbe1ea;--surface-0:#fff;--surface-1:#f8fafc;--surface-2:#eef2f6;--accent:#2563eb}html,body{height:100%;overflow:hidden}body{font-family:sans-serif;margin:0;padding:12px;box-sizing:border-box;display:flex;flex-direction:column}.btn{padding:8px 12px;cursor:pointer}.muted{color:#64748b}</style><link rel="stylesheet" href="/assets/styles/pipeline.css"><link rel="stylesheet" href="/assets/generated/business-grid.css"><link rel="stylesheet" href="/assets/generated/ontology-tree.css"><div id="entryPanel"></div><div id="cleanPanel" style="display:none"></div><script>window.authUser={role:'admin'};window.kbViewMode='entry';window.appendCurrentDbParam=url=>{url.searchParams.set('db','demo');return url};window.kbBusinessGridModuleReady=import('/assets/generated/business-grid.js');window.setViewMode=mode=>{window.kbViewMode=mode;document.getElementById('entryPanel').style.display=mode==='entry'?'':'none';document.getElementById('cleanPanel').style.display=mode==='clean'?'':'none';window.openPipeline?.(mode)};</script><script src="/js/xlsx.full.min.js"></script><script type="module" src="/assets/scripts/pipeline-ui.js"></script></html>`,{headers:{'Content-Type':'text/html; charset=utf-8'}});
  if (url.pathname==='/api/kb/ontology/tree') return Response.json({items:[{id:'person',name:'人物',children:[]},{id:'country',name:'国家',children:[]}]});
  if (url.pathname==='/test/counts') return Response.json({nodes:raw.query('SELECT COUNT(*) AS count FROM nodes').get(),attributes:raw.query('SELECT COUNT(*) AS count FROM attributes').get(),entities:raw.query("SELECT name,aliases,description,tags FROM nodes WHERE type='person'").all()});
  if (url.pathname.startsWith('/api/')) return await knowledgeContext.run({user},()=>handler(req,url,req.method)) || new Response('Not found',{status:404});
  const path = resolve(root,'public', '.' + url.pathname);
  if (!path.startsWith(resolve(root,'public') + sep)) return new Response('Not found',{status:404});
  const file=Bun.file(path); return await file.exists()?new Response(file):new Response('Not found',{status:404});
} });
console.log('PIPELINE_SMOKE_URL=http://127.0.0.1:'+server.port);
