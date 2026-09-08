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
  const cache = join(codexHome, 'plugins/cache/local-codex-plugins/tool-call-logger/local');
  const source = join(root, 'plugins/tool-call-logger');
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
  assert.ok(lstatSync(f.cache).isSymbolicLink());
  assert.equal(realpathSync(f.cache), realpathSync(f.source));
  writeFileSync(join(f.source, 'changed.txt'), 'live edit');
  assert.equal(readFileSync(join(f.cache, 'changed.txt'), 'utf8'), 'live edit');
  linkPlugin(f.root, 'tool-call-logger', options);
  assert.equal(calls.length, 2);
  const backups = join(f.codexHome, 'plugins/local-link-backups');
  const names = readdirSync(backups);
  assert.equal(names.length, 1);
  const backup = names[0];
  assert.ok(backup);
  assert.ok(existsSync(join(backups, backup, '.codex-plugin/plugin.json')));
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

test('workspace CLI runs natively and rejects invalid invocations', () => {
  const script = join(ROOT, 'scripts/workspace.ts');
  assert.match(execFileSync(process.execPath, [script, 'check'], { encoding: 'utf8' }), /Validated 1 local plugin/);
  const result = spawnSync(process.execPath, [script, 'new'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /usage:/);
});
