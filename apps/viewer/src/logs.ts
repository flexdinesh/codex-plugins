import { constants, existsSync } from "node:fs";
import { open } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { isLogRecord, isObject } from "./model.ts";
import type { HarnessDataset, HarnessId, JsonObject, LogRecord, Snapshot, ToolCall } from "./model.ts";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_EVENTS = 2000;

async function readHomeDirectory(directory: string): Promise<string | undefined> {
  let file: Awaited<ReturnType<typeof open>> | undefined;
  try {
    file = await open(join(directory, "state.json"), constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > 4096) return;
    const buffer = Buffer.alloc(4096);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    const state: unknown = JSON.parse(buffer.subarray(0, bytesRead).toString("utf8"));
    if (isObject(state) && state.schema_version === 1 && typeof state.home_directory === "string"
      && state.home_directory.startsWith("/")) return state.home_directory;
  } catch {
    // Missing display metadata must not hide tool events.
  } finally {
    await file?.close();
  }
}

export function stateDirectory(): string {
  const override = process.env.TOOL_LOGGER_STATE_DIR;
  return !override ? join(homedir(), ".local/state/tool-logger")
    : override === "~" ? homedir()
      : override.startsWith("~/") ? join(homedir(), override.slice(2)) : override;
}

export function logPath(): string {
  const directory = stateDirectory();
  const current = join(directory, "codex-tool-calls.jsonl");
  const legacy = join(directory, "tool-calls.jsonl");
  return existsSync(current) || !existsSync(legacy) ? current : legacy;
}

export function harnessPaths(directory = stateDirectory()): { harness: HarnessId; source: string }[] {
  const codex = join(directory, "codex-tool-calls.jsonl");
  const legacy = join(directory, "tool-calls.jsonl");
  return [
    { harness: "codex", source: existsSync(codex) || !existsSync(legacy) ? codex : legacy },
    { harness: "opencode", source: join(directory, "opencode-tool-calls.jsonl") },
  ];
}

function text(value: JsonObject, key: string): string {
  return typeof value[key] === "string" ? value[key] : "";
}

function codexRecord(value: unknown): value is LogRecord {
  return isLogRecord(value) && (value.event.hook_event_name === "PreToolUse" || value.event.hook_event_name === "PostToolUse");
}

function openCodeRecord(value: unknown): value is LogRecord {
  return isLogRecord(value) && value.schema_version === 2 && value.harness === "opencode" && (value.api_version === 1 || value.api_version === 2)
    && (value.hook === "tool.execute.before" || value.hook === "tool.execute.after");
}

function elapsed(pre: LogRecord | null, post: LogRecord | null): number | null {
  if (!pre || !post) return null;
  const value = Date.parse(post.logged_at) - Date.parse(pre.logged_at);
  return value >= 0 ? value : null;
}

export function groupCodexCalls(records: LogRecord[]): ToolCall[] {
  const groups = new Map<string, { pre: LogRecord | null; post: LogRecord | null }>();
  records.forEach((record, index) => {
    const event = record.event;
    const callId = text(event, "tool_use_id");
    const id = callId ? JSON.stringify(["codex", text(event, "session_id"), text(event, "turn_id"), callId])
      : JSON.stringify(["codex", "unpaired", index, record.logged_at]);
    const group = groups.get(id) ?? { pre: null, post: null };
    if (event.hook_event_name === "PreToolUse") group.pre = record;
    else group.post = record;
    groups.set(id, group);
  });
  return Array.from(groups, ([id, pair]): ToolCall => {
    const record = pair.pre ?? pair.post;
    if (!record) throw new Error("empty event group");
    const event = record.event;
    return {
      id, harness: "codex", apiVersion: null, time: record.logged_at,
      tool: text(event, "tool_name") || "Unknown tool", session: text(event, "session_id"),
      turn: text(event, "turn_id"), callId: text(event, "tool_use_id"), message: "", agent: "", title: "",
      cwd: text(event, "cwd"), status: pair.post ? "completed" : "awaiting", durationMs: elapsed(pair.pre, pair.post),
      input: event.tool_input ?? null, output: pair.post?.event.tool_response ?? null, resultMetadata: null,
      pre: pair.pre, post: pair.post,
    };
  }).sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
}

function v1Parts(record: LogRecord): { input: JsonObject; output: JsonObject } {
  return { input: isObject(record.event.input) ? record.event.input : {}, output: isObject(record.event.output) ? record.event.output : {} };
}

function openCodeIdentity(record: LogRecord, index: number): { id: string; event: JsonObject } {
  if (record.api_version === 1) {
    const parts = v1Parts(record);
    const callId = text(parts.input, "callID");
    return { id: callId ? JSON.stringify(["opencode", 1, text(parts.input, "sessionID"), callId])
      : JSON.stringify(["opencode", 1, "unpaired", index, record.logged_at]), event: parts.input };
  }
  const callId = text(record.event, "id");
  return { id: callId ? JSON.stringify(["opencode", 2, text(record.event, "sessionID"), callId])
    : JSON.stringify(["opencode", 2, "unpaired", index, record.logged_at]), event: record.event };
}

