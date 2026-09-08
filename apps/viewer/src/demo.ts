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
    const root = index % 3 === 0 ? "/workspace/design-system" : "/workspace/codex-plugins";
    const cwd = index % 4 === 0 ? `${root}/apps/viewer` : root;
    const metadata = {
      session_cwd: cwd,
      git: {
        root, branch: index % 3 === 0 ? "main" : "feature/viewer",
        commit: "d4e5f60718293a4b5c6d7e8f90123456789abcde", upstream: "origin/main",
        ahead_behind: "+2 -0", dirty: false, status_porcelain_v2: "# branch.head main\0",
      },
    };
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
            cwd,
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
      cwd,
      tool_input: input,
    };
    records.push({
      metadata,
      logged_at: new Date(time).toISOString(),
      event: { ...event, hook_event_name: "PreToolUse" },
    });
    if (index !== 0 && index !== 3 && index !== 8) {
      records.push({
        metadata: { ...metadata, git: { ...metadata.git, dirty: tool === "apply_patch",
          status_porcelain_v2: tool === "apply_patch" ? "? apps/viewer/src/server.ts\0" : metadata.git.status_porcelain_v2 } },
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
