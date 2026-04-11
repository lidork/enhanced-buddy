// 2026-04-09: Initial MCP server with buddy tools and companion awareness prompt injection.
// index.js - Stdio MCP server for save-buddy.

// 2026-04-09: Use shared state.js (code review finding #2 - was duplicated in 4 files).
import { mkdirSync } from 'fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { callBuddyReact } from './api.js';
import { renderCompanionCard } from './card.js';
import { getCompanion, setOverride, clearOverride, hasOverride } from './companion.js';
import { listBuddies, addBuddy, freeBuddy, switchBuddy } from './roster.js';
import { REACTION_PATH, STATE_DIR } from './paths.js';
import { localReaction } from './reactions.js';
import { readState, writeState, pushRecent } from './state.js';
import { atomicWrite } from './util.js';

try {
  mkdirSync(STATE_DIR, { recursive: true });
} catch {}

function writeReaction(text) {
  atomicWrite(REACTION_PATH, JSON.stringify({ text: text || '', ts: Date.now() }));
}

function fallbackEvent(reason, addressed) {
  if ((reason || 'turn') === 'turn' && addressed) {
    return 'addressed';
  }
  return reason || 'turn';
}

const server = new McpServer(
  { name: 'enhanced-buddy', version: '1.0.0' },
  {
    capabilities: { tools: {} },
    instructions: (() => {
      const companion = getCompanion();
      if (!companion) {
        return undefined;
      }

      return `# Companion\n\nA small ${companion.species} named ${companion.name} sits beside the user's input box and occasionally comments in a speech bubble. You are not ${companion.name} - it is a separate watcher.\n\nWhen the user addresses ${companion.name} directly, stay out of the way. Reply in one line or less, or only answer the part clearly meant for you. Do not explain that you are not ${companion.name}, and do not narrate what ${companion.name} might say.`;
    })(),
  },
);

