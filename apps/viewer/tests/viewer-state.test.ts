import assert from "node:assert/strict";
import { test } from "node:test";
import type { Snapshot, ToolCall } from "../src/model.ts";
import { initialViewerState, viewerReducer } from "../src/client/state/viewer-reducer.ts";

function snapshot(id: string, tool = "Bash"): Snapshot {
  const call: ToolCall = {
    id, tool, time: "2026-09-09T10:00:00Z", session: "session", turn: "turn", cwd: "/work",
    harness: "codex", apiVersion: null, callId: id, message: "", agent: "", title: "", resultMetadata: null,
    status: "awaiting", durationMs: null, input: { command: "pwd" }, output: null,
    pre: null, post: null,
  };
  return { harnesses: [{ harness: "codex", label: "Codex", apiVersion: null, calls: [call], source: "/logs",
    missing: false, truncated: false, skipped: 0, totalEvents: 1 }], demo: false };
}

test("refresh keeps inspector selection and payload tab while updating its call", () => {
  let state = viewerReducer(initialViewerState, { type: "snapshotReceived", snapshot: snapshot("one"), updated: "first" });
  state = viewerReducer(state, { type: "callSelected", id: "one" });
  state = viewerReducer(state, { type: "payloadTabChanged", tab: "output" });
  const next = snapshot("one");
  const call = next.harnesses[0]?.calls[0];
  assert.ok(call);
  call.output = { message: "new result" };
  state = viewerReducer(state, { type: "snapshotReceived", snapshot: next, updated: "second" });
  assert.equal(state.selectedCallId, "one");
  assert.equal(state.payloadTab, "output");
  assert.deepEqual(state.snapshot?.harnesses[0]?.calls[0]?.output, { message: "new result" });
});

test("rolling log window clears unavailable filters and closes an evicted selection atomically", () => {
  let state = viewerReducer(initialViewerState, { type: "snapshotReceived", snapshot: snapshot("one"), updated: "first" });
  state = viewerReducer(state, { type: "filterChanged", key: "tool", value: "Bash" });
  state = viewerReducer(state, { type: "filterChanged", key: "search", value: "pwd" });
  state = viewerReducer(state, { type: "callSelected", id: "one" });
  state = viewerReducer(state, { type: "payloadTabChanged", tab: "raw" });
  state = viewerReducer(state, { type: "snapshotReceived", snapshot: snapshot("two", "read_file"), updated: "second" });
  assert.equal(state.filters.tool, "all");
  assert.equal(state.filters.search, "pwd");
  assert.equal(state.selectedCallId, null);
  assert.equal(state.payloadTab, "input");
  state = viewerReducer(state, { type: "callSelected", id: "two" });
  assert.equal(state.selectedCallId, "two");
  assert.equal(state.payloadTab, "input");
});

test("filter changes reset pagination without discarding the selected call", () => {
  let state = viewerReducer(initialViewerState, { type: "snapshotReceived", snapshot: snapshot("one"), updated: "first" });
  state = viewerReducer(state, { type: "callSelected", id: "one" });
  state = viewerReducer(state, { type: "moreRequested" });
  state = viewerReducer(state, { type: "filterChanged", key: "status", value: "completed" });
  assert.equal(state.limit, 100);
  assert.equal(state.filters.status, "completed");
  assert.equal(state.selectedCallId, "one");
  state = viewerReducer(state, { type: "moreRequested" });
  state = viewerReducer(state, { type: "filtersReset" });
  assert.equal(state.limit, 100);
  assert.deepEqual(state.filters, initialViewerState.filters);
  assert.equal(state.selectedCallId, "one");
});

test("connection failure and recovery preserve user state and last successful data", () => {
  let state = viewerReducer(initialViewerState, { type: "snapshotReceived", snapshot: snapshot("one"), updated: "first" });
  state = viewerReducer(state, { type: "filterChanged", key: "tool", value: "Bash" });
  state = viewerReducer(state, { type: "callSelected", id: "one" });
  state = viewerReducer(state, { type: "payloadTabChanged", tab: "raw" });
  state = viewerReducer(state, { type: "moreRequested" });
  const before = state;
  state = viewerReducer(state, { type: "connectionFailed", message: "offline" });
  assert.equal(state.snapshot, before.snapshot);
  assert.equal(state.filters, before.filters);
  assert.equal(state.selectedCallId, "one");
  assert.equal(state.payloadTab, "raw");
  assert.equal(state.limit, 200);
  assert.equal(state.error, "offline");
  state = viewerReducer(state, { type: "snapshotReceived", snapshot: snapshot("one"), updated: "recovered" });
  assert.equal(state.error, "");
  assert.equal(state.updated, "recovered");
  assert.equal(state.selectedCallId, "one");
  assert.equal(state.filters.tool, "Bash");
  assert.equal(state.payloadTab, "raw");
  assert.equal(state.limit, 200);
});

test("harness selection resets harness-specific state", () => {
  const codex = snapshot("codex-call");
  const opencodeCall = codex.harnesses[0]?.calls[0];
  assert.ok(opencodeCall);
  const next: ToolCall = { ...opencodeCall, id: "opencode-call", harness: "opencode", apiVersion: 2,
    agent: "build", callId: "opencode-call" };
  const combined: Snapshot = { ...codex, harnesses: [...codex.harnesses, {
    harness: "opencode", label: "OpenCode", apiVersion: 2, calls: [next], source: "/opencode",
    missing: false, truncated: false, skipped: 0, totalEvents: 1,
  }] };
  let state = viewerReducer(initialViewerState, { type: "snapshotReceived", snapshot: combined, updated: "first" });
  state = viewerReducer(state, { type: "callSelected", id: "codex-call" });
  state = viewerReducer(state, { type: "filterChanged", key: "tool", value: "Bash" });
  state = viewerReducer(state, { type: "harnessSelected", harness: "opencode" });
  assert.equal(state.selectedHarness, "opencode");
  assert.equal(state.selectedCallId, null);
  assert.deepEqual(state.filters, initialViewerState.filters);
});
