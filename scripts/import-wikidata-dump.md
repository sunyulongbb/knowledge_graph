# Wikidata dump importer

Run from the repository root with Bun and Python 3 installed. Python uses only its standard-library bz2 decoder; no decompressed copy of the dump is created. Bun loads the repository .env as usual.

The script imports only Q items into the ArangoDB default application. It reads the default project ID from the existing application database. The default application must already exist. If its ArangoDB knowledge_schema is missing, the script initializes it from the existing default application definitions in SQLite, matching the server fallback. Existing ArangoDB definitions take priority and are preserved. It does not import Wikidata into SQLite.

Required environment variables:

- ARANGO_URL
- ARANGO_USERNAME
- ARANGO_PASSWORD

Preview without any database writes or checkpoint updates:

```powershell
bun scripts/import-wikidata-dump.ts --dry-run --max-items=100
```

Import a small batch for review:

```powershell
bun scripts/import-wikidata-dump.ts --max-items=1000
```

Continue importing the full dump:

```powershell
bun scripts/import-wikidata-dump.ts
```

Optional flags use --name=value syntax:

- --file=F:/latest-all.json.bz2
- --batch-size=100
- --max-items=1000 (additional items processed by this invocation)
- --checkpoint=data/wikidata-import.checkpoint.json
- --python=python (executable name or absolute executable path)

Checkpoint files are written atomically after both entity and link batches succeed. Restart with the same command and checkpoint to resume. bz2 resume still decompresses from the beginning and skips committed lines, so restarting late in this 102 GB compressed dump can take substantial time. Ctrl+C finishes the current write and commits buffered records. A failed batch leaves the preceding checkpoint intact. Source path, size and modification time must match. Do not run multiple writers using the same checkpoint.

Each source item gets a stable namespaced identifier (wikidata:Q42). Existing identifiers and links are ignored rather than overwritten, including when a failed batch is replayed. This is an initial-load importer, not a revision/update synchronizer. Relations to items not yet imported resolve as their target items arrive; limited previews can contain unresolved targets.

P31 assigns each item its extracted types (class/wikidata/Q...). P279 constructs the type hierarchy without an artificial root. Items without P31 have no inferred category or ontology. Deprecated claims and non-value snaks are excluded. Type names prefer Chinese, then English; unresolved types initially display their Q ID and are filled when their entity is read. Multiple P279 parents are preserved as wikidata_parent_ids; the UI tree uses one cycle-free parent.

Type updates and association repairs complete before a batch checkpoint is committed. Older checkpoints without typeExtractionVersion are rejected: replay from a new checkpoint to attach types to existing items without clearing data:

```powershell
bun scripts/import-wikidata-dump.ts --checkpoint=data/wikidata-types.checkpoint.json
```

Type definitions use the application's existing single knowledge_schema document. Very large numbers of distinct Wikidata classes may require a separate type collection before a complete world-scale import; the script fails rather than advancing its checkpoint if schema writes exceed backend limits.
 Labels, descriptions and aliases retain only English (en) and Chinese (zh and zh-* variants). Sitelinks retain zhwiki and enwiki only. Claims, qualifiers and references are passed through the application's existing edge converter. Non-item records such as P properties and lexemes are skipped; property IDs remain P identifiers rather than translated property names. Sitelinks and source revision are retained in entity data.

After an import, synchronize Elasticsearch if configured:

```powershell
bun scripts/sync-arango-to-es.ts --database=default
```

The importer does not automatically index Elasticsearch. Full-dump entity and edge storage is much larger than the compressed input; use --max-items to verify the result and measure storage growth before a full run.

## Ontology extraction

Type-tree categories (class/wikidata/Q...) and ontology definitions (ontology/wikidata/Q...) are stored separately. P31 assigns all extracted ontology IDs to entity data.wikidata_ontology_ids. Because the application's entity.type field is scalar, its first valid P31 becomes the primary ontology type. P279 supplies the same acyclic display hierarchy for ontologies, with all original parent IDs preserved. Artificial Wikidata roots are not created; top-level extracted types have a null parent.

Observed claim properties are registered by their P identifiers with normalized data/value types and associated with every P31 ontology of the subject. Existing property definitions are preserved. Property display names remain P IDs unless the application already has a matching definition; this importer skips standalone P records. Imported Q-type ontology names retain Chinese/English labels and are filled as their entities arrive.

Ontology extraction uses checkpoint version 2. For older runs, use a fresh checkpoint and replay; existing entity data is retained, and its type/category associations are repaired:

```powershell
bun scripts/import-wikidata-dump.ts --checkpoint=data/wikidata-ontologies.checkpoint.json
```

No import is started automatically when updating the script.
