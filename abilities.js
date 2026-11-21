// =================================================================================================
// Hero abilities: Chill Guy (stealth) and Jay (chef / support)
//
// NETWORK MODEL (see ABILITIES.md)
//  * The machine that owns a player predicts the cheap local parts (cooldown, cloak timer, dash, throw animation, sounds)
//    and sends one { t:'ab', i, yaw, pt, ...extras } message to the host.
//  * The HOST is authoritative for everything that touches other players: damage, healing, slow/slip/daze,
//    projectiles, healing zones, boomerang pans and cooldown validation. It replicates visuals with small events:
//      vfx (one-shot effects)  zn+ / zn-  (zones)  pn+ / pn~ / pn-  (boomerang pan)  heal  (healing numbers)
//  * Cloak is carried by flag bit 4096 in the normal position packets / snapshots, so every client and every bot sees it.
// =================================================================================================
import * as THREE from 'three';
import {BAL,FOODS,FOOD_ICON,ITEMS,clamp,lerp} from './data.js';
import * as W from './world.js';
import {mat} from './shared.js';

const CB=BAL.chill,JB=BAL.jay;
export const FOOD_COL={burger:'#d9892b',pizza:'#ffb02e',chilli:'#ff3a1a',banana:'#ffe14a',station:'#d63b2f'};
const dirOf=(yaw,pitch)=>{const cp=Math.cos(pitch);return[-Math.sin(yaw)*cp,Math.sin(pitch),-Math.cos(yaw)*cp]};
const rnd=Math.random;
const cyl=(r1,r2,h,seg=12,open=false,a0=0,al=6.2832)=>new THREE.CylinderGeometry(r1,r2,h,seg,1,open,a0,al);
const part=(g,geo,c,x,y,z,emi)=>{const m=new THREE.Mesh(geo,mat(c,emi));m.position.set(x,y,z);g.add(m);return m};

// ------------------------------------------------------------------------------------ 3D models
function panModel(){const g=new THREE.Group();
 part(g,cyl(.36,.3,.07,18),'#26262a',0,0,0);part(g,cyl(.28,.28,.02,16),'#3b3b42',0,.04,0);
 const rim=part(g,new THREE.TorusGeometry(.35,.035,6,18),'#9aa0a8',0,.035,0);rim.rotation.x=Math.PI/2;
 part(g,new THREE.BoxGeometry(.11,.05,.7),'#8a5a2a',0,0,-.62);part(g,new THREE.BoxGeometry(.13,.06,.12),'#555',0,0,-.3);
 g.scale.setScalar(1.35);return g}
function burgerModel(){const g=new THREE.Group();
 part(g,cyl(.24,.22,.08,12),'#d9892b',0,-.12,0);part(g,cyl(.26,.26,.05,12),'#4cd964',0,-.06,0);part(g,cyl(.23,.23,.08,12),'#5a2d12',0,0,0);
 part(g,new THREE.BoxGeometry(.5,.025,.5),'#ffd23d',0,.06,0).rotation.y=.8;part(g,new THREE.SphereGeometry(.26,12,8,0,6.283,0,1.57),'#e0983a',0,.1,0);g.scale.setScalar(1.15);return g}
function pizzaSlice(){const g=new THREE.Group();
 const s=part(g,cyl(.4,.4,.06,16,false,0,1.15),'#ffb02e',0,0,0);const c=part(g,cyl(.42,.42,.075,16,false,0,1.15),'#c9791f',0,-.005,0);c.scale.set(1,.9,1);
 for(const[x,z]of[[.18,.12],[.26,.26],[.1,.3]])part(g,cyl(.055,.055,.08,8),'#d8321f',x,.01,z);g.rotation.x=.25;g.scale.setScalar(1.3);return g}
function pizzaWhole(){const g=new THREE.Group();
 part(g,cyl(.85,.85,.07,24),'#ffb02e',0,0,0);const crust=part(g,new THREE.TorusGeometry(.82,.09,6,28),'#c9791f',0,.03,0);crust.rotation.x=Math.PI/2;
 for(let i=0;i<8;i++){const a=i/8*6.283+.3,r=.28+(i%2)*.28;part(g,cyl(.1,.1,.08,8),'#d8321f',Math.cos(a)*r,.02,Math.sin(a)*r)}
 for(let i=0;i<4;i++)part(g,cyl(.06,.06,.08,6),'#2fae6a',Math.cos(i*1.7)*.5,.025,Math.sin(i*1.7)*.5);return g}
function chilliModel(){const g=new THREE.Group();
 const b=part(g,new THREE.ConeGeometry(.16,.7,8),'#e8281a',0,0,0);b.rotation.z=Math.PI/2.4;part(g,new THREE.SphereGeometry(.16,8,6),'#e8281a',.22,.15,0);
 part(g,cyl(.04,.05,.18,6),'#2fae6a',.34,.3,0).rotation.z=.6;g.scale.setScalar(1.2);return g}
function bananaModel(){const g=new THREE.Group();
 const b=part(g,new THREE.TorusGeometry(.28,.1,6,12,3.6),'#ffe14a',0,0,0);b.rotation.x=0;part(g,cyl(.04,.04,.1,5),'#6a4a1a',.28,0,0);g.scale.setScalar(1.15);return g}
