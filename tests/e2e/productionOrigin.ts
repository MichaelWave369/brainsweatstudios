import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

// An isolated production origin lets a test remove the actual server without
// affecting other browser workers. It is not an application endpoint.
export async function productionOrigin() {
  const root = path.resolve("dist");
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
    if (!pathname.startsWith("/brainsweatstudios/")) {
      response.writeHead(404);
      response.end();
      return;
    }
    const file = path.resolve(
      root,
      decodeURIComponent(pathname.slice("/brainsweatstudios/".length)) ||
        "index.html",
    );
    if (!file.startsWith(`${root}/`)) {
      response.writeHead(404);
      response.end();
      return;
    }
    try {
      const bytes = await readFile(file);
      const mime: Record<string, string> = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".json": "application/json",
      };
      response.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      response.end(bytes);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No production origin port.");
  return {
    url: `http://127.0.0.1:${address.port}/brainsweatstudios/`,
    close: async () => {
      if (!server.listening) return;
      await new Promise<void>((resolve, reject) => {
        server.close((e) => (e ? reject(e) : resolve()));
        server.closeAllConnections();
      });
    },
  };
}
