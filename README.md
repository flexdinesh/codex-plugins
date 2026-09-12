# Tool Logger

Log tool activity from supported coding harnesses and inspect it in a local web UI.

Requires macOS or Linux, Node.js 26, pnpm 11, and a supported Codex or OpenCode installation.

## Packages

- `plugins/codex-tool-logger`: working Codex hooks and collector.
- `plugins/opencode-tool-logger`: OpenCode V1/V2 plugin and collector.
- `apps/viewer`: read-only Vite and React web UI plus its Node.js server.

## Add the Codex plugin

From this repository:

```sh
pnpm install
pnpm run link:codex codex-tool-logger
```

If `tool-call-logger@tool-logger` was installed previously, remove it first. Keeping
both IDs installed runs duplicate hooks.

Then:

1. Restart Codex.
2. Open `/hooks` in Codex.
3. Review and trust the two Codex Tool Logger hooks.
4. Start a new task and use any tool.

The trusted hooks capture each tool call before and after it runs, then append the
events to `~/.local/state/tool-logger/codex-tool-calls.jsonl`. Harness plugins use
separate files in the same directory. Set `TOOL_LOGGER_STATE_DIR` to override that
shared directory. Nothing is published.

The viewer reads each available harness log independently. For Codex, it prefers
`codex-tool-calls.jsonl`; if absent, it reads legacy `tool-calls.jsonl` in place
without renaming, copying, or deleting it.

## Add the OpenCode plugin

From this repository:

```sh
pnpm install
pnpm run link:opencode opencode-tool-logger
```

The linker detects the installed OpenCode generation and installs one global local
plugin link. Restart OpenCode after linking. V2 wins when both generations exist:
its first activation deletes the older `opencode-tool-calls.jsonl` data and
permanently suppresses V1 writes in that state directory.

OpenCode events append to
`~/.local/state/tool-logger/opencode-tool-calls.jsonl`. The shared
`TOOL_LOGGER_STATE_DIR` override applies to both harnesses.

## Run the viewer

With Docker Compose:

```sh
mkdir -p ~/.local/state/tool-logger
docker compose up -d
```

Or run the server directly through the viewer workspace:

```sh
pnpm --filter viewer build
pnpm --filter viewer start
```

`start` reads available harness logs from the configured state directory. Select
the harness from the left navigation. For UI development, run
`pnpm --filter viewer dev`; it reads the committed Codex and OpenCode synthetic
fixtures and rebases their timestamps to the current time. Run
`pnpm --filter viewer test-data` to serve those fixtures from a production build.

The direct server prints every IPv4 URL:

```text
Viewer:
  lo0: http://127.0.0.1:4317
  en0: http://192.168.1.20:4317
```

- Open `http://127.0.0.1:4317` on the same machine.
- Open `http://<LAN-IP>:4317` from another machine on the same network.
- Set `PORT=4318` before either start command to change the port.
- Set `HOST=127.0.0.1` before the direct start command to disable LAN access.

> The viewer shows unredacted tool inputs and results. Only expose it on a trusted network.
