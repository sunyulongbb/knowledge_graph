import type { Database } from 'bun:sqlite';
import { normalizeDatatype, normalizeValue, normalizeStatement, parseTimeValue, uiDatatype, valueTypeFor } from '../../shared/wikidata.ts';
import { loadOntologyProperties } from '../ontology-properties.ts';
import { canAccessKnowledge, type KnowledgeUser } from '../knowledge-access.ts';
import { NODE_TYPES, PipelineStore, type EntityTable, type Flow } from './store.ts';
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
export function validateFlow(flow: Flow) {
  if (flow.nodes.length !== 6 || new Set(flow.nodes.map(n => n.type)).size !== 6 || !NODE_TYPES.every(t => flow.nodes.some(n => n.type === t))) throw new Error('请添加实体表输入、本体对齐、属性对齐、实体对齐、知识融合和知识库输出六个节点');
  const ordered = NODE_TYPES.map(t => flow.nodes.find(n => n.type === t)!);
  if (flow.edges.length !== 5 || !ordered.slice(1).every((n, i) => flow.edges.filter(e => e.from === ordered[i]!.id && e.to === n.id).length === 1)) throw new Error('请按输入 → 本体 → 属性 → 实体 → 融合 → 输出完整连接，不支持循环和分支');
  const config = Object.fromEntries(ordered.map(n => [n.type, n.config]));
  if (!config.input!.tableId) throw new Error('请选择二维实体表');
  if (!config.ontology!.ontologyId) throw new Error('请选择目标本体');
  if (!config.properties!.mapping) throw new Error('请配置基础字段和属性映射');
  if (!['keep', 'replace', 'merge'].includes(config.fusion!.strategy)) throw new Error('请选择默认融合策略');
  return config;
}

