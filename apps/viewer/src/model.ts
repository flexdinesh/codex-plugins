export type JsonObject = Record<string, unknown>;
export type LogRecord = {
  logged_at: string;
  event: JsonObject;
};
export type ToolCall = {
  id: string;
  time: string;
  tool: string;
  session: string;
  turn: string;
  cwd: string;
  status: "completed" | "awaiting";
  durationMs: number | null;
  input: unknown;
  output: unknown;
  pre: LogRecord | null;
  post: LogRecord | null;
};
export type Snapshot = {
  calls: ToolCall[];
  source: string;
  missing: boolean;
  truncated: boolean;
  skipped: number;
  totalEvents: number;
  demo: boolean;
};

export function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isRecord(value: unknown): value is LogRecord {
  return (
    isObject(value) &&
    typeof value.logged_at === "string" &&
    Number.isFinite(Date.parse(value.logged_at)) &&
    isObject(value.event) &&
    (value.event.hook_event_name === "PreToolUse" ||
      value.event.hook_event_name === "PostToolUse")
  );
}

function isCall(value: unknown): value is ToolCall {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.time === "string" &&
    typeof value.tool === "string" &&
    typeof value.session === "string" &&
    typeof value.turn === "string" &&
    typeof value.cwd === "string" &&
    (value.status === "completed" || value.status === "awaiting") &&
    (value.durationMs === null || typeof value.durationMs === "number") &&
    (value.pre === null || isRecord(value.pre)) &&
    (value.post === null || isRecord(value.post)) &&
    "input" in value &&
    "output" in value
  );
}

export function isSnapshot(value: unknown): value is Snapshot {
  return (
    isObject(value) &&
    Array.isArray(value.calls) &&
    value.calls.every(isCall) &&
    typeof value.source === "string" &&
    typeof value.missing === "boolean" &&
    typeof value.truncated === "boolean" &&
    typeof value.skipped === "number" &&
    typeof value.totalEvents === "number" &&
    typeof value.demo === "boolean"
  );
}
