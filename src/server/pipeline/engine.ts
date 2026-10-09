import type { Database } from 'bun:sqlite';
import { normalizeDatatype, normalizeValue, normalizeStatement, parseTimeValue, uiDatatype, valueTypeFor } from '../../shared/wikidata.ts';
import { loadOntologyProperties } from '../ontology-properties.ts';
import { canAccessKnowledge, type KnowledgeUser } from '../knowledge-access.ts';
import { NODE_TYPES, PipelineStore, withoutRowDetails, type EntityTable, type Flow } from './store.ts';
import { BASIC_FIELDS, inferBasicFields, basicText, basicList } from '../../../public/assets/scripts/pipeline-fields.js';
import { normalizeEntityTaxonomy } from '../../shared/entity-taxonomy.ts';

type Entity = { id: string; name: string; type: string; aliases: string[]; description: string; tags: string[]; categories: string[]; attributes: Record<string, any[]>; original?: any; fresh: boolean };
type Decision = { action: 'link' | 'new' | 'skip'; entityId?: string };
export function stable(value: any): string {
  return JSON.stringify(value && typeof value === 'object' ? Array.isArray(value) ? value.map(v => JSON.parse(stable(v))) : Object.fromEntries(Object.keys(value).sort().map(k => [k, JSON.parse(stable(value[k] ?? null))])) : value ?? null);
}
const empty = (value: any) => value === null || value === undefined || (typeof value === 'string' && !value.trim());
const key = (v: any) => v && typeof v === 'object' && v.id ? 'entity:' + v.id : stable(v);
const unique = (values: any[]) => [...new Map(values.filter(v => !empty(v)).map(v => [key(v), v])).values()];
function configuredList(raw: any, language: string, option: any = {}) {
  if (raw === null || raw === undefined || raw === '') return [];
  const multi = option.multi ?? option.defaultMulti ?? true;
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) raw = parsed;
    } catch {}
  }
  if (Array.isArray(raw)) return multi ? raw.map(v => basicText(v, language)).filter(Boolean) : [raw.map(v => basicText(v, language)).join(option.separator || ',')];
  if (raw && typeof raw === 'object') {
    const localized = raw[language] ?? raw[language.split('-')[0]] ?? raw.zh ?? raw.en;
    if (Array.isArray(localized)) return multi ? localized.map(v => basicText(v, language)).filter(Boolean) : [localized.map(v => basicText(v, language)).join(option.separator || ',')];
  }
  const value = basicText(raw, language);
  if (!multi) return value ? [value] : [];
  const separator = String(option.separator ?? option.defaultSeparator ?? '');
  if (separator === ' ') return value.split(/\s+/).map(v => v.trim()).filter(Boolean);
  return (separator ? value.split(separator) : value.split(/[,，;；、|\n]+/)).map(v => v.trim()).filter(Boolean);
}
export function mergeValues(old: any[], incoming: any[], strategy: string) {
  old = unique(old); incoming = unique(incoming);
  const conflict = old.length > 0 && incoming.some(v => !old.some(o => key(o) === key(v)));
  const values = !old.length ? incoming : !incoming.length || !conflict || strategy === 'keep' ? old : strategy === 'replace' ? incoming : unique([...old, ...incoming]);
  return { values, conflict };
}
const NODE_LABELS: Record<string, string> = { input: '实体表输入', ontology: '本体对齐', properties: '属性对齐', alignment: '实体对齐', fusion: '知识融合', output: '知识库输出' };

export type FlowRoute = {
  /** Entity-table input that starts this route. */
  inputId: string;
  tableId: string;
  ontologyId: string;
  properties: Record<string, any> | null;
  strategy: string;
  /** Route node ids ordered from the input to the knowledge-base output. */
  nodeIds: string[];
};

export type FlowBranch = {
  /** Knowledge-base output node id; also the branch identity inside a run. */
  id: string;
  name: string;
  /** Every node feeding this output, in flow order. */
  nodeIds: string[];
  /** One entry per upstream entity table; their rows are merged into this output. */
  routes: FlowRoute[];
};

/** Label every node, disambiguating repeated types so validation messages stay actionable. */
function nodeLabels(flow: Flow) {
  const totals = new Map<string, number>(), seen = new Map<string, number>(), labels = new Map<string, string>();
  for (const node of flow.nodes) totals.set(node.type, (totals.get(node.type) || 0) + 1);
  for (const node of flow.nodes) {
    const index = (seen.get(node.type) || 0) + 1;
    seen.set(node.type, index);
    labels.set(node.id, (totals.get(node.type) || 1) > 1 ? `${NODE_LABELS[node.type] || node.type} #${index}` : NODE_LABELS[node.type] || node.type);
  }
  return labels;
}

/**
 * A flow is a set of independent branches: every knowledge-base output owns all of its upstream
 * nodes, and every upstream entity table contributes one route whose rows are merged into that
 * output. Nodes accept several incoming connections, but a branch may not fan out and merge back
 * again, because the same rows would then be processed twice.
 */