function potModel(){const g=new THREE.Group();
 part(g,cyl(.38,.34,.4,14),'#d63b2f',0,0,0);part(g,cyl(.4,.4,.06,14),'#9aa0a8',0,.22,0);part(g,cyl(.4,.4,.05,14),'#f2f5f7',0,.27,0).scale.y=.6;
 part(g,new THREE.SphereGeometry(.07,8,6),'#9aa0a8',0,.36,0);part(g,new THREE.BoxGeometry(.14,.05,.05),'#444',.46,.1,0);part(g,new THREE.BoxGeometry(.14,.05,.05),'#444',-.46,.1,0);g.scale.setScalar(1.2);return g}
function stoveModel(){const g=new THREE.Group();
 part(g,new THREE.BoxGeometry(1.5,.7,1.1),'#9aa3ad',0,.35,0);part(g,new THREE.BoxGeometry(1.56,.08,1.16),'#d9e2e8',0,.72,0);
 for(const x of[-.45,0,.45])part(g,cyl(.07,.07,.05,8),'#222',x,.28,.56).rotation.x=Math.PI/2;
 part(g,cyl(.32,.32,.03,14),'#ff7a1e',0,.77,0,'#ff5a00');
 const pot=potModel();pot.position.y=.98;pot.name='pot';g.add(pot);return g}
function foodModel(kind){switch(kind){case'burger':return burgerModel();case'pizza':return pizzaSlice();case'chilli':return chilliModel();case'banana':return bananaModel();case'station':return potModel()}return new THREE.Group()}
export function makeFoodMesh(sp){return foodModel(sp.replace('f_',''))}
export function makeChefHat(){const g=new THREE.Group();
 part(g,cyl(.3,.28,.28,14),'#ffffff',0,0,0);part(g,new THREE.SphereGeometry(.34,12,10),'#ffffff',0,.26,0);part(g,new THREE.SphereGeometry(.24,10,8),'#f4f4f4',-.2,.2,.14);part(g,new THREE.SphereGeometry(.24,10,8),'#f4f4f4',.2,.2,-.14);
 part(g,cyl(.31,.31,.05,14),'#dddde6',0,-.12,0);g.visible=false;return g}
