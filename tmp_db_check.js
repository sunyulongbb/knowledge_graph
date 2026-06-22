import { Database } from "bun:sqlite";
import { writeFileSync } from "fs";
try {
  const db = new Database("C:/Users/Administrator/Desktop/data/app.sqlite");
  const row = db.query("SELECT COUNT(*) AS count FROM nodes WHERE type IS NULL OR trim(type) = ''").get(...[]);
  const rows = db.query("SELECT id, name, type FROM nodes WHERE type IS NULL OR trim(type) = '' LIMIT 20").all(...[]);
  writeFileSync("tmp_db_check.out.txt", JSON.stringify({row, rows}, null, 2));
} catch (e) {
  writeFileSync("tmp_db_check.out.txt", JSON.stringify({error: String(e), stack: e.stack}, null, 2));
}
