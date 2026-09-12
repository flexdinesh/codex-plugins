import { fileURLToPath } from "node:url";
import { readLogs } from "./logs.ts";
import type { HarnessDataset, LogRecord, Snapshot, ToolCall } from "./model.ts";

export const testLogPath = fileURLToPath(new URL("../../../test-data/codex/codex-tool-calls.jsonl", import.meta.url));
export const testOpenCodeV1LogPath = fileURLToPath(new URL("../../../test-data/opencode-v1/opencode-tool-calls.jsonl", import.meta.url));
export const testOpenCodeV2LogPath = fileURLToPath(new URL("../../../test-data/opencode-v2/opencode-tool-calls.jsonl", import.meta.url));

function shiftRecord(record: LogRecord | null, offset: number): LogRecord | null {
  return record && { ...record, logged_at: new Date(Date.parse(record.logged_at) + offset).toISOString() };
}

function shiftCall(call: ToolCall, offset: number): ToolCall {
  return { ...call, time: new Date(Date.parse(call.time) + offset).toISOString(),
    pre: shiftRecord(call.pre, offset), post: shiftRecord(call.post, offset) };
}

function latest(datasets: HarnessDataset[]): number {
  return Math.max(...datasets.flatMap((dataset) => dataset.calls.flatMap((call) => [call.pre?.logged_at, call.post?.logged_at]))
    .filter((value): value is string => value !== undefined).map((value) => Date.parse(value)));
}

export async function testDataSnapshot(now = Date.now()): Promise<Snapshot> {
  const datasets = await Promise.all([readLogs(testLogPath, "codex"), readLogs(testOpenCodeV2LogPath, "opencode")]);
  const newest = latest(datasets);
  if (!Number.isFinite(newest)) throw new Error("test logs have no events");
  const offset = now - newest;
  return {
    homeDirectory: "/home/fixture-user",
    harnesses: datasets.map((dataset) => ({ ...dataset, calls: dataset.calls.map((call) => shiftCall(call, offset)),
      source: dataset.harness === "codex" ? "test-data/codex/codex-tool-calls.jsonl" : "test-data/opencode-v2/opencode-tool-calls.jsonl" }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    demo: true,
  };
}
