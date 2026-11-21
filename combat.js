import * as THREE from 'three';
import {WEAPONS,ITEMS,RARITY,CHARS,AMMO,BAL,clamp,lerp} from './data.js';
import {makeFoodMesh} from './abilities.js';
import * as W from './world.js';
import {R,HSTAND,HCROUCH,EYE,wstat} from './shared.js';
import {PHASES} from './game.js';
const _o=new THREE.Vector3(),_e=new THREE.Vector3();
function rayCyl(ox,oy,oz,dx,dy,dz,cx,cy,cz,r,h,maxT){
 const fx=ox-cx,fz=oz-cz,a=dx*dx+dz*dz;let t;
 if(a<1e-9){if(fx*fx+fz*fz>r*r)return Infinity;t=0}
 else{const b=2*(fx*dx+fz*dz),c=fx*fx+fz*fz-r*r;const disc=b*b-4*a*c;if(disc<0)return Infinity;const s=Math.sqrt(disc);t=(-b-s)/(2*a);if(t<0){if(c<=0)t=0;else return Infinity}}
 if(t>maxT)return Infinity;const y=oy+dy*t;if(y<cy||y>cy+h)return Infinity;return t}
function makeDroneMesh(){
 const g=new THREE.Group();
 const body=new THREE.Mesh(new THREE.SphereGeometry(.26,12,10),new THREE.MeshLambertMaterial({color:'#3a4a66'}));body.position.y=.45;g.add(body);
 const eye=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),new THREE.MeshBasicMaterial({color:'#ff3d3d'}));eye.position.set(0,.45,.24);g.add(eye);
 for(const[x,z]of[[.36,.36],[-.36,.36],[.36,-.36],[-.36,-.36]]){
  const rod=new THREE.Mesh(new THREE.BoxGeometry(.05,.05,.5),new THREE.MeshLambertMaterial({color:'#263247'}));rod.position.set(x/2,.45,z/2);rod.rotation.y=Math.atan2(x,z);g.add(rod);
  const rotor=new THREE.Group();rotor.name='rotor';rotor.position.set(x,.6,z);
  const b1=new THREE.Mesh(new THREE.BoxGeometry(.4,.02,.05),new THREE.MeshBasicMaterial({color:'#9be9ff'}));const b2=b1.clone();b2.rotation.y=Math.PI/2;rotor.add(b1,b2);g.add(rotor)}
 return g}
function makeShockMesh(){
 const g=new THREE.Group();
 const plate=new THREE.Mesh(new THREE.CylinderGeometry(.4,.44,.1,18),new THREE.MeshLambertMaterial({color:'#3a3f4d'}));plate.position.y=.05;g.add(plate);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.3,.04,6,20),new THREE.MeshLambertMaterial({color:'#ffe14a',emissive:'#806000'}));ring.rotation.x=Math.PI/2;ring.position.y=.12;g.add(ring);
 const bolt=new THREE.Mesh(new THREE.ConeGeometry(.1,.3,4),new THREE.MeshBasicMaterial({color:'#fff3a0'}));bolt.position.y=.27;g.add(bolt);
 return g}
