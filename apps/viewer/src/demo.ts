import { fileURLToPath } from "node:url";
import { readLogs } from "./logs.ts";
import type { LogRecord, Snapshot } from "./model.ts";

export const testLogPath = fileURLToPath(
  new URL("../../../test-data/codex/codex-tool-calls.jsonl", import.meta.url),
);

function shiftRecord(record: LogRecord | null, offset: number): LogRecord | null {
  return record && {
    ...record,
    logged_at: new Date(Date.parse(record.logged_at) + offset).toISOString(),
  };
}

export async function testDataSnapshot(now = Date.now()): Promise<Snapshot> {
  const snapshot = await readLogs(testLogPath);
  const latest = Math.max(...snapshot.calls.flatMap((call) => [
    call.pre?.logged_at,
    call.post?.logged_at,
  ]).filter((value): value is string => value !== undefined).map((value) => Date.parse(value)));
  if (!Number.isFinite(latest)) throw new Error("test log has no events");
  const offset = now - latest;
  return {
    ...snapshot,
    calls: snapshot.calls.map((call) => ({
      ...call,
      time: new Date(Date.parse(call.time) + offset).toISOString(),
      pre: shiftRecord(call.pre, offset),
      post: shiftRecord(call.post, offset),
    })),
    source: "test-data/codex/codex-tool-calls.jsonl",
    demo: true,
  };
}
