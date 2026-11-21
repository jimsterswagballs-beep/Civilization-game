// Knocked, revive, reboot cards and reboot vans (team modes only).
// The host decides everything: knocks, revives, card pickups, van reboots. Clients get the state
// through snapshots (flags, cards, vans) and events (ntf, rb).
import * as THREE from 'three';
import {WEAPONS,mulberry32} from './data.js';
import * as W from './world.js';

export const KNOCK_BIT=524288;           // flag bit in packFlags/unpackFlags
export const KNOCK_T=30;                 // seconds a knocked player has before they are eliminated
export const REVIVE_T=4;                 // seconds a teammate must hold interact to revive
export const REVIVE_HP=30;               // health a revived player comes back with
export const REVIVE_RANGE=2.6;
export const CARD_T=120;                 // seconds a reboot card stays recoverable
export const CARD_RANGE=2.4;
export const VAN_COUNT=5;
export const VAN_T=8;                    // seconds a van takes to reboot someone
export const VAN_COOL=60;                // seconds before a used van can be used again
export const VAN_RANGE=4.5;
export const REBOOT_HP=50;               // health a rebooted player comes back with
export const CRAWL=1.6;                  // crawl speed in m/s
const VAN_READY=0,VAN_ACTIVE=1,VAN_COOLING=2;

const d2=(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz);

