import type { OntologyMove, OntologyRecord } from "./ontology-tree-adapter";

export type OntologyTreeResponse = { items: OntologyRecord[]; flat?: OntologyRecord[] };

function scopedUrl(path: string): URL {
  const url = new URL(path, window.location.origin);
  const append = (window as typeof window & {
    appendCurrentDbParam?: (url: URL) => URL;
  }).appendCurrentDbParam;
  return typeof append === "function" ? append(url) : url;
}

async function requestJson<T>(url: URL, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const message = (await response.text()).trim();
    throw new Error(message || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function loadOntologyTree(): Promise<OntologyTreeResponse> {
  return requestJson<OntologyTreeResponse>(scopedUrl("/api/kb/ontology/tree"));
}

export function moveOntology(movedId: string, items: OntologyMove[]): Promise<{ ok: boolean }> {
  return requestJson(scopedUrl("/api/kb/ontologies/move"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      moved_id: movedId,
      items: items.map((item) => ({
        id: item.id,
        parent_id: item.parentId,
        sort_order: item.sortOrder,
      })),
    }),
  });
}
