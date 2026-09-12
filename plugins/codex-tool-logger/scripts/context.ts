import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { hostname, release } from 'node:os';
import { resolve } from 'node:path';

type GitRunner = (cwd: string, args: string[], timeout: number) => string;
const GIT_BUDGET_MS = 750;

function message(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1024);
}

const runGit: GitRunner = (cwd, args, timeout) => execFileSync('git', [
  '--no-optional-locks', '-C', cwd, ...args,
], {
  encoding: 'utf8', timeout, killSignal: 'SIGKILL', maxBuffer: 256 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'],
});

function gitContext(cwd: string, git: GitRunner) {
  const deadline = performance.now() + GIT_BUDGET_MS;
  function query(args: string[]): string {
    const remaining = Math.floor(deadline - performance.now());
    if (remaining <= 0) throw new Error('Git metadata collection timed out');
    return git(cwd, args, remaining);
  }
  const root = query(['rev-parse', '--show-toplevel']).trimEnd();
  try {
    // Includes branch, commit, upstream divergence, and tracked/untracked path status.
    const status = query(['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=normal']);
    const entries = status.split('\0').filter(Boolean);
    const headers = new Map<string, string>();
    let index = 0;
    for (const entry of entries) {
      if (!entry.startsWith('# ')) break;
      const separator = entry.indexOf(' ', 2);
      if (separator > 0) headers.set(entry.slice(2, separator), entry.slice(separator + 1));
      index += 1;
    }
    return {
      root, branch: headers.get('branch.head') ?? null,
      commit: headers.get('branch.oid') ?? null,
      upstream: headers.get('branch.upstream') ?? null,
      ahead_behind: headers.get('branch.ab') ?? null,
      dirty: entries.length > index,
      status_porcelain_v2: status,
      error: null,
    };
  } catch (error) {
    return { root, branch: null, commit: null, upstream: null, ahead_behind: null,
      dirty: null, status_porcelain_v2: null, error: message(error) };
  }
}

function transcriptContext(value: unknown, cwd: string) {
  if (typeof value !== 'string' || !value) return null;
  const path = resolve(cwd, value);
  const stat = statSync(path, { throwIfNoEntry: false });
  return {
    path, exists: stat !== undefined, is_file: stat?.isFile() ?? null,
    size_bytes: stat?.size ?? null, modified_at: stat?.mtime.toISOString() ?? null,
  };
}

function pluginVersion(): string | null {
  const value: unknown = JSON.parse(readFileSync(
    new URL('../.codex-plugin/plugin.json', import.meta.url), 'utf8',
  ));
  return typeof value === 'object' && value !== null && 'version' in value
    && typeof value.version === 'string' ? value.version : null;
}

export function collectMetadata(event: Record<string, unknown>, git: GitRunner = runGit) {
  const started = performance.now();
  const errors: { source: string; message: string }[] = [];
  function optional<T>(source: string, collect: () => T): T | null {
    try { return collect(); }
    catch (error) { errors.push({ source, message: message(error) }); return null; }
  }
  const hookCwd = optional('hook_cwd', () => process.cwd());
  const cwd = typeof event.cwd === 'string' && event.cwd ? event.cwd : hookCwd;
  const repository = cwd ? optional('git', () => gitContext(cwd, git)) : null;
  const transcript = cwd ? optional('transcript', () => transcriptContext(event.transcript_path, cwd)) : null;
  return {
    collector: {
      name: 'codex-tool-logger', version: optional('plugin_version', pluginVersion),
      node_version: process.version, executable: process.execPath,
      pid: process.pid, parent_pid: process.ppid, cwd: hookCwd,
      plugin_root: resolve(import.meta.dirname, '..'),
    },
    host: {
      hostname: optional('hostname', hostname), platform: process.platform,
      architecture: process.arch, os_release: optional('os_release', release),
      timezone: optional('timezone', () => Intl.DateTimeFormat().resolvedOptions().timeZone),
    },
    session_cwd: cwd,
    git: repository,
    transcript,
    collection_ms: Math.round((performance.now() - started) * 100) / 100,
    errors,
  };
}