function storedValues(raw: string, datatype: string) {
  if (!raw) return [];
  try { const value = JSON.parse(raw); return Array.isArray(value) ? value : [datatype === 'string' && (typeof value !== 'object' || value === null) ? String(value ?? '') : value]; }
  catch { return datatype === 'wikibase-entityid' ? [] : [raw]; }
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
  plan(flow: Flow, mode: 'preview' | 'full', decisions: Record<string, Decision> = {}) {
    const config = validateFlow(flow), table = this.store.getTable(String(config.input!.tableId));
    const basicConfig: Record<string, any> = inferBasicFields(table.columns, config.properties!);
    const ontologyId = String(config.ontology!.ontologyId), { idField, nameField, mapping } = basicConfig;
    const language = String(basicConfig.language || 'zh');
    flow = structuredClone(flow);
    flow.nodes.find(n => n.type === 'properties')!.config = basicConfig;
    if ((idField && !table.columns.includes(idField)) || !table.columns.includes(nameField)) throw new Error('名称字段不存在，或已选择的唯一标识字段不存在');
    const baseColumns = BASIC_FIELDS.map(f => basicConfig[f.key]).filter(Boolean);
    // Legacy flows can intentionally use their name as the source identifier.
    const distinctColumns = BASIC_FIELDS.filter(f => f.key !== 'idField' || idField !== nameField).map(f => basicConfig[f.key]).filter(Boolean);
    if (baseColumns.some(c => !table.columns.includes(c)) || new Set(distinctColumns).size !== distinctColumns.length) throw new Error('基础字段必须选择存在且不重复的来源列（唯一标识可与名称共用）');
    if (typeof mapping !== 'object' || Array.isArray(mapping)) throw new Error('属性映射无效');
    const snapshot = this.snapshot(), fingerprint = new Bun.CryptoHasher('sha256').update(stable(snapshot)).digest('hex');
    const ontology = snapshot.ontologies.find(o => o.id === ontologyId);
    if (!ontology) throw new Error('目标本体不属于当前应用');
    const properties = loadOntologyProperties(this.knowledge, ontologyId, this.store.projectId, true);
    const propertyMap = new Map(properties.map(p => [p.id, p]));
    for (const field of table.columns) {
      if (baseColumns.includes(field)) continue;
      if (!Object.hasOwn(mapping, field)) throw new Error(`字段 ${field} 尚未映射，请选择属性或忽略`);
    }
    for (const [field, property] of Object.entries(mapping)) {
      if (baseColumns.includes(field) && property) throw new Error(`字段 ${field} 已映射为基础字段，不能重复映射到属性`);
      if (!table.columns.includes(field) || (property !== '' && !propertyMap.has(property))) throw new Error(`字段 ${field} 的属性不属于目标本体`);
    }
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
    const initial = new Map([...entities].map(([id, n]) => [id, stable(n)]));
    const sourceIndex = new Map(snapshot.sources.map(s => [stable([s.source_key, s.source_id, s.ontology_id]), s.node_id]));
    const bindings: any[] = [], rows: any[] = [];
    const summary = { input: mode === 'preview' ? Math.min(100, table.rows.length) : table.rows.length, aligned: 0, suspected: 0, unaligned: 0, created: 0, updated: 0, skipped: 0, attributesAdded: 0, conflicts: 0, failed: 0, unresolved: 0 };
    const strategy = String(config.fusion!.strategy);
    let currentRow = 0;
    let createdInRow: string[] = [];
    const create = (name: string, type: string) => {
      const id = 'clean-' + new Bun.CryptoHasher('sha256').update(stable([table.id, currentRow, type, name])).digest('hex').slice(0, 32);
      if (entities.has(id)) throw new Error('拟新增实体 ID 已存在，请重新录入实体表');
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
      const detail: any = { index, raw, ontology: { id: ontology.id, name: ontology.name }, basic: {}, mapped: {}, status: '未对齐', candidates: [], action: '', strategy, conflicts: [], error: '' };
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
        const decision = decisions[String(index)];
        if (decision && !['skip', 'new', 'link'].includes(decision.action)) throw new Error('对齐决策无效');
        if (decision?.action === 'skip') { detail.action = '跳过'; summary.skipped++; rows.push(detail); continue; }
        if (!target && candidates.length) {
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
    const changes = [...entities.values()].filter(n => n.fresh || stable(n) !== initial.get(n.id));
    summary.created = changes.filter(n => n.fresh).length;
    summary.updated = changes.filter(n => !n.fresh).length;
    for (const n of changes) for (const [pid, values] of Object.entries(n.attributes)) {
      if (values.length && !snapshot.attributes.some(a => a.node_id === n.id && a.key === pid)) summary.attributesAdded++;
    }
    const stages = NODE_TYPES.map(type => ({ type, input: summary.input, output: type === 'alignment' ? summary.aligned + summary.unaligned : summary.input - summary.failed, summary: type === 'input' ? `${table.name} · ${table.columns.length} 个字段` : type === 'ontology' ? ontology.name : type === 'properties' ? `${baseColumns.length} 个基础字段 / ${Object.values(mapping).filter(Boolean).length} 个属性映射` : type === 'alignment' ? `确定 ${summary.aligned} / 疑似 ${summary.suspected} / 未对齐 ${summary.unaligned}` : type === 'fusion' ? `${summary.conflicts} 个冲突 · ${strategy}` : `新增 ${summary.created} / 更新 ${summary.updated} / 待确认 ${summary.unresolved}` }));
    return { summary, rows, stages, fingerprint, changes, bindings, tableId: table.id, flow, decisions };
  }

  confirm(runId: string) {
    return this.store.db.transaction(() => {
      const run = this.store.getRun(runId);
      if (run.status === 'completed') return run;
      if (run.mode !== 'full' || run.status !== 'pending') throw new Error('只能确认待执行的全量运行');
      const plan = run.result;
      if (plan.summary.unresolved) throw new Error('请先处理所有疑似对齐记录并重新生成全量预览');
      if (new Bun.CryptoHasher('sha256').update(stable(this.snapshot())).digest('hex') !== plan.fingerprint) throw new Error('知识库已变化，请重新运行并确认最新结果');
      for (const entity of plan.changes as Entity[]) {
        if (entity.fresh) {
          this.knowledge.run('INSERT INTO nodes (id, name, type, aliases, description, tags, project_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [entity.id, entity.name, entity.type, JSON.stringify(entity.aliases), entity.description ?? '', JSON.stringify(entity.tags ?? []), this.store.projectId]);
        } else {
          if (!canAccessKnowledge(this.store.db, this.user, entity.id, 'edit')) throw new Error('知识维护权限已变化，请重新运行');
          this.knowledge.run('UPDATE nodes SET aliases = ?, description = ?, tags = ?, updated_at = CURRENT_TIMESTAMP, updated_by_user_id = ? WHERE id = ?', [JSON.stringify(entity.aliases), entity.description ?? entity.original?.description ?? '', JSON.stringify(entity.tags ?? basicList(entity.original?.tags)), this.user.id, entity.id]);
        }
      }
      for (const entity of plan.changes as Entity[]) {
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
      for (const entity of plan.changes as Entity[]) {
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
      for (const b of plan.bindings) this.store.db.run('INSERT INTO cleaning_entity_sources (scope, source_key, source_id, ontology_id, node_id) VALUES (?, ?, ?, ?, ?) ON CONFLICT(scope, source_key, source_id, ontology_id) DO UPDATE SET node_id=excluded.node_id', [String(this.store.projectId ?? 'app'), b.sourceKey, b.sourceId, b.ontologyId, b.nodeId]);
      this.store.db.run("UPDATE cleaning_runs SET status = 'completed', finished_at = CURRENT_TIMESTAMP WHERE id = ?", [runId]);
      return this.store.getRun(runId);
    }).immediate();
  }
}
