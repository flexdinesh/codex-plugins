# Tool Logger

Log tool activity from supported coding harnesses and inspect it in a local web UI.

Requires macOS or Linux, Node.js 26, pnpm 11, and Codex with plugins and hooks enabled.

## Packages

- `plugins/codex-tool-logger`: working Codex hooks and collector.
- `plugins/opencode-tool-logger`: placeholder only; implementation is out of scope.
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
events to `~/.local/state/tool-logger/codex-tool-calls.jsonl`. Future harness plugins
use separate files in the same directory. Set `TOOL_LOGGER_STATE_DIR` to override
that shared directory. Nothing is published.

The viewer prefers `codex-tool-calls.jsonl`. If it is absent, the viewer reads the
legacy `tool-calls.jsonl` in place without renaming, copying, or deleting it.

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

`start` reads real logs from the configured state directory. For UI development,
run `pnpm --filter viewer dev`; it reads the committed synthetic fixture at
`test-data/codex/codex-tool-calls.jsonl` and rebases its timestamps to the current
time. Run `pnpm --filter viewer test-data` to serve the same fixture from a
production build.

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
