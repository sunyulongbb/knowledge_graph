export type EntityTaxonomyInput = {
  typeId?: unknown;
  type?: unknown;
  categoryIds?: unknown;
  categories?: unknown;
  tags?: unknown;
};

export type NormalizedEntityTaxonomy = {
  hasType: boolean;
  typeId: string | null;
  hasCategories: boolean;
  categoryIds: string[];
  hasTags: boolean;
  tags: string[];
};

function cleanId(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new TypeError("typeId 必须是字符串或 null");
  return value.trim() || null;
}

function cleanList(value: unknown, field: string, max: number): string[] {
  if (!Array.isArray(value)) throw new TypeError(`${field} 必须是数组`);
  if (value.length > max) throw new RangeError(`${field} 最多允许 ${max} 项`);
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "string") throw new TypeError(`${field} 只能包含字符串`);
    const item = raw.trim();
    if (!item) continue;
    const key = item.toLocaleLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

export function normalizeEntityTaxonomy(input: EntityTaxonomyInput): NormalizedEntityTaxonomy {
  const hasType = Object.prototype.hasOwnProperty.call(input, "typeId") ||
    Object.prototype.hasOwnProperty.call(input, "type");
  const hasCategories = Object.prototype.hasOwnProperty.call(input, "categoryIds") ||
    Object.prototype.hasOwnProperty.call(input, "categories");
  const hasTags = Object.prototype.hasOwnProperty.call(input, "tags");
  return {
    hasType,
    typeId: hasType ? cleanId(input.typeId !== undefined ? input.typeId : input.type) : null,
    hasCategories,
    categoryIds: hasCategories
      ? cleanList(input.categoryIds !== undefined ? input.categoryIds : input.categories, "categoryIds", 100)
      : [],
    hasTags,
    tags: hasTags ? cleanList(input.tags, "tags", 100) : [],
  };
}
