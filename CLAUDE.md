# enhanced-buddy

Fork of save-buddy with buddy picker support — override species, eye, hat, and rarity via `/buddy pick`.

## Key files

- `server/index.js` - MCP server with `buddy_show`, `buddy_pet`, `buddy_react`, `buddy_mute`, `buddy_stats`, `buddy_list`, `buddy_pick`, `buddy_reset`
- `server/companion.js` - deterministic PRNG, companion config reader, override read/write
- `server/paths.js` - config path resolution; exports `OVERRIDE_PATH`
- `server/sprites.js` - sprite frames, blink rendering, compact face, and speech bubble rendering
- `server/card.js` - companion card renderer; accepts `isCustom` flag for CUSTOM badge
- `server/api.js` - `buddy_react` HTTP client
- `hooks/buddy-stop.js` - automatic post-response reactions
- `hooks/buddy-prompt.js` - addressed-by-name detection
- `hooks/buddy-session.js` - hatch greeting on session start or resume
- `statusline/buddy-hud-wrapper.js` - multi-line status line rendering
- `install.js` / `uninstall.js` - Claude Code integration lifecycle

## Override storage

Picker overrides are stored in `~/.config/save-buddy/state/override.json` — separate from `.claude.json` so account data is never touched. Fields: `species`, `eye`, `hat`, `rarity`, `stats`.

Merge order in `getCompanion()`: `{ ...bones, ...stored, ...override }` — override wins over PRNG and stored personality fields.

## Install

```bash
node install.js
# or dry-run:
node install.js --dry-run
```

## Development

```bash
npm install
npm test
node test/test-api.js
```

## Safety

- OAuth credentials are read on demand and never cached
- token values are never logged
- reactions degrade to local templates when the API is unavailable
- uninstall restores prior Claude Code settings rather than deleting unrelated config
- override.json is separate from .claude.json — picker changes never touch account data
