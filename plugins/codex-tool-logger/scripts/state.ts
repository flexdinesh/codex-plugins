import { linkSync, lstatSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function ensureState(directory: string, homeDirectory = homedir()): void {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, 'state.json');
  const existing = lstatSync(path, { throwIfNoEntry: false });
  if (existing) {
    if (!existing.isFile()) throw new Error('state.json must be a regular file');
    return;
  }
  const temporary = join(directory, `.state-${randomUUID()}.tmp`);
  writeFileSync(temporary, JSON.stringify({ schema_version: 1, home_directory: homeDirectory }) + '\n', {
    flag: 'wx', mode: 0o600, flush: true,
  });
  try {
    // Publish a complete file atomically without replacing another hook's state.
    try { linkSync(temporary, path); }
    catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
    }
  } finally {
    unlinkSync(temporary);
  }
}
