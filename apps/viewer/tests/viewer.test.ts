import assert from "node:assert/strict";
import { once } from "node:events";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { TestContext } from "node:test";
import { groupCalls, readLogs } from "../src/logs.ts";
import { callContext, displayPath, isSnapshot, matchesContext, recordContext, repositoryLabel } from "../src/model.ts";
import type { LogRecord } from "../src/model.ts";
import { browserUrl, createViewer, interfaceUrls, openBrowser } from "../src/server.ts";
import { appendEvent } from '../../../plugins/tool-call-logger/scripts/log-tool-call.ts';

function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "codex-viewer-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return { directory, path: join(directory, "tool-calls.jsonl") };
}

test("lists every IPv4 interface as a reachable viewer URL", () => {
  assert.deepEqual(interfaceUrls(4317, {
    lo0: [{ address: "127.0.0.1", family: "IPv4" }, { address: "::1", family: "IPv6" }],
    en0: [{ address: "192.168.1.12", family: "IPv4" }],
    en1: undefined,
  }), [
    { name: "lo0", url: "http://127.0.0.1:4317" },
    { name: "en0", url: "http://192.168.1.12:4317" },
  ]);
});

test("path labels shorten only the configured home directory, including a Docker host home", () => {
  assert.equal(displayPath("/Users/alex/work/repo", "/Users/alex"), "~/work/repo");
  assert.equal(displayPath("/Users/alex", "/Users/alex/"), "~");
  assert.equal(displayPath("/Users/alex-other/repo", "/Users/alex"), "/Users/alex-other/repo");
  assert.equal(displayPath("/Users/sam/repo", "/Users/alex"), "/Users/sam/repo");
  assert.equal(displayPath("/logs/tool-calls.jsonl", "/Users/alex"), "/logs/tool-calls.jsonl");
  assert.equal(displayPath("/work/repo"), "/work/repo");
});

test("repository labels use names and disambiguate identical names without changing filter keys", () => {
  const roots = ["/Users/alex/repo", "/work/repo", "/work/another"];
  assert.equal(repositoryLabel("/work/another", roots, "/Users/alex"), "another");
  assert.equal(repositoryLabel(roots[0] ?? "", roots, "/Users/alex"), "repo — ~/repo");
  assert.equal(repositoryLabel("/work/repo", roots, "/Users/alex"), "repo — /work/repo");
});

test("viewer reads mounted host state and tolerates missing or malformed state without modifying logs", async (t) => {
  const f = fixture(t);
  const state = join(f.directory, 'state.json');
  const data = record();
  writeFileSync(f.path, data);
  assert.equal((await readLogs(f.path)).homeDirectory, undefined);
  writeFileSync(state, JSON.stringify({ schema_version: 1, home_directory: '/Users/alex' }));
  assert.equal((await readLogs(f.path)).homeDirectory, '/Users/alex');
  writeFileSync(state, 'broken');
  const snapshot = await readLogs(f.path);
  assert.equal(snapshot.homeDirectory, undefined);
  assert.equal(snapshot.calls.length, 1);
  assert.equal(readFileSync(f.path, 'utf8'), data);
});
function record(
  phase = "PreToolUse",
  session = "s1",
  time = "2026-09-08T01:00:00.000Z",
  input: unknown = { command: "pwd" },
) {
  return (
    JSON.stringify({
      schema_version: 1,
      logged_at: time,
      event: {
        hook_event_name: phase,
        tool_name: "Bash",
        session_id: session,
        turn_id: "t1",
        tool_use_id: "c1",
        tool_input: input,
        ...(phase === "PostToolUse" ? { tool_response: { exit_code: 0 } } : {}),
      },
    }) + "\n"
  );
}

test("Git details preserve before/after snapshots and use the latest captured state", () => {
  const pre: LogRecord = {
    logged_at: "2026-09-08T01:00:00Z",
    event: { hook_event_name: "PreToolUse", cwd: "/work/repo/apps/viewer", tool_use_id: "1" },
    metadata: { git: { root: "/work/repo", branch: "main", commit: "abc", dirty: false } },
  };
  const post: LogRecord = { ...pre, event: { ...pre.event, hook_event_name: "PostToolUse" },
    metadata: { git: { root: "/work/repo", branch: "feature/viewer", commit: "def", dirty: true,
      upstream: "origin/main", ahead_behind: "+2 -1", status_porcelain_v2: "? new file.ts\0" } } };
  const call = groupCalls([pre, post])[0];
  assert.ok(call);
  assert.equal(recordContext(call.pre).dirty, false);
  assert.equal(callContext(call).dirty, true);
  assert.equal(callContext(call).branch, "feature/viewer");
  assert.equal(callContext(call).commit, "def");
  assert.equal(callContext(call).upstream, "origin/main");
  assert.equal(callContext(call).divergence, "+2 -1");
  assert.equal(recordContext(call.post).status, "? new file.ts\0");
  assert.equal(callContext({ ...call, post: { ...post, metadata: undefined } }).branch, "main");
  const unavailable = callContext({ ...call, post: { ...post,
    metadata: { git: null, errors: [{ source: "git", message: "Git timed out" }] } } });
  assert.equal(unavailable.root, "");
  assert.equal(unavailable.dirty, null);
  assert.equal(unavailable.error, "Git timed out");
});