export function resolveBranches(flow: Flow): FlowBranch[] {
  const labels = nodeLabels(flow);
  const nodeById = new Map(flow.nodes.map(node => [node.id, node]));
  if (nodeById.size !== flow.nodes.length) throw new Error('流程存在重复的节点 ID');
  for (const node of flow.nodes) if (!NODE_TYPES.includes(node.type)) throw new Error(`流程包含未知的节点类型：${node.type}`);
  if (!flow.nodes.some(node => node.type === 'input')) throw new Error('流程需要一个“实体表输入”节点');
  if (!flow.nodes.some(node => node.type === 'output')) throw new Error('流程需要一个“知识库输出”节点');
  const inbound = new Map<string, string[]>(), outbound = new Map<string, string[]>();
  for (const node of flow.nodes) { inbound.set(node.id, []); outbound.set(node.id, []); }
  for (const edge of flow.edges) {
    if (!nodeById.has(edge.from) || !nodeById.has(edge.to) || edge.from === edge.to) throw new Error('连接引用了不存在的节点');
    outbound.get(edge.from)!.push(edge.to);
    inbound.get(edge.to)!.push(edge.from);
  }
  for (const node of flow.nodes) {
    const label = labels.get(node.id), inCount = inbound.get(node.id)!.length, outCount = outbound.get(node.id)!.length;
    if (node.type === 'input' && inCount) throw new Error(`“${label}”是数据源，不能再接入上游节点`);
    if (node.type !== 'input' && !inCount) throw new Error(`“${label}”缺少上游连接`);
    if (node.type === 'output' && outCount) throw new Error(`“${label}”是最终输出，不能再连接下游节点`);
    if (node.type !== 'output' && !outCount) throw new Error(`“${label}”缺少下游连接`);
  }
  const pending = new Map(flow.nodes.map(node => [node.id, inbound.get(node.id)!.length]));
  const queue = flow.nodes.filter(node => !inbound.get(node.id)!.length).map(node => node.id);
  let settled = 0;
  while (queue.length) {
    const id = queue.shift()!; settled++;
    for (const next of outbound.get(id)!) {
      const left = pending.get(next)! - 1;
      pending.set(next, left);
      if (!left) queue.push(next);
    }
  }
  if (settled !== flow.nodes.length) throw new Error('流程存在循环连接，请检查连线');
  /** All simple paths from one node to another, capped because two already mean a diamond. */
  const paths = (from: string, to: string) => {
    const found: string[][] = [];
    const walk = (id: string, path: string[], seen: Set<string>) => {
      if (found.length > 1) return;
      if (id === to) { found.push(path); return; }
      for (const next of outbound.get(id)!) {
        if (seen.has(next)) continue;
        walk(next, [...path, next], new Set([...seen, next]));
      }
    };
    walk(from, [from], new Set([from]));
    return found;
  };
  const branches: FlowBranch[] = [];
  for (const output of flow.nodes.filter(node => node.type === 'output')) {
    const ancestors = new Set<string>();
    const collect = (id: string) => { for (const parent of inbound.get(id)!) if (!ancestors.has(parent)) { ancestors.add(parent); collect(parent); } };
    collect(output.id);
    const routes: FlowRoute[] = [];
    for (const input of flow.nodes.filter(node => ancestors.has(node.id) && node.type === 'input')) {
      const found = paths(input.id, output.id);
      if (found.length > 1) throw new Error(`“${labels.get(input.id)}”到“${labels.get(output.id)}”之间分叉后又汇合，同一批记录会被处理两次，请拆分成不同输出或删除多余连接`);
      if (!found.length) continue;
      const chain = found[0]!.map(id => nodeById.get(id)!);
      const types = new Map<string, string>();
      for (const node of chain) {
        const previous = types.get(node.type);
        if (previous) throw new Error(`“${labels.get(output.id)}”的“${labels.get(input.id)}”路线重复出现“${labels.get(previous)}”和“${labels.get(node.id)}”节点，请拆分成不同路线`);
        types.set(node.type, node.id);
      }
      routes.push({
        inputId: input.id,
        tableId: String(input.config.tableId || ''),
        ontologyId: String(chain.find(node => node.type === 'ontology')?.config.ontologyId || ''),
        properties: chain.find(node => node.type === 'properties')?.config ?? null,
        strategy: String(chain.find(node => node.type === 'fusion')?.config.strategy || 'keep'),
        nodeIds: chain.map(node => node.id),
      });
    }
    if (!routes.length) throw new Error(`“${labels.get(output.id)}”没有连接到“实体表输入”，无法确定数据来源`);
    const nodeIds: string[] = [];
    for (const node of flow.nodes) if (node.id === output.id || routes.some(route => route.nodeIds.includes(node.id))) nodeIds.push(node.id);
    branches.push({ id: output.id, name: labels.get(output.id)!, nodeIds, routes });
  }
  const tableOntology = new Map<string, { name: string; inputId: string }>();
  for (const branch of branches) {
    for (const route of branch.routes) {
      if (!route.tableId || !route.ontologyId) continue;
      const key = `${route.tableId}\u0000${route.ontologyId}`;
      const previous = tableOntology.get(key);
      if (previous) throw new Error(`“${previous.name}”和“${labels.get(route.inputId)}”使用同一张实体表和同一个本体，会重复写入同一批实体，请改为不同本体或删除重复支路`);
      tableOntology.set(key, { name: labels.get(route.inputId)!, inputId: route.inputId });
    }
  }
  return branches;
}

export function validateFlow(flow: Flow) {
  resolveBranches(flow);
  return flow;
}

