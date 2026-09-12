# Tool Logger

Install the Tool Call Logger plugin and view Codex tool activity in your browser.

Requires macOS or Linux, Node.js 26, pnpm 11, and Codex with plugins and hooks enabled.

## Add the plugin

From this repository:

```sh
pnpm install
pnpm run link tool-call-logger
```

Then:

1. Restart Codex.
2. Open `/hooks` in Codex.
3. Review and trust the two Tool Call Logger hooks.
4. Start a new task and use any tool.

The trusted hooks capture each tool call before and after it runs, then append the
events to `~/.local/state/tool-logger/tool-calls.jsonl`. The viewer reads this
file. Nothing is published.

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
