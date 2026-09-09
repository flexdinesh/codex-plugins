# Local Codex plugins

A workspace for independent plugins loaded directly from this checkout. A pnpm
monorepo with one package per plugin and app. Plugins need no publishing or build
step; hooks and servers run native TypeScript using Node built-ins. The viewer
frontend uses React and Vite.

Requires macOS/Linux, Node.js 26, pnpm 11, and Codex with plugin and hook support.
Catalog discovery verified with Codex CLI 0.153.4.

```text
.agents/plugins/marketplace.json   Local catalog; one entry per plugin
plugins/
  tool-call-logger/
    .codex-plugin/plugin.json      Plugin identity and component paths
    hooks/hooks.json              Tool lifecycle subscriptions
    package.json                  Independent private ESM package
    scripts/log-tool-call.ts      Append-only JSONL writer
scripts/workspace.ts              Scaffold, validate, and link
tests/                            Native Node test runner
apps/viewer/                      React/Vite app and native Node log API
  src/client/                    React components, hooks, and CSS
  src/server.ts                  API, Vite development middleware, built assets
  src/model.ts                   Shared data types and validation
pnpm-workspace.yaml               Workspace packages: plugins/* and apps/*
tsconfig.json                     Strict, erasable-only TypeScript; no emit
```

## Use the logger

From this directory:

```sh
pnpm install
pnpm --filter viewer test:install
pnpm check
pnpm run link tool-call-logger
```

`pnpm run link` registers this directory as a **local** marketplace, installs the
selected plugin through `codex plugin add`, preserves its initial cached copy
under `~/.codex/plugins/local-link-backups/`, and links each cache entry's contents
to `plugins/<name>` in this checkout. It respects an existing `CODEX_HOME`.
The cache directory uses the plugin's manifest version, such as
`plugins/cache/local-codex-plugins/tool-call-logger/0.2.0` inside Codex's home.
Its root and `.codex-plugin/` must remain real directories: Codex rejects their
symlinked equivalents. The manifest is copied during linking.
Scripts and component directories are symlinks, so edits appear immediately.
Re-run the link command after manifest edits or adding a new file or directory at
a plugin's root. Restart Codex after changing definitions.
This is a development helper around Codex's copy-based installer, not a native
Codex link command. Nothing is uploaded.

