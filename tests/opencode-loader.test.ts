import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

test('installed OpenCode V2 activates the linked plugin', (t) => {
  const available = spawnSync('opencode2', ['--version'], { stdio: 'ignore' });
  if (available.error || available.status !== 0) {
    t.skip('opencode2 is not installed');
    return;
  }
  const root = mkdtempSync(join(tmpdir(), 'opencode loader '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const project = join(root, 'project');
  const plugins = join(root, 'plugins');
  const state = join(root, 'state');
  mkdirSync(plugins, { recursive: true });
  mkdirSync(project);
  const entrypoint = fileURLToPath(new URL('../plugins/opencode-tool-logger/v2.ts', import.meta.url));
  symlinkSync(entrypoint, join(plugins, 'opencode-tool-logger.ts'));
  execFileSync('opencode2', ['api', '--standalone', 'v2.plugin.awaitActivation'], {
    cwd: project,
    env: { ...process.env, OPENCODE_CONFIG_DIR: root, TOOL_LOGGER_STATE_DIR: state },
    stdio: 'pipe',
    timeout: 15_000,
  });
  assert.equal(existsSync(join(state, 'opencode-v2-intent.json')), true);
  assert.equal(existsSync(join(state, 'opencode-v2-active.json')), true);
});
