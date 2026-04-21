import { resolve } from "path";

const PUBLIC_INDEX_FILE = Bun.file("public/index.html");
const DEMO_CHAT_FILE = Bun.file("demo/chat.html");
const SHARED_UPLOADS_DIR = resolve(
  import.meta.dir,
  "..",
  "..",
  "uploads",
);

export async function serveStaticRoute(req: Request, pathname: string) {
  const makeResponse = async (file: Bun.File) => {
    const headers = new Headers();
    const ext = pathname.split("?")[0].split('.').pop()?.toLowerCase() || "";
    const contentTypes: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      ico: "image/x-icon",
      js: "application/javascript",
      mjs: "application/javascript",
      css: "text/css",
      html: "text/html; charset=utf-8",
      json: "application/json",
      mp4: "video/mp4",
      webm: "video/webm",
      ogg: "video/ogg",
      mov: "video/quicktime",
      avi: "video/x-msvideo",
      mkv: "video/x-matroska",
      txt: "text/plain; charset=utf-8",
    };
    const contentType = contentTypes[ext] || "application/octet-stream";
    headers.set("Content-Type", contentType);
    headers.set("Accept-Ranges", "bytes");
    return new Response(file, { headers });
  };

  if (pathname === "/kb" || pathname === "/") {
    return new Response(PUBLIC_INDEX_FILE, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  if (pathname === "/demo/chat.html" || pathname === "/chat") {
    if (await DEMO_CHAT_FILE.exists()) {
      return new Response(DEMO_CHAT_FILE, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    return null;
  }

  if (pathname.startsWith("/static/")) {
    const sharedUploadPrefix = "/static/uploads/";
    if (pathname.startsWith(sharedUploadPrefix)) {
      const relativePath = pathname.slice(sharedUploadPrefix.length);
      const file = Bun.file(resolve(SHARED_UPLOADS_DIR, relativePath));
      if (await file.exists()) {
        return makeResponse(file);
      }
      return null;
    }

    const file = Bun.file(`.${pathname}`);
    if (await file.exists()) {
      return makeResponse(file);
    }
    return null;
  }

  if (pathname.startsWith("/assets/")) {
    const file = Bun.file(`public${pathname}`);
    if (await file.exists()) {
      return new Response(file);
    }
    return null;
  }

  if (pathname.startsWith("/js/")) {
    const file = Bun.file(`public${pathname}`);
    if (await file.exists()) {
      return new Response(file);
    }
    return null;
  }

  if (pathname.startsWith("/css/")) {
    const file = Bun.file(`public${pathname}`);
    if (await file.exists()) {
      return new Response(file);
    }
    return null;
  }

  return null;
}
