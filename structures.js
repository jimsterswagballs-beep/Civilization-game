// Building and destruction.
// The host is authoritative: it validates placements, applies damage and decides what breaks.
// Anything that can break is a "part" with hp, tagged by `pk`:
//   'piece' player-built piece (structAddPiece)     'box' static building wall, roof, prop or boulder (W.wparts)
//   'tree' / 'rock' trunk or rock (W.treeList / W.rockList)
// Pickaxes, bullets and explosions all go through partHit(), which scales the damage by material (PART_RES).
// Events to guests: 'bh' / 'bx' (piece hp / destroyed), 'ph' / 'px' (world part hp / destroyed),
// 'mats' (material counts), 'gain' (pickup toast), 'hv' (hit sparks).
import * as THREE from 'three';
import * as W from './world.js';
import * as NAV from './botnav.js';
import {MATS,PIECES,PIECE_KEYS,MAT_KEYS,PART_RES,emptyMats} from './materials.js';
import {boxCrack,circCrack,removeCrack,clearCracks,stageFor} from './cracks.js';

const GRID=4,WALL_H=3,FLOOR_T=.35,REACH=16,MAX_DEBRIS=420,COLLAPSE_R=10;
const boxMats=new Map();
const boxMat=c=>{let m=boxMats.get(c);if(!m){m=new THREE.MeshLambertMaterial({color:c});boxMats.set(c,m)}return m};
const ghostMats={ok:new THREE.MeshBasicMaterial({color:'#7dff9e',transparent:true,opacity:.42,depthWrite:false}),
 bad:new THREE.MeshBasicMaterial({color:'#ff5a5a',transparent:true,opacity:.42,depthWrite:false})};

// Solid boxes for a piece. Pieces are centred on a 4 m grid (x, z), `y` is the base.
export function pieceBoxes(ty,x,y,z,rot){const out0=pieceBoxesRaw(ty,x,y,z,rot);for(const b of out0)b.circ=false;return out0}
function pieceBoxesRaw(ty,x,y,z,rot){
 if(ty==='wall')return rot?[{x0:x-.2,y0:y,z0:z-2,x1:x+.2,y1:y+WALL_H,z1:z+2}]:[{x0:x-2,y0:y,z0:z-.2,x1:x+2,y1:y+WALL_H,z1:z+.2}];
 if(ty==='floor')return[{x0:x-2,y0:y,z0:z-2,x1:x+2,y1:y+FLOOR_T,z1:z+2}];
 // ramp: six solid steps of 0.5 m rise, which the normal step-up rule lets players and bots climb
 const out=[],N=6,run=4/N,rise=WALL_H/N;
 for(let i=0;i<N;i++){const a=-2+i*run,b=a+run,top=y+(i+1)*rise;
  out.push(rot?{x0:x-2,y0:y,z0:z+a,x1:x+2,y1:top,z1:z+b}:{x0:x+a,y0:y,z0:z-2,x1:x+b,y1:top,z1:z+2})}
 return out}

// ---- helpers for damage
const boxDist=(b,x,y,z)=>Math.hypot(x-Math.min(Math.max(x,b.x0),b.x1),y-Math.min(Math.max(y,b.y0),b.y1),z-Math.min(Math.max(z,b.z0),b.z1));
// the part a ray or blast touched: a player piece, a destructible box, or a tree / rock. null for ground and fixed geometry.
const partOf=o=>o.piece?o.piece:o.pk?o:null;
const partColor=T=>T.pk==='tree'?'#8a5a2b':T.pk==='rock'?'#b5b9bd':MATS[T.mat].c;
const partDist=(T,x,y,z)=>{
 if(T.pk==='piece'){let m=1e9;for(const b of T.boxes)m=Math.min(m,boxDist(b,x,y,z));return m}
 if(T.pk==='box')return boxDist(T,x,y,z);
 const dxz=Math.max(0,Math.hypot(x-T.x,z-T.z)-T.r),dy=y<T.y0?T.y0-y:y>T.y1?y-T.y1:0;
 return Math.hypot(dxz,dy)};

