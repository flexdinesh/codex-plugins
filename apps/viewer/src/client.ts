import { callContext, displayPath, isObject, isSnapshot, matchesContext, recordContext, repositoryLabel, repositoryName } from "./model.js";
import type { Snapshot, ToolCall } from "./model.ts";

function element(id: string): HTMLElement {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing element: ${id}`);
  return value;
}
function input(id: string): HTMLInputElement | HTMLSelectElement {
  const value = element(id);
  if (
    !(value instanceof HTMLInputElement || value instanceof HTMLSelectElement)
  )
    throw new Error(`Invalid input: ${id}`);
  return value;
}
function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text = "",
  className = "",
): HTMLElementTagNameMap[K] {
  const value = document.createElement(tag);
  value.textContent = text;
  value.className = className;
  return value;
}
function duration(ms: number | null): string {
  if (ms === null) return "—";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}
const clock = (date: string | number) =>
  new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const number = (value: number) => value.toLocaleString();
let snapshot: Snapshot | undefined;
let live = true;
let selected: string | undefined;
let tab = "input";
let limit = 100;
let returnFocus: HTMLElement | null = null;
const pathLabel = (path: string) => displayPath(path, snapshot?.homeDirectory);

function summary(call: ToolCall): string {
  if (isObject(call.input)) {
    for (const key of ["command", "cmd", "query", "path", "file_path", "url"]) {
      const value = call.input[key];
      if (typeof value === "string") return value.replace(/\s+/g, " ");
    }
  }
  return call.input === null ? "No input recorded" : JSON.stringify(call.input);
}
function badge(call: ToolCall): HTMLSpanElement {
  return node(
    "span",
    call.status === "completed" ? "Result received" : "Awaiting result",
    `status-pill ${call.status}`,
  );
}
function options(id: string, values: string[], label: string, unknownLabel = "Not recorded"): void {
  const select = input(id);
  if (!(select instanceof HTMLSelectElement)) return;
  const current = select.value;
  const sorted = [...new Set(values.filter(Boolean))].sort();
  const key = JSON.stringify([sorted, snapshot?.homeDirectory]);
  if (key === select.dataset.values) return;
  select.dataset.values = key;
  select.replaceChildren(
    new Option(label, "all"),
    ...sorted.map((value) => new Option(value === "unknown" ? unknownLabel
      : id === "repository" ? repositoryLabel(value, sorted, snapshot?.homeDirectory)
      : id === "directory" ? pathLabel(value) : value, value)),
  );
  select.value = sorted.includes(current) ? current : "all";
}
function filtered(): ToolCall[] {
  const query = input("search").value.toLowerCase().trim();
  const status = input("status").value;
  const tool = input("tool").value;
  const session = input("session").value;
  const directory = input("directory").value;
  const repository = input("repository").value;
  const range = input("range").value;
  const cutoff =
    range === "all" ? -Infinity : Date.now() - Number(range) * 3600_000;
  element("clear").hidden =
    !query && [status, tool, session, range, directory, repository].every((value) => value === "all");
  return (snapshot?.calls ?? []).filter(
    (call) =>
      (status === "all" || call.status === status) &&
      (tool === "all" || call.tool === tool) &&
      (session === "all" || call.session === session) &&
      matchesContext(call, directory, repository) &&
      Date.parse(call.time) >= cutoff &&
      (!query || JSON.stringify(call).toLowerCase().includes(query)),
  );
}
function charts(calls: ToolCall[]): void {
  const times = calls.map((call) => Date.parse(call.time));
  const end = times.length ? Math.max(...times) : Date.now();
  const start = times.length ? Math.min(...times) : end - 3600_000;
  const width = Math.max(end - start, 60_000);
  const buckets = Array.from({ length: 36 }, () => 0);
  for (const time of times) {
    const index = Math.min(35, Math.floor(((time - start) / width) * 36));
    buckets[index] = (buckets[index] ?? 0) + 1;
  }
  const peak = Math.max(1, ...buckets);
  element("activity").replaceChildren(
    ...buckets.map((count, index) => {
      const bar = node("div", "", "activity-bar");
      bar.style.height = `${(count / peak) * 100}%`;
      bar.title = `${clock(start + (index / 36) * width)} · ${count} call${count === 1 ? "" : "s"}`;
      return bar;
    }),
  );
  element("activity").setAttribute(
    "aria-label",
    `${calls.length} calls between ${clock(start)} and ${clock(end)}`,
  );
  element("chart-from").textContent = calls.length
    ? clock(start)
    : "No events yet";
  element("chart-to").textContent = calls.length ? clock(end) : "Now";
  const counts = new Map<string, number>();
  for (const call of calls)
    counts.set(call.tool, (counts.get(call.tool) ?? 0) + 1);
  element("tool-count").textContent = `${counts.size} tools`;
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 4);
  element("tools").replaceChildren(
    ...top.map(([tool, count]) => {
      const button = node("button", "", "tool-row");
      button.type = "button";
      button.title = `Filter by ${tool}`;
      const track = node("span", "", "tool-track");
      const fill = node("span", "", "tool-fill");
      fill.style.width = `${(count / Math.max(1, top[0]?.[1] ?? 1)) * 100}%`;
      track.append(fill);
      button.append(
        node("span", tool, "tool-name"),
        track,
        node("span", String(count)),
      );
      button.addEventListener("click", () => {
        input("tool").value = tool;
        render();
      });
      return button;
    }),
  );
  if (!top.length)
    element("tools").append(
      node("p", "Tools appear here as calls arrive.", "muted"),
    );
}
function render(): void {
  if (!snapshot) return;
  options(
    "tool",
    snapshot.calls.map((call) => call.tool),
    "All tools",
  );
  options(
    "session",
    snapshot.calls.map((call) => call.session),
    "All sessions",
  );
  options("repository", snapshot.calls.map((call) => callContext(call).root || "unknown"), "All repositories", "No repository recorded");
  options("directory", snapshot.calls.map((call) => callContext(call).directory || "unknown"), "All directories", "No directory recorded");
  const calls = filtered();
  const completed = calls.filter((call) => call.status === "completed").length;
  const durations = calls
    .flatMap((call) => (call.durationMs === null ? [] : [call.durationMs]))
    .sort((a, b) => a - b);
  const middle = Math.floor(durations.length / 2);
  const median =
    durations.length % 2
      ? (durations[middle] ?? null)
      : durations.length
        ? ((durations[middle - 1] ?? 0) + (durations[middle] ?? 0)) / 2
        : null;
  element("stat-calls").textContent = number(calls.length);
  element("stat-completed").textContent = number(completed);
  element("stat-awaiting").textContent = number(calls.length - completed);
  element("stat-duration").textContent = duration(median);
  element("shown-count").textContent = number(calls.length);
  element("source").textContent = pathLabel(snapshot.source);
  element("source").title = pathLabel(snapshot.source);
  element("demo").hidden = !snapshot.demo;
  element("event-count").textContent = `${number(snapshot.totalEvents)} events`;
  element("window-note").textContent = snapshot.truncated
    ? "Showing recent events only · older log data is outside this window"
    : `${snapshot.skipped ? `${snapshot.skipped} malformed records skipped · ` : ""}Latest 2,000 log events · refreshes every 2 seconds`;
  charts(calls);
  element("rows").replaceChildren(
    ...calls.slice(0, limit).map((call) => {
      const row = node(
        "tr",
        "",
        `call-row${selected === call.id ? " selected" : ""}`,
      );
      row.tabIndex = 0;
      row.setAttribute(
        "aria-label",
        `Inspect ${call.tool} at ${clock(call.time)}`,
      );
      const first = node("td");
      const cell = node("div", "", "tool-cell");
      const text = node("div", "", "tool-text");
      text.append(
        node("div", call.tool, "tool-title"),
        node("div", summary(call), "tool-summary"),
      );
      cell.append(
        node(
          "span",
          call.tool === "Bash" ? ">_" : call.tool === "apply_patch" ? "±" : "⌕",
          "tool-icon",
        ),
        text,
      );
      first.append(cell);
      const context = callContext(call);
      const repository = node("td", "", "repository-cell");
      const name = repositoryName(context.root);
      repository.append(
        node("div", context.root ? `${name}${context.branch ? ` · ${context.branch}` : ""}` : "No repository recorded", "repository-name"),
        node("div", pathLabel(context.directory) || "No directory recorded", "directory-path"),
      );
      repository.title = [pathLabel(context.root), context.branch, pathLabel(context.directory)].filter(Boolean).join("\n");
      const status = node("td");
      status.append(badge(call));
      const session = node("td");
      session.append(
        node(
          "span",
          call.session ? call.session.slice(0, 14) : "—",
          "session-tag",
        ),
      );
      session.title = call.session;
      row.append(
        first,
        repository,
        status,
        node("td", duration(call.durationMs)),
        session,
        node("td", clock(call.time), "cell-time"),
        node("td", "↗", "arrow-cell"),
      );
      const open = () => {
        selected = call.id;
        returnFocus = row;
        tab = "input";
        inspect();
        element("close").focus();
      };
      row.addEventListener("click", open);
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
      return row;
    }),
  );
  element("empty").hidden = calls.length > 0;
  element("empty-title").textContent = snapshot.calls.length
    ? "No matching calls"
    : "Waiting for your first tool call";
  element("empty-message").textContent = snapshot.calls.length
    ? "Try a different search or reset the filters to see all calls."
    : snapshot.missing
      ? "Enable and trust the Tool Call Logger plugin in Codex. The log file will be created on the first call."
      : "New tool calls will appear automatically. Only complete, valid tool events are shown.";
  element("more").hidden = calls.length <= limit;
  if (selected) inspect();
}
function inspect(): void {
  const call = snapshot?.calls.find((call) => call.id === selected);
  if (!call) {
    close();
    return;
  }
  element("overlay").hidden = false;
  element("inspector").hidden = false;
  document.body.style.overflow = "hidden";
  element("detail-tool").textContent = call.tool;
  element("detail-status").replaceChildren(badge(call));
  const context = callContext(call);
  const fields = [
    ["Time", new Date(call.time).toLocaleString()],
    ["Duration", duration(call.durationMs)],
    ["Session", call.session || "Not recorded"],
    ["Turn", call.turn || "Not recorded"],
    ["Directory", pathLabel(context.directory) || "Not recorded"],
    ["Repository", repositoryName(context.root) || "Not recorded"],
    ["Branch", context.branch || "Not recorded"],
  ];
  element("metadata").replaceChildren(
    ...fields.flatMap(([label, value]) => [
      node("dt", label),
      node("dd", value),
    ]),
  );
  element("git-snapshots").replaceChildren(
    ...[call.pre, call.post].map((record, index) => {
      const section = node("section", "", "git-snapshot");
      section.append(node("h3", index === 0 ? "Before tool" : "After tool"));
      if (!record) {
        section.append(node("p", "No matching hook event recorded.", "detail-note"));
        return section;
      }
      const git = recordContext(record);
      const details = node("dl");
      const values = [
        ["Directory", pathLabel(git.directory) || "Not recorded"],
        ["Repository", repositoryName(git.root) || "Not recorded"],
        ["Repo root", pathLabel(git.root) || "Not recorded"],
        ["Branch", git.branch || "Not recorded"],
        ["Commit", git.commit || "Not recorded"],
        ["Upstream", git.upstream || "Not recorded"],
        ["Ahead / behind", git.divergence || "Not recorded"],
        ["Working tree", git.dirty === null ? "Unknown" : git.dirty ? "Has changes" : "Clean"],
      ];
      details.append(...values.flatMap(([label, value]) => [node("dt", label), node("dd", value)]));
      section.append(details);
      if (git.error) section.append(node("p", `Git unavailable: ${git.error}`, "git-error"));
      if (git.status) {
        const status = node("details", "", "git-status");
        status.append(node("summary", "Recorded Git status"), node("pre", git.status.replaceAll("\0", "\n")));
        section.append(status);
      }
      return section;
    }),
  );
  for (const name of ["input", "output", "raw"])
    element(`tab-${name}`).setAttribute("aria-selected", String(tab === name));
  element("payload-label").textContent =
    tab === "input"
      ? "TOOL INPUT"
      : tab === "output"
        ? "TOOL RESULT"
        : "ORIGINAL HOOK EVENTS";
  const value =
    tab === "input"
      ? call.input
      : tab === "output"
        ? call.output
        : { pre: call.pre, post: call.post };
  element("payload").textContent =
    tab === "output" && !call.post
      ? "No matching PostToolUse event in the current log window."
      : JSON.stringify(value, null, 2);
}
function close(): void {
  selected = undefined;
  element("overlay").hidden = true;
  element("inspector").hidden = true;
  document.body.style.overflow = "";
  if (returnFocus?.isConnected) returnFocus.focus();
  else input("search").focus();
}
for (const id of ["search", "status", "tool", "session", "range", "directory", "repository"])
  input(id).addEventListener("input", () => {
    limit = 100;
    render();
  });
element("clear").addEventListener("click", () => {
  for (const id of ["status", "tool", "session", "range", "directory", "repository"])
    input(id).value = "all";
  input("search").value = "";
  limit = 100;
  render();
});
element("more").addEventListener("click", () => {
  limit += 100;
  render();
});
element("live").addEventListener("click", () => {
  live = !live;
  element("live").setAttribute("aria-pressed", String(live));
  element("live-label").textContent = live ? "Live updates" : "Updates paused";
});
element("close").addEventListener("click", close);
element("overlay").addEventListener("click", close);
for (const name of ["input", "output", "raw"])
  element(`tab-${name}`).addEventListener("click", () => {
    tab = name;
    inspect();
  });
element("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(element("payload").textContent ?? "");
    element("copy").textContent = "Copied";
  } catch {
    element("copy").textContent = "Select text to copy";
  }
  setTimeout(() => {
    element("copy").textContent = "Copy JSON";
  }, 1500);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && selected) close();
  if (
    event.key === "/" &&
    !selected &&
    !(event.target instanceof HTMLInputElement)
  ) {
    event.preventDefault();
    input("search").focus();
  }
  if (event.key === "Tab" && selected) {
    const focusable = Array.from(
      element("inspector").querySelectorAll<HTMLElement>(
        'button,summary,[tabindex="0"]',
      ),
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
});
async function refresh(): Promise<void> {
  if (live) {
    try {
      const response = await fetch("/api/logs", {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok)
        throw new Error(
          `Unable to read the log (HTTP ${response.status}). Check the server terminal and file permissions.`,
        );
      const value: unknown = await response.json();
      if (!isSnapshot(value)) throw new Error("Unexpected log response.");
      const changed = JSON.stringify(snapshot) !== JSON.stringify(value);
      snapshot = value;
      element("error").hidden = true;
      element("updated").textContent =
        `Updated ${new Date().toLocaleTimeString()}`;
      if (changed) render();
    } catch (error) {
      element("error").hidden = false;
      element("error").textContent =
        error instanceof Error
          ? error.message
          : "Unable to connect to the viewer.";
      element("updated").textContent = "Connection interrupted";
    }
  }
  setTimeout(() => {
    void refresh();
  }, 2000);
}
void refresh();
