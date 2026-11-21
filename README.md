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

## Building and destruction

- **Build mode**: press B. The wheel (or the next/previous keys) changes the piece (wall, floor, ramp), T rotates it, Y changes the material, and left click places it. The ghost preview is green when the placement is valid and red otherwise, with the reason shown under the build bar.
- **Pieces**: walls, floors and ramps snap to a 4 m grid. Ramps are six solid steps, so players and bots walk up them with the normal step-up rule.
- **Materials**: wood, stone and metal, shown at the top left. Wood and stone come from shooting trees and rocks (a tree takes 4 hits, a rock 6). Metal and other material stacks come from loot and chests.
- **Destruction**: each piece has HP that depends on its material. Bullets and explosions damage pieces. Destroyed pieces leave debris that falls, bounces on terrain and expires after a few seconds. Anything that loses its support collapses.
- **Multiplayer**: the host validates placement, cost and damage and sends the results as events (`bp`, `bh`, `bx`, `mats`, `dec`, `hv`), the same way other effects are sent. Guests send build requests (`build`) to the host.
- **Bots**: bots damage pieces with their shots and path around new walls. They do not place pieces, and they do not harvest trees or rocks yet.

## Destruction and mining

- **Destructible**: trees, rocks, boulders, building walls, roofs and props, and everything built by players. Ground slabs, sign posts and the round silos, windmill and lighthouse are not.
- **Damage**: each part has hp (`PART_RES` in `materials.js` sets how each material resists). Bullets, the pickaxe and explosions all damage parts. Wood is weak to explosions, stone resists bullets, metal resists bullets most. Trees take less from bullets, rocks take less from bullets than from the pickaxe.
- **Cracks**: a damaged part shows crack overlays that get heavier below 75%, 50% and 25% hp (`cracks.js`).
- **Collapse**: when a part breaks, anything it was holding up falls, including roofs left without walls and players' pieces without support.
- **Mining**: the pickaxe mines what it hits. Trees give wood (plus a bonus when felled), rocks give stone (plus a bonus when broken), and buildings and pieces give their own material. Guns and explosions do not give materials.
- **Multiplayer**: the host decides all damage and breaks. Guests get `ph` / `px` (world part hp / destroyed), `bh` / `bx` (piece hp / destroyed) and `gain` events. Bots shoot and blow things up but do not mine.

Known limits: the multiplayer code has only been tested with fake networking, not with real PeerJS, and the crack visuals have not been checked in a browser.

## Item models

- Consumables and throwables use one builder (`makeFloorItem` in `loot.js`) for both the dropped item and the item in the player's hand, so the shape matches before and after pickup. Previously the hand showed a plain coloured box.
- Weapons already shared one builder (`makeWeaponModel`) for the floor, the hand and other players.

## HUD: loadout, materials and abilities

- **Loadout**: six slots, each with its number, a rarity strip along the bottom, and the weapon's rarity name or the item's stack count. Empty slots are dashed.
- **Abilities**: three cards with their key, icon and name. Cooldowns show as a radial sweep with the seconds left. The icon dims while cooling down, and a ready ability pulses.
- **Materials**: a panel above the abilities with wood, stone and metal. A count flashes when it changes.
- **Layout**: the bottom bar is a three-column grid (abilities and materials, health and loadout, ammo). Below 900px it stacks vertically so nothing overlaps.

## HUD fit to the screen

- The HUD is laid out for a 1280×720 screen and scaled to the window (between 0.7× and 1.6×). It rescales when the window is resized.
- Damage numbers are placed with the same scale, so they stay on their targets.

## Heroes update (v1.3)

- Two new playable characters: **Chill Guy** (stealth glass cannon) and **Jay** (chef support), each with 3 abilities and a passive. See `ABILITIES.md` for balance values and multiplayer behaviour.
- Character select artwork and ability icons are generated in `icons.js`; all hero logic is in `abilities.js`; tunables are in `BAL` (`data.js`).
- Sprite imports in `shared.js` now use `./` paths so the build works from this folder layout.
- Teams: party members share team 0. Bots and solo players get a unique negative team, so Jay's healing and banana zones only treat real teammates as allies (in solo, nobody is allied by accident).
- Bots are drawn from all four characters (`botnames.js`), so Chill Guy and Jay appear in bot matches and use their own bot logic (`botChill`, `botJay`).
- The HUD shows the hero ability icons, the next food in Jay's bag, and a buffs row (Cloaked, Cold Blooded, Cooking).

