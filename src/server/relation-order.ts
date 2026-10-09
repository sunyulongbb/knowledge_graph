import type { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import { canAccessKnowledge, knowledgeId, type KnowledgeUser } from './knowledge-access.ts';

type IncomingOrder = { groups: string[]; items: Record<string, string[]>; children: Record<string, string[]> };
type Order = { properties: string[]; values: Record<string, string[]>; snapshots: Record<string, string[]>; incoming?: IncomingOrder };

const INCOMING_ORDER_LIMITS = { groups: 200, entries: 500, keyLength: 120 };

export function relationPropertyKey(value: unknown) {
  const raw = String(value ?? '').trim().split('/').pop()!.toUpperCase();
  const numeric = raw.match(/^(?:P\s*)?0*(\d+)$/);
  if (numeric) return String(Number(numeric[1]));
  const digits = raw.match(/(\d+)/);
  return digits ? `P${Number(digits[1])}` : raw;
}
export function relationValues(value: any): any[] {
  if (typeof value === 'string') { try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed; } catch {} }
  return Array.isArray(value) ? value : [value];
}
function reconcile(saved: unknown, current: string[]) {
  const live = new Set(current);
  return [...new Set([...(Array.isArray(saved) ? saved.filter((id) => typeof id === 'string' && live.has(id)) : []), ...current])];
}
export function resolveRelationOrder(items: any[], stored: unknown): Order {
  let saved: any = stored;
  if (typeof stored === 'string') { try { saved = JSON.parse(stored); } catch { saved = {}; } }
  const groups = new Map<string, string[]>();
  const snapshots: Record<string, string[]> = Object.create(null);
  const remap = new Map<string, string>();
  for (const item of items) {
    const key = relationPropertyKey(item.property ?? item.key);
    if (!groups.has(key)) groups.set(key, []);
    const values = relationValues(item.value);
    const signatures = values.map((value) => createHash('sha256').update(JSON.stringify(value) ?? 'null').digest('hex'));
    snapshots[item.id] = signatures;
    const previous = saved?.snapshots?.[item.id];
    if (Array.isArray(previous)) {
      const unused = new Set(signatures.map((_, index) => index));
      previous.forEach((signature, index) => {
        const next = [...unused].find((candidate) => signatures[candidate] === signature);
        if (next !== undefined) { remap.set(`${item.id}::${index}`, `${item.id}::${next}`); unused.delete(next); }
      });
      // Editing a value in place should keep its position too.
      if (previous.length === signatures.length) previous.forEach((_, index) => {
        if (!remap.has(`${item.id}::${index}`) && unused.size) {
          const next = unused.has(index) ? index : unused.values().next().value!;
          remap.set(`${item.id}::${index}`, `${item.id}::${next}`); unused.delete(next);
        }
      });
    }
    values.forEach((_, index) => groups.get(key)!.push(`${item.id}::${index}`));
  }
  const properties = reconcile(saved?.properties, [...groups.keys()].sort());
  const values = Object.fromEntries(properties.map((key) => {
    const previous = saved?.values?.[key];
    const refs = Array.isArray(previous) ? previous.map((ref: any) => {
      if (typeof ref !== 'string') return null;
      const attributeId = ref.slice(0, ref.lastIndexOf('::'));
      return Array.isArray(saved?.snapshots?.[attributeId]) ? remap.get(ref) : ref;
    }) : [];
    return [key, reconcile(refs, groups.get(key)!)];
  }));
  return { properties, values, snapshots };
}
export function orderedRelationItems(items: any[], stored: unknown) {
  const order = resolveRelationOrder(items, stored);
  return rankRelationItems(items, order);
}
function rankRelationItems(items: any[], order: Order) {
  const propertyRanks = new Map(order.properties.map((key, index) => [key, index]));
  const valueRanks = new Map(Object.values(order.values).flatMap((ids) => ids.map((id, index) => [id, index] as const)));
  return items.map((item) => ({ ...item,
    property_order: propertyRanks.get(relationPropertyKey(item.property ?? item.key)),
    value_order: relationValues(item.value).map((_, index) => valueRanks.get(`${item.id}::${index}`)),
  })).sort((a, b) => a.property_order! - b.property_order! || Math.min(...a.value_order as number[]) - Math.min(...b.value_order as number[]));
}
export function relationAttributeResponse(items: any[], stored: unknown) {
  const order = resolveRelationOrder(items, stored);
  return { items: rankRelationItems(items, order), row_order: order.properties.flatMap((key) => order.values[key]!) };
}

