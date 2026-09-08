import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { CATALOG, ROOT, check, linkPlugin, newPlugin, readJson, writeJson } from '../scripts/workspace.ts';

function fixture(t: TestContext) {
  const temp = mkdtempSync(join(tmpdir(), 'codex workspace '));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const root = join(temp, 'repo');
  cpSync(join(ROOT, 'plugins'), join(root, 'plugins'), { recursive: true });
  mkdirSync(dirname(join(root, CATALOG)), { recursive: true });
  cpSync(join(ROOT, CATALOG), join(root, CATALOG));
  const codexHome = join(temp, 'codex');
  const source = join(root, 'plugins/tool-call-logger');
  const version = readJson(join(source, '.codex-plugin/plugin.json')).version;
  assert.equal(typeof version, 'string');
  const cache = join(codexHome, 'plugins/cache/local-codex-plugins/tool-call-logger', String(version));
  return { temp, root, codexHome, cache, source };
}

test('new plugin is an independent native TypeScript package and registered once', (t) => {
  const f = fixture(t);
  const original = readFileSync(join(f.source, '.codex-plugin/plugin.json'));
  newPlugin(f.root, 'example-two');
  assert.deepEqual(check(f.root).plugins.map((entry) => entry.name), ['tool-call-logger', 'example-two']);
  const created = join(f.root, 'plugins/example-two');
  assert.ok(existsSync(join(created, 'skills/example-two/SKILL.md')));
  assert.deepEqual(readJson(join(created, 'package.json')), {
    name: 'example-two', private: true, type: 'module', engines: { node: '26.x', pnpm: '11.x' },
  });
  assert.deepEqual(readFileSync(join(f.source, '.codex-plugin/plugin.json')), original);
  const catalog = readFileSync(join(f.root, CATALOG));
  assert.throws(() => newPlugin(f.root, 'example-two'), /already exists/);
  assert.deepEqual(readFileSync(join(f.root, CATALOG)), catalog);
  const script = join(created, 'example.ts');
  writeFileSync(script, 'const value: string = "native"; console.log(value); export {};\n');
  assert.equal(execFileSync(process.execPath, [script], { encoding: 'utf8' }).trim(), 'native');
});

test('rejects unsafe names without changing the catalog', (t) => {
  const f = fixture(t);
  const catalog = readFileSync(join(f.root, CATALOG));
  for (const name of ['', '../escape', 'Upper', 'has space', 'foo/bar']) {
    assert.throws(() => newPlugin(f.root, name), /kebab-case/);
  }
  assert.deepEqual(readFileSync(join(f.root, CATALOG)), catalog);
});

test('check rejects missing and escaping component paths', (t) => {
  const f = fixture(t);
  const path = join(f.source, '.codex-plugin/plugin.json');
  const manifest = readJson(path);
  writeJson(path, { ...manifest, hooks: './missing.json' });
  assert.throws(() => check(f.root), /ENOENT/);
  const outside = join(f.temp, 'outside.json');
  writeJson(outside, {});
  symlinkSync(outside, join(f.source, 'escape.json'));
  writeJson(path, { ...manifest, hooks: './escape.json' });
  assert.throws(() => check(f.root), /escapes its root/);
});

