import { adminDb, switchDatabase } from "../db.ts";
import { existsSync, rmSync } from "fs";
import { resolve } from "path";

const APP_DB_FILENAME = "app.sqlite";

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

function normalizeTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return Array.from(
      new Set(
        raw
          .map((item) => String(item ?? "").trim())
          .filter(Boolean),
      ),
    );
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      return normalizeTags(JSON.parse(raw));
    } catch {
      return raw
        .split(/[\n,，;；、]+/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function normalizeProjectRecord(row: any) {
  if (!row) return null;
  const tags = normalizeTags(row.tags);
  return {
    id: row.id ?? null,
    slug: row.name,
    name: row.title || row.name,
    title: row.title || row.name,
    description: row.description || "",
    image: row.image || "",
    logo: row.image || "",
    theme_color: row.theme_color || "#ff7a2b",
    tags,
    link: row.link || "",
    file:
      !row.file || row.file === "shared.sqlite" ? APP_DB_FILENAME : row.file,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function toProjectPayload(body: any, fallbackName: string) {
  return {
    title: (body.title || fallbackName).toString().trim() || fallbackName,
    description: (body.description || "").toString().trim(),
    image: (body.image || body.logo || "").toString().trim(),
    theme_color: (body.theme_color || "#ff7a2b").toString().trim() || "#ff7a2b",
    tags: JSON.stringify(normalizeTags(body.tags)),
    link: (body.link || "").toString().trim(),
  };
}

export async function handleProjectRoutes(
  req: Request,
  url: URL,
  method: string,
) {
  if (url.pathname === "/api/kb/delete_project" && method === "POST") {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ success: false, message: "无效的请求体" }, { status: 400 });
    }

    try {
      const name = (body.name || "").toString().trim();
      const confirmName = (body.confirmName || "").toString().trim();
      if (!name) {
        return json({ success: false, message: "项目短名不能为空" }, { status: 400 });
      }

      const project = adminDb
        .query("SELECT id, name, title FROM projects WHERE name = ? LIMIT 1")
        .get(name) as any;
      if (!project?.id) {
        return json({ success: false, message: "项目不存在" }, { status: 404 });
      }

      const expectedTitle = (project.title || project.name || "").toString().trim();
      const normalizedConfirm = confirmName.toLowerCase();
      const normalizedName = String(project.name || "").toLowerCase();
      const normalizedTitle = expectedTitle.toLowerCase();
      if (
        !confirmName ||
        (normalizedConfirm !== normalizedName && normalizedConfirm !== normalizedTitle)
      ) {
        return json(
          {
            success: false,
            message: `请输入应用名称“${expectedTitle || project.name}”以确认删除`,
          },
          { status: 400 },
        );
      }

      const projectId = Number(project.id);
      const pickIds = (sql: string, params: any[]) =>
        (adminDb.query(sql).all(...params) as any[])
          .map((row) => String(row?.id || "").trim())
          .filter(Boolean);
      const quotePlaceholders = (arr: string[]) => arr.map(() => "?").join(",");

      const nodeIds = pickIds(
        "SELECT id FROM nodes WHERE project_id = ?",
        [projectId],
      );
      const classIds = pickIds(
        "SELECT id FROM classes WHERE project_id = ?",
        [projectId],
      );
      const propertyIds = pickIds(
        "SELECT id FROM properties WHERE project_id = ?",
        [projectId],
      );
      const ontologyIds = pickIds(
        "SELECT id FROM ontologies WHERE project_id = ?",
        [projectId],
      );

      adminDb.run("BEGIN");
      try {
        if (nodeIds.length) {
          const placeholders = quotePlaceholders(nodeIds);
          adminDb.run(
            `DELETE FROM attributes WHERE node_id IN (${placeholders}) OR REPLACE(node_id, 'entity/', '') IN (${placeholders})`,
            [...nodeIds, ...nodeIds],
          );
          adminDb.run(
            `DELETE FROM entity_classes WHERE entity_id IN (${placeholders}) OR REPLACE(entity_id, 'entity/', '') IN (${placeholders})`,
            [...nodeIds, ...nodeIds],
          );
        }

        adminDb.run("DELETE FROM nodes WHERE project_id = ?", [projectId]);

        if (ontologyIds.length) {
          const placeholders = quotePlaceholders(ontologyIds);
          adminDb.run(
            `DELETE FROM ontology_properties WHERE ontology_id IN (${placeholders})`,
            ontologyIds,
          );
        }

        if (classIds.length) {
          const placeholders = quotePlaceholders(classIds);
          adminDb.run(
            `DELETE FROM class_properties WHERE class_id IN (${placeholders})`,
            classIds,
          );
        }

        if (propertyIds.length) {
          const placeholders = quotePlaceholders(propertyIds);
          adminDb.run(
            `DELETE FROM ontology_properties WHERE property_id IN (${placeholders})`,
            propertyIds,
          );
          adminDb.run(
            `DELETE FROM class_properties WHERE property_id IN (${placeholders})`,
            propertyIds,
          );
          adminDb.run(
            `DELETE FROM property_properties WHERE parent_property_id IN (${placeholders}) OR child_property_id IN (${placeholders})`,
            [...propertyIds, ...propertyIds],
          );
        }

        adminDb.run("DELETE FROM ontologies WHERE project_id = ?", [projectId]);
        adminDb.run("DELETE FROM classes WHERE project_id = ?", [projectId]);
        adminDb.run("DELETE FROM properties WHERE project_id = ?", [projectId]);
        adminDb.run("DELETE FROM entry_tasks WHERE project_id = ?", [projectId]);
        adminDb.run("DELETE FROM projects WHERE id = ?", [projectId]);

        adminDb.run("COMMIT");
      } catch (txErr) {
        try {
          adminDb.run("ROLLBACK");
        } catch {}
        throw txErr;
      }

      const uploadDir = resolve(import.meta.dir, "..", "..", "..", "uploads", String(projectId));
      try {
        if (existsSync(uploadDir)) {
          rmSync(uploadDir, { recursive: true, force: true });
        }
      } catch {}

      return json({
        success: true,
        message: "项目及其知识数据已删除",
      });
    } catch (err) {
      console.error("delete project failed", err);
      return json({ success: false, message: "删除项目失败" }, { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/create_project") {
    if (method === "GET") {
      const name = url.searchParams.get("name")?.trim();
      if (!name) {
        return json({ success: false, message: "项目名称不能为空" }, { status: 400 });
      }
      if (!/^[\w\-]+$/.test(name)) {
        return json(
          { success: false, message: "项目短名仅支持字母、数字、下划线和短横线" },
          { status: 400 },
        );
      }

      switchDatabase(`${name}.sqlite`);


      let project = adminDb.query("SELECT * FROM projects WHERE name = ?").get(name) as any;
      if (!project) {
        adminDb.run(
          "INSERT INTO projects (name, file, title, description, theme_color, tags, link) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [name, APP_DB_FILENAME, name, "", "#ff7a2b", "[]", ""],
        );
        project = adminDb.query("SELECT * FROM projects WHERE name = ?").get(name) as any;
      }

      return json({
        success: true,
        message: "项目已创建并切换",
        project: normalizeProjectRecord(project),
      });
    }

    if (method === "POST") {
      try {
        const body: any = await req.json();
        const name = (body.name || "").toString().trim();
        if (!name) {
          return json({ success: false, message: "项目短名不能为空" }, { status: 400 });
        }
        if (!/^[\w\-]+$/.test(name)) {
          return json(
            { success: false, message: "项目短名仅支持字母、数字、下划线和短横线" },
            { status: 400 },
          );
        }

        switchDatabase(`${name}.sqlite`);

        const payload = toProjectPayload(body, name);

        const exists = adminDb.query("SELECT 1 FROM projects WHERE name = ?").get(name);

        if (exists) {
          adminDb.run(
            `UPDATE projects SET title = ?, description = ?, image = ?, theme_color = ?, tags = ?, link = ?, file = '${APP_DB_FILENAME}', updated_at = CURRENT_TIMESTAMP WHERE name = ?`,
            [
              payload.title,
              payload.description,
              payload.image,
              payload.theme_color,
              payload.tags,
              payload.link,
              name,
            ],
          );
        } else {
          adminDb.run(
            "INSERT INTO projects (name, file, title, description, image, theme_color, tags, link) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
              name,
              APP_DB_FILENAME,
              payload.title,
              payload.description,
              payload.image,
              payload.theme_color,
              payload.tags,
              payload.link,
            ],
          );
        }

        const project = adminDb.query("SELECT * FROM projects WHERE name = ?").get(name) as any;
        return json({
          success: true,
          message: "项目已创建并切换",
          project: normalizeProjectRecord(project),
        });
      } catch {
        return json({ success: false, message: "无效的请求体" }, { status: 400 });
      }
    }

    return new Response("Method Not Allowed", { status: 405 });
  }

  if (url.pathname === "/api/kb/list_projects" && method === "GET") {
    try {
      const rows = adminDb
        .query(
          "SELECT id, name, file, title, description, image, theme_color, tags, link, created_at, updated_at FROM projects ORDER BY id DESC",
        )
        .all() as any[];

      const projects = rows
        .map(normalizeProjectRecord)
        .filter((item) => item && item.slug !== "shared");

      return json({ projects });
    } catch {
      return json({ projects: [] });
    }
  }

  if (url.pathname === "/api/kb/update_project" && method === "POST") {
    try {
      const body: any = await req.json();
      const name = (body.name || "").toString().trim();
      if (!name) {
        return json({ success: false, message: "项目短名不能为空" }, { status: 400 });
      }

      const exists = adminDb.query("SELECT 1 FROM projects WHERE name = ?").get(name);
      if (!exists) {
        return json({ success: false, message: "项目不存在" }, { status: 404 });
      }

      const payload = toProjectPayload(body, name);
      adminDb.run(
        `UPDATE projects SET title = ?, description = ?, image = ?, theme_color = ?, tags = ?, link = ?, file = '${APP_DB_FILENAME}', updated_at = CURRENT_TIMESTAMP WHERE name = ?`,
        [
          payload.title,
          payload.description,
          payload.image,
          payload.theme_color,
          payload.tags,
          payload.link,
          name,
        ],
      );

      const project = adminDb
        .query(
          "SELECT id, name, file, title, description, image, theme_color, tags, link, created_at, updated_at FROM projects WHERE name = ?",
        )
        .get(name) as any;

      return json({
        success: true,
        message: "保存成功",
        project: normalizeProjectRecord(project),
      });
    } catch {
      return json({ success: false, message: "无效的请求体" }, { status: 400 });
    }
  }

  return null;
}