function storedValues(raw: string, datatype: string) {
  if (!raw) return [];
  try { const value = JSON.parse(raw); return Array.isArray(value) ? value : [datatype === 'string' && (typeof value !== 'object' || value === null) ? String(value ?? '') : value]; }
  catch { return datatype === 'wikibase-entityid' ? [] : [raw]; }
}

/** Shared display value when every entry agrees, otherwise null. */
function singleValue<T>(items: T[]): T | null {
  return items.length && items.every(item => item === items[0]) ? items[0]! : null;
}

function sharedOntology(routes: any[]) {
  const id = singleValue(routes.map(route => route.ontologyId));
  return id ? { id, name: routes[0].ontology.name } : null;
}

function describeRoute(route: any) {
  return {
    inputId: route.inputId, tableId: route.tableId, tableName: route.tableName,
    ontologyId: route.ontologyId, ontologyName: route.ontology.name,
    strategy: route.strategy, autoMapping: route.autoMapping, nodeIds: route.nodeIds, summary: route.summary,
  };
}

/** Old runs stored a flat plan; newer ones list one entry per knowledge-base output. */
export function planBranches(plan: any) {
  if (Array.isArray(plan.branches) && plan.branches.length) return plan.branches;
  const output = (plan.flow?.nodes || []).find((node: any) => node.type === 'output');
  return [{ id: output?.id || 'output', name: '知识库输出', summary: plan.summary, stages: plan.stages, changes: plan.changes, bindings: plan.bindings }];
}