const emojiTex={};
function emojiTexture(e){if(emojiTex[e])return emojiTex[e];const c=document.createElement('canvas');c.width=c.height=96;const x=c.getContext('2d');x.font='72px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(e,48,52);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return emojiTex[e]=t}

export const heroMethods={
 // ================================================================== shared helpers
 allied(a,b){return !!a&&!!b&&a.team===b.team},
 dmgMulOf(e){return (e&&e.coldUntil>this.t?CB.cold.dmgMul:1)*(e&&e.spicyT>0?1.3:1)},
 foodHealMul(t){return t&&t.cdef&&t.cdef.id==='jay'?JB.passive.foodHealMul:1},
 isFoodLoot(l){const it=l&&l.item;if(!it||it.k!=='i')return false;const d=ITEMS[it.id];return !!d&&(d.kind==='heal'||d.kind==='shield'||d.kind==='chug'||it.id==='banana')},
 // Chef's Touch: Jay reaches consumables from further away
 lootReach(e,l){return e&&e.cdef&&e.cdef.id==='jay'&&this.isFoodLoot(l)?JB.passive.pickupReach:1},
 shuffledFoods(avoid){const a=FOODS.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]]}if(avoid&&a[0]===avoid){[a[0],a[1]]=[a[1],a[0]]}return a},
 // "random food" is a shuffled bag: every food shows up once per 4 throws, so there are no dead streaks and the next one can be previewed on the HUD
 takeFood(e){if(!e.foodBag||!e.foodBag.length)e.foodBag=this.shuffledFoods();const f=e.foodBag.shift();if(!e.foodBag.length)e.foodBag=this.shuffledFoods(f);return f},

 // ================================================================== cloak
 revealEnt(e){ // the owner's machine ends the cloak (attacking)
  if(!(e.cloakT>0))return;e.cloakT=0;if(this.role!=='client'){e.flags&=~4096;e.noCloakUntil=this.t+.3}
  if(e.local)this.hud.toast('Revealed!','#ff9a9a')},
 revealHost(t){ // host ends the cloak (damage taken / attack seen by the host)
  if(!(t.cloakT>0))return;t.cloakT=0;t.flags&=~4096;t.noCloakUntil=this.t+.4;
  if(t.peer!==undefined&&!t.local)this.emit({k:'st',i:t.id,s:'reveal'},t.id);else if(t.local)this.hud.toast('Revealed!','#ff9a9a')},

 // ================================================================== local use (prediction + routing to host)
 useHeroAbility(e,i,ab){
  const id=e.cdef.id,net=this.role==='client'&&e.local,au=this.audio;
  const send=x=>{if(net)this.net.toHost(Object.assign({t:'ab',i,x:e.pos.x,y:e.pos.y,z:e.pos.z,yaw:e.yaw,pt:e.pitch},x||{}));else this.heroEffect(e,i,e.pos.x,e.pos.y,e.pos.z,e.yaw,x||{})};
  if(id==='chillguy'){
   if(i===0){e.cd[0]=ab.cd;e.cloakT=CB.disappear.dur;if(e.local){au.play('cloak');this.view.shake=Math.max(this.view.shake,.12);this.hud.toast('Cloaked','#9be0ff')}send()}
   else if(i===1){e.cd[1]=ab.cd;e.coldT=CB.cold.dur;e.coldUntil=this.t+CB.cold.dur;if(e.local){au.play('cold');this.hud.toast('Cold Blooded +30% damage','#7fe0ff')}send()}
   else{
    const tg=this.findStrikeTarget(e,CB.strike.range);
    if(!tg){if(e.local){this.hud.toast('No target in range','#ff7a7a');au.play('empty')}return false}
    e.cd[2]=ab.cd;this.revealEnt(e);
    const dx=tg.pos.x-e.pos.x,dz=tg.pos.z-e.pos.z,d=Math.hypot(dx,dz)||1,sp=CB.strike.speed;
    e.dash={vx:dx/d*sp,vz:dz/d*sp,t:clamp((d-1.3)/sp+.04,.08,CB.strike.maxDash),kind:'strike'};
    e.vel.y=Math.max(e.vel.y,2.5);e.grounded=false;e.sliding=false;e.anim='strike';e.animDur=e.animT=.34;
    if(e.local){au.play('strike');this.view.shake=Math.max(this.view.shake,.2)}
    send({tg:tg.id})}
  }else if(id==='jay'){
   if(i===0){e.cd[0]=ab.cd;e.anim='pan';e.animDur=e.animT=.34;if(e.local)au.play('throw');send()}
   else if(i===1){const f=this.takeFood(e);e.cd[1]=ab.cd;e.anim='food';e.animDur=e.animT=.42;if(e.local){au.play('throw');this.hud.toast(FOOD_ICON[f]+' '+f[0].toUpperCase()+f.slice(1)+'!','#ffd84a')}send({f:FOODS.indexOf(f)})}
   else{e.cd[2]=ab.cd;e.cookT=JB.kitchen.prep;e.vel.x*=.3;e.vel.z*=.3;e.sliding=false;if(e.local){au.play('chop');this.hud.toast('Cooking up something special…','#ffb347')}send()}
  }
  if(e.local)this.hud.abilityUsed&&this.hud.abilityUsed(i);
  return true},
 findStrikeTarget(e,range,x=e.pos.x,z=e.pos.z,yaw=e.yaw){
  const fx=-Math.sin(yaw),fz=-Math.cos(yaw);let best=null,bs=1e9;
  for(const t of this.list){if(t===e||!t.alive||t.drop||this.allied(e,t))continue;
   const dx=t.pos.x-x,dz=t.pos.z-z,d=Math.hypot(dx,dz);if(d>range||Math.abs(t.pos.y-e.pos.y)>2.5)continue;
   const dot=d<1?1:(dx*fx+dz*fz)/d;if(d>=1&&dot<.45)continue;
   if(d>2&&!W.losClear(x,e.pos.y+1.2,z,t.pos.x,t.pos.y+1.2,t.pos.z))continue; // cannot dash through walls
   const sc=d*(1.6-dot);if(sc<bs){bs=sc;best=t}}
  return best},

 // ================================================================== host: authoritative effects
 heroEffect(e,i,x,y,z,yaw,m){
  m=m||{};const id=e.cdef.id;
  if(id==='chillguy'){
   if(i===0){this.emit({k:'vfx',t:'poof',i:e.id,x,y,z});this.emit({k:'snd',n:'cloak',p:[x,y,z],g:.7})}
   else if(i===1){e.coldUntil=this.t+CB.cold.dur;this.emit({k:'vfx',t:'cold',i:e.id,x,y,z});this.emit({k:'snd',n:'cold',p:[x,y,z]})}
   else{
    const S=CB.strike;let tg=m.tg!==undefined?this.ents.get(m.tg):null;
    if(!tg||!tg.alive||tg.drop||this.allied(e,tg)||Math.hypot(tg.pos.x-x,tg.pos.z-z)>S.range+S.hostSlack)tg=this.findStrikeTarget(e,S.range+S.hostSlack,x,z,yaw);
    if(tg){const d=Math.hypot(tg.pos.x-x,tg.pos.z-z);e.stkTarget=tg.id;e.stkAt=this.t+Math.max(.06,(d-1.3)/S.speed)}else e.stkTarget=null;
    this.emit({k:'vfx',t:'dash',i:e.id,x,y,z,tx:tg?tg.pos.x:x-Math.sin(yaw)*6,tz:tg?tg.pos.z:z-Math.cos(yaw)*6});
    this.emit({k:'snd',n:'strike',p:[x,y,z]});this.revealHost(e)}
  }else if(id==='jay'){
   if(i===0){this.spawnPan(e,yaw);this.emit({k:'vfx',t:'anim',i:e.id,a:'pan',d:.34});this.emit({k:'snd',n:'pan',p:[x,y,z]})}
   else if(i===1){
    const food=FOODS[m.f]||FOODS[(rnd()*FOODS.length)|0];const pt=Number.isFinite(m.pt)?clamp(m.pt,-1.5,1.5):e.pitch;
    this.throwFood(e,food,yaw,pt);
    this.emit({k:'vfx',t:'anim',i:e.id,a:'food',d:.42});this.emit({k:'vfx',t:'pop',x,y:y+2.7,z,e:FOOD_ICON[food]});this.emit({k:'snd',n:'throw',p:[x,y,z]})}
   else{e.kitchenAt=this.t+JB.kitchen.prep;this.emit({k:'snd',n:'chop',p:[x,y,z]})}
  }},
 heroTick(e,dt){
  if(this.role==='client')return;
  if(e.stkTarget!==undefined&&e.stkTarget!==null&&this.t>=e.stkAt){const t=this.ents.get(e.stkTarget);e.stkTarget=null;if(t&&t.alive&&!t.drop)this.strikeHit(e,t)}
  if(e.kitchenAt&&this.t>=e.kitchenAt){e.kitchenAt=0;this.throwStation(e)}},
 strikeHit(e,t){
  const S=CB.strike,fx=-Math.sin(t.yaw),fz=-Math.cos(t.yaw);let dx=t.pos.x-e.pos.x,dz=t.pos.z-e.pos.z;const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;
  const back=(fx*dx+fz*dz)>S.backCone;                                     // target is facing away from Chill Guy
  this.damage(t,S.dmg*(back?S.backMul:1),e,-10,false,[t.pos.x,t.pos.y+1.2,t.pos.z]);
  this.emit({k:'st',i:t.id,s:'slow',t:back?S.backSlowT:S.slowT,f:S.slow},t.id);
  this.emit({k:'vfx',t:'stab',i:t.id,x:t.pos.x,y:t.pos.y+1.1,z:t.pos.z,b:back?1:0,o:e.id});
  this.emit({k:'snd',n:'stab',p:[t.pos.x,t.pos.y+1,t.pos.z],g:back?1.3:1});this.revealHost(e)},
 healHost(t,amt,by,showN=true){
  if(!t||!t.alive||t.hp>=t.maxHp||amt<=0)return 0;const a=Math.min(amt,t.maxHp-t.hp);t.hp+=a;
  this.emit({k:'heal',t:t.id,a:Math.round(a*10)/10,by:by===undefined?-1:by,n:showN?1:0});return a},
 // ------------------------------------------------------------------ food
 throwFood(e,food,yaw,pt){
  const F=JB.food,d=dirOf(yaw,clamp(pt+F.arc,-1.5,1.5)),ox=e.pos.x,oy=this.eyeOf(e)-.1,oz=e.pos.z;
  const wd={n:'Food Fight',food,dmg:0,splash:.5,speed:F.speed,grav:F.grav,bounce:0,fuse:0,kb:0,sp2:'f_'+food,col:FOOD_COL[food],life:3};
  this.spawnProj(e,ox+d[0]*.6,oy+d[1]*.6,oz+d[2]*.6,d[0]*F.speed+e.vel.x*.25,d[1]*F.speed,d[2]*F.speed+e.vel.z*.25,wd,-12)},
 throwStation(e){
  const K=JB.kitchen,d=dirOf(e.yaw,clamp(e.pitch+.2,-1.5,1.5));
  const wd={n:'Kitchen Special',food:'station',dmg:0,splash:.5,speed:K.speed,grav:K.grav,bounce:0,fuse:0,kb:0,sp2:'f_station',col:FOOD_COL.station,life:4};
  this.spawnProj(e,e.pos.x+d[0]*.6,this.eyeOf(e)-.1+d[1]*.6,e.pos.z+d[2]*.6,d[0]*K.speed+e.vel.x*.2,d[1]*K.speed,d[2]*K.speed+e.vel.z*.2,wd,-12);
  const p=this.projs[this.projs.length-1];p.direct=false;                   // the pot flies over players and only lands on the world
  this.emit({k:'snd',n:'throw',p:[e.pos.x,e.pos.y,e.pos.z]})},
 foodHit(p,t,ux,uz){ // projectile touched a player
  const owner=this.ents.get(p.owner),F=JB.food,ally=owner&&this.allied(owner,t);
  if(p.food==='burger'){
   if(ally){const a=this.healHost(t,F.burger.heal*this.foodHealMul(t),p.owner);this.emit({k:'vfx',t:'splat',x:p.x,y:p.y,z:p.z,c:'#6cff8a'});if(a<=0)this.emit({k:'vfx',t:'splat',x:p.x,y:p.y,z:p.z,c:'#d9892b'})}
   else{this.damage(t,F.burger.dmg,owner,-12,false,[p.x,p.y,p.z]);this.emit({k:'st',i:t.id,s:'kb',vx:ux*4,vy:2,vz:uz*4},t.id);this.emit({k:'vfx',t:'splat',x:p.x,y:p.y,z:p.z,c:'#d9892b'})}
   this.emit({k:'snd',n:'splat',p:[p.x,p.y,p.z]});return}
  if(p.food==='pizza'&&!ally&&F.pizza.dmg>0)this.damage(t,F.pizza.dmg,owner,-12,false,[p.x,p.y,p.z]);
  this.foodLand(p,t)},
 foodLand(p,direct){ // projectile reached the ground / a wall / a player
  const owner=this.ents.get(p.owner),F=JB.food;if(!p.food)return;
  const gy=W.groundAt(p.x,p.z,p.y+1,.3,2),water=W.H(p.x,p.z)<-.5;
  switch(p.food){
   case'chilli':this.chilliBlast(p,owner);break;
   case'pizza':if(water)this.emit({k:'vfx',t:'splat',x:p.x,y:p.y,z:p.z,c:'#ffb02e'});else{this.makeZone('pizza',owner,p.x,gy,p.z,F.pizza.r,F.pizza.dur,{hps:F.pizza.hps});this.emit({k:'snd',n:'splat',p:[p.x,gy,p.z]})}break;
   case'banana':if(water)this.emit({k:'vfx',t:'splat',x:p.x,y:p.y,z:p.z,c:'#ffe14a'});else{this.makeZone('banana',owner,p.x,gy,p.z,F.banana.r,F.banana.dur,{});this.emit({k:'snd',n:'splat',p:[p.x,gy,p.z]})}break;
   case'station':if(water)this.emit({k:'vfx',t:'splat',x:p.x,y:p.y,z:p.z,c:'#d63b2f'});else{this.makeZone('station',owner,p.x,gy,p.z,JB.kitchen.r,JB.kitchen.dur,{hps:JB.kitchen.hps});this.emit({k:'snd',n:'bell',p:[p.x,gy,p.z]})}break;
   default:this.emit({k:'vfx',t:'splat',x:p.x,y:p.y,z:p.z,c:'#d9892b'});this.emit({k:'snd',n:'splat',p:[p.x,p.y,p.z]})}},
 chilliBlast(p,owner){
  const C=JB.food.chilli;this.emit({k:'ex',x:p.x,y:p.y,z:p.z,r:C.r,c:'#ff3a1a'});
  for(const t of this.list){if(!t.alive||t.drop==='bus'||(owner&&this.allied(owner,t)))continue;
   const dx=t.pos.x-p.x,dy=t.pos.y+.9-p.y,dz=t.pos.z-p.z,d=Math.hypot(dx,dy,dz),rr=C.r+.5;if(d>rr)continue;
   if(d>1.6&&!W.losClear(p.x,p.y+.2,p.z,t.pos.x,t.pos.y+.9,t.pos.z))continue;
   const f=lerp(1,C.minFalloff,clamp(d/rr,0,1));
   this.damage(t,C.dmg*f,owner,-13,false,[t.pos.x,t.pos.y+1,t.pos.z]);
   const l=d||1,kb=8*f+2;this.emit({k:'st',i:t.id,s:'kb',vx:dx/l*kb,vy:Math.max(3,dy/l*kb*.8+3),vz:dz/l*kb},t.id);
   this.emit({k:'st',i:t.id,s:'daze',t:C.daze},t.id)}},
 // ------------------------------------------------------------------ zones (pizza area, banana patch, kitchen station)
 makeZone(kind,owner,x,y,z,r,dur,extra){
  const id=this.nextZoneId++;const zn=Object.assign({id,k:kind,x,y,z,r,t:dur,life:dur,o:owner?owner.id:-1,tm:owner?owner.team:-999,tick:0},extra||{});
  this.zones.set(id,zn);this.emit({k:'zn+',id,n:kind,x,y,z,r,d:dur,o:zn.o});return zn},
 slipApply(t,dur){
  t.slipImm=this.t+JB.food.banana.immune;this.emit({k:'st',i:t.id,s:'slip',t:dur},t.id);
  this.emit({k:'st',i:t.id,s:'kb',vx:t.vel.x*.55,vy:2.5,vz:t.vel.z*.55},t.id)},     // keeps their momentum so they actually slide
 updateHero(dt){
  for(const zn of Array.from(this.zones.values())){
   zn.t-=dt;zn.tick-=dt;
   if(zn.tick<=0){
    if(zn.k==='pizza'||zn.k==='station'){zn.tick=BAL.healTick;
     for(const t of this.list){if(!t.alive||t.drop||t.team!==zn.tm)continue;const dx=t.pos.x-zn.x,dz=t.pos.z-zn.z;if(dx*dx+dz*dz>zn.r*zn.r||Math.abs(t.pos.y-zn.y)>2.6)continue;
      this.healHost(t,zn.hps*BAL.healTick*this.foodHealMul(t),zn.o)}}
    else if(zn.k==='banana'){zn.tick=BAL.slipTick;
     for(const t of this.list){if(!t.alive||t.drop||t.team===zn.tm||!t.grounded||(t.slipImm||0)>this.t)continue;const dx=t.pos.x-zn.x,dz=t.pos.z-zn.z;if(dx*dx+dz*dz>zn.r*zn.r||Math.abs(t.pos.y-zn.y)>1.6)continue;
      this.slipApply(t,JB.food.banana.slip);this.emit({k:'snd',n:'slip',p:[t.pos.x,t.pos.y,t.pos.z]})}}
    else zn.tick=1}
   if(zn.t<=0){this.emit({k:'zn-',id:zn.id});this.zones.delete(zn.id)}}
  this.updatePans(dt)},
 // ------------------------------------------------------------------ boomerang pan
 spawnPan(e,yaw){
  const P=JB.pan,id=this.nextPanId++,dx=-Math.sin(yaw),dz=-Math.cos(yaw),x=e.pos.x+dx*.8,z=e.pos.z+dz*.8,y=e.pos.y+P.height;
  this.pans.push({id,o:e.id,tm:e.team,x,y,z,dx,dz,ph:0,dist:0,age:0,hit:new Set()});this.emit({k:'pn+',id,o:e.id,x,y,z,dx,dz})},
 panTurn(p,wall){p.ph=1;p.hit=new Set();this.emit({k:'pn~',id:p.id,x:p.x,y:p.y,z:p.z,w:wall?1:0});if(wall)this.emit({k:'snd',n:'clang',p:[p.x,p.y,p.z],g:.6})},
 updatePans(dt){
  const P=JB.pan;
  for(let i=this.pans.length-1;i>=0;i--){
   const p=this.pans[i],o=this.ents.get(p.o);p.age+=dt;let end=0;
   if(p.ph===0){
    const step=P.speedOut*dt,wh=W.rayWorld(p.x,p.y,p.z,p.dx,0,p.dz,step+.5);
    if(wh&&wh.kind!=='ground'&&wh.t<step+.35){const adv=Math.max(0,wh.t-.35);p.x+=p.dx*adv;p.z+=p.dz*adv;this.panTurn(p,true)}
    else{p.x+=p.dx*step;p.z+=p.dz*step;p.dist+=step;if(p.dist>=P.range)this.panTurn(p,false)}
    p.y=W.groundAt(p.x,p.z,p.y,.3,1)+P.height;
   }else if(!o||!o.alive)end=2;
   else{const dx=o.pos.x-p.x,dy=o.pos.y+1.2-p.y,dz=o.pos.z-p.z,d=Math.hypot(dx,dy,dz);
    if(d<P.catchR)end=1;else{const st=Math.min(d,P.speedBack*dt);p.x+=dx/d*st;p.y+=dy/d*st;p.z+=dz/d*st}}
   if(!end&&p.age>P.life)end=2;
   if(!end)this.panHits(p,o);
   if(end){this.emit({k:'pn-',id:p.id,c:end===1?1:0,x:p.x,y:p.y,z:p.z});if(end===1)this.emit({k:'snd',n:'catch',p:[p.x,p.y,p.z]});this.pans.splice(i,1)}}},
 panHits(p,o){
  const P=JB.pan;
  for(const t of this.list){if(!t.alive||t.drop==='bus'||t.id===p.o||t.team===p.tm||p.hit.has(t.id))continue;
   const dx=t.pos.x-p.x,dz=t.pos.z-p.z;if(dx*dx+dz*dz>(P.hitR+.46)*(P.hitR+.46)||Math.abs(p.y-(t.pos.y+.9))>1.5)continue;
   p.hit.add(t.id);this.damage(t,p.ph===0?P.dmgOut:P.dmgBack,o,-11,false,[p.x,p.y,p.z]);
   const l=Math.hypot(dx,dz)||1;this.emit({k:'st',i:t.id,s:'kb',vx:dx/l*P.kb*.7+p.dx*P.kb*.3,vy:2.5,vz:dz/l*P.kb*.7+p.dz*P.kb*.3},t.id);
   this.emit({k:'vfx',t:'clang',x:p.x,y:p.y,z:p.z});this.emit({k:'snd',n:'clang',p:[p.x,p.y,p.z]})}},

 // ================================================================== bot brains
 botChill(e,d){
  if(e.cd[2]<=0&&d<CB.strike.range-.5&&this.findStrikeTarget(e,CB.strike.range)){this.useAbility(e,2);return}
  if(e.cd[1]<=0&&!(e.coldT>0)&&d<40){this.useAbility(e,1);return}
  if(e.cd[0]<=0&&!(e.cloakT>0)&&((d>12&&d<55)||e.hp<e.maxHp*.4))this.useAbility(e,0)},
 botJay(e,d){
  if(e.cd[0]<=0&&d>4&&d<JB.pan.range-2){this.useAbility(e,0);return}
  if(e.cd[1]<=0&&d>5&&d<30){this.useAbility(e,1);return}
  if(e.cd[2]<=0&&e.hp<e.maxHp*.6&&d>16)this.useAbility(e,2)},

 // ================================================================== visuals (every machine)
 vfxInit(){this.zones=new Map();this.zoneVis=new Map();this.pans=[];this.panVis=new Map();this.pops=[];this.slashes=[];this.nextZoneId=1;this.nextPanId=1},
 vfxCleanup(){
  for(const z of this.zones.values())if(z.mesh)this.dynamic.remove(z.mesh);
  for(const p of this.panVis.values())this.dynamic.remove(p.mesh);
  for(const p of this.pops)this.dynamic.remove(p.m);for(const s of this.slashes)this.dynamic.remove(s.g);
  this.zones.clear();this.panVis.clear();this.pans=[];this.pops=[];this.slashes=[];this.nextZoneId=1;this.nextPanId=1},
 addPop(P,emoji){
  const m=new THREE.Sprite(new THREE.SpriteMaterial({map:emojiTexture(emoji),transparent:true,depthWrite:false}));m.scale.set(1.3,1.3,1);m.position.copy(P);this.dynamic.add(m);this.pops.push({m,t:0,life:.95})},
 addSlash(P,back){
  const g=new THREE.Group();g.position.copy(P);g.lookAt(this.camera.position);
  const col=back?'#ffd23d':'#dff6ff',len=back?2.4:1.7;
  for(const a of[.75,-.75]){const m=new THREE.Mesh(new THREE.BoxGeometry(len,.09,.03),new THREE.MeshBasicMaterial({color:col,transparent:true,depthTest:false,fog:false}));m.rotation.z=a;m.renderOrder=9;g.add(m)}
  this.dynamic.add(g);this.slashes.push({g,t:0,life:.28,back})},
 vfx(ev){
  const fx=this.fx,au=this.audio,P=new THREE.Vector3(ev.x||0,ev.y||0,ev.z||0);
  switch(ev.t){
   case'poof':{fx.ring(P,2.8,'#9be0ff',.4);for(let i=0;i<10;i++){const a=rnd()*6.283,s=1+rnd()*2.2;fx.puff(P.x,P.y+.9,P.z,Math.cos(a)*s,.4+rnd()*1.2,Math.sin(a)*s,'#26334d',.8+rnd()*.5,1.1+rnd(),1.6,.7,-.4,1.6)}fx.burst(P.x,P.y+1,P.z,22,4.5,'#bff4ff',.7,-1.5);break}
   case'cold':{const e=this.ents.get(ev.i),p=e?e.pos:P;fx.ring(p,3.4,'#7fe0ff',.45);fx.ring(p,1.8,'#ffffff',.3);fx.burst(p.x,p.y+1,p.z,36,7,'#e8fbff',.75,2);fx.burst(p.x,p.y+1,p.z,22,5,'#4ac8ff',.6,1);break}
   case'dash':{const y=ev.y+1;for(let k=0;k<18;k++){const f=k/17,px=lerp(ev.x,ev.tx,f),pz=lerp(ev.z,ev.tz,f);
     fx.puff(px,y+(rnd()-.5)*.8,pz,(rnd()-.5),.3+rnd()*.4,(rnd()-.5),'#26334d',.5+rnd()*.3,.8+rnd()*.6,1.4,.55,0,1.8);
     fx.emit(px,y+(rnd()-.5)*.9,pz,(rnd()-.5)*2,(rnd()-.5)*2,(rnd()-.5)*2,'#bff4ff',.45,0,.2,-.6,.8)}break}
   case'stab':{this.addSlash(P,!!ev.b);fx.burst(P.x,P.y,P.z,ev.b?34:18,ev.b?9:6,ev.b?'#ffd23d':'#dff6ff',.4,8);fx.burst(P.x,P.y,P.z,ev.b?18:8,6,'#ff4a6a',.35,8);fx.ring(P.clone().setY(P.y-1),ev.b?3:2,ev.b?'#ffd23d':'#9be0ff',.35);
    if(ev.b&&ev.o===this.myId)this.hud.toast('BACKSTAB!','#ffd23d');if(ev.i===this.myId)this.view.shake=Math.min(1,this.view.shake+.35);break}
   case'anim':{const e=this.ents.get(ev.i);if(e&&!e.local){e.anim=ev.a;e.animDur=e.animT=ev.d||.35}break}
   case'pop':this.addPop(P,ev.e);break;
   case'splat':{fx.burst(P.x,P.y,P.z,14,4,ev.c||'#d9892b',.5,10);fx.puff(P.x,P.y,P.z,0,.5,0,ev.c||'#d9892b',.5,1,1.5,.5,0,2);break}
   case'clang':{fx.spark(P.x,P.y,P.z,0,1,0,'#fff3c0');fx.burst(P.x,P.y,P.z,14,6,'#ffffff',.25,6);fx.ring(P.clone().setY(P.y-.1),1.8,'#ffe9a0',.22);break}
  }},
 healFx(ev){
  const t=this.ents.get(ev.t);if(!t)return;const fx=this.fx;
  fx.burst(t.pos.x,t.pos.y+1.1,t.pos.z,10,2.5,'#6cff8a',.8,-2.5);
  if(ev.n&&(ev.t===this.myId||ev.by===this.myId)&&ev.a>=.5)this.hud.healNumber(new THREE.Vector3(t.pos.x,t.pos.y+2,t.pos.z),ev.a);
  if(ev.t===this.myId&&this.t-(this._hs||-9)>.9){this._hs=this.t;this.audio.play('heal',null,.5)}},
 addPanVis(ev){
  const m=panModel();m.position.set(ev.x,ev.y,ev.z);this.dynamic.add(m);
  this.panVis.set(ev.id,{id:ev.id,mesh:m,o:ev.o,x:ev.x,y:ev.y,z:ev.z,dx:ev.dx,dz:ev.dz,ph:0,dist:0,tr:0,snd:0})},
 turnPanVis(ev){const p=this.panVis.get(ev.id);if(p){p.ph=1;p.x=ev.x;p.y=ev.y;p.z=ev.z}},
 removePanVis(ev){const p=this.panVis.get(ev.id);if(!p)return;this.dynamic.remove(p.mesh);this.panVis.delete(ev.id);
  if(ev.c){this.fx.ring(new THREE.Vector3(ev.x,ev.y-.8,ev.z),1.4,'#ffe9a0',.25);this.fx.burst(ev.x,ev.y,ev.z,12,3,'#fff3c0',.4,2);const o=this.ents.get(p.o);if(o)o.punch=1}},
 addZoneVis(ev){
  let zn=this.zones.get(ev.id);if(!zn){zn={id:ev.id,k:ev.n,x:ev.x,y:ev.y,z:ev.z,r:ev.r,t:ev.d,life:ev.d,o:ev.o,tick:0};this.zones.set(ev.id,zn)}
  const g=new THREE.Group(),r=zn.r,heal=zn.k!=='banana';
  const ringMat=new THREE.MeshBasicMaterial({color:heal?'#6cff8a':'#ffe14a',transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false,fog:false,polygonOffset:true,polygonOffsetFactor:-2});
  const discMat=new THREE.MeshBasicMaterial({color:heal?'#9dffb0':'#ffe14a',transparent:true,opacity:zn.k==='banana'?.55:.16,side:THREE.DoubleSide,depthWrite:false,fog:false,polygonOffset:true,polygonOffsetFactor:-1});
  const ring=new THREE.Mesh(new THREE.RingGeometry(r-.2,r,56),ringMat),disc=new THREE.Mesh(new THREE.CircleGeometry(r,48),discMat);
  ring.rotation.x=disc.rotation.x=-Math.PI/2;ring.position.y=.1;disc.position.y=.09;g.add(disc);g.add(ring);
  if(zn.k==='pizza'){const p=pizzaWhole();p.position.y=.1;g.add(p)}
  else if(zn.k==='station'){const s=stoveModel();s.position.y=.02;g.add(s)}
  else{disc.scale.set(1,1,1+(ev.id%3)*.06);for(let i=0;i<5;i++){const b=bananaModel();const a=i/5*6.283+.4,rr=r*.5*(.5+(i%2)*.5);b.position.set(Math.cos(a)*rr,.12,Math.sin(a)*rr);b.rotation.set(-Math.PI/2,0,a*2);b.scale.setScalar(1.1);g.add(b)}}
  g.position.set(zn.x,zn.y,zn.z);zn.mesh=g;zn.ringMat=ringMat;zn.discMat=discMat;zn.pt=0;zn.base=zn.k==='banana'?.55:.16;this.dynamic.add(g);
  if(zn.k==='station')this.fx.ring(new THREE.Vector3(zn.x,zn.y,zn.z),r,'#6cff8a',.5)},
 removeZoneVis(id){const z=this.zones.get(id);if(!z)return;if(z.mesh)this.dynamic.remove(z.mesh);this.zones.delete(id)},
 updateHeroVis(dt){
  const fx=this.fx,t=this.t,cam=this.camera.position;
  // boomerang pans
  for(const p of Array.from(this.panVis.values())){
   if(this.role!=='client'){const q=this.pans.find(s=>s.id===p.id);if(q){p.x=q.x;p.y=q.y;p.z=q.z;p.ph=q.ph}}
   else if(p.ph===0){const st=JB.pan.speedOut*dt;p.x+=p.dx*st;p.z+=p.dz*st;p.dist+=st;if(p.dist>=JB.pan.range)p.ph=1}
   else{const o=this.ents.get(p.o);if(o){const dx=o.rpos.x-p.x,dy=o.rpos.y+1.2-p.y,dz=o.rpos.z-p.z,d=Math.hypot(dx,dy,dz)||1,st=Math.min(d,JB.pan.speedBack*dt);p.x+=dx/d*st;p.y+=dy/d*st;p.z+=dz/d*st}}
   p.mesh.position.set(p.x,p.y,p.z);p.mesh.rotation.y+=dt*(p.ph?-24:24);p.mesh.rotation.x=.22;
   p.tr-=dt;if(p.tr<=0){p.tr=.025;fx.puff(p.x,p.y,p.z,(rnd()-.5),(rnd()-.5)*.6,(rnd()-.5),'#9aa0a8',.3,.45,1.4,.35,0,2);if(rnd()<.5)fx.emit(p.x,p.y,p.z,(rnd()-.5)*3,(rnd()-.5)*3,(rnd()-.5)*3,'#fff3c0',.25,0,.16,-.6,.9)}
   p.snd-=dt;if(p.snd<=0){p.snd=.22;this.audio.play('whoosh',p.mesh.position,.5)}}
  // zones
  for(const z of Array.from(this.zones.values())){
   if(!z.mesh)continue;if(this.role==='client'){z.t-=dt;if(z.t<-1.5){this.removeZoneVis(z.id);continue}}
   const fade=clamp(z.t/.6,0,1),pulse=.5+.5*Math.sin(t*4+z.id);
   z.ringMat.opacity=(.45+.3*pulse)*fade;z.discMat.opacity=z.base*(.8+.4*pulse)*fade;z.mesh.scale.setScalar(.9+.1*fade);
   const dx=z.x-cam.x,dz=z.z-cam.z;if(dx*dx+dz*dz>90*90)continue;
   z.pt-=dt;if(z.pt>0)continue;
   if(z.k==='banana'){z.pt=.16;const a=rnd()*6.283,r=Math.sqrt(rnd())*z.r*.9;fx.emit(z.x+Math.cos(a)*r,z.y+.2,z.z+Math.sin(a)*r,0,.5,0,'#ffffff',.5,0,.22,-.6,.9)}
   else{z.pt=.1;const a=rnd()*6.283,r=Math.sqrt(rnd())*z.r*.9;fx.emit(z.x+Math.cos(a)*r,z.y+.3,z.z+Math.sin(a)*r,0,1.4+rnd(),0,'#6cff8a',1,0,.3,-.4,.2);
    if(z.k==='station'){fx.puff(z.x+(rnd()-.5)*.5,z.y+1.8,z.z+(rnd()-.5)*.5,(rnd()-.5)*.4,1.2,(rnd()-.5)*.4,'#ffffff',1.1,.7,1.8,.55,0,.8);const pot=z.mesh.getObjectByName('pot');if(pot)pot.position.y=.98+Math.abs(Math.sin(t*9))*.03}
    else fx.puff(z.x,z.y+.4,z.z,(rnd()-.5)*.3,.9,(rnd()-.5)*.3,'#fff6d8',.9,.5,1.6,.4,0,.8)}}
  // emoji pops
  for(let i=this.pops.length-1;i>=0;i--){const p=this.pops[i];p.t+=dt;const k=p.t/p.life;p.m.position.y+=dt*1.2*(1-k);p.m.material.opacity=k<.7?1:1-(k-.7)/.3;const s=1.3*(k<.15?k/.15*1.25:1.25-(k-.15)*.3);p.m.scale.set(s,s,1);
   if(k>=1){this.dynamic.remove(p.m);p.m.material.dispose();this.pops.splice(i,1)}}
  // backstab slashes
  for(let i=this.slashes.length-1;i>=0;i--){const s=this.slashes[i];s.t+=dt;const k=s.t/s.life;s.g.scale.setScalar(.6+k*.7);s.g.lookAt(cam);for(const m of s.g.children)m.material.opacity=1-k;
   if(k>=1){this.dynamic.remove(s.g);this.slashes.splice(i,1)}}
 },
};