test('link preserves installed copy, points to live source, and is idempotent', (t) => {
  const f = fixture(t);
  const calls: string[][] = [];
  const options = {
    codexHome: f.codexHome,
    runCodex: (args: string[]) => {
      calls.push(args);
      if (args[1] === 'add') cpSync(f.source, f.cache, { recursive: true });
    },
  };
  linkPlugin(f.root, 'tool-call-logger', options);
  assert.deepEqual(calls, [
    ['plugin', 'marketplace', 'add', f.root],
    ['plugin', 'add', 'tool-call-logger@local-codex-plugins'],
  ]);
  assert.ok(lstatSync(f.cache).isDirectory(), 'Codex discovery requires a real version directory');
  assert.equal(lstatSync(f.cache).isSymbolicLink(), false);
  for (const entry of readdirSync(f.source)) {
    if (entry === '.codex-plugin') {
      assert.ok(lstatSync(join(f.cache, entry)).isDirectory());
      assert.equal(lstatSync(join(f.cache, entry)).isSymbolicLink(), false);
      assert.deepEqual(readJson(join(f.cache, entry, 'plugin.json')), readJson(join(f.source, entry, 'plugin.json')));
      continue;
    }
    assert.ok(lstatSync(join(f.cache, entry)).isSymbolicLink());
    assert.equal(realpathSync(join(f.cache, entry)), realpathSync(join(f.source, entry)));
  }
  writeFileSync(join(f.source, 'scripts/changed.ts'), 'export const value = "live edit";');
  assert.equal(readFileSync(join(f.cache, 'scripts/changed.ts'), 'utf8'), 'export const value = "live edit";');
  writeFileSync(join(f.source, 'new-root-file.txt'), 'new entry');
  linkPlugin(f.root, 'tool-call-logger', options);
  assert.equal(readFileSync(join(f.cache, 'new-root-file.txt'), 'utf8'), 'new entry');
  assert.equal(calls.length, 2);
  const backups = join(f.codexHome, 'plugins/local-link-backups');
  const names = readdirSync(backups);
  assert.equal(names.length, 1);
  const backup = names[0];
  assert.ok(backup);
  assert.ok(existsSync(join(backups, backup, '.codex-plugin/plugin.json')));
});

test('relink repairs symlinked manifests and refreshes manifest edits', (t) => {
  const f = fixture(t);
  mkdirSync(f.cache, { recursive: true });
  for (const entry of readdirSync(f.source)) symlinkSync(join(realpathSync(f.source), entry), join(f.cache, entry));
  const path = join(f.source, '.codex-plugin/plugin.json');
  writeJson(path, { ...readJson(path), description: 'Updated manifest' });
  linkPlugin(f.root, 'tool-call-logger', {
    codexHome: f.codexHome, runCodex: () => assert.fail('already registered'),
  });
  assert.ok(lstatSync(join(f.cache, '.codex-plugin')).isDirectory());
  assert.equal(readJson(join(f.cache, '.codex-plugin/plugin.json')).description, 'Updated manifest');
  writeJson(path, { ...readJson(path), description: 'Refreshed again' });
  linkPlugin(f.root, 'tool-call-logger', {
    codexHome: f.codexHome, runCodex: () => assert.fail('already registered'),
  });
  assert.equal(readJson(join(f.cache, '.codex-plugin/plugin.json')).description, 'Refreshed again');
});

test('link refuses existing installs and unrelated links before invoking Codex', (t) => {
  const f = fixture(t);
  mkdirSync(f.cache, { recursive: true });
  const options = { codexHome: f.codexHome, runCodex: () => assert.fail('must not invoke Codex') };
  assert.throws(() => linkPlugin(f.root, 'tool-call-logger', options), /cache already exists/);
  rmSync(f.cache, { recursive: true });
  symlinkSync(f.temp, f.cache, 'dir');
  assert.throws(() => linkPlugin(f.root, 'tool-call-logger', options), /unrelated link/);
});

test('link rejects versions that could escape the cache directory', (t) => {
  const f = fixture(t);
  const path = join(f.source, '.codex-plugin/plugin.json');
  const manifest = readJson(path);
  for (const version of ['../escape', '/tmp/escape', '.', '..']) {
    writeJson(path, { ...manifest, version });
    assert.throws(() => linkPlugin(f.root, 'tool-call-logger', {
      codexHome: f.codexHome,
      runCodex: () => assert.fail('must not invoke Codex'),
    }), /safe cache directory/);
  }
});

test('workspace CLI runs natively and rejects invalid invocations', () => {
  const script = join(ROOT, 'scripts/workspace.ts');
  assert.match(execFileSync(process.execPath, [script, 'check'], { encoding: 'utf8' }), /Validated 1 local plugin/);
  const result = spawnSync(process.execPath, [script, 'new'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /usage:/);
});