export function groupOpenCodeCalls(records: LogRecord[]): ToolCall[] {
  const apiVersion = records.some((record) => record.api_version === 2) ? 2 : 1;
  const current = records.filter((record) => record.api_version === apiVersion);
  const groups = new Map<string, { pre: LogRecord | null; post: LogRecord | null }>();
  current.forEach((record, index) => {
    const { id } = openCodeIdentity(record, index);
    const group = groups.get(id) ?? { pre: null, post: null };
    if (record.hook === "tool.execute.before") group.pre = record;
    else group.post = record;
    groups.set(id, group);
  });
  return Array.from(groups, ([id, pair]): ToolCall => {
    const record = pair.pre ?? pair.post;
    if (!record) throw new Error("empty event group");
    const version = record.api_version === 2 ? 2 : 1;
    const identity = openCodeIdentity(record, 0).event;
    const beforeParts = pair.pre && pair.pre.api_version === 1 ? v1Parts(pair.pre) : null;
    const afterParts = pair.post && pair.post.api_version === 1 ? v1Parts(pair.post) : null;
    const failed = version === 2 && pair.post?.event.status === "error";
    const result = pair.post && isObject(pair.post.event.result) ? pair.post.event.result : {};
    return {
      id, harness: "opencode", apiVersion: version, time: record.logged_at,
      tool: text(identity, "tool") || "Unknown tool", session: text(identity, "sessionID"), turn: "",
      callId: version === 1 ? text(identity, "callID") : text(identity, "id"),
      message: text(identity, "messageID"), agent: text(identity, "agent"), title: afterParts ? text(afterParts.output, "title") : "",
      cwd: "", status: failed ? "failed" : pair.post ? "completed" : "awaiting", durationMs: elapsed(pair.pre, pair.post),
      input: version === 1 ? beforeParts?.output.args ?? afterParts?.input.args ?? null : identity.input ?? null,
      output: version === 1 ? afterParts?.output.output ?? null : failed ? pair.post?.event.error ?? null : pair.post?.event.result ?? null,
      resultMetadata: version === 1 ? afterParts?.output.metadata ?? null : result.metadata ?? null,
      pre: pair.pre, post: pair.post,
    };
  }).sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
}

export function parseLines(data: string, harness: HarnessId): { records: LogRecord[]; skipped: number } {
  const records: LogRecord[] = [];
  let skipped = 0;
  for (const line of data.split("\n")) {
    if (!line.trim()) continue;
    try {
      const value: unknown = JSON.parse(line);
      if (harness === "codex") {
        if (codexRecord(value)) records.push(value);
        else skipped += 1;
      } else if (openCodeRecord(value)) records.push(value);
      else skipped += 1;
    } catch {
      skipped += 1;
    }
  }
  return { records, skipped };
}

export async function readLogs(source: string, harness: HarnessId = "codex", maxBytes = MAX_BYTES): Promise<HarnessDataset> {
  const empty: HarnessDataset = {
    harness, label: harness === "codex" ? "Codex" : "OpenCode", apiVersion: null, calls: [], source,
    missing: false, truncated: false, skipped: 0, totalEvents: 0,
  };
  let file: Awaited<ReturnType<typeof open>>;
  try {
    file = await open(source, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return { ...empty, missing: true };
    throw error;
  }
  try {
    const stat = await file.stat();
    if (!stat.isFile()) throw new Error("log source must be a regular file");
    const start = Math.max(0, stat.size - maxBytes);
    const buffer = Buffer.alloc(stat.size - start);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(buffer, length, buffer.length - length, start + length);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    const data = buffer.subarray(0, length);
    const first = start > 0 ? data.indexOf(10) + 1 : 0;
    const last = data.lastIndexOf(10);
    const complete = last < first ? "" : data.subarray(first, last + 1).toString("utf8");
    const parsed = parseLines(complete, harness);
    const records = parsed.records.slice(-MAX_EVENTS);
    const activeRecords = harness === "opencode" && records.some((record) => record.api_version === 2)
      ? records.filter((record) => record.api_version === 2) : records;
    const calls = harness === "codex" ? groupCodexCalls(activeRecords) : groupOpenCodeCalls(activeRecords);
    return { ...empty, apiVersion: harness === "opencode" ? calls[0]?.apiVersion ?? null : null, calls,
      totalEvents: activeRecords.length, skipped: parsed.skipped, truncated: start > 0 || parsed.records.length > MAX_EVENTS };
  } finally {
    await file.close();
  }
}

export async function readSnapshot(directory = stateDirectory()): Promise<Snapshot> {
  const reads = await Promise.all(harnessPaths(directory).map(async ({ harness, source }) => {
    try {
      return await readLogs(source, harness);
    } catch {
      return undefined;
    }
  }));
  const homeDirectory = await readHomeDirectory(directory);
  return { ...(homeDirectory ? { homeDirectory } : {}),
    harnesses: reads.filter((dataset): dataset is HarnessDataset => dataset !== undefined && !dataset.missing)
      .sort((a, b) => a.label.localeCompare(b.label)), demo: false };
}