## Team modes and bot teammates

- **Modes**: Solo (1 per team), Duos (2), Trios (3) and Squads (4). Pick one in the solo lobby or the party lobby (host). `MODES` and `buildEntrants` live in `teams.js`.
- **Party and teams**: in team modes the party is grouped in join order, so a party of 3 in Trios is one team. Extra party members start new teams.
- **Fill with bots**: when on, bots fill empty teammate slots first. When off, partly filled teams stay partly filled and the bot slider only adds bot teams.
- **Win condition**: the match ends when one team is left (in Solo, when one player is left). A team's place counts teams still standing.
- **No friendly fire**: bullets, melee, abilities and explosions never hit a teammate (`isAlly` in `combat.js`). Jay's food still heals teammates.
- **Team panel**: top-left shows your teammates with health and distance. Teammates show as green dots on the minimap.
- **Bot teammates** (`bots.js`):
  - Bots never treat a teammate as an enemy, whether seen or heard.
  - A bot that is far from its team walks back to it (`regroup`). It follows the nearest teammate and stops when it is close again.
  - A bot with a healing item gives it to a hurt teammate who is nearby. A bot with spare ammo gives some to a teammate who is nearly out.

## Knocked, revive, reboot cards and vans (team modes)

- **Knocked** (`knock.js`): in team modes a player who runs out of health is knocked instead of eliminated. Knocked players crawl slowly (`CRAWL`), cannot shoot, use abilities, drop or pick up items, and have `KNOCK_T` (30 s) before they are eliminated. Enemies can finish them off with any damage.
- **Revive**: a standing teammate holds interact within 2.6 m for `REVIVE_T` (4 s). Damage to the reviver cancels the revive, and moving out of range resets the progress. The revived player comes back with `REVIVE_HP` (30).
- **Team out**: when nobody on a team is standing, its knocked players are finished off.
- **Reboot cards**: when a player is eliminated and a teammate is still standing, a card drops. A teammate picks it up with interact within 2.4 m. Cards last `CARD_T` (120 s). If the carrier is eliminated, the card falls where they fell.
- **Reboot vans**: five vans are placed across the map from the match seed, so every client has the same positions. A carrier who presses interact near a ready van starts a `VAN_T` (8 s) reboot. The carrier must stay within about 5.5 m, or the reboot is cancelled and the card goes back to them. A rebooted player returns with `REBOOT_HP` (50), a pistol and 30 light ammo. The van then cools down for `VAN_COOL` (60 s).
- **HUD**: your own knock shows a countdown and your revive progress. The team panel shows knocked teammates with a revive bar, and eliminated teammates with a reboot card status. Notifications appear as toasts for your team.
- **Sync**: knocked is a flag bit, and cards and vans are in each snapshot. The host decides everything. Clients send a `hold` message when they press or release interact.
- **Tests**: `knock.js` logic was checked with a Node harness (timers, revive and interrupts, team out, cards, vans, cooldowns and expiry).

- **Bots revive** (`botThink`, mode `revive`): a bot with no enemy in sight, a safe distance from the storm and enough health walks to the nearest knocked teammate within 60 m and holds interact within 2.2 m. It is interrupted if it is hit or an enemy appears.

Not built yet: bots rebooting teammates from cards and vans, pings, and a bot-side knocked response. A knocked bot stands still until it is finished.

## Lobby remake and Starter Island

- **Solo lobby** (the Lobby tab): match setup (name, bots, difficulty) sits on the left next to a hero showcase with stats and a Change hero button. Play drops straight into a match with a quick fade. The battle royale map shows behind the screen.
- **Party lobby** (after you create or join a party): the squad panel is on the left, match settings and Board Bus are on the right, and your hero picker sits in a bar under the island.
- **Starter Island** (`starter.js`): a walkable island shown only behind the party lobby. Your hero stands on the plaza, the Battle Bus is parked on the north side, and a cabin, palms, rocks and training dummies fill the island. WASD walks (relative to the camera), ← / → turn the camera, and G dances.
- **Board Bus** (party host): the bus flies off with your hero aboard, the screen fades to black, and the match starts (`App.boardThen` in `main.js`). Solo Play skips the bus and just fades.
- Player names in the lobby are escaped before they are written to the page.

