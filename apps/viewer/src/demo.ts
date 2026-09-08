import { groupCalls } from "./logs.ts";
import type { LogRecord, Snapshot } from "./model.ts";

export function demoSnapshot(): Snapshot {
  const records: LogRecord[] = [];
  const now = Date.now();
  const tools = [
    "Bash",
    "Bash",
    "apply_patch",
    "mcp__fff__grep",
    "Bash",
    "mcp__fff__find_files",
    "read_file",
  ];
  for (let index = 0; index < 84; index += 1) {
    const tool = tools[index % tools.length] ?? "Bash";
    const time = now - index * 37_000 - (index % 5) * 8_000;
    const input =
      tool === "Bash"
        ? {
            command: [
              "pnpm check",
              "git status --short",
              "pnpm --filter viewer test",
            ][index % 3],
            cwd: "/workspace/codex-plugins",
          }
        : tool === "apply_patch"
          ? {
              command:
                "*** Update File: apps/viewer/src/server.ts\n+  return snapshot;",
            }
          : { query: ["tool_call", "appendEvent", "workspace"][index % 3] };
    const event = {
      tool_name: tool,
      tool_use_id: `call-${index}`,
      session_id: `session-${["8f31a2", "c6e490", "d72b18"][index % 3]}`,
      turn_id: `turn-${Math.floor(index / 8)}`,
      cwd: "/workspace/codex-plugins",
      tool_input: input,
    };
    records.push({
      logged_at: new Date(time).toISOString(),
      event: { ...event, hook_event_name: "PreToolUse" },
    });
    if (index !== 0 && index !== 3 && index !== 8) {
      records.push({
        logged_at: new Date(time + 85 + ((index * 311) % 4800)).toISOString(),
        event: {
          ...event,
          hook_event_name: "PostToolUse",
          tool_response: {
            output:
              tool === "Bash" ? "Process completed." : "Operation completed.",
            exit_code: 0,
          },
        },
      });
    }
  }
  return {
    calls: groupCalls(records),
    source: "Demo · generated in memory",
    missing: false,
    truncated: false,
    skipped: 0,
    totalEvents: records.length,
    demo: true,
  };
}
