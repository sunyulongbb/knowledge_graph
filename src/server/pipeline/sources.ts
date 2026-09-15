import { SQL } from 'bun';
import { MAX_ROWS } from './store.ts';
import { ensureReadOnlyQuery } from '../sparql/query.ts';
import { executeSparqlRequest } from '../sparql/client.ts';

export const demoRows = [
  { id: '10001', name: '张三', birthday: '1990-01-01', country: '中国', occupation: '工程师' },
  { id: '10002', name: '李四', birthday: '1988-05-20', country: '中国', occupation: '教师' },
  { id: '10003', name: '王五', birthday: '1995-09-12', country: '中国', occupation: '研究员' },
];

export function selectQuery(input: any) {
  if (input.sql) {
    const query = String(input.sql).trim().replace(/;$/, '').trim();
    // A deliberately small read-only SQL subset for this prototype, not a SQL sandbox.
    if (!/^SELECT\s/i.test(query) || /;|--|\/\*|\b(INTO|OUTFILE|DUMPFILE|FOR\s+UPDATE|LOCK|SLEEP|BENCHMARK|LOAD_FILE)\b/i.test(query)) throw new Error('原型仅支持单条 SELECT 查询，不支持注释、锁定或写文件');
    return query;
  }
  if (!/^[\p{L}\p{N}_$]+$/u.test(String(input.table || ''))) throw new Error('请填写有效的数据表名或 SELECT SQL');
  return 'SELECT * FROM `' + input.table + '`';
}

export async function readMysql(input: any) {
  const action = input.action || 'read';
  if (!['test', 'fields', 'read'].includes(action)) throw new Error('数据库操作无效');
  if (input.demo === true) return { demo: true, message: '演示数据（未连接 MySQL）', columns: Object.keys(demoRows[0]!), rows: action === 'test' || action === 'fields' ? [] : demoRows, sourceKey: 'mysql:demo:people' };
  const port = Number(input.port || 3306);
  if (!input.host || !input.database || !input.username || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('请填写完整的 MySQL 连接信息');
  const sql = new SQL({ adapter: 'mysql', hostname: String(input.host), port, database: String(input.database), username: String(input.username), password: String(input.password || ''), max: 1, connectionTimeout: 10, idleTimeout: 5 });
  const timer = setTimeout(() => { void sql.close({ timeout: 0 }); }, 20000);
  try {
    await sql.connect();
    if (action === 'test') { await sql`SELECT 1`; return { demo: false, message: '连接成功', columns: [], rows: [] }; }
    // max=1 keeps this read-only session setting on the connection used below.
    await sql.unsafe('SET SESSION TRANSACTION READ ONLY');
    const query = selectQuery(input);
    if (action === 'fields' && !input.sql) {
      const fields = await sql`SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ${String(input.database)} AND TABLE_NAME = ${String(input.table)} ORDER BY ORDINAL_POSITION`;
      if (!fields.length) throw new Error('表不存在或没有可读字段');
      return { demo: false, columns: fields.map((f: any) => f.name), rows: [] };
    }
    const rows = await sql.unsafe(`SELECT * FROM (${query}) AS pipeline_source LIMIT ${action === 'fields' ? 1 : MAX_ROWS + 1}`);
    if (rows.length > MAX_ROWS) throw new Error(`原型最多读取 ${MAX_ROWS} 条，请用 SQL 缩小范围`);
    const columns = rows.length ? Object.keys(rows[0]) : [];
    if (!columns.length) throw new Error('查询没有返回记录；请调整条件后读取');
    return { demo: false, columns, rows: action === 'fields' ? [] : JSON.parse(JSON.stringify(rows, (_k, v) => typeof v === 'bigint' ? v.toString() : v)), sourceKey: `mysql:${input.host}:${port}/${input.database}/${input.table || new Bun.CryptoHasher('sha256').update(query).digest('hex')}` };
  } catch (error) {
    // Do not echo connection strings, credentials or driver diagnostics.
    if ((error as Error).message.startsWith('原型') || (error as Error).message.startsWith('查询') || (error as Error).message.startsWith('表不存在')) throw error;
    throw new Error('MySQL 连接或读取失败，请检查连接信息、SELECT 语句和账号只读权限');
  } finally { clearTimeout(timer); await sql.close({ timeout: 0 }); }
}

export function wikidataQuery(input: any) {
  const limit = Number(input.limit || 100), type = String(input.entityType || 'Q5').trim(), language = String(input.language || 'zh');
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_ROWS) throw new Error('数量必须为 1–10000');
  if (input.query) {
    const query = String(input.query).trim();
    if (query.length > 100000 || ensureReadOnlyQuery(query) !== 'SELECT') throw new Error('高级查询仅支持 SELECT');
    return { query, limit };
  }
  if (!/^Q\d+$/.test(type) || !/^[a-z]{2,3}(?:-[A-Za-z]+)?$/.test(language)) throw new Error('实体类型使用 Q 编号，语言使用 zh、en 等代码');
  const property = String(input.property || '').trim(), value = String(input.value || '').trim();
  if ((property || value) && (!/^P\d+$/.test(property) || !/^Q\d+$/.test(value))) throw new Error('简单条件使用属性 P 编号和实体 Q 编号');
  return { limit, query: `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT DISTINCT ?id ?name ?birthday ?country ?occupation WHERE {
  ?id wdt:P31/wdt:P279* wd:${type} .
  ${property ? `?id wdt:${property} wd:${value} .` : ''}
  OPTIONAL { ?id rdfs:label ?label . FILTER(LANG(?label) = "${language}") }
  BIND(COALESCE(?label, STR(?id)) AS ?name)
  OPTIONAL { ?id wdt:P569 ?birthday }
  OPTIONAL { ?id wdt:P27 ?country }
  OPTIONAL { ?id wdt:P106 ?occupation }
} LIMIT ${limit}` };
}

export async function readWikidata(input: any) {
  const { query, limit } = wikidataQuery(input);
  const result = await executeSparqlRequest({ endpoint: process.env.WIKIDATA_SPARQL_ENDPOINT || 'https://qlever.dev/api/wikidata', timeout: 20000 }, query);
  const rows = (result.rows || []).slice(0, limit).map((r: any) => Object.fromEntries(Object.entries(r).map(([k, v]: [string, any]) => [k, v?.value ?? ''])));
  return { columns: result.columns || Object.keys(rows[0] || {}), rows, sourceKey: 'wikidata', query, truncated: (result.rows || []).length > limit };
}