## Dive and glide camera

- While skydiving and gliding the camera is third person, behind the hero. On landing it blends back to first person in about a third of a second (`tpPose` and `tpK` in `game.js`).
- Gliding shows a glider canopy with strings to the hero's shoulders, coloured by hero (`makeGliderModel` in `game.js`). It opens with a short deploy animation and sways in the wind. Other players see it too.

## Weapon damage and new items

- **Weapon damage**: every weapon's damage is multiplied by `WEAPON_DMG_MUL` in `shared.js`, now `.55` (it was `.7`). Change that one number to tune how fast fights end.
- **Homing Missile Launcher** (rockets ammo): each missile re-picks a target every 0.25 s, the nearest enemy within about 40 degrees either side of its flight path, up to 90 m away, with a clear line of sight. It steers toward that target at a limited turn rate. The host runs the steering and sends `pjv` updates so every client draws the same flight path.
- **Jetpack** (`jet`): drinking it gives 6 s of fuel. Hold Space in the air to climb, up to 11 m/s. Fuel only burns while you thrust.
- **Energy Drink** (`energy`): +10 HP and +25% move speed for 8 s.
- **Chili Pepper** (`pepper`): Spicy for 8 s, +30% weapon damage (host-side, from flag bit `262144`), plus a fire trail while sprinting.
- **Invisibility Cloak** (`cloak`): invisible for 8 s, using the same cloak flag as Chill Guy. Attacking reveals you, and so does taking damage from someone else.
- **Recon Drone** (`drone`, deploy): placed 2.4 m in front of you and hovers for 14 s. Every 0.8 s it shoots the nearest enemy within 40 m that it has a clear line to, for 7 damage (host-run, sends `dz` tracers).
- **Air Strike** (`strike`, call-in): aim at the ground (up to 150 m) and a red ring marks the spot for 2.5 s. Then six bombs fall within about 6.5 m of it (host-run; clients send a `strike` message).
- **Frost Grenade** (`frost`, throwable): bursts after 1.8 s, slows enemies in the blast by 50% for 3 s, and deals damage.
- **Shock Trap** (`shock`, placed): the first enemy to step on it within about 1.5 m is stunned for 1.3 s and the trap is removed. The owner never triggers it.

Known limits:
- Bots do not use the new items; they only use the homing launcher through normal weapon scoring.
- The jetpack, energy and spicy effects are not drawn on remote players.
- Multiplayer with real PeerJS has not been tested. Headless tests cover single-player and bot logic only.

## Kill feed

- Weapon kills show the weapon name and its rarity colour. The kill event's weapon id is `weapon*10+rarity`, decoded before lookup.
- Each row reads killer, weapon, victim. You appear as "You" (highlighted for kills, red for your death).
- The storm, self kills ("own goal"), and a killer who has left the match each get their own label.
- Headshot kills get a "Headshot" tag. The kill event carries a `h` flag for this.
- Frag and Boogie grenades have separate kill names (`-5`, `-17`).
- Player names are written as text, not HTML, so a name containing markup can't inject anything.

## Starter island intermission

- **Play** (solo) or **Board Bus** (party host) now opens a 10 second intermission on the Starter Island (`INTER_SECS` in `main.js`).
- Everyone in the match stands on the island with their character and name tag, so you can see the other players while the timer runs. Bots are shown too. You can walk around with WASD and turn with the arrow keys.
- When the timer hits zero, the Battle Bus boards with your hero aboard, the screen fades, and the match starts with the in-match bus.
- Multiplayer: the host sends `inter` (roster and seconds, plus each guest's own entity id) when the intermission starts, then `start` when the timer ends. Guests show the same island from `inter`, then board when `start` arrives.
- If a guest's connection to the host drops during the intermission, the intermission is cancelled and the lobby returns as before.
- Pointer lock is requested from the Play or Board Bus click so mouse control carries into the match. Clicking during the intermission also takes it.
- Code: `starter.js` (`setCrowd`, `updateCrowd`, `clearCrowd`), `main.js` (`soloStart`, `hostStart`, `beginIntermission`, `tickInter`, `endIntermission`, `guestInter`, `boardThen`).
