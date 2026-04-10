#!/usr/bin/env node
// uninstall.js - Surgically remove enhanced-buddy integration from Claude Code settings.

import { copyFileSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import JSON5 from 'json5';
import { BUDDY_DIR, CONFIG_DIR as DETECTED_CONFIG_DIR, CONFIG_PATH } from './server/paths.js';

const DRY_RUN = process.argv.includes('--dry-run');
const HOME = process.env.HOME || process.env.USERPROFILE || '';
const CONFIG_DIR = DETECTED_CONFIG_DIR;
const SETTINGS_PATH = join(CONFIG_DIR, 'settings.json');
const CLAUDE_JSON_PATH = CONFIG_PATH;
const PREVIOUS_STATUSLINE_PATH = join(BUDDY_DIR, 'previous-statusline.json');

function readSettings() {
  try {
    return JSON5.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
  } catch {
    console.log('No settings.json found. Nothing to uninstall.');
    process.exit(0);
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

// Remove the enhanced-buddy (and any legacy save-buddy) MCP server entry from ~/.claude.json.
function removeMcpServerFromClaudeJson() {
  let raw;
  try {
    raw = readFileSync(CLAUDE_JSON_PATH, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return;
    console.warn(`Warning: cannot read ${CLAUDE_JSON_PATH}: ${err.message}`);
    return;
  }

  let claudeJson;
  try {
    claudeJson = JSON.parse(raw);
  } catch (err) {
    console.warn(`Warning: cannot parse ${CLAUDE_JSON_PATH}: ${err.message}`);
    console.warn('Skipping MCP cleanup. Manually remove "enhanced-buddy" from .claude.json mcpServers.');
    return;
  }

  const toRemove = ['enhanced-buddy', 'save-buddy'];
  const present = toRemove.filter((k) => claudeJson.mcpServers?.[k]);
  if (present.length === 0) return;

  if (DRY_RUN) {
    console.log(`Would remove MCP server(s) ${present.join(', ')} from ${CLAUDE_JSON_PATH}`);
    return;
  }

  const backupPath = `${CLAUDE_JSON_PATH}.buddy-backup-${Date.now()}`;
  copyFileSync(CLAUDE_JSON_PATH, backupPath);
  console.log(`Backed up .claude.json to ${backupPath}`);

  for (const key of present) {
    delete claudeJson.mcpServers[key];
  }
  if (Object.keys(claudeJson.mcpServers).length === 0) {
    delete claudeJson.mcpServers;
  }

  const serialized = JSON.stringify(claudeJson, null, 2);
  try {
    JSON.parse(serialized);
  } catch (err) {
    console.error(`ERROR: serialized .claude.json failed re-parse: ${err.message}`);
    console.error('Refusing to write a malformed file. Original is untouched.');
    return;
  }

  const tmpPath = `${CLAUDE_JSON_PATH}.enhanced-buddy.tmp`;
  writeFileSync(tmpPath, serialized);
  renameSync(tmpPath, CLAUDE_JSON_PATH);
  console.log(`Removed MCP server(s) ${present.join(', ')} from ${CLAUDE_JSON_PATH}`);
}

function removeHook(settings, eventName, commandNeedle) {
  if (!Array.isArray(settings.hooks?.[eventName])) return;

  settings.hooks[eventName] = settings.hooks[eventName]
    .map((entry) => ({
      ...entry,
      hooks: (entry.hooks || []).filter((hook) => !hook.command?.includes(commandNeedle)),
    }))
    .filter((entry) => entry.hooks.length > 0);

  if (settings.hooks[eventName].length === 0) {
    delete settings.hooks[eventName];
  }
}

function findSkillDir() {
  const candidates = [
    join(process.cwd(), '.claude', 'skills', 'buddy'),
    join(HOME, '.claude', 'skills', 'buddy'),
    join(HOME, '.claude-work', 'skills', 'buddy'),
    join(HOME, '.claude-personal', 'skills', 'buddy'),
    join(CONFIG_DIR, 'skills', 'buddy'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

console.log('enhanced-buddy uninstaller');
console.log('==========================');
console.log(`Config directory: ${CONFIG_DIR}`);
if (DRY_RUN) {
  console.log('(dry-run mode - no files will be written)');
}

const settings = readSettings();

// Clean up any legacy/stale mcpServers entries from settings.json (wrong location).
for (const stale of ['save-buddy', 'enhanced-buddy', 'buddy']) {
  if (settings.mcpServers?.[stale]) {
    delete settings.mcpServers[stale];
    console.log(`Removed legacy MCP entry from settings.json: ${stale}`);
  }
}
if (settings.mcpServers && Object.keys(settings.mcpServers).length === 0) {
  delete settings.mcpServers;
}

// Remove hooks by path needle so we catch both save-buddy and enhanced-buddy installs.
removeHook(settings, 'Stop', 'buddy-stop');
removeHook(settings, 'UserPromptSubmit', 'buddy-prompt');
removeHook(settings, 'PreToolUse', 'buddy-prompt');
removeHook(settings, 'SessionStart', 'buddy-session');
console.log('Removed buddy hooks');

if (settings.statusLine?.command?.includes('buddy-hud-wrapper')) {
  try {
    const previous = JSON.parse(readFileSync(PREVIOUS_STATUSLINE_PATH, 'utf-8'));
    if (previous.statusLine) {
      settings.statusLine = previous.statusLine;
      console.log(`Restored previous statusline: ${previous.statusLine.command || '[object]'}`);
    } else if (previous.command) {
      settings.statusLine = { type: 'command', command: previous.command };
      console.log(`Restored previous statusline: ${previous.command}`);
    } else {
      delete settings.statusLine;
      console.log('Removed statusLine setting');
    }
  } catch {
    delete settings.statusLine;
    console.log('Removed statusLine setting');
  }
}

if (Array.isArray(settings.permissions?.allow)) {
  const remove = new Set([
    // enhanced-buddy permissions (all tools including new ones)
    'mcp__enhanced-buddy__buddy_show',
    'mcp__enhanced-buddy__buddy_pet',
    'mcp__enhanced-buddy__buddy_react',
    'mcp__enhanced-buddy__buddy_mute',
    'mcp__enhanced-buddy__buddy_stats',
    'mcp__enhanced-buddy__buddy_list',
    'mcp__enhanced-buddy__buddy_pick',
    'mcp__enhanced-buddy__buddy_reset',
    // legacy save-buddy permissions
    'mcp__save-buddy__buddy_show',
    'mcp__save-buddy__buddy_pet',
    'mcp__save-buddy__buddy_react',
    'mcp__save-buddy__buddy_mute',
    'mcp__save-buddy__buddy_stats',
    'mcp__buddy__buddy_show',
    'mcp__buddy__buddy_pet',
    'mcp__buddy__buddy_react',
    'mcp__buddy__buddy_mute',
    'mcp__buddy__buddy_stats',
  ]);
  settings.permissions.allow = settings.permissions.allow.filter((entry) => !remove.has(entry));
  console.log('Removed buddy MCP permissions');
}

writeSettings(settings);

// Remove the canonical MCP registration from ~/.claude.json.
removeMcpServerFromClaudeJson();

const skillDir = findSkillDir();
if (skillDir) {
  if (!DRY_RUN) {
    rmSync(skillDir, { recursive: true, force: true });
  }
  console.log(`Removed /buddy skill from ${skillDir}`);
}

console.log('\nUninstall complete. Restart Claude Code to apply.');
console.log(`State files remain at ${BUDDY_DIR}`);
