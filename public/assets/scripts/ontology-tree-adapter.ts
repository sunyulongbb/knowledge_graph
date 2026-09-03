export type OntologyRecord = {
  id: string;
  name?: string;
  label?: string;
  parent_id?: string | null;
  sort_order?: number | null;
  children?: OntologyRecord[];
  color?: string | null;
  readonly?: boolean;
  system?: boolean;
  node_type?: string;
  [key: string]: unknown;
};

export type OntologyTreeItem = {
  id: string;
  parent?: string;
  value: string;
  opened?: boolean;
  disabled?: boolean;
  items?: OntologyTreeItem[];
  data: {
    ontologyId: string;
    nodeType?: string;
    sortOrder?: number;
    readonly?: boolean;
    color?: string;
    source: OntologyRecord;
  };
};

export type OntologyMove = {
  id: string;
  parentId: string | null;
  sortOrder: number;
};

export function toOntologyTreeItems(
  nodes: OntologyRecord[],
  openedIds: ReadonlySet<string> = new Set(),
): OntologyTreeItem[] {
  return (nodes || []).map((node) => {
    const id = String(node.id || "").trim();
    if (!id) throw new Error("Ontology node is missing a stable id");
    const children = toOntologyTreeItems(node.children || [], openedIds);
    return {
      id,
      parent: node.parent_id || undefined,
      value: String(node.name || node.label || "未命名本体"),
      opened: openedIds.has(id),
      disabled: Boolean(node.readonly || node.system),
      items: children.length ? children : undefined,
      data: {
        ontologyId: id,
        nodeType: node.node_type,
        sortOrder: Number.isFinite(Number(node.sort_order))
          ? Number(node.sort_order)
          : undefined,
        readonly: Boolean(node.readonly || node.system),
        color: String(node.color || "#94a3b8"),
        source: node,
      },
    };
  });
}

export function flattenOntologyTree(
  nodes: OntologyRecord[],
  target: OntologyRecord[] = [],
): OntologyRecord[] {
  for (const node of nodes || []) {
    target.push(node);
    flattenOntologyTree(node.children || [], target);
  }
  return target;
}

export function isIllegalOntologyMove(
  id: string,
  parentId: string | null,
  records: readonly OntologyRecord[],
): boolean {
  if (!id || id === parentId) return true;
  const byParent = new Map<string, string[]>();
  for (const item of records) {
    const parent = String(item.parent_id || "");
    const children = byParent.get(parent) || [];
    children.push(item.id);
    byParent.set(parent, children);
  }
  const descendants = new Set<string>();
  const queue = [...(byParent.get(id) || [])];
  while (queue.length) {
    const child = queue.shift()!;
    if (descendants.has(child)) continue;
    descendants.add(child);
    queue.push(...(byParent.get(child) || []));
  }
  return parentId !== null && descendants.has(parentId);
}

export function createOntologyMovePayload(
  movedId: string,
  parentId: string | null,
  siblingIds: readonly string[],
): OntologyMove[] {
  const orderedIds = siblingIds.includes(movedId)
    ? [...siblingIds]
    : [...siblingIds, movedId];
  return orderedIds.map((id, index) => ({
    id,
    parentId,
    sortOrder: index + 1,
  }));
}
