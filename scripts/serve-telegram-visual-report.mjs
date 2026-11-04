// Read-only localhost preview for the completed audit; never serves source/config.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";

const version = JSON.parse(await readFile("package.json", "utf8")).version;
const port = Number(process.env.AUDIT_PREVIEW_PORT || 4195);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid local preview port.");
const auditVersions = [...new Set([version, "3.0.838"])];
const root = resolve("artifacts");
const types = { ".html": "text/html; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png" };
const server = createServer(async (request, response) => {
  try {
    if (!["GET", "HEAD"].includes(request.method)) { response.writeHead(405); response.end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    if (pathname === "/") { response.writeHead(302, { Location: `/artifacts/variant-a-${version}/report.html` }); response.end(); return; }
    if (!pathname.startsWith("/artifacts/")) { response.writeHead(404); response.end(); return; }
    const file = resolve(root, pathname.slice("/artifacts/".length));
    const inside = relative(root, file);
    if (inside.startsWith("..") || isAbsolute(inside)) { response.writeHead(404); response.end(); return; }
    const requested = inside.replaceAll("\\", "/");
    const allowedReport = auditVersions.some(value => requested.startsWith(`telegram-visual-audit-${value}/`))
      || requested.startsWith(`variant-a-${version}/`) || requested.startsWith("variant-a-preview/");
    if (!allowedReport && !["production-pending-3.0.837.png", `production-video-smoke-${version}.json`, ...auditVersions.map(value => `production-pending-${value}.png`)].includes(requested)) { response.writeHead(404); response.end(); return; }
    const type = types[extname(file)];
    if (!type || !(await stat(file)).isFile()) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
    response.end(request.method === "HEAD" ? undefined : await readFile(file));
  } catch { response.writeHead(404); response.end(); }
});
server.listen(port, "127.0.0.1", () => console.log(`Variant A preview: http://127.0.0.1:${port}/artifacts/variant-a-${version}/report.html`));
