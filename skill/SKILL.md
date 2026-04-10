---
name: buddy
description: Show your companion, pet it, pick a species/hat/eye, check stats, or toggle reactions. Routes to enhanced-buddy MCP server tools.
---

Route the user's command to the appropriate buddy MCP tool:

- `/buddy` or `/buddy show` - Call the `buddy_show` MCP tool. It returns a pre-rendered companion card. Display it exactly as returned in a code block.
- `/buddy pet` - Call the `buddy_pet` MCP tool and display the returned reaction.
- `/buddy stats` - Call the `buddy_stats` MCP tool and display the returned JSON.
- `/buddy mute` or `/buddy off` - Call the `buddy_mute` MCP tool with `{"muted": true}`.
- `/buddy unmute` or `/buddy on` - Call the `buddy_mute` MCP tool with `{"muted": false}`.
- `/buddy react` - Call the `buddy_react` MCP tool with recent conversation context.
- `/buddy list` - Call the `buddy_list` MCP tool and display all available species, eyes, hats, and rarities.
- `/buddy pick [species] [hat] [eye] [rarity]` - Call the `buddy_pick` MCP tool with any combination of fields parsed from the user's words. All fields are optional — only pass the ones the user specified. Eye characters may be typed literally or described (e.g. "star eye" → ✦, "dot eye" → ·). Display the returned card exactly as returned in a code block.
- `/buddy reset` - Call the `buddy_reset` MCP tool to clear any overrides and restore the original deterministic companion. Display the returned card in a code block.

Do not recreate the companion card layout yourself. The `buddy_show` and `buddy_pick` tools already return the full formatted ASCII card.
