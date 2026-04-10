// 2026-04-09: Initial pre-rendered companion card so buddy_show stays deterministic.
// card.js - Render a complete ASCII companion card for the MCP tool.

import { colorize } from './ansi.js';
import { renderSprite } from './sprites.js';
import { STAT_NAMES, RARITY_STARS } from './types.js';
import { wrap } from './util.js';

function border(inner, rarity) {
  return colorize(inner, rarity);
}

export function renderCompanionCard(companion, lastReaction, isCustom = false) {
  const width = 38;
  const lines = [];
  const rarity = companion.rarity;
  const stars = RARITY_STARS[rarity] || '';
  const rarityLabel = String(rarity || '').toUpperCase();
  const species = String(companion.species || '').toUpperCase();
  const sprite = renderSprite(companion, 0);

  const B = (s) => border(s, rarity);

  lines.push(B(`\u256d${'\u2500'.repeat(width)}\u256e`));
  lines.push(B(`\u2502${' '.repeat(width)}\u2502`));

  const left = `  ${colorize(stars, rarity)} ${colorize(rarityLabel, rarity)}`.trimEnd();
  const customTag = isCustom ? 'CUSTOM' : '';
  const right = `${customTag ? customTag + ' ' : ''}${species}  `;
  // left contains ANSI codes so we measure visible length separately
  const leftVisible = `  ${stars} ${rarityLabel}`.trimEnd();
  const pad = ' '.repeat(Math.max(0, width - leftVisible.length - right.length));
  lines.push(`${B('\u2502')}${left}${pad}${right}${B('\u2502')}`);
  lines.push(B(`\u2502${' '.repeat(width)}\u2502`));

  for (const spriteLine of sprite) {
    const padded = `    ${spriteLine.trimEnd()}`;
    lines.push(`${B('\u2502')}${padded.padEnd(width)}${B('\u2502')}`);
  }

  lines.push(B(`\u2502${' '.repeat(width)}\u2502`));
  lines.push(`${B('\u2502')}${`  ${companion.name}`.padEnd(width)}${B('\u2502')}`);
  lines.push(B(`\u2502${' '.repeat(width)}\u2502`));

  for (const line of wrap(`"${companion.personality}"`, width - 4)) {
    lines.push(`${B('\u2502')}${`  ${line}`.padEnd(width)}${B('\u2502')}`);
  }

  lines.push(B(`\u2502${' '.repeat(width)}\u2502`));

  for (const statName of STAT_NAMES) {
    const statValue = Number(companion.stats?.[statName] || 0);
    const filled = Math.round(statValue / 10);
    const bar = `${'\u2588'.repeat(filled)}${'\u2591'.repeat(Math.max(0, 10 - filled))}`;
    const content = `  ${statName.padEnd(10)} ${bar}${String(statValue).padStart(3)}`;
    lines.push(`${B('\u2502')}${content.padEnd(width)}${B('\u2502')}`);
  }

  lines.push(B(`\u2502${' '.repeat(width)}\u2502`));

  if (lastReaction) {
    lines.push(`${B('\u2502')}${'  last said'.padEnd(width)}${B('\u2502')}`);
    for (const line of wrap(`"${lastReaction}"`, width - 6)) {
      lines.push(`${B('\u2502')}${`  ${line}`.padEnd(width)}${B('\u2502')}`);
    }
    lines.push(B(`\u2502${' '.repeat(width)}\u2502`));
  }

  lines.push(B(`\u2570${'\u2500'.repeat(width)}\u256f`));
  return lines.join('\n');
}
