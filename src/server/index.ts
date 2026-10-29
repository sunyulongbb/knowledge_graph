import { EnterpriseKnowledgeSearch } from './enterprise-search.ts';
import { createSqliteKnowledgeSync } from './sqlite-knowledge-sync.ts';
import { EnterpriseSqliteBackup } from './enterprise-sqlite-backup.ts';
import { createGraphCanvasHandler } from './graph-canvases.ts';
import { enterpriseKnowledgeEnabled } from './knowledge-mode.ts';
import { EnterpriseKnowledgeStore, ArangoElasticsearchSync } from './enterprise-knowledge.ts';
import { ElasticsearchClient, ensureApplicationDatabase } from './arangodb.ts';
import { createEnterpriseKnowledgeHandler } from './routes/enterprise-knowledge.ts';
import { applicationPermissions } from './application-access.ts';
import { networkInterfaces } from "node:os";
import { switchDatabase, adminDb, hashPassword, getProjectByIdentifier } from "./db.ts";
import { ensureInitialAdminAccount } from "./initial-admin.ts";
import { arangoUserDatabaseGrants, initializeArangoKnowledgeSync, syncArangoNativeUser } from "./arangodb.ts";
import { createApplicationHandler } from './application-access.ts';
import { createUserProfileHandler } from './user-profile.ts';
import { handleCoreKbRoutes } from "./routes/core-kb.ts";
import { handleReportRoutes } from "./routes/reports.ts";
import { handleAuthRoutes } from "./routes/auth.ts";
import { handleProjectRoutes } from "./routes/projects.ts";
import { handleSchemaRoutes } from "./routes/schema.ts";
import { serveStaticRoute } from "./static.ts";
import { handleWikiRoutes } from "./routes/wiki.ts";
import { handleChatRoutes } from "./routes/chat.ts";
import { handleSemanticMapRoutes } from "./routes/semantic-map.ts";
import { handleSparqlRoutes } from "./routes/sparql.ts";
import { handleInteractionRoutes } from "./routes/interactions.ts";
import { handleSystemAdminRoutes } from "./routes/system-admin.ts";
import { handlePipelineRoutes } from './routes/pipeline.ts';
import { getCurrentUser, getKnowledgeUser } from './auth-context.ts';
import { knowledgeContext } from './knowledge-access.ts';
import { guardKnowledgeRequest, handleKnowledgeAccessRoutes } from './routes/knowledge-access.ts';
import { handleJevRoutes } from './routes/jev.ts';

const port = parseInt(process.env.PORT || "8080");
const hostname = process.env.HOST?.trim() || "0.0.0.0";
const initialAdmin = await ensureInitialAdminAccount(adminDb, hashPassword);
// Legacy SQLite -> graph mirroring must be explicitly enabled. In Enterprise,
// ArangoDB contains authoritative knowledge and must never be rebuilt at startup.
if (process.env.KNOWLEDGE_LEGACY_SQLITE_SYNC === "true" && !enterpriseKnowledgeEnabled()) {
  await initializeArangoKnowledgeSync(adminDb);
}
if (initialAdmin) {
  console.log("\n============================================================");
  console.log("首次运行：已自动创建系统管理员账号");
  console.log(`管理员账号: ${initialAdmin.username}`);
  console.log(`管理员密码: ${initialAdmin.password}`);
  console.log("请登录后立即修改密码，并妥善保存该凭据。");
  console.log("此密码只会在本次创建时显示。\n============================================================\n");
  const adminUser = adminDb.query("SELECT id, display_name FROM users WHERE username=?").get(initialAdmin.username) as any;
  if (adminUser) {
    await syncArangoNativeUser(initialAdmin.username, initialAdmin.password, {
      id: Number(adminUser.id),
      displayName: String(adminUser.display_name || initialAdmin.username),
      role: "admin",
      active: true,
    }, arangoUserDatabaseGrants(adminDb, Number(adminUser.id), "admin", true));
  }
}
const handleGraphCanvases = createGraphCanvasHandler(adminDb, getKnowledgeUser, getProjectByIdentifier);
const handleUserProfile = createUserProfileHandler(adminDb, getCurrentUser);

console.log(`[Knowledge storage] ${enterpriseKnowledgeEnabled() ? 'arangodb (Enterprise)' : 'sqlite (Lite)'}`);
const enterpriseStore = enterpriseKnowledgeEnabled() ? EnterpriseKnowledgeStore.configured() : null;
const enterpriseBackup = enterpriseStore ? new EnterpriseSqliteBackup(adminDb, enterpriseStore) : undefined;
enterpriseBackup?.start(async () => (adminDb.query('SELECT name FROM projects ORDER BY id').all() as { name: string }[]).map(project => project.name));
const handleApplications = createApplicationHandler(adminDb, getCurrentUser, {
  provisionKnowledge: enterpriseStore ? name => ensureApplicationDatabase(enterpriseStore.client, name) : undefined,
});
const enterpriseSync = enterpriseStore && process.env.ELASTICSEARCH_URL?.trim()
  ? new ArangoElasticsearchSync(enterpriseStore, new ElasticsearchClient({ url: process.env.ELASTICSEARCH_URL.trim().replace(/\/+$/, '') }))
  : undefined;
