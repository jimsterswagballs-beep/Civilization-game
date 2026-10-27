KINGDOMS OF CHAOS · LIVING WORLD UPDATE (v4.8)
================================================

HOW TO PLAY
1. Extract the ZIP folder.
2. Open KingdomsOfChaos/index.html in a current version of Chrome, Edge, or Firefox.
3. Click Begin Your Reign. Click once in the page to enable the soundtrack.

WHAT'S NEW IN v4.8 — ONLINE PLAY THROUGH A RELAY SERVER
- Online lobbies now work without the Claude-hosted version. The game connects to a relay server (relay/server.js, included separately) that relays lobby, commands and world state between players.
- Host a lobby with "Online Lobby", then share the invite link or code. Other players join from the same address.
- To use it, host the game (for example on GitHub Pages) and run the relay. Set RELAY_DEFAULT in the online script of index.html to your relay address (wss://...), or open the game with ?relay=wss://your-relay.
- Up to 8 players per lobby. Online play is tested for lobby, match start and commands. Captives, morale and siege targets are not yet synced to other players.

WHAT'S NEW IN v4.7 — WAR & THE KIDNAPPER'S LOOK
- Kidnapper sprite redrawn: a dark hooded figure in a team-coloured sash, carrying a sack when holding a captive. It no longer carries a weapon.
- Archer (O, Barracks). Shoots arrows at enemies up to 150 away for 5 damage. Frail up close.
- Siege Engine (L, Barracks, Medieval Age). A slow catapult that bombards enemy buildings for 22 damage every 2.5 seconds at range 200. It ignores soldiers and is driven by its own AI, so right-click a building to target it.
- Morale: when soldiers fall nearby, their comrades lose morale. A soldier whose morale falls too low breaks and runs to the castle for a few seconds, then recovers.
- Supply lines: soldiers more than 360 tiles from their castle drain extra food each second.

WHAT'S NEW IN v4.6 — JUSTICE: KIDNAPPERS, JAILS & PUBLIC EXECUTIONS
- Kidnapper (K, trained at a Barracks in the Medieval Age). Right-click an enemy adult civilian to order an abduction. The kidnapper carries the captive back to one of your Jails. Children, heroes and allied kingdoms cannot be taken.
- Jail (Medieval Age, holds 4 captives). Captives cannot work and grow unhappier while held. Select a Jail to order a public execution or a release.
- Guillotine (Medieval Age). Required for public executions. The captive is brought to the blade; the captor's citizens nearby watch. Witnesses lose happiness but feel safer, the captor's approval drops, and the execution is recorded in the Gazette and history.
- Kidnappers that cannot reach their target give up and release their captive.

WHAT'S NEW IN v4.5 — WORKPLACES & A CLEARER SCREEN
- Civilians now hold jobs. Farms (3 workers), mines (3), greenhouses (2), factories (4) and labs (2) each have worker places. Idle citizens are assigned to the nearest free place, walk there at the start of their shift (08:00–16:00), work it and go home in the evening.
- Staffing sets output. Fully staffed buildings produce at full rate. Workers who are tired, unhappy or lacking tools work more slowly. An unstaffed building still runs at 60% so early games are not starved of food or gold.
- Wages are paid only to citizens who hold a job, a trade, a build or an expedition. Previously anyone standing near a building was paid. Unemployed citizens lose a little happiness during working hours.
- Citizen life stories and inspection cards show each person's career and workplace. Building panels show workers and efficiency. The Economy tab lists workplace staffing and output.
- The screen is reorganised into two columns beside the map (resources, log and selection on the left; menu, kingdoms, controls and minimap on the right), the Village Talk / Gazette / Economy panel above the action dock, and the action dock along the bottom. Panels no longer cover each other, and the layout adapts to smaller windows and phones.

WHAT'S NEW IN v4.4 — SEASONS, TRADE & LEGENDS
- Seasons cycle through Spring, Summer, Autumn and Winter. Weather can be clear, rainy, stormy, snowy, frosty or hot. The map receives seasonal tints and weather particles.
- Weather has gameplay consequences: farms and greenhouses have season-adjusted output, heavy weather slightly slows movement, heatwaves affect civilian energy, and winters with poor food reserves can trigger a famine event.
- A living commodity economy tracks Grain, Tools, Cloth, Furniture, Coal and Medicine. Farms, mines, factories and modern labs produce appropriate goods; prices update with available stock and shortages.
- Citizens earn wages from the kingdom treasury, maintain personal savings, and buy goods from stocked local shops. Shop sales and wages move money between citizens and the treasury.
- Markets can establish overland trade routes between connected kingdoms. Routes are drawn on the map, transport goods between inventories and create recorded historical milestones.
- The Realm Gazette is a living in-game newspaper. It publishes seasonal conditions, trade dispatches, daily editions, new settlements, heroic deeds, births and other notable events. A historical record holds named events for the current world.
- Civilians may organise settlement expeditions when their kingdom has grown, the capital is crowded, and sufficient food, wood and stone are available. Pioneers travel to a suitable site and initiate house/farm blueprints; founded villages receive a visible name label and enter the newspaper/history.
- Rare citizens can become heroes through notable deeds or exceptional talent. Heroes have individual titles and skills, improve as they gain experience, can influence combat and construction, and can die permanently. A tiny number of children may have dormant heroic potential that can emerge when they reach adulthood.
- Named legendary milestones include era changes, famous battles, heroic deaths, famine, first trade routes and new settlement foundations. Citizen memories and family stories continue to record personal events.
- Added Talk, Newspaper and Economy tabs to make conversations, news/history, market prices, treasury, trade routes and settlements easier to inspect.

PREVIOUS SYSTEMS RETAINED
- Expanded 144 × 144 world with six biomes: Tundra, Forest, Grassland, Desert, Wetlands and Highlands.
- Civilian genes for skin tone, hair, hairstyle, clothing colours and patterns. Children inherit traits from both parents.
- Civilian personalities, relationships, routines, needs, homes, careers, personal savings, family records, memories, age stages and Life Story panels.
- Blueprint construction with builder civilians; a greenhouse that grows trees over time; age progression through Stone, Medieval, Production and Modern eras.
- Era-specific weapons, buildings, markets, stores and supermarkets.
- Route-cached pathfinding, obstacle-aware movement, corner checks, stuck recovery, smoother camera controls, title screen and UI updates.
- Music tracks are stored beside index.html and loaded from local relative paths. Click once after starting to allow the browser to play audio.

CONTROLS
- Drag: select citizens. Click: inspect units, buildings and resources.
- Right-click: move, attack or gather.
- WASD / arrow keys: pan camera. Mouse wheel: zoom. H: return to your castle.
- 1–0: select the first ten building blueprints. C: Merchant Market. V: General Store. U: Supermarket. Esc: cancel placement.
- Y: train Builder. Q: train Worker. E: train Soldier. X: train Factory Worker.
- R: Fishing Boat. T: Warship. P: pause. M: music. N: sound effects. G: auto-work. F1: help.
- Use Talk, Newspaper and Economy tabs in the social panel to inspect civilian conversations, the Realm Gazette/history and market/trade information.

ECONOMY & SETTLEMENT NOTES
- Farms supply grain; mines and factories produce other goods as the kingdom advances. Dynamic prices respond to stock levels.
- Citizens need personal savings and a functioning shop network to buy goods. Wages are paid only when the treasury can afford them; unpaid wages can lower happiness.
- Trade routes are established between kingdoms with active shops when a navigable land path exists. Water-separated kingdoms without a land route may not connect in this version.
- Independent settlements require Medieval Age, at least 12 citizens, three houses, a crowded capital, and sufficient resources. They are not guaranteed to found if a safe reachable location cannot be found.
- Hero promotion is rare outside notable deeds; heroes retain their unique title and recorded history but can still die in combat.

ONLINE
This ZIP is designed for local single-player play. The optional online lobby depends on the original hosted environment and room service; that service is not bundled with a standalone ZIP, so live online multiplayer cannot be hosted or fully verified by opening this file alone.