export const structMethods={
 structEnsure(){if(!this.pieces)this.pieces=new Map();if(!this.debris)this.debris=[];if(!this.bstate)this.bstate={ty:'wall',mat:'wood',rot:0};if(this.building===undefined)this.building=false;return this},

 // ------------------------------------------------------------ shared piece state (host + clients)
 structAddPiece(d){
  this.structEnsure();if(this.pieces.has(d.id))return null;
  const boxes=pieceBoxes(d.ty,d.x,d.y,d.z,d.rot);
  const p={id:d.id,pk:'piece',ty:d.ty,mat:d.mat,rot:d.rot,x:d.x,y:d.y,z:d.z,hp:MATS[d.mat].hp,maxHp:MATS[d.mat].hp,yAcc:0,boxes,meshes:[],dead:false,flashT:0};
  const mat=new THREE.MeshLambertMaterial({color:MATS[d.mat].c});p.mat3=mat;
  for(const b of boxes){b.piece=p;W.addSolid(b);
   const m=new THREE.Mesh(new THREE.BoxGeometry(b.x1-b.x0,b.y1-b.y0,b.z1-b.z0),mat);
   m.position.set((b.x0+b.x1)/2,(b.y0+b.y1)/2,(b.z0+b.z1)/2);m.castShadow=m.receiveShadow=true;this.dynamic.add(m);p.meshes.push(m)}
  this.pieces.set(p.id,p);this.structNav(boxes);return p},
 structNav(boxes){let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const b of boxes){x0=Math.min(x0,b.x0);x1=Math.max(x1,b.x1);z0=Math.min(z0,b.z0);z1=Math.max(z1,b.z1)}NAV.invalidateRect(x0-1.5,z0-1.5,x1+1.5,z1+1.5)},
 structDrop(p,big){
  if(!p||p.dead)return;p.dead=true;
  p.boxes.forEach((b,bi)=>{removeCrack('p'+p.id+':'+bi);W.removeSolid(b)});
  for(const m of p.meshes){this.dynamic.remove(m);m.geometry.dispose()}
  this.pieces.delete(p.id);this.structNav(p.boxes);
  const col=MATS[p.mat].c;
  this.structDebris(p.x,p.y+(p.ty==='floor'?.3:1.5),p.z,col,big?16:9,p.ty==='floor'?.55:.4);
  this.fx.dust(p.x,p.y+1,p.z,big?18:10,4,MATS[p.mat].dark)},
 structDebris(x,y,z,color,n,size){const d=this.debris;
  for(let i=0;i<n;i++){const s=size*(.6+Math.random()*.8);const m=new THREE.Mesh(new THREE.BoxGeometry(s,s,s),boxMat(color));m.castShadow=true;
   m.position.set(x+(Math.random()-.5)*1.6,y+(Math.random()-.5)*1.2,z+(Math.random()-.5)*1.6);this.dynamic.add(m);
   const a=Math.random()*6.283,sp=1.5+Math.random()*4.5;
   d.push({m,h:s/2,vx:Math.cos(a)*sp,vy:3+Math.random()*6,vz:Math.sin(a)*sp,t:2.5+Math.random()*2,rx:(Math.random()-.5)*10,ry:(Math.random()-.5)*10})}
  while(d.length>MAX_DEBRIS){const o=d.shift();this.dynamic.remove(o.m);o.m.geometry.dispose()}},
 structUpdateDebris(dt){const d=this.debris;if(!d||!d.length)return;
  for(let i=d.length-1;i>=0;i--){const s=d[i],m=s.m;s.t-=dt;s.vy-=24*dt;
   m.position.x+=s.vx*dt;m.position.y+=s.vy*dt;m.position.z+=s.vz*dt;m.rotation.x+=s.rx*dt;m.rotation.y+=s.ry*dt;
   // land on terrain or on any solid below (other pieces, buildings) by testing the surface under the shard
   const g=W.groundAt(m.position.x,m.position.z,m.position.y-s.h,.12,.35)+s.h;
   if(m.position.y<g){m.position.y=g;if(s.vy<-2){s.vy=-s.vy*.3;s.vx*=.6;s.vz*=.6}else{s.vy=0;s.vx*=.85;s.vz*=.85}}
   if(s.t<=0||m.position.y<-40){this.dynamic.remove(m);m.geometry.dispose();d.splice(i,1);continue}
   if(s.t<.4)m.scale.setScalar(Math.max(.05,s.t/.4))}},
 // a piece stays up if its base sits on the ground or on the top of some solid under its footprint
 structSupported(q){
  if(q.y<=W.H(q.x,q.z)+.2)return true; // sits on the terrain (a floor's top is .35 m up, so it must not count as ground)
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const b of q.boxes){x0=Math.min(x0,b.x0);x1=Math.max(x1,b.x1);z0=Math.min(z0,b.z0);z1=Math.max(z1,b.z1)}
  const buf=[];W.query(q.x,q.z,3,buf);
  for(const b of buf){if(b.circ!==false||b.piece===q)continue;if(Math.abs(b.y1-q.y)>.3)continue;
   if(b.x1>x0+.05&&b.x0<x1-.05&&b.z1>z0+.05&&b.z0<z1-.05)return true}
  return false},
 // a static box stays up if it sits on the ground, rests on a solid under its footprint, or is joined to a
 // neighbour wall at the same height (a lintel over a doorway rests on the jambs, not on the floor)
 boxSupported(b){
  const cx=(b.x0+b.x1)/2,cz=(b.z0+b.z1)/2;
  if(b.y0<=W.H(cx,cz)+.3)return true;
  const buf=[];W.query(cx,cz,Math.max(b.x1-b.x0,b.z1-b.z0)/2+1.2,buf);
  for(const o of buf){
   if(o===b||o.circ!==false||o.gone)continue;
   if(Math.abs(o.y1-b.y0)<=.3&&o.x1>b.x0+.05&&o.x0<b.x1-.05&&o.z1>b.z0+.05&&o.z0<b.z1-.05)return true;
   if(o.y0<b.y1-.05&&o.y1>b.y0+.05){
    const zOver=o.z1>b.z0+.05&&o.z0<b.z1-.05,xOver=o.x1>b.x0+.05&&o.x0<b.x1-.05;
    if((zOver&&(Math.abs(o.x1-b.x0)<=.05||Math.abs(o.x0-b.x1)<=.05))||(xOver&&(Math.abs(o.z1-b.z0)<=.05||Math.abs(o.z0-b.z1)<=.05)))return true}
  }
  return false},

 // ------------------------------------------------------------ damage (host)
 // raw: weapon damage before material resistance. src: 'bullet' | 'blast' | 'pick'. by: the entity that swung (pick only)
 partHit(T,raw,src,by){
  if(this.role==='client'||!T||T.dead)return 0;
  const res=PART_RES[T.mat];const amt=raw*(res&&res[src]!==undefined?res[src]:1);
  const before=T.hp;T.hp-=amt;const dealt=Math.max(0,Math.min(before,amt));
  const killed=T.hp<=0;if(killed)T.hp=0;
  if(src==='pick')this.harvestYield(by,T,dealt,killed);
  if(killed)this.partDestroy(T,0);else this.partSync(T);
  return dealt},
 partSync(T){
  if(T.pk==='piece')this.emit({k:'bh',id:T.id,hp:Math.round(T.hp)});
  else if(T.pk==='box')this.emit({k:'ph',t:'w',i:T.wi,hp:Math.round(T.hp)});
  else this.emit({k:'ph',t:T.pk,i:T.idx,hp:Math.round(T.hp)})},
 // break a part, then let anything it was holding up fall
 partDestroy(T,depth){
  if(!T||T.dead||depth>10)return;
  const big=depth>0||T.ty==='floor'?1:0;
  if(T.pk==='piece')this.emit({k:'bx',id:T.id,big});
  else if(T.pk==='box')this.emit({k:'px',t:'w',i:T.wi,big});
  else this.emit({k:'px',t:T.pk,i:T.idx,big});
  this.collapseAround(T,depth+1)},
 collapseAround(T,depth){
  if(depth>10)return;
  let cx,cz,R;
  if(T.pk==='piece'){cx=T.x;cz=T.z;R=COLLAPSE_R}
  else if(T.pk==='box'){cx=(T.x0+T.x1)/2;cz=(T.z0+T.z1)/2;R=Math.max(T.x1-T.x0,T.z1-T.z0)/2+COLLAPSE_R}
  else{cx=T.x;cz=T.z;R=T.r+COLLAPSE_R}
  for(const q of[...this.pieces.values()]){
   if(q.dead||Math.abs(q.x-cx)>R||Math.abs(q.z-cz)>R)continue;
   if(!this.structSupported(q))this.partDestroy(q,depth)}
  const buf=[];W.query(cx,cz,R,buf);
  for(const b of buf){if(b.pk!=='box'||b.dead||b.gone)continue;if(!this.boxSupported(b))this.partDestroy(b,depth)}},
 // pickaxe mining pays out the material of whatever was mined (wood from trees, stone from rocks, the part's own material otherwise)
 harvestYield(e,T,dealt,killed){
  if(!e||e.bot||!dealt)return;
  const mat=T.pk==='tree'?'wood':T.pk==='rock'?'stone':T.mat;
  const rate=T.pk==='tree'?.27:T.pk==='rock'?.3:.1;
  T.yAcc=(T.yAcc||0)+dealt*rate;
  let n=Math.floor(T.yAcc);T.yAcc-=n;
  if(killed)n+=T.pk==='tree'?10:T.pk==='rock'?12:0; // a felled tree or broken rock drops a bonus
  if(n>0){this.structAddMats(e,mat,n);this.emit({k:'gain',i:e.id,m:mat,n})}},
 // pickaxe swing that didn't hit an entity: trace the swing and mine whatever is in reach
 harvestSwing(e,wd,yaw,pitch,x,y,z){
  const cp=Math.cos(pitch),dx=-Math.sin(yaw)*cp,dy=Math.sin(pitch),dz=-Math.cos(yaw)*cp;
  const h=W.rayWorld(x,y,z,dx,dy,dz,wd.range+.4);
  if(!h||h.kind==='ground')return;
  const T=partOf(h.obj);if(!T)return;
  this.partHit(T,wd.dmg,'pick',e);
  this.emit({k:'hv',x:x+dx*h.t,y:y+dy*h.t,z:z+dz*h.t,c:partColor(T)})},
 // a bullet (or pellet) reached world geometry
 onWorldHit(sh,wh,wd,ex,ey,ez){
  if(this.role==='client'||!wh||!wh.obj)return;
  const T=partOf(wh.obj);if(!T)return;
  if(this.partHit(T,(wd.dmg||20)*(wd.pellets>1?.45:.8),'bullet',null)>0)this.emit({k:'hv',x:ex,y:ey,z:ez,c:partColor(T)})},
 // explosion: every part in reach takes damage that falls off with distance
 structBlast(x,y,z,r,dmg){
  if(this.role==='client')return;
  const buf=[];W.query(x,z,r+4,buf);const seen=new Set();
  for(const o of buf){const T=partOf(o);if(!T||T.dead||seen.has(T))continue;seen.add(T);
   const d=partDist(T,x,y,z);if(d<r+3)this.partHit(T,dmg*Math.max(.2,1-d/(r+3)),'blast',null)}},
 structAddMats(e,mat,n){if(!e.mats)e.mats=emptyMats();e.mats[mat]=Math.min(999,(e.mats[mat]||0)+n);this.emit({k:'mats',i:e.id,m:{...e.mats}})},
 structSpend(e,mat,n){e.mats[mat]=Math.max(0,(e.mats[mat]||0)-n);this.emit({k:'mats',i:e.id,m:{...e.mats}})},

 // ------------------------------------------------------------ placement
 structValidate(e,ty,mat,x,y,z,rot){
  const bad=why=>({ok:false,why});
  if(!PIECES[ty]||!MATS[mat])return bad('Invalid piece');
  if(![x,y,z].every(Number.isFinite))return bad('Invalid position');
  const cost=PIECES[ty].cost;
  if((e.mats&&e.mats[mat]||0)<cost)return bad('Not enough '+MATS[mat].n.toLowerCase());
  if(Math.hypot(x-e.pos.x,z-e.pos.z)>REACH)return bad('Too far away');
  if(!this.insideStorm(x,z))return bad('Outside the storm');
  if(W.H(x,z)<-.2)return bad('Cannot build on water');
  if(y<W.H(x,z)-.3)return bad('Blocked by terrain');
  const boxes=pieceBoxes(ty,x,y,z,rot);
  if(!this.structSupported({x,y,z,boxes}))return bad('Needs support below');
  for(const b of boxes){
   if(W.overlapsSolid(b.x0+.05,b.y0+.05,b.z0+.05,b.x1-.05,b.y1-.05,b.z1-.05))return bad('Blocked');
   for(const o of this.list){if(!o.alive||o.drop)continue;
    if(o.pos.x>b.x0-.35&&o.pos.x<b.x1+.35&&o.pos.z>b.z0-.35&&o.pos.z<b.z1+.35&&o.pos.y<b.y1-.05&&o.pos.y+1.5>b.y0+.05)return bad('Someone is in the way')}}
  return{ok:true,cost,ty,mat,x,y,z,rot}},
 // host: a client (or the host) asked to place a piece. Snap and recompute the base height ourselves.
 structHostBuild(e,m){
  if(this.role==='client'||!e||!e.alive||e.drop)return;this.structEnsure();
  const x=Math.round(m.x/GRID)*GRID,z=Math.round(m.z/GRID)*GRID;
  if(![m.x,m.y,m.z].every(Number.isFinite))return;
  const y=W.groundAt(x,z,m.y+.25,.1,.65);
  const r=this.structValidate(e,m.ty,m.mat,x,y,z,m.rot?1:0);
  if(!r.ok){if(e===this.me)this.hud.toast(r.why);return}
  const id=(this.pieceSeq=(this.pieceSeq||0)+1);
  this.structSpend(e,r.mat,r.cost);
  this.emit({k:'bp',p:{id,ty:r.ty,mat:r.mat,rot:r.rot,x:r.x,y:r.y,z:r.z}})},
 // local aim: where a piece would go if placed now (snapped to the 4 m grid)
 structAim(){
  const cam=this.camera,o=cam.position,dir=cam.getWorldDirection(this._aimDir||(this._aimDir=new THREE.Vector3()));
  const hit=W.rayWorld(o.x,o.y,o.z,dir.x,dir.y,dir.z,REACH+6);
  const t=hit?Math.max(.5,Math.min(REACH,hit.t-.3)):REACH;
  const px=o.x+dir.x*t,py=o.y+dir.y*t,pz=o.z+dir.z*t;
  const x=Math.round(px/GRID)*GRID,z=Math.round(pz/GRID)*GRID;
  return{x,y:W.groundAt(x,z,py+.25,.1,.65),z}},
 structPlan(){
  const s=this.structEnsure().bstate,a=this.structAim();
  const v=this.structValidate(this.me,s.ty,s.mat,a.x,a.y,a.z,s.rot);
  return v.ok?v:{ok:false,why:v.why,x:a.x,y:a.y,z:a.z,ty:s.ty,mat:s.mat,rot:s.rot}},
 structPlace(){
  const p=this.structPlan();if(!p.ok){this.hud.toast(p.why);return}
  const req={t:'build',ty:p.ty,mat:p.mat,x:p.x,y:p.y,z:p.z,rot:p.rot};
  if(this.role==='client')this.net.toHost(req);else this.structHostBuild(this.me,req);
  this.audio.play('step',null,.5)},
 structToggle(){
  const me=this.me;if(!me||!me.alive||me.drop)return;this.structEnsure();
  this.building=!this.building;
  this.hud.toast(this.building?'Build mode: wheel = piece, T = rotate, Y = material, click = place':'Build mode off')},
 structCyclePiece(d){const s=this.structEnsure().bstate;const i=PIECE_KEYS.indexOf(s.ty);s.ty=PIECE_KEYS[(i+d+PIECE_KEYS.length)%PIECE_KEYS.length]},
 structCycleMat(){const s=this.structEnsure().bstate;const i=MAT_KEYS.indexOf(s.mat);s.mat=MAT_KEYS[(i+1)%MAT_KEYS.length]},

 // ------------------------------------------------------------ events from the host
 onBuildEvent(ev){
  this.structEnsure();
  switch(ev.k){
   case'bp':{const p=this.structAddPiece(ev.p);if(p)this.fx.dust(p.x,p.y+.5,p.z,6,3,MATS[p.mat].dark);break}
   case'bh':{const p=this.pieces.get(ev.id);if(p){p.hp=ev.hp;p.mat3.emissive.setHex(0x402000);p.flashT=.09;
    p.boxes.forEach((b,bi)=>boxCrack(this.dynamic,'p'+p.id+':'+bi,b,stageFor(p)))}break}
   case'bx':{const p=this.pieces.get(ev.id);if(p)this.structDrop(p,ev.big);break}
   case'ph':{
    if(ev.t==='w'){const b=W.wparts[ev.i];if(b&&!b.dead){b.hp=ev.hp;boxCrack(this.dynamic,'w'+ev.i,b,stageFor(b))}}
    else{const c=(ev.t==='tree'?W.treeList:W.rockList)[ev.i];if(c&&!c.dead){c.hp=ev.hp;circCrack(this.dynamic,c,stageFor(c))}}
    break}
   case'px':{
    if(ev.t==='w'){
     const b=W.wparts[ev.i];if(!b||b.dead)break;
     b.dead=true;b.hp=0;removeCrack('w'+ev.i);W.removeSolid(b);W.hideBox(b);
     const cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2,cz=(b.z0+b.z1)/2;
     this.structDebris(cx,cy,cz,b.c,ev.big?12:6,.45);
     this.fx.dust(cx,b.y0+1,cz,ev.big?12:6,3,MATS[b.mat].dark);
     NAV.invalidateRect(b.x0-1.5,b.z0-1.5,b.x1+1.5,b.z1+1.5);
    }else{
     const c=(ev.t==='tree'?W.treeList:W.rockList)[ev.i];if(!c||c.dead)break;
     c.dead=true;c.hp=0;removeCrack((ev.t==='tree'?'t':'r')+ev.i);W.removeDecor(ev.t,c);
     NAV.invalidateRect(c.x-c.r-1.5,c.z-c.r-1.5,c.x+c.r+1.5,c.z+c.r+1.5);
     const tree=ev.t==='tree';
     this.structDebris(c.x,c.y0+1.5,c.z,tree?'#6b4a2b':'#8a8a85',tree?8:10,tree?.4:.5);
     this.fx.dust(c.x,c.y0+1,c.z,12,3,'#a89a7c');
    }
    break}
   case'gain':{if(ev.i===this.myId){const m=MATS[ev.m];this.hud.toast('+'+ev.n+' '+m.n,m.c)}break}
   case'mats':{const t=this.ents.get(ev.i);if(t)t.mats=ev.m;break}
   case'hv':{this.fx.burst(ev.x,ev.y,ev.z,5,3,ev.c,.3,8);break}
  }
 },
 structPieceEvent(ev){this.onBuildEvent(ev)},

 // ------------------------------------------------------------ per-frame: flashes, debris, HUD and ghost preview
 structUpdateUI(dt){
  this.structEnsure();
  for(const p of this.pieces.values()){if(p.flashT>0){p.flashT-=dt;if(p.flashT<=0)p.mat3.emissive.setHex(0)}}
  this.structUpdateDebris(dt);
  const ui=this.structDom();
  const me=this.me,alive=!!(this.running&&me&&me.alive&&!me.drop);
  if(this.building&&!alive)this.building=false;
  this.hud.showMats(alive?(me.mats||emptyMats()):null);
  ui.build.style.display=this.building&&alive?'block':'none';
  if(this.building&&alive){
   const s=this.bstate,p=this.structPlan();
   ui.build.innerHTML=`<b>BUILD</b> &middot; ${PIECES[s.ty].n} &middot; ${MATS[s.mat].n} (${PIECES[s.ty].cost}) <span style=\"opacity:.7\">&middot; wheel piece &middot; T rotate &middot; Y material &middot; click place &middot; B exit</span><br><span style=\"color:${p.ok?'#7dff9e':'#ff7a7a'}\">${p.ok?'Ready':p.why}</span>`;
   this.structGhost(s,p)}
  else if(this.ghost)this.ghost.visible=false},
 structGhost(s,p){
  if(!this.ghost){this.ghost=new THREE.Group();this.dynamic.add(this.ghost)}
  const g=this.ghost;g.visible=true;
  const key=[s.ty,p.x,p.y,p.z,p.rot].join('|');
  if(g.userData.key!==key){g.userData.key=key;for(const c of g.children)c.geometry.dispose();g.clear();
   for(const b of pieceBoxes(s.ty,p.x,p.y,p.z,p.rot)){const m=new THREE.Mesh(new THREE.BoxGeometry(b.x1-b.x0,b.y1-b.y0,b.z1-b.z0),p.ok?ghostMats.ok:ghostMats.bad);
    m.position.set((b.x0+b.x1)/2,(b.y0+b.y1)/2,(b.z0+b.z1)/2);g.add(m)}}
  for(const m of g.children)m.material=p.ok?ghostMats.ok:ghostMats.bad},
 structDom(){
  if(this._dom)return this._dom;
  const ui=document.getElementById('ui')||document.body;
  const build=document.createElement('div');
  build.style.cssText='position:absolute;left:50%;bottom:120px;transform:translateX(-50%);font:600 14px system-ui,sans-serif;color:#fff;text-align:center;background:rgba(5,8,30,.6);padding:8px 14px;border-radius:8px;pointer-events:none;display:none;z-index:4;white-space:nowrap';
  ui.appendChild(build);return this._dom={build}},

 // ------------------------------------------------------------ reset between matches
 clearStructures(){
  this.structEnsure();
  for(const p of this.pieces.values()){for(const b of p.boxes)W.removeSolid(b);for(const m of p.meshes){this.dynamic.remove(m);m.geometry.dispose()}}
  for(const p of this.pieces.values())p.mat3.dispose();
  this.pieces.clear();this.pieceSeq=0;
  for(const s of this.debris){this.dynamic.remove(s.m);s.m.geometry.dispose()}this.debris.length=0;
  if(this.ghost){this.dynamic.remove(this.ghost);this.ghost=null}
  clearCracks();
  W.restoreDecor();NAV.resetAll();
  this.building=false;
  if(this._dom){this._dom.build.style.display='none'}
  this.hud.showMats(null);
 }
};
