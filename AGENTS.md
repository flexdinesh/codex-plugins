# Local plugin workspace

- Keep plugins self-contained under `plugins/<name>/`.
- Keep applications under `apps/<name>/`, with their own package.json scripts.
- Each plugin is a private pnpm workspace package. Use pnpm 11 and keep pnpm-lock.yaml current.
- Register each plugin in `.agents/plugins/marketplace.json`.
- Use local sources only. No publishing or runtime dependency on this repository's scripts.
- Use TypeScript that runs directly on Node.js 26. Erasable syntax only; no build step for hooks, scripts, or servers. The viewer frontend uses React TSX and a Vite build.
- Keep hook runtime dependencies limited to Node built-ins. Type-check with strict TypeScript.
- Hook stdout affects Codex. Logging hooks must stay silent on stdout and never block tools.
- Preserve append-only logging and serialization across concurrent processes.
- Define development commands in package.json scripts; use pnpm to run them.
- Run `pnpm check` after changing plugin behavior or workspace tooling.