export const knockMethods={
 // ------------------------------------------------------------------ setup
 setupFields(){
  this.cards=new Map();this.vans=new Map();this.nextCardId=1;this.fieldMeshes=new Map();
  if(!this.teamMode)return;
  const rng=mulberry32(this.seed+555);const pts=[];
  for(let tries=0;tries<900&&pts.length<VAN_COUNT;tries++){
   const a=rng()*6.283,r=60+Math.sqrt(rng())*(W.ISL*.8);const x=Math.cos(a)*r,z=Math.sin(a)*r;
   if(W.H(x,z)<1.2)continue;
   if(W.buildings.some(b=>Math.abs(x-b.x)<b.w/2+4&&Math.abs(z-b.z)<b.d/2+4))continue;
   if(pts.some(p=>Math.hypot(p.x-x,p.z-z)<120))continue;
   pts.push({x,z,y:W.H(x,z)});
  }
  pts.forEach((p,i)=>this.vans.set(i+1,{id:i+1,x:p.x,y:p.y,z:p.z,state:VAN_READY,t:0,cdT:0,user:-1,card:-1}));
 },

 // a standing player is alive and not knocked
 teamStands(team){for(const e of this.list)if(e.team===team&&e.alive&&!e.knocked)return true;return false},

 // ------------------------------------------------------------------ knocked
 canKnock(t){return !!this.teamMode&&t.alive&&!t.knocked&&!t.drop},
 knockEnt(t,by,wid){
  t.knocked=true;t.hp=0;t.kT=KNOCK_T;t.reviver=-1;t.reviveT=0;t.use=null;t.aiming=false;t.holdI=false;
  t.knockBy=by?by.id:-1;t.knockWid=wid;
  this.emit({k:'ntf',tm:t.team,c:'#ff8a8a',t:`${t.name} is knocked!`});
 },
 reviveEnt(t,r){
  t.knocked=false;t.hp=REVIVE_HP;t.sh=0;t.kT=0;t.reviver=-1;t.reviveT=0;t.lastHit=this.t;
  this.emit({k:'ntf',tm:t.team,c:'#7bff9a',t:`${r.name} revived ${t.name}`});
 },
 // nearest standing teammate holding interact within reach of a knocked player
 nearestReviver(k){
  let best=null,bd=REVIVE_RANGE;
  for(const r of this.list){
   if(r===k||r.team!==k.team||!r.alive||r.knocked||!r.holdI)continue;
   const d=d2(r.pos.x,r.pos.z,k.pos.x,k.pos.z);if(d<bd&&Math.abs(r.pos.y-k.pos.y)<2.5){bd=d;best=r}
  }
  return best;
 },
 // a team with nobody standing is out: its knocked players are finished off
 resolveTeams(){
  const teams=new Map();
  for(const e of this.list){if(!e.alive)continue;let g=teams.get(e.team);if(!g){g={stand:0,kn:[]};teams.set(e.team,g)}if(e.knocked)g.kn.push(e);else g.stand++}
  for(const g of teams.values())if(g.stand===0)for(const k of g.kn)this.killEnt(k,k.knockBy>=0?this.ents.get(k.knockBy):null,k.knockWid,false);
 },

 // host: knock timers, revive progress, cards and vans, and interact presses
 tickKnock(dt){
  for(const k of this.list){
   if(!k.alive||!k.knocked)continue;
   k.kT-=dt;
   if(k.kT<=0){this.killEnt(k,k.knockBy>=0?this.ents.get(k.knockBy):null,k.knockWid,false);continue}
   const r=this.nearestReviver(k);
   if(!r){k.reviver=-1;k.reviveT=0;continue}
   if(r.id!==k.reviver){k.reviver=r.id;k.reviveT=0}
   if(r.lastHit>=this.t-dt-1e-6){k.reviver=-1;k.reviveT=0;continue}   // the reviver was hit: the revive is interrupted
   k.reviveT+=dt;
   if(k.reviveT>=REVIVE_T)this.reviveEnt(k,r);
  }
  for(const e of this.list){
   if(!e.alive)continue;
   const press=!!e.holdI&&!e.holdPrev;e.holdPrev=!!e.holdI;
   if(press&&!e.knocked&&!e.drop)this.interactAt(e);
  }
  this.resolveTeams();
  this.tickCards(dt);
  this.tickVans(dt);
 },

 // ------------------------------------------------------------------ cards
 // an eliminated player leaves a reboot card if a teammate is still standing; carried cards fall with their carrier
 dropCard(t){
  for(const c of this.cards.values())if(c.carrier===t.id){c.carrier=-1;c.x=t.pos.x;c.y=t.pos.y;c.z=t.pos.z}
  if(this.teamMode&&this.teamStands(t.team)){
   const id=this.nextCardId++;
   this.cards.set(id,{id,owner:t.id,team:t.team,x:t.pos.x,y:t.pos.y,z:t.pos.z,carrier:-1,t:CARD_T});
  }
 },
 tickCards(dt){
  for(const c of [...this.cards.values()]){
   c.t-=dt;
   const owner=this.ents.get(c.owner);
   // gone when it expires, its owner is back in the match, or the owner's team is out
   if(c.t<=0||!owner||owner.alive||!this.teamStands(c.team)){this.cards.delete(c.id);continue}
   if(c.carrier>=0){const car=this.ents.get(c.carrier);if(car&&!car.alive){c.carrier=-1;c.x=car.pos.x;c.y=car.pos.y;c.z=car.pos.z}}
  }
 },
 // press interact: first a van for a card you carry, otherwise a card lying nearby
 interactAt(e){
  const carried=[...this.cards.values()].filter(c=>c.carrier===e.id);
  if(carried.length){
   for(const v of this.vans.values()){
    if(v.state!==VAN_READY||d2(e.pos.x,e.pos.z,v.x,v.z)>VAN_RANGE)continue;
    const c=carried[0];v.state=VAN_ACTIVE;v.t=VAN_T;v.user=e.id;v.card=c.id;
    const owner=this.ents.get(c.owner);
    this.emit({k:'ntf',tm:e.team,c:'#6dff7a',t:`${e.name} is rebooting ${owner?owner.name:'a teammate'}…`});
    return;
   }
  }
  let best=null,bd=CARD_RANGE;
  for(const c of this.cards.values()){
   if(c.carrier>=0||c.team!==e.team)continue;
   const d=d2(e.pos.x,e.pos.z,c.x,c.z);if(d<bd){bd=d;best=c}
  }
  if(best){
   best.carrier=e.id;const owner=this.ents.get(best.owner);
   this.emit({k:'ntf',tm:e.team,c:'#7fe9ff',t:`${e.name} picked up ${owner?owner.name:'a'}'s reboot card`});
  }
 },

 // ------------------------------------------------------------------ vans
 tickVans(dt){
  for(const v of this.vans.values()){
   if(v.state===VAN_COOLING){v.cdT-=dt;if(v.cdT<=0)v.state=VAN_READY;continue}
   if(v.state!==VAN_ACTIVE)continue;
   const user=this.ents.get(v.user),card=this.cards.get(v.card);
   // the carrier must stay alive and close to the van; otherwise the reboot is cancelled and the card goes back
   if(!user||!user.alive||user.knocked||!card||d2(user.pos.x,user.pos.z,v.x,v.z)>VAN_RANGE+1){
    if(card){if(user&&user.alive&&!user.knocked){card.carrier=user.id}else{card.carrier=-1;card.x=v.x;card.y=v.y;card.z=v.z}}
    v.state=VAN_READY;v.user=-1;v.card=-1;v.t=0;continue;
   }
   v.t-=dt;
   if(v.t>0)continue;
   const target=this.ents.get(card.owner);
   this.cards.delete(card.id);
   if(target&&!target.alive&&this.teamStands(target.team))this.rebootEnt(target,v,user);
   else this.emit({k:'ntf',tm:user.team,c:'#ffd23d',t:'Reboot failed: nobody left to reboot'});
   v.state=VAN_COOLING;v.cdT=VAN_COOL;v.user=-1;v.card=-1;v.t=0;
  }
 },
 // bring an eliminated player back next to the van, with limited health and a pistol
 rebootEnt(t,v,user){
  const x=v.x+2.2,z=v.z;const y=W.H(x,z);
  t.alive=true;t.knocked=false;t.drop=null;t.deadT=0;t.hp=REBOOT_HP;t.sh=0;t.ts=0;t.kT=0;t.reviver=-1;t.reviveT=0;t.lastHit=this.t;
  t.pos.set(x,y,z);t.rpos.copy(t.pos);t.tgt.x=x;t.tgt.y=y;t.tgt.z=z;t.vel.set(0,0,0);t.grounded=true;
  const pistol=WEAPONS.findIndex(w=>w.n==='Pistol');
  t.inv=[{k:'w',w:0,r:0,mag:0},{k:'w',w:pistol,r:0,mag:15},null,null,null,null];t.cur=1;t.equipT=.3;
  t.ammo={light:30,med:0,shells:0,heavy:0,rockets:0};t.fireCd=0;t.reload=0;t.use=null;
  t.cloakT=0;t.coldT=0;t.slowT=0;t.cookT=0;t.energyT=0;t.spicyT=0;t.buffT=0;t.auraT=0;t.dance=0;t.eatT=0;t.stun=0;t.slip=0;
  if(t.ai){t.ai.mode='loot';t.ai.goal=null;t.ai.path=null;t.ai.lootT=null}
  this.emit({k:'rb',v:t.id,tm:t.team,x,y,z,by:user.id});
  this.emit({k:'ntf',tm:t.team,c:'#ffd23d',t:`${user.name} rebooted ${t.name}!`});
 },

 // what the local player can do right now (shown as the prompt when nothing else is nearby)
 knockPrompt(me){
  if(!me.alive||me.knocked)return null;
  for(const o of this.list){
   if(o===me||!o.alive||!o.knocked||o.team!==me.team)continue;
   if(d2(me.pos.x,me.pos.z,o.pos.x,o.pos.z)<REVIVE_RANGE)return `Hold E to revive ${o.name}`;
  }
  for(const c of this.cards.values()){
   if(c.carrier<0&&c.team===me.team&&d2(me.pos.x,me.pos.z,c.x,c.z)<CARD_RANGE){const o=this.ents.get(c.owner);return `Press E to pick up ${o?o.name:'a'}'s reboot card`}
  }
  if([...this.cards.values()].some(c=>c.carrier===me.id)){
   for(const v of this.vans.values())if(v.state===VAN_READY&&d2(me.pos.x,me.pos.z,v.x,v.z)<VAN_RANGE)return 'Press E to reboot a teammate'
  }
  return null;
 },

 // ------------------------------------------------------------------ client state
 applyFieldSnap(m){
  const cards=new Map();
  for(const c of m.cs)cards.set(c[0],{id:c[0],owner:c[1],x:c[2],y:c[3],z:c[4],carrier:c[5],t:c[6]});
  this.cards=cards;
  for(const v of m.vs){const o=this.vans.get(v[0]);if(o){o.state=v[1];o.t=v[2]/10;o.cdT=v[3];o.user=v[4]}}
 },

 // ------------------------------------------------------------------ meshes (both host and clients)
 syncFieldVis(){
  if(!this.dynamic||!this.fieldMeshes)return;
  const t=this.t;
  for(const v of this.vans.values()){
   let m=this.fieldMeshes.get('v'+v.id);
   if(!m){m=makeVanModel();m.position.set(v.x,v.y,v.z);m.rotation.y=v.id*1.3;this.dynamic.add(m);this.fieldMeshes.set('v'+v.id,m)}
   const col=v.state===VAN_READY?'#4dfcff':v.state===VAN_ACTIVE?'#6dff7a':'#555a66';
   m.userData.lamp.material.color.set(col);
   m.userData.lamp.visible=v.state!==VAN_COOLING||Math.sin(t*6)>0;
   m.userData.ring.material.color.set(col);
   m.userData.ring.material.opacity=v.state===VAN_READY?.5+.25*Math.sin(t*3):v.state===VAN_ACTIVE?.9:.15;
   m.userData.ring.scale.setScalar(v.state===VAN_ACTIVE?1+.08*Math.sin(t*10):1);
  }
  for(const c of this.cards.values()){
   let m=this.fieldMeshes.get('c'+c.id);
   if(!m){m=makeCardModel();this.dynamic.add(m);this.fieldMeshes.set('c'+c.id,m)}
   let x=c.x,y=c.y,z=c.z;
   if(c.carrier>=0){const car=this.ents.get(c.carrier);if(car){x=car.pos.x+.45;y=car.pos.y+1.2;z=car.pos.z}}
   else y=c.y+.3+Math.sin(t*3+c.id)*.12;
   m.position.set(x,y,z);m.rotation.y=t*2;
  }
  for(const [k,m] of [...this.fieldMeshes]){
   if(k[0]==='c'&&!this.cards.has(+k.slice(1))){this.dynamic.remove(m);this.fieldMeshes.delete(k)}
  }
 },
};

