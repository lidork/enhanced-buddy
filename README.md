# enhanced-buddy

A fork of [save-buddy](https://github.com/jrykn/save-buddy/tree/master#) by [@jrykn](https://github.com/jrykn) — adds a companion picker, rarity card colors, and a multi-buddy roster (up to 10 companions).

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
| `/buddy pick [...]` | Override active buddy's appearance |
| `/buddy reset` | Restore original deterministic companion |
| `/buddy roster` | List all companions in your roster |
| `/buddy new [...]` | Create a new companion (wizard if no args) |
| `/buddy switch <name>` | Switch active companion |
| `/buddy free <name>` | Permanently release a companion |

## Buddy roster

You can have up to 10 companions at once (including your original). The original PRNG companion is always preserved and can never be released.

```
/buddy new                    # wizard — prompts for name, traits, generates personality
/buddy new Cinder dragon      # named dragon with randomized other traits
/buddy roster                 # see all companions
/buddy switch Cinder          # switch active companion
/buddy switch original        # return to your original
/buddy free Cinder            # release a companion permanently
```

Roster data is stored in `~/.config/save-buddy/state/roster.json`. The original companion's bones always come from the PRNG — only custom buddies store their full appearance.

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

## Roadmap

- [ ] **Rename / reroll** — let users set a custom name and personality, or reroll them via `/buddy rename` and `/buddy reroll`
- [x] **Multiple companions** — roster of up to 10 companions with `/buddy new`, `/buddy switch`, `/buddy free`
- [ ] **Re-hatching** *(optional)* — trigger a new hatching flow to regenerate name and personality from scratch
- [ ] **More species and graphics** — expand the sprite library with additional species and alternate art styles
- [ ] **Tamagotchi mechanics** — hunger, happiness, or energy stats that change over time and respond to how often you code

## Attribution

Built on top of [save-buddy](https://github.com/jrykn/save-buddy/tree/master#) by [@jrykn](https://github.com/jrykn), which itself is based on [BonziClaude](https://github.com/zakarth/BonziClaude) by [@zakarth](https://github.com/zakarth) and [claude-buddy](https://github.com/1270011/claude-buddy) by [@1270011](https://github.com/1270011).

## License

MIT. See [LICENSE](LICENSE).
