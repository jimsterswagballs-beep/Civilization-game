# Heroes: Chill Guy & Jay

All numbers live in one place: `BAL` in `data.js`. Change them there and the HUD, locker text and logic all follow.
Times are seconds, distances metres. Ability damage is *not* scaled by `WEAPON_DMG_MUL`.

## 1. Balance values

### Chill Guy: Stealth / Glass Cannon, 75 HP
| Ability | Cooldown | Values |
|---|---|---|
| Disappear (Q) | 16 | Invisible 3s. Ends on firing, melee, throwing, Sneaky Strike or taking player/bot damage (storm damage does not reveal). Bots see you only inside 6m. Players see a faint shimmer inside 4.5m. |
| Cold Blooded (F) | 14 | 4s: weapon damage x1.3 (guns, melee, weapon projectiles; not abilities), move speed x1.15. |
| Sneaky Strike (V) | 9 | Needs a target within 8.5m in front, with line of sight (else "No target", no cooldown spent). Dash 27 m/s. 30 damage; 60 if the target faces away (backstab). Slow 40% for 2s (2.8s on backstab). Reveals you. |
| Quiet Steps (passive) | - | Footstep/slide/landing volume x0.25, audible only within 12m (normally 35m). Bots spot him from 75% distance. |

Cooldown cycle: 16s cloak vs 3s duration gives about 19% uptime. Glass cannon check: 75 HP is 3 AR bursts; a full combo (Cold Blooded, Disappear, backstab 60, then ~4s of rifle at x1.3) is roughly 60 + 4 x 165 = 700 potential damage but every step is cancelled by a hit, so the risk is on the player.

### Jay: Chef / Support, 110 HP
| Ability | Cooldown | Values |
|---|---|---|
| Pan Boomerang (Q) | 7 | Flies 19m out at 32 m/s, returns at 38 m/s to Jay's current position. 28 damage out, 22 back (50 max), once per target per leg, small knockback. Stops at walls and turns back. Hit radius 1.1m. Lifetime 3.4s. |
| Food Fight (F) | 10 | Shuffled bag of 4 (each food once per 4 throws, next food shown on the ability icon). Speed 27, arcing. |
| Burger | | Teammate: +15 HP (first one hit). Enemy: 12 damage. |
| Pizza | | Healing area r3.2m, 5s, 5 HP/s per teammate (up to 25). Enemy direct hit: 6 damage. |
| Chilli | | Explosion r4.2m, 36 damage at centre falling to 40%, 0.8s daze, knockback. Never hurts teammates or the thrower. |
| Banana | | Slippery patch r2.6m, 6s. Enemies slip for 1.4s, keep momentum (slide), then are immune to patches for 2.2s. |
| Kitchen Special (V) | 26 | 0.55s cooking (35% move speed, no weapons/sprint), then lobs a pot (flies over players). Station r4.6m, 6s, 8 HP/s per teammate (up to 48). |
| Chef's Touch (passive) | - | Consumables (bandage, medkit, shields, chug, banana peel) can be picked up from 35% further, are used 20% faster, and heal Jay 15% more. Food abilities heal Jay 15% more too. |

Healing per cooldown: pizza 25 per 10s, station 48 per 26s. Both are weaker than a medkit and require standing in the zone, and Jay's own pan and food damage is modest, so he supports rather than carries.

## 2. Multiplayer behaviour

**Teammates.** The game was free-for-all, so a team field was added. Offline: everyone is alone (Jay's zones heal himself). Online party: all human players share team 0 (bots are always on their own). Jay's healing and the new abilities' damage/slow effects respect teams, so party members are never hit by the new abilities. Existing weapons are unchanged and still hurt party members, and the win condition is unchanged.

**Authority.** The owner's machine predicts cooldown, cloak timer, dash, throw/cook animation and sound, then sends one `{t:'ab', i, yaw, pt, ...}` message. The host decides everything that affects others and replicates it:

| Thing | Who simulates | How others see it |
|---|---|---|
| Cloak | Owner's machine (timer) | Flag bit 4096 in position packets/snapshots. Host clears it immediately on damage and tells the owner (`st: reveal`). |
| Cold Blooded damage | Host (`coldUntil`, 4s, set when the host receives the cast) | Flag bit 32768 gives the aura/tint. Speed boost is applied by the owner. |
| Sneaky Strike | Dash on owner, hit resolved on host | Host re-validates the target (range +1.6m slack, not an ally), schedules the hit when the dash arrives, applies damage and slow, sends `vfx dash/stab`. |
| Pan | Host (`pans`) | `pn+` spawn, `pn~` turn, `pn-` end; clients animate in between. |
| Food, pot | Host projectiles (normal `pj` events) | Models chosen from the projectile's sprite key `f_*`. |
| Healing zones, banana patch | Host (`zones`, ticks every 0.5s / 0.1s) | `zn+` / `zn-` events; the host sends heal numbers (`heal`) so a client's HP always comes from snapshots. |
| Slow / slip / daze / knockback | Host decides, target machine applies (`st` events) | Same path bots and players already used for slips and knockback. |

**Cooldown validation.** The host rejects a hero ability message that arrives before 85% of its cooldown has elapsed since the last one (15% slack for latency).

**Bots.** Bots can be either new hero. They use the same code paths as the host player (abilities, cooldowns, cloak, reveal). They cannot see a cloaked player beyond 6m.

**Events added:** `vfx`, `zn+`, `zn-`, `pn+`, `pn~`, `pn-`, `heal`. **Flag bits added:** 4096 cloaked, 32768 cold blooded, 65536 slowed, 131072 cooking. Old clients will not understand these, so everyone must run the same build.

## 3. Sprites
`IMG` in `shared.js` holds `front/side/back` per character; `updateSprite` picks the view from the angle between the camera and the character's facing and mirrors the side view, so both new characters use it unchanged. Chill Guy is pure black, so a multiplicative tint cannot flash him; `crispMat` has a new additive `glow` colour used for his hit flash and icy glow.
