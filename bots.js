import * as THREE from 'three';
import {WEAPONS,ITEMS,RARITY,AMMO,clamp,lerp} from './data.js';
import * as W from './world.js';
import {R,HSTAND,wstat,angDiff,lerpAng} from './shared.js';
import {itemName} from './loot.js';
const DIFF={Easy:{err:.065,react:.9,turn:3.6,vis:55,ab:.25,spd:.88},Normal:{err:.03,react:.45,turn:7,vis:75,ab:.55,spd:.96},Hard:{err:.011,react:.18,turn:13,vis:100,ab:.9,spd:1.02}};
const rr=(a,b)=>a+Math.random()*(b-a);
export const botMethods={
 initBot(e){e.ai={state:'drop',think:Math.random()*.3,enemy:null,lootT:null,wp:null,stuck:0,lastX:0,lastZ:0,stuckT:0,sideT:0,side:1,strafeT:0,strafe:1,react:0,seen:0,yawT:e.yaw,pitchT:0,crouchT:0,slideCd:0,jumpT:0,dropAt:0,dropTgt:null,wander:null,healing:false,lastSeenPos:null,aimTime:0,boredT:0,lootFail:new Map()};
  const cfg=this.botCfg();e.botSpeed=cfg.spd;
  // choose a drop POI
  const p=W.POIS[Math.floor(Math.random()*W.POIS.length)];const a=Math.random()*6.283,r=Math.random()*p.r*.6;e.ai.dropTgt={x:p.x+Math.cos(a)*r,z:p.z+Math.sin(a)*r};
  e.ai.dropAt=Math.random()*.4+.05},
 botCfg(){return DIFF[this.diff]||DIFF.Normal},
 onBotHit(t,by){const ai=t.ai;if(!ai||!by||by===t||!by.alive)return;if(!ai.enemy||Math.random()<.4){ai.enemy=by;ai.react=Math.min(ai.react||0,.25);ai.seen=0;ai.lastSeenPos={x:by.pos.x,z:by.pos.z}}ai.hitT=this.t},
 updateBots(dt){
  for(const e of this.list){if(!e.bot||!e.alive)continue;this.botTick(e,dt)}
  this.updateLootHost(dt);
 },
 botTick(e,dt){
  const ai=e.ai,cfg=this.botCfg();
  const inp={f:0,s:0,jump:false,jumpP:false,sprint:false,crouch:false,crouchP:false};
  const c={fire:false,firePressed:false,reload:false,aim:false,cancel:false,aimErr:cfg.err};
  if(e.drop==='bus'){
   const d=Math.hypot(this.bus.pos.x-ai.dropTgt.x,this.bus.pos.z-ai.dropTgt.z);
   const passed=this.bus.t*this.bus.speed>60;
   if(passed&&(d<ai.dropAt*220+60||this.bus.t*this.bus.speed>this.bus.len-30)){this.leaveBus(e);e.vel.x*=.4;e.vel.z*=.4}
   e.pos.copy(this.bus.pos);e.flags=this.packFlags(e);return}
  if(e.drop){ // aim at drop target
   const dx=ai.dropTgt.x-e.pos.x,dz=ai.dropTgt.z-e.pos.z;e.yaw=Math.atan2(-dx,-dz);e.pitch=-.9;inp.f=1;
   this.move(e,inp,dt);e.flags=this.packFlags(e);e.wi=-1;if(!e.drop)ai.state='loot';return}
  ai.think-=dt;ai.slideCd-=dt;ai.strafeT-=dt;ai.jumpT-=dt;
  if(ai.think<=0){ai.think=rr(.18,.3);this.botThink(e,cfg)}
  const en=ai.enemy&&ai.enemy.alive&&ai.fight?ai.enemy:null;
  let wishX=0,wishZ=0,sprint=false,look=null;
  const P=e.pos;
  // storm
  const nz=this.nextZone()||{x:this.storm.cx,z:this.storm.cz,r:this.storm.r};
  const outside=Math.hypot(P.x-this.storm.cx,P.z-this.storm.cz)>this.storm.r-6||(this.storm.state==='shrink'&&Math.hypot(P.x-nz.x,P.z-nz.z)>nz.r-8);
  if(en&&ai.seen>0&&ai.fight){
   const ex=en.pos.x,ez=en.pos.z,ey=en.pos.y+1.25;const dx=ex-P.x,dz=ez-P.z,d=Math.hypot(dx,dz);
   look={x:ex,y:ey-(en.crouch?.4:0)-(d>40?.15:.35),z:ez,d};
   const wd=this.curWeapon(e);const ideal=wd?(wd.t==='sg'?7:wd.t==='sn'?55:wd.t==='smg'?16:wd.t==='ex'?28:25):3;
   ai.react-=dt;
   if(ai.strafeT<=0){ai.strafeT=rr(.5,1.6);ai.strafe=Math.random()<.5?-1:1}
   const fx=dx/(d||1),fz=dz/(d||1);
   let mv=d>ideal+4?1:d<ideal-5?-.8:0;
   wishX=fx*mv+(-fz)*ai.strafe*.9;wishZ=fz*mv+fx*ai.strafe*.9;sprint=d>ideal+14&&!outside;
   if(outside)wishX+=(nz.x-P.x)*.01,wishZ+=(nz.z-P.z)*.01;
   if(Math.random()<dt*.5&&e.grounded)inp.jump=true;
   if(ai.slideCd<=0&&e.sprinting&&Math.random()<dt*.6){inp.crouchP=true;inp.crouch=true;ai.slideCd=4}
   if(wd&&wd.t==='sn'&&d>30)ai.crouchT=.5;
  }else if(ai.healing){wishX=wishZ=0;}
  else if(outside){const dx=nz.x-P.x,dz=nz.z-P.z,d=Math.hypot(dx,dz)||1;wishX=dx/d;wishZ=dz/d;sprint=true;look={x:nz.x,y:P.y+1.6,z:nz.z,d,nav:true}}
  else if(ai.lootT&&this.loot.has(ai.lootT.id)){
   const l=ai.lootT;let tx=l.x,tz=l.z;
   if(l.inside&&ai.wp&&!ai.wpDone){tx=ai.wp[0];tz=ai.wp[1];if(Math.hypot(P.x-tx,P.z-tz)<1.6)ai.wpDone=true}
   const dx=tx-P.x,dz=tz-P.z,d=Math.hypot(dx,dz)||1;wishX=dx/d;wishZ=dz/d;sprint=d>8;look={x:tx,y:P.y+1.6,z:tz,d,nav:true};
   if(Math.hypot(l.x-P.x,l.z-P.z)<2.4){const slot0=l;if(l.chest||l.ammobox||l.item)this.hostPick(e,l);ai.lootT=null;ai.wp=null;ai.think=.05}
  }else{
   // roam toward zone center
   if(!ai.wander||Math.hypot(P.x-ai.wander.x,P.z-ai.wander.z)<4||Math.random()<dt*.05){const a=Math.random()*6.283,r=Math.random()*Math.max(10,nz.r*.8);ai.wander={x:nz.x+Math.cos(a)*r,z:nz.z+Math.sin(a)*r}}
   const dx=ai.wander.x-P.x,dz=ai.wander.z-P.z,d=Math.hypot(dx,dz)||1;wishX=dx/d;wishZ=dz/d;sprint=true;look={x:ai.wander.x,y:P.y+1.6,z:ai.wander.z,d,nav:true}}
  // obstacle avoidance & stuck
  let wl=Math.hypot(wishX,wishZ);if(wl>.01){wishX/=wl;wishZ/=wl;
   const ph=this.hbH(e);const px=P.x+wishX*1.3,pz=P.z+wishZ*1.3;
   if(W.blocked(px,P.y,pz,R,ph,.65)){ // try step side or jump
    if(!W.blocked(px,P.y+1.0,pz,R,ph,.65)||W.blocked(px,P.y+.4,pz,R,ph,.65)===false){inp.jump=true}
    else{ai.sideT=rr(.5,1.1);ai.side=Math.random()<.5?-1:1}}
   if(W.H(px,pz)<-.5&&W.H(P.x,P.z)>-.5){wishX=-wishX;wishZ=-wishZ;ai.sideT=.6}
   if(ai.sideT>0){ai.sideT-=dt;const ox=-wishZ*ai.side,oz=wishX*ai.side;wishX=ox*.9+wishX*.3;wishZ=oz*.9+wishZ*.3}
   ai.stuckT+=dt;if(ai.stuckT>.6){const mv=Math.hypot(P.x-ai.lastX,P.z-ai.lastZ);ai.stuckT=0;ai.lastX=P.x;ai.lastZ=P.z;if(mv<.5){ai.stuck++;inp.jump=true;ai.sideT=rr(.6,1.2);ai.side=Math.random()<.5?-1:1;if(ai.stuck>3&&ai.lootT){ai.lootFail.set(ai.lootT.id,this.t);ai.lootT=null;ai.wp=null;ai.stuck=0}if(ai.stuck>6){ai.wander=null;ai.stuck=0}}else ai.stuck=0}}
  // downhill slide
  if(sprint&&e.sprinting&&ai.slideCd<=0){const[gx,gz]=W.slope(P.x,P.z);if(-(gx*e.vel.x+gz*e.vel.z)>3.2){inp.crouchP=true;ai.slideCd=3}}
  if(e.sliding||ai.crouchT>0){inp.crouch=e.sliding?(Math.hypot(e.vel.x,e.vel.z)>4):true;ai.crouchT-=dt}
  // look
  let ty=e.yaw,tp=0;
  if(look){const dx=look.x-P.x,dz=look.z-P.z;ty=Math.atan2(-dx,-dz);const eye=this.eyeOf(e);tp=Math.atan2(look.y-eye,Math.hypot(dx,dz));if(look.nav)tp=clamp(tp,-.2,.2)}
  else if(wl>.01)ty=Math.atan2(-wishX,-wishZ);
  const turn=cfg.turn*(look&&!look.nav?1.3:.7);const dy=angDiff(e.yaw,ty);e.yaw+=clamp(dy,-turn*dt,turn*dt)*(look&&!look.nav?1:1)*Math.min(1,Math.abs(dy)*4+.25)/(Math.min(1,Math.abs(dy)*4+.25))*1;
  if(Math.abs(dy)<turn*dt)e.yaw=ty;
  e.pitch+=clamp(tp-e.pitch,-turn*dt,turn*dt);
  // convert wish to inputs
  const cy=Math.cos(e.yaw),sy=Math.sin(e.yaw);
  inp.f=-(wishX*sy+wishZ*cy);inp.s=wishX*cy-wishZ*sy;if(wl<.01){inp.f=0;inp.s=0}
  inp.sprint=sprint&&!ai.healing;
  // combat
  if(en&&ai.seen>0&&ai.fight&&look&&!look.nav){
   const slot=e.inv[e.cur];const wd=this.curWeapon(e);const ang=Math.abs(angDiff(e.yaw,ty));
   if(wd){
    if(ai.react<=0&&ang<(.05+.9/(look.d+4)*.4)&&look.d<wd.range*.9&&e.fireCd<=0&&e.reload<=0){c.fire=true;c.firePressed=!ai.firedLast;ai.firedLast=c.firePressed&&!wd.auto?true:false;if(wd.auto)ai.firedLast=false;else{ai.fireGate=(ai.fireGate||0)}}
    else ai.firedLast=false;
    if(wd.melee&&look.d<2.8&&ai.react<=0){c.fire=true;c.firePressed=true}
    c.aim=wd.zoom>1.5&&look.d>25;
    if(slot&&slot.k==='w'&&slot.mag<=0&&!wd.melee)c.reload=true;
   }
   // abilities
   if(ai.react<=0&&Math.random()<dt*cfg.ab*1.4){const id=e.cdef.id;
    if(id==='coolguy15'){if(look.d<11&&e.cd[0]<=0&&e.grounded)this.useAbility(e,0);else if(look.d<45&&e.cd[1]<=0&&e.fireCd<.3)this.useAbility(e,1);else if(look.d<8&&e.cd[2]<=0&&e.hp<e.maxHp*.5)this.useAbility(e,2)}
    else{if(look.d<7.5&&e.cd[1]<=0&&e.grounded)this.useAbility(e,1);else if(look.d<40&&e.cd[2]<=0)this.useAbility(e,2);else if(e.hp<e.maxHp*.55&&look.d>25&&e.cd[0]<=0)this.useAbility(e,0)}}
  }else{
   // out of combat: reload / heal
   const slot=e.inv[e.cur];if(slot&&slot.k==='w'){const wd=wstat(slot.w,slot.r);if(!wd.melee&&slot.mag<wd.mag*.6&&e.ammo[wd.ammo]>0)c.reload=true}
   if(ai.healing){const s=e.inv[e.cur];if(s&&s.k==='i'){c.firePressed=true;c.fire=true}else ai.healing=false}
   if(!ai.healing&&e.hp<e.maxHp*.7&&e.cdef.id==='zach'&&e.cd[0]<=0&&!look?.nav===false)this.useAbility(e,0)}
  if(e.use&&en&&ai.seen>0&&e.use.t>.6){c.cancel=true;ai.healing=false}
  this.move(e,inp,dt);this.tickWeapon(e,c,dt);
  e.wi=(e.inv[e.cur]&&e.inv[e.cur].k==='w')?e.inv[e.cur].w*10+e.inv[e.cur].r:-1;e.flags=this.packFlags(e);
 },
 botThink(e,cfg){
  const ai=e.ai,P=e.pos;
  // enemy detection
  let best=null,bd=1e9;const eye=this.eyeOf(e);
  for(const t of this.list){if(t===e||!t.alive||t.drop==='bus'||(t.drop&&t.pos.y>e.pos.y+30))continue;const dx=t.pos.x-P.x,dz=t.pos.z-P.z,d=Math.hypot(dx,dz);const vis=cfg.vis*(t.sprinting?1.2:1)*(t.crouch?.7:1);if(d>vis)continue;
   if(d<bd&&W.losClear(P.x,eye,P.z,t.pos.x,t.pos.y+1.2,t.pos.z)){bd=d;best=t}}
  if(best){if(ai.enemy!==best||ai.seen<=0){ai.react=cfg.react*(.7+Math.random()*.6)}ai.enemy=best;ai.seen=1;ai.lastSeenPos={x:best.pos.x,z:best.pos.z}}
  else{if(ai.seen>0)ai.seen-=.34;if(ai.seen<=0&&ai.lastSeenPos&&ai.enemy&&ai.enemy.alive&&this.t-(ai.hitT||-99)<3){ // chase last seen
    ai.seen=0;}if(ai.seen<=0&&this.t-(ai.hitT||-99)>5)ai.enemy=null}
  const armed=e.inv.some(s=>s&&s.k==='w'&&s.w>0&&(s.mag>0||e.ammo[WEAPONS[s.w].ammo]>0));const hitRecent=this.t-(ai.hitT||-99)<4;
  const inFight=!!(best&&ai.seen>0&&(armed||bd<9||hitRecent));ai.fight=inFight||(!!ai.enemy&&ai.seen>0&&(armed||hitRecent)&&ai.fight);
  // weapon choice
  if(e.equipT<=0&&!e.use&&!e.reload){
   let bi=-1,bs=-1;const d=inFight?bd:30;
   for(let i=0;i<6;i++){const s=e.inv[i];if(!s||s.k!=='w')continue;const wd=wstat(s.w,s.r);if(i>0&&!wd.melee&&s.mag<=0&&e.ammo[wd.ammo]<=0)continue;
    let sc=wd.dmg*wd.pellets*Math.min(wd.rps,6)*(1+s.r*.08);
    if(wd.t==='sg')sc*=d<14?1.8:d<25?.5:.15;else if(wd.t==='sn')sc*=d>45?2:d>20?1:.35;else if(wd.t==='smg')sc*=d<25?1.3:.8;else if(wd.t==='ex')sc*=d>10?.9:.2;else if(wd.melee)sc=i===0?1:(d<3?400:5);
    else if(wd.t==='fun')sc*=.7;
    if(i>0&&s.mag<=0&&!wd.melee)sc*=.3;if(sc>bs){bs=sc;bi=i}}
   if(bi>=0&&bi!==e.cur)this.swapTo(e,bi)}
  if(!inFight){
   // heal
   if(!ai.healing&&!e.use){let slot=-1;
    if(e.hp<e.maxHp-20)for(let i=1;i<6;i++){const s=e.inv[i];if(s&&s.k==='i'&&(ITEMS[s.id].kind==='heal'&&e.hp<ITEMS[s.id].cap-5||s.id==='chug'))slot=i}
    if(slot<0&&e.sh<50)for(let i=1;i<6;i++){const s=e.inv[i];if(s&&s.k==='i'&&ITEMS[s.id].kind==='shield'&&e.sh<ITEMS[s.id].cap-10)slot=i}
    if(slot>0){this.swapTo(e,slot);ai.healing=true;ai.healT=this.t}}
   if(ai.healing&&(this.t-ai.healT>8||!e.inv.some(s=>s&&s.k==='i'&&e.inv[e.cur]===s))){if(e.inv[e.cur]&&e.inv[e.cur].k==='i'&&this.t-ai.healT<8){}else{ai.healing=false;this.swapTo(e,this.firstWeaponSlot(e))}}
   // pick loot target
   if((!ai.lootT||!this.loot.has(ai.lootT.id))&&!ai.healing){ai.lootT=this.pickLootTarget(e);ai.wp=null;ai.wpDone=false;
    if(ai.lootT&&ai.lootT.spot){}}
   if(ai.lootT&&ai.wp===null){const sp=this.spotDoor(ai.lootT);ai.wp=sp||undefined;ai.wpDone=!sp;if(ai.wp===undefined)ai.wp=null,ai.wpDone=true}
  }
 },
 spotDoor(l){ // nearest building door if loot is inside a building
  const b=this.bldAt(l.x,l.z);return b?b.door:null},
 bldAt(x,z){for(const b of W.buildings){if(Math.abs(x-b.x)<b.w/2+.5&&Math.abs(z-b.z)<b.d/2+.5)return b}return null},
 pickLootTarget(e){
  const P=e.pos;let best=null,bs=-1e9;
  const wc=e.inv.filter(s=>s&&s.k==='w'&&s.w>0).length;const hc=e.inv.filter(s=>s&&s.k==='i').length;
  const need={};for(const s of e.inv)if(s&&s.k==='w'){const a=WEAPONS[s.w].ammo;if(a)need[a]=(AMMO[a].max*.5)-e.ammo[a]}
  for(const l of this.loot.values()){const dx=l.x-P.x,dz=l.z-P.z;const d=Math.hypot(dx,dz);if(d>90||Math.abs(l.y-P.y)>18)continue;
   const f=e.ai.lootFail.get(l.id);if(f&&this.t-f<30)continue;
   let v=0;
   if(l.chest)v=l.supply?90:55;else if(l.ammobox)v=Object.values(need).some(n=>n>0)?28:8;
   else{const it=l.item;if(it.k==='w'){const wd=WEAPONS[it.w];if(wd.melee)continue;const have=e.inv.some(s=>s&&s.k==='w'&&s.w===it.w&&s.r>=it.r);if(have)continue;v=(wc<3?40:12)+it.r*14;if(wc>=3){const worst=Math.min(...e.inv.filter(s=>s&&s.k==='w'&&s.w>0).map(s=>s.r));if(it.r<=worst)continue}}
    else if(it.k==='a'){if(!(need[it.t]>0))continue;v=25}
    else{const d2=ITEMS[it.id];v=d2.kind==='heal'||d2.kind==='shield'||d2.kind==='chug'?(hc<4?22:6):(hc<5?12:3);if(it.id==='chug')v=30}}
   const sc=v-d*.55;if(sc>bs){bs=sc;best=l}}
  return best}
};
