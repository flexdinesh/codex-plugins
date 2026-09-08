import { readFileSync, realpathSync } from "node:fs";
import { createServer } from "node:http";
import { stripTypeScriptTypes } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { demoSnapshot } from "./demo.ts";
import { logPath, readLogs } from "./logs.ts";
import type { Snapshot } from "./model.ts";

export function createViewer(
  options: { source?: string; demo?: boolean } = {},
) {
  const source = options.source ?? logPath();
  const assets = new Map([
    [
      "/",
      {
        type: "text/html",
        body: readFileSync(
          join(import.meta.dirname, "../public/index.html"),
          "utf8",
        ),
      },
    ],
    [
      "/styles.css",
      {
        type: "text/css",
        body: readFileSync(
          join(import.meta.dirname, "../public/styles.css"),
          "utf8",
        ),
      },
    ],
    ...["client", "model"].map(
      (name): [string, { type: string; body: string }] => [
        `/${name}.js`,
        {
          type: "text/javascript",
          body: stripTypeScriptTypes(
            readFileSync(
              join(import.meta.dirname, `${name}.ts`),
              "utf8",
            ),
          ),
        },
      ],
    ),
  ]);
  let pending: Promise<Snapshot> | undefined;
  return createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
    );
    // The app contains raw local tool arguments. Reject alternate hostnames/DNS rebinding.
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(request.headers.host ?? "")) {
      response.writeHead(403).end("Local access only");
      return;
    }
    if (request.method !== "GET") {
      response.writeHead(405, { Allow: "GET" }).end();
      return;
    }
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    if (path === "/api/logs") {
      try {
        pending ??= options.demo
          ? Promise.resolve(demoSnapshot())
          : readLogs(source);
        const snapshot = await pending;
        response.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
        });
        response.end(JSON.stringify(snapshot));
      } catch (error) {
        response.writeHead(500, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            error:
              error instanceof Error ? error.message : "Unable to read logs",
          }),
        );
      } finally {
        pending = undefined;
      }
      return;
    }
    const asset = assets.get(path);
    if (!asset) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": `${asset.type}; charset=utf-8` });
    response.end(asset.body);
  });
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT ?? "4317");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be between 1 and 65535");
  const demo = process.argv.includes("--demo");
  const host = process.env.HOST ?? "127.0.0.1";
  const server = createViewer({ demo });
  server.on("error", (error) => {
    console.error(`viewer: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, host, () =>
    console.log(
      `Viewer: http://${host}:${port}${demo ? " (demo data)" : ""}`,
    ),
  );
}