server.registerTool(
  'buddy_show',
  {
    title: 'Show Companion',
    description: 'Show the rendered companion card with ASCII art, stats, personality, and last reaction.',
    inputSchema: z.object({}),
  },
  async () => {
    const companion = getCompanion();
    const state = readState();
    if (!companion) {
      return {
        content: [
          {
            type: 'text',
            text: 'No companion found. Hatch a buddy in a Claude Code build that still supports it, or restore one from backup.',
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: renderCompanionCard(companion, state.lastReaction, hasOverride()),
        },
      ],
    };
  },
);

server.registerTool(
  'buddy_pet',
  {
    title: 'Pet Companion',
    description: 'Pet the companion, increment the pet counter, and trigger a reaction.',
    inputSchema: z.object({}),
  },
  async () => {
    const companion = getCompanion();
    const state = readState();
    if (!companion) {
      return { content: [{ type: 'text', text: 'No companion to pet.' }] };
    }

    state.muted = false;
    state.petCount = Number(state.petCount || 0) + 1;
    state.petHeartsUntil = Date.now() + 2500;

    let reaction = await callBuddyReact(companion, '(you were just petted)', 'pet', state.recentReactions || [], false);
    if (!reaction) {
      reaction = localReaction(companion, 'pet', state.petCount);
    }

    state.lastReaction = reaction;
    pushRecent(state, reaction);
    writeState(state);
    writeReaction(reaction);

    return {
      content: [
        {
          type: 'text',
          text: `petted ${companion.name}\n\n${companion.name}: "${reaction}"`,
        },
      ],
    };
  },
);

server.registerTool(
  'buddy_react',
  {
    title: 'Trigger Reaction',
    description: 'Generate a companion reaction using recent context.',
    inputSchema: z.object({
      context: z.string().optional().describe('Recent conversation transcript'),
      reason: z.string().optional().describe('turn, error, test-fail, large-diff, hatch, pet'),
      addressed: z.boolean().optional().describe('Whether the user directly addressed the companion'),
    }),
  },
  async ({ context, reason, addressed }) => {
    const companion = getCompanion();
    const state = readState();
    if (!companion) {
      return { content: [{ type: 'text', text: 'No companion.' }] };
    }

    const finalReason = reason || 'turn';
    const finalAddressed = Boolean(addressed);
    let reaction = await callBuddyReact(
      companion,
      context || '',
      finalReason,
      state.recentReactions || [],
      finalAddressed,
    );

    if (!reaction) {
      reaction = localReaction(companion, fallbackEvent(finalReason, finalAddressed), Date.now());
    }

    state.lastReaction = reaction;
    pushRecent(state, reaction);
    writeState(state);
    writeReaction(reaction);

    return {
      content: [{ type: 'text', text: `${companion.name}: "${reaction}"` }],
    };
  },
);

server.registerTool(
  'buddy_mute',
  {
    title: 'Mute Companion',
    description: 'Mute or unmute the companion rendering and reactions.',
    inputSchema: z.object({
      muted: z.boolean().describe('True to mute, false to unmute'),
    }),
  },
  async ({ muted }) => {
    const state = readState();
    state.muted = Boolean(muted);
    writeState(state);
    if (muted) {
      writeReaction('');
    }
    return {
      content: [{ type: 'text', text: muted ? 'companion muted' : 'companion unmuted' }],
    };
  },
);

server.registerTool(
  'buddy_stats',
  {
    title: 'Companion Stats',
    description: 'Return current save-buddy runtime stats.',
    inputSchema: z.object({}),
  },
  async () => {
    const state = readState();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              petCount: state.petCount || 0,
              muted: state.muted || false,
              lastReaction: state.lastReaction || null,
              lastCallTime: state.lastCallTime || 0,
              recentReactions: state.recentReactions || [],
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.registerTool(
  'buddy_list',
  {
    title: 'List Picker Options',
    description: 'List all available species, eyes, hats, and rarities for buddy_pick.',
    inputSchema: z.object({}),
  },
  async () => {
    const { SPECIES, EYES, HATS, RARITIES } = await import('./types.js');
    const eyeLabels = EYES.map((e) => `${e} (U+${e.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})`);
    return {
      content: [
        {
          type: 'text',
          text: [
            `species (${SPECIES.length}): ${SPECIES.join(', ')}`,
            `eyes (${EYES.length}): ${eyeLabels.join('  ')}`,
            `hats (${HATS.length}): ${HATS.join(', ')}`,
            `rarities (${RARITIES.length}): ${RARITIES.join(', ')}`,
            '',
            'Use buddy_pick with any combination of these values.',
            'Stats are rerolled from the chosen rarity when rarity is overridden.',
          ].join('\n'),
        },
      ],
    };
  },
);

server.registerTool(
  'buddy_pick',
  {
    title: 'Pick Buddy Appearance',
    description: 'Override your companion\'s species, eye, hat, and/or rarity. Omitted fields keep their current value (PRNG or previous override). Use buddy_list to see valid values.',
    inputSchema: z.object({
      species: z.string().optional().describe('Species name, e.g. dragon, cat, penguin'),
      eye: z.string().optional().describe('Eye character, e.g. @ or ◉'),
      hat: z.string().optional().describe('Hat name, e.g. wizard, crown, none'),
      rarity: z.string().optional().describe('Rarity: common, uncommon, rare, epic, legendary'),
    }),
  },
  async ({ species, eye, hat, rarity }) => {
    const { SPECIES, EYES, HATS, RARITIES } = await import('./types.js');
    const errors = [];
    if (species && !SPECIES.includes(species)) errors.push(`unknown species "${species}"`);
    if (eye && !EYES.includes(eye)) errors.push(`unknown eye "${eye}" — use buddy_list to see valid eye characters`);
    if (hat && !HATS.includes(hat)) errors.push(`unknown hat "${hat}"`);
    if (rarity && !RARITIES.includes(rarity)) errors.push(`unknown rarity "${rarity}"`);
    if (errors.length) {
      return { content: [{ type: 'text', text: `Invalid input:\n${errors.map((e) => `  • ${e}`).join('\n')}` }] };
    }

    const fields = {};
    if (species) fields.species = species;
    if (eye) fields.eye = eye;
    if (hat) fields.hat = hat;
    if (rarity) {
      fields.rarity = rarity;
      // Reroll stats for the new rarity so bars aren't misleading.
      const { mulberry32, hashString, companionUserId } = await import('./companion.js');
      const { RARITY_FLOOR, STAT_NAMES } = await import('./types.js');
      const seed = hashString(`${companionUserId()}-pick-${rarity}`);
      const rng = mulberry32(seed);
      const floor = RARITY_FLOOR[rarity];
      const statNames = [...STAT_NAMES];
      const peak = statNames[Math.floor(rng() * statNames.length)];
      let secondary = statNames[Math.floor(rng() * statNames.length)];
      while (secondary === peak) secondary = statNames[Math.floor(rng() * statNames.length)];
      const stats = {};
      for (const name of STAT_NAMES) {
        if (name === peak) stats[name] = Math.min(100, floor + 50 + Math.floor(rng() * 30));
        else if (name === secondary) stats[name] = Math.max(1, floor - 10 + Math.floor(rng() * 15));
        else stats[name] = floor + Math.floor(rng() * 40);
      }
      fields.stats = stats;
    }

    setOverride(fields);
    const companion = getCompanion();
    const state = readState();
    return {
      content: [
        {
          type: 'text',
          text: `Override applied.\n\n${renderCompanionCard(companion, state.lastReaction, true)}`,
        },
      ],
    };
  },
);

server.registerTool(
  'buddy_reset',
  {
    title: 'Reset to Deterministic Buddy',
    description: 'Clear any buddy_pick overrides and restore the original PRNG-determined companion.',
    inputSchema: z.object({}),
  },
  async () => {
    clearOverride();
    const companion = getCompanion();
    const state = readState();
    if (!companion) {
      return { content: [{ type: 'text', text: 'Override cleared. No companion found.' }] };
    }
    return {
      content: [
        {
          type: 'text',
          text: `Override cleared. Restored original companion.\n\n${renderCompanionCard(companion, state.lastReaction, false)}`,
        },
      ],
    };
  },
);

server.registerTool(
  'buddy_statroll',
  {
    title: 'Reroll Companion Stats',
    description: 'Randomly reroll your companion\'s stats based on their current rarity and save the result.',
    inputSchema: z.object({}),
  },
  async () => {
    const companion = getCompanion();
    if (!companion) {
      return { content: [{ type: 'text', text: 'No companion found.' }] };
    }

    const { mulberry32, hashString, companionUserId } = await import('./companion.js');
    const { RARITY_FLOOR, STAT_NAMES } = await import('./types.js');
    const seed = hashString(`${companionUserId()}-statroll-${Date.now()}`);
    const rng = mulberry32(seed);
    const rarity = companion.rarity;
    const floor = RARITY_FLOOR[rarity];
    const statNames = [...STAT_NAMES];
    const peak = statNames[Math.floor(rng() * statNames.length)];
    let secondary = statNames[Math.floor(rng() * statNames.length)];
    while (secondary === peak) secondary = statNames[Math.floor(rng() * statNames.length)];
    const stats = {};
    for (const name of STAT_NAMES) {
      if (name === peak) stats[name] = Math.min(100, floor + 50 + Math.floor(rng() * 30));
      else if (name === secondary) stats[name] = Math.max(1, floor - 10 + Math.floor(rng() * 15));
      else stats[name] = floor + Math.floor(rng() * 40);
    }

    setOverride({ stats });
    const updated = getCompanion();
    const state = readState();
    return {
      content: [
        {
          type: 'text',
          text: `Stats rerolled (${rarity}).\n\n${renderCompanionCard(updated, state.lastReaction, hasOverride())}`,
        },
      ],
    };
  },
);

server.registerTool(
  'buddy_roster',
  {
    title: 'List Buddy Roster',
    description: 'List all companions in the roster (up to 10, including the original). Shows id, name, species, rarity, and which is active.',
    inputSchema: z.object({}),
  },
  async () => {
    const { active, buddies } = listBuddies();
    const lines = [];

    const activeLabel = active === 'original' ? ' ← active' : '';
    lines.push(`original: ${getCompanion()?.name || 'unknown'} (your PRNG companion)${activeLabel}`);

    for (const b of buddies) {
      const isActive = b.id === active ? ' ← active' : '';
      lines.push(`${b.id}: ${b.name || 'Unnamed'} (${b.species || '?'}, ${b.rarity || '?'})${isActive}`);
    }

    const slots = buddies.length + 1; // +1 for original
    lines.push('');
    lines.push(`${slots}/${10} slots used`);

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  },
);

server.registerTool(
  'buddy_switch',
  {
    title: 'Switch Active Buddy',
    description: 'Switch to a different companion by name or id. Use "original" to switch back to your PRNG companion.',
    inputSchema: z.object({
      id_or_name: z.string().describe('The buddy\'s name or id, or "original" to restore the PRNG companion'),
    }),
  },
  async ({ id_or_name }) => {
    const result = switchBuddy(id_or_name);
    if (!result.ok) {
      return { content: [{ type: 'text', text: result.error }] };
    }
    const companion = getCompanion();
    const state = readState();
    const card = companion
      ? renderCompanionCard(companion, state.lastReaction, result.id !== 'original')
      : '';
    return {
      content: [{
        type: 'text',
        text: `Switched to ${companion?.name || id_or_name}.\n\n${card}`,
      }],
    };
  },
);

server.registerTool(
  'buddy_new',
  {
    title: 'Create New Buddy',
    description: 'Create a new companion and add them to your roster (max 10 including original). Provide appearance and identity — all fields optional except name.',
    inputSchema: z.object({
      name: z.string().describe('Your new companion\'s name'),
      personality: z.string().optional().describe('A one-sentence personality description'),
      species: z.string().optional().describe('Species, e.g. dragon, cat. Defaults to random.'),
      eye: z.string().optional().describe('Eye character, e.g. @ or ◉. Defaults to random.'),
      hat: z.string().optional().describe('Hat name, e.g. wizard, crown, none. Defaults to random.'),
      rarity: z.string().optional().describe('Rarity: common, uncommon, rare, epic, legendary. Defaults to random.'),
    }),
  },
  async ({ name, personality, species, eye, hat, rarity }) => {
    const { SPECIES, EYES, HATS, RARITIES, RARITY_FLOOR, STAT_NAMES } = await import('./types.js');
    const { mulberry32, hashString, companionUserId } = await import('./companion.js');

    const errors = [];
    if (species && !SPECIES.includes(species)) errors.push(`unknown species "${species}"`);
    if (eye && !EYES.includes(eye)) errors.push(`unknown eye "${eye}" — use buddy_list to see valid values`);
    if (hat && !HATS.includes(hat)) errors.push(`unknown hat "${hat}"`);
    if (rarity && !RARITIES.includes(rarity)) errors.push(`unknown rarity "${rarity}"`);
    if (errors.length) {
      return { content: [{ type: 'text', text: `Invalid input:\n${errors.map((e) => `  • ${e}`).join('\n')}` }] };
    }

    // Fill any omitted appearance fields with a random pick.
    const rng = mulberry32(hashString(`${companionUserId()}-new-${name}-${Date.now()}`));
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];

    const resolvedRarity = rarity || pick(RARITIES);
    const resolvedSpecies = species || pick(SPECIES);
    const resolvedEye = eye || pick(EYES);
    const resolvedHat = hat || (resolvedRarity === 'common' ? 'none' : pick(HATS));

    // Roll stats for the resolved rarity.
    const floor = RARITY_FLOOR[resolvedRarity];
    const peak = pick(STAT_NAMES);
    let secondary = pick(STAT_NAMES);
    while (secondary === peak) secondary = pick(STAT_NAMES);
    const stats = {};
    for (const statName of STAT_NAMES) {
      if (statName === peak) stats[statName] = Math.min(100, floor + 50 + Math.floor(rng() * 30));
      else if (statName === secondary) stats[statName] = Math.max(1, floor - 10 + Math.floor(rng() * 15));
      else stats[statName] = floor + Math.floor(rng() * 40);
    }

    const entry = {
      name,
      personality: personality || '',
      species: resolvedSpecies,
      eye: resolvedEye,
      hat: resolvedHat,
      rarity: resolvedRarity,
      stats,
      hatchedAt: Date.now(),
    };

    const result = addBuddy(entry);
    if (!result.ok) {
      return { content: [{ type: 'text', text: result.error }] };
    }

    // Switch to the new buddy immediately.
    switchBuddy(result.id);
    const companion = getCompanion();
    const state = readState();
    return {
      content: [{
        type: 'text',
        text: `${name} added to your roster!\n\n${renderCompanionCard(companion, state.lastReaction, true)}`,
      }],
    };
  },
);

server.registerTool(
  'buddy_free',
  {
    title: 'Release a Buddy',
    description: 'Permanently remove a custom companion from your roster by name or id. Your original PRNG companion can never be released.',
    inputSchema: z.object({
      id_or_name: z.string().describe('The buddy\'s name or id to release'),
    }),
  },
  async ({ id_or_name }) => {
    const result = freeBuddy(id_or_name);
    if (!result.ok) {
      return { content: [{ type: 'text', text: result.error }] };
    }
    const freed = result.freed;
    const companion = getCompanion();
    const state = readState();
    const card = companion
      ? `\n\nNow showing: ${companion.name}\n\n${renderCompanionCard(companion, state.lastReaction, freed.id !== 'original')}`
      : '';
    return {
      content: [{
        type: 'text',
        text: `${freed.name || freed.id} has been released. Goodbye!${card}`,
      }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
