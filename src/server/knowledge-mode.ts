/** Explicit mode wins; existing Arango deployments default to Enterprise. */
export function enterpriseKnowledgeEnabled(env: Record<string, string | undefined> = process.env) {
  const backend = env.KNOWLEDGE_STORAGE_BACKEND?.trim().toLowerCase();
  if (backend && !['sqlite', 'arangodb'].includes(backend)) {
    throw new Error('KNOWLEDGE_STORAGE_BACKEND must be sqlite or arangodb');
  }
  return backend ? backend === 'arangodb' : Boolean(env.ARANGO_URL?.trim());
}