Restart Codex after linking. In the CLI, open `/hooks`, review the logger's two
hooks, and trust them. Codex skips untrusted hooks even when the plugin is
enabled. Hooks must also be enabled in Codex settings (`features.hooks` defaults
to `true`). See [Codex hook trust](https://learn.chatgpt.com/docs/hooks#review-and-trust-hooks).

Run a tool in a new task, then inspect the log:

```sh
tail -f ~/.local/state/codex-plugins/tool-calls.jsonl
```

The file is created on the first hook event. There is no need to invoke a skill
or mention the logger in each prompt. Node 26 must be available as `node` in
Codex's hook environment. The plugin has its own `package.json`, so copied and
symlinked installs can run independently of this repository.

## View tool-call logs

```sh
pnpm viewer
```

This builds the frontend and starts the Node server. Open
[the viewer](http://127.0.0.1:4317). It reads the logger's JSONL file, refreshes
every two seconds, and shows activity charts, tool counts, paired-call durations,
filters, and an inspector for inputs, results, and original hook events.
Repository labels use the Git root folder name; duplicate names include their
paths for clarity. Repository and directory filters use exact full paths and combine with the other
filters. Paths under your home display as `~/…`; the logger records the host home
in `state.json` beside the log, so this also works inside Docker. Raw events and filter
values retain full paths. Each row shows its repository, branch, and directory; expand **Git
snapshots** in the inspector for before/after commit, upstream, divergence,
working-tree state, and recorded Git status. These are historical hook snapshots,
not live Git queries. Missing metadata is shown as unknown; no plugin update is
needed for existing enriched logs.

The logger creates `state.json` once, privately and atomically, containing
`{"schema_version":1,"home_directory":"/Users/yourname"}`. It never overwrites
existing state. Metadata failures do not stop log appends. The viewer leaves paths
unchanged if state is missing or invalid.

The server defaults to `127.0.0.1` and never modifies the log. `HOST` overrides
the bind address for containers. It honors
`CODEX_PLUGINS_STATE_DIR`; `PORT` overrides the default port of `4317`.
If no log exists yet, the app waits for the logger to create it.

```sh
pnpm --filter viewer dev           # One port; React/CSS hot updates, Node watch
pnpm --filter viewer dev --demo    # Development with labeled sample data
pnpm --filter viewer build         # Create production assets in dist/
pnpm --filter viewer start         # Serve an existing production build
pnpm --filter viewer demo          # Build and preview labeled sample data
pnpm --filter viewer test          # Build, Node tests, Chromium browser tests
pnpm --filter viewer test:install  # Install Chromium once, or after upgrades
```

The viewer reads at most the last 8 MiB and displays up to 2,000 valid events.
Incomplete final lines wait for the next refresh; malformed records are skipped
and counted. “Awaiting result” means no matching post-event in that window, which
can also mean interrupted/denied calls or a window boundary. Durations measure
hook timestamps, not exact tool runtime. Server and browser code are TypeScript.
The backend runs directly on Node 26; Vite builds React TSX and CSS into `dist/`.
Development uses Vite middleware on the same Node server and port. Production
requires a build and does not load Vite or serve source files. Run `pnpm viewer`
again after production source changes. Log polling waits two seconds after each
request completes, times out after eight seconds, and retains the last successful
view during connection failures.

The React tree starts with `ViewerProvider`, which owns log/connection data,
filters, pagination, selected call, and payload tab in one reducer. Snapshot
updates reconcile filters and selection atomically. Feature components in
`src/client/features/` connect the activity overview, call explorer, and inspector
to separate state/action contexts; `components/` holds their rendering pieces.
Filter logic is framework-independent under `state/`. Clipboard feedback remains
local to its button, and dialog focus/scroll effects live in a dedicated hook;
DOM refs are kept outside reducer state. `App` only composes the feature tree.

Typography is defined in `src/client/styles.css`. Named `--font-size-*` tokens use
`rem`, with an 81.25% root size (13px at the browser default). Ordinary text uses
`1rem`; only captions and secondary text step below it, while headings and display
values step upward. Browser text-size preferences scale the whole interface.
Components consume those tokens instead of pixel font sizes. Tracking uses `em`
and line heights are unitless, keeping both proportional to the active text size.

### Run with Docker Compose

Requires Docker with Compose running. From this repository:

```sh
mkdir -p ~/.local/state/codex-plugins
docker compose up --build -d --wait
```

Open [the viewer](http://127.0.0.1:4317). Stop any existing `pnpm viewer` server
first, or use `PORT=4318 docker compose up --build -d --wait` and open port 4318.

```sh
docker compose logs -f viewer
docker compose down
```

Equivalent pnpm scripts: `pnpm viewer:docker`, `pnpm viewer:docker:logs`, and
`pnpm viewer:docker:stop`. `pnpm viewer:docker:build` builds the image alone.
Docker builds the frontend in a separate stage with pnpm 11 and the workspace
lockfile. The runtime image contains Node 26, native backend TypeScript, and built
frontend assets; host Node/pnpm are unnecessary when using Compose directly.
Re-run the start command after source changes to rebuild. The build context is
the repository root, restricted by `.dockerignore` to viewer sources and build
configuration.

Compose mounts `~/.local/state/codex-plugins/` at `/logs` read-only and publishes
only on `127.0.0.1`. New log records appear automatically. The directory must
exist; Compose will not create it as root. For another directory, set
`CODEX_PLUGINS_STATE_DIR` to its absolute path before starting Compose. The
container uses root to read the logger's private file permissions, with a
read-only filesystem and log mount. No log files enter the image.

## Add another plugin

```sh
pnpm run new my-plugin
pnpm install
pnpm check
pnpm run link my-plugin
```

The scaffold creates a private ESM package, manifest, a minimal explicitly invoked
skill, and a local catalog entry. `plugins/*` automatically includes it in the
pnpm workspace; `pnpm install` updates the lockfile. Edit
`plugins/my-plugin/skills/my-plugin/SKILL.md` to define the
workflow. Add hooks or an MCP server only when that plugin needs them.

For plugins, workspace scripts, and servers, run TypeScript directly with
`node path/to/script.ts`. Use explicit `.ts` import
extensions and `import type` for types. No enums, parameter properties, loaders,
or transpilation. Node strips types but does not type-check; `pnpm typecheck`
uses the root's development-only TypeScript and Node 26 type definitions.
See [Node's native TypeScript support](https://nodejs.org/docs/latest-v26.x/api/typescript.html).

`pnpm --filter my-plugin <command>` targets one package. All packages are private.
Development commands are defined in root and workspace `package.json` scripts.

Keep each plugin self-contained. Manifest component paths start with `./` and
resolve inside the plugin directory. Catalog paths resolve from this repository
root. The validator supports one path per component field; extend it if using
Codex's optional inline or multi-file manifest forms.

Edit the source files here, then start a new Codex session/restart the app to
reload definitions. Changed hook definitions may need review again. Do not move
the checkout while it is linked. A Codex reinstall or update can replace the
links with cached copies; the helper refuses to overwrite existing installs
or unrelated links. Move an existing cache copy aside before linking again.

To stop logging, disable **Tool Call Logger** in Codex. To remove a linked
installation, run:

```sh
codex plugin remove tool-call-logger@local-codex-plugins
```

Logs and source files are independent of the installation.

## Log format and guarantees

Each line is one JSON object:

```json
{"schema_version":2,"event_id":"unique-uuid","logged_at":"2026-09-08T00:00:00.000Z","event":{"hook_event_name":"PreToolUse","session_id":"session-1","turn_id":"turn-1","tool_use_id":"call-1","tool_name":"Bash","tool_input":{"command":"pwd"}},"metadata":{"collector":{},"host":{},"git":null,"transcript":null,"errors":[]}}
```

- Subscribes to every `PreToolUse` and `PostToolUse` event, without a matcher.
- Preserves the entire event, including input, response when supplied, and IDs.
  A normal completed call produces two records. Pair them using session/turn and
  tool-use IDs. A pre-event records an attempt, which can later be denied or interrupted.
- Preserves model, permission mode, transcript path, and all other Codex-supplied
  fields without filtering. Each event gets a UUID and a timestamp captured before
  enrichment. The same two hooks capture context before and after each tool call.
- Adds collector version, Node version/executable, hook PID/parent PID/cwd/plugin
  root, hostname, OS release, architecture, and timezone. These process identifiers
  describe the hook process; they are not guaranteed to identify Codex itself.
- Captures Git root, branch, commit, upstream/divergence, dirty state, and complete
  porcelain v2 status (including tracked/untracked path entries). Git reads use
  the event's cwd, falling back to the hook cwd, with optional index locking
  disabled, a shared 750 ms command budget, and a 256 KiB output limit. Missing
  Git, non-repositories, timeouts, and oversized results record unavailable context
  or errors; the original tool event is still logged.
- Adds transcript existence, file size, and modification time when a transcript
  path is provided. Transcript contents and the process environment are not copied.
  Optional context failures appear in `metadata.errors` or `metadata.git.error`.
- New records use schema version 2; existing bytes remain untouched. The viewer
  accepts both versions and shows the complete metadata under **Raw events**.
- Uses one synchronous `O_APPEND` write per record, then `fsync`. Local POSIX
  filesystems serialize these append writes across concurrent processes. Use a
  local filesystem; network filesystems such as NFS may not provide this guarantee.
  Short writes report an error without retrying fragments. Existing bytes are never
  rewritten, truncated, rotated, or pruned. Append-only is writer behavior, not
  an operating-system prohibition against other programs editing the file.
- Creates the state directory with mode `0700` and log with `0600`; preserves
  permissions on pre-existing paths. Full arguments and responses may contain
  secrets. There is no redaction or network transmission.
- Runs synchronously to finish recording before Codex proceeds. Logging errors
  go to stderr with exit status `1`; no policy decision is emitted and tools
  continue. Disk failures, hook timeouts, or crashes can still lose a record or
  leave a partial final line; the logger never rewrites history to repair it.
- Tests can set `CODEX_PLUGINS_STATE_DIR` to redirect output. By default, the
  exact directory is `~/.local/state/codex-plugins/`, regardless of `XDG_STATE_HOME`.

**Coverage limit:** Codex does not emit tool hooks for hosted tools such as web
search, `write_stdin` transport polls, or certain specialized paths. This plugin
records every tool event Codex exposes to hooks; it cannot provide a literal
audit of all tool paths. See [Codex tool coverage](https://learn.chatgpt.com/docs/hooks#tool-coverage).

## Checks

`pnpm check` validates catalog/component paths, performs strict Node and browser
type-checking, runs `node --test`, builds the viewer, and runs Playwright Chromium
tests. Run `pnpm --filter viewer test:install` after installing dependencies or
upgrading Playwright; Linux CI may use
`pnpm --filter viewer exec playwright install --with-deps chromium`.
Browser tests use an isolated local demo server and mocked responses, never
production logs. They exercise filtering, pagination, polling recovery, inspector
keyboard/copy behavior, raw payload escaping, and responsive rendering.
Node tests cover
preservation of existing log bytes, concurrent processes with large records,
private file creation, malformed inputs, write failures, symlink destinations,
hook commands launched from unrelated working directories, scaffolding, and
linking, standalone package loading, and short writes. Tests use temporary directories and simulate installation; they do not
change your Codex configuration or production log.
When the Codex CLI is installed, an integration test installs into a temporary
Codex home and queries its real `hooks/list` API. It verifies both hooks load,
remain untrusted, and execute successfully under fish when available.

Plugin format: [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins).
