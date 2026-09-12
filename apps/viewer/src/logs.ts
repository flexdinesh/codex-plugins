import { constants, existsSync } from "node:fs";
import { open } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { isObject, isRecord } from "./model.ts";
import type { JsonObject, LogRecord, Snapshot, ToolCall } from "./model.ts";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_EVENTS = 2000;

async function readHomeDirectory(source: string): Promise<string | undefined> {
  let file: Awaited<ReturnType<typeof open>> | undefined;
  try {
    file = await open(join(dirname(source), "state.json"), constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > 4096) return;
    const buffer = Buffer.alloc(4096);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    const state: unknown = JSON.parse(buffer.subarray(0, bytesRead).toString("utf8"));
    if (isObject(state) && state.schema_version === 1 && typeof state.home_directory === "string"
      && state.home_directory.startsWith("/")) return state.home_directory;
  } catch {
    // Missing or invalid display metadata must never hide tool events.
  } finally {
    await file?.close();
  }
}

export function logPath(): string {
  const override = process.env.TOOL_LOGGER_STATE_DIR;
  const directory = !override
    ? join(homedir(), ".local/state/tool-logger")
    : override === "~"
      ? homedir()
      : override.startsWith("~/")
        ? join(homedir(), override.slice(2))
        : override;
  const current = join(directory, "codex-tool-calls.jsonl");
  const legacy = join(directory, "tool-calls.jsonl");
  return existsSync(current) || !existsSync(legacy) ? current : legacy;
}

function text(event: JsonObject, key: string): string {
  return typeof event[key] === "string" ? event[key] : "";
}

export function groupCalls(records: LogRecord[]): ToolCall[] {
  const groups = new Map<
    string,
    { pre: LogRecord | null; post: LogRecord | null }
  >();
  records.forEach((record, index) => {
    const event = record.event;
    const toolId = text(event, "tool_use_id");
    const id = toolId
      ? JSON.stringify([
          text(event, "session_id"),
          text(event, "turn_id"),
          toolId,
        ])
      : JSON.stringify(["unpaired", index, record.logged_at]);
    const group = groups.get(id) ?? { pre: null, post: null };
    if (event.hook_event_name === "PreToolUse") group.pre = record;
    else group.post = record;
    groups.set(id, group);
  });
  return Array.from(groups, ([id, { pre, post }]): ToolCall => {
    const record = pre ?? post;
    if (!record) throw new Error("empty event group");
    const duration =
      pre && post
        ? Date.parse(post.logged_at) - Date.parse(pre.logged_at)
        : null;
    return {
      id,
      time: record.logged_at,
      tool: text(record.event, "tool_name") || "Unknown tool",
      session: text(record.event, "session_id"),
      turn: text(record.event, "turn_id"),
      cwd: text(record.event, "cwd"),
      status: post ? "completed" : "awaiting",
      durationMs: duration !== null && duration >= 0 ? duration : null,
      input: record.event.tool_input ?? null,
      output: post?.event.tool_response ?? null,
      pre,
      post,
    };
  }).sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
}

export function parseLines(data: string): {
  records: LogRecord[];
  skipped: number;
} {
  const records: LogRecord[] = [];
  let skipped = 0;
  for (const line of data.split("\n")) {
    if (!line.trim()) continue;
    try {
      const value: unknown = JSON.parse(line);
      if (isRecord(value)) records.push(value);
      else skipped += 1;
    } catch {
      skipped += 1;
    }
  }
  return { records, skipped };
}

export async function readLogs(
  source: string,
  maxBytes = MAX_BYTES,
): Promise<Snapshot> {
  const homeDirectory = await readHomeDirectory(source);
  const empty: Snapshot = {
    ...(homeDirectory ? { homeDirectory } : {}),
    calls: [],
    source,
    missing: false,
    truncated: false,
    skipped: 0,
    totalEvents: 0,
    demo: false,
  };
  let file: Awaited<ReturnType<typeof open>>;
  try {
    // Read only. NONBLOCK also prevents an accidental FIFO from hanging the server.
    file = await open(source, constants.O_RDONLY | constants.O_NONBLOCK);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return { ...empty, missing: true };
    throw error;
  }
  try {
    const stat = await file.stat();
    if (!stat.isFile()) throw new Error("log source must be a regular file");
    const start = Math.max(0, stat.size - maxBytes);
    const buffer = Buffer.alloc(stat.size - start);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(
        buffer,
        length,
        buffer.length - length,
        start + length,
      );
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    const data = buffer.subarray(0, length);
    // Drop a cut-off first line and an unfinished final line; neither is malformed JSON.
    const first = start > 0 ? data.indexOf(10) + 1 : 0;
    const last = data.lastIndexOf(10);
    const complete =
      last < first ? "" : data.subarray(first, last + 1).toString("utf8");
    const parsed = parseLines(complete);
    const records = parsed.records.slice(-MAX_EVENTS);
    return {
      ...empty,
      calls: groupCalls(records),
      totalEvents: records.length,
      skipped: parsed.skipped,
      truncated: start > 0 || parsed.records.length > MAX_EVENTS,
    };
  } finally {
    await file.close();
  }
}
