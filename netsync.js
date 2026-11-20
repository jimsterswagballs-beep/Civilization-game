import * as THREE from 'three';
import {WEAPONS,CHARS,clamp,lerp} from './data.js';
import {wstat} from './shared.js';
const r2=v=>Math.round(v*100)/100;
export const netMethods={
 netTick(dt){
  const a=this.accum;
  if(this.role==='client'){
   a.net+=dt;if(a.net>=1/20){a.net=0;const m=this.me;this.net.toHost({t:'p',x:r2(m.pos.x),y:r2(m.pos.y),z:r2(m.pos.z),yw:r2(m.yaw),pt:r2(m.pitch),f:this.packFlags(m),w:m.wi,vx:r2(m.vel.x),vz:r2(m.vel.z)})}
   return}
  // host
  if(this.net.peers&&this.net.peers.size>0){
   a.snap+=dt;if(a.snap>=1/16){a.snap=0;const s=this.storm;
    const es=[];for(const e of this.list)es.push([e.id,r2(e.pos.x),r2(e.pos.y),r2(e.pos.z),r2(e.yaw),r2(e.pitch),e.bot?this.packFlags(e):e.flags,e.wi,Math.round(e.hp),Math.round(e.sh),Math.round(e.ts),e.alive?1:0,e.kills,e.bot?1:0,r2(e.vel.x),r2(e.vel.z)]);
    this.net.broadcast({t:'s',tm:r2(this.t),bt:r2(this.bus.t),e:es,st:[s.phase,s.state,r2(s.cx),r2(s.cz),r2(s.r),r2(s.tcx),r2(s.tcz),r2(s.tr),r2(s.t),s.dmg||0],ev:this.outEvents.length?this.outEvents:undefined,sp:this.supplyT});this.outEvents=[]}
   else if(this.outEvents.length>40){this.net.broadcast({t:'ev',e:this.outEvents});this.outEvents=[]}
  }else this.outEvents=[];
 },
 onNetMessage(from,m){
  if(this.role==='client'){
   if(m.t==='s'){this.applySnapshot(m);if(m.ev)for(const ev of m.ev)this.handleEvent(ev)}
   else if(m.t==='ev'){for(const ev of m.e)this.handleEvent(ev)}
   return}
  // host
  const e=this.list.find(x=>x.peer===from);if(!e||!e.alive&&m.t!=='p')return;
  switch(m.t){
   case'p':{if(!e.alive)return;e.tgt.x=m.x;e.tgt.y=m.y;e.tgt.z=m.z;e.tgt.yaw=m.yw;e.tgt.pitch=m.pt;e.vel.x=m.vx||0;e.vel.z=m.vz||0;this.unpackFlags(e,m.f);e.wi=m.w;if(e.drop==='bus'&&!(m.f&64)){e.drop=m.f&16?'free':'glide'}break}
   case'fire':{if(m.w<0||!m.d||m.d.length>60)return;const wd=wstat(Math.floor(m.w/10),m.w%10);if(!wd)return;
    const dx=m.o[0]-e.pos.x,dz=m.o[2]-e.pos.z;let o=m.o;if(dx*dx+dz*dz>25||Math.abs(m.o[1]-e.pos.y)>5)o=[e.pos.x,e.pos.y+1.65,e.pos.z];
    if(this.t-(e.lastFireT||0)<.4/Math.max(1,wd.rps*1.6))return;e.lastFireT=this.t;e.shootT=.12;
    this.hostFire(e,o,m.d.slice(0,wd.pellets*3),wd,m.w);break}
   case'melee':{const wd=wstat(Math.floor(m.w/10),m.w%10);if(!wd||!wd.melee)return;this.hostMelee(e,wd,m.y,m.p,e.pos.x,e.pos.y+1.5,e.pos.z,m.w);break}
   case'pick':{const l=this.loot.get(m.id);if(l)this.hostPick(e,l);break}
   case'drop':{if(m.item&&Math.hypot(m.x-e.pos.x,m.z-e.pos.z)<5)this.spawnLoot(m.item,m.x,m.z,m.y);break}
   case'heal':{e.hp=Math.min(e.maxHp,e.hp+clamp(m.hp||0,0,100));e.sh=Math.min(100,e.sh+clamp(m.sh||0,0,100));break}
   case'ab':this.abilityEffect(e,m.i,e.pos.x,e.pos.y,e.pos.z,m.yaw);break;
   case'slam':this.hostSlam(e,e.pos.x,e.pos.y,e.pos.z);break;
   case'trap':this.placeTrap(e,m.id,m.x,m.y,m.z);break;
   case'throw':this.throwItem(e,m.id,[e.pos.x,e.pos.y+1.6,e.pos.z],m.d);break;
  }
 },
 applySnapshot(m){
  const me=this.me;
  for(const a of m.e){const e=this.ents.get(a[0]);if(!e)continue;
   const wasAlive=e.alive;
   if(e===me){e.hp=a[8];e.sh=a[9];e.ts=a[10];e.kills=a[12];if(!a[11]&&e.alive){/* death handled via kill event */}}
   else{e.tgt.x=a[1];e.tgt.y=a[2];e.tgt.z=a[3];e.tgt.yaw=a[4];e.tgt.pitch=a[5];this.unpackFlags(e,a[6]);e.wi=a[7];e.hp=a[8];e.sh=a[9];e.ts=a[10];e.kills=a[12];e.vel.x=a[14]||0;e.vel.z=a[15]||0;e.vel.y=0;
    if(!a[11]&&e.alive){e.alive=false;e.deadT=0}}}
  const s=this.storm,st=m.st;s.phase=st[0];s.state=st[1];s.tcx=st[5];s.tcz=st[6];s.tr=st[7];s.t=st[8];s.dmg=st[9];
  s.cx=lerp(s.cx,st[2],.5);s.cz=lerp(s.cz,st[3],.5);s.r=lerp(s.r,st[4],.5);if(Math.abs(s.r-st[4])>30){s.r=st[4];s.cx=st[2];s.cz=st[3]}
  this.hostT=m.tm;this.supplyT=m.sp;
  // bus sync
  if(Math.abs(this.bus.t-m.bt)>.5)this.bus.t=m.bt;
 },
 updateClientSim(dt){
  // local timers that the host would normally tick for us
  const me=this.me;if(me.alive)this.abilityTick(me,dt);
  this.t=this.t; // client time advances locally
 },
};