export const combatMethods={
 packFlags(e){return (e.crouch?1:0)|(e.sliding?2:0)|(e.sprinting?4:0)|(e.grounded?8:0)|(e.drop==='free'?16:0)|(e.drop==='glide'?32:0)|(e.drop==='bus'?64:0)|(e.use||e.eatT>0?128:0)|(e.stun>0?256:0)|(e.auraT>0?512:0)|((e.buffT>0||e.ts>0)?1024:0)|(e.dance>0?2048:0)|(e.slip>0?8192:0)|(e.swim?16384:0)|(e.cloakT>0?4096:0)|(e.coldT>0?32768:0)|(e.slowT>0?65536:0)|(e.cookT>0?131072:0)|(e.spicyT>0?262144:0)|(e.knocked?524288:0)},
 unpackFlags(e,f){e.flags=f;e.crouch=!!(f&1);e.sliding=!!(f&2);e.sprinting=!!(f&4);e.grounded=!!(f&8);e.drop=(f&16)?'free':(f&32)?'glide':(f&64)?'bus':null;e.eatT=(f&128)?1:0;e.stun=(f&256)?1:0;e.auraT=(f&512)?1:0;e.buffT=(f&1024)?1:0;e.dance=(f&2048)?1:0;e.slip=(f&8192)?1:0;e.swim=!!(f&16384);e.cloakT=(f&4096)?1:0;e.coldT=(f&32768)?1:0;e.slowT=(f&65536)?1:0;e.cookT=(f&131072)?1:0;e.spicyT=(f&262144)?1:0;e.knocked=!!(f&524288)},
 eyeOf(e){return e.pos.y+(e.sliding?.85:e.crouch?1.1:1.65)},
 curWeapon(e){const c=e.inv[e.cur];return c&&c.k==='w'?wstat(c.w,c.r):null},
 hbH(e){return (e.crouch||e.sliding)?HCROUCH:HSTAND},
 // ================= weapon tick (all shooters)
 tickWeapon(e,c,dt){
  const slot=e.inv[e.cur];const v=this.view;
  e.fireCd=Math.max(0,e.fireCd-dt);e.equipT=Math.max(0,e.equipT-dt);e.bloom=Math.max(0,e.bloom-dt*.05);
  if(e.drop||!e.alive||e.stun>0||e.emote||e.slip>0||e.dance>0||e.eatT>0||e.cookT>0){e.aiming=false;if(e.use&&(e.slip>0||e.dance>0||e.stun>0))e.use=null;if(e.local)v.reloadK=0;return}
  // using item
  if(e.use){e.use.t-=dt;if(e.local)this.hud.useBar&&this.hud.useBar(e.use);
   if(c.cancel||e.inv[e.cur]!==e.use.slot){e.use=null}
   else if(e.use.t<=0){this.finishUse(e);e.use=null}
   e.aiming=false;return}
  // reload
  if(e.reload>0){e.reload-=dt;if(e.local)v.reloadK=Math.sin(Math.min(1,(1-e.reload/(e.reloadDur||1)))*Math.PI);
   if(e.reload<=0){const s=e.inv[e.cur];if(s&&s.k==='w'){const wd=wstat(s.w,s.r);const need=wd.mag-s.mag,have=e.ammo[wd.ammo];const n=Math.min(need,have);s.mag+=n;e.ammo[wd.ammo]-=n}e.reload=0;if(e.local)v.reloadK=0}
   e.aiming=false;if(!(c.fire&&slot&&slot.k==='w'&&WEAPONS[slot.w].t==='sg'&&slot.mag>0))return;e.reload=0;if(e.local)v.reloadK=0}
  if(!slot){e.aiming=false;return}
  if(slot.k==='i'){e.aiming=false;if(c.firePressed&&e.equipT<=0)this.startUseItem(e,slot);return}
  const wd=wstat(slot.w,slot.r);
  e.aiming=c.aim&&!e.sprinting&&!e.sliding&&e.equipT<=.1&&!wd.melee;
  if(c.reload&&!wd.melee&&slot.mag<wd.mag&&e.ammo[wd.ammo]>0&&e.reload<=0){e.reload=e.reloadDur=wd.reload;if(e.local)this.audio.play('reload');else this.audio.play('reload',e.pos,.5);return}
  if(e.equipT>0||e.fireCd>0)return;
  const want=wd.auto?c.fire:c.firePressed;if(!want)return;
  if(wd.melee){e.fireCd=1/(wd.rps*(e.auraT>0?1.5:1));this.doSwing(e,wd);return}
  if(slot.mag<=0){if(e.ammo[wd.ammo]>0&&e.reload<=0){e.reload=e.reloadDur=wd.reload;if(e.local)this.audio.play('reload')}else if(c.firePressed&&e.local){this.audio.play('empty');this.hud.toast('Out of ammo','#ff7a7a')}return}
  slot.mag--;e.fireCd=1/(wd.rps*(e.auraT>0?1.5:1));
  this.fireWeapon(e,slot,wd,c);
 },
 fireWeapon(e,slot,wd,c){
  const v=this.view;
  const sp=Math.hypot(e.vel.x,e.vel.z);
  let spread=wd.sp*(e.aiming?.3:1)*(1+Math.min(sp,9)*.05)*(e.grounded?1:2)*(e.crouch?.75:1)+e.bloom*.5;if(c.aimErr)spread+=c.aimErr;
  e.bloom=Math.min(.08,e.bloom+wd.rc*.0022);
  let yaw=e.yaw,pitch=e.pitch;
  if(e.local){yaw+=v.recoilY;pitch+=v.recoilP}
  const o=[e.pos.x,this.eyeOf(e),e.pos.z];const dirs=[];
  for(let i=0;i<wd.pellets;i++){
   let sx=0,sy=0;if(spread>0){const a=Math.random()*6.283,r=Math.sqrt(Math.random())*spread;sx=Math.cos(a)*r;sy=Math.sin(a)*r}
   if(wd.pellets===1&&spread>0&&e.local&&0)sx=sy=0;
   const yy=yaw+sx,pp=pitch+sy;const cp=Math.cos(pp);dirs.push(-Math.sin(yy)*cp,Math.sin(pp),-Math.cos(yy)*cp)}
  if(e.local){
   if(this.t-(v.lastShot||-9)>.45)e.shotIdx=0;e.shotIdx=(e.shotIdx||0)+1;v.lastShot=this.t;const ph=Math.sin(e.shotIdx*1.7)*(1-Math.exp(-e.shotIdx*.4));
   v.recoilP+=wd.rc*.0085*(e.aiming?.62:1)*(e.shotIdx<4?1.1:.9);v.recoilY+=ph*wd.rc*.0042*(e.aiming?.6:1);v.kick=Math.min(1,v.kick+wd.rc*.04);v.recoilKick=Math.min(1.6,(v.recoilKick||0)+wd.rc*.35);v.flash=.05;v.shake=Math.min(.5,v.shake+wd.rc*.006);
   this.audio.play(wd.quiet?'quiet':wd.laser?'laser':wd.t==='ar'?'ar':wd.t==='smg'?'smg':wd.t==='sg'?'sg':wd.t==='sn'?'sn':wd.t==='pi'?'pi':wd.t==='ex'?'launch':'fun',{x:o[0],y:o[1],z:o[2]},wd.quiet?.7:1);
   if(slot.mag<=0&&this.settings&&e.ammo[wd.ammo]>0&&e.reload<=0){}}
  e.shootT=.12;this.revealEnt(e);
  if(this.role==='client'&&e.local){this.net.toHost({t:'fire',o,d:dirs,w:e.wi});
   // local tracer prediction
   if(!wd.speed){const origin=new THREE.Vector3(o[0],o[1]-.15,o[2]);const dir=new THREE.Vector3(dirs[0],dirs[1],dirs[2]);const hit=W.rayWorld(o[0],o[1],o[2],dirs[0],dirs[1],dirs[2],wd.range);const t=hit?hit.t:wd.range;const col=wd.laser?'#ff3dff':'#ffe9a0';const n=Math.min(wd.pellets,6);for(let i=0;i<n;i++)this.fx.tracer(origin.clone().add(new THREE.Vector3(.2*Math.cos(e.yaw),0,-.2*Math.sin(e.yaw))),new THREE.Vector3(o[0]+dirs[i*3]*t,o[1]+dirs[i*3+1]*t,o[2]+dirs[i*3+2]*t),col)}
   return}
  this.hostFire(e,o,dirs,wd,e.wi);
 },
 hostFire(sh,o,dirs,wd,wi){
  const ox=o[0],oy=o[1],oz=o[2];
  if(wd.speed){ // projectile weapon
   const dx=dirs[0],dy=dirs[1],dz=dirs[2];
   const cm=this.dmgMulOf(sh);this.spawnProj(sh,ox+dx*.6,oy-.12+dy*.6,oz+dz*.6,dx*wd.speed,dy*wd.speed,dz*wd.speed,cm===1?wd:Object.assign({},wd,{dmg:wd.dmg*cm}),wi);
   this.emit({k:'sh',i:sh.id,w:wi>=0?Math.floor(wi/10):-1,o:[ox,oy-.1,oz]});return}
  const ends=[],imps=[];const n=wd.pellets;let didHit=new Set();
  for(let p=0;p<n;p++){
   const dx=dirs[p*3],dy=dirs[p*3+1],dz=dirs[p*3+2];
   let maxT=wd.range;const wh=W.rayWorld(ox,oy,oz,dx,dy,dz,maxT);if(wh)maxT=wh.t;
   let bestT=maxT,bestE=null,head=false;
   for(const t of this.list){if(t===sh||!t.alive||t.drop==='bus'||this.isAlly(sh,t))continue;const h=this.hbH(t);
    const tt=rayCyl(ox,oy,oz,dx,dy,dz,t.pos.x,t.pos.y,t.pos.z,.46,h,bestT);if(tt<bestT){bestT=tt;bestE=t;const hy=oy+dy*tt;head=hy>t.pos.y+h-.5}}
   if(!bestE&&wh)this.onWorldHit(sh,wh,wd,ox+dx*bestT,oy+dy*bestT,oz+dz*bestT);
   const ex=ox+dx*bestT,ey=oy+dy*bestT,ez=oz+dz*bestT;if(p<8)ends.push([ex,ey,ez]);
   if(bestE){
    let dmg=wd.dmg*(wd.pellets>1?1:1);const fall=wd.pellets>1||wd.t==='smg'?clamp(1.25-bestT/wd.range,.35,1):1;dmg*=fall;if(head)dmg*=wd.head;
    const acc=didHit.has(bestE)?didHit.get?0:0:0;
    this.damage(bestE,dmg*this.dmgMulOf(sh),sh,wi,head,[ex,ey,ez],wd.pellets>1);
    if(wd.kb){this.emit({k:'st',i:bestE.id,s:'kb',vx:dx*wd.kb,vy:wd.kb*.3,vz:dz*wd.kb},bestE.id)}
    if(wd.sp2==='confetti'&&Math.random()<.35)this.emit({k:'st',i:bestE.id,s:'dance',t:1.2},bestE.id);
    didHit.add(bestE)}
   else if(wh&&p<8)imps.push([ex,ey,ez,-dx,.4,-dz]);
  }
  this.emit({k:'sh',i:sh.id,w:wi>=0?Math.floor(wi/10):-1,o:[ox,oy-.12,oz],e:ends,im:imps});
 },
 doSwing(e,wd){
  const slot=e.inv[e.cur];if(e.local)this.view.kick=.6,this.view.recoilKick=1.2;e.shootT=.15;this.revealEnt(e);
  if(this.role==='client'&&e.local){this.net.toHost({t:'melee',w:e.wi,y:e.yaw,p:e.pitch,o:[e.pos.x,this.eyeOf(e),e.pos.z]});this.audio.play('melee');return}
  this.hostMelee(e,wd,e.yaw,e.pitch,e.pos.x,this.eyeOf(e),e.pos.z,e.wi)},
 hostMelee(e,wd,yaw,pitch,x,y,z,wi){
  const fx=-Math.sin(yaw),fz=-Math.cos(yaw);let hit=false;
  for(const t of this.list){if(t===e||!t.alive||t.drop==='bus'||this.isAlly(e,t))continue;const dx=t.pos.x-x,dz=t.pos.z-z,d=Math.hypot(dx,dz);if(d>wd.range+.5)continue;if(d>.6&&(dx*fx+dz*fz)/d<.45)continue;if(Math.abs(t.pos.y+.9-y)>2)continue;
   this.damage(t,wd.dmg*this.dmgMulOf(e),e,wi,false,[t.pos.x,t.pos.y+1.2,t.pos.z]);hit=true;
   this.emit({k:'st',i:t.id,s:'kb',vx:fx*wd.kb,vy:2,vz:fz*wd.kb},t.id);}
  if(!hit&&wd.n==='Pickaxe'&&!e.bot)this.harvestSwing(e,wd,yaw,pitch,x,y,z);
  this.emit({k:'snd',n:'melee',p:[x,y,z]})},
 // ================= items
 startUseItem(e,slot){
  const it=ITEMS[slot.id];if(!it)return;
  if(it.kind==='heal'||it.kind==='shield'||it.kind==='chug'){
   if(it.kind==='heal'&&e.hp>=it.cap&&e.hp>=e.maxHp){if(e.local)this.hud.toast('Health is full');return}
   if(it.kind==='heal'&&e.hp>=it.cap){if(e.local)this.hud.toast('Cannot heal above '+it.cap+' with this');return}
   if(it.kind==='shield'&&e.sh>=it.cap){if(e.local)this.hud.toast('Shield is full');return}
   if(it.kind==='chug'&&e.hp>=e.maxHp&&e.sh>=100){return}
   const tm=it.time*(e.cdef.id==='jay'?BAL.jay.passive.useTimeMul:1);e.use={t:tm,dur:tm,slot,id:slot.id};e.sliding=false;return}
  if(it.kind==='buff'){e.use={t:it.time,dur:it.time,slot,id:slot.id};e.sliding=false;return}
  if(it.kind==='call'){
   const o=[e.pos.x,this.eyeOf(e),e.pos.z];const cp=Math.cos(e.pitch+(e.local?this.view.recoilP:0));const d=[-Math.sin(e.yaw)*cp,Math.sin(e.pitch),-Math.cos(e.yaw)*cp];
   const h=W.rayWorld(o[0],o[1],o[2],d[0],d[1],d[2],150);
   if(!h){if(e.local)this.hud.toast('Aim at the ground to call the strike','#ff9a9a');return}
   const x=o[0]+d[0]*h.t,z=o[2]+d[2]*h.t;
   this.consume(e,slot);e.fireCd=.6;
   if(this.role==='client'&&e.local)this.net.toHost({t:'strike',x,z});else this.callStrike(e,x,z);return}
  if(it.kind==='grapple'){
   const o=[e.pos.x,this.eyeOf(e),e.pos.z];const cp=Math.cos(e.pitch+(e.local?this.view.recoilP:0));const d=[-Math.sin(e.yaw)*cp,Math.sin(e.pitch),-Math.cos(e.yaw)*cp];
   const h=W.rayWorld(o[0],o[1],o[2],d[0],d[1],d[2],70);
   if(!h){if(e.local)this.hud.toast('No target in range');return}
   const tx=o[0]+d[0]*h.t,ty=o[1]+d[1]*h.t,tz=o[2]+d[2]*h.t;e.grap={x:tx,y:ty,z:tz,t:0};e.sliding=false;e.fireCd=.5;
   this.consume(e,slot);
   const ev={k:'tr',a:o,b:[tx,ty,tz]};if(e.local)this.audio.play('grapple');this.fx.tracer(new THREE.Vector3(o[0],o[1]-.2,o[2]),new THREE.Vector3(tx,ty,tz),'#ffd23d',.06,.5);
   if(this.role==='client'&&e.local)this.net.toHost({t:'grap'});return}
  if(it.kind==='place'||it.kind==='deploy'){
   const fx=-Math.sin(e.yaw),fz=-Math.cos(e.yaw);const x=e.pos.x+fx*2.4,z=e.pos.z+fz*2.4,y=W.groundAt(x,z,e.pos.y+1,.3,2)+(it.kind==='deploy'?2.4:0);
   this.consume(e,slot);e.fireCd=.4;
   if(this.role==='client'&&e.local)this.net.toHost({t:'trap',id:slot.id,x,y,z});else this.placeTrap(e,slot.id,x,y,z);return}
  if(it.kind==='throw'){
   const cp=Math.cos(e.pitch+.15);const dx=-Math.sin(e.yaw)*cp,dy=Math.sin(e.pitch+.15),dz=-Math.cos(e.yaw)*cp;const o=[e.pos.x,this.eyeOf(e),e.pos.z];
   this.consume(e,slot);e.fireCd=.6;e.shootT=.15;this.revealEnt(e);
   if(this.role==='client'&&e.local)this.net.toHost({t:'throw',id:slot.id,o,d:[dx,dy,dz]});else this.throwItem(e,slot.id,o,[dx,dy,dz]);return}
 },
 consume(e,slot){slot.n--;if(slot.n<=0){const i=e.inv.indexOf(slot);if(i>0)e.inv[i]=null;if(e.cur===i){e.cur=this.firstWeaponSlot(e);e.equipT=.3;if(e.local)this.view.equipK=0}}},
 finishUse(e){
  const slot=e.use.slot,it=ITEMS[slot.id];
  this.consume(e,slot);
  if(it.kind==='buff'){this.applyBuff(e,it);return}
  let hp=0,sh=0;
  if(it.kind==='heal'){hp=Math.min(it.hp*this.foodHealMul(e),it.cap-e.hp)}
  else if(it.kind==='shield'){sh=Math.min(it.sh,it.cap-e.sh)}
  else if(it.kind==='chug'){hp=e.maxHp-e.hp;sh=100-e.sh}
  hp=Math.max(0,hp);sh=Math.max(0,sh);
  this.healEnt(e,hp,sh);
  if(e.local){this.audio.play('pick');this.hud.toast('+'+Math.round(hp+sh)+(it.kind==='heal'?' HP':it.kind==='shield'?' Shield':' HP & Shield'),'#8cff9a')}
  this.fx.burst(e.pos.x,e.pos.y+1,e.pos.z,18,3,it.kind==='shield'?'#4db8ff':'#6cff8a',.8,-3)},
 healEnt(e,hp,sh){
  if(this.role==='client'&&e.local){this.net.toHost({t:'heal',hp,sh});e.hp=Math.min(e.maxHp,e.hp+hp);e.sh=Math.min(100,e.sh+sh);return}
  e.hp=Math.min(e.maxHp,e.hp+hp);e.sh=Math.min(100,e.sh+sh)},
 firstWeaponSlot(e){for(let i=1;i<6;i++)if(e.inv[i]&&e.inv[i].k==='w')return i;return 0},
 swapTo(e,i){if(i===e.cur||e.drop==='bus')return;e.cur=i;e.equipT=.35;e.reload=0;e.use=null;e.aiming=false;if(e.local){this.view.equipK=0;this.audio.play('click')}},
 cycleSlot(e,d){let i=e.cur;for(let k=0;k<6;k++){i=(i+d+6)%6;if(e.inv[i]){this.swapTo(e,i);return}}},
 // ================= damage
 damage(t,amount,by,wid,head,pos,quiet){
  if(this.role==='client'||!t.alive||t.drop==='bus')return;
  if(by&&by!==t&&(by.bot)){amount*=this.botDmg}
  if(amount<=0)return;
  if(t.emote)this.stopEmote(t);
  let rem=amount,shHit=0;
  if(t.ts>0){const a=Math.min(t.ts,rem);t.ts-=a;rem-=a;shHit=1}
  if(rem>0&&t.sh>0){const a=Math.min(t.sh,rem);t.sh-=a;rem-=a;shHit=1}
  if(t.cloakT>0&&by&&by!==t)this.revealHost(t);
  t.hp-=rem;t.lastHit=this.t;t.lastBy=by?by.id:-1;if(t.bot)this.onBotHit&&this.onBotHit(t,by);
  const p=pos||[t.pos.x,t.pos.y+1,t.pos.z];
  this.emit({k:'hit',t:t.id,by:by?by.id:-1,d:Math.round(amount),h:head?1:0,sh:shHit,hp:rem>0?1:0,x:p[0],y:p[1],z:p[2]});
  if(t.hp<=0){t.hp=0;if(this.canKnock(t))this.knockEnt(t,by,wid,head);else this.killEnt(t,by,wid,head)}},
 killEnt(t,by,wid,head){
  if(!t.alive)return;t.alive=false;t.knocked=false;t.deadT=0;t.use=null;
  t.place=this.placeOf(t);if(by&&by!==t)by.kills++;
  this.emit({k:'kill',v:t.id,by:by&&by!==t?by.id:-1,w:wid,h:head?1:0,p:t.place});
  // drop loot
  for(let i=0;i<6;i++){const s=t.inv[i];if(!s)continue;if(s.k==='w'&&s.w===0)continue;
   const a=Math.random()*6.283;this.spawnLoot(s.k==='w'?{k:'w',w:s.w,r:s.r,mag:s.mag,d:1}:{k:'i',id:s.id,n:s.n},t.pos.x+Math.cos(a)*1.2,t.pos.z+Math.sin(a)*1.2,t.pos.y+.1);t.inv[i]=null}
  for(const k in t.ammo)if(t.ammo[k]>0){const a=Math.random()*6.283;this.spawnLoot({k:'a',t:k,n:t.ammo[k]},t.pos.x+Math.cos(a)*1.5,t.pos.z+Math.sin(a)*1.5,t.pos.y+.1);t.ammo[k]=0}
  this.dropCard(t);this.checkWin()},
 checkWin(){
  if(this.over||this.role==='client'||this.t<8)return;
  // free roam (one team only, e.g. a party with no opponents) never ends by itself
  if(new Set(this.list.map(e=>e.team)).size<2)return;
  const alive=this.list.filter(e=>e.alive&&!e.knocked);
  if(new Set(alive.map(e=>e.team)).size<=1){const w=alive[0];this.emit({k:'end',win:w?w.id:-1,tm:w?w.team:-999});}
 },
 // true when a and b are on the same team (never true for the same entity, or in solo where every entity has its own team)
 isAlly(a,b){return !!a&&!!b&&a!==b&&a.team===b.team},
 // place for someone who just went out: one more than the number of teams still standing
 placeOf(t){const teams=new Set(this.list.filter(e=>e.alive&&!e.knocked&&e!==t).map(e=>e.team));return teams.size+1},
 // ================= abilities
 useAbility(e,i){
  if(!e.alive||e.drop||e.cd[i]>0||e.stun>0||e.emote||e.slip>0||e.dance>0||e.eatT>0||e.cookT>0||e.use)return false;
  const ab=e.cdef.ab[i];const z=e.cdef.id==='zach';
  if(e.cdef.hero)return this.useHeroAbility(e,i,ab);
  const net=this.role==='client'&&e.local;
  e.cd[i]=ab.cd;e.sliding=false;
  if(!z){
   if(i===0){e.vel.set(e.vel.x*.3,15,e.vel.z*.3);e.grounded=false;e.slamming=true;e.slamWait=.35;e.pos.y+=.1;if(e.local){this.audio.play('ab');this.view.shake=.3}this.fx.ring(e.pos,3,'#6ec6ff',.4)}
   if(i===1){e.auraT=3;if(e.local)this.audio.play('ab');this.fx.burst(e.pos.x,e.pos.y+1,e.pos.z,30,5,'#5ab8ff',.6)}
   if(i===2){const bx=Math.sin(e.yaw),bz=Math.cos(e.yaw);e.dash={vx:bx*26,vz:bz*26,t:.22,kind:'dodge'};e.vel.y=Math.max(e.vel.y,3);e.grounded=false;if(e.local)this.audio.play('ab');
    if(net)this.net.toHost({t:'ab',i,x:e.pos.x,y:e.pos.y,z:e.pos.z,yaw:e.yaw});else this.abilityEffect(e,i,e.pos.x,e.pos.y,e.pos.z,e.yaw)}
  }else{
   if(i===0){e.eatT=1.6;e.eatMax=1.6;e.vel.x=e.vel.z=0;if(e.local){this.audio.play('eat');this.hud.toast('Nom nom…','#ffb347')}else this.audio.play('eat',e.pos);e.eatHeal=true}
   if(i===1){const fx=-Math.sin(e.yaw),fz=-Math.cos(e.yaw);e.dash={vx:fx*24,vz:fz*24,t:.28,kind:'bite'};e.vel.y=Math.max(e.vel.y,2.5);e.grounded=false;if(e.local)this.audio.play('ab');
    if(net)this.net.toHost({t:'ab',i,x:e.pos.x,y:e.pos.y,z:e.pos.z,yaw:e.yaw});else this.abilityEffect(e,i,e.pos.x,e.pos.y,e.pos.z,e.yaw)}
   if(i===2){e.buffT=5;if(e.local)this.audio.play('ab');this.fx.burst(e.pos.x,e.pos.y+1,e.pos.z,30,5,'#ffd84a',.6);
    if(net)this.net.toHost({t:'ab',i,x:e.pos.x,y:e.pos.y,z:e.pos.z,yaw:e.yaw});else this.abilityEffect(e,i,e.pos.x,e.pos.y,e.pos.z,e.yaw)}
  }
  if(e.local)this.hud.abilityUsed&&this.hud.abilityUsed(i);
  return true},
 findBiteTarget(e,r){const fx=-Math.sin(e.yaw),fz=-Math.cos(e.yaw);let best=null,bd=r;for(const t of this.list){if(t===e||!t.alive||t.drop)continue;const dx=t.pos.x-e.pos.x,dz=t.pos.z-e.pos.z,d=Math.hypot(dx,dz);if(d<bd&&Math.abs(t.pos.y-e.pos.y)<2.2&&(d<.8||(dx*fx+dz*fz)/d>.4)){bd=d;best=t}}return best},
 // host-side authoritative effects
 abilityEffect(e,i,x,y,z,yaw,extra){
  const cid=e.cdef.id;if(e.cdef.hero){this.heroEffect(e,i,x,y,z,yaw,extra);return}
  if(cid==='coolguy15'&&i===2){
   const bx=x,bz=z;this.emit({k:'burst',x:bx,y,z:bz});
   for(const t of this.list){if(t===e||!t.alive||t.drop==='bus'||this.isAlly(e,t))continue;const dx=t.pos.x-bx,dz=t.pos.z-bz,d=Math.hypot(dx,dz);if(d<4.5&&Math.abs(t.pos.y-y)<3){this.damage(t,14,e,-2,false);const l=d||1;this.emit({k:'st',i:t.id,s:'kb',vx:dx/l*16,vy:5,vz:dz/l*16},t.id)}}}
  else if(cid==='zach'&&i===1){
   // find the target the lunge reaches
   const fx=-Math.sin(yaw),fz=-Math.cos(yaw);let best=null,bd=7;
   for(const t of this.list){if(t===e||!t.alive||t.drop)continue;const dx=t.pos.x-x,dz=t.pos.z-z,d=Math.hypot(dx,dz);if(d<bd&&Math.abs(t.pos.y-y)<2.5&&(d<1||(dx*fx+dz*fz)/d>.55)){bd=d;best=t}}
   if(best){e.biteTarget=best.id;e.biteAt=this.t+Math.max(.05,bd/24-.05);e.biteMiss=false}
   else{e.biteTarget=null}
  }
  else if(cid==='zach'&&i===2){e.ts=25;e.tsT=5;this.emit({k:'snd',n:'ab',p:[x,y,z]})}
 },
 slamLand(e){
  const net=this.role==='client'&&e.local;this.fx.ring(e.pos,10,'#6ec6ff',.55);
  if(net)this.net.toHost({t:'slam',x:e.pos.x,y:e.pos.y,z:e.pos.z});else this.hostSlam(e,e.pos.x,e.pos.y,e.pos.z)},
 hostSlam(e,x,y,z){
  this.emit({k:'slam',x,y,z});
  for(const t of this.list){if(t===e||!t.alive||t.drop==='bus'||this.isAlly(e,t))continue;const dx=t.pos.x-x,dz=t.pos.z-z,d=Math.hypot(dx,dz);if(d<5&&Math.abs(t.pos.y-y)<3){this.damage(t,25,e,-1,false);const l=d||1;this.emit({k:'st',i:t.id,s:'kb',vx:dx/l*10,vy:7,vz:dz/l*10},t.id)}}
  const wd={dmg:24,splash:0,speed:22,grav:0,bounce:0,fuse:0,kb:6,shard:1,life:.7};
  for(let i=0;i<16;i++){const a=i/16*6.2832;this.spawnProj(e,x,y+.9,z,Math.cos(a)*22,0,Math.sin(a)*22,wd,-3)}},
 // timers on abilities run for every shooter (host side) – eat heal / bite resolution
 abilityTick(e,dt){
  this.heroTick(e,dt);
  if(e.eatHeal&&e.eatT<=0){e.eatHeal=false;const h=e.maxHp*.2;this.healEnt(e,Math.min(h,e.maxHp-e.hp),0);this.fx.burst(e.pos.x,e.pos.y+1.2,e.pos.z,20,3,'#6cff8a',.8,-3);if(e.local)this.hud.toast('+'+Math.round(h)+' HP','#8cff9a')}
  if(e.biteTarget!==undefined&&e.biteTarget!==null&&this.t>=e.biteAt&&this.role!=='client'){const t=this.ents.get(e.biteTarget);e.biteTarget=null;if(t&&t.alive){this.damage(t,t.maxHp*.2,e,-4,false);this.emit({k:'bite',t:t.id})}}},
 // ================= projectiles
 spawnProj(owner,x,y,z,vx,vy,vz,wd,wi){
  const id=this.nextProjId++;
  const p={id,owner:owner.id,x,y,z,vx,vy,vz,dmg:wd.dmg,splash:wd.splash||0,grav:wd.grav||0,bounce:wd.bounce||0,fuse:wd.fuse||0,kb:wd.kb||0,sp2:wd.sp2||'',wi,life:wd.life||6,shard:!!wd.shard,
   direct:!wd.fuse||wd.sp2==='ball',stick:wd.n==='Sticky Bomb Launcher'?1:0,age:0,kind:wd.kind||'',col:wd.col,stuck:null,sx:0,sy:0,sz:0,ex:wd.n&&wd.n.includes('Rocket'),food:wd.food||'',team:owner.team,homing:wd.homing?1:0,tgt:null,retarget:0,syncT:0};
  if(wd.n==='Grenade Launcher'||wd.n==='Sticky Bomb Launcher')p.direct=false;
  if(wd.n==='Potato Cannon'){p.splash=0}
  this.projs.push(p);
  this.emit({k:'pj',id,x,y,z,vx,vy,vz,g:p.grav,c:wd.col,s:p.sp2,sh:p.shard?1:0,b:p.bounce,r:(wd.n==='Rocket Launcher'||wd.homing)?1:0});
 },
 updateProjs(dt){
  for(let i=this.projs.length-1;i>=0;i--){
   const p=this.projs[i];p.age+=dt;p.life-=dt;let dead=false;
   if(p.homing&&!p.stuck)this.steerHoming(p,dt);
   if(p.stuck){const t=this.ents.get(p.stuck);if(t&&t.alive){p.x=t.pos.x+p.sx;p.y=t.pos.y+p.sy;p.z=t.pos.z+p.sz}}
   else{
    const steps=Math.max(1,Math.ceil(Math.hypot(p.vx,p.vy,p.vz)*dt/1.2));const h=dt/steps;
    for(let s=0;s<steps&&!dead&&!p.stuck;s++){
     p.vy-=p.grav*h;const nx=p.x+p.vx*h,ny=p.y+p.vy*h,nz=p.z+p.vz*h;
     const dx=nx-p.x,dy=ny-p.y,dz=nz-p.z,dl=Math.hypot(dx,dy,dz)||1e-6;const ux=dx/dl,uy=dy/dl,uz=dz/dl;
     const wh=W.rayWorld(p.x,p.y,p.z,ux,uy,uz,dl);
     let bestT=wh?wh.t:Infinity,bestE=null;
     for(const t of this.list){if(!t.alive||t.drop==='bus')continue;if(!p.food&&this.isAlly(this.ents.get(p.owner),t))continue;if(p.food&&(t.id===p.owner||(p.food!=='burger'&&t.team===p.team)))continue;if(t.id===p.owner&&p.age<.25)continue;if(t.id===p.owner&&!p.shard&&p.direct&&p.age<.5)continue;if(p.shard&&t.id===p.owner)continue;
      const tt=rayCyl(p.x,p.y,p.z,ux,uy,uz,t.pos.x,t.pos.y,t.pos.z,.55,this.hbH(t)+.1,Math.min(dl,bestT));if(tt<bestT){bestT=tt;bestE=t}}
     if(bestE&&(p.direct||p.stick||p.shard)){
      const hx=p.x+ux*bestT,hy=p.y+uy*bestT,hz=p.z+uz*bestT;p.x=hx;p.y=hy;p.z=hz;
      if(p.stick){p.stuck=bestE.id;p.sx=hx-bestE.pos.x;p.sy=hy-bestE.pos.y;p.sz=hz-bestE.pos.z;p.vx=p.vy=p.vz=0;p.grav=0}
      else{this.projHitEnt(p,bestE,ux,uz);dead=true}
     }else if(wh&&(!bestE||wh.t<=bestT)){
      const hx=p.x+ux*wh.t,hy=p.y+uy*wh.t,hz=p.z+uz*wh.t;
      if(p.shard){dead=true;p.x=hx;p.y=hy;p.z=hz;break}
      if(p.bounce>0){const n=this.surfaceNormal(wh,hx,hy,hz);const dn=p.vx*n[0]+p.vy*n[1]+p.vz*n[2];p.vx=(p.vx-2*dn*n[0])*p.bounce;p.vy=(p.vy-2*dn*n[1])*p.bounce;p.vz=(p.vz-2*dn*n[2])*p.bounce;p.x=hx+n[0]*.12;p.y=hy+n[1]*.12;p.z=hz+n[2]*.12;if(Math.hypot(p.vx,p.vy,p.vz)>3)this.emit({k:'snd',n:'bounce',p:[hx,hy,hz],g:.5})}
      else if(p.stick){p.x=hx;p.y=hy;p.z=hz;p.vx=p.vy=p.vz=0;p.grav=0;p.stuck=-1}
      else{p.x=hx;p.y=hy;p.z=hz;this.projBoom(p,null);dead=true}
     }else{p.x=nx;p.y=ny;p.z=nz}
     if(p.y<-1.2&&!dead){dead=true;p.y=-.5;if(p.splash>0)this.projBoom(p,null)}
    }
   }
   if(!dead&&p.fuse>0&&p.age>=p.fuse){this.projBoom(p,null);dead=true}
   else if(!dead&&p.life<=0){if(p.fuse>0||p.splash>0)this.projBoom(p,null);dead=true}
   if(dead){this.emit({k:'pjx',id:p.id});this.projs.splice(i,1)}
  }
 },
 surfaceNormal(h,x,y,z){
  if(h.kind==='ground'){const[gx,gz]=W.slope(x,z);const l=Math.hypot(gx,1,gz);return[-gx/l,1/l,-gz/l]}
  const o=h.obj;if(!o)return[0,1,0];
  if(o.circ===false){const d=[Math.abs(x-o.x0),Math.abs(x-o.x1),Math.abs(y-o.y0),Math.abs(y-o.y1),Math.abs(z-o.z0),Math.abs(z-o.z1)];let m=0;for(let i=1;i<6;i++)if(d[i]<d[m])m=i;return[[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]][m]}
  const dx=x-o.x,dz=z-o.z,l=Math.hypot(dx,dz)||1;return[dx/l,0,dz/l]},
 projHitEnt(p,t,ux,uz){
  if(p.food){this.foodHit(p,t,ux,uz);return}
  const owner=this.ents.get(p.owner);
  if(p.shard){this.damage(t,p.dmg,owner,p.wi,false,[p.x,p.y,p.z]);this.emit({k:'st',i:t.id,s:'kb',vx:ux*p.kb,vy:3,vz:uz*p.kb},t.id);return}
  if(p.splash>0)this.projBoom(p,t);
  else{this.damage(t,p.dmg,owner,p.wi,false,[p.x,p.y,p.z]);this.emit({k:'st',i:t.id,s:'kb',vx:ux*(p.kb||3),vy:2,vz:uz*(p.kb||3)},t.id)}
  if(p.sp2==='potato')this.emit({k:'snd',n:'hit',p:[p.x,p.y,p.z]})},
 projBoom(p,direct){
  if(p.food){this.foodLand(p,direct);return}
  const owner=this.ents.get(p.owner);
  if(p.splash<=0){return}
  const col=p.sp2==='banana'?'#ffe14a':p.sp2==='ball'?'#3cd0ff':p.sp2==='chicken'?'#fff08a':p.kind==='boogie'?'#ff55ff':p.kind==='frost'?'#8fe9ff':'#ff9a3c';
  this.emit({k:'ex',x:p.x,y:p.y,z:p.z,r:p.splash,c:col});
  this.structBlast(p.x,p.y,p.z,p.splash,p.dmg*1.5);
  for(const t of this.list){if(!t.alive||t.drop==='bus'||(!p.food&&this.isAlly(this.ents.get(p.owner),t)))continue;
   const dx=t.pos.x-p.x,dy=t.pos.y+.9-p.y,dz=t.pos.z-p.z,d=Math.hypot(dx,dy,dz);const rr=p.splash+.5;if(d>rr&&t!==direct)continue;
   if(t!==direct&&d>1.6&&!W.losClear(p.x,p.y+.2,p.z,t.pos.x,t.pos.y+.9,t.pos.z))continue;
   let f=t===direct?1:clamp(1-(d/rr)*.65,.25,1);let dmg=p.dmg*f;if(t.id===p.owner)dmg*=.45;
   if(p.kind==='boogie'){this.emit({k:'st',i:t.id,s:'dance',t:3},t.id);continue}
   if(p.kind==='frost')this.emit({k:'st',i:t.id,s:'slow',t:3,f:.5},t.id);this.damage(t,dmg,owner,p.wi,false,[t.pos.x,t.pos.y+1,t.pos.z]);
   const l=d||1;const kb=(10*f+(p.kb||0));this.emit({k:'st',i:t.id,s:'kb',vx:dx/l*kb,vy:Math.max(3,dy/l*kb*.8+3),vz:dz/l*kb},t.id);
   if(p.sp2==='banana')this.emit({k:'st',i:t.id,s:'slip',t:2},t.id)}
  if(p.kind==='boogie')return;
 },
 throwItem(e,id,o,d){
  const wd=id==='frost'?{dmg:30,splash:5,fuse:1.8,grav:16,bounce:.4,n:'Frost',col:'#8fe9ff',life:3,kind:'frost'}:id==='frag'?{dmg:90,splash:5.5,fuse:2.2,grav:16,bounce:.45,n:'Frag',col:'#6b8f3a',life:3}:{dmg:0,splash:6,fuse:1.8,grav:16,bounce:.5,n:'Boogie',col:'#ff55ff',life:3,kind:'boogie'};
  const s=24;this.spawnProj(e,o[0]+d[0]*.5,o[1]+d[1]*.5-.2,o[2]+d[2]*.5,d[0]*s+e.vel.x*.3,d[1]*s+e.vel.y*.2+3,d[2]*s+e.vel.z*.3,Object.assign(wd,{kind:id==='boogie'||id==='frost'?id:''}),id==='frost'?-16:id==='boogie'?-17:-5);
  const p=this.projs[this.projs.length-1];p.direct=false;if(id==='boogie'||id==='frost')p.kind=id},
 // ================= items: buffs, air strike, homing, drone and shock trap (host decides, clients predict their own buffs)
 applyBuff(e,it){
  const k=it.buff;
  if(k==='energy'){e.energyT=8;if(it.hp)this.healEnt(e,Math.min(it.hp,e.maxHp-e.hp),0);if(e.local){this.audio.play('buff');this.hud.toast('Energy Drink: +25% speed','#c6ff3d')}}
  else if(k==='spicy'){e.spicyT=8;if(e.local){this.audio.play('spicy');this.hud.toast('Spicy! +30% weapon damage','#ff7a4a')}}
  else if(k==='cloak'){e.cloakT=8;if(e.local){this.audio.play('cloak');this.hud.toast('Invisible for 8 s. Attacking reveals you','#9be0ff')}}
  else if(k==='jet'){e.jetFuel=6;if(e.local){this.audio.play('jet');this.hud.toast('Jetpack: hold Space in the air (6 s)','#9be0ff')}}
  this.fx.burst(e.pos.x,e.pos.y+1,e.pos.z,18,3,it.col,.8,-3)},
 callStrike(e,x,z){
  if(!this.strikes)this.strikes=[];
  const id=this.nextStrikeId=(this.nextStrikeId||0)+1;
  this.strikes.push({id,o:e.id,x,z,t:2.5,bombs:6});
  this.emit({k:'strk',id,x,z,t:2.5});
 },
 updateStrikes(dt){
  if(!this.strikes||!this.strikes.length)return;
  for(let i=this.strikes.length-1;i>=0;i--){const s=this.strikes[i];s.t-=dt;if(s.t>0)continue;this.strikes.splice(i,1);
   const owner=this.ents.get(s.o)||{id:s.o};
   for(let b=0;b<s.bombs;b++){const a=Math.random()*6.283,r=Math.sqrt(Math.random())*6.5,bx=s.x+Math.cos(a)*r,bz=s.z+Math.sin(a)*r;
    this.spawnProj(owner,bx,W.H(bx,bz)+46+Math.random()*6,bz,(Math.random()-.5)*2,-34,(Math.random()-.5)*2,{dmg:58,splash:4.5,grav:22,life:9,n:'Air Strike',col:'#ff9a3c'},-15)}}
 },
 steerHoming(p,dt){
  const owner=this.ents.get(p.owner);
  p.retarget-=dt;
  if(!p.tgt||!p.tgt.alive||p.retarget<=0){p.tgt=this.pickHomingTarget(p,owner);p.retarget=.25}
  const S=Math.hypot(p.vx,p.vy,p.vz);
  if(p.tgt&&S>1){const t=p.tgt,dx=t.pos.x-p.x,dy=t.pos.y+1.1-p.y,dz=t.pos.z-p.z,dl=Math.hypot(dx,dy,dz)||1,k=Math.min(1,dt*3.6);
   const nx=p.vx/S*(1-k)+dx/dl*k,ny=p.vy/S*(1-k)+dy/dl*k,nz=p.vz/S*(1-k)+dz/dl*k;const nl=Math.hypot(nx,ny,nz)||1;
   p.vx=nx/nl*S;p.vy=ny/nl*S;p.vz=nz/nl*S}
  p.syncT-=dt;if(p.syncT<=0){p.syncT=.1;this.emit({k:'pjv',id:p.id,x:p.x,y:p.y,z:p.z,vx:p.vx,vy:p.vy,vz:p.vz})}
 },
 pickHomingTarget(p,owner){ // nearest enemy inside a ~40 degree cone ahead of the missile, with a clear line
  const S=Math.hypot(p.vx,p.vy,p.vz)||1,fx=p.vx/S,fy=p.vy/S,fz=p.vz/S;let best=null,bc=Math.cos(.7);
  for(const t of this.list){if(!t.alive||t.drop==='bus'||t.id===p.owner)continue;if(owner&&owner.team!==undefined&&t.team===owner.team)continue;
   const dx=t.pos.x-p.x,dy=t.pos.y+1.1-p.y,dz=t.pos.z-p.z,d=Math.hypot(dx,dy,dz);if(d<1||d>90)continue;
   const c=(dx*fx+dy*fy+dz*fz)/d;if(c<bc)continue;if(!W.losClear(p.x,p.y,p.z,t.pos.x,t.pos.y+1.1,t.pos.z))continue;bc=c;best=t}
  return best},
 updateGadgets(dt){ // shock traps spring on enemies; recon drones shoot the nearest enemy they can see
  for(const t of Array.from(this.traps.values())){
   if(t.t==='shock'){
    for(const e of this.list){if(!e.alive||e.drop||e.id===t.o)continue;const dx=e.pos.x-t.x,dz=e.pos.z-t.z;
     if(dx*dx+dz*dz<2.2&&Math.abs(e.pos.y-t.y)<1.2){this.emit({k:'st',i:e.id,s:'stun',t:1.3},e.id);this.emit({k:'snd',n:'shock',p:[t.x,t.y,t.z]});this.emit({k:'tp-',id:t.id});this.traps.delete(t.id);break}}
   }else if(t.t==='drone'){
    if(t.age>14){this.emit({k:'tp-',id:t.id});this.traps.delete(t.id);continue}
    if(t.cd>0)continue;
    const owner=this.ents.get(t.o);let best=null,bd=40*40;
    for(const e of this.list){if(!e.alive||e.drop||e.id===t.o)continue;if(owner&&owner.team!==undefined&&e.team===owner.team)continue;
     const dx=e.pos.x-t.x,dy=e.pos.y+1-t.y,dz=e.pos.z-t.z,d2=dx*dx+dy*dy+dz*dz;
     if(d2<bd&&W.losClear(t.x,t.y,t.z,e.pos.x,e.pos.y+1,e.pos.z)){bd=d2;best=e}}
    if(!best)continue;
    t.cd=.8;
    this.damage(best,7*this.dmgMulOf(owner),owner||null,-14,false,[best.pos.x,best.pos.y+1,best.pos.z]);
    this.emit({k:'dz',x1:t.x,y1:t.y+.2,z1:t.z,x2:best.pos.x,y2:best.pos.y+1.1,z2:best.pos.z});
   }
  }
 },
 // ================= traps
 placeTrap(e,id,x,y,z){const tid=this.nextTrapId++;const ev={k:'tp+',id:tid,t:id,x,y,z,o:e.id};this.traps.set(tid,{id:tid,t:id,x,y,z,o:e.id,age:0,cd:0});this.emit(ev)},
 addTrapVis(ev){if(!this.traps.has(ev.id))this.traps.set(ev.id,{id:ev.id,t:ev.t,x:ev.x,y:ev.y,z:ev.z,o:ev.o,age:0,cd:0});const t=this.traps.get(ev.id);
  const g=new THREE.Group();if(ev.t==='drone'){g.add(makeDroneMesh())}else if(ev.t==='shock'){g.add(makeShockMesh())}else if(ev.t==='pad'){const b=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.3,.2,16),new THREE.MeshLambertMaterial({color:'#2dff8f',emissive:'#10aa60'}));g.add(b);const a=new THREE.Mesh(new THREE.ConeGeometry(.6,.9,4),new THREE.MeshBasicMaterial({color:'#fff'}));a.position.y=.7;a.name='arr';g.add(a)}
  else{const b=new THREE.Mesh(new THREE.TorusGeometry(.35,.12,6,10,4.2),new THREE.MeshLambertMaterial({color:'#ffe14a'}));b.rotation.x=-Math.PI/2;b.position.y=.15;g.add(b);const b2=new THREE.Mesh(new THREE.SphereGeometry(.2,8,6),new THREE.MeshLambertMaterial({color:'#ffd000'}));b2.position.y=.2;g.add(b2)}
  g.position.set(ev.x,ev.y+.1,ev.z);t.mesh=g;this.dynamic.add(g);this.audio.play('click',new THREE.Vector3(ev.x,ev.y,ev.z))},
 updateTraps(dt){this.updateStrikes(dt);this.updateGadgets(dt);
  for(const t of this.traps.values()){t.age+=dt;t.cd=Math.max(0,t.cd-dt);
   for(const e of this.list){if(!e.alive||e.drop)continue;const dx=e.pos.x-t.x,dz=e.pos.z-t.z;
    if(t.t==='pad'&&t.cd<=0&&dx*dx+dz*dz<2.2&&Math.abs(e.pos.y-t.y)<1.2){t.cd=.5;const fx=-Math.sin(e.yaw),fz=-Math.cos(e.yaw);const hs=Math.hypot(e.vel.x,e.vel.z);this.emit({k:'st',i:e.id,s:'launch',vx:e.vel.x*.6+fx*8,vy:27,vz:e.vel.z*.6+fz*8},e.id);this.emit({k:'snd',n:'pad',p:[t.x,t.y,t.z]})}
    if(t.t==='banana'&&t.age>.5&&dx*dx+dz*dz<1.2&&Math.abs(e.pos.y-t.y)<1.2){this.emit({k:'st',i:e.id,s:'slip',t:1.8},e.id);this.emit({k:'tp-',id:t.id});this.emit({k:'snd',n:'slip',p:[t.x,t.y,t.z]});this.traps.delete(t.id);break}}}
 },
 updateTrapVis(dt){for(const t of this.traps.values()){if(t.mesh&&t.t==='drone'){t.mesh.children.forEach(c=>{if(c.name==='rotor')c.rotation.y+=dt*30})}}for(const t of this.traps.values()){if(t.mesh&&t.t==='pad'){const a=t.mesh.getObjectByName('arr');if(a){a.position.y=.7+Math.sin(this.t*6)*.12;a.rotation.y+=dt*3}}}},
 // ================= projectile visuals
 addProjVis(ev){
  const col=ev.c||'#fff';let m;
  if(ev.sh){m=new THREE.Mesh(new THREE.OctahedronGeometry(.25),new THREE.MeshBasicMaterial({color:'#8fdcff'}))}
  else if(ev.r){m=new THREE.Group();const b=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.7,8),new THREE.MeshLambertMaterial({color:'#ccc'}));b.rotation.x=Math.PI/2;m.add(b);const c=new THREE.Mesh(new THREE.ConeGeometry(.13,.3,8),new THREE.MeshLambertMaterial({color:'#e33'}));c.rotation.x=-Math.PI/2;c.position.z=-.5;m.add(c)}
  else if(ev.s&&ev.s.startsWith('f_')){m=makeFoodMesh(ev.s)}
  else if(ev.s==='banana'){m=new THREE.Mesh(new THREE.TorusGeometry(.25,.09,6,10,3.5),new THREE.MeshLambertMaterial({color:'#ffe14a'}))}
  else if(ev.s==='chicken'){m=new THREE.Group();const b=new THREE.Mesh(new THREE.SphereGeometry(.3,10,8),new THREE.MeshLambertMaterial({color:'#fff08a'}));b.scale.z=1.4;m.add(b);const h=new THREE.Mesh(new THREE.SphereGeometry(.15,8,6),new THREE.MeshLambertMaterial({color:'#ff5a3a'}));h.position.set(0,.2,-.4);m.add(h)}
  else if(ev.s==='ball'){m=new THREE.Mesh(new THREE.SphereGeometry(.3,12,10),new THREE.MeshBasicMaterial({color:'#3cd0ff'}))}
  else if(ev.s==='potato'){m=new THREE.Mesh(new THREE.SphereGeometry(.2,8,6),new THREE.MeshLambertMaterial({color:'#b08a55'}));m.scale.z=1.3}
  else m=new THREE.Mesh(new THREE.SphereGeometry(.2,10,8),new THREE.MeshLambertMaterial({color:col}));
  m.position.set(ev.x,ev.y,ev.z);this.dynamic.add(m);
  this.pvis.set(ev.id,{mesh:m,x:ev.x,y:ev.y,z:ev.z,vx:ev.vx,vy:ev.vy,vz:ev.vz,g:ev.g||0,rocket:!!ev.r,col,tr:0,shard:!!ev.sh,tumble:!!(ev.s&&ev.s.startsWith('f_'))});
  if(ev.r)this.audio.play('launch',new THREE.Vector3(ev.x,ev.y,ev.z))},
 updateProjVis(dt){
  for(const p of this.pvis.values()){
   if(this.role==='client'){p.vy-=p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt}
   else{const sp=this.projs.find(q=>q.id===undefined)}
   p.mesh.position.set(p.x,p.y,p.z);const sp=Math.hypot(p.vx,p.vy,p.vz);if(p.tumble){p.mesh.rotation.x+=dt*9;p.mesh.rotation.z+=dt*6}else if(p.rocket||p.shard||sp>20){p.mesh.lookAt(p.x+p.vx,p.y+p.vy,p.z+p.vz)}else p.mesh.rotation.x+=dt*8;
   p.tr-=dt;if(p.tr<=0){p.tr=.03;this.fx.emit(p.x,p.y,p.z,(Math.random()-.5),(Math.random()-.5),(Math.random()-.5),p.rocket?'#ff9a3c':p.col,.35,0)}}
  if(this.role!=='client'){for(const q of this.projs){const p=this.pvis.get(q.id);if(p){p.x=q.x;p.y=q.y;p.z=q.z;p.vx=q.vx;p.vy=q.vy;p.vz=q.vz}}}
 },
 // ================= storm
 updateStorm(dt){
  const s=this.storm;
  if(s.state==='idle'||s.state==='wait'){
   s.t-=dt;if(s.state==='idle'&&this.t<10)return;
   if(s.t<=0&&s.phase+1<PHASES.length){
    s.phase++;const P=PHASES[s.phase];s.state='shrink';s.t=P.shrink;s.dmg=P.dmg;s.or=s.r;s.ocx=s.cx;s.ocz=s.cz;
    const maxOff=Math.max(0,s.r-P.r)*.8;const a=Math.random()*6.283,d=Math.sqrt(Math.random())*maxOff;
    s.tcx=s.cx+Math.cos(a)*d;s.tcz=s.cz+Math.sin(a)*d;s.tr=P.r;s.dur=P.shrink;
    this.emit({k:'storm',m:s.phase===0?'The storm is closing!':'Storm shrinking – move!'})}
  }else if(s.state==='shrink'){
   s.t-=dt;const k=1-Math.max(0,s.t)/s.dur;s.r=lerp(s.or,s.tr,k);s.cx=lerp(s.ocx,s.tcx,k);s.cz=lerp(s.ocz,s.tcz,k);
   if(s.t<=0){s.r=s.tr;s.cx=s.tcx;s.cz=s.tcz;if(s.phase+1<PHASES.length){s.state='wait';s.t=PHASES[s.phase+1].wait;this.emit({k:'storm',m:'Next storm circle marked'})}else s.state='done'}}
  // damage
  s.tick=(s.tick||0)+dt;if(s.tick>=1){s.tick=0;
   for(const e of this.list){if(!e.alive||e.drop==='bus')continue;if(!this.insideStorm(e.pos.x,e.pos.z)){const d=Math.max(1,s.state==='idle'?1:s.dmg||1);this.damage(e,d,null,-9,false)}}}
 },
 insideStorm(x,z){const s=this.storm;if(s.phase<0&&s.state==='idle')return true;return Math.hypot(x-s.cx,z-s.cz)<=s.r},
 // next safe zone (target)
 nextZone(){const s=this.storm;if(s.state==='shrink')return{x:s.tcx,z:s.tcz,r:s.tr};return null},
 initStormMesh(){
  const g=new THREE.CylinderGeometry(1,1,700,64,1,true);const m=new THREE.MeshBasicMaterial({color:'#9b4dff',transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false,fog:false});
  this.stormMesh=new THREE.Mesh(g,m);this.stormMesh.position.y=250;this.stormMesh.renderOrder=3;this.dynamic.add(this.stormMesh);
  const g2=new THREE.RingGeometry(.995,1,64);const m2=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.5,side:THREE.DoubleSide,depthWrite:false,fog:false});this.zoneRing=new THREE.Mesh(g2,m2);this.zoneRing.rotation.x=-Math.PI/2;this.zoneRing.position.y=1;this.dynamic.add(this.zoneRing);this.zoneRing.visible=false},
 updateStormVis(dt){
  const s=this.storm;this.stormMesh.visible=s.r<440;this.stormMesh.scale.set(s.r,1,s.r);this.stormMesh.position.x=s.cx;this.stormMesh.position.z=s.cz;
  this.stormMesh.material.opacity=.22+Math.sin(this.t*2)*.05;this.stormMesh.material.map=null;
  const z=this.nextZone();if(z){this.zoneRing.visible=true;this.zoneRing.scale.set(z.r,z.r,1);this.zoneRing.position.set(z.x,60,z.z);this.zoneRing.geometry.dispose&&0}else this.zoneRing.visible=false;
  const wg=this.world&&this.world.water;if(wg){wg.position.y=Math.sin(this.t*.8)*.08}
 },
 // ================= supply drops
 updateSupplies(dt){
  this.supplyT-=dt;
  if(this.supplyT<=0&&this.t>20){this.supplyT=55+Math.random()*25;const s=this.storm;const a=Math.random()*6.283,d=Math.sqrt(Math.random())*Math.max(10,s.r*.7);let x=s.cx+Math.cos(a)*d,z=s.cz+Math.sin(a)*d;
   if(W.H(x,z)<2.5){x=s.cx*.5;z=s.cz*.5}const id=this.nextLootId++;const y0=160;this.supplies.push({id,x,z,t0:this.t,y0,landed:false,host:true});this.emit({k:'sd',id,x,z,y0})}
  for(const s of this.supplies){if(s.host&&!s.landed&&this.t-s.t0>9){s.landed=true;const y=W.H(s.x,s.z);this.spawnChest(s.x,y+.1,s.z,true,s.id)}}
 },
};
