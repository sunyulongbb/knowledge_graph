# Knowledge Graph

This project now includes a semantic map / knowledge galaxy page built with Bun, SQLite, native HTML, and `deck.gl`. The map now reads the current application entity data from `nodes`, while `semantic_nodes` acts as the coordinate/index layer.

## Install

```bash
bun install
```

The `deck.gl` browser dependency has also been added to `package.json` and installed into `node_modules`.

## Start the Bun Server

```bash
bun run dev
```

Default address:

```text
http://localhost:8080
```

Main knowledge page:

```text
http://localhost:8080/
```

Semantic map page:

```text
http://localhost:8080/semantic-map.html
```

## SQLite Schema

On server startup, the app automatically ensures the `semantic_nodes` table and indexes exist. Current entity content still comes from `nodes`; `semantic_nodes` stores semantic coordinates and rendering metadata keyed by the same node id.

```sql
CREATE TABLE IF NOT EXISTS semantic_nodes (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  type TEXT,
  tags TEXT,
  description TEXT,
  x REAL,
  y REAL,
  size REAL DEFAULT 4,
  color TEXT,
  hot INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_semantic_nodes_xy ON semantic_nodes(x, y);
CREATE INDEX IF NOT EXISTS idx_semantic_nodes_type ON semantic_nodes(type);
CREATE INDEX IF NOT EXISTS idx_semantic_nodes_hot ON semantic_nodes(hot);
```

The application database is stored at:

```text
../data/app.sqlite
```

Relative to this repository, that resolves to the sibling `data` directory used by the existing Bun app.

## Semantic Map APIs

Implemented endpoints:

```text
GET /api/semantic-map/init
GET /api/semantic-map/viewport
GET /api/semantic-map/detail/:id
GET /api/semantic-map/search?q=keyword
```

Behavior summary:

- `/api/semantic-map/init`: load the initial hot nodes with non-null `x/y`.
- `/api/semantic-map/viewport`: load nodes in the current visible XY range.
- `/api/semantic-map/detail/:id`: fetch a single node detail record.
- `/api/semantic-map/search`: optional backend fuzzy search by `label`, `tags`, or `description`.

All endpoints return JSON and include permissive CORS headers for local development.

## Insert Test Data

If you want standalone sample coordinates for quick demo use, seed sample data with:

```bash
bun run seed:semantic
```

The seed script inserts 50 semantic nodes across:

- Person
- Organization
- Equipment
- Location
- Event
- Document
- Technology

Each record includes:

- `label`
- `type`
- `tags`
- `description`
- `x`
- `y`
- `size`
- `color`
- `hot`

## Generate Semantic Coordinates Offline

Coordinate generation script:

```text
scripts/generate-semantic-coordinates.py
```

Install Python dependencies:

```bash
pip install sentence-transformers umap-learn pandas
```

Run the script:

```bash
python scripts/generate-semantic-coordinates.py
```

What it does:

1. Syncs current `nodes` into `semantic_nodes`.
2. Reads `label`, `type`, `tags`, and `description` from `semantic_nodes`.
3. Generates embeddings with `paraphrase-multilingual-MiniLM-L12-v2`.
4. Reduces them to 2D with UMAP.
5. Writes `x` and `y` back into `semantic_nodes`.

UMAP settings:

```text
n_neighbors=50
min_dist=0.1
n_components=2
metric="cosine"
```

## Semantic Map Page Features

`/semantic-map.html` currently supports:

- full-screen WebGL scatter rendering via `deck.gl`
- `OrthographicView` for a true 2D semantic plane
- semantic content sourced from the current application `nodes`
- semantic coordinates read from `semantic_nodes`
- mouse wheel zoom
- drag pan
- node hover tooltip
- click-to-open detail panel
- local search over loaded nodes
- search result highlighting and first-result focus
- viewport-based incremental data loading
- client-side deduplication with `Map<string, Node>`

## Notes

- The semantic map does not use Cytoscape.js.
- Version one intentionally does not render relationship edges.
- `bunx tsc --noEmit` still reports several pre-existing type errors in older route files outside this feature, but the semantic map files added in this change are in place and wired into the Bun server.
