#!/usr/bin/env node
// install.js - Idempotently register enhanced-buddy with Claude Code settings.

import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import JSON5 from 'json5';
import { BUDDY_DIR, CONFIG_DIR as DETECTED_CONFIG_DIR, CONFIG_PATH } from './server/paths.js';

// Guard against running on Node < 20 (top-level await, ESM features).
const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
if (nodeMajor < 20) {
  console.error(`ERROR: enhanced-buddy requires Node.js >= 20. You are running ${process.versions.node}.`);
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname);
const DRY_RUN = process.argv.includes('--dry-run');
const HOME = process.env.HOME || process.env.USERPROFILE || '';
const CONFIG_DIR = DETECTED_CONFIG_DIR;
const SETTINGS_PATH = join(CONFIG_DIR, 'settings.json');
// MCP servers must live in .claude.json (user scope) — settings.json silently ignores mcpServers.
const CLAUDE_JSON_PATH = CONFIG_PATH;
const STATE_DIR = join(BUDDY_DIR, 'state');
const PREVIOUS_STATUSLINE_PATH = join(BUDDY_DIR, 'previous-statusline.json');

function readSettings() {
  try {
    const raw = readFileSync(SETTINGS_PATH, 'utf-8');
    const settings = JSON5.parse(raw);
    if (!DRY_RUN) {
      copyFileSync(SETTINGS_PATH, `${SETTINGS_PATH}.buddy-backup-${Date.now()}`);
    }
    return settings;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }
    console.error('ERROR: Cannot parse settings.json:', error.message);
    process.exit(1);
  }
}

function writeSettings(settings) {
  if (DRY_RUN) {
    console.log('\nDry run - settings would be:');
    console.log(JSON.stringify(settings, null, 2));
    return;
  }

  const tmpPath = `${SETTINGS_PATH}.enhanced-buddy.tmp`;
  writeFileSync(tmpPath, JSON.stringify(settings, null, 2));
  renameSync(tmpPath, SETTINGS_PATH);
  console.log(`\nWrote settings to ${SETTINGS_PATH}`);
}

// Match hooks by project path so re-running is idempotent and doesn't
// collide with a separately-installed save-buddy instance.
function ensureHook(settings, eventName, commandNeedle, command) {
  if (!settings.hooks) settings.hooks = {};
  if (!Array.isArray(settings.hooks[eventName])) settings.hooks[eventName] = [];

  const exists = settings.hooks[eventName].some((entry) =>
    entry?.hooks?.some((hook) => hook.command?.includes('enhanced-buddy') && hook.command?.includes(commandNeedle)));

  if (!exists) {
    settings.hooks[eventName].push({ hooks: [{ type: 'command', command }] });
    console.log(`Added ${eventName} hook`);
  }
}

// Register the enhanced-buddy MCP server in ~/.claude.json (user scope).
// Read-modify-write with backup + atomic write + round-trip verification.
function ensureMcpServerInClaudeJson(serverPath) {
  if (DRY_RUN) {
    console.log(`Would register MCP server "enhanced-buddy" in ${CLAUDE_JSON_PATH}`);
    return true;
  }

  let claudeJson;
  let raw;
  try {
    raw = readFileSync(CLAUDE_JSON_PATH, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn(`Warning: ${CLAUDE_JSON_PATH} does not exist yet. Creating a new one.`);
      claudeJson = {};
    } else {
      console.error(`ERROR: cannot read ${CLAUDE_JSON_PATH}: ${err.message}`);
      console.error('Skipping MCP registration. The /buddy command will not work until this is fixed.');
      return false;
    }
  }

  if (raw !== undefined) {
    try {
      claudeJson = JSON.parse(raw);
    } catch (err) {
      console.error(`ERROR: cannot parse ${CLAUDE_JSON_PATH}: ${err.message}`);
      console.error('The file is not valid JSON. Refusing to overwrite. Fix the file and re-run the installer.');
      return false;
    }
  }

  // Backup before any modification.
  if (raw !== undefined) {
    const backupPath = `${CLAUDE_JSON_PATH}.buddy-backup-${Date.now()}`;
    copyFileSync(CLAUDE_JSON_PATH, backupPath);
    console.log(`Backed up .claude.json to ${backupPath}`);
  }

  if (!claudeJson.mcpServers || typeof claudeJson.mcpServers !== 'object') {
    claudeJson.mcpServers = {};
  }

  claudeJson.mcpServers['enhanced-buddy'] = {
    command: 'node',
    args: [serverPath],
    ...(process.env.CLAUDE_CONFIG_DIR ? { env: { CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR } } : {}),
  };

  const serialized = JSON.stringify(claudeJson, null, 2);

  // Round-trip verification: re-parse the serialized output before writing.
  try {
    JSON.parse(serialized);
  } catch (err) {
    console.error(`ERROR: serialized .claude.json failed re-parse: ${err.message}`);
    console.error('Refusing to write a malformed file. Original file is untouched.');
    return false;
  }

  const tmpPath = `${CLAUDE_JSON_PATH}.enhanced-buddy.tmp`;
  writeFileSync(tmpPath, serialized);
  renameSync(tmpPath, CLAUDE_JSON_PATH);
  console.log(`Registered MCP server "enhanced-buddy" in ${CLAUDE_JSON_PATH}`);
  return true;
}