test("repository and directory filters combine exact full paths, including missing metadata", () => {
  const calls = groupCalls([
    { logged_at: "2026-09-08T01:00:00Z", event: { hook_event_name: "PreToolUse", cwd: "/work/repo/app" },
      metadata: { git: { root: "/work/repo" } } },
    { logged_at: "2026-09-08T01:00:01Z", event: { hook_event_name: "PreToolUse", cwd: "/elsewhere/repo" },
      metadata: { git: { root: "/elsewhere/repo" } } },
    { logged_at: "2026-09-08T01:00:02Z", event: { hook_event_name: "PreToolUse", cwd: "/work/repo/lib" },
      metadata: { git: { root: "/work/repo" } } },
    { logged_at: "2026-09-08T01:00:03Z", event: { hook_event_name: "PreToolUse" } },
  ]);
  assert.equal(calls.filter((call) => matchesContext(call, "all", "/work/repo")).length, 2);
  assert.equal(calls.filter((call) => matchesContext(call, "/work/repo/app", "/work/repo")).length, 1);
  assert.equal(calls.filter((call) => matchesContext(call, "/work/repo/app", "/elsewhere/repo")).length, 0);
  assert.equal(calls.filter((call) => matchesContext(call, "unknown", "unknown")).length, 1);
  assert.equal(calls.filter((call) => matchesContext(call, "all", "all")).length, 4);
});

test("legacy and malformed Git metadata remain unknown and never imply a clean repository", () => {
  const context = recordContext({ logged_at: "2026-09-08T01:00:00Z",
    event: { hook_event_name: "PreToolUse" }, metadata: {
      session_cwd: "/work/nested", git: { root: 12, branch: {}, dirty: "false" }, errors: [null, 3],
    } });
  assert.equal(context.directory, "/work/nested");
  assert.equal(context.root, "");
  assert.equal(context.branch, "");
  assert.equal(context.dirty, null);
  assert.equal(recordContext(null).dirty, null);
});

test("missing log gives an empty view without creating files", async (t) => {
  const f = fixture(t);
  const result = await readLogs(f.path);
  assert.equal(result.missing, true);
  assert.deepEqual(result.calls, []);
  assert.equal(existsSync(f.path), false);
});

test("pairs calls by session, turn, and tool ID and preserves raw payloads", async (t) => {
  const f = fixture(t);
  const input = { command: '<script>alert("unsafe")</script>\n🐟' };
  const data =
    record("PreToolUse", "s1", undefined, input) +
    record("PreToolUse", "s2") +
    record("PostToolUse", "s1", "2026-09-08T01:00:01.250Z", input);
  writeFileSync(f.path, data);
  const snapshot = await readLogs(f.path);
  assert.equal(snapshot.calls.length, 2);
  assert.equal(snapshot.totalEvents, 3);
  const complete = snapshot.calls.find((call) => call.session === "s1");
  assert.ok(complete);
  assert.equal(complete.status, "completed");
  assert.equal(complete.durationMs, 1250);
  assert.deepEqual(complete.input, input);
  assert.deepEqual(complete.output, { exit_code: 0 });
  assert.equal(
    snapshot.calls.find((call) => call.session === "s2")?.status,
    "awaiting",
  );
  assert.equal(readFileSync(f.path, "utf8"), data);
});

test("ignores malformed lines and waits for complete appended records", async (t) => {
  const f = fixture(t);
  const post = record("PostToolUse", "s1", "2026-09-08T01:00:02.000Z");
  writeFileSync(f.path, `broken\n{}\n${record()}${post.slice(0, -2)}`);
  const first = await readLogs(f.path);
  assert.equal(first.skipped, 2);
  assert.equal(first.calls[0]?.status, "awaiting");
  appendFileSync(f.path, post.slice(-2));
  const second = await readLogs(f.path);
  assert.equal(second.calls[0]?.status, "completed");
  assert.equal(second.calls[0]?.durationMs, 2000);
});

