import * as THREE from 'three';
import {CHARS,ACTIONS,DEFAULT_SETTINGS,keyLabel,clamp,WEAPONS,RARITY} from './data.js';
import {Game} from './game.js';
import {Input} from './input.js';
import {Audio} from './audio.js';
import {HUD} from './hud.js';
import {Net,LocalNet} from './net.js';
import {IMG} from './shared.js';
import * as W from './world.js';
import {makeBotRoster} from './botnames.js';
const $=id=>document.getElementById(id);
const BOTNAMES=['Noodle','Sir Quacks','Turbo Toast','Pixel Pete','Captain Crunch','Waffle','Sneaky Sam','Big Chungus','Lil Bandit','Dr. Pickle','Banana Joe','Zoomer','Gizmo','Cheese Wiz','Ninja Nan','Boop','Chad','Meatball','Fuzzy','Rocket Raccoon','Grumpy','Sassy','Taco Tim','Doodle','Blip','Moonpie','Toaster','Yeet','Mr. Bean','Gremlin','Skibidi','Potato','Wobbly','Kevin','Bongo','Pancake'];
const COLORS=['#ffffff','#ffd84a','#6ec6ff','#ff7ab8','#7aff9a','#ff9a3c','#c08aff','#ff5a5a'];
const EMOTES=['Flip-Flop','Victory Hop','Spin Cycle'];
const h=(html)=>{const t=document.createElement('template');t.innerHTML=html.trim();return t.content.firstChild};
class App{
 constructor(){
  this.canvas=$('gl');this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:false,powerPreference:'high-performance'});
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.loadSettings();this.loadProfile();
  this.input=new Input(this.canvas,this);this.audio=new Audio();this.hud=new HUD(this);
  this.game=new Game(this);this.screen='loading';this.paused=false;this.playing=false;this.net=null;this.lobby=null;
  this.menuT=0;this.last=performance.now();
  addEventListener('resize',()=>this.resize());document.addEventListener('fullscreenchange',()=>this.resize());
  this.applySettings();this.resize();
  setTimeout(()=>{this.game.ensureWorld();this.buildScreens();this.go('title');requestAnimationFrame(t=>this.loop(t))},60);
 }
 // ---------- state
 loadSettings(){let s={};try{s=JSON.parse(localStorage.getItem('brg_settings')||'{}')}catch(e){}this.settings=Object.assign({},DEFAULT_SETTINGS,s)}
 saveSettings(){try{localStorage.setItem('brg_settings',JSON.stringify(this.settings))}catch(e){}}
 loadProfile(){let p={};try{p=JSON.parse(localStorage.getItem('brg_profile')||'{}')}catch(e){}this.profile=Object.assign({name:'Player'+Math.floor(Math.random()*900+100),char:'coolguy15',nameColor:'#ffffff',trail:'',emote:0,bots:19,diff:'Normal'},p)}
 saveProfile(){try{localStorage.setItem('brg_profile',JSON.stringify(this.profile))}catch(e){}}
 get cos(){return{nameColor:this.profile.nameColor,trail:this.profile.trail,emote:this.profile.emote}}
 applySettings(){
  const s=this.settings;const q={Low:{pr:.6,fx:.4,fog:350},Medium:{pr:.85,fx:.7,fog:550},High:{pr:1,fx:1,fog:800}}[s.quality]||{pr:1,fx:1,fog:800};
  this.q=q;this.audio.setVol(s.master,s.sfx,s.music);if(this.game.fx)this.game.fx.density=q.fx*(s.particles==='Low'?.4:s.particles==='Medium'?.7:1);
  const fogF={Near:.55,Medium:.8,Far:1}[s.dist]||1;this.game.scene.fog.far=q.fog*fogF;this.game.scene.fog.near=this.game.scene.fog.far*.1;this.game.camera.far=1600;
  this.game.camera.fov=s.fov;document.documentElement.style.setProperty('--xc',s.xcol);document.documentElement.style.setProperty('--xs',s.xsize);this.canvas.style.filter=`saturate(${s.vib/100}) brightness(${(s.bright||108)/100}) contrast(1.05)`;if(this.hud.q&&this.hud.root)this.hud.q('#fps').style.display=s.fps?'block':'none';this.resize()}
 resize(){
  const s=this.settings;let pr=Math.min(devicePixelRatio||1,2)*this.q.pr*(s.scale/100);
  if(s.res!=='native'){const hgt=parseInt(s.res);pr=Math.min(pr,hgt/innerHeight)}
  this.pf={Off:1,Slight:.62,Medium:.45,Chunky:.32}[s.pix]||.62;this.canvas.style.imageRendering='auto';
  this.renderer.setPixelRatio(Math.max(.2,pr));this.renderer.setSize(innerWidth,innerHeight,false);this.game.resize(innerWidth,innerHeight)}
 typing(){const a=document.activeElement;return a&&(a.tagName==='INPUT'&&a.type==='text')}
 gameActive(){return this.playing&&!this.paused}
 inputActive(){return this.playing&&this.input.locked&&!this.paused&&!this.game.over||this.playing&&this.input.locked&&!this.paused&&this.game.over&&false}
 onLockChange(l){
  if(!this.playing)return;
  if(!l&&!this.paused&&!this.endCursor&&!this.input.capture){this.setPause(true)}}
 showCursor(on){this.endCursor=on;if(on&&document.pointerLockElement)document.exitPointerLock()}
 setPause(p){this.paused=p;$('pause').classList.toggle('show',p);if(p){this.renderPause('main')}else{this.lock()}}
 lock(){try{const r=this.canvas.requestPointerLock({unadjustedMovement:true});if(r&&r.catch)r.catch(()=>{try{this.canvas.requestPointerLock()}catch(e){}})}catch(e){}}
 onKey(e){
  if(e.code==='Escape'){if(this.playing&&this.paused){this.setPause(false)}return}
  if(!this.playing)return;
  if(e.code==='F3'){this.settings.fps=!this.settings.fps;this.applySettings();return}
  if(this.input.pressed('map')){const m=$('bigmap');const on=m.style.display!=='flex';m.style.display=on?'flex':'none';if(on)this.hud.drawMinimap(this.game,this.game.viewEnt(),$('bm'))}
 }
 toast(m){const t=$('toastG');t.textContent=m;t.style.display='block';clearTimeout(this.tt);this.tt=setTimeout(()=>t.style.display='none',2600)}
 go(name){
  if(name==='chars'){name='locker';this.lkTab='Outfit'}
  for(const el of document.querySelectorAll('#ui>.screen'))el.classList.remove('show');
  const e=$(name);if(e){e.classList.add('show')}this.screen=name;this.audio.mode='menu';
  if(this['enter_'+name])this['enter_'+name]();this.updateNav(name)}
 // ---------- screens
 buildScreens(){
  $('loading').classList.remove('show');
  this.buildNav();this.buildTitle();this.buildOffline();this.buildOnline();this.buildLobby();this.buildLocker();this.buildSettings();this.buildCredits();this.buildUpdateLog();
  $('btnSpec').onclick=()=>{$('elim').style.display='none';this.endCursor=false;this.lock()};
  $('btnElimMenu').onclick=()=>this.leaveMatch();$('btnAgain').onclick=()=>this.leaveMatch();
  document.addEventListener('pointerdown',()=>{this.audio.init();this.audio.resume()},{once:false});
  this.canvas.addEventListener('click',()=>{if(this.playing&&!this.paused&&!this.input.locked&&!this.endCursor)this.lock();else if(this.playing&&this.endCursor&&this.game.over===false&&!$('elim').style.display!=='none'){}});
 }
 sfx(n){this.audio.play(n)} buildNav(){
  const n=h(`<div id="nav"><div class="nav-logo">PIXEL<span>ROYALE</span></div><div class="nav-tabs" id="navTabs"></div><div class="nav-right"><div class="nav-me" id="navMe"><img alt=""><span></span></div><button class="nav-ico" id="navInfo" title="Credits">i</button><button class="nav-ico" id="navQuit" title="Quit game">&#x23FB;</button></div></div>`);
  $('ui').appendChild(n);
  for(const[k,l]of[['title','Lobby'],['online','Online'],['locker','Locker'],['updates','News'],['settings','Settings']]){const b=h(`<button data-go="${k}">${l}</button>`);b.onclick=()=>{this.sfx('ui');this.go(k)};b.onmouseenter=()=>this.sfx('click');$('navTabs').appendChild(b)}
  $('navInfo').onclick=()=>{this.sfx('ui');this.go('credits')};$('navQuit').onclick=()=>{this.sfx('ui');this.exit()};
 }
 updateNav(name){
  const nav=$('nav');if(!nav)return;nav.classList.toggle('show',!['lobby','loading','pause'].includes(name));
  const act={offline:'title',chars:'locker'}[name]||name;for(const b of $('navTabs').children)b.classList.toggle('on',b.dataset.go===act);
  const c=CHARS.find(x=>x.id===this.profile.char)||CHARS[0];nav.querySelector('.nav-me img').src=IMG[c.id].front;const sp=nav.querySelector('.nav-me span');sp.textContent=this.profile.name;sp.style.color=this.profile.nameColor}
 buildTitle(){
  const t=$('title');
  t.innerHTML=`<div class="lb-bg"></div>
  <div class="lb-party"><div class="lb-h">Party <b>1/4</b></div>
   <div class="pm me"><img id="pmImg" alt=""><div><div class="pn" id="pmName"></div><div class="ps">Party Leader</div></div></div>
   <button class="pm empty" data-go="online"><i>+</i><span>Invite friends</span></button><button class="pm empty" data-go="online"><i>+</i><span>Invite friends</span></button><button class="pm empty" data-go="online"><i>+</i><span>Invite friends</span></button>
  </div>
  <div class="lb-stage"><div id="stage"><div class="pad"></div><div class="sh"></div><img id="stageImg" alt=""></div><div class="plate"><div id="stageName"></div><div class="sub" id="stageRole"></div></div></div>
  <button class="lb-news" data-go="updates"><span class="tag">NEW</span><b>Loot &amp; Lobby Update</b><small>Rarer floor loot, new menus and more</small></button>
  <div class="lb-play"><button class="mode" id="modeCard" data-go="offline"><div class="mk">Game mode</div><div class="mt">Battle Royale</div><div class="ms" id="modeSub"></div><div class="mc">Change &rsaquo;</div></button><button class="btn play" id="playBtn">Play</button></div>
  <div class="hint">WASD move · Shift sprint · C slide · Q/F/V abilities · E loot · M map</div><div class="ver">v1.2 · Lobby update</div>`;
  for(const b of t.querySelectorAll('[data-go]'))b.onclick=()=>{this.sfx('ui');this.go(b.dataset.go)};
  $('playBtn').onclick=()=>{this.sfx('ui');this.startOffline()};
  setInterval(()=>{if(this.screen==='title')this.updateStage()},1400);
 }
 enter_title(){this.updateStage(true);const P=this.profile;$('modeSub').textContent=(P.bots>0?'Solo vs '+P.bots+' bots':'Free roam – no bots')+' · '+P.diff}
 updateStage(swap){const c=this.profile.char;const img=$('stageImg');img.src=IMG[c].front;const cd=CHARS.find(x=>x.id===c);
  const nm=$('stageName');nm.textContent=this.profile.name;nm.style.color=this.profile.nameColor;$('stageRole').textContent=cd.name+' · '+cd.role;
  $('pmImg').src=IMG[c].front;$('pmName').textContent=this.profile.name;
  if(swap){const s=$('stage');s.classList.remove('swap');void s.offsetWidth;s.classList.add('swap')}}

 exit(){try{window.close()}catch(e){}this.toast('You can now close this tab. Thanks for playing!');}
 back(btn){const b=h(`<button class="backbtn">&#9664; Back</button>`);b.onclick=()=>{this.sfx('ui');this.go('title')};return b} mkTile(o){
  const d=h(`<div class="tile ${o.sel?'sel':''}" style="--rc:${o.rc}"><div class="tp">${o.pic}</div><div class="tn">${o.label}</div><div class="tick">&#10003;</div></div>`);
  d.onclick=()=>{o.fn();this.sfx('ui')};d.onmouseenter=()=>this.sfx('click');return d}
 charPicker(sel,onPick,compact){
  const box=h(`<div class="tiles ${compact?'small':''}"></div>`);const rar={coolguy15:4,zach:3};
  for(const c of CHARS){
   const t=this.mkTile({rc:RARITY[rar[c.id]||3].c,pic:`<img src="${IMG[c.id].front}" alt="">`,label:c.name,sel:sel()===c.id,fn:()=>{onPick(c.id);for(const x of box.children)x.classList.remove('sel');t.classList.add('sel')}});
   box.appendChild(t)}
  return box}
 buildOffline(){
  const p=$('offline');p.innerHTML=`<div class="pg"><div class="pg-head"><h2>Game Mode</h2><div id="offBack"></div></div>
  <div class="mode-grid"><div class="mode-big sel"><div class="art"><img id="offArt" alt=""></div><div class="body"><span class="badge">SOLO</span><h3>Battle Royale</h3><p>Drop from the battle bus, loot chests, and outlast the storm against bots. Plays fully offline.</p></div><div class="tick">&#10003;</div></div>
   <button class="mode-big link" id="offOnline"><div class="art online">&#128101;</div><div class="body"><span class="badge b2">PARTY</span><h3>Online Party</h3><p>Create a private lobby and play with friends across the internet.</p></div></button>
   <div class="pg-card opts"><div class="k">Match settings</div><div class="sub">Name</div><input type="text" id="offName" maxlength="14"><div class="sub" style="margin-top:12px">Bots: <b id="botN" style="color:var(--yl)">19</b></div><input type="range" id="offBots" min="0" max="39" style="accent-color:var(--cy);width:100%"><div class="sub" style="margin-top:12px">Difficulty</div><div id="offDiff"></div><div class="tip">0 bots lets you explore the island. Change your outfit in the Locker.</div><button class="btn play sm" id="offGo" style="margin-top:14px;align-self:flex-start">Drop In</button></div></div></div>`;
  $('offBack').appendChild(this.back());
  const nm=$('offName');nm.onchange=()=>{this.profile.name=nm.value.trim()||'Player';this.saveProfile()};
  const bots=$('offBots'),bn=$('botN');bots.oninput=()=>{bn.textContent=bots.value;this.profile.bots=+bots.value;this.saveProfile()};
  const dd=$('offDiff');for(const d of ['Easy','Normal','Hard']){const c=h(`<span class="chip">${d}</span>`);c.onclick=()=>{this.profile.diff=d;this.saveProfile();this.refreshChips(dd,d);this.sfx('ui')};dd.appendChild(c)}
  $('offOnline').onclick=()=>{this.sfx('ui');this.go('online')};
  $('offGo').onclick=()=>{nm.onchange();this.startOffline()}
 }
 refreshChips(box,val){for(const c of box.children)c.classList.toggle('sel',c.textContent===val)}
 enter_offline(){$('offName').value=this.profile.name;$('offBots').value=this.profile.bots;$('botN').textContent=this.profile.bots;this.refreshChips($('offDiff'),this.profile.diff);$('offArt').src=IMG[this.profile.char].front}
 buildLocker(){
  const p=$('locker');p.innerHTML=`<div class="pg"><div class="pg-head"><h2>Locker</h2><div id="lkBack"></div></div>
  <div class="lk-body"><div class="lk-prev"><div id="lkStage"><div class="pad"></div><img id="lkImg" alt=""></div><div id="lkName"></div><div class="sub" id="lkRole"></div><div id="lkInfo"></div></div>
  <div class="lk-side"><div class="lk-cats" id="lkCats"></div><div id="lkGrid"></div><div class="tip">Cosmetics are saved on this device and visible to other players in multiplayer.</div></div></div></div>`;
  $('lkBack').appendChild(this.back());this.lkTab=this.lkTab||'Outfit';
  for(const c of ['Outfit','Name Color','Sprint Trail','Emote']){const b=h(`<button class="cat">${c}</button>`);b.onclick=()=>{this.lkTab=c;this.sfx('ui');this.enter_locker()};$('lkCats').appendChild(b)}
 }
 enter_locker(){
  const P=this.profile,g=$('lkGrid');for(const b of $('lkCats').children)b.classList.toggle('on',b.textContent===this.lkTab);
  const cd=CHARS.find(x=>x.id===P.char);$('lkImg').src=IMG[P.char].front;const n=$('lkName');n.textContent=P.name;n.style.color=P.nameColor;$('lkRole').textContent=cd.name+' · '+cd.role;
  $('lkInfo').innerHTML=`<div class="stat">HP <i style="width:${cd.hp*1.2}px"></i> ${cd.hp}</div>`+cd.ab.map(a=>`<div class="abl"><b>${a.n}</b> <small>(${a.cd}s)</small><br>${a.d}</div>`).join('');
  g.innerHTML='';const tab=this.lkTab;
  const NAMES=['White','Gold','Sky','Pink','Mint','Orange','Violet','Red'];const rc=i=>RARITY[Math.min(5,i%6)].c;
  const set=(k,v)=>{P[k]=v;this.saveProfile();this.enter_locker()};
  if(tab==='Outfit'){g.appendChild(this.charPicker(()=>P.char,id=>{P.char=id;this.saveProfile();this.enter_locker()}));return}
  const box=h(`<div class="tiles"></div>`);
  if(tab==='Name Color')COLORS.forEach((c,i)=>box.appendChild(this.mkTile({rc:rc(i),pic:`<span class="swb" style="background:${c}"></span>`,label:NAMES[i],sel:P.nameColor===c,fn:()=>set('nameColor',c)})));
  if(tab==='Sprint Trail'){box.appendChild(this.mkTile({rc:rc(0),pic:`<span class="swb none">&#8709;</span>`,label:'None',sel:!P.trail,fn:()=>set('trail','')}));COLORS.slice(1).forEach((c,i)=>box.appendChild(this.mkTile({rc:rc(i+1),pic:`<span class="trl" style="--tc:${c}"></span>`,label:NAMES[i+1],sel:P.trail===c,fn:()=>set('trail',c)})))}
  if(tab==='Emote')EMOTES.forEach((e,i)=>box.appendChild(this.mkTile({rc:rc(i+2),pic:`<span class="emo">${['&#128378;','&#127942;','&#127744;'][i]}</span>`,label:e,sel:P.emote===i,fn:()=>set('emote',i)})));
  g.appendChild(box)}
 buildUpdateLog(){
  const root=$('updates');
  root.innerHTML=`<div class="panel"><div class="head"><h2>Update Log</h2><div id="upBack"></div></div>
   <div class="update-list">
    <section class="update-entry"><div class="date">NOVEMBER 20, 2026 · VERSION 1.2</div><h3>Loot &amp; Lobby Update</h3><ul>
     <li>Floor loot is much rarer – chests and ammo crates are now the best source of gear.</li>
     <li>Floor weapons and ammo show up occasionally, mostly at lower rarities.</li>
     <li>Picked-up loot now disappears with a coloured pop effect.</li>
     <li>Smarter bots: A* pathfinding through doors and around props, plus automatic unstick recovery.</li>
     <li>Bots now have personalities (Rusher, Camper, Sniper, Looter, Survivor, Opportunist, Trickster, Balanced) with random quirks.</li>
     <li>Bots hide and heal when low, take cover to reload, hear gunfire and investigate, and have a limited field of view.</li>
     <li>Hundreds of new bot names and thousands of generated combinations, with random cosmetics.</li>
     <li>Brand new lobby: top navigation, party panel, big Play button, tile-based Locker, redesigned Settings and Online Party screens.</li>
    </ul></section>
    <section class="update-entry"><div class="date">NOVEMBER 20, 2026 · VERSION 1.1</div><h3>Visual Overhaul</h3><ul>
     <li>Redesigned floor pickups so weapons, healing items, shields, ammo and utility items are easier to recognise.</li>
     <li>Added floating, spinning and pulsing animations to dropped loot.</li>
     <li>Added rarity rings, ground glow and orbiting sparkle effects around pickups.</li>
     <li>Rebuilt chest and ammo-crate models with extra trim, reinforced corners and latches.</li>
     <li>Added subtle idle animations to loot crates.</li>
    </ul></section>
    <section class="update-entry"><div class="date">PREVIOUS BUILD · VERSION 1.0</div><h3>Pixel Royale Launch Build</h3><ul>
     <li>Core 3D battle royale gameplay with 2D character sprites.</li>
     <li>Offline matches with bots and online private multiplayer lobbies.</li>
     <li>Character selection, locker cosmetics, settings and custom key bindings.</li>
    </ul></section>
   </div><div class="tip">More changes will appear here as Pixel Royale gets updated.</div></div>`;
  $('upBack').appendChild(this.back());
 }
 buildCredits(){$('credits').innerHTML=`<div class="pg" style="text-align:center"><div class="pg-head"><h2>Credits</h2><div id="crBack"></div></div><h1 class="logo" style="font-size:48px;transform:none">Pixel <span>Royale</span></h1><p style="margin:16px 0;font-size:18px;line-height:1.7">Characters: <b>Coolguy15</b> &amp; <b>Zach</b> — your original 2D art<br>Game design &amp; code: built with Claude<br>Engine: <b>three.js</b> · Multiplayer: <b>PeerJS / WebRTC</b><br>Audio: procedurally synthesised with the Web Audio API</p><p class="tip">Everything — island, weapons, music — is generated in code, so the game runs fully offline.</p></div>`;$('crBack').appendChild(this.back())}
 // ---------- settings
 buildSettings(){
  const p=$('settings');p.innerHTML=`<div class="pg"><div class="pg-head"><h2>Settings</h2><div id="stBack"></div></div><div class="st-body"><div class="tabs" id="stTabs"></div><div id="stBody"></div></div></div>`;$('stBack').appendChild(this.back());
  const tabs=['Graphics','Audio','Controls','Gameplay','Key Bindings'];this.stTab='Graphics';
  const tb=$('stTabs');for(const t of tabs){const b=h(`<button class="tab">${t}</button>`);b.onclick=()=>{this.stTab=t;this.sfx('ui');this.renderSettings()};tb.appendChild(b)}
  $('stBack').onclick=null;
 }
 enter_settings(){this.renderSettings()}
 renderSettings(){
  const S=this.settings,body=$('stBody');body.innerHTML='';for(const b of $('stTabs').children)b.classList.toggle('on',b.textContent===this.stTab);
  const set=()=>{this.saveSettings();this.applySettings()};
  const slider=(l,k,min,max,step,d,fmt=v=>v)=>{const r=h(`<div class="set"><label>${l}${d?`<span class="d">${d}</span>`:''}</label><div class="row"><input type="range" min="${min}" max="${max}" step="${step}" value="${S[k]}"><span class="val">${fmt(S[k])}</span></div></div>`);const i=r.querySelector('input'),v=r.querySelector('.val');i.oninput=()=>{S[k]=+i.value;v.textContent=fmt(S[k]);set()};body.appendChild(r)};
  const tog=(l,k,d)=>{const r=h(`<div class="set"><label>${l}${d?`<span class="d">${d}</span>`:''}</label><div class="tog ${S[k]?'on':''}"></div></div>`);const t=r.querySelector('.tog');t.onclick=()=>{S[k]=!S[k];t.classList.toggle('on',S[k]);set();this.sfx('click')};body.appendChild(r)};
  const sel=(l,k,opts,d,after)=>{const r=h(`<div class="set"><label>${l}${d?`<span class="d">${d}</span>`:''}</label><select>${opts.map(o=>`<option value="${Array.isArray(o)?o[0]:o}" ${String(S[k])===String(Array.isArray(o)?o[0]:o)?'selected':''}>${Array.isArray(o)?o[1]:o}</option>`).join('')}</select></div>`);const s=r.querySelector('select');s.onchange=()=>{S[k]=s.value;set()};body.appendChild(r)};
  if(this.stTab==='Graphics'){
   sel('Quality preset','quality',['Low','Medium','High'],'Affects render resolution, particles and fog distance');
   sel('Resolution','res',[['native','Native (window size)'],['1080','1080p'],['900','900p'],['720','720p'],['540','540p']],'Caps the render height – lower = faster');
   sel('Pixel effect','pix',['Off','Slight','Medium','Chunky'],'Retro chunky-pixel look for the world (characters stay sharp)');
   slider('Vibrancy','vib',80,180,5,'Colour saturation boost',v=>v+'%');
   slider('Brightness','bright',80,140,2,'Overall brightness',v=>v+'%');
   slider('Render scale','scale',50,100,5,'Percentage of the chosen resolution',v=>v+'%');
   const fs=h(`<div class="set"><label>Fullscreen<span class="d">Toggle fullscreen mode</span></label><button class="btn sm sec">${document.fullscreenElement?'Exit Fullscreen':'Go Fullscreen'}</button></div>`);fs.querySelector('button').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(()=>this.toast('Fullscreen blocked by browser'));setTimeout(()=>this.renderSettings(),300)};body.appendChild(fs);
   slider('Field of view','fov',60,120,1,'',v=>v+'°');
   sel('View distance','dist',['Near','Medium','Far'],'How far loot and fog render');
   sel('Particle effects','particles',['Low','Medium','High']);
   tog('Show FPS counter','fps','Also toggles with F3 in game');
  }
  if(this.stTab==='Audio'){slider('Master volume','master',0,100,1,'',v=>v);slider('Sound effects','sfx',0,100,1,'',v=>v);slider('Music','music',0,100,1,'',v=>v)}
  if(this.stTab==='Controls'){slider('Mouse sensitivity','sens',.2,3,.05,'Base look speed',v=>(+v).toFixed(2));slider('Camera sensitivity','camSens',.2,3,.05,'Look speed while not aiming',v=>(+v).toFixed(2));slider('Aim-down-sights sensitivity','adsSens',.2,2,.05,'Multiplier while zoomed',v=>(+v).toFixed(2));tog('Invert Y axis','invertY');tog('Toggle crouch','crouchToggle','Press once to crouch instead of holding');tog('Toggle aim','aimToggle');tog('Auto sprint','autoSprint','Sprint whenever you move forward')}
  if(this.stTab==='Gameplay'){sel('Crosshair colour','xcol',[['#ffffff','White'],['#4aff8a','Green'],['#4ad8ff','Cyan'],['#ffd84a','Yellow'],['#ff5a5a','Red'],['#ff7ab8','Pink']]);slider('Crosshair size','xsize',.6,2,.1,'',v=>(+v).toFixed(1));tog('Hit markers','hitmarkers');tog('Damage numbers','dmgNumbers');slider('Screen shake','shake',0,2,.1,'',v=>(+v).toFixed(1));slider('Head bob','bob',0,2,.1,'',v=>(+v).toFixed(1));tog('Rotate minimap with player','mapRotate')}
  if(this.stTab==='Key Bindings')this.renderBinds(body);
 }
 renderBinds(body){
  const I=this.input;const info=h(`<div class="tip" style="margin:0 0 10px">Click a key box, then press a key, mouse button or scroll wheel. Esc cancels. Right-click a box to unbind.</div>`);body.appendChild(info);
  const top=h(`<div class="row" style="margin-bottom:12px"><button class="btn sm red">Restore Defaults</button><span class="err" id="kbErr"></span></div>`);top.querySelector('button').onclick=()=>{I.defaults();this.renderSettings();this.toast('Key bindings restored to defaults')};body.appendChild(top);
  const grid=h(`<div class="kb"></div>`);
  for(const[a,label]of ACTIONS){
   const conf=I.binds[a]&&I.conflicts(a,I.binds[a]).length>0;
   const r=h(`<div class="kbr"><span>${label}</span><div class="key ${conf?'conf':''}">${keyLabel(I.binds[a])}</div></div>`);const k=r.querySelector('.key');
   k.oncontextmenu=e=>{e.preventDefault();I.binds[a]='';I.rebuild();I.saveBinds();this.renderSettings()};
   k.onclick=()=>{
    for(const x of grid.querySelectorAll('.key.listen'))x.classList.remove('listen');k.classList.add('listen');k.textContent='Press a key…';
    I.capture=(code,ev)=>{I.capture=null;if(code==='Escape'){this.renderSettings();return}
     if(code==='Mouse0'&&ev.target&&ev.target!==this.canvas&&ev.type==='mousedown'){}
     const cf=I.conflicts(a,code);
     if(cf.length){const names=cf.map(c=>ACTIONS.find(x=>x[0]===c)[1]).join(', ');
      $('kbErr').textContent=`⚠ ${keyLabel(code)} was used by "${names}" – swapped.`;
      const old=I.binds[a];for(const c of cf)I.binds[c]=old||'';}
     I.binds[a]=code;I.rebuild();I.saveBinds();const msg=$('kbErr')?$('kbErr').textContent:'';this.renderSettings();if(msg&&$('kbErr'))$('kbErr').textContent=msg}};
   grid.appendChild(r)}
  body.appendChild(grid);
 }
 // ---------- pause menu
 renderPause(view){
  const p=$('pause');
  if(view==='main'){p.innerHTML=`<h2 style="font-size:46px">Paused</h2><button class="btn" id="pResume">Resume</button><button class="btn sec" id="pSet">Settings</button><button class="btn red" id="pLeave">Leave Match</button><div class="tip">Press Esc to resume</div>`;
   $('pResume').onclick=()=>this.setPause(false);$('pSet').onclick=()=>this.pauseSettings();$('pLeave').onclick=()=>this.leaveMatch()}}
 pauseSettings(){
  // reuse settings page on top of the pause overlay
  $('pause').classList.remove('show');const s=$('settings');s.classList.add('show');this.renderSettings();
  const back=$('stBack').firstChild;this._backOrig=back.onclick;back.onclick=()=>{s.classList.remove('show');$('pause').classList.add('show');back.onclick=this._backOrig};
 }
 // ---------- starting matches
 makeCfg(role,net,seed,list,myId,diff){return{role,net,seed,diff,myId,ents:list}}
 startOffline(){
  this.audio.init();this.audio.resume();const n=this.profile.bots;const ents=[{id:0,name:this.profile.name,char:this.profile.char,cos:this.cos}];
  const roster=makeBotRoster(n);
  for(let i=0;i<n;i++)ents.push({id:i+1,name:roster[i].name,char:roster[i].char,bot:true,persona:roster[i].persona,cos:roster[i].cos});
  this.net=new LocalNet();this.beginGame(this.makeCfg('host',this.net,(Math.random()*1e9)|0,ents,0,this.profile.diff));
 }
 beginGame(cfg){
  for(const el of document.querySelectorAll('#ui>.screen'))el.classList.remove('show');$('nav').classList.remove('show');
  this.game.start(cfg);this.net=cfg.net;this.playing=true;this.paused=false;this.endCursor=false;$('bigmap').style.display='none';
  if(this.net)this.net.onMsg=(f,m)=>{
   if(m.t==='toLobby'){this.leaveMatch();return}
   if(m.t==='quit'){if(this.playing&&this.game.peerLeft)this.game.peerLeft(f);return}
   this.game.onNetMessage(f,m)};
  this.applySettings();this.lock()}
 leaveMatch(){
  const inParty=!!(this.lobby&&this.net&&this.net.peer);
  if(inParty&&!this.net.isHost&&this.playing&&!this.hud.finished)this.net.toHost({t:'quit'}); // mid-match quit: host hands our character to a bot
  this.playing=false;this.paused=false;this.endCursor=false;if(document.pointerLockElement)document.exitPointerLock();
  this.game.running=false;this.hud.hide();for(const id of ['elim','victory'])$(id).style.display='none';$('pause').classList.remove('show');$('bigmap').style.display='none';
  if(inParty){
   if(this.net.isHost)this.net.broadcast({t:'toLobby'});
   if(this.lobbyOnMsg)this.net.onMsg=this.lobbyOnMsg;
   this.lobbyActive=true;this.audio.mode='menu';this.go('lobby');this.lobbyUpdate();return}
  if(this.net&&this.net.close&&this.net.peer){this.net.close();this.net=null}
  this.go('title')}
 // ---------- online
 buildOnline(){
  const p=$('online');p.innerHTML=`<div class="pg"><div class="pg-head"><h2>Online Party</h2><div id="onBack"></div></div>
  <div class="on-name"><span class="sub">Display name</span><input type="text" id="onName" maxlength="14"></div>
  <div class="on-grid"><div class="pg-card"><div class="k">Host</div><h3>Create Party</h3><p>Start a private lobby, then share the room code with your friends.</p><button class="btn play sm" id="onHost">Create Party</button></div>
  <div class="pg-card"><div class="k">Join</div><h3>Join Party</h3><p>Got a room code from a friend? Enter it here.</p><div class="row"><input type="text" id="onCode" maxlength="5" placeholder="CODE" style="text-transform:uppercase;letter-spacing:6px;font-size:26px;width:200px;text-align:center"><button class="btn" id="onJoin">Join</button></div></div></div>
  <div class="err" id="onErr"></div><div class="tip">Players connect directly (peer-to-peer WebRTC) – works across different computers. Everyone needs internet access for the connection handshake; both players open this same game file or web page. If a connection fails, both of you may be behind strict firewalls – try another network.</div></div>`;

  $('onBack').appendChild(this.back());
  $('onHost').onclick=()=>this.hostLobby();$('onJoin').onclick=()=>this.joinLobby($('onCode').value);
  $('onCode').onkeydown=e=>{if(e.key==='Enter')this.joinLobby($('onCode').value)};
  const m=location.hash.match(/join=([A-Za-z0-9]{5})/);if(m){this.pendingJoin=m[1].toUpperCase()}
 }
 enter_online(){$('onName').value=this.profile.name;$('onErr').textContent='';if(this.pendingJoin){$('onCode').value=this.pendingJoin;this.pendingJoin=null}}
 saveOnName(){const v=$('onName').value.trim();if(v){this.profile.name=v;this.saveProfile()}}
 hostLobby(){
  this.saveOnName();$('onErr').textContent='Creating lobby…';const net=new Net();this.net=net;
  net.host((err,code)=>{if(err){$('onErr').textContent='Could not create lobby ('+err+'). Check your internet connection.';return}
   this.lobby={host:true,code,players:[{pid:'host',name:this.profile.name,char:this.profile.char,cos:this.cos}],bots:0,diff:'Normal'};this.lobbyActive=true;this.go('lobby')});
  net.onMsg=(pid,m)=>this.lobbyMsgHost(pid,m);this.lobbyOnMsg=net.onMsg;
  net.onLeave=pid=>{if(!this.lobby)return;this.lobby.players=this.lobby.players.filter(p=>p.pid!==pid);if(this.playing)this.game.peerLeft(pid);else this.lobbyUpdate()};
 }
 lobbyMsgHost(pid,m){
  if(this.playing){this.game.onNetMessage(pid,m);return}
  const L=this.lobby;if(!L)return;
  if(m.t==='hello'){if(L.players.length>=8){this.net.send(pid,{t:'full'});return}L.players.push({pid,name:(m.name||'Player').slice(0,14),char:m.char||'coolguy15',cos:m.cos||{}});this.lobbyUpdate();this.sfx('ui')}
  else if(m.t==='setchar'){const p=L.players.find(x=>x.pid===pid);if(p){p.char=m.char;this.lobbyUpdate()}}
 }
 joinLobby(code){
  this.saveOnName();code=(code||'').trim().toUpperCase();if(code.length<4){$('onErr').textContent='Enter the 5-letter room code';return}
  $('onErr').textContent='Connecting…';const net=new Net();this.net=net;
  net.join(code,err=>{if(err){$('onErr').textContent=err==='peer-unavailable'?'Room not found – check the code.':err==='timeout'?'Connection timed out.':'Could not connect ('+err+').';this.net=null;return}
   this.lobby={host:false,code,players:[],bots:0,diff:'Normal'};this.lobbyActive=true;net.toHost({t:'hello',name:this.profile.name,char:this.profile.char,cos:this.cos});this.go('lobby')});
  net.onMsg=(f,m)=>{
   if(this.playing){this.game.onNetMessage(f,m);return}
   if(m.t==='lobby'){this.lobby.players=m.players;this.lobby.bots=m.bots;this.lobby.diff=m.diff;this.lobby.myPid=m.you;this.lobbyUpdate()}
   else if(m.t==='start'){this.startOnlineClient(m)}
   else if(m.t==='full'){this.toast('Lobby is full');this.leaveLobby()}
   else if(m.t==='toLobby'){this.leaveMatch()}};
  this.lobbyOnMsg=net.onMsg;
  net.onClosed=()=>{this.toast('Disconnected from host');if(this.playing){this.playing=false;this.game.running=false;this.hud.hide();if(document.pointerLockElement)document.exitPointerLock();for(const id of ['elim','victory'])$(id).style.display='none'}this.leaveLobby(true)};
 }
 buildLobby(){
  const p=$('lobby');p.innerHTML=`<div class="pg"><div class="pg-head"><h2>Party Lobby</h2><div><button class="btn red sm" id="lbLeave">Leave</button></div></div>
  <div class="lb2"><div class="lb2-main"><div class="codebar"><div><div class="sub">Room code – share with friends</div><div class="code" id="lbCode">-----</div></div><div class="col"><button class="btn sm sec" id="lbCopy">Copy Code</button><button class="btn sm sec" id="lbInvite">Copy Invite Link</button></div></div>
  <div class="sub" style="margin:18px 0 8px">Party</div><div class="plist" id="lbPlayers"></div>
  <div class="sub" style="margin:18px 0 8px">Your outfit</div><div id="lbChars"></div></div>
  <div class="pg-card lb2-side"><div id="lbHostCtl"><div class="k">Match settings</div><div class="sub">Bots: <b id="lbBotN" style="color:var(--yl)">0</b></div><input type="range" id="lbBots" min="0" max="30" value="0" style="accent-color:var(--cy);width:100%"><div class="sub" style="margin-top:12px">Bot difficulty</div><div id="lbDiff"></div><button class="btn play" id="lbStart" style="margin-top:18px">Start</button></div><div id="lbWait" class="sub" style="display:none">Waiting for host to start…</div></div></div></div>`;

  $('lbLeave').onclick=()=>this.leaveLobby();
  $('lbCopy').onclick=()=>{this.copy(this.lobby.code);this.toast('Room code copied!')};
  $('lbInvite').onclick=()=>{const u=location.href.split('#')[0]+'#join='+this.lobby.code;this.copy(u);this.toast('Invite link copied!')};
  $('lbBots').oninput=e=>{this.lobby.bots=+e.target.value;$('lbBotN').textContent=e.target.value;this.lobbyUpdate(true)};
  const dd=$('lbDiff');for(const d of ['Easy','Normal','Hard']){const c=h(`<span class="chip">${d}</span>`);c.onclick=()=>{this.lobby.diff=d;this.lobbyUpdate()};dd.appendChild(c)}
  $('lbStart').onclick=()=>this.startOnlineHost();
 }
 copy(t){try{navigator.clipboard.writeText(t)}catch(e){const i=document.createElement('input');i.value=t;document.body.appendChild(i);i.select();document.execCommand('copy');i.remove()}}
 enter_lobby(){this.lobbyUpdate(false,true)}
 lobbyUpdate(noBroadcast,full){
  const L=this.lobby;if(!L||this.screen!=='lobby'&&!full&&this.screen!=='lobby')return;
  $('lbCode').textContent=L.code;$('lbHostCtl').style.display=L.host?'block':'none';$('lbWait').style.display=L.host?'none':'block';
  $('lbBots').value=L.bots;$('lbBotN').textContent=L.bots;this.refreshChips($('lbDiff'),L.diff);
  {const n=L.players.length+(L.bots?1:0);let html=L.players.map(p=>`<div class="pslot"><img src="${IMG[p.char]?IMG[p.char].front:''}" alt="">${p.pid==='host'?'<span class="badge">HOST</span>':''}<div class="pn" style="color:${p.cos&&p.cos.nameColor||'#fff'}">${p.name}</div></div>`).join('');
   if(L.bots)html+=`<div class="pslot bots"><span class="bi">&#129302;</span><div class="pn">${L.bots} bot${L.bots>1?'s':''} · ${L.diff}</div></div>`;
   for(let i=n;i<4;i++)html+=`<div class="pslot empty"><span class="bi">+</span><div class="pn">Open slot</div></div>`;$('lbPlayers').innerHTML=html}
  const box=$('lbChars');box.innerHTML='';box.appendChild(this.charPicker(()=>this.profile.char,id=>{this.profile.char=id;this.saveProfile();if(L.host){const me=L.players.find(x=>x.pid==='host');if(me)me.char=id;this.lobbyUpdate()}else this.net.toHost({t:'setchar',char:id})},true));
  if(L.host&&!noBroadcast||L.host&&noBroadcast){this.net.broadcast({t:'lobby',players:L.players,bots:L.bots,diff:L.diff})}
 }
 leaveLobby(silent){this.lobbyActive=false;if(this.net&&this.net.close){this.net.close()}this.net=null;this.lobby=null;this.go('title')}
 startOnlineHost(){
  const L=this.lobby;const ents=[];let id=0;const roster=makeBotRoster(L.bots);
  for(const p of L.players){ents.push({id:id,name:p.name,char:p.char,cos:p.cos,peer:p.pid==='host'?undefined:p.pid,hostMe:p.pid==='host'});p.eid=id;id++}
  for(let i=0;i<L.bots;i++){ents.push({id:id++,name:roster[i].name,char:roster[i].char,bot:true,persona:roster[i].persona,cos:roster[i].cos})}
  const seed=(Math.random()*1e9)|0;
  for(const p of L.players)if(p.pid!=='host')this.net.send(p.pid,{t:'start',seed,diff:L.diff,ents:ents.map(e=>({id:e.id,name:e.name,char:e.char,bot:e.bot,cos:e.cos})),you:p.eid});
  const me=L.players.find(p=>p.pid==='host');
  this.beginGame(this.makeCfg('host',this.net,seed,ents,me.eid,L.diff));
 }
 startOnlineClient(m){this.audio.init();this.beginGame(this.makeCfg('client',this.net,m.seed,m.ents,m.you,m.diff))}
 // ---------- loop
 loop(now){
  requestAnimationFrame(t=>this.loop(t));
  let dt=(now-this.last)/1000;this.last=now;dt=Math.min(dt,.1);
  const g=this.game;
  try{
   if(this.playing&&g.running){
    // abilities & pause when menus
    const act=!this.paused;
    if(act){g.update(dt)}else g.fx.update(dt);
    g.render(dt);
    this.hud.update(g,dt);
   }else{g.renderMenu(dt)}
  }catch(e){console.error(e);window.__err=(window.__err||'')+e.stack+'\n'}
  this.input.endFrame();
 }
}
window.__W=W;window.app=new App();