function installSkill() {
  const candidates = [
    join(process.cwd(), '.claude', 'skills'),
    join(HOME, '.claude', 'skills'),
    join(HOME, '.claude-work', 'skills'),
    join(HOME, '.claude-personal', 'skills'),
  ];
  const skillsRoot = candidates.find((candidate) => existsSync(candidate)) || join(HOME, '.claude', 'skills');
  const targetDir = join(skillsRoot, 'buddy');

  if (!DRY_RUN) {
    mkdirSync(targetDir, { recursive: true });
    copyFileSync(join(PROJECT_ROOT, 'skill', 'SKILL.md'), join(targetDir, 'SKILL.md'));
  }
  console.log(`Installed /buddy skill to ${targetDir}`);
}

console.log('enhanced-buddy installer');
console.log('========================');
console.log(`Config directory:  ${CONFIG_DIR}`);
console.log(`Settings file:     ${SETTINGS_PATH}`);
console.log(`Claude JSON file:  ${CLAUDE_JSON_PATH}`);
console.log(`Project root:      ${PROJECT_ROOT}`);
if (DRY_RUN) {
  console.log('(dry-run mode - no files will be written)');
}

const settings = readSettings();

if (!DRY_RUN) {
  mkdirSync(BUDDY_DIR, { recursive: true });
  mkdirSync(STATE_DIR, { recursive: true });
}

const serverPath = join(PROJECT_ROOT, 'server', 'index.js').replace(/\\/g, '/');

// Clean up any stale mcpServers entries in settings.json from prior buggy installs
// (both save-buddy and enhanced-buddy names).
for (const stale of ['save-buddy', 'enhanced-buddy']) {
  if (settings.mcpServers?.[stale]) {
    delete settings.mcpServers[stale];
    console.log(`Removed stale ${stale} entry from settings.json (wrong location)`);
  }
}
if (settings.mcpServers && Object.keys(settings.mcpServers).length === 0) {
  delete settings.mcpServers;
}

// Register MCP server in the canonical location: ~/.claude.json (user scope).
const mcpRegistered = ensureMcpServerInClaudeJson(serverPath);
if (!mcpRegistered) {
  console.error('\nERROR: MCP registration failed. /buddy commands will not work.');
  console.error('Fix the issue above and re-run install.js, or manually add to ~/.claude.json:');
  console.error(`  "mcpServers": { "enhanced-buddy": { "command": "node", "args": ["${serverPath}"] } }`);
  process.exit(1);
}

ensureHook(
  settings,
  'Stop',
  'buddy-stop',
  `node "${join(PROJECT_ROOT, 'hooks', 'buddy-stop.js').replace(/\\/g, '/')}"`,
);
ensureHook(
  settings,
  'UserPromptSubmit',
  'buddy-prompt',
  `node "${join(PROJECT_ROOT, 'hooks', 'buddy-prompt.js').replace(/\\/g, '/')}"`,
);
ensureHook(
  settings,
  'SessionStart',
  'buddy-session',
  `node "${join(PROJECT_ROOT, 'hooks', 'buddy-session.js').replace(/\\/g, '/')}"`,
);

const wrapperCommand = `node "${join(PROJECT_ROOT, 'statusline', 'buddy-hud-wrapper.js').replace(/\\/g, '/')}"`;
if (settings.statusLine?.command && !settings.statusLine.command.includes('buddy-hud-wrapper')) {
  if (!DRY_RUN) {
    writeFileSync(
      PREVIOUS_STATUSLINE_PATH,
      JSON.stringify({ statusLine: settings.statusLine }, null, 2),
    );
  }
  console.log(`Saved previous statusline: ${settings.statusLine.command}`);
}

settings.statusLine = {
  ...(settings.statusLine || {}),
  type: 'command',
  command: wrapperCommand,
  refreshInterval: 1,
};
console.log('Set statusLine command to enhanced-buddy wrapper');

if (!settings.permissions) settings.permissions = {};
if (!Array.isArray(settings.permissions.allow)) settings.permissions.allow = [];

const buddyPermissions = [
  'mcp__enhanced-buddy__buddy_show',
  'mcp__enhanced-buddy__buddy_pet',
  'mcp__enhanced-buddy__buddy_react',
  'mcp__enhanced-buddy__buddy_mute',
  'mcp__enhanced-buddy__buddy_stats',
  'mcp__enhanced-buddy__buddy_list',
  'mcp__enhanced-buddy__buddy_pick',
  'mcp__enhanced-buddy__buddy_reset',
];
console.log('Auto-approving MCP permissions:');
for (const permission of buddyPermissions) {
  if (!settings.permissions.allow.includes(permission)) {
    settings.permissions.allow.push(permission);
  }
  console.log(`  ${permission}`);
}

// Back up companion data before any writes.
try {
  const config = JSON.parse(readFileSync(CLAUDE_JSON_PATH, 'utf-8'));
  if (config.companion && !DRY_RUN) {
    const backupPath = join(BUDDY_DIR, 'companion-backup.json');
    writeFileSync(backupPath, JSON.stringify(config.companion, null, 2));
    console.log(`Backed up companion data to ${backupPath}`);
  }
} catch {}

writeSettings(settings);
installSkill();

console.log('\nInstallation complete.');
console.log('Restart Claude Code, then run /buddy.');
