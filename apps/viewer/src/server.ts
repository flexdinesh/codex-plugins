import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { createServer } from "node:http";
import { isIP } from "node:net";
import { networkInterfaces } from "node:os";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { demoSnapshot } from "./demo.ts";
import { logPath, readLogs } from "./logs.ts";
import type { Snapshot } from "./model.ts";
import type { ViteDevServer } from "vite";

const root = resolve(import.meta.dirname, "..");
const noncePlaceholder = "__VIEWER_CSP_NONCE__";
const contentTypes = new Map([
  [".html", "text/html"], [".js", "text/javascript"], [".css", "text/css"],
  [".svg", "image/svg+xml"], [".png", "image/png"], [".jpg", "image/jpeg"],
  [".webp", "image/webp"], [".ico", "image/x-icon"], [".woff2", "font/woff2"],
]);

function allowedHost(host: string): boolean {
  try {
    const hostname = new URL(`http://${host}`).hostname;
    const unwrapped = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
    return unwrapped === "localhost" || isIP(unwrapped) !== 0;
  } catch {
    return false;
  }
}

export function interfaceUrls(
  port: number,
  interfaces: Readonly<Record<string, readonly { address: string; family: string }[] | undefined>> = networkInterfaces(),
): { name: string; url: string }[] {
  const urls: { name: string; url: string }[] = [];
  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4") urls.push({ name, url: `http://${address.address}:${port}` });
    }
  }
  return urls;
}

function productionAssets(directory: string) {
  const assets = new Map<string, { type: string; body: Buffer }>();
  try {
    assets.set("/", { type: "text/html", body: readFileSync(join(directory, "index.html")) });
  } catch (error) {
    throw new Error("Viewer build missing. Run pnpm --filter viewer build before starting.", { cause: error });
  }
  const collect = (directory: string, prefix: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const url = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) collect(path, url);
      const type = contentTypes.get(extname(entry.name));
      // Never follow symlinks or expose source maps, manifests, or arbitrary build files.
      if (entry.isFile() && type && extname(entry.name) !== ".html") {
        assets.set(url, { type, body: readFileSync(path) });
      }
    }
  };
  try {
    collect(join(directory, "assets"), "/assets");
  } catch (error) {
    throw new Error("Viewer assets missing. Run pnpm --filter viewer build before starting.", { cause: error });
  }
  return assets;
}

function allowedDevelopmentPath(path: string, viteEnvironment: string): boolean {
  if (["/@vite/client", "/@react-refresh", viteEnvironment].includes(path)) return true;
  if (/^\/node_modules\/\.vite\/deps\/[\w.-]+\.js(?:\.map)?$/.test(path)) return true;
  if (path !== "/src/model.ts" && !/^\/src\/client\/(?:[\w-]+\/)*[\w.-]+\.(?:tsx?|css|svg|png|jpg|webp|woff2)$/.test(path)) return false;
  try {
    const real = realpathSync(join(root, path));
    return real === join(root, "src/model.ts") || real.startsWith(join(root, "src/client") + sep);
  } catch {
    return false;
  }
}

export async function createViewer(
  options: { source?: string; demo?: boolean; dev?: boolean; buildDirectory?: string } = {},
) {
  const source = options.source ?? logPath();
  const assets = options.dev ? undefined : productionAssets(options.buildDirectory ?? join(root, "dist"));
  let vite: ViteDevServer | undefined;
  let viteEnvironment = "";
  let pending: Promise<Snapshot> | undefined;
  const server = createServer(async (request, response) => {
    const nonce = randomBytes(18).toString("base64");
    const host = request.headers.host ?? "";
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self'${vite ? ` 'nonce-${nonce}'` : ""}; style-src 'self'${vite ? ` 'nonce-${nonce}'` : ""}; connect-src 'self'${vite && allowedHost(host) ? ` ws://${host}` : ""}; frame-ancestors 'none'; base-uri 'none'`,
    );
    // The app contains raw local tool arguments. Accept literal IPs but reject DNS rebinding hostnames.
    if (!allowedHost(host)) {
      response.writeHead(403).end("IP access only");
      return;
    }
    if (request.method !== "GET") {
      response.writeHead(405, { Allow: "GET" }).end();
      return;
    }
    let path: string;
    try {
      path = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    } catch {
      response.writeHead(400).end("Invalid URL");
      return;
    }
    if (path === "/api/logs") {
      try {
        pending ??= options.demo ? Promise.resolve(demoSnapshot()) : readLogs(source);
        const snapshot = await pending;
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(snapshot));
      } catch (error) {
        response.writeHead(500, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Unable to read logs" }));
      } finally {
        pending = undefined;
      }
      return;
    }
    if (vite) {
      try {
        if (path === "/") {
          const html = await vite.transformIndexHtml("/", readFileSync(join(root, "index.html"), "utf8"));
          response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          response.end(html.replaceAll(noncePlaceholder, nonce));
        } else if (allowedDevelopmentPath(path, viteEnvironment)) {
          vite.middlewares(request, response, () => response.writeHead(404).end("Not found"));
        } else {
          response.writeHead(404).end("Not found");
        }
      } catch (error) {
        if (error instanceof Error) vite.ssrFixStacktrace(error);
        console.error(error);
        if (!response.headersSent) response.writeHead(500);
        response.end("Unable to load viewer frontend");
      }
      return;
    }
    const asset = assets?.get(path);
    if (!asset) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": `${asset.type}; charset=utf-8` });
    response.end(asset.body);
  });
  if (options.dev) {
    // Check upgrades before Vite's websocket handler, including its HMR ping route.
    server.on("upgrade", (request, socket) => {
      const host = request.headers.host ?? "";
      if (!allowedHost(host) || request.headers.origin !== `http://${host}`) socket.destroy();
    });
    const { createServer: createViteServer } = await import("vite");
    viteEnvironment = `/@fs${fileURLToPath(new URL("../client/env.mjs", import.meta.resolve("vite")))}`;
    vite = await createViteServer({
      root,
      configFile: join(root, "vite.config.ts"),
      html: { cspNonce: noncePlaceholder },
      server: { middlewareMode: true, ws: { server }, cors: false },
      appType: "custom",
    });
    const development = vite;
    const close = server.close.bind(server);
    let closing: Promise<void> | undefined;
    server.close = (callback) => {
      closing ??= development.close();
      void closing.then(() => close(callback), (error: unknown) => {
        close(() => callback?.(error instanceof Error ? error : new Error("Unable to close Vite")));
      });
      return server;
    };
  }
  return server;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? "4317");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535");
  const demo = process.argv.includes("--demo");
  const dev = process.argv.includes("--dev");
  const host = process.env.HOST ?? "0.0.0.0";
  const server = await createViewer({ demo, dev });
  server.on("error", (error) => {
    console.error(`viewer: ${error.message}`);
    process.exitCode = 1;
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => server.close((error) => {
      if (error) console.error(`viewer: ${error.message}`);
      process.exitCode = error ? 1 : 0;
    }));
  }
  server.listen(port, host, () => {
    const urls = host === "0.0.0.0" ? interfaceUrls(port) : [{ name: host, url: `http://${host}:${port}` }];
    console.log(`Viewer${demo ? " (demo data)" : ""}${dev ? " (development)" : ""}:`);
    for (const entry of urls) console.log(`  ${entry.name}: ${entry.url}`);
  });
}
