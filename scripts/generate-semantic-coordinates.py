import sqlite3
from pathlib import Path

import pandas as pd
import umap
from sentence_transformers import SentenceTransformer


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT.parent / "data" / "app.sqlite"
MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"


def build_text(row: sqlite3.Row) -> str:
    parts = [
        row["label"] or "",
        row["type"] or "",
        row["tags"] or "",
        row["description"] or "",
    ]
    return " ".join(str(part).strip() for part in parts if str(part).strip())


def sync_nodes_to_semantic_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        INSERT OR IGNORE INTO semantic_nodes (
            id, label, type, tags, description, created_at, updated_at
        )
        SELECT
            id,
            COALESCE(NULLIF(TRIM(name), ''), id),
            type,
            tags,
            description,
            created_at,
            updated_at
        FROM nodes
        """
    )
    conn.execute(
        """
        UPDATE semantic_nodes
        SET
            label = COALESCE(
                (SELECT COALESCE(NULLIF(TRIM(name), ''), id) FROM nodes WHERE nodes.id = semantic_nodes.id LIMIT 1),
                label
            ),
            type = COALESCE(
                (SELECT type FROM nodes WHERE nodes.id = semantic_nodes.id LIMIT 1),
                type
            ),
            tags = COALESCE(
                (SELECT tags FROM nodes WHERE nodes.id = semantic_nodes.id LIMIT 1),
                tags
            ),
            description = COALESCE(
                (SELECT description FROM nodes WHERE nodes.id = semantic_nodes.id LIMIT 1),
                description
            ),
            updated_at = COALESCE(
                (SELECT updated_at FROM nodes WHERE nodes.id = semantic_nodes.id LIMIT 1),
                updated_at
            )
        WHERE id IN (SELECT id FROM nodes)
        """
    )
    conn.commit()


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        sync_nodes_to_semantic_table(conn)

        rows = conn.execute(
            """
            SELECT id, label, type, tags, description
            FROM semantic_nodes
            ORDER BY COALESCE(hot, 0) DESC, COALESCE(size, 4) DESC, label ASC
            """
        ).fetchall()
        if not rows:
            print("semantic_nodes is empty, nothing to process.")
            return

        df = pd.DataFrame([dict(row) for row in rows])
        texts = [build_text(row) for row in rows]

        model = SentenceTransformer(MODEL_NAME)
        embeddings = model.encode(
            texts,
            show_progress_bar=True,
            normalize_embeddings=True,
        )

        reducer = umap.UMAP(
            n_neighbors=50,
            min_dist=0.1,
            n_components=2,
            metric="cosine",
            random_state=42,
        )
        coords = reducer.fit_transform(embeddings)

        update_rows = [
          (float(coords[index][0]), float(coords[index][1]), df.iloc[index]["id"])
          for index in range(len(df))
        ]
        conn.executemany(
            """
            UPDATE semantic_nodes
            SET x = ?, y = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            update_rows,
        )
        conn.commit()
        print(f"Synced and updated {len(update_rows)} semantic_nodes coordinates in {DB_PATH}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