const handleEnterpriseKnowledge = enterpriseStore ? createEnterpriseKnowledgeHandler({
  store: enterpriseStore, sync: enterpriseSync,
  backup: enterpriseBackup,
  search: enterpriseSync ? new EnterpriseKnowledgeSearch(enterpriseStore, enterpriseSync.elasticsearch) : undefined,
  getUser: getKnowledgeUser, getProject: getProjectByIdentifier,
  canCreate: (user, project) => user.role === 'admin' || applicationPermissions(adminDb, user, project).member,
  listProjects: () => adminDb.query('SELECT id,name FROM projects ORDER BY id').all(),
  serveMedia: serveStaticRoute,
  getSchema: project => ({
    classes: adminDb.query('SELECT * FROM classes WHERE project_id=? ORDER BY COALESCE(sort_order,rowid),name').all(project.id),
    ontologies: adminDb.query('SELECT * FROM ontologies WHERE project_id=?').all(project.id),
    properties: adminDb.query('SELECT * FROM properties WHERE project_id=?').all(project.id),
    ontology_properties: adminDb.query('SELECT op.* FROM ontology_properties op JOIN ontologies o ON o.id=op.ontology_id WHERE o.project_id=?').all(project.id),
  }),
}) : null;
const handleSqliteKnowledgeSync = createSqliteKnowledgeSync({
  db: adminDb, getUser: getCurrentUser, getProject: getProjectByIdentifier,
  store: enterpriseStore, sync: enterpriseSync,
});
enterpriseSync?.start(async () => {
  const { body } = await enterpriseStore!.client.system('/_api/database');
  const existing = new Set<string>(body.result);
  return (adminDb.query('SELECT name FROM projects ORDER BY id').all() as { name: string }[])
    .map(project => project.name).filter(name => existing.has(name));
});

const server = Bun.serve({
  port: port,
  hostname,
  idleTimeout: 255,
  maxRequestBodySize: 5000 * 1024 * 1024,
  async fetch(req) {
    const method = req.method;
    let url: URL | null = null;

    try {
      const host = req.headers.get("host") || "localhost";
      url = new URL(req.url, `http://${host}`);
    } catch (e) {
      const safePath =
        typeof req.url === "string" ? req.url.split("?")[0] : String(req.url);
      console.warn(`${method} - ${safePath} failed to parse URL:`, e);
      return new Response("Bad Request", { status: 400 });
    }

    try {
      const dbParam = url.searchParams.get("db");
      const skipSwitch = ["/api/kb/list_projects", "/api/kb/create_project"];
      if (!enterpriseKnowledgeEnabled() && dbParam && !skipSwitch.includes(url.pathname)) {
        try {
          switchDatabase(`${dbParam}.sqlite`);
        } catch (e) {
          // ignore if file not found
        }
      }

      const requestUrl = url;
      const response = await knowledgeContext.run({ user: getKnowledgeUser(req) }, async () => {
      const url = requestUrl;
      const sqliteSyncResponse = await handleSqliteKnowledgeSync(req, url);
      if (sqliteSyncResponse) return sqliteSyncResponse;
      const enterpriseResponse = await handleEnterpriseKnowledge?.(req, url, method);
      if (enterpriseResponse) {
        enterpriseResponse.headers.set('X-Knowledge-Storage', 'arangodb');
        return enterpriseResponse;
      }
      const canvasResponse = await handleGraphCanvases(req, url);
      if (canvasResponse) return canvasResponse;
      const profileResponse = await handleUserProfile(req, url, method);
      if (profileResponse) return profileResponse;
      const applicationResponse = await handleApplications(req, url, method);
      if (applicationResponse) return applicationResponse;
      const guardResponse = await guardKnowledgeRequest(req, url, method);
      if (guardResponse) return guardResponse;
      const accessResponse = await handleKnowledgeAccessRoutes(req, url, method);
      if (accessResponse) return accessResponse;
      const jevResponse = await handleJevRoutes(req, url, method);
      if (jevResponse) return jevResponse;
      const projectRes = await handleProjectRoutes(req, url, method);
      if (projectRes) return projectRes;

      const authRes = await handleAuthRoutes(req, url, method);
      if (authRes) return authRes;

      const interactionRes = await handleInteractionRoutes(req, url, method);
      if (interactionRes) return interactionRes;
      const systemAdminRes = await handleSystemAdminRoutes(req, url, method);
      if (systemAdminRes) return systemAdminRes;
      const pipelineRes = await handlePipelineRoutes(req, url, method);
      if (pipelineRes) return pipelineRes;

      const chatRes = await handleChatRoutes(req, url, method);
      if (chatRes) return chatRes;

      const semanticMapRes = await handleSemanticMapRoutes(req, url, method);
      if (semanticMapRes) return semanticMapRes;

      const sparqlRes = await handleSparqlRoutes(req, url, method);
      if (sparqlRes) return sparqlRes;

      const reportRes = await handleReportRoutes(req, url, method);
      if (reportRes) return reportRes;

      const staticResponse = await serveStaticRoute(req, url.pathname);
      if (staticResponse) return staticResponse;

      const coreKbRes = await handleCoreKbRoutes(req, url, method);
      if (coreKbRes) return coreKbRes;

      const schemaRes = await handleSchemaRoutes(req, url, method);
      if (schemaRes) return schemaRes;

      const wikiRes = await handleWikiRoutes(req, url, method);
      if (wikiRes) return wikiRes;

      return new Response("Not Found", { status: 404 });
      });
      if (requestUrl.pathname.startsWith('/api/')) response.headers.set('Cache-Control', 'private, no-store');
      return response;
    } catch (e) {
      console.warn(
        `${method} - ${url && url.pathname ? url.pathname : "unknown"} failed`,
        e,
      );
      return new Response("Internal Server Error", { status: 500 });
    }
  },
});

console.log("Listening on " + hostname + ":" + server.port);
console.log("本机访问：http://localhost:" + server.port);
if (hostname === "0.0.0.0" || hostname === "::") {
  const addresses = new Set(Object.values(networkInterfaces()).flatMap((items) => (items || []).filter((item) => !item.internal && item.family === "IPv4").map((item) => item.address)));
  for (const address of addresses) console.log("局域网访问：http://" + address + ":" + server.port);
}
