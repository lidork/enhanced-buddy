# enhanced-buddy

A fork of [save-buddy](https://github.com/jrykn/save-buddy/tree/master#) by [@jrykn](https://github.com/jrykn) — adds a companion picker so you can override your species, eyes, hat, and rarity via `/buddy pick`.

For how the underlying system works (PRNG, reactions, status line, hooks, FAQ), see the [original save-buddy README](https://github.com/jrykn/save-buddy/tree/master#).

```
     Y       Y
      /\_/\
     ( ♥   ♥)
     (  ω  )
     (")_(")

  Umber  ★★★★ EPIC
```

## Installation

```bash
git clone <this-repo> ~/.enhanced-buddy
cd ~/.enhanced-buddy
npm install
node install.js
```

Restart Claude Code. Type `/buddy` to see your companion.

**Dry run** (preview without writing files):
```bash
node install.js --dry-run
```

**Update:**
```bash
cd ~/.enhanced-buddy && git pull && node install.js
```

**Uninstall:**
```bash
cd ~/.enhanced-buddy && node uninstall.js
```

## Commands

| Command | What it does |
|---------|-------------|
| `/buddy` | Show companion card |
| `/buddy pet` | Pet your companion |
| `/buddy stats` | Show runtime stats |
| `/buddy mute` / `/buddy unmute` | Toggle reactions and status line |
| `/buddy react` | Manually trigger a reaction |
| `/buddy list` | List all available species, eyes, hats, rarities |
| `/buddy pick [...]` | Override appearance (see below) |
| `/buddy reset` | Restore original deterministic companion |

## Buddy picker

Override any combination of traits — omitted fields keep their current value:

```
/buddy pick dragon
/buddy pick wizard hat
/buddy pick heart eye
/buddy pick legendary
/buddy pick rabbit crown star eye epic
```

Eye descriptions work too: `star eye` → ✦, `dot eye` → ·, `heart eye` → ♥, `psi eye` → ψ.

Run `/buddy list` to see every valid value.

Overrides are stored in `~/.config/save-buddy/state/override.json`, separate from `.claude.json` — your account data is never touched. Run `/buddy reset` to clear them and restore your PRNG companion.

## Card colors

The companion card uses ANSI rarity colors — the same palette as the status line HUD. Color adapts to your terminal (truecolor → 256-color → 16-color). Set `NO_COLOR=1` to disable.

| Rarity | Color |
|--------|-------|
| Common | Silver |
| Uncommon | Green |
| Rare | Blue |
| Epic | Purple |
| Legendary | Gold |

## Attribution

Built on top of [save-buddy](https://github.com/jrykn/save-buddy/tree/master#) by [@jrykn](https://github.com/jrykn), which itself is based on [BonziClaude](https://github.com/zakarth/BonziClaude) by [@zakarth](https://github.com/zakarth) and [claude-buddy](https://github.com/1270011/claude-buddy) by [@1270011](https://github.com/1270011).

## License

MIT. See [LICENSE](LICENSE).
