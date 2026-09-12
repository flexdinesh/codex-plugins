import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { LogRecord, Snapshot, ToolCall } from "../../src/model.ts";

const now = new Date("2026-09-09T10:00:00.000Z");
const home = "/home/viewer";
const repository = `${home}/work/project`;
const otherRepository = `${home}/archive/project`;

function call(index: number, overrides: Partial<ToolCall> = {}): ToolCall {
  const time = new Date(now.getTime() - index * 60_000).toISOString();
  const cwd = `${repository}/src`;
  const input = { command: `command-${index}` };
  const event = {
    tool_name: "Bash", tool_use_id: `call-${index}`, session_id: "session-main",
    turn_id: "turn-1", cwd, tool_input: input,
  };
  const metadata = { git: { root: repository, branch: "main", dirty: false } };
  const pre: LogRecord = { logged_at: time, event: { ...event, hook_event_name: "PreToolUse" }, metadata };
  const output = { output: `result-${index}`, exit_code: 0 };
  const post: LogRecord = {
    logged_at: time,
    event: { ...event, hook_event_name: "PostToolUse", tool_response: output },
    metadata: { git: { ...metadata.git, branch: "feature/viewer", dirty: true, status_porcelain_v2: "? changed.ts\0" } },
  };
  return {
    id: `call-${index}`, time, tool: "Bash", session: "session-main", turn: "turn-1", cwd,
    harness: "codex", apiVersion: null, callId: `call-${index}`, message: "", agent: "", title: "", resultMetadata: null,
    status: "completed", durationMs: 120, input, output, pre, post, ...overrides,
  };
}

function contextCall(index: number, root: string, cwd: string): ToolCall {
  const value = call(index);
  const record = (source: LogRecord | null): LogRecord | null => source && ({
    ...source,
    event: { ...source.event, cwd },
    metadata: { git: { root, branch: "main", dirty: false } },
  });
  return { ...value, cwd, pre: record(value.pre), post: record(value.post) };
}

function snapshot(calls: ToolCall[]): Snapshot {
  return {
    homeDirectory: home, harnesses: [{ harness: "codex", label: "Codex", apiVersion: null, calls,
      source: `${home}/.codex/logs/codex-tool-calls.jsonl`, missing: false, truncated: false,
      skipped: 0, totalEvents: calls.length * 2 }], demo: false,
  };
}

function openCodeV1Snapshot(): Snapshot {
  const time = now.toISOString();
  const pre: LogRecord = { logged_at: time, harness: "opencode", api_version: 1, hook: "tool.execute.before",
    event: { input: { tool: "bash", sessionID: "v1-session", callID: "v1-call" }, output: { args: { command: "pwd" } } } };
  const post: LogRecord = { logged_at: new Date(now.getTime() + 50).toISOString(), harness: "opencode", api_version: 1,
    hook: "tool.execute.after", event: { input: { tool: "bash", sessionID: "v1-session", callID: "v1-call", args: { command: "pwd" } },
      output: { title: "Working directory", output: "/work", metadata: { exit: 0 } } } };
  const value: ToolCall = {
    id: "v1-call", harness: "opencode", apiVersion: 1, time, tool: "bash", session: "v1-session", turn: "",
    callId: "v1-call", message: "", agent: "", title: "Working directory", cwd: "/work", status: "completed",
    durationMs: 50, input: { command: "pwd" }, output: "/work", resultMetadata: { exit: 0 }, pre, post,
  };
  return { harnesses: [{ harness: "opencode", label: "OpenCode", apiVersion: 1, calls: [value], source: "/logs/opencode-tool-calls.jsonl",
    missing: false, truncated: false, skipped: 0, totalEvents: 2 }], demo: false };
}

async function mockSnapshot(page: Page, calls: ToolCall[]): Promise<void> {
  await page.clock.install({ time: now });
  await page.route("**/api/logs", (route) => route.fulfill({ json: snapshot(calls) }));
  await page.goto("/");
  await expect(page.locator("#stat-calls")).toHaveText(String(calls.length));
}

