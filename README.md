# Pixel Royale

A browser-based 3D battle royale game.

## Run locally

Install dependencies and start a local static server:

```bash
npm install
npm run build
```

The build creates `index.html` in the project root (ready for GitHub Pages) and a copy in `dist/`.

## Recent visual update

- Reworked floor pickups into distinct low-profile 3D item models.
- Added detailed ammo stacks, medical supplies, shields, throwables, and utility item models.
- Added animated rarity rings, orbiting sparkles, pulsing ground effects, and smoother floating/spinning motion.
- Rebuilt chest and ammo-crate models with reinforced corners, trim, latches, and glowing beacons.
- Added subtle idle motion to loot crates.

## Loot update

- Floor loot is much rarer (~60% fewer items); chests and ammo crates are the main source of good gear.
- Floor items are mostly healing/utility, with occasional low-rarity weapons (max Epic) and ammo stacks.
- Picked-up loot now disappears with a coloured pop effect.
- Floor item glow scales with rarity: commons are subtle, Rare+ get halo and sparkles, Epic+ get a beam.

## Lobby UI update

- New top navigation bar (Lobby / Online / Locker / News / Settings) with your player badge.
- Lobby home: party panel, hero on a glowing pad, game-mode card and a big PLAY button.
- Locker rebuilt as rarity-coloured item tiles (Outfit, Name Color, Sprint Trail, Emote); hero select now lives here.
- Settings uses a sidebar of categories; Online Party and the party lobby use slot cards.

## Bot AI update

- `botnav.js`: lazy 1m walkability grid + A* (time-budgeted) so bots path through doors and around props/trees/water.
- `bots.js`: personality system (8 archetypes + quirks), perception (FOV, hearing gunshots/footsteps), modes: loot, roam, rotate, fight, chase, investigate, flee (to cover), hide (heal when low), camp.
- Anti-stuck: progress monitor escalates jump -> ban blocked cells & re-plan -> random detour -> pop out to nearest open cell.
- `botnames.js`: curated + procedurally combined names, themed per personality, with random cosmetics.

## Multiplayer fix

- "Back to Lobby" after a match now returns everyone to the party lobby instead of kicking guests to the title screen.
- Hosts can still take new players after a match.
- A guest who quits mid-match hands their character to a bot.
