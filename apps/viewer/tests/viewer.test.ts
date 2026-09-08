import assert from "node:assert/strict";
import { once } from "node:events";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { TestContext } from "node:test";
import { readLogs } from "../src/logs.ts";
import { isSnapshot } from "../src/model.ts";
import { createViewer } from "../src/server.ts";
import { appendEvent } from '../../../plugins/tool-call-logger/scripts/log-tool-call.ts';

function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "codex-viewer-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return { directory, path: join(directory, "tool-calls.jsonl") };
}
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
  const server = createViewer({ source: f.path });
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
  assert.match(await page.text(), /Call explorer/);
  const client = await fetch(`${base}/client.js`);
  assert.match(client.headers.get("content-type") ?? "", /javascript/);
  const javascript = await client.text();
  assert.match(javascript, /from ["']\.\/model.js["']/);
  assert.doesNotMatch(javascript, /import type/);
  const empty: unknown = await (await fetch(`${base}/api/logs`)).json();
  assert.ok(isSnapshot(empty));
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
});
