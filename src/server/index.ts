import { switchDatabase, adminDb } from "./db.ts";
import { createApplicationHandler } from './application-access.ts';
import { handleCoreKbRoutes } from "./routes/core-kb.ts";
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
import { getCurrentUser } from './auth-context.ts';
import { knowledgeContext } from './knowledge-access.ts';
import { guardKnowledgeRequest, handleKnowledgeAccessRoutes } from './routes/knowledge-access.ts';

const port = parseInt(process.env.PORT || "8080");
const handleApplications = createApplicationHandler(adminDb, getCurrentUser);

const server = Bun.serve({
  port: port,
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
      if (dbParam && !skipSwitch.includes(url.pathname)) {
        try {
          switchDatabase(`${dbParam}.sqlite`);
        } catch (e) {
          // ignore if file not found
        }
      }

      const requestUrl = url;
      const response = await knowledgeContext.run({ user: getCurrentUser(req) }, async () => {
      const url = requestUrl;
      const applicationResponse = await handleApplications(req, url, method);
      if (applicationResponse) return applicationResponse;
      const guardResponse = await guardKnowledgeRequest(req, url, method);
      if (guardResponse) return guardResponse;
      const accessResponse = await handleKnowledgeAccessRoutes(req, url, method);
      if (accessResponse) return accessResponse;
      const projectRes = await handleProjectRoutes(req, url, method);
      if (projectRes) return projectRes;

      const authRes = await handleAuthRoutes(req, url, method);
      if (authRes) return authRes;

      const interactionRes = await handleInteractionRoutes(req, url, method);
      if (interactionRes) return interactionRes;
      const systemAdminRes = await handleSystemAdminRoutes(req, url, method);
      if (systemAdminRes) return systemAdminRes;

      const chatRes = await handleChatRoutes(req, url, method);
      if (chatRes) return chatRes;

      const semanticMapRes = await handleSemanticMapRoutes(req, url, method);
      if (semanticMapRes) return semanticMapRes;

      const sparqlRes = await handleSparqlRoutes(req, url, method);
      if (sparqlRes) return sparqlRes;

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

console.log(`Listening on http://localhost:${server.port} ...`);
