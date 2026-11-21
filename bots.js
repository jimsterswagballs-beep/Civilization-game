import * as THREE from 'three';
import {WEAPONS,ITEMS,RARITY,AMMO,BAL,clamp,lerp} from './data.js';
import * as W from './world.js';
import * as NAV from './botnav.js';
import {R,HSTAND,HCROUCH,wstat,angDiff,lerpAng} from './shared.js';
import {itemName} from './loot.js';
import {PERSONA_WEIGHTS} from './botnames.js';
import {REVIVE_RANGE} from './knock.js';

// ---------------------------------------------------------------------------------------------
// Difficulty: reaction/aim/turn speed plus perception (vis = sight range, fov = field of view in degrees,
// hear = how far footsteps carry).
const DIFF={
 Easy:{err:.065,react:.9,turn:3.6,vis:55,ab:.25,spd:.88,fov:110,hear:11},
 Normal:{err:.03,react:.45,turn:7,vis:75,ab:.55,spd:.96,fov:130,hear:16},
 Hard:{err:.011,react:.18,turn:13,vis:100,ab:.9,spd:1.02,fov:150,hear:22}};
// ---------------------------------------------------------------------------------------------
// Personalities. aggr = appetite for fights, caution = caution when hurt / outgunned, greed = loot appetite,
// range = preferred fighting range multiplier, camp = tendency to hold a position, fleeHp/hideHp = health
// fractions that trigger disengaging / hiding to heal, chase = seconds spent hunting a lost target.
const PERSONAS={
 balanced:   {label:'Balanced',   aggr:.55,caution:.5, greed:1,  range:1,   camp:.15,fleeHp:.3, hideHp:.4, chase:5,  hear:1,  strafe:1,  ab:1,  aim:1,   hot:.3},
 rusher:     {label:'Rusher',     aggr:.95,caution:.15,greed:.6, range:.65, camp:0,  fleeHp:.14,hideHp:.22,chase:10, hear:1.4,strafe:1.2,ab:1.3,aim:1.05,hot:1},
 camper:     {label:'Camper',     aggr:.3, caution:.75,greed:.9, range:1.25,camp:.95,fleeHp:.45,hideHp:.55,chase:2.5,hear:1.3,strafe:.5, ab:.8, aim:.9, hot:0},
 sniper:     {label:'Sniper',     aggr:.4, caution:.6, greed:.9, range:1.8, camp:.7, fleeHp:.4, hideHp:.5, chase:3,  hear:1.2,strafe:.4, ab:.8, aim:.75,hot:.1},
 looter:     {label:'Looter',     aggr:.35,caution:.6, greed:1.6,range:1,   camp:.2, fleeHp:.4, hideHp:.5, chase:3,  hear:1,  strafe:1,  ab:1,  aim:1,   hot:.2},
 survivor:   {label:'Survivor',   aggr:.2, caution:1,  greed:1,  range:1.15,camp:.45,fleeHp:.6, hideHp:.68,chase:1.5,hear:1.5,strafe:1.1,ab:1,  aim:1,   hot:0},
 opportunist:{label:'Opportunist',aggr:.65,caution:.45,greed:.9, range:1,   camp:.25,fleeHp:.3, hideHp:.4, chase:7,  hear:1.7,strafe:1,  ab:1.1,aim:1,   hot:.4},
 trickster:  {label:'Trickster',  aggr:.6, caution:.3, greed:.9, range:.9,  camp:0,  fleeHp:.25,hideHp:.35,chase:5,  hear:1,  strafe:1.5,ab:1.4,aim:1.25,hot:.5}};
// Quirks layer on top so two bots with the same personality still play differently.
const QUIRKS={medic:3,paranoid:3,jumpy:3,twitchy:3,hoarder:2,wild:2,bold:2,patient:2};
const DROP_W={ // POI type weights for choosing where to land
 rusher:{city:3,fort:2.5,base:2,warehouse:2,town:1,suburb:1,cabins:.4},
 looter:{suburb:2,town:2,city:1.5,warehouse:1.5,cabins:1,base:1,fort:1},
 camper:{cabins:3,base:2,suburb:1,town:1,fort:1,city:.3,warehouse:.8},
 sniper:{cabins:2,base:3,fort:1.5,suburb:1,town:1,city:.4,warehouse:1},
 survivor:{cabins:3,suburb:1.5,town:1,base:1,fort:.6,city:.2,warehouse:.6}};
const rr=(a,b)=>a+Math.random()*(b-a);
const jit=(v,k=.15)=>v*(1+(Math.random()*2-1)*k);
function pickKey(obj){let t=0;for(const k in obj)t+=obj[k];let r=Math.random()*t;for(const k in obj){r-=obj[k];if(r<=0)return k}return Object.keys(obj)[0]}
const d2=(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz);

