import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync,
  renameSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(import.meta.dirname, '..');
export const CATALOG = '.agents/plugins/marketplace.json';
type ObjectValue = Record<string, unknown>;
type PluginEntry = ObjectValue & { name: string; source: { source: 'local'; path: string } };
type Catalog = ObjectValue & { name: string; plugins: PluginEntry[] };

export function object(value: unknown): ObjectValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('expected a JSON object');
  }
  return { ...value };
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('expected a JSON array');
  return value;
}

export function readJson(path: string): ObjectValue {
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
  return object(value);
}

export function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}

function validateName(name: unknown): asserts name is string {
  if (typeof name !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error('name must be lowercase kebab-case, e.g. my-plugin');
  }
}

function localPath(root: string, value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('./')) {
    throw new Error(`expected ./-prefixed local path: ${String(value)}`);
  }
  const path = realpathSync(resolve(root, value));
  const part = relative(realpathSync(root), path);
  if (!part || part === '..' || part.startsWith('../') || isAbsolute(part)) {
    throw new Error(`path escapes its root: ${value}`);
  }
  return path;
}

export function check(root: string): Catalog {
  const catalog = readJson(join(root, CATALOG));
  const name = catalog.name;
  validateName(name);
  const seen = new Set<string>();
  const plugins = array(catalog.plugins).map((value): PluginEntry => {
    const entry = object(value);
    const pluginName = entry.name;
    validateName(pluginName);
    if (seen.has(pluginName)) throw new Error(`duplicate plugin: ${pluginName}`);
    seen.add(pluginName);
    const source = object(entry.source);
    if (source.source !== 'local' || typeof source.path !== 'string') {
      throw new Error(`${pluginName}: this workspace uses local plugins`);
    }
    const plugin = localPath(root, source.path);
    if (plugin !== realpathSync(join(root, 'plugins', pluginName))) {
      throw new Error(`${pluginName}: expected plugins/${pluginName}`);
    }
    const policy = object(entry.policy);
    if (typeof entry.category !== 'string' || !entry.category
        || policy.installation !== 'AVAILABLE' || policy.authentication !== 'ON_INSTALL') {
      throw new Error(`${pluginName}: invalid local installation metadata`);
    }
    const manifest = readJson(join(plugin, '.codex-plugin/plugin.json'));
    if (manifest.name !== pluginName || typeof manifest.version !== 'string' || !manifest.version) {
      throw new Error(`${pluginName}: manifest name/version mismatch`);
    }
    for (const field of ['skills', 'hooks', 'mcpServers', 'apps']) {
      if (field in manifest) {
        const component = localPath(plugin, manifest[field]);
        if (field !== 'skills') readJson(component);
      }
    }
    return { ...entry, name: pluginName, source: { source: 'local', path: source.path } };
  });
  const directories = readdirSync(join(root, 'plugins'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  if (directories.length !== seen.size || directories.some((name) => !seen.has(name))) {
    throw new Error('catalog and plugins/ differ');
  }
  return { ...catalog, name, plugins };
}

export function newPlugin(root: string, name: string): void {
  validateName(name);
  const catalog = check(root);
  const plugin = join(root, 'plugins', name);
  if (existsSync(plugin)) throw new Error(`plugin already exists: ${name}`);
  mkdirSync(plugin);
  const temporaryCatalog = join(dirname(join(root, CATALOG)), `${randomUUID()}.json`);
  try {
    mkdirSync(join(plugin, '.codex-plugin'));
    mkdirSync(join(plugin, 'skills', name), { recursive: true });
    writeJson(join(plugin, 'package.json'), {
      name, private: true, type: 'module', engines: { node: '26.x', pnpm: '11.x' },
    });
    writeJson(join(plugin, '.codex-plugin/plugin.json'), {
      name, version: '0.1.0', description: `Local ${name} plugin.`, skills: './skills/',
      interface: { displayName: name, shortDescription: `Local ${name} plugin` },
    });
    writeFileSync(join(plugin, 'skills', name, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Use only when the user explicitly invokes ${name}.\n---\n\n`
      + `Tell the user the ${name} plugin is loaded and ready to customize.\n`);
    catalog.plugins.push({
      name, source: { source: 'local', path: `./plugins/${name}` },
      policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
      category: 'Developer Tools',
    });
    writeJson(temporaryCatalog, catalog);
    renameSync(temporaryCatalog, join(root, CATALOG));
  } catch (error) {
    rmSync(temporaryCatalog, { force: true });
    rmSync(plugin, { recursive: true, force: true });
    throw error;
  }
  console.log(`Created plugins/${name}; edit its manifest and skill.`);
}

function expandHome(path: string): string {
  if (path === '~') return homedir();
  return path.startsWith('~/') ? join(homedir(), path.slice(2)) : path;
}

type LinkOptions = {
  codexHome?: string;
  runCodex?: (args: string[]) => void;
};

export function linkPlugin(root: string, name: string, options: LinkOptions = {}): void {
  validateName(name);
  const catalog = check(root);
  if (!catalog.plugins.some((entry) => entry.name === name)) throw new Error(`unknown plugin: ${name}`);
  const source = realpathSync(join(root, 'plugins', name));
  const codexHome = expandHome(options.codexHome || process.env.CODEX_HOME || join(homedir(), '.codex'));
  const destination = join(codexHome, 'plugins/cache', catalog.name, name, 'local');
  const existing = lstatSync(destination, { throwIfNoEntry: false });
  if (existing?.isSymbolicLink()) {
    if (realpathSync(destination) !== source) throw new Error(`refusing to replace unrelated link: ${destination}`);
    console.log(`Already linked: ${destination} -> ${source}`);
    return;
  }
  if (existing) throw new Error(`cache already exists: ${destination}. Move it aside before linking.`);
  // Codex owns registration and config. Never hand-edit config.toml.
  const runCodex = options.runCodex ?? ((args) => { execFileSync('codex', args, { stdio: 'inherit' }); });
  runCodex(['plugin', 'marketplace', 'add', root]);
  runCodex(['plugin', 'add', `${name}@${catalog.name}`]);
  const installed = lstatSync(destination);
  if (installed.isSymbolicLink() || !installed.isDirectory()) {
    throw new Error(`unexpected Codex cache layout: ${destination}`);
  }
  if (readJson(join(destination, '.codex-plugin/plugin.json')).name !== name) {
    throw new Error(`unexpected installed plugin at ${destination}`);
  }
  const backupRoot = join(codexHome, 'plugins/local-link-backups');
  mkdirSync(backupRoot, { recursive: true });
  const backup = join(backupRoot, `${catalog.name}-${name}-${randomUUID()}`);
  renameSync(destination, backup);
  try {
    symlinkSync(source, destination, 'dir');
  } catch (error) {
    renameSync(backup, destination);
    throw error;
  }
  console.log(`Linked: ${destination} -> ${source}\nOriginal copy: ${backup}`);
  console.log("Restart Codex. Review and trust this plugin's hooks in /hooks before use.");
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, name, ...extra] = process.argv.slice(2);
    if (command === 'check' && name === undefined) {
      console.log(`Validated ${check(ROOT).plugins.length} local plugin(s).`);
    } else if ((command === 'new' || command === 'link') && name !== undefined && extra.length === 0) {
      if (command === 'new') newPlugin(ROOT, name);
      else linkPlugin(ROOT, name);
    } else {
      throw new Error('usage: node scripts/workspace.ts check | new <name> | link <name>');
    }
  } catch (error) {
    console.error(`workspace: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
