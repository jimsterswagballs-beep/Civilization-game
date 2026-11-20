export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export const clamp=(v,a,b)=>v<a?a:v>b?b:v;
export const lerp=(a,b,t)=>a+(b-a)*t;
export const RARITY=[
 {n:'Common',c:'#bfc5cf',dm:1,mm:1,w:40},
 {n:'Uncommon',c:'#4cd964',dm:1.08,mm:1,w:30},
 {n:'Rare',c:'#3d8bff',dm:1.17,mm:1.1,w:18},
 {n:'Epic',c:'#b655ff',dm:1.27,mm:1.15,w:8},
 {n:'Legendary',c:'#ffa31a',dm:1.4,mm:1.25,w:3.5},
 {n:'Mythic',c:'#ff3d85',dm:1.6,mm:1.4,w:.6}];
export const AMMO={light:{n:'Light',max:250,box:60,c:'#ffd54a'},med:{n:'Medium',max:220,box:50,c:'#ff9a3c'},shells:{n:'Shells',max:40,box:12,c:'#ff5c5c'},heavy:{n:'Heavy',max:40,box:10,c:'#7ad0ff'},rockets:{n:'Rockets',max:14,box:3,c:'#a0ff7a'}};
const w=o=>Object.assign({pellets:1,speed:0,grav:0,bounce:0,fuse:0,splash:0,kb:0,zoom:1,range:150,auto:true,melee:false,head:2,lw:10,rc:1,sp:.01,reload:2,mag:0,col:'#444'},o);
export const WEAPONS=[
 w({n:'Pickaxe',t:'melee',dmg:22,rps:2,range:3,melee:true,kb:3,col:'#8a6b3b',lw:0}),
 w({n:'Tactical AR',t:'ar',ammo:'med',dmg:28,rps:6.5,mag:30,reload:2.2,sp:.012,rc:1,range:170,col:'#39414f',lw:16}),
 w({n:'Bulldog AR',t:'ar',ammo:'med',dmg:35,rps:4.6,mag:25,reload:2.5,sp:.01,rc:1.25,range:170,col:'#4b4036',lw:11}),
 w({n:'Scoped Scout',t:'ar',ammo:'med',dmg:40,rps:3.2,mag:20,reload:2.4,sp:.006,rc:1.4,range:230,zoom:2.2,col:'#2f4a3a',lw:8}),
 w({n:'Compact SMG',t:'smg',ammo:'light',dmg:17,rps:12,mag:32,reload:1.8,sp:.028,rc:.7,range:100,col:'#2d3a55',lw:16}),
 w({n:'Buzzsaw SMG',t:'smg',ammo:'light',dmg:12,rps:17,mag:40,reload:2,sp:.04,rc:.6,range:85,col:'#5a2d55',lw:10}),
 w({n:'Silent SMG',t:'smg',ammo:'light',dmg:15,rps:10,mag:30,reload:1.7,sp:.02,rc:.55,range:110,col:'#22262e',lw:8,quiet:1}),
 w({n:'Pump Shotgun',t:'sg',ammo:'shells',dmg:11,pellets:10,rps:.9,mag:5,reload:4.2,sp:.05,rc:3.5,range:42,auto:false,col:'#6b3a2a',lw:14}),
 w({n:'Tac Shotgun',t:'sg',ammo:'shells',dmg:8,pellets:8,rps:2.3,mag:8,reload:3.2,sp:.055,rc:2.2,range:38,auto:false,col:'#3a3a3a',lw:12}),
 w({n:'Double Barrel',t:'sg',ammo:'shells',dmg:10,pellets:12,rps:1.5,mag:2,reload:2.6,sp:.07,rc:4,range:32,auto:false,col:'#7a5a33',lw:8}),
 w({n:'Bolt Sniper',t:'sn',ammo:'heavy',dmg:105,rps:.8,mag:1,reload:2.5,sp:.0008,rc:5,range:420,zoom:5,auto:false,head:2.5,col:'#24303a',lw:5}),
 w({n:'DMR',t:'sn',ammo:'heavy',dmg:58,rps:2.2,mag:10,reload:2.8,sp:.003,rc:2.2,range:320,zoom:3,auto:false,head:2.2,col:'#3a4a2a',lw:7}),
 w({n:'Pistol',t:'pi',ammo:'light',dmg:24,rps:6,mag:15,reload:1.4,sp:.012,rc:.8,range:100,auto:false,col:'#505560',lw:14}),
 w({n:'Hand Cannon',t:'pi',ammo:'light',dmg:56,rps:2.2,mag:7,reload:2,sp:.01,rc:2.5,range:130,auto:false,col:'#8a8f99',lw:8}),
 w({n:'Rocket Launcher',t:'ex',ammo:'rockets',dmg:100,splash:6.5,speed:55,rps:.8,mag:1,reload:3.3,rc:3,auto:false,col:'#4a5a3a',lw:5}),
 w({n:'Grenade Launcher',t:'ex',ammo:'rockets',dmg:70,splash:5,speed:32,grav:14,bounce:.4,fuse:1.6,rps:1.6,mag:6,reload:3.2,rc:1.5,auto:false,col:'#3f4a55',lw:6}),
 w({n:'Banana Blaster',t:'fun',ammo:'light',dmg:18,splash:2.5,speed:38,grav:4,rps:2.5,mag:8,reload:2,rc:1,auto:false,col:'#ffe14a',sp:.01,sp2:'banana',lw:9}),
 w({n:'Rubber Chicken Cannon',t:'fun',ammo:'rockets',dmg:30,splash:4,speed:40,grav:3,kb:18,rps:1.2,mag:4,reload:3,rc:2,auto:false,col:'#fff08a',sp2:'chicken',lw:6}),
 w({n:'Confetti Cannon',t:'fun',ammo:'shells',dmg:3,pellets:16,sp:.12,rps:1.3,mag:6,reload:2.5,range:30,kb:3,rc:1.5,auto:false,col:'#ff6bd6',sp2:'confetti',lw:8}),
 w({n:'Bouncy Ball Gun',t:'fun',ammo:'med',dmg:38,splash:3,speed:30,grav:16,bounce:.85,fuse:3.5,rps:2.8,mag:12,reload:2.4,rc:1,col:'#3cd0ff',sp2:'ball',lw:8}),
 w({n:'Frying Pan',t:'melee',dmg:65,rps:1.2,range:3.2,melee:true,kb:14,col:'#2b2b2b',lw:7,auto:false}),
 w({n:'Disco Laser',t:'fun',ammo:'light',dmg:9,rps:20,mag:100,reload:2.5,sp:.004,rc:.2,range:120,col:'#ff3dff',laser:1,lw:6}),
 w({n:'Sticky Bomb Launcher',t:'ex',ammo:'rockets',dmg:85,splash:5.5,speed:36,grav:12,fuse:1.8,bounce:0,rps:1.2,mag:4,reload:3,rc:1.5,auto:false,col:'#6a4a8a',lw:5}),
 w({n:'Potato Cannon',t:'fun',ammo:'light',dmg:32,speed:85,grav:8,rps:3,mag:10,reload:2.2,rc:1.2,auto:false,col:'#b08a55',sp2:'potato',lw:9}),
 w({n:'Fish Slapper',t:'melee',dmg:42,rps:2,range:3,melee:true,kb:8,col:'#5ab0d0',lw:8,auto:true}),
 w({n:'Pirate Blunderbuss',t:'sg',ammo:'shells',dmg:14,pellets:14,rps:.6,mag:1,reload:2.2,sp:.1,rc:4,range:30,kb:10,auto:false,col:'#6a3d1a',lw:5}),
];
export const ITEMS={
 bandage:{n:'Bandage',kind:'heal',time:2,hp:15,cap:75,col:'#f2f2f2',stack:15,give:5,lw:14,ic:'🩹'},
 medkit:{n:'Medkit',kind:'heal',time:4,hp:100,cap:100,col:'#ff4d4d',stack:3,give:1,lw:4,ic:'➕'},
 minishield:{n:'Mini Shield',kind:'shield',time:2,sh:25,cap:50,col:'#4db8ff',stack:6,give:2,lw:12,ic:'🧪'},
 bigshield:{n:'Big Shield',kind:'shield',time:3.5,sh:50,cap:100,col:'#2d6bff',stack:3,give:1,lw:4,ic:'🛡'},
 chug:{n:'Chug Jug',kind:'chug',time:5,col:'#ae5dff',stack:1,give:1,lw:1.2,ic:'🍼'},
 grapple:{n:'Grappling Hook',kind:'grapple',col:'#ffd23d',stack:6,give:3,lw:3,ic:'🪝'},
 pad:{n:'Launch Pad',kind:'place',col:'#2dff8f',stack:4,give:2,lw:3,ic:'⏫'},
 frag:{n:'Frag Grenade',kind:'throw',col:'#6b8f3a',stack:6,give:3,lw:8,ic:'💣'},
 boogie:{n:'Boogie Bomb',kind:'throw',col:'#ff55ff',stack:4,give:2,lw:4,ic:'🪩'},
 banana:{n:'Banana Peel',kind:'place',col:'#ffe14a',stack:6,give:3,lw:4,ic:'🍌'},
};
export const CHARS=[
 {id:'coolguy15',name:'Coolguy15',role:'All-rounder',hp:100,color:'#6ec6ff',
  ab:[{n:'Ground Slam',cd:12,d:'Jump into the air and slam down, sending projectiles flying in every direction.'},
      {n:'Overdrive Aura',cd:14,d:'Gain an aura that boosts attack speed by 50% for 3 seconds.'},
      {n:'Energy Dodge',cd:8,d:'Quick backward dodge that leaves an energy burst behind.'}]},
 {id:'zach',name:'Zach',role:'Attacker / Tank',hp:115,color:'#ffd84a',
  ab:[{n:'Burger Break',cd:20,d:'Eat a burger to restore 20% health. Short stun while chewing.'},
      {n:'Chomp Lunge',cd:10,d:'Lunge forward and bite an enemy for 20% of their max health.'},
      {n:'Sugar Rush',cd:18,d:'Gain a 25 point temporary shield and +15% move speed for 5 seconds.'}]},
];
export const ACTIONS=[
 ['fwd','Move Forward','KeyW'],['back','Move Back','KeyS'],['left','Move Left','KeyA'],['right','Move Right','KeyD'],
 ['jump','Jump / Leave Bus','Space'],['sprint','Sprint','ShiftLeft'],['crouch','Crouch / Slide','KeyC'],
 ['fire','Fire / Use','Mouse0'],['aim','Aim Down Sights','Mouse2'],['reload','Reload','KeyR'],['interact','Interact / Pick Up','KeyE'],
 ['ab1','Ability 1','KeyQ'],['ab2','Ability 2','KeyF'],['ab3','Ability 3','KeyV'],
 ['s1','Slot 1 (Melee)','Digit1'],['s2','Slot 2','Digit2'],['s3','Slot 3','Digit3'],['s4','Slot 4','Digit4'],['s5','Slot 5','Digit5'],['s6','Slot 6','Digit6'],
 ['next','Next Slot','WheelDown'],['prev','Previous Slot','WheelUp'],['drop','Drop Item','KeyX'],['map','Big Map','KeyM'],['score','Scoreboard','Tab'],['spec','Next Spectate Target','Mouse0'],
];
export const DEFAULT_SETTINGS={quality:'High',scale:100,res:'native',fov:92,fps:false,master:80,sfx:90,music:40,sens:1,camSens:1,adsSens:.7,invertY:false,crouchToggle:false,aimToggle:false,autoSprint:false,hitmarkers:true,dmgNumbers:true,shake:1,bob:1,mapRotate:true,dist:'Far',particles:'High',pix:'Slight',vib:132,bright:108,xcol:'#ffffff',xsize:1};
export const POI_NAMES=[];
export function keyLabel(c){if(!c)return '—';if(c.startsWith('Key'))return c.slice(3);if(c.startsWith('Digit'))return c.slice(5);const m={Mouse0:'LMB',Mouse1:'MMB',Mouse2:'RMB',Mouse3:'Mouse 4',Mouse4:'Mouse 5',WheelUp:'Wheel ↑',WheelDown:'Wheel ↓',Space:'Space',ShiftLeft:'L-Shift',ShiftRight:'R-Shift',ControlLeft:'L-Ctrl',ControlRight:'R-Ctrl',AltLeft:'L-Alt',AltRight:'R-Alt',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Backquote:'`',Minus:'-',Equal:'=',BracketLeft:'[',BracketRight:']',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/',Backslash:'\\',Escape:'Esc',Enter:'Enter',Tab:'Tab',CapsLock:'Caps'};return m[c]||c}