export class CleaningEngine {
  constructor(private store: PipelineStore, private knowledge: Database, private user: KnowledgeUser) {}
  private snapshot() {
    const project = this.store.projectId;
    const nodes = this.knowledge.query('SELECT * FROM nodes WHERE project_id IS ? ORDER BY id').all(project) as any[];
    const attributes = this.knowledge.query('SELECT a.* FROM attributes a JOIN nodes n ON n.id = a.node_id WHERE n.project_id IS ? ORDER BY a.id').all(project) as any[];
    const sources = this.store.db.query('SELECT * FROM cleaning_entity_sources WHERE scope = ? ORDER BY source_key, source_id, ontology_id').all(String(project ?? 'app')) as any[];
    const ontologies = this.knowledge.query('SELECT * FROM ontologies WHERE project_id IS ? ORDER BY id').all(project) as any[];
    const properties = this.knowledge.query('SELECT * FROM properties WHERE project_id IS ? ORDER BY id').all(project) as any[];
    const links = this.knowledge.query('SELECT op.* FROM ontology_properties op JOIN ontologies o ON o.id = op.ontology_id WHERE o.project_id IS ? ORDER BY op.ontology_id, op.property_id').all(project);
    return { nodes, attributes, sources, ontologies, properties, links };
  }
  /** Runs every branch of the flow and aggregates their plans. */
  plan(flow: Flow, mode: 'preview' | 'full', decisions: Record<string, Decision> = {}) {
    const branches = resolveBranches(flow), multiple = branches.length > 1;
    const cloned = structuredClone(flow);
    const snapshot = this.snapshot(), fingerprint = new Bun.CryptoHasher('sha256').update(stable(snapshot)).digest('hex');
    const entities = new Map<string, Entity>();
    for (const n of snapshot.nodes) {
      let aliases: string[] = [];
      try { aliases = JSON.parse(n.aliases || '[]'); } catch { aliases = String(n.aliases || '').split(/[,，;\n]+/).map(v => v.trim()).filter(Boolean); }
      entities.set(n.id, { id: n.id, name: n.name || '', type: n.type, aliases: Array.isArray(aliases) ? aliases : [], description: n.description || '', tags: basicList(n.tags), categories: [], attributes: {}, original: n, fresh: false });
    }
    for (const a of snapshot.attributes) {
      const entity = entities.get(a.node_id);
      if (entity) entity.attributes[a.key] = unique([...(entity.attributes[a.key] || []), ...storedValues(a.value, a.datatype)]);
    }
    const sourceIndex = new Map(snapshot.sources.map(s => [stable([s.source_key, s.source_id, s.ontology_id]), s.node_id]));
    const results = branches.map(branch => this.runBranch(branch, cloned, { mode, snapshot, entities, sourceIndex, decisions, multiple }));
    const summary = { input: 0, aligned: 0, suspected: 0, unaligned: 0, created: 0, updated: 0, skipped: 0, attributesAdded: 0, conflicts: 0, failed: 0, unresolved: 0 };
    for (const result of results) for (const key of Object.keys(summary) as (keyof typeof summary)[]) summary[key] += result.summary[key];
    // Branches share one entity map, so an entity already written by an earlier branch is
    // counted once for the run summary even when several branches touch it.
    const union = new Map<string, Entity>();
    for (const result of results) for (const change of result.changes) union.set(change.id, change);
    const changes = [...union.values()];
    summary.created = changes.filter(n => n.fresh).length;
    summary.updated = changes.filter(n => !n.fresh).length;
    summary.attributesAdded = 0;
    for (const n of changes) for (const [pid, values] of Object.entries(n.attributes)) {
      if (values.length && !snapshot.attributes.some(a => a.node_id === n.id && a.key === pid)) summary.attributesAdded++;
    }
    const bindings: any[] = [], tokens = new Set<string>();
    for (const result of results) for (const binding of result.bindings) {
      const token = stable([binding.sourceKey, binding.sourceId, binding.ontologyId]);
      if (tokens.has(token)) continue;
      tokens.add(token); bindings.push(binding);
    }
    const first = results[0]!;
    const display = { tableId: first.routes[0]!.tableId, tableName: first.routes.map(route => route.tableName).join('、'), strategy: singleValue(first.routes.map(route => route.strategy)), ontology: sharedOntology(first.routes), routes: first.routes.map(route => describeRoute(route)) };
    const shared = { fingerprint, changes, bindings, tableId: first.routes[0]!.tableId, flow: cloned, decisions, confirmed: [] as string[] };
    // A single branch keeps the flat shape older runs and clients already understand.
    if (!multiple) return { ...shared, summary, rows: first.rows, stages: first.stages, ...display };
    return {
      ...shared, summary,
      branches: results.map(result => ({
        id: result.branch.id, name: result.branch.name, nodeIds: result.branch.nodeIds,
        tableId: result.routes[0]!.tableId, tableName: result.routes.map(route => route.tableName).join('、'),
        strategy: singleValue(result.routes.map(route => route.strategy)), ontology: sharedOntology(result.routes),
        autoMapping: result.routes.every(route => route.autoMapping),
        routes: result.routes.map(route => describeRoute(route)),
        summary: result.summary, stages: result.stages, rows: result.rows, changes: result.changes, bindings: result.bindings,
      })),
    };
  }
  /** Validates one route of a branch and resolves its table, ontology and field mapping. */
  private prepareRoute(branch: FlowBranch, route: FlowRoute, cloned: Flow, multiple: boolean) {
    const inputLabel = nodeLabels(cloned).get(route.inputId) || '实体表输入';
    const fail = (message: string): never => {
      const prefix = [multiple ? `支路「${branch.name}」` : '', branch.routes.length > 1 ? `路线「${inputLabel}」` : ''].filter(Boolean).join('');
      throw new Error(prefix ? `${prefix}：${message}` : message);
    };
    if (!route.tableId) fail('请选择二维实体表');
    if (!route.ontologyId) fail('请选择目标本体');
    if (!['keep', 'replace', 'merge'].includes(route.strategy)) fail('融合策略无效');
    if (route.properties && (typeof route.properties.mapping !== 'object' || Array.isArray(route.properties.mapping))) fail('请配置基础字段和属性映射');
    const table = this.store.getTable(route.tableId);
    const basicConfig: Record<string, any> = inferBasicFields(table.columns, route.properties || {});
    const ontologyId = route.ontologyId, { idField, nameField, mapping } = basicConfig;
    const language = String(basicConfig.language || 'zh');
    // Persist the inferred mapping so reopening the run shows the configuration that ran.
    const propertiesNode = cloned.nodes.find(node => route.nodeIds.includes(node.id) && node.type === 'properties');
    if (propertiesNode) propertiesNode.config = basicConfig;
    if ((idField && !table.columns.includes(idField)) || !table.columns.includes(nameField)) fail('名称字段不存在，或已选择的唯一标识字段不存在');
    const baseColumns = BASIC_FIELDS.map(f => basicConfig[f.key]).filter(Boolean);
    // Legacy flows can intentionally use their name as the source identifier.
    const distinctColumns = BASIC_FIELDS.filter(f => f.key !== 'idField' || idField !== nameField).map(f => basicConfig[f.key]).filter(Boolean);
    if (baseColumns.some(c => !table.columns.includes(c)) || new Set(distinctColumns).size !== distinctColumns.length) fail('基础字段必须选择存在且不重复的来源列（唯一标识可与名称共用）');
    if (typeof mapping !== 'object' || Array.isArray(mapping)) fail('属性映射无效');
    return { branch, route, table, tableName: table.name, basicConfig, ontologyId, idField, nameField, mapping, language, baseColumns, strategy: route.strategy, autoMapping: !route.properties, chainTypes: route.nodeIds.map(id => cloned.nodes.find(node => node.id === id)!.type), inputId: route.inputId, nodeIds: route.nodeIds, fail };
  }
  /** Runs every route of one branch and merges their rows into a single plan. */
  private runBranch(branch: FlowBranch, cloned: Flow, context: { mode: 'preview' | 'full'; snapshot: { nodes: any[]; attributes: any[]; sources: any[]; ontologies: any[] }; entities: Map<string, Entity>; sourceIndex: Map<string, string>; decisions: Record<string, Decision>; multiple: boolean }) {
    const { entities, snapshot } = context;
    const items = branch.routes.map(route => this.prepareRoute(branch, route, cloned, context.multiple));
    // Entities already touched by an earlier branch stay part of this branch's start state.
    const initial = new Map([...entities].map(([id, n]) => [id, stable(n)]));
    const summary = { input: 0, aligned: 0, suspected: 0, unaligned: 0, created: 0, updated: 0, skipped: 0, attributesAdded: 0, conflicts: 0, failed: 0, unresolved: 0 };
    const rows: any[] = [], stages: any[] = [], bindings: any[] = [], routes: any[] = [];
    for (const item of items) {
      const result = this.runRoute(item, context, rows.length);
      for (const key of Object.keys(summary) as (keyof typeof summary)[]) summary[key] += result.summary[key];
      routes.push(result);
      rows.push(...result.rows);
      stages.push(...result.stages);
      bindings.push(...result.bindings);
    }
    // Only entities this branch actually touched: statuses written by earlier branches are
    // already part of the branch-start snapshot and must not be counted again here.
    const changes = [...entities.values()].filter(n => stable(n) !== initial.get(n.id)).map(n => structuredClone(n));
    summary.created = changes.filter(n => n.fresh && !initial.has(n.id)).length;
    summary.updated = changes.length - summary.created;
    summary.attributesAdded = 0;
    for (const n of changes) for (const [pid, values] of Object.entries(n.attributes)) {
      if (values.length && !snapshot.attributes.some(a => a.node_id === n.id && a.key === pid)) summary.attributesAdded++;
    }
    return { branch, routes, summary, rows, stages, changes, bindings };
  }
  /** Executes the row loop of one route against the shared knowledge snapshot. */
  private runRoute(item: ReturnType<CleaningEngine['prepareRoute']>, context: { mode: 'preview' | 'full'; snapshot: { nodes: any[]; attributes: any[]; sources: any[]; ontologies: any[] }; entities: Map<string, Entity>; sourceIndex: Map<string, string>; decisions: Record<string, Decision>; multiple: boolean }, offset: number) {
    const { branch, table, basicConfig, ontologyId, idField, nameField, mapping, language, baseColumns, strategy, autoMapping, chainTypes, fail } = item;
    const { mode, snapshot, entities, sourceIndex, decisions, multiple } = context;
    const ontology = snapshot.ontologies.find(o => o.id === ontologyId);
    if (!ontology) fail('目标本体不属于当前应用');
    const properties = loadOntologyProperties(this.knowledge, ontologyId, this.store.projectId, true);
    const propertyMap = new Map(properties.map(p => [p.id, p]));
    // Without a 属性对齐 node the mapping is inferred and unlisted columns are ignored.
    if (!autoMapping) {
      for (const field of table.columns) {
        if (baseColumns.includes(field)) continue;
        if (!Object.hasOwn(mapping, field)) fail(`字段 ${field} 尚未映射，请选择属性或忽略`);
      }
    }
    for (const [field, property] of Object.entries(mapping)) {
      if (baseColumns.includes(field) && property) fail(`字段 ${field} 已映射为基础字段，不能重复映射到属性`);
      if (!table.columns.includes(field) || (property !== '' && !propertyMap.has(property))) fail(`字段 ${field} 的属性不属于目标本体`);
    }
    const routeInitial = new Map([...entities].map(([id, n]) => [id, stable(n)]));
    const bindings: any[] = [], rows: any[] = [];
    const summary = { input: mode === 'preview' ? Math.min(100, table.rows.length) : table.rows.length, aligned: 0, suspected: 0, unaligned: 0, created: 0, updated: 0, skipped: 0, attributesAdded: 0, conflicts: 0, failed: 0, unresolved: 0 };
    let currentRow = 0;
    let createdInRow: string[] = [];
    const create = (name: string, type: string) => {
      const id = 'clean-' + new Bun.CryptoHasher('sha256').update(stable([table.id, currentRow, type, name])).digest('hex').slice(0, 32);
      const planned = entities.get(id);
      if (planned) {
        // Another branch already planned this exact entity from the same table: reuse it.
        if (planned.fresh && planned.type === type && planned.name === name) return planned;
        throw new Error('拟新增实体 ID 已存在，请重新录入实体表');
      }
      const n: Entity = { id, name, type, aliases: [], description: '', tags: [], categories: [], attributes: {}, fresh: true };
      createdInRow.push(id);
      entities.set(n.id, n); return n;
    };
    const typedValue = (raw: any, p: any): any => {
      const datatype = normalizeDatatype(p.datatype, p.valuetype);
      if (valueTypeFor(datatype) === 'wikibase-entityid') {
        const id = typeof raw === 'object' ? String(raw?.id || '').replace(/^entity\//, '') : String(raw).replace(/^https?:\/\/www.wikidata.org\/entity\//, '').replace(/^entity\//, '');
        let target = entities.get(id);
        if (!target) {
          const name = typeof raw === 'object' ? raw.label || raw.name : String(raw).trim();
          if (!name) throw new Error(`属性 ${p.name} 的实体引用无效`);
          if (!p.tail_ontology_id || !snapshot.ontologies.some(o => o.id === p.tail_ontology_id)) throw new Error(`属性 ${p.name} 的值“${name}”不是已有实体 ID，请先配置尾实体本体`);
          const matches = [...entities.values()].filter(n => n.type === p.tail_ontology_id && n.name === name);
          if (matches.length > 1) throw new Error(`属性 ${p.name} 存在同名尾实体，请使用明确的实体 ID`);
          target = matches[0] || create(name, p.tail_ontology_id);
        }
        if (p.tail_ontology_id && target.type !== p.tail_ontology_id) throw new Error(`属性 ${p.name} 的实体类型不匹配`);
        return normalizeValue(datatype, { id: target.id, label: target.name });
      }
      if (datatype === 'time' && typeof raw !== 'object') return parseTimeValue(String(raw));
      if (datatype === 'quantity' && typeof raw !== 'object') return normalizeValue(datatype, { amount: String(raw), unit: '1' });
      if (datatype === 'monolingualtext' && typeof raw !== 'object') return normalizeValue(datatype, { text: String(raw), language: 'zh' });
      return normalizeValue(datatype, valueTypeFor(datatype) === 'string' ? typeof raw === 'object' ? JSON.stringify(raw) : String(raw) : raw);
    };
    for (let index = 0; index < summary.input; index++) {
      const raw = table.rows[index]!, sourceId = idField ? String(raw[idField] ?? '').trim() : '';
      let name = '';
      const detail: any = { index: offset + index, raw, tableName: table.name, ontology: { id: ontology.id, name: ontology.name }, basic: {}, mapped: {}, status: '未对齐', candidates: [], action: '', strategy, conflicts: [], error: '' };
      // A bad row must not leave planned tail entities or partial attribute mutations.
      currentRow = index; createdInRow = [];
      let targetBefore: Entity | undefined;
      try {
        if (idField && raw[idField] !== null && typeof raw[idField] === 'object') throw new Error('唯一标识必须是单个文本或数值');
        name = basicText(raw[nameField], language);
        detail.basic = { id: sourceId, name };
        if (basicConfig.aliasesField) detail.basic.aliases = configuredList(raw[basicConfig.aliasesField], language, basicConfig.mappingOptions?.aliasesField);
        if (basicConfig.descriptionField) detail.basic.description = basicText(raw[basicConfig.descriptionField], language);
        if (basicConfig.tagsField) detail.basic.tags = normalizeEntityTaxonomy({ tags: configuredList(raw[basicConfig.tagsField], language, basicConfig.mappingOptions?.tagsField) }).tags;
        if (basicConfig.categoriesField) detail.basic.categories = configuredList(raw[basicConfig.categoriesField], language, { ...basicConfig.mappingOptions?.categoriesField, defaultMulti: false, defaultSeparator: ' ' });
        if (!name) throw new Error('实体名称不能为空');
        const sourceToken = sourceId ? stable([table.sourceKey, sourceId, ontologyId]) : '';
        const alignedId = sourceToken ? sourceIndex.get(sourceToken) : undefined;
        let target = alignedId ? entities.get(alignedId) : undefined;
        if (alignedId && !target) throw new Error('来源对应实体已不可访问，请检查知识权限');
        const candidates = target ? [] : [...entities.values()].filter(n => n.name === name && n.type === ontologyId);
        detail.status = target ? '已对齐' : candidates.length ? '疑似对齐' : '未对齐';
        detail.candidates = candidates.map(n => ({ id: n.id, name: n.name }));
        if (target) summary.aligned++; else if (candidates.length) summary.suspected++; else summary.unaligned++;
        const decision = decisions[`${branch.id}:${offset + index}`] ?? (multiple ? undefined : decisions[String(index)]);
        if (decision && !['skip', 'new', 'link'].includes(decision.action)) throw new Error('对齐决策无效');
        if (decision?.action === 'skip') { detail.action = '跳过'; summary.skipped++; rows.push(detail); continue; }
        // Auto-align: for suspected alignment, automatically link to the first candidate
        if (!target && candidates.length && !decision) {
          target = candidates[0];
          detail.action = '自动关联';
          detail.autoAligned = true;
        }
        // Auto-create: for unaligned entities, automatically create new entity
        else if (!target && !candidates.length && !decision) {
          target = create(name, ontologyId);
          detail.action = '自动创建';
          detail.autoCreated = true;
        }
        else if (!target && candidates.length) {
          if (!decision) { detail.action = '待确认'; summary.unresolved++; rows.push(detail); continue; }
          if (decision.action === 'link') {
            target = candidates.find(n => n.id === decision.entityId);
            if (!target) throw new Error('请选择候选列表中的实体');
          }
        } else if (!target && decision?.action === 'link') throw new Error('该行没有可关联的候选实体');
        if (target && !target.fresh && !canAccessKnowledge(this.store.db, this.user, target.id, 'edit')) throw new Error('没有匹配实体的维护权限');
        // Resolve and validate every incoming value before mutating the target.
        for (const [field, pid] of Object.entries(mapping)) {
          if (!pid || empty(raw[field])) continue;
          const p = propertyMap.get(pid)!;
          const option = basicConfig.mappingOptions?.[field] || {};
          const values = Array.isArray(raw[field]) ? raw[field] : configuredList(raw[field], language, { ...option, defaultMulti: false, defaultSeparator: ' ' });
          detail.mapped[String(pid)] = unique([...(detail.mapped[String(pid)] || []), ...values.filter((v: any) => !empty(v)).map((v: any) => typedValue(v, p))]);
        }
        target ||= create(name, ontologyId);
        targetBefore = structuredClone(target);
        detail.action = target.fresh && !sourceIndex.has(sourceToken) ? '新增' : '更新';
        detail.match = { id: target.id, name: target.name };
        if (detail.basic.aliases) target.aliases = [...new Set([...target.aliases, ...detail.basic.aliases])].filter(alias => alias !== target!.name);
        if (detail.basic.tags) target.tags = normalizeEntityTaxonomy({ tags: [...target.tags, ...detail.basic.tags] }).tags;
        if (detail.basic.categories) target.categories = [...new Set([...target.categories, ...detail.basic.categories])];
        const description = detail.basic.description;
        if (description) {
          const old = target.description;
          const merged = mergeValues(old ? old.split('\n') : [], description.split('\n'), strategy);
          if (!old || (merged.conflict && strategy === 'replace')) target.description = description;
          else if (merged.conflict && strategy === 'merge') target.description = merged.values.join('\n');
          if (merged.conflict) detail.conflicts.push({ property: 'description', old, incoming: description, result: target.description });
        }
        if (target.name !== name) {
          if (!target.aliases.includes(name)) target.aliases.push(name);
          detail.conflicts.push({ property: 'name', old: target.name, incoming: name, result: target.name, resolution: '保留原名称，新名称加入别名' });
        }
        for (const [pid, values] of Object.entries(detail.mapped)) {
          const p = propertyMap.get(pid)!;
          const old = (target.attributes[pid] || []).map(v => {
            try { return typedValue(v, p); } catch { return v; }
          });
          const merged = mergeValues(old, values as any[], strategy);
          if (merged.conflict) detail.conflicts.push({ property: pid, old, incoming: values, result: merged.values });
          target.attributes[pid] = merged.values;
        }
        summary.conflicts += detail.conflicts.length;
        sourceIndex.set(sourceToken, target.id);
        if (sourceId) bindings.push({ sourceKey: table.sourceKey, sourceId, ontologyId, nodeId: target.id });
      } catch (error) {
        if (targetBefore) entities.set(targetBefore.id, targetBefore);
        for (const id of createdInRow) entities.delete(id);
        detail.error = (error as Error).message; detail.action = '失败'; summary.failed++;
      }
      rows.push(detail);
    }
    // Only entities this route touched: entities planned by an earlier route of the same branch
    // are part of this route's start state and must not be counted again here.
    const touched = [...entities.values()].filter(n => stable(n) !== routeInitial.get(n.id));
    summary.created = touched.filter(n => n.fresh && !routeInitial.has(n.id)).length;
    summary.updated = touched.length - summary.created;
    for (const n of touched) for (const [pid, values] of Object.entries(n.attributes)) {
      if (values.length && !snapshot.attributes.some(a => a.node_id === n.id && a.key === pid)) summary.attributesAdded++;
    }
    const route = branch.routes.length > 1 ? table.name : '';
    const stages = chainTypes.map(type => ({ type, route, input: summary.input, output: type === 'alignment' ? summary.aligned + summary.unaligned : summary.input - summary.failed, summary: type === 'input' ? `${table.name} · ${table.columns.length} 个字段` : type === 'ontology' ? ontology.name : type === 'properties' ? `${baseColumns.length} 个基础字段 / ${Object.values(mapping).filter(Boolean).length} 个属性映射` : type === 'alignment' ? `确定 ${summary.aligned} / 疑似 ${summary.suspected} / 未对齐 ${summary.unaligned}` : type === 'fusion' ? `${summary.conflicts} 个冲突 · ${strategy}` : `新增 ${summary.created} / 更新 ${summary.updated} / 待确认 ${summary.unresolved}` }));
    return { branch, route: item.route, table, tableId: table.id, tableName: table.name, ontologyId, ontology, autoMapping, inputId: item.inputId, nodeIds: item.nodeIds, strategy, summary, rows, stages, bindings };
  }

  /** Writes the requested branches (default: all pending ones) into the knowledge base. */
  confirm(runId: string, branchIds?: string[]) {
    return this.store.db.transaction(() => {
      const run = this.store.getRun(runId);
      if (run.status === 'completed') return run;
      if (run.mode !== 'full' || run.status !== 'pending') throw new Error('只能确认待执行的全量运行');
      const plan = run.result, branches = planBranches(plan) as any[];
      const confirmed: string[] = Array.isArray(plan.confirmed) ? [...plan.confirmed] : [];
      const requested = branchIds?.length ? branchIds : branches.map(branch => branch.id);
      const targets = requested.map((id: string) => branches.find(branch => branch.id === id));
      if (targets.some(branch => !branch)) throw new Error('支路不存在或已删除，请重新运行');
      const pending = targets.filter((branch: any) => !confirmed.includes(branch.id));
      // Branches share one entity map, so each branch already contains the values of the
      // branches before it. Writing them in plan order keeps every confirm monotonic.
      for (const branch of pending) {
        const blocking = branches.slice(0, branches.findIndex(item => item.id === branch.id)).find(item => !confirmed.includes(item.id));
        if (blocking) throw new Error(`请先确认写入“${blocking.name}”，再确认“${branch.name}”`);
      }
      for (const branch of pending) if (branch.summary.unresolved) throw new Error(`${branches.length > 1 ? `支路「${branch.name}」：` : ''}请先处理所有疑似对齐记录并重新生成全量预览`);
      if (new Bun.CryptoHasher('sha256').update(stable(this.snapshot())).digest('hex') !== plan.fingerprint) throw new Error('知识库已变化，请重新运行并确认最新结果');
      const changes = new Map<string, Entity>(), bindings: any[] = [];
      for (const branch of pending) {
        for (const entity of (branch.changes || []) as Entity[]) changes.set(entity.id, entity);
        for (const b of branch.bindings || []) bindings.push(b);
      }
      for (const entity of changes.values()) {
        if (entity.fresh) {
          // A later branch can confirm an entity that an earlier branch already inserted.
          this.knowledge.run('INSERT INTO nodes (id, name, type, aliases, description, tags, project_id) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, aliases=excluded.aliases, description=excluded.description, tags=excluded.tags, updated_at=CURRENT_TIMESTAMP, updated_by_user_id=?', [entity.id, entity.name, entity.type, JSON.stringify(entity.aliases), entity.description ?? '', JSON.stringify(entity.tags ?? []), this.store.projectId, this.user.id]);
        } else {
          if (!canAccessKnowledge(this.store.db, this.user, entity.id, 'edit')) throw new Error('知识维护权限已变化，请重新运行');
          this.knowledge.run('UPDATE nodes SET aliases = ?, description = ?, tags = ?, updated_at = CURRENT_TIMESTAMP, updated_by_user_id = ? WHERE id = ?', [JSON.stringify(entity.aliases), entity.description ?? entity.original?.description ?? '', JSON.stringify(entity.tags ?? basicList(entity.original?.tags)), this.user.id, entity.id]);
        }
      }
      for (const entity of changes.values()) {
        for (const [pid, values] of Object.entries(entity.attributes)) {
          const property = this.knowledge.query('SELECT * FROM properties WHERE id = ? AND project_id IS ?').get(pid, this.store.projectId) as any;
          if (!property || !values.length) continue;
          const existing = this.knowledge.query('SELECT * FROM attributes WHERE node_id = ? AND key = ? ORDER BY id').all(entity.id, pid) as any[];
          const previousValues = unique(existing.flatMap(a => storedValues(a.value, a.datatype)));
          if (stable(previousValues) === stable(values)) continue;
          const preservesOld = previousValues.every(old => values.some(value => key(value) === key(old)));
          const additions = values.filter(value => !previousValues.some(old => key(value) === key(old)));
          // Keep independently annotated statements when the fusion retains their values.
          // Only an explicit value replacement may remove superseded attribute rows.
          if (existing.length > 1 && preservesOld && !additions.length) continue;
          const writeValues = existing.length > 1 && preservesOld ? unique([...storedValues(existing[0].value, existing[0].datatype), ...additions]) : values;
          const datatype = normalizeDatatype(property.datatype, property.valuetype), storageType = uiDatatype(datatype);
          let previousStatement = {};
          try { previousStatement = JSON.parse(existing[0]?.statement_json || '{}'); } catch {}
          const statement = normalizeStatement({ property: pid, datatype, snaktype: 'value', value: writeValues.length === 1 ? writeValues[0] : writeValues }, previousStatement);
          const serialized = storageType === 'string' && writeValues.length === 1 ? String(writeValues[0]) : JSON.stringify(writeValues.length === 1 ? writeValues[0] : writeValues);
          if (existing.length) {
            this.knowledge.run('UPDATE attributes SET value = ?, datatype = ?, property_name_snapshot = ?, statement_json = ? WHERE id = ?', [serialized, storageType, property.name, JSON.stringify(statement), existing[0].id]);
            if (!preservesOld) for (const extra of existing.slice(1)) this.knowledge.run('DELETE FROM attributes WHERE id = ?', [extra.id]);
          } else this.knowledge.run('INSERT INTO attributes (id, node_id, key, value, datatype, property_name_snapshot, statement_json) VALUES (?, ?, ?, ?, ?, ?, ?)', [`attr/${crypto.randomUUID()}`, entity.id, pid, serialized, storageType, property.name, JSON.stringify(statement)]);
        }
      }
      const classRows = this.knowledge.query('SELECT id, name, parent_id FROM classes WHERE project_id IS ?').all(this.store.projectId) as any[];
      const classByName = new Map<string, string>();
      for (const entity of changes.values()) {
        for (const categoryName of entity.categories) {
          let category = classRows.find(row => row.name === categoryName && !row.parent_id);
        if (!category) {
          category = { id: `class/${crypto.randomUUID()}` };
          this.knowledge.run(
            'INSERT INTO classes (id, name, description, parent_id, project_id, color, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [category.id, categoryName, '', null, this.store.projectId, null, null],
          );
          classRows.push({ id: category.id, name: categoryName, parent_id: null });
        }
        classByName.set(categoryName, category.id);
        this.knowledge.run('INSERT OR IGNORE INTO entity_classes (entity_id, class_id) VALUES (?, ?)', [entity.id, category.id]);
        }
      }
      for (const b of bindings) this.store.db.run('INSERT INTO cleaning_entity_sources (scope, source_key, source_id, ontology_id, node_id) VALUES (?, ?, ?, ?, ?) ON CONFLICT(scope, source_key, source_id, ontology_id) DO UPDATE SET node_id=excluded.node_id', [String(this.store.projectId ?? 'app'), b.sourceKey, b.sourceId, b.ontologyId, b.nodeId]);
      plan.confirmed = [...confirmed, ...pending.map(branch => branch.id)];
      // The writes above are part of the knowledge base now, so re-base the staleness
      // fingerprint to keep the remaining branches of this run confirmable.
      if (plan.confirmed.length < branches.length) plan.fingerprint = new Bun.CryptoHasher('sha256').update(stable(this.snapshot())).digest('hex');
      const persisted = JSON.stringify(withoutRowDetails(plan));
      if (plan.confirmed.length >= branches.length) this.store.db.run("UPDATE cleaning_runs SET status = 'completed', result_json = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?", [persisted, runId]);
      else this.store.db.run('UPDATE cleaning_runs SET result_json = ? WHERE id = ?', [persisted, runId]);
      const updated = this.store.getRun(runId);
      // Row details are transient, but the caller is still displaying them.
      updated.result = { ...plan, ...updated.result, rows: plan.rows };
      if (Array.isArray(plan.branches) && Array.isArray(updated.result.branches)) updated.result.branches = updated.result.branches.map((branch: any, index: number) => ({ ...branch, rows: plan.branches[index]?.rows }));
      return updated;
    }).immediate();
  }
}