function cleanOrderKeys(value: unknown, limit = INCOMING_ORDER_LIMITS.entries) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const key = entry.trim();
    if (!key || key.length > INCOMING_ORDER_LIMITS.keyLength || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
    if (keys.length >= limit) break;
  }
  return keys;
}

/**
 * 详情页「关联信息」的顺序：分组顺序 + 每个分组内条目的顺序 + 每个条目下二级关联的顺序。
 * 条目由客户端按当前数据生成，读取时对不上的键会被忽略，
 * 因此删掉的知识不会让顺序失效，新知识则按默认排序追加在末尾。
 */
export function normalizeIncomingOrder(raw: unknown): IncomingOrder {
  const source = raw && typeof raw === 'object' ? (raw as any) : {};
  const groups = cleanOrderKeys(source.groups, INCOMING_ORDER_LIMITS.groups);
  const collect = (value: unknown) => {
    const out: Record<string, string[]> = {};
    const record: Record<string, unknown> =
      value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    for (const rawKey of Object.keys(record).slice(0, INCOMING_ORDER_LIMITS.groups)) {
      const key = String(rawKey).trim();
      if (!key || key.length > INCOMING_ORDER_LIMITS.keyLength) continue;
      const entries = cleanOrderKeys(record[rawKey]);
      if (entries.length) out[key] = entries;
    }
    return out;
  };
  return { groups, items: collect(source.items), children: collect(source.children) };
}

function saveIncomingOrder(
  db: Database,
  user: KnowledgeUser,
  id: string,
  body: any,
  error: (message: string, status?: number) => Response,
) {
  const incoming = normalizeIncomingOrder(body?.incoming);
  const empty = !incoming.groups.length && !Object.keys(incoming.items).length && !Object.keys(incoming.children).length;
  if (empty) return error('排序数据无效');
  return db.transaction(() => {
    const node = db.query('SELECT relation_order FROM nodes WHERE id=?').get(id) as any;
    if (!node) return error('知识不存在', 404);
    let stored: any = {};
    try { stored = JSON.parse(node.relation_order || '{}'); } catch { stored = {}; }
    if (!stored || typeof stored !== 'object') stored = {};
    const next = { ...stored, incoming };
    db.run('UPDATE nodes SET relation_order=?, updated_by_user_id=? WHERE id=?', [JSON.stringify(next), user.id, id]);
    return Response.json({ success: true, relation_order: next });
  })();
}
export function saveRelationOrder(db: Database, user: KnowledgeUser | null, body: any, format: (row: any) => any = (row) => row) {
  const error = (message: string, status = 400) => Response.json({ error: message }, { status });
  if (!user) return error('请先登录', 401);
  const id = knowledgeId(body?.id);
  if (!canAccessKnowledge(db, user, id, 'edit')) return error('无权调整此知识的关系顺序', 403);
  if (body?.kind === 'incoming') return saveIncomingOrder(db, user, id, body, error);
  if (!['property', 'value'].includes(body?.kind) || !['before', 'after'].includes(body?.placement) || typeof body.source !== 'string' || typeof body.target !== 'string') return error('排序参数无效');
  return db.transaction(() => {
    const node = db.query('SELECT relation_order FROM nodes WHERE id=?').get(id) as any;
    const items = db.query('SELECT * FROM attributes WHERE node_id=? OR node_id=?').all(id, `entity/${id}`).map(format);
    const order = resolveRelationOrder(items, node.relation_order);
    const key = order.properties.find((key) => order.values[key]!.includes(body.source));
    const sequence = body.kind === 'property' ? order.properties : key !== undefined ? order.values[key] : undefined;
    if (!sequence?.includes(body.source) || !sequence.includes(body.target)) return error('属性或属性值已变化，请刷新后重试；属性值只能在同一属性内排序', 409);
    if (body.source !== body.target) {
      sequence.splice(sequence.indexOf(body.source), 1);
      sequence.splice(sequence.indexOf(body.target) + (body.placement === 'after' ? 1 : 0), 0, body.source);
    }
    db.run('UPDATE nodes SET relation_order=?, updated_by_user_id=? WHERE id=?', [JSON.stringify(order), user.id, id]);
    return Response.json({ success: true, relation_order: order });
  })();
}