function makeCardModel(){
 const g=new THREE.Group();
 const card=new THREE.Mesh(new THREE.BoxGeometry(.6,.85,.05),new THREE.MeshLambertMaterial({color:'#f7f7fb',emissive:'#2a3550'}));g.add(card);
 const red=new THREE.MeshBasicMaterial({color:'#ff4d4d'});
 const bar1=new THREE.Mesh(new THREE.BoxGeometry(.36,.08,.06),red);bar1.position.z=.01;g.add(bar1);
 const bar2=new THREE.Mesh(new THREE.BoxGeometry(.08,.36,.06),red);bar2.position.z=.01;g.add(bar2);
 const glow=new THREE.Mesh(new THREE.RingGeometry(.42,.6,24),new THREE.MeshBasicMaterial({color:'#7fe9ff',transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}));
 glow.rotation.x=-Math.PI/2;glow.position.y=-.45;g.add(glow);
 return g;
}
function makeVanModel(){
 const g=new THREE.Group();
 const body=new THREE.Mesh(new THREE.BoxGeometry(2.6,2.2,4.6),new THREE.MeshLambertMaterial({color:'#eceef5'}));body.position.y=1.6;g.add(body);
 const stripe=new THREE.Mesh(new THREE.BoxGeometry(2.64,.3,4.64),new THREE.MeshLambertMaterial({color:'#e2432b'}));stripe.position.y=1.7;g.add(stripe);
 const wheel=new THREE.MeshLambertMaterial({color:'#20232a'});
 for(const [x,z] of [[-1.25,-1.5],[1.25,-1.5],[-1.25,1.5],[1.25,1.5]]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,.3,12),wheel);w.rotation.z=Math.PI/2;w.position.set(x,.45,z);g.add(w)}
 const lamp=new THREE.Mesh(new THREE.SphereGeometry(.28,10,8),new THREE.MeshBasicMaterial({color:'#4dfcff'}));lamp.position.y=3.1;g.add(lamp);
 const ring=new THREE.Mesh(new THREE.RingGeometry(3,3.5,32),new THREE.MeshBasicMaterial({color:'#4dfcff',transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false}));
 ring.rotation.x=-Math.PI/2;ring.position.y=.1;g.add(ring);
 g.userData={lamp,ring};
 return g;
}