test('viewer raw events retain enriched logger records alongside legacy records', async (t) => {
  const f = fixture(t);
  const legacy: unknown = JSON.parse(record());
  writeFileSync(f.path, record());
  appendEvent({
    hook_event_name: 'PostToolUse', cwd: f.directory, session_id: 's1', turn_id: 't1',
    tool_use_id: 'c1', tool_name: 'Bash', tool_response: { exit_code: 0 },
  }, f.directory);
  const stored: unknown = JSON.parse(readFileSync(f.path, 'utf8').trimEnd().split('\n').at(-1) ?? 'null');
  const snapshot = await readLogs(f.path);
  assert.equal(snapshot.calls.length, 1);
  assert.deepEqual(snapshot.calls[0]?.pre, legacy);
  assert.deepEqual(snapshot.calls[0]?.post, stored);
});

test("bounds reading to a tail window and never parses cut-off lines", async (t) => {
  const f = fixture(t);
  const tail = record("PostToolUse", "s2");
  writeFileSync(
    f.path,
    record("PreToolUse", "s1", undefined, "x".repeat(3000)) + tail,
  );
  const result = await readLogs(f.path, Buffer.byteLength(tail) + 20);
  assert.equal(result.truncated, true);
  assert.equal(result.skipped, 0);
  assert.equal(result.calls.length, 1);
  assert.equal(result.calls[0]?.session, "s2");
  assert.equal(result.calls[0]?.durationMs, null);
});

test("rejects non-file sources", async (t) => {
  const f = fixture(t);
  mkdirSync(f.path);
  await assert.rejects(readLogs(f.path));
});

test("HTTP serves the app, browser JavaScript, live data, and read-only routes", async (t) => {
  const f = fixture(t);
  const server = await createViewer({ source: f.path });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(
    () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const page = await fetch(base);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /id="root"/);
  assert.equal(page.headers.get("x-content-type-options"), "nosniff");
  assert.match(page.headers.get("content-security-policy") ?? "", /script-src 'self';/);
  const entry = html.match(/src="(\/assets\/[^" ]+\.js)"/)?.[1];
  assert.ok(entry, "built HTML references a bundled entry");
  const client = await fetch(`${base}${entry}`);
  assert.equal(client.status, 200);
  assert.match(client.headers.get("content-type") ?? "", /javascript/);
  const javascript = await client.text();
  assert.match(javascript, /Call explorer/);
  assert.doesNotMatch(javascript, /import type/);
  const empty: unknown = await (await fetch(`${base}/api/logs`)).json();
  assert.ok(isSnapshot(empty));
  assert.equal(empty.homeDirectory, undefined);
  assert.equal(empty.missing, true);
  writeFileSync(f.path, record());
  const updated: unknown = await (await fetch(`${base}/api/logs`)).json();
  assert.ok(isSnapshot(updated));
  assert.equal(updated.calls.length, 1);
  assert.equal(
    (await fetch(`${base}/api/logs`, { method: "POST" })).status,
    405,
  );
  assert.equal((await fetch(`${base}/package.json`)).status, 404);
  const foreignHost = await new Promise<number | undefined>(
    (resolve, reject) => {
      const req = request(
        `${base}/api/logs`,
        { headers: { Host: "untrusted.example" } },
        (response) => {
          response.resume();
          resolve(response.statusCode);
        },
      );
      req.on("error", reject);
      req.end();
    },
  );
  assert.equal(foreignHost, 403);
  const ipHost = await new Promise<number | undefined>((resolve, reject) => {
    const req = request(`${base}/api/logs`, { headers: { Host: "192.168.1.12:4317" } }, (response) => {
      response.resume();
      resolve(response.statusCode);
    });
    req.on("error", reject);
    req.end();
  });
  assert.equal(ipHost, 200);
});

test("opens the local viewer URL with the platform browser opener", () => {
  assert.equal(browserUrl("0.0.0.0", 4317), "http://127.0.0.1:4317");
  assert.equal(browserUrl("127.0.0.1", 4318), "http://127.0.0.1:4318");

  const opened: { command: string; args: string[] }[] = [];
  assert.equal(openBrowser("http://127.0.0.1:4317", "linux", (command, args) => opened.push({ command, args: [...args] })), true);
  assert.deepEqual(opened, [{ command: "xdg-open", args: ["http://127.0.0.1:4317"] }]);
  assert.equal(openBrowser("http://127.0.0.1:4317", "darwin", (command, args) => opened.push({ command, args: [...args] })), true);
  assert.deepEqual(opened[1], { command: "open", args: ["http://127.0.0.1:4317"] });
  assert.equal(openBrowser("http://127.0.0.1:4317", "win32", (command, args) => opened.push({ command, args: [...args] })), false);
  assert.equal(opened.length, 2);
});