export const botMethods={
 initBot(e,info){
  const key=info&&info.persona&&PERSONAS[info.persona]?info.persona:pickKey(PERSONA_WEIGHTS);
  const base=PERSONAS[key];const p=Object.assign({key},base);
  for(const k of['aggr','caution','greed','range','camp','fleeHp','hideHp','chase','hear','strafe','ab','aim'])p[k]=jit(base[k],.15);
  p.aggr=clamp(p.aggr,.05,1);p.caution=clamp(p.caution,0,1);p.camp=clamp(p.camp,0,1);
  const quirks=new Set();const nq=Math.random()<.35?0:Math.random()<.6?1:2;for(let i=0;i<nq;i++)quirks.add(pickKey(QUIRKS));p.quirks=quirks;
  if(quirks.has('medic')){p.hideHp+=.1;p.fleeHp+=.05}
  if(quirks.has('bold')){p.aggr=clamp(p.aggr+.2,0,1);p.fleeHp=Math.max(.1,p.fleeHp-.1)}
  if(quirks.has('patient')){p.camp=clamp(p.camp+.25,0,1)}
  if(quirks.has('hoarder'))p.greed*=1.3;
  p.twitchy=quirks.has('twitchy')?.6:1;p.paranoid=quirks.has('paranoid');p.jumpy=quirks.has('jumpy')||key==='trickster';
  e.ai={p,state:'drop',mode:'loot',modeT:0,lockT:0,think:Math.random()*.3,enemy:null,seen:0,react:0,fight:false,lootT:null,lootFail:new Map(),
   goal:null,path:null,pathT:0,pathFail:0,lineT:0,direct:false,noPath:0,
   stuck:0,stuckT:0,lastX:0,lastZ:0,sideT:0,side:1,strafeT:0,strafe:1,yawT:e.yaw,crouchT:0,slideCd:0,jumpT:0,dropAt:0,dropTgt:null,
   healing:false,lastSeenPos:null,lastSeenT:-99,hitT:-99,hitN:0,noise:null,glance:null,scanBase:e.yaw,scanT:0,hold:null,campCd:rr(5,25),hideT0:0,
   lootedN:0,roam:null,fAppT:0,fBlocked:false,firedLast:false,searchT:0,unstickUntil:0,swimTo:null,cornered:false,retreatFire:p.aggr>.45};
  const cfg=this.botCfg();e.botSpeed=cfg.spd;
  // pick where to land based on personality
  let tgt=null;const dw=DROP_W[key];
  if(p.quirks.has('wild')||Math.random()<.08){const a=Math.random()*6.283,r=Math.sqrt(Math.random())*W.ISL*.8;tgt={x:Math.cos(a)*r,z:Math.sin(a)*r}}
  else{let tot=0;const ws=W.POIS.map(po=>{const w=dw?(dw[po.type]||1):1;tot+=w;return w});let r=Math.random()*tot,pi=0;for(let i=0;i<ws.length;i++){r-=ws[i];if(r<=0){pi=i;break}}
   const po=W.POIS[pi],a=Math.random()*6.283,rad=Math.random()*po.r*.6;tgt={x:po.x+Math.cos(a)*rad,z:po.z+Math.sin(a)*rad}}
  e.ai.dropTgt=tgt;e.ai.dropAt=Math.random()*.4+.05;
  e.persona=key},
 botCfg(){return DIFF[this.diff]||DIFF.Normal},
 inZoneAt(x,z,m=0){const s=this.storm;if(Math.hypot(x-s.cx,z-s.cz)>s.r-m)return false;const nz=this.nextZone();if(nz&&Math.hypot(x-nz.x,z-nz.z)>nz.r-m)return false;return true},
 onBotHit(t,by){const ai=t.ai;if(!ai||!by||by===t||!by.alive||this.isAlly(t,by))return;
  ai.hitN=(this.t-ai.hitT<4?ai.hitN:0)+1;ai.hitT=this.t;ai.lastSeenPos={x:by.pos.x,z:by.pos.z,t:this.t};ai.lastSeenT=this.t;
  if(!ai.enemy||Math.random()<.5){ai.enemy=by;ai.react=Math.min(ai.react||0,.25);ai.seen=0}
  ai.glance={x:by.pos.x,z:by.pos.z,t:this.t}},
 // sound: gunfire and explosions are heard by nearby bots, who may investigate or take cover
 botHear(ev){
  if(ev.k==='sh'){const s=this.ents.get(ev.i);if(s)s.lastShotAt=this.t;const wd=ev.w>=0?WEAPONS[ev.w]:null;const loud=wd&&wd.quiet?22:wd&&wd.melee?10:95;const o=ev.o;
   for(const b of this.list){if(!b.bot||!b.alive||b.id===ev.i||b.drop)continue;const d=Math.hypot(b.pos.x-o[0],b.pos.z-o[2]);if(d>loud*b.ai.p.hear)continue;
    const n=b.ai.noise;if(!n||this.t-n.t>2||d<n.d)b.ai.noise={x:o[0]+rr(-5,5),z:o[2]+rr(-5,5),t:this.t,d,src:ev.i};b.ai.glance={x:o[0],z:o[2],t:this.t}}}
  else if(ev.k==='ex'){for(const b of this.list){if(!b.bot||!b.alive||b.drop)continue;const d=Math.hypot(b.pos.x-ev.x,b.pos.z-ev.z);if(d<130*b.ai.p.hear){b.ai.noise={x:ev.x+rr(-6,6),z:ev.z+rr(-6,6),t:this.t,d,src:-1};b.ai.glance={x:ev.x,z:ev.z,t:this.t}}}}},
 updateBots(dt){
  NAV.navTime(this.t);this.navMs=0;
  for(const e of this.list){if(!e.bot||!e.alive||e.knocked)continue;this.botTick(e,dt)}
  this.updateLootHost(dt);
 },
 // ------------------------------------------------------------------ helpers
 weaponScore(s){if(!s||s.k!=='w'||s.w===0)return 0;const wd=wstat(s.w,s.r);return wd.dmg*wd.pellets*Math.min(wd.rps,6)*(1+s.r*.08)},
 powerOf(t){let b=0;for(const s of t.inv)b=Math.max(b,this.weaponScore(s));return(b+30)*(t.hp+t.sh*.8)/100},
 hasUsableGun(e){return e.inv.some(s=>s&&s.k==='w'&&s.w>0&&(s.mag>0||e.ammo[WEAPONS[s.w].ammo]>0))},
 setGoal(e,x,z,tol,why){const ai=e.ai,g=ai.goal;if(g&&g.why===why&&Math.hypot(g.x-x,g.z-z)<2.5){g.tol=tol;return}ai.goal={x,z,tol,why};ai.path=null;ai.pathT=0;ai.pathFail=0;ai.direct=false;ai.lineT=0;ai.noPath=0},
 clearGoal(e){const ai=e.ai;ai.goal=null;ai.path=null;ai.direct=false},
 setMode(e,m,lock=0){const ai=e.ai;if(ai.mode!==m){ai.mode=m;ai.modeT=0;if(m!=='fight')ai.fBlocked=false}ai.lockT=Math.max(ai.lockT,this.t+lock)},
 // A* planning with a per-frame time budget so 40 bots never hitch the frame
 botPlan(e){
  const ai=e.ai,g=ai.goal;if(!g)return;
  if(this.navMs>3){ai.pathT=.04;return}
  const t0=performance.now();const pts=NAV.findPath(e.pos.x,e.pos.z,g.x,g.z,4500);this.navMs+=performance.now()-t0;
  const info=NAV.lastInfo();
  if(!pts||!pts.length){ai.pathFail++;ai.path=null;ai.pathT=.5;return}
  ai.pathFail=0;ai.path={pts,i:0,partial:info.partial,skipT:0,needNew:false}},
 // steer along the planned path; returns {wx,wz,lx,lz,d,arrived,fail}
 botFollow(e,dt){
  const ai=e.ai,g=ai.goal,P=e.pos;if(!g)return null;
  const dx=g.x-P.x,dz=g.z-P.z,d=Math.hypot(dx,dz);
  if(d<g.tol)return{arrived:true,d,wx:0,wz:0};
  ai.lineT-=dt;if(ai.lineT<=0){ai.lineT=.3;ai.direct=d<26&&NAV.lineClear(P.x,P.z,g.x,g.z,.4)}
  if(ai.direct){return{wx:dx/d,wz:dz/d,lx:g.x,lz:g.z,d}}
  ai.pathT-=dt;
  if((!ai.path||ai.path.needNew)&&ai.pathT<=0)this.botPlan(e);
  const p=ai.path;
  if(!p){ai.noPath+=dt;if(ai.pathFail>=3||ai.noPath>6)return{arrived:true,fail:true,d,wx:0,wz:0};return{wx:dx/d,wz:dz/d,lx:g.x,lz:g.z,d,fallback:true}}
  const pts=p.pts;let i=p.i;
  p.skipT-=dt;if(p.skipT<=0){p.skipT=.25;for(let k=Math.min(i+8,pts.length-1);k>i;k--){if(NAV.lineClear(P.x,P.z,pts[k][0],pts[k][1],.4)){i=k;break}}}
  while(i<pts.length-1&&Math.hypot(pts[i][0]-P.x,pts[i][1]-P.z)<1.05)i++;
  p.i=i;const w=pts[i];const wd=Math.hypot(w[0]-P.x,w[1]-P.z)||1;
  if(i===pts.length-1&&wd<1.3){ // reached the end of the path
   if(p.partial){p.needNew=true;ai.pathT=0}
   else if(d<g.tol+3)return{arrived:true,d,wx:0,wz:0};
   else return{arrived:true,fail:true,d,wx:0,wz:0}}
  return{wx:(w[0]-P.x)/wd,wz:(w[1]-P.z)/wd,lx:w[0],lz:w[1],d}},
 // Candidate-sampling: a nearby walkable spot out of the threat's line of sight
 findCover(e,tx,tz,ty,maxR=26){
  const P=e.pos;let best=null,bs=1e9;const tl=Math.hypot(tx-P.x,tz-P.z)||1;
  for(let k=0;k<22;k++){
   const a=k/22*6.283+Math.random()*.3,r=5+Math.random()*(maxR-5);
   const x=P.x+Math.cos(a)*r,z=P.z+Math.sin(a)*r;
   if(!NAV.walkable(x,z)||!this.inZoneAt(x,z,4))continue;
   const gy=NAV.groundOfCell(x,z);
   if(W.losClear(tx,ty,tz,x,gy+1.0,z)||W.losClear(tx,ty,tz,x,gy+1.65,z))continue;
   const dT=Math.hypot(x-tx,z-tz);let sc=r-Math.min(dT,40)*.12;
   if(this.bldAt(x,z))sc-=4;
   const toward=((x-P.x)*(tx-P.x)+(z-P.z)*(tz-P.z))/(r*tl);if(toward>.35)sc+=r*toward*1.2; // don't run at the enemy
   if(sc<bs){bs=sc;best=[x,z]}}
  return best},
 // a spot inside the nearest building, away from the door line, to hide in while healing
 hideInBuilding(e){
  const P=e.pos;let best=null,bd=1e9;
  for(const b of W.buildings){const d=Math.hypot(b.x-P.x,b.z-P.z);if(d>55||d>=bd)continue;
   for(let k=0;k<6;k++){const x=b.x+rr(-b.w/2+1.5,b.w/2-1.5),z=b.z+rr(-b.d/2+1.5,b.d/2-1.5);if(NAV.walkable(x,z)&&this.inZoneAt(x,z,5)){bd=d;best=[x,z];break}}}
  return best},
 // choose a position to camp: snipers want height + open sightlines, campers want concealment
 findHoldSpot(e,high){
  const P=e.pos,nz=this.nextZone()||{x:this.storm.cx,z:this.storm.cz,r:this.storm.r};let best=null,bs=-1e9;
  for(let k=0;k<18;k++){
   const a=Math.random()*6.283,r=8+Math.random()*34;const x=P.x+Math.cos(a)*r,z=P.z+Math.sin(a)*r;
   if(!NAV.walkable(x,z)||!this.inZoneAt(x,z,18))continue;
   const gy=NAV.groundOfCell(x,z);let open=0;for(let q=0;q<8;q++){const aa=q*.785,ex=x+Math.cos(aa)*38,ez=z+Math.sin(aa)*38;if(W.losClear(x,gy+1.5,z,ex,W.H(ex,ez)+1.5,ez))open++}
   let sc;
   if(high)sc=gy*1.6+open*2.2-r*.15;
   else{sc=(8-open)*1.8-r*.12+(this.bldAt(x,z)?6:0)}
   sc-=Math.hypot(x-nz.x,z-nz.z)*.03;
   if(sc>bs){bs=sc;best=[x,z]}}
  return best},
 // nearest land when stranded in water
 landTarget(e){const P=e.pos;for(let r=8;r<=110;r+=8)for(let k=0;k<14;k++){const a=k/14*6.283,x=P.x+Math.cos(a)*r,z=P.z+Math.sin(a)*r;if(W.H(x,z)>.5&&NAV.walkable(x,z))return{x,z}}return null},
 botUnstick(e){
  const ai=e.ai,P=e.pos;ai.stuck++;
  const embedded=W.blocked(P.x,P.y,P.z,R*.85,HCROUCH,.65);
  if(embedded||ai.stuck>=5){
   const np=NAV.nearestWalkable(P.x,P.z,6);
   if(np){P.x=np[0];P.z=np[1];P.y=NAV.groundOfCell(np[0],np[1])+.05;e.vel.set(0,0,0)}
   if(ai.lootT){ai.lootFail.set(ai.lootT.id,this.t);ai.lootT=null}
   this.clearGoal(e);ai.stuck=0;ai.think=0;return}
  if(ai.stuck===1){ai.sideT=.8;ai.side=Math.random()<.5?-1:1;ai.forceJump=true}
  else if(ai.stuck===2){ // the planned route is blocked in reality: ban the cells we are pushing into and re-plan
   const w=ai.lastWish||{x:0,z:0};NAV.markBad(P.x+w.x*1.0,P.z+w.z*1.0,15);NAV.markBad(P.x+w.x*1.8,P.z+w.z*1.8,15);
   if(ai.path){const wp=ai.path.pts[ai.path.i];if(wp)NAV.markBad(wp[0],wp[1],15)}
   ai.path=null;ai.pathT=0;ai.sideT=.6;ai.side*=-1;ai.forceJump=true}
  else if(ai.stuck===3){const a=Math.random()*6.283,r=rr(7,14);const x=P.x+Math.cos(a)*r,z=P.z+Math.sin(a)*r;if(NAV.walkable(x,z)){this.setGoal(e,x,z,1.5,'unstick');ai.unstickUntil=this.t+4}}
  else{if(ai.lootT){ai.lootFail.set(ai.lootT.id,this.t);ai.lootT=null}this.clearGoal(e);ai.forceJump=true;ai.think=0}},
 // ------------------------------------------------------------------ per-frame body
 botTick(e,dt){
  const ai=e.ai,cfg=this.botCfg(),pe=ai.p,P=e.pos,t=this.t;
  const inp={f:0,s:0,jump:false,jumpP:false,sprint:false,crouch:false,crouchP:false};
  const c={fire:false,firePressed:false,reload:false,aim:false,cancel:false,aimErr:cfg.err*pe.aim};
  if(e.drop==='bus'){
   const d=Math.hypot(this.bus.pos.x-ai.dropTgt.x,this.bus.pos.z-ai.dropTgt.z);
   const passed=this.bus.t*this.bus.speed>60;
   if(passed&&(d<ai.dropAt*220+60||this.bus.t*this.bus.speed>this.bus.len-30)){this.leaveBus(e);e.vel.x*=.4;e.vel.z*=.4}
   e.pos.copy(this.bus.pos);e.flags=this.packFlags(e);return}
  if(e.drop){
   const dx=ai.dropTgt.x-e.pos.x,dz=ai.dropTgt.z-e.pos.z;e.yaw=Math.atan2(-dx,-dz);e.pitch=-.9;inp.f=1;
   this.move(e,inp,dt);e.flags=this.packFlags(e);e.wi=-1;if(!e.drop){ai.state='loot';ai.think=0;ai.lastX=P.x;ai.lastZ=P.z}return}
  ai.think-=dt;ai.slideCd-=dt;ai.strafeT-=dt;ai.jumpT-=dt;ai.modeT+=dt;
  if(ai.think<=0){ai.think=rr(.15,.25);this.botThink(e,cfg);this.botSupport(e)}
  const mode=ai.mode;
  const en=ai.fight&&ai.enemy&&ai.enemy.alive&&ai.seen>0?ai.enemy:null;
  // revive: hold interact while within reach of the knocked teammate (tickKnock reads holdI on the host)
  const rk=mode==='revive'?ai.kmate:null;
  e.holdI=!!(rk&&rk.knocked&&rk.alive&&!en&&d2(P.x,P.z,rk.pos.x,rk.pos.z)<REVIVE_RANGE-.4&&Math.abs(P.y-rk.pos.y)<2.5);
  const nz=this.nextZone()||{x:this.storm.cx,z:this.storm.cz,r:this.storm.r};
  const outside=!this.inZoneAt(P.x,P.z,6);
  const hh=(e.crouch||e.sliding)?HCROUCH:HSTAND;
  let wishX=0,wishZ=0,sprint=false,look=null,crouch=false,standing=false,shootAt=null;
  // ---- movement intent by mode
  if(e.swim){ // stranded in water: swim to the nearest shore
   if(!ai.swimTo||t-ai.swimT>6){ai.swimTo=this.landTarget(e);ai.swimT=t}
   if(ai.swimTo){const dx=ai.swimTo.x-P.x,dz=ai.swimTo.z-P.z,d=Math.hypot(dx,dz)||1;wishX=dx/d;wishZ=dz/d;sprint=true;look={x:ai.swimTo.x,y:P.y+1.6,z:ai.swimTo.z,d,nav:true}}}
  else if(ai.healing){standing=true;crouch=mode==='hide'||mode==='camp'}
  else if(mode==='fight'&&en){
   const ex=en.pos.x,ez=en.pos.z,ey=en.pos.y+1.25;const dx=ex-P.x,dz=ez-P.z,d=Math.hypot(dx,dz)||1,fx=dx/d,fz=dz/d;
   look={x:ex,y:ey-(en.crouch?.4:0)-(d>40?.15:.35),z:ez,d};shootAt=en;
   const wd=this.curWeapon(e);const base=wd?(wd.t==='sg'?7:wd.t==='sn'?55:wd.t==='smg'?16:wd.t==='ex'?28:wd.melee?2:25):3;const ideal=base*pe.range;
   ai.react-=dt;
   if(ai.strafeT<=0){ai.strafeT=rr(.5,1.6)/pe.strafe;ai.strafe=Math.random()<.5?-1:1}
   let mv=d>ideal+4?1:d<ideal-5?-.8:0;
   if(pe.camp>.6&&!(t-ai.hitT<3)&&d<ideal*1.7&&d>ideal*.6)mv=0;           // campers hold their ground
   if(wd&&wd.melee)mv=d>1.8?1:0;
   const sa=.9*pe.strafe*(wd&&wd.t==='sn'&&d>30?.15:1)*(wd&&wd.melee?.3:1);
   wishX=fx*mv+(-fz)*ai.strafe*sa;wishZ=fz*mv+fx*ai.strafe*sa;sprint=d>ideal+14&&!outside;
   // if a wall/prop is between us and the target path around it instead of walking into it
   ai.fAppT-=dt;if(ai.fAppT<=0){ai.fAppT=.4;const L=Math.min(d,8);ai.fBlocked=mv>0&&!NAV.lineClear(P.x,P.z,P.x+fx*L,P.z+fz*L,.38)}
   if(ai.fBlocked&&mv>0){this.setGoal(e,ex,ez,Math.max(3,ideal*.6),'engage');const n=this.botFollow(e,dt);if(n&&n.wx!==undefined&&!n.arrived){wishX=n.wx;wishZ=n.wz;sprint=true}}
   // probe a strafe step; flip direction if it would walk into geometry
   {const wl0=Math.hypot(wishX,wishZ)||1;const px=P.x+wishX/wl0*1.1,pz=P.z+wishZ/wl0*1.1;if(!ai.fBlocked&&W.blocked(px,P.y,pz,R,hh,.65)){ai.strafe=-ai.strafe;ai.strafeT=rr(.4,1);if(mv<=0){wishX=wishZ=0}}}
   if(outside){wishX+=(nz.x-P.x)*.01;wishZ+=(nz.z-P.z)*.01}
   if(Math.random()<dt*(pe.jumpy?1.4:.5)&&e.grounded)inp.jump=true;
   if(ai.slideCd<=0&&e.sprinting&&Math.random()<dt*.6){inp.crouchP=true;inp.crouch=true;ai.slideCd=4}
   if(wd&&wd.t==='sn'&&d>30)ai.crouchT=.5;
   if(pe.camp>.6&&d>20&&mv===0)ai.crouchT=.4;
  }
  else{
   const g=ai.goal;let nav=g?this.botFollow(e,dt):null;
   const wd=this.curWeapon(e);
   if(nav&&nav.fail){ // goal unreachable -> remember and re-think
    if(mode==='loot'&&ai.lootT){ai.lootFail.set(ai.lootT.id,t);ai.lootT=null}
    this.clearGoal(e);ai.think=0;nav=null}
   if(nav&&!nav.arrived&&nav.wx!==undefined){
    wishX=nav.wx;wishZ=nav.wz;
    const nearEnd=nav.d<8;
    if(mode==='flee'){sprint=true;if(ai.fleeWhy==='avoid'&&nav.d<10)sprint=false}
    else if(mode==='hide'){sprint=nav.d>10;crouch=nav.d<5}
    else if(mode==='camp'){sprint=nav.d>14&&!(outside)&&pe.caution<.7;crouch=nav.d<4}
    else if(mode==='loot'){sprint=nav.d>8}
    else if(mode==='investigate'){sprint=false;crouch=false}
    else sprint=!(pe.caution>.7&&!outside&&mode==='roam'&&Math.random()<.5)||outside;
    look={x:nav.lx,y:P.y+1.6,z:nav.lz,d:nav.d,nav:true};
    // covering fire while retreating
    if(mode==='flee'&&ai.retreatFire&&ai.enemy&&ai.enemy.alive&&ai.seen>0&&ai.fight2){look={x:ai.enemy.pos.x,y:ai.enemy.pos.y+.9,z:ai.enemy.pos.z,d:d2(P.x,P.z,ai.enemy.pos.x,ai.enemy.pos.z)};shootAt=ai.enemy}
   }else{
    // arrived / no goal: mode-specific standing behaviour
    standing=true;
    if(nav&&nav.arrived){
     if(mode==='loot'&&ai.lootT){const l=ai.lootT;if(this.loot.has(l.id)){if(d2(l.x,l.z,P.x,P.z)<3.2&&Math.abs(l.y-P.y)<3.5){this.hostPick(e,l);ai.lootedN++}}ai.lootT=null;this.clearGoal(e);ai.think=.03}
     else if(mode==='camp'||mode==='hide'){this.clearGoal(e);ai.holdAt=t}
     else if(mode==='chase'||mode==='investigate'){this.clearGoal(e);ai.searchT=t+rr(2,4)}
     else this.clearGoal(e)}
    if(mode==='camp'||mode==='hide'){crouch=true}
    if(mode==='chase'||mode==='investigate')crouch=false;
    // keep rotating the head: scan for threats
    ai.scanT-=dt;if(ai.scanT<=0){ai.scanT=rr(1.2,2.8)/(pe.paranoid?1.6:1);const r=Math.random();ai.scanBase=r<.25?e.yaw+Math.PI:e.yaw+rr(-1.6,1.6)}
    look={x:P.x-Math.sin(ai.scanBase)*20,y:P.y+1.6,z:P.z-Math.cos(ai.scanBase)*20,d:20,nav:true};
    // loot pickup if we happen to stand on one
   }
   // opportunistic pickup while passing close
   if(mode==='loot'&&ai.lootT&&this.loot.has(ai.lootT.id)){const l=ai.lootT;if(d2(l.x,l.z,P.x,P.z)<2.3&&Math.abs(l.y-P.y)<3){this.hostPick(e,l);ai.lootedN++;ai.lootT=null;this.clearGoal(e);ai.think=.03}}
  }
  // glance toward recent noise / unseen shooter while otherwise unoccupied
  if(look&&look.nav&&ai.glance&&t-ai.glance.t<1.4&&!en){look={x:ai.glance.x,y:P.y+1.5,z:ai.glance.z,d:20,nav:true}}
  // ---- obstacle avoidance + stuck detection (only when actually trying to travel)
  let wl=Math.hypot(wishX,wishZ);
  if(wl>.01){wishX/=wl;wishZ/=wl;ai.lastWish={x:wishX,z:wishZ};
   const px=P.x+wishX*1.2,pz=P.z+wishZ*1.2;
   if(W.blocked(px,P.y,pz,R,hh,.65)){
    if(!W.blocked(px,P.y+1.15,pz,R,hh,.65)&&e.grounded)inp.jump=true; // low obstacle: hop over it
    else if(ai.sideT<=0){ai.sideT=rr(.4,.9);ai.side=Math.random()<.5?-1:1}}
   if(W.H(px,pz)<-.3&&W.H(P.x,P.z)>-.3){wishX=-wishX;wishZ=-wishZ;ai.sideT=.5}
   if(ai.sideT>0){ai.sideT-=dt;const ox=-wishZ*ai.side,oz=wishX*ai.side;wishX=ox*.85+wishX*.35;wishZ=oz*.85+wishZ*.35}
   // separation from other bodies so bots don't pile up in doorways
   for(const o of this.list){if(o===e||!o.alive||o.drop)continue;const ax=P.x-o.pos.x,az=P.z-o.pos.z;if(Math.abs(ax)>1.3||Math.abs(az)>1.3)continue;const dd=Math.hypot(ax,az);if(dd<1.2&&dd>.01){wishX+=ax/dd*.5*(1.2-dd);wishZ+=az/dd*.5*(1.2-dd)}}
   if(ai.forceJump){inp.jump=true;ai.forceJump=false}
   ai.stuckT+=dt;
   if(ai.stuckT>=.8){const mv=Math.hypot(P.x-ai.lastX,P.z-ai.lastZ);ai.stuckT=0;ai.lastX=P.x;ai.lastZ=P.z;
    const travelling=mode!=='fight'||ai.fBlocked;
    if(travelling&&mv<.7&&!e.use&&e.stun<=0&&!e.sliding)this.botUnstick(e);else if(mv>2.4)ai.stuck=Math.max(0,ai.stuck-1)}
  }else{ai.stuckT=0;ai.lastX=P.x;ai.lastZ=P.z}
  // embedded in geometry (e.g. after knockback)? pop out to the nearest open cell
  ai.embT=(ai.embT||0)+dt;if(ai.embT>1.2){ai.embT=0;if(W.blocked(P.x,P.y,P.z,R*.8,HCROUCH,.65)){const np=NAV.nearestWalkable(P.x,P.z,6);if(np){P.x=np[0];P.z=np[1];P.y=NAV.groundOfCell(np[0],np[1])+.05;e.vel.set(0,0,0)}}}
  // downhill slide
  if(sprint&&e.sprinting&&ai.slideCd<=0){const[gx,gz]=W.slope(P.x,P.z);if(-(gx*e.vel.x+gz*e.vel.z)>3.2){inp.crouchP=true;ai.slideCd=3}}
  if(crouch&&!e.sliding)inp.crouch=true;
  if(e.sliding||ai.crouchT>0){inp.crouch=e.sliding?(Math.hypot(e.vel.x,e.vel.z)>4):true;ai.crouchT-=dt}
  if(pe.jumpy&&mode!=='fight'&&e.grounded&&sprint&&Math.random()<dt*.25)inp.jump=true;
  // ---- look
  let ty=e.yaw,tp=0;
  if(look){const dx=look.x-P.x,dz=look.z-P.z;ty=Math.atan2(-dx,-dz);const eye=this.eyeOf(e);tp=Math.atan2(look.y-eye,Math.hypot(dx,dz));if(look.nav)tp=clamp(tp,-.2,.2)}
  else if(wl>.01)ty=Math.atan2(-wishX,-wishZ);
  const turn=cfg.turn*(look&&!look.nav?1.3:.8);const dy=angDiff(e.yaw,ty);
  e.yaw+=clamp(dy,-turn*dt,turn*dt);e.pitch+=clamp(tp-e.pitch,-turn*dt,turn*dt);
  // ---- convert wish to inputs
  const cy=Math.cos(e.yaw),sy=Math.sin(e.yaw);
  inp.f=-(wishX*sy+wishZ*cy);inp.s=wishX*cy-wishZ*sy;if(wl<.01){inp.f=0;inp.s=0}
  inp.sprint=sprint&&!ai.healing;
  // ---- combat / maintenance
  if(shootAt&&ai.seen>0&&look&&!look.nav){
   const wd=this.curWeapon(e);const slot=e.inv[e.cur];const ang=Math.abs(angDiff(e.yaw,ty));
   if(wd){
    const ready=ai.react<=0||mode==='flee';
    if(ready&&ang<(.05+.9/(look.d+4)*.4)&&look.d<wd.range*.9&&e.fireCd<=0&&e.reload<=0){c.fire=true;c.firePressed=!ai.firedLast;ai.firedLast=c.firePressed&&!wd.auto}else ai.firedLast=false;
    if(wd.melee&&look.d<2.8&&ready){c.fire=true;c.firePressed=true}
    c.aim=wd.zoom>1.5&&look.d>25;
    if(slot&&slot.k==='w'&&slot.mag<=0&&!wd.melee)c.reload=true}
   // abilities
   if(ai.react<=0&&Math.random()<dt*cfg.ab*1.4*pe.ab){const id=e.cdef.id;
    if(id==='coolguy15'){if(look.d<11&&e.cd[0]<=0&&e.grounded)this.useAbility(e,0);else if(look.d<45&&e.cd[1]<=0&&e.fireCd<.3)this.useAbility(e,1);else if(look.d<12&&e.cd[2]<=0&&(e.hp<e.maxHp*.5||mode==='flee'))this.useAbility(e,2)}
    else if(id==='chillguy')this.botChill(e,look.d);
    else if(id==='jay')this.botJay(e,look.d);
    else{if(look.d<7.5&&e.cd[1]<=0&&e.grounded)this.useAbility(e,1);else if(look.d<40&&e.cd[2]<=0)this.useAbility(e,2);else if(e.hp<e.maxHp*.55&&look.d>25&&e.cd[0]<=0)this.useAbility(e,0)}}
  }else{
   const slot=e.inv[e.cur];if(slot&&slot.k==='w'){const wd=wstat(slot.w,slot.r);if(!wd.melee&&slot.mag<wd.mag*.6&&e.ammo[wd.ammo]>0)c.reload=true}
   if(ai.healing){const s=e.inv[e.cur];if(s&&s.k==='i'){c.firePressed=true;c.fire=true}else ai.healing=false}
   // fleeing / hiding bots use their survival abilities
   if(!ai.healing&&(mode==='flee'||mode==='hide')&&e.cdef.id==='zach'){if(e.hp<e.maxHp*.7&&e.cd[0]<=0&&!ai.fight)this.useAbility(e,0);else if(mode==='flee'&&e.cd[2]<=0&&Math.random()<dt*2)this.useAbility(e,2)}
   if(!ai.healing&&mode!=='flee'&&mode!=='hide'&&e.hp<e.maxHp*.7&&e.cdef.id==='zach'&&e.cd[0]<=0&&!ai.fight)this.useAbility(e,0);
   if(e.cdef.id==='jay'&&e.hp<e.maxHp*.65&&e.cd[2]<=0&&e.grounded)this.useAbility(e,2)}
  if(e.use&&en&&ai.seen>0&&e.use.t>.6){c.cancel=true;ai.healing=false}
  this.move(e,inp,dt);this.tickWeapon(e,c,dt);
  e.wi=(e.inv[e.cur]&&e.inv[e.cur].k==='w')?e.inv[e.cur].w*10+e.inv[e.cur].r:-1;e.flags=this.packFlags(e);
 },
 // ------------------------------------------------------------------ perception
 botSense(e,cfg,eye){
  const ai=e.ai,P=e.pos,t=this.t,pe=ai.p;let best=null,bd=1e9,heard=null,hd=1e9;
  const fx=-Math.sin(e.yaw),fz=-Math.cos(e.yaw);const half=Math.cos(cfg.fov*(pe.paranoid?1.15:1)*Math.PI/360);
  for(const o of this.list){
   if(o===e||this.isAlly(e,o)||!o.alive||o.drop==='bus'||(o.drop&&o.pos.y>P.y+30))continue;
   const dx=o.pos.x-P.x,dz=o.pos.z-P.z,d=Math.hypot(dx,dz);
   let vis=cfg.vis*(o.sprinting?1.2:1)*(o.crouch?.7:1)*(o.char==='chillguy'?BAL.chill.quiet.botVisMul:1);if(o.cloakT>0)vis=Math.min(vis,BAL.chill.disappear.botSeeRange);
   let seen=false;
   if(d<=vis){const dot=d<.01?1:(dx*fx+dz*fz)/d;if((d<10||dot>half||t-(o.lastShotAt||-99)<1.2)&&d<bd&&W.losClear(P.x,eye,P.z,o.pos.x,o.pos.y+1.2,o.pos.z)){bd=d;best=o;seen=true}}
   if(!seen){const loud=(t-(o.lastShotAt||-99)<2.5)?55:(o.sprinting?1:o.crouch?.2:.5)*cfg.hear;const hr=loud*pe.hear;
    if(d<hr&&d<hd){hd=d;heard={x:o.pos.x+rr(-3,3),z:o.pos.z+rr(-3,3),d,t,src:o.id}}}}
  return{best,bd,heard}},
 // ------------------------------------------------------------------ decision making
 // ---------------------------------------------------------------- team play
 // team modes: the nearest knocked teammate within 60 m (a bot goes to revive them)
 knockedMate(e){if(!this.teamMode)return null;let best=null,bd=60;for(const o of this.list){if(o===e||!o.knocked||!o.alive||o.team!==e.team)continue;const q=d2(o.pos.x,o.pos.z,e.pos.x,e.pos.z);if(q<bd){bd=q;best=o}}return best},
 nearestMate(e){let mate=null,d=1e9;for(const o of this.list){if(o===e||!o.alive||o.knocked||o.drop||o.team!==e.team)continue;const q=d2(o.pos.x,o.pos.z,e.pos.x,e.pos.z);if(q<d){d=q;mate=o}}return{mate,d}},
 healSlot(e){for(let i=1;i<6;i++){const s=e.inv[i];if(s&&s.k==='i'&&(ITEMS[s.id].kind==='heal'||s.id==='chug'))return i}return -1},
 // an ammo type this bot can spare for a teammate who carries a gun of that type but is nearly out
 ammoGift(e,o){for(const s of o.inv){if(!s||s.k!=='w'||s.w<=0)continue;const k=WEAPONS[s.w].ammo;if(o.ammo[k]<20&&e.ammo[k]>=60)return k}return null},
 // the teammate this bot should help now: a hurt one (if we can spare a heal) or one short on ammo
 supportNeed(e){
  let best=null,bs=0;
  for(const o of this.list){
   if(o===e||!o.alive||o.knocked||o.drop||o.team!==e.team)continue;
   if(d2(o.pos.x,o.pos.z,e.pos.x,e.pos.z)>45)continue;
   let s=0;
   if(o.hp<o.maxHp*.45&&this.healSlot(e)>=0&&e.hp>=e.maxHp*.5)s=2+(1-o.hp/o.maxHp);
   else if(this.ammoGift(e,o))s=1;
   if(s>bs){bs=s;best={mate:o,kind:s>=2?'heal':'ammo'}}
  }
  return best;
 },
 // hands the item over once the bot is next to the teammate (host side; bots only run on the host)
 botSupport(e){
  const ai=e.ai,sup=ai.support;if(!sup)return;
  const o=sup.mate;if(!o||!o.alive){ai.support=null;return}
  if(d2(o.pos.x,o.pos.z,e.pos.x,e.pos.z)>3.2)return;
  if(sup.kind==='heal'){
   const i=this.healSlot(e);if(i<0||o.hp>=o.maxHp*.45){ai.support=null;return}
   const s=e.inv[i],it=ITEMS[s.id];this.consume(e,s);
   const amt=Math.max(0,Math.min(it.hp||40,o.maxHp-o.hp));
   this.healEnt(o,amt,0);this.emit({k:'heal',t:o.id,hp:amt});
  }else{
   const k=this.ammoGift(e,o);if(k){const n=Math.min(30,e.ammo[k]-30);if(n>0){e.ammo[k]-=n;o.ammo[k]+=n}}
  }
  ai.support=null;
 },
 botThink(e,cfg){
  const ai=e.ai,pe=ai.p,P=e.pos,t=this.t;
  const eye=this.eyeOf(e);
  const low=(e.hp+e.sh*.6)/e.maxHp;                 // 0..~1.6 ; shields count for a bit
  const {best,bd,heard}=this.botSense(e,cfg,eye);
  const near=this.nearestMate(e),sup=best?null:this.supportNeed(e);ai.support=sup;
  const kmate=best?null:this.knockedMate(e);ai.kmate=kmate;
  const hitRecent=t-ai.hitT<4;
  if(best){if(ai.enemy!==best||ai.seen<=0)ai.react=cfg.react*(.7+Math.random()*.6)*pe.twitchy;ai.enemy=best;ai.seen=1;ai.lastSeenPos={x:best.pos.x,z:best.pos.z,t};ai.lastSeenT=t}
  else{if(ai.seen>0)ai.seen-=.34;if(ai.seen<=0&&!hitRecent&&t-ai.lastSeenT>pe.chase+3)ai.enemy=null}
  if(heard&&(!ai.noise||t-ai.noise.t>1.5)){ai.noise=heard;if(!best)ai.glance={x:heard.x,z:heard.z,t}}
  const noise=ai.noise&&t-ai.noise.t<10?ai.noise:null;
  const armed=this.hasUsableGun(e);
  // ---- weapon choice (personality flavoured)
  if(e.equipT<=0&&!e.use&&!e.reload&&!ai.healing){
   let bi=-1,bs=-1;const d=best?bd:30;
   for(let i=0;i<6;i++){const s=e.inv[i];if(!s||s.k!=='w')continue;const wd=wstat(s.w,s.r);if(i>0&&!wd.melee&&s.mag<=0&&e.ammo[wd.ammo]<=0)continue;
    let sc=wd.dmg*wd.pellets*Math.min(wd.rps,6)*(1+s.r*.08);
    if(wd.t==='sg')sc*=d<14?1.8:d<25?.5:.15;else if(wd.t==='sn')sc*=d>45?2:d>20?1:.35;else if(wd.t==='smg')sc*=d<25?1.3:.8;else if(wd.t==='ex')sc*=d>10?.9:.2;else if(wd.melee)sc=i===0?1:(d<3?400:5);
    else if(wd.t==='fun')sc*=.7;
    if(pe.key==='sniper'&&wd.t==='sn')sc*=1.5;if(pe.key==='rusher'&&(wd.t==='sg'||wd.t==='smg'))sc*=1.25;
    if(i>0&&s.mag<=0&&!wd.melee)sc*=.3;if(sc>bs){bs=sc;bi=i}}
   if(bi>=0&&bi!==e.cur)this.swapTo(e,bi)}
  // ---- tactical assessment of the visible enemy
  let wantFight=false,wantFlee=false,why='';
  const cur=this.curWeapon(e);
  if(best){
   const ratio=this.powerOf(best)/(this.powerOf(e)+1);
   const engaged=hitRecent||bd<14||(best.ai&&best.ai.enemy===e&&best.ai.seen>0);
   const weak=(best.hp+best.sh*.8)<best.maxHp*.5||t-best.lastHit<5;
   let will=pe.aggr+(weak?.18:0)+(pe.key==='opportunist'&&weak?.2:0)-ratio*.22*(1-pe.aggr);
   wantFight=armed?(will>.3||engaged):(bd<8&&pe.aggr>.5);
   if(pe.camp>.6&&!engaged&&bd>48*pe.range)wantFight=false;           // campers/snipers don't go looking for trouble
   if(low<pe.fleeHp&&bd>5)wantFlee=true,why='hurt';
   else if(!armed&&bd>6)wantFlee=true,why='unarmed';
   else if(ratio>2.4&&pe.aggr<.85&&bd>9)wantFlee=true,why='outgunned';
   // tactical reload: out of ammo in the mag with an enemy nearby -> duck behind cover first
   const slot=e.inv[e.cur];
   if(slot&&slot.k==='w'&&cur&&!cur.melee&&slot.mag<=1&&e.ammo[cur.ammo]>0&&bd>11&&pe.caution>.35)wantFlee=true,why='reload';
   if(wantFlee&&(ai.cornered||(bd<5.5&&pe.aggr>.55))&&armed)wantFlee=false;                // cornered: stand and fight
   if(!wantFlee&&!wantFight)wantFlee=true,why='avoid';
  }
  const outside=!this.inZoneAt(P.x,P.z,6);
  const safe=!best||bd>70;
  // ---- choose mode
  const lockActive=t<ai.lockT;
  let next=ai.mode;
  if(best&&wantFlee&&!(lockActive&&ai.mode==='fight'&&why!=='hurt')){next='flee'}
  else if(best&&wantFight){next='fight'}
  else if(!best){
   const sinceSeen=t-ai.lastSeenT;
   const hurt=low<pe.hideHp;const haveHeal=e.inv.some(s=>s&&s.k==='i'&&(ITEMS[s.id].kind==='heal'||ITEMS[s.id].kind==='shield'||s.id==='chug'));
   if(ai.mode==='fight'||ai.mode==='flee')ai.cornered=false;
   if(kmate&&!hitRecent&&!outside&&low>pe.fleeHp)next='revive';
   else if(outside&&!(ai.mode==='fight'&&ai.seen>0))next='rotate';
   else if(hurt&&(sinceSeen<14||haveHeal||pe.caution>.5)&&(ai.mode==='hide'?t-ai.hideT0<28:true)&&!(outside)){next='hide'}
   else if(ai.mode==='hide'&&!hurt&&!ai.healing){next='loot'}
   else if(sup){next='regroup'}
   else if(noise&&armed&&low>pe.fleeHp+.25&&Math.random()<pe.aggr*pe.hear*.12+(pe.key==='opportunist'?.1:0)&&ai.mode!=='camp'){next='investigate'}
   else if(ai.mode==='investigate'&&noise&&t<ai.noiseUntil){next='investigate'}
   else if(ai.lastSeenPos&&sinceSeen<pe.chase&&pe.aggr>.45&&armed&&low>pe.fleeHp+.12&&ai.enemy&&ai.enemy.alive&&ai.mode!=='hide'){next='chase'}
   else if(ai.mode==='camp'&&ai.hold&&t<ai.hold.until&&!outside){next='camp'}
   else if(this.botWantsCamp(e,low,armed,outside)){next='camp'}
   else if(near.mate&&near.d>(ai.mode==='regroup'?144:576)){next='regroup'}
   else next=this.botLootOrRoam(e)?'loot':'roam';
   if(ai.mode==='chase'&&next==='chase'&&ai.searchT&&t>ai.searchT){next=this.botLootOrRoam(e)?'loot':'roam';ai.lastSeenPos=null}
   if(ai.mode==='investigate'&&next==='investigate'&&ai.searchT&&t>ai.searchT){ai.noise=null;next=this.botLootOrRoam(e)?'loot':'roam'}
  }
  else{next=ai.mode} // enemy visible, nothing decided -> keep current
  // ---- enter / maintain mode
  const prev=ai.mode;
  if(next!==prev){this.setMode(e,next,next==='flee'?2.5:next==='camp'?3:1);ai.fleeWhy=why;ai.cornered=ai.cornered&&next==='fight'}
  ai.fight=ai.mode==='fight'&&!!best&&ai.seen>0||(ai.mode==='fight'&&ai.seen>0);
  ai.fight2=!!best&&(ai.mode==='flee');
  switch(ai.mode){
   case'flee':{
    const tgt=best?best.pos:ai.lastSeenPos||{x:P.x+1,z:P.z};
    if(!ai.goal||ai.goal.why!=='flee'||best&&t-(ai.fleeAt||0)>1.6){
     ai.fleeAt=t;const ty=best?best.pos.y+1.4:P.y+1.4;const cv=this.findCover(e,tgt.x,tgt.z,ty);
     if(cv)this.setGoal(e,cv[0],cv[1],1.4,'flee');
     else{ // nowhere to hide: run away from the threat, otherwise fight cornered
      const dx=P.x-tgt.x,dz=P.z-tgt.z,d=Math.hypot(dx,dz)||1;const rx=P.x+dx/d*22,rz=P.z+dz/d*22;
      if(NAV.walkable(rx,rz)&&this.inZoneAt(rx,rz,4))this.setGoal(e,rx,rz,2,'flee');else ai.cornered=true}}
    if(ai.cornered&&best){this.setMode(e,'fight',2);ai.fight=true}
    // reached cover with the enemy out of view -> stand ground (heal / reload / ambush)
    if(!best&&t-ai.lastSeenT>1.6&&ai.goal===null){this.setMode(e,low<pe.hideHp?'hide':'loot',0)}
    break}
   case'hide':{
    if(ai.modeT<.3)ai.hideT0=t;
    if(!ai.goal&&!ai.holdAt||ai.goal&&ai.goal.why!=='hide'&&!ai.holdAt){
     const th=ai.lastSeenPos||ai.noise;let spot=null;
     if(th)spot=this.findCover(e,th.x,th.z,P.y+1.4,30);
     if(!spot||Math.random()<.4)spot=this.hideInBuilding(e)||spot;
     if(spot)this.setGoal(e,spot[0],spot[1],1.4,'hide');else ai.holdAt=t}
    break}
   case'camp':{
    if(!ai.hold||t>ai.hold.until||ai.modeT<.3&&!ai.hold.fresh){
     const spot=this.findHoldSpot(e,pe.key==='sniper'||pe.range>1.5);
     if(spot){ai.hold={x:spot[0],z:spot[1],until:t+rr(22,48),fresh:true};ai.holdAt=0;this.setGoal(e,spot[0],spot[1],1.5,'camp')}
     else{ai.hold=null;ai.campCd=rr(10,20);this.setMode(e,'loot',0)}}
    else if(ai.hold)ai.hold.fresh=false;
    break}
   case'chase':{const p=ai.lastSeenPos;if(p)this.setGoal(e,p.x,p.z,3,'chase');break}
   case'investigate':{if(noise){if(!ai.noiseUntil||t>ai.noiseUntil)ai.noiseUntil=t+12;this.setGoal(e,noise.x,noise.z,5,'investigate')}else this.setMode(e,'roam',0);break}
   case'revive':{const k=ai.kmate;if(!k||!k.knocked||!k.alive){this.setMode(e,'loot',0);break}
    if(!ai.goal||ai.goal.why!=='revive'||t-(ai.reviveAt||0)>1.5){ai.reviveAt=t;this.setGoal(e,k.pos.x,k.pos.z,1.2,'revive')}
    break}
   case'regroup':{const tm=sup?sup.mate:near.mate;if(!tm){this.setMode(e,'loot',0);break}
    if(!ai.goal||ai.goal.why!=='regroup'||t-(ai.regroupAt||0)>1.5){ai.regroupAt=t;const a=rr(0,6.283),r=sup?1.2:rr(3,5);this.setGoal(e,tm.pos.x+Math.cos(a)*r,tm.pos.z+Math.sin(a)*r,2,'regroup')}
    break}
   case'rotate':{const a=Math.atan2(P.z-nz0(this).z,P.x-nz0(this).x);const z=nz0(this);const k=Math.max(4,z.r*.55);this.setGoal(e,z.x+Math.cos(a)*k*.5,z.z+Math.sin(a)*k*.5,4,'rotate');break}
   case'loot':{if(ai.lootT&&this.loot.has(ai.lootT.id)){const l=ai.lootT;this.setGoal(e,l.x,l.z,1.6,'loot')}else{ai.lootT=null;this.setMode(e,'roam',0)}break}
   case'roam':{
    const z=nz0(this);const need=!ai.roam||Math.hypot(P.x-ai.roam.x,P.z-ai.roam.z)<5||t>ai.roam.until||!this.inZoneAt(ai.roam.x,ai.roam.z,8);
    if(need){let rx,rz;
     if(Math.random()<pe.hot*.8&&W.POIS.length){const po=W.POIS[Math.floor(Math.random()*W.POIS.length)];rx=po.x+rr(-po.r,po.r)*.5;rz=po.z+rr(-po.r,po.r)*.5}
     else{const a=Math.random()*6.283,r=Math.sqrt(Math.random())*Math.max(10,z.r*.75);rx=z.x+Math.cos(a)*r;rz=z.z+Math.sin(a)*r}
     if(this.inZoneAt(rx,rz,8)&&NAV.walkable(rx,rz))ai.roam={x:rx,z:rz,until:t+rr(20,40)};else if(!ai.roam)ai.roam={x:z.x,z:z.z,until:t+10}}
    if(ai.roam)this.setGoal(e,ai.roam.x,ai.roam.z,4,'roam');
    break}
  }
  // ---- healing (only when it's safe to stand still)
  const quiet=!best||bd>45&&!hitRecent;
  if(!ai.healing&&!e.use&&quiet&&ai.mode!=='fight'&&(ai.mode!=='flee')){
   let slot=-1;const th=pe.quirks.has('medic')?12:20;
   if(e.hp<e.maxHp-th)for(let i=1;i<6;i++){const s=e.inv[i];if(s&&s.k==='i'&&(ITEMS[s.id].kind==='heal'&&e.hp<ITEMS[s.id].cap-5||s.id==='chug'))slot=i}
   if(slot<0&&e.sh<50)for(let i=1;i<6;i++){const s=e.inv[i];if(s&&s.k==='i'&&ITEMS[s.id].kind==='shield'&&e.sh<ITEMS[s.id].cap-10)slot=i}
   // when hurt and the last threat is fresh, break line of sight first (handled by hide mode)
   if(slot>0&&(ai.mode!=='hide'||!ai.goal||t-ai.lastSeenT>5)){this.swapTo(e,slot);ai.healing=true;ai.healT=t}}
  if(ai.healing){
   const inUse=e.inv[e.cur]&&e.inv[e.cur].k==='i';
   if(!inUse||t-ai.healT>9||best&&bd<30){ai.healing=false;if(!(e.inv[e.cur]&&e.inv[e.cur].k==='w'))this.swapTo(e,this.firstWeaponSlot(e))}}
  // ---- pick a loot target when we're not busy
  if(ai.mode==='loot'||ai.mode==='roam'){
   if((!ai.lootT||!this.loot.has(ai.lootT.id))&&!ai.healing){ai.lootT=this.pickLootTarget(e);if(ai.lootT&&ai.mode==='roam'){this.setMode(e,'loot',0);this.setGoal(e,ai.lootT.x,ai.lootT.z,1.6,'loot')}}}
 },
 botWantsCamp(e,low,armed,outside){
  const ai=e.ai,pe=ai.p,t=this.t;
  if(outside||pe.camp<.3||!armed||this.storm.state==='shrink'&&pe.caution<.5)return false;
  if(ai.hold&&t<ai.hold.until&&ai.mode==='camp')return true;
  if(t<ai.campCd+0||ai.lootedN<4&&t<100)return false;
  if(ai.mode==='camp')return false;
  if(Math.random()>pe.camp*.35)return false;
  ai.campCd=t+rr(35,70);ai.hold=null;return true},
 botLootOrRoam(e){
  const ai=e.ai;if(ai.healing)return true;
  if(ai.lootT&&this.loot.has(ai.lootT.id))return true;
  ai.lootT=this.pickLootTarget(e);return !!ai.lootT},
 bldAt(x,z){for(const b of W.buildings){if(Math.abs(x-b.x)<b.w/2+.5&&Math.abs(z-b.z)<b.d/2+.5)return b}return null},
 spotDoor(l){const b=this.bldAt(l.x,l.z);return b?b.door:null},
 pickLootTarget(e){
  const P=e.pos,pe=e.ai.p;let best=null,bs=-1e9;
  const wc=e.inv.filter(s=>s&&s.k==='w'&&s.w>0).length;const hc=e.inv.filter(s=>s&&s.k==='i').length;
  const need={};for(const s of e.inv)if(s&&s.k==='w'){const a=WEAPONS[s.w].ammo;if(a)need[a]=(AMMO[a].max*.5)-e.ammo[a]}
  const maxD=90*Math.min(1.4,pe.greed);
  for(const l of this.loot.values()){const dx=l.x-P.x,dz=l.z-P.z;const d=Math.hypot(dx,dz);if(d>maxD||Math.abs(l.y-P.y)>18)continue;
   const f=e.ai.lootFail.get(l.id);if(f&&this.t-f<40)continue;
   if(!this.inZoneAt(l.x,l.z,5))continue;
   let v=0;
   if(l.chest)v=(l.supply?90:55)*pe.greed;else if(l.ammobox)v=Object.values(need).some(n=>n>0)?28:8;
   else{const it=l.item;if(it.k==='w'){const wd=WEAPONS[it.w];if(wd.melee)continue;const have=e.inv.some(s=>s&&s.k==='w'&&s.w===it.w&&s.r>=it.r);if(have)continue;v=(wc<3?40:12)+it.r*14;if(wc>=3){const worst=Math.min(...e.inv.filter(s=>s&&s.k==='w'&&s.w>0).map(s=>s.r));if(it.r<=worst)continue}}
    else if(it.k==='a'){if(!(need[it.t]>0))continue;v=25}
    else if(it.k==='m'){v=20}
    else{const d2_=ITEMS[it.id];v=d2_.kind==='heal'||d2_.kind==='shield'||d2_.kind==='chug'?(hc<4?22:6):(hc<5?12:3);if(it.id==='chug')v=30}}
   const sc=v-d*.55;if(sc>bs){bs=sc;best=l}}
  return best}
};
function nz0(g){return g.nextZone()||{x:g.storm.cx,z:g.storm.cz,r:g.storm.r}}
