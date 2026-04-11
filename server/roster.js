// roster.js - Multi-buddy roster management (up to 10 companions including the original).

import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { ROSTER_PATH, STATE_DIR } from './paths.js';

const MAX_BUDDIES = 10;

function readRoster() {
  try {
    return JSON.parse(readFileSync(ROSTER_PATH, 'utf-8'));
  } catch {
    return { active: 'original', buddies: [] };
  }
}

function writeRoster(roster) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(ROSTER_PATH, JSON.stringify(roster, null, 2));
}

// Returns the id of the currently active buddy ('original' or a custom id).
export function getActiveBuddyId() {
  return readRoster().active || 'original';
}

// Returns the full stored entry for the active custom buddy, or null if the original is active.
export function getActiveBuddy() {
  const roster = readRoster();
  const id = roster.active || 'original';
  if (id === 'original') return null;
  return roster.buddies.find((b) => b.id === id) || null;
}

// Returns { active, buddies } for display.
export function listBuddies() {
  const roster = readRoster();
  return { active: roster.active || 'original', buddies: roster.buddies };
}

// Find a custom buddy by id or name (case-insensitive). Returns null if not found.
export function findBuddy(idOrName) {
  const roster = readRoster();
  const lower = String(idOrName).toLowerCase();
  return roster.buddies.find(
    (b) => b.id === idOrName || (b.name || '').toLowerCase() === lower,
  ) || null;
}

// Add a new custom buddy. Returns { ok, id } or { ok: false, error }.
export function addBuddy(entry) {
  const roster = readRoster();
  // The original counts as one slot.
  if (roster.buddies.length >= MAX_BUDDIES - 1) {
    return {
      ok: false,
      error: `Roster is full (${MAX_BUDDIES} buddy limit including your original). Use buddy_free to release one first.`,
    };
  }
  const id = `buddy-${Date.now()}`;
  roster.buddies.push({ ...entry, id });
  writeRoster(roster);
  return { ok: true, id };
}

// Release a custom buddy by id or name. Returns { ok, freed } or { ok: false, error }.
export function freeBuddy(idOrName) {
  const lower = String(idOrName).toLowerCase();
  if (lower === 'original') {
    return { ok: false, error: 'Your original companion can never be released.' };
  }

  const roster = readRoster();
  const idx = roster.buddies.findIndex(
    (b) => b.id === idOrName || (b.name || '').toLowerCase() === lower,
  );

  if (idx === -1) {
    return { ok: false, error: `No buddy found with id or name "${idOrName}". Use buddy_roster to list your companions.` };
  }

  const buddy = roster.buddies[idx];
  if (buddy.isOriginal) {
    return { ok: false, error: 'Your original companion can never be released.' };
  }

  roster.buddies.splice(idx, 1);

  // If the freed buddy was active, fall back to the original.
  if (roster.active === buddy.id) {
    roster.active = 'original';
  }

  writeRoster(roster);
  return { ok: true, freed: buddy };
}

// Switch active buddy by id or name. Pass 'original' to switch back to the PRNG companion.
export function switchBuddy(idOrName) {
  const lower = String(idOrName).toLowerCase();

  if (lower === 'original') {
    const roster = readRoster();
    roster.active = 'original';
    writeRoster(roster);
    return { ok: true, id: 'original' };
  }

  const roster = readRoster();
  const buddy = roster.buddies.find(
    (b) => b.id === idOrName || (b.name || '').toLowerCase() === lower,
  );

  if (!buddy) {
    return {
      ok: false,
      error: `No buddy found with id or name "${idOrName}". Use buddy_roster to list your companions.`,
    };
  }

  roster.active = buddy.id;
  writeRoster(roster);
  return { ok: true, id: buddy.id, buddy };
}