async function listen(t: TestContext, options: Parameters<typeof createViewer>[0] = {}) {
  const server = await createViewer(options);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve, reject) => {
    server.closeAllConnections();
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

test("production fails clearly when its build is missing", async (t) => {
  const f = fixture(t);
  await assert.rejects(createViewer({ buildDirectory: f.directory }), /Viewer build missing.*pnpm --filter viewer build/);
  writeFileSync(join(f.directory, "index.html"), "<div id='root'></div>");
  await assert.rejects(createViewer({ buildDirectory: f.directory }), /Viewer assets missing/);
});

test("production serves only compiled assets and never follows symlinks", async (t) => {
  const f = fixture(t);
  mkdirSync(join(f.directory, "assets"));
  writeFileSync(join(f.directory, "index.html"), "<div id='root'></div>");
  writeFileSync(join(f.directory, "assets", "app.js"), "document.title = 'viewer'");
  writeFileSync(join(f.directory, "assets", "app.js.map"), "private source");
  writeFileSync(join(f.directory, "assets", "secret.json"), "private data");
  writeFileSync(f.path, "private logs");
  symlinkSync(f.path, join(f.directory, "assets", "linked.js"));
  const base = await listen(t, { buildDirectory: f.directory, source: f.path });
  assert.equal((await fetch(`${base}/assets/app.js`)).status, 200);
  for (const path of ["/assets/app.js.map", "/assets/secret.json", "/assets/linked.js", "/src/server.ts", "/tool-calls.jsonl", "/client.js", "/assets/missing.js"]) {
    assert.equal((await fetch(`${base}${path}`)).status, 404, path);
  }
  assert.equal((await fetch(`${base}/%ZZ`)).status, 400);
});

test("development transforms React with fresh CSP nonces and blocks backend files", async (t) => {
  const f = fixture(t);
  const base = await listen(t, { dev: true, source: f.path });
  const page = await fetch(base);
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.match(html, /\/@vite\/client/);
  assert.match(html, /\/@react-refresh/);
  const nonce = html.match(/nonce="([^"]+)"/)?.[1];
  assert.ok(nonce);
  assert.notEqual(nonce, "__VIEWER_CSP_NONCE__");
  assert.ok(page.headers.get("content-security-policy")?.includes(`'nonce-${nonce}'`));
  const nextPage = await fetch(base);
  assert.notEqual((await nextPage.text()).match(/nonce="([^"]+)"/)?.[1], nonce);
  const client = await fetch(`${base}/src/client/main.tsx`);
  assert.equal(client.status, 200);
  assert.match(client.headers.get("content-type") ?? "", /javascript/);
  assert.equal((await fetch(`${base}/@vite/client`)).status, 200);
  assert.equal((await fetch(`${base}/@react-refresh`)).status, 200);
  assert.ok(isSnapshot(await (await fetch(`${base}/api/logs`)).json()));
  for (const path of ["/src/server.ts", "/src/logs.ts?raw", "/src/demo.ts", "/package.json", "/vite.config.ts", "/tests/viewer.test.ts", "/.env", "/@fs/etc/passwd", "/src/client/%2e%2e%2fserver.ts", "/node_modules/.vite/deps/_metadata.json"]) {
    assert.equal((await fetch(`${base}${path}`)).status, 404, path);
  }
  assert.equal((await fetch(`${base}/src/model.ts`, { method: "POST" })).status, 405);
  for (const origin of ["http://untrusted.example", "http://localhost:1234"]) {
    await assert.rejects(new Promise<void>((resolve, reject) => {
      const req = request(`${base}/`, {
        headers: { Connection: "Upgrade", Upgrade: "websocket", "Sec-WebSocket-Version": "13", "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==", "Sec-WebSocket-Protocol": "vite-ping", Origin: origin },
      });
      req.on("upgrade", (_response, socket) => { socket.destroy(); resolve(); });
      req.on("error", reject);
      req.setTimeout(2000, () => req.destroy(new Error("Unexpected websocket timeout")));
      req.end();
    }), /socket hang up/);
  }
});