test("committed Codex test data renders through the server", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#demo")).toHaveText("TEST DATA");
  await expect(page.locator("#stat-calls")).toHaveText("8");
  await expect(page.locator("#stat-completed")).toHaveText("7");
  await expect(page.locator("#stat-awaiting")).toHaveText("1");
  await expect(page.locator("#event-count")).toHaveText("14 events");
  await expect(page.locator("#source")).toHaveText("test-data/codex/codex-tool-calls.jsonl");
  await expect(page.locator("#rows > tr")).toHaveCount(8);
  await expect(page.getByLabel("Filter by repository").locator("option")).toContainText([
    "api — ~/archive/api",
    "api — ~/work/clients/api",
    "tool-logger",
  ]);
  await page.getByLabel("Filter by status").selectOption("awaiting");
  await expect(page.locator("#rows > tr")).toHaveCount(1);
  await expect(page.locator("#rows")).toContainText("notes.txt");
  await expect(page.getByRole("navigation", { name: "Available harnesses" }).getByRole("button")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Codex tool activity" })).toHaveAttribute("aria-current", "page");
});

test("harness navigation selects native OpenCode view and keeps selection in the URL", async ({ page }) => {
  await page.goto("/?harness=opencode");
  await expect(page.getByRole("heading", { name: "OpenCode activity." })).toBeVisible();
  await expect(page.getByRole("button", { name: "OpenCode tool activity" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("#source")).toHaveText("test-data/opencode-v2/opencode-tool-calls.jsonl");
  await expect(page.locator("#rows > tr")).toHaveCount(3);
  await expect(page.locator("#rows")).toContainText("Failed");
  await expect(page.getByLabel("Filter by agent")).toHaveValue("all");
  await page.getByLabel("Filter by agent").selectOption("explore");
  await expect(page.locator("#rows > tr")).toHaveCount(1);
  await page.locator("#rows > tr").click();
  const details = page.getByRole("dialog", { name: "Tool call details" });
  await expect(details).toContainText("OpenCode V2");
  await expect(details).toContainText("msg-2");
  await expect(details).toContainText("explore");
  await expect(details).toContainText("oc-v2-call-2");
  await page.getByRole("button", { name: "Close call details" }).click();
  await page.getByRole("button", { name: "Codex tool activity" }).click();
  await expect(page).toHaveURL(/\?harness=codex$/);
  await expect(page.getByRole("heading", { name: "Codex activity." })).toBeVisible();
  await expect(page.getByLabel("Filter by agent")).toHaveCount(0);
});

test("invalid harness URL falls back alphabetically", async ({ page }) => {
  await page.goto("/?harness=missing");
  await expect(page.getByRole("button", { name: "Codex tool activity" })).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL(/\?harness=codex$/);
});

test("OpenCode V1 view exposes title and result metadata without V2-only controls", async ({ page }) => {
  await page.route("**/api/logs", (route) => route.fulfill({ json: openCodeV1Snapshot() }));
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Available harnesses" }).getByRole("button")).toHaveCount(1);
  await expect(page.getByLabel("Filter by agent")).toHaveCount(0);
  await expect(page.locator("#rows")).toContainText("Result received");
  await page.locator("#rows > tr").click();
  const details = page.getByRole("dialog", { name: "Tool call details" });
  await expect(details).toContainText("Working directory");
  await page.getByRole("tab", { name: "Result", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toHaveText(JSON.stringify({ output: "/work", metadata: { exit: 0 } }, null, 2));
});

test("no-source state offers no harness choices", async ({ page }) => {
  const empty: Snapshot = { harnesses: [], demo: false };
  await page.route("**/api/logs", (route) => route.fulfill({ json: empty }));
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Available harnesses" }).getByRole("button")).toHaveCount(0);
  await expect(page.getByText("No harness data")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Waiting for your first tool call" })).toBeVisible();
  await expect(page.locator("#empty-message")).toContainText("Available harnesses appear in the navigation");
});

test("filters calls, updates statistics, resets and focuses search with /", async ({ page }) => {
  await mockSnapshot(page, [
    call(0),
    call(1, { tool: "read_file", session: "session-secondary", status: "awaiting", post: null, output: null, durationMs: null }),
    call(120),
  ]);
  await expect(page.locator("#stat-completed")).toHaveText("2");
  await expect(page.locator("#stat-awaiting")).toHaveText("1");
  await expect(page.locator("#source")).toHaveText("~/.codex/logs/codex-tool-calls.jsonl");
  await page.keyboard.press("/");
  await expect(page.getByRole("searchbox", { name: "Search tool calls" })).toBeFocused();
  await page.getByRole("searchbox").fill("command-120");
  await expect(page.locator("#rows > tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByLabel("Filter by status").selectOption("awaiting");
  await expect(page.locator("#stat-calls")).toHaveText("1");
  await expect(page.locator("#rows")).toContainText("read_file");
  await page.getByLabel("Filter by tool").selectOption("Bash");
  await expect(page.getByRole("heading", { name: "No matching calls" })).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByLabel("Filter by session").selectOption("session-secondary");
  await expect(page.locator("#rows > tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByLabel("Filter by time").selectOption("1");
  await expect(page.locator("#stat-calls")).toHaveText("2");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByTitle("Filter by read_file", { exact: true }).click();
  await expect(page.getByLabel("Filter by tool")).toHaveValue("read_file");
  await expect(page.locator("#rows > tr")).toHaveCount(1);
});

test("context filters retain exact paths while displaying home and duplicate repository labels", async ({ page }) => {
  await mockSnapshot(page, [
    contextCall(0, repository, `${repository}/src`),
    contextCall(1, repository, `${repository}/src/nested`),
    contextCall(2, otherRepository, `${otherRepository}/src`),
  ]);
  const repositories = page.getByLabel("Filter by repository");
  await expect(repositories.locator("option")).toHaveText([
    "All repositories", "project — ~/archive/project", "project — ~/work/project",
  ]);
  await repositories.selectOption(repository);
  await expect(page.locator("#rows > tr")).toHaveCount(2);
  await page.getByLabel("Filter by directory").selectOption(`${repository}/src`);
  await expect(page.locator("#rows > tr")).toHaveCount(1);
  await expect(page.locator("#rows")).toContainText("command-0");
  await expect(page.locator("#rows")).not.toContainText("nested");
  await repositories.selectOption(otherRepository);
  await expect(page.getByRole("heading", { name: "No matching calls" })).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator("#rows > tr")).toHaveCount(3);
});

test("show more reveals subsequent calls and filtering resets the page size", async ({ page }) => {
  await mockSnapshot(page, Array.from({ length: 205 }, (_, index) => call(index)));
  await expect(page.locator("#rows > tr")).toHaveCount(100);
  await page.getByRole("button", { name: "Show more" }).click();
  await expect(page.locator("#rows > tr")).toHaveCount(200);
  await page.getByRole("button", { name: "Show more" }).click();
  await expect(page.locator("#rows > tr")).toHaveCount(205);
  await expect(page.getByRole("button", { name: "Show more" })).toBeHidden();
  await page.getByRole("searchbox").fill("command-");
  await expect(page.locator("#rows > tr")).toHaveCount(100);
  await expect(page.locator("#stat-calls")).toHaveText("205");
});

test("polling pauses, preserves data on failure and recovers", async ({ page }) => {
  await page.clock.install({ time: now });
  let requests = 0;
  let fail = false;
  let calls = [call(0)];
  await page.route("**/api/logs", async (route) => {
    requests += 1;
    await route.fulfill(fail ? { status: 503, body: "Unavailable" } : { json: snapshot(calls) });
  });
  await page.goto("/");
  await expect(page.locator("#rows > tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Live updates" }).click();
  await expect(page.getByRole("button", { name: "Updates paused" })).toHaveAttribute("aria-pressed", "false");
  const pausedCount = requests;
  await page.clock.runFor(6000);
  expect(requests).toBe(pausedCount);
  fail = true;
  await page.getByRole("button", { name: "Updates paused" }).click();
  await page.clock.runFor(2000);
  await expect(page.getByRole("alert")).toContainText("HTTP 503");
  await expect(page.locator("#rows > tr")).toHaveCount(1);
  await expect(page.locator("#updated")).toHaveText("Connection interrupted");
  fail = false;
  calls = [call(0), call(1)];
  await page.clock.runFor(2000);
  await expect(page.locator("#rows > tr")).toHaveCount(2);
  await expect(page.getByRole("alert")).toBeHidden();
  await expect(page.locator("#updated")).toContainText("Updated");
});

test("slow requests never overlap, time out after eight seconds and recover from invalid data", async ({ page }) => {
  await page.clock.install({ time: now });
  let requests = 0;
  let response: "valid" | "pending" | "invalid" = "valid";
  let calls = [call(0)];
  await page.route("**/api/logs", async (route) => {
    requests += 1;
    // Leave this request pending until the client's timeout aborts it.
    if (response === "pending") return;
    await route.fulfill({ json: response === "invalid" ? { calls: "not a snapshot" } : snapshot(calls) });
  });
  await page.goto("/");
  await expect(page.locator("#rows > tr")).toHaveCount(1);
  response = "pending";
  await page.clock.runFor(2000);
  await expect.poll(() => requests).toBe(2);
  await page.clock.runFor(6000);
  expect(requests).toBe(2);
  await expect(page.getByRole("alert")).toBeHidden();
  await page.clock.runFor(2000);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator("#updated")).toHaveText("Connection interrupted");
  await expect(page.locator("#rows > tr")).toHaveCount(1);
  expect(requests).toBe(2);
  response = "invalid";
  await page.clock.runFor(2000);
  await expect(page.getByRole("alert")).toContainText("Unexpected log response");
  await expect(page.locator("#rows > tr")).toHaveCount(1);
  response = "valid";
  calls = [call(0), call(1)];
  await page.clock.runFor(2000);
  await expect(page.locator("#rows > tr")).toHaveCount(2);
  await expect(page.getByRole("alert")).toBeHidden();
});

test("inspector tabs, clipboard, Git snapshots and keyboard focus preserve behavior", async ({ page, context }) => {
  const value = call(0);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await mockSnapshot(page, [value]);
  const row = page.locator("#rows > tr").first();
  await row.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Tool call details" });
  const close = page.getByRole("button", { name: "Close call details" });
  await expect(dialog).toBeVisible();
  await expect(close).toBeFocused();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("tabpanel")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await expect(page.getByRole("tabpanel")).toHaveText(JSON.stringify(value.input, null, 2));
  await page.getByRole("tab", { name: "Result", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Result", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveText(JSON.stringify(value.output, null, 2));
  await page.getByRole("button", { name: "Copy JSON", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(JSON.stringify(value.output, null, 2));
  await page.getByRole("tab", { name: "Raw events" }).click();
  await expect(page.getByRole("tabpanel")).toHaveText(JSON.stringify({ before: value.pre, after: value.post }, null, 2));
  await page.getByText("Git snapshots", { exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Before tool" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "After tool" })).toBeVisible();
  await expect(page.locator("#git-snapshots")).toContainText("Clean");
  await expect(page.locator("#git-snapshots")).toContainText("Has changes");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(row).toBeFocused();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});

test("payload HTML remains text and production assets run without CSP violations", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.text().startsWith("CSP violation:")) errors.push(message.text());
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      console.error(`CSP violation: ${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  const payload = '<img src="/injected-image" onerror="document.title=\'injected\'">';
  const input = { command: payload };
  const output = { html: payload };
  const value = call(0, { input, output });
  if (value.pre) value.pre.event.tool_input = input;
  if (value.post) value.post.event.tool_response = output;
  await mockSnapshot(page, [value]);
  await expect(page.locator("#rows")).toContainText(payload);
  await page.locator("#rows > tr").click();
  await expect(page.getByRole("tabpanel")).toContainText(payload.replaceAll('"', '\\"'));
  await expect(page.locator('img[src="/injected-image"]')).toHaveCount(0);
  await page.getByRole("tab", { name: "Result", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText("injected-image");
  await page.getByRole("tab", { name: "Raw events" }).click();
  await expect(page.getByRole("tabpanel")).toHaveText(JSON.stringify({ before: value.pre, after: value.post }, null, 2));
  await expect(page.locator('img[src="/injected-image"]')).toHaveCount(0);
  await expect(page).toHaveTitle("Tool activity · Tool Logger");
  const brand = page.getByRole("link", { name: "Tool Logger home" });
  await expect(brand).toBeVisible();
  await expect(brand.locator(".brand-mark")).toHaveText("tl");
  await expect(brand).toContainText("toollogger");
  expect(errors).toEqual([]);
});

test("typography tokens scale with the browser root size", async ({ page }) => {
  await mockSnapshot(page, [call(0)]);
  await expect(page.locator("body")).toHaveCSS("font-size", "16px");
  await expect(page.getByRole("heading", { name: "Codex activity." })).toHaveCSS("font-size", "32px");
  await page.evaluate(() => { document.documentElement.style.fontSize = "125%"; });
  await expect(page.locator("body")).toHaveCSS("font-size", "20px");
  await expect(page.getByRole("heading", { name: "Codex activity." })).toHaveCSS("font-size", "40px");
  await expect(page.locator(".tool-title")).toHaveCSS("font-size", "17.5px");
});

test("live updates preserve inspector state and eviction restores focus without stale selection", async ({ page }) => {
  await page.clock.install({ time: now });
  let current = snapshot([call(0), call(1)]);
  await page.route("**/api/logs", (route) => route.fulfill({ json: current }));
  await page.goto("/");
  await expect(page.locator("#rows > tr")).toHaveCount(2);
  await page.locator("#rows > tr").first().click();
  await page.getByRole("tab", { name: "Result", exact: true }).click();
  current = snapshot([call(0, { output: { output: "updated result" } }), call(1)]);
  await page.clock.runFor(2000);
  await expect(page.getByRole("tabpanel")).toContainText("updated result");
  await expect(page.getByRole("tab", { name: "Result", exact: true })).toHaveAttribute("aria-selected", "true");
  current = snapshot([call(1)]);
  await page.clock.runFor(2000);
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("searchbox")).toBeFocused();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await page.locator("#rows > tr").click();
  await expect(page.getByRole("tab", { name: "Input", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toContainText("command-1");
});

test("mobile preserves responsive containers, horizontal table scrolling and call inspection", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSnapshot(page, [call(0)]);
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.getByLabel("Select harness")).toBeVisible();
  await expect(page.getByRole("searchbox")).toBeVisible();
  for (const selector of [".shell", ".page-heading", ".filters", ".context-filters", ".table-wrap"]) {
    const bounds = await page.locator(selector).boundingBox();
    if (!bounds) throw new Error(`Missing mobile container: ${selector}`);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  }
  await expect(page.locator(".table-wrap")).toHaveCSS("overflow-x", "auto");
  expect(await page.locator(".table-wrap").evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await page.locator("#rows > tr").click();
  const dialog = page.getByRole("dialog", { name: "Tool call details" });
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds?.x).toBe(0);
  expect(bounds?.width).toBe(390);
  await page.getByRole("button", { name: "Close call details" }).click();
  await expect(dialog).toBeHidden();
});

test("tablet and desktop preserve the shared responsive hierarchy", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await mockSnapshot(page, [call(0)]);
  await expect(page.locator(".sidebar")).toHaveCSS("width", "64px");
  await expect(page.locator(".shell")).toHaveCSS("margin-left", "64px");
  expect(await page.locator(".stats").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(2);
  expect(await page.locator(".charts").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(1);
  await expect(page.locator(".tools-panel")).toBeVisible();

  await page.setViewportSize({ width: 1200, height: 900 });
  await expect(page.locator(".sidebar")).toHaveCSS("width", "224px");
  await expect(page.locator(".shell")).toHaveCSS("margin-left", "224px");
  await expect(page.locator(".stats > article")).toHaveCount(4);
  const chartColumns = await page.locator(".charts").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  expect(chartColumns).toBe(2);
});
