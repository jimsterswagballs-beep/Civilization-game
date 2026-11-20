import * as THREE from 'three';
import {WEAPONS,ITEMS,RARITY,AMMO,clamp,lerp,mulberry32} from './data.js';
import * as W from './world.js';
import {wstat,makeWeaponModel,mat} from './shared.js';
const NW=WEAPONS.length;
const WEAPON_W=WEAPONS.map((w,i)=>i===0?0:(w.t==='ar'?10:w.t==='smg'?8:w.t==='sg'?8:w.t==='sn'?4:w.t==='pi'?7:w.t==='ex'?3.5:w.t==='melee'?1.5:5));
function pick(rng,ws){let t=0;for(const w of ws)t+=w;let r=rng()*t;for(let i=0;i<ws.length;i++){r-=ws[i];if(r<=0)return i}return ws.length-1}
export function rollRarity(rng,boost=1,min=0){const ws=RARITY.map((r,i)=>i<min?0:r.w*(i>=2?boost:1));return pick(rng,ws)}
export function rollItem(rng,q=1,min=0){
 const k=rng();
 if(k<.22||min>0&&k<.8){const w=pick(rng,WEAPON_W);const r=rollRarity(rng,q,min);return{k:'w',w,r,mag:wstat(w,r).mag}}
 if(k<.42){const types=Object.keys(AMMO);const t=types[pick(rng,[10,8,6,3,1.5])];return{k:'a',t,n:AMMO[t].box}}
 const its=['bandage','minishield','medkit','bigshield','chug','grapple','pad','frag','boogie','banana'];const ws=[9,8,3.5,2.5,.7,2.2,2,2.8,1.4,1.6];const id=its[pick(rng,ws)];return{k:'i',id,n:ITEMS[id].give}}
// Floor loot (not chests): mostly healing/utility, with the odd weapon or ammo stack.
// Floor weapons skew low rarity (never above Epic) so chests stay the place to find the good stuff.
export function rollFloorItem(rng,q=1){
 const k=rng();
 if(k<.16){const w=pick(rng,WEAPON_W);const r=Math.min(3,rollRarity(rng,Math.min(q,1)*.6));return{k:'w',w,r,mag:wstat(w,r).mag}}
 if(k<.42){const types=Object.keys(AMMO);const t=types[pick(rng,[10,8,6,3,1.5])];return{k:'a',t,n:Math.ceil(AMMO[t].box*.7)}}
 const its=['bandage','minishield','medkit','bigshield','chug','grapple','pad','frag','boogie','banana'];const ws=[9,8,3,1.5,.4,2.2,2,2.8,1.4,1.6];const id=its[pick(rng,ws)];return{k:'i',id,n:ITEMS[id].give}}
export function rollWeapon(rng,q=1,min=0){const w=pick(rng,WEAPON_W);const r=rollRarity(rng,q,min);return{k:'w',w,r,mag:wstat(w,r).mag}}
export function itemName(it){if(it.k==='w')return RARITY[it.r].n+' '+WEAPONS[it.w].n;if(it.k==='i')return ITEMS[it.id].n+(it.n>1?' x'+it.n:'');return AMMO[it.t].n+' Ammo x'+it.n}
export function itemColor(it){if(it.k==='w')return RARITY[it.r].c;if(it.k==='i')return ITEMS[it.id].col;return AMMO[it.t].c}
// ---- floor loot: compact, readable 3D miniatures with distinct silhouettes and animated rarity effects.
let LOOT_GEO=null;
function lootGeo(){return LOOT_GEO||(LOOT_GEO={
 ground:new THREE.TorusGeometry(.72,.035,5,40),
 hoop:new THREE.TorusGeometry(.48,.025,5,36),
 spark:new THREE.OctahedronGeometry(.075,0),
 shaft:new THREE.CylinderGeometry(.035,.035,1,6,1,true),
 disc:new THREE.CylinderGeometry(.68,.76,.12,24),
 orb:new THREE.SphereGeometry(.22,12,10),
 box:new THREE.BoxGeometry(1,1,1),
 tube:new THREE.CylinderGeometry(.14,.14,.55,12),
 cross:new THREE.BoxGeometry(.12,.42,.08)
})}
function glowMat(c,opacity=.7){return new THREE.MeshBasicMaterial({color:c,transparent:true,opacity,depthWrite:false,fog:false,blending:THREE.AdditiveBlending})}
function lootMat(c,rough=.65,metal=0){return new THREE.MeshStandardMaterial({color:c,roughness:rough,metalness:metal,flatShading:true})}
function part(g,geo,color,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,metal=0){
 const m=new THREE.Mesh(geo,lootMat(color,.55,metal));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.set(rx,ry,rz);m.castShadow=true;m.receiveShadow=true;g.add(m);return m}
function addCross(g,x,y,z,color='#fff'){
 part(g,new THREE.BoxGeometry(.13,.48,.1),color,x,y,z,.85,1,1);
 part(g,new THREE.BoxGeometry(.4,.13,.1),color,x,y+.02,z,.95,1,1)}
function makeFloorItem(it){
 const g=new THREE.Group(),c=itemColor(it);
 if(it.k==='w'){
  const m=makeWeaponModel(it.w,it.r);m.scale.setScalar(1.02);m.rotation.y=Math.PI/2;
  const bb=new THREE.Box3().setFromObject(m),ctr=bb.getCenter(new THREE.Vector3());m.position.sub(ctr);m.position.y=.22;g.add(m);
  // raised presentation rails make long weapons easy to see without obscuring their silhouette
  part(g,new THREE.BoxGeometry(1.35,.08,.18),'#263247',0,.08,0,1,1,1);
  part(g,new THREE.BoxGeometry(.12,.12,.2),c,-.48,.16,0);
  part(g,new THREE.BoxGeometry(.12,.12,.2),c,.48,.16,0);
 }else if(it.k==='a'){
  const count=Math.min(5,Math.max(3,Math.ceil(it.n/18)));
  const cols={light:'#f5ce45',med:'#e6a14c',shells:'#e65b52',heavy:'#7cc8ef',rockets:'#9acb70'};
  const ac=cols[it.t]||c;
  for(let i=0;i<count;i++){
   const a=i/count*Math.PI*2;
   const x=Math.cos(a)*.22,z=Math.sin(a)*.22;
   if(it.t==='shells'){
    part(g,new THREE.CylinderGeometry(.075,.075,.42,10),ac,x,.25,z,1,1,1,0,0,0,.35);
    part(g,new THREE.CylinderGeometry(.077,.077,.1,10), '#c7a56b',x,.04,z);
   }else{
    part(g,new THREE.CylinderGeometry(.055,.07,.34,10),ac,x,.21,z,1,1,1,0,0,0,.25);
    part(g,new THREE.ConeGeometry(.055,.12,10),it.t==='rockets'?'#d8e5c8':'#d8dce3',x,.44,z,1,1,1);
    part(g,new THREE.CylinderGeometry(.075,.075,.035,10),'#a7adb8',x,.07,z);
   }
  }
  part(g,new THREE.BoxGeometry(.72,.12,.58),'#303b4d',0,.07,0);
 }else{
  switch(it.id){
   case 'bandage':
    part(g,new THREE.CylinderGeometry(.24,.24,.2,16),'#e8e8e4',0,.2,0,1,1,1,Math.PI/2);
    part(g,new THREE.TorusGeometry(.13,.045,8,18),'#c6cbd1',0,.31,0,1,1,1,Math.PI/2);
    part(g,new THREE.BoxGeometry(.11,.04,.08),'#d94a4a',0,.33,.04);
    break;
   case 'medkit':
    part(g,new THREE.BoxGeometry(.62,.42,.48),'#e8edf4',0,.25,0);
    part(g,new THREE.BoxGeometry(.66,.1,.52),'#cfd8e4',0,.48,0);
    addCross(g,0,.28,.251,'#ed4545');break;
   case 'minishield':
   case 'bigshield':
    part(g,new THREE.CylinderGeometry(it.id==='bigshield'?.23:.16,it.id==='bigshield'?.25:.18,.58,14),'#263b63',0,.34,0,1,1,1,0,0,0,.25);
    part(g,new THREE.CylinderGeometry(.18,.18,.42,14),it.id==='bigshield'?'#347dff':'#57caff',0,.36,0);
    part(g,new THREE.CylinderGeometry(.1,.1,.035,14),'#b9efff',0,.58,0);
    part(g,new THREE.TorusGeometry(.19,.025,6,20),'#b7eaff',0,.34,0,1,1,1,Math.PI/2);break;
   case 'chug':
    part(g,new THREE.CylinderGeometry(.27,.3,.72,16),'#5a328c',0,.4,0,1,1,1,0,0,0,.35);
    part(g,new THREE.CylinderGeometry(.28,.28,.1,16),'#a6d6ed',0,.78,0,1,1,1,0,0,0,.55);
    part(g,new THREE.CylinderGeometry(.1,.1,.12,10),'#e4edf7',0,.88,0);
    part(g,new THREE.TorusGeometry(.2,.035,6,24),'#d28aff',0,.42,0,1,1,1,Math.PI/2);break;
   case 'grapple':
    part(g,new THREE.TorusGeometry(.25,.055,8,20),'#d4a53b',0,.3,0,1,1,1,Math.PI/2);
    for(let i=0;i<3;i++){const a=i*Math.PI*2/3;part(g,new THREE.ConeGeometry(.09,.27,8),'#d7dce5',Math.cos(a)*.25,.34,Math.sin(a)*.25,1,1,1,Math.cos(a)*.7,0,-Math.sin(a)*.7,.35)}
    part(g,new THREE.CylinderGeometry(.08,.08,.2,8),'#4a5364',0,.3,0);break;
   case 'pad':
    part(g,new THREE.CylinderGeometry(.53,.58,.16,24),'#1d6d55',0,.13,0,1,1,1,0,0,0,.25);
    part(g,new THREE.TorusGeometry(.4,.055,8,28),'#43ffad',0,.23,0);
    part(g,new THREE.ConeGeometry(.22,.34,4),'#caffdf',0,.4,0,1,1,1,0,Math.PI/4,0);break;
   case 'frag':
    part(g,new THREE.SphereGeometry(.27,12,10),'#607b43',0,.32,0,1,1,1,0,0,0,.2);
    part(g,new THREE.CylinderGeometry(.09,.09,.13,8),'#b4b8a2',0,.61,0);
    part(g,new THREE.TorusGeometry(.12,.035,6,12),'#e0d8ad',0,.68,0,1,1,1,Math.PI/2);break;
   case 'boogie':
    part(g,new THREE.SphereGeometry(.29,14,12),'#a82bca',0,.34,0,1,1,1,0,0,0,.3);
    part(g,new THREE.TorusGeometry(.34,.035,6,24),'#ff9bfa',0,.34,0,1,1,1,Math.PI/2);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;part(g,new THREE.BoxGeometry(.08,.08,.08),i%2?'#ffe45c':'#58eaff',Math.cos(a)*.28,.35+Math.sin(a)*.28,0,.8,1,.8,0,0,a)}break;
   case 'banana':
    part(g,new THREE.TorusGeometry(.3,.1,8,22,Math.PI*1.35),'#ffdf38',0,.25,0,1,1,1,0,0,Math.PI/2);
    part(g,new THREE.ConeGeometry(.09,.16,8),'#72512b',-.28,.26,0,1,1,1,0,0,-Math.PI/2);
    part(g,new THREE.ConeGeometry(.09,.16,8),'#72512b',.28,.26,0,1,1,1,0,0,Math.PI/2);break;
   default: part(g,new THREE.DodecahedronGeometry(.28,0),c,0,.3,0);
  }
 }
 return g;
}
export function makeItemLootVis(l){
 const it=l.item,c=itemColor(it),G=lootGeo(),g=new THREE.Group();
 const platform=new THREE.Mesh(G.disc,lootMat('#202b40',.4,.25));platform.position.y=.07;platform.receiveShadow=true;g.add(platform);
 const trim=new THREE.Mesh(G.ground,glowMat(c,.7));trim.rotation.x=Math.PI/2;trim.position.y=.12;g.add(trim);
 const float=new THREE.Group();float.position.y=.22;g.add(float);
 const model=makeFloorItem(it);float.add(model);
 // effect tier: weapons scale with rarity; ammo/items stay subtle (valuable consumables get a halo)
 const tier=it.k==='w'?it.r:(it.k==='i'&&['chug','bigshield','medkit'].includes(it.id)?2:0);
 const hr=it.k==='w'?.82:it.k==='a'?.48:.58;
 const halo=new THREE.Mesh(G.hoop,glowMat(c,.85));halo.scale.setScalar(hr/.48);halo.rotation.x=Math.PI/2;halo.position.y=.52;float.add(halo);
 const orbit=new THREE.Group();float.add(orbit);
 const sparkMat=glowMat(c,1);
 for(let k=0;k<4;k++){const s=new THREE.Mesh(G.spark,sparkMat);const a=k/4*Math.PI*2;s.position.set(Math.cos(a)*hr,.42+Math.sin(k*2)*.08,Math.sin(a)*hr);orbit.add(s)}
 const shaft=new THREE.Mesh(G.shaft,glowMat(c,.13));shaft.scale.set(1,tier>=4?2.2:1.25,1);shaft.position.y=tier>=4?1.1:.63;g.add(shaft);
 halo.visible=tier>=2;orbit.visible=tier>=2;shaft.visible=tier>=3;trim.material.opacity=tier>=2?.7:.45;
 Object.assign(g.userData,{float,model,halo,orbit,trim,platform,shaft,phase:l.id*2.399,rarity:it.k==='w'?it.r:0});
 return g;
}
export function animLootMesh(g,dt,t){
 const u=g.userData,ph=u.phase;
 const wave=Math.sin(t*2.8+ph),pulse=.5+.5*Math.sin(t*4.2+ph);
 u.float.position.y=.22+wave*.105;
 u.model.rotation.y+=dt*(u.rarity>=4?1.7:1.05);
 u.model.rotation.z=Math.sin(t*1.7+ph)*.055;
 u.halo.rotation.z+=dt*(u.rarity>=4?-1.9:-1.15);
 u.orbit.rotation.y+=dt*2.2;
 u.orbit.rotation.x=Math.sin(t*1.4+ph)*.12;
 u.trim.scale.setScalar(.94+pulse*.13);
 u.trim.material.opacity=.48+pulse*.38;
 u.shaft.material.opacity=.07+pulse*.12;
 const sc=1+Math.max(0,wave)*.035;u.platform.scale.set(sc,1,sc);
}
export const lootMethods={
 genLoot(rng){let id=1;this.loot.clear();
  // Floor loot is intentionally uncommon so players have to hunt for chests.
  const SKIP_OUT=.8,SKIP_IN=.5;
  for(const s of W.lootSpots){
   if(s.chest){this.addLootObj({id:id++,x:s.x,y:s.y,z:s.z,chest:1,q:s.q});continue}
   if(rng()<(s.inside?SKIP_IN:SKIP_OUT))continue;
   const n=s.inside&&rng()<.12?2:1;
   for(let i=0;i<n;i++){
    const it=rollFloorItem(rng,s.q);
    const a=rng()*6.283,off=i?.9:0;let x=s.x+Math.cos(a)*off,z=s.z+Math.sin(a)*off,y=s.y;
    if(off&&W.blocked(x,y,z,.3,1,.05)){x=s.x;z=s.z}
    this.addLootObj({id:id++,x,y,z,item:it})}
  }
  // ammo crates
  for(let i=0;i<28;i++){const a=rng()*6.283,r=Math.sqrt(rng())*W.ISL*.8;const x=Math.cos(a)*r,z=Math.sin(a)*r;const y=W.H(x,z);if(y<2.5||W.blocked(x,y+.1,z,.5,1,.05))continue;this.addLootObj({id:id++,x,y:y+.1,z,ammobox:1})}
 },
 addLootObj(l,fromEv){if(l.item&&l.item.k==='a'&&!l.chest){}this.loot.set(l.id,Object.assign(l,{mesh:null}))},
 removeLoot(id){const l=this.loot.get(id);if(!l)return;
  if(l.mesh){this.dynamic.remove(l.mesh);l.mesh=null;
   // pickup pop: coloured burst + ring where the item was
   if(l.item&&this.fx){const c=itemColor(l.item);this.fx.burst(l.x,l.y+.5,l.z,14,3.5,c,.45,4);this.fx.ring(new THREE.Vector3(l.x,l.y+.1,l.z),1.3,c,.35)}}
  this.loot.delete(id)},
 spawnLoot(item,x,z,y){ // host only
  const id=this.nextLootId++;const l={id,x,y:y===undefined?W.H(x,z)+.1:y,z,item};this.loot.set(id,Object.assign(l,{mesh:null}));
  this.outEvents.push({k:'lt+',l:{id,x:l.x,y:l.y,z:l.z,item}});return l},
 spawnChest(x,y,z,supply,id){const l={id:id||this.nextLootId++,x,y,z,chest:1,supply:supply?1:0,q:2};this.loot.set(l.id,Object.assign(l,{mesh:null}));this.outEvents.push({k:'lt+',l:{id:l.id,x,y,z,chest:1,supply:l.supply,q:2}});return l},
 openChest(l){ // host
  this.emit({k:'cho',id:l.id});const rng=Math.random;const items=[];
  if(l.supply){items.push(rollItem(rng,3,3));items.push(rollItem(rng,3,2));items.push({k:'i',id:'bigshield',n:2});items.push({k:'i',id:'medkit',n:2});items.push({k:'a',t:['med','light','heavy'][Math.floor(rng()*3)],n:60})}
  else{let w=rollItem(rng,1.6,1);while(w.k!=='w')w=rollItem(rng,1.6,1);items.push(w);items.push(rollItem(rng,1.4));items.push({k:'a',t:WEAPONS[w.w].ammo||'light',n:AMMO[WEAPONS[w.w].ammo||'light'].box});if(rng()<.6)items.push(rollItem(rng,1.2))}
  items.forEach((it,i)=>{let x=l.x,z=l.z;const a0=i/items.length*6.283+Math.random()*.5;
   for(let k=0;k<10;k++){const a=a0+k*.7,r=1.5+(k>>2)*.5;const px=l.x+Math.cos(a)*r,pz=l.z+Math.sin(a)*r;if(W.H(px,pz)<2&&l.y>2.5)continue;if(!W.blocked(px,l.y+.1,pz,.3,1,.05)&&Math.abs(W.groundAt(px,pz,l.y+.5,.3,.6)-l.y)<1.2){x=px;z=pz;break}}
   this.spawnLoot(it,x,z,W.groundAt(x,z,l.y+.5,.3,.6)+.1)});
  this.loot.delete(l.id)},
 openAmmoBox(l){this.emit({k:'cho',id:l.id});for(const t of ['light','med','shells','heavy'])if(Math.random()<.8||t==='light')this.spawnLoot({k:'a',t,n:Math.ceil(AMMO[t].box*.7)},l.x+(Math.random()-.5)*2.5,l.z+(Math.random()-.5)*2.5,l.y+.2);this.loot.delete(l.id)},
 // ---- picking up
 updateNearLoot(me){
  let best=null,bd=3.4;const fx=-Math.sin(me.yaw),fz=-Math.cos(me.yaw);
  for(const l of this.loot.values()){const dx=l.x-me.pos.x,dz=l.z-me.pos.z;if(dx*dx+dz*dz>bd*bd||Math.abs(l.y-me.pos.y)>3)continue;const d=Math.hypot(dx,dz);if(l.item&&l.item.k==='a')continue;
   const dot=d<.01?1:(dx*fx+dz*fz)/d;const score=d-dot*1.2;if(dot>-.2&&score<bd){bd=score;best=l}}
  this.near=best;this.hud.setPrompt(best?this.lootLabel(best):null,best)},
 lootLabel(l){if(l.chest)return l.supply?'Open Supply Drop':'Open Chest';if(l.ammobox)return 'Open Ammo Box';return itemName(l.item)},
 pickupLocal(me,l){
  if(this.role==='client'){this.net.toHost({t:'pick',id:l.id});this.audio.play('click');return}
  this.hostPick(me,l)},
 hostPick(e,l){
  if(!this.loot.has(l.id)||!e.alive||e.drop)return;
  if(Math.hypot(l.x-e.pos.x,l.z-e.pos.z)>4.8||Math.abs(l.y-e.pos.y)>4)return;
  if(l.chest){this.openChest(l);return}
  if(l.ammobox){this.openAmmoBox(l);return}
  this.removeLoot(l.id);this.emit({k:'lt-',id:l.id});
  if(e.peer!==undefined&&!e.local)this.emit({k:'grant',g:l.item},e.id);else this.applyGrantLocal(e,l.item)},
 applyGrantLocal(e,it){
  if(it.k==='a'){const m=AMMO[it.t].max;const before=e.ammo[it.t];e.ammo[it.t]=Math.min(m,before+it.n);const left=it.n-(e.ammo[it.t]-before);if(left>0&&e.ammo[it.t]>=m&&e.local&&left===it.n)this.hud.toast(AMMO[it.t].n+' ammo full');else if(e.local)this.audio.play('pick');return}
  if(it.k==='i'){
   const d=ITEMS[it.id];let s=e.inv.find(x=>x&&x.k==='i'&&x.id===it.id);
   if(s){const add=Math.min(d.stack-s.n,it.n);s.n+=add;const left=it.n-add;if(left>0)this.dropItem(e,{k:'i',id:it.id,n:left})}
   else{let i=e.inv.findIndex((x,k)=>k>0&&!x);if(i<0){if(e.cur>0){this.dropSlot(e,e.cur);i=e.cur}else{this.dropItem(e,it);return}}e.inv[i]={k:'i',id:it.id,n:Math.min(it.n,d.stack)};if(it.n>d.stack)this.dropItem(e,{k:'i',id:it.id,n:it.n-d.stack})}
   if(e.local)this.audio.play('pick');return}
  if(it.k==='w'){
   const wd=wstat(it.w,it.r);
   let i=e.inv.findIndex((x,k)=>k>0&&!x);
   if(i<0){i=e.cur>0&&e.inv[e.cur]&&e.inv[e.cur].k==='w'?e.cur:(()=>{let b=-1;for(let k=1;k<6;k++)if(e.inv[k]&&e.inv[k].k==='w'){b=k;break}return b>0?b:1})();this.dropSlot(e,i)}
   e.inv[i]={k:'w',w:it.w,r:it.r,mag:it.mag===undefined?wd.mag:it.mag};
   if(!it.d&&wd.ammo){const A=AMMO[wd.ammo];e.ammo[wd.ammo]=Math.min(A.max,e.ammo[wd.ammo]+Math.round(wd.mag*1.6))}
   const cur=e.inv[e.cur];if(!cur||cur.w===0&&cur.k==='w'||cur.k==='i'||e.cur===i||true){this.swapTo(e,i)}
   if(e.local){this.audio.play('pick');if(it.r>=4)this.hud.toast(RARITY[it.r].n+' '+WEAPONS[it.w].n+'!',RARITY[it.r].c)}}
 },
 dropSlot(e,i){const s=e.inv[i];if(!s)return;e.inv[i]=null;if(s.k==='w'&&s.w===0){e.inv[i]=s;return}
  this.dropItem(e,s.k==='w'?{k:'w',w:s.w,r:s.r,mag:s.mag,d:1}:{k:'i',id:s.id,n:s.n});if(e.cur===i){e.cur=this.firstWeaponSlot(e);e.equipT=.3}},
 dropCurrent(e){if(e.cur>0&&e.inv[e.cur])this.dropSlot(e,e.cur)},
 dropItem(e,item){const x=e.pos.x-Math.sin(e.yaw)*1.8,z=e.pos.z-Math.cos(e.yaw)*1.8;const y=W.groundAt(x,z,e.pos.y+1,.3,2)+.1;
  if(this.role==='client'&&e.local)this.net.toHost({t:'drop',item,x,y,z});else this.spawnLoot(item,x,z,y)},
 // host: auto pickup ammo + proximity
 updateLootHost(dt){
  this.accum.loot+=dt;if(this.accum.loot<.2)return;this.accum.loot=0;
  for(const e of this.list){if(!e.alive||e.drop)continue;
   for(const l of this.loot.values()){if(!l.item||l.item.k!=='a')continue;const dx=l.x-e.pos.x,dz=l.z-e.pos.z;if(dx*dx+dz*dz>3.2||Math.abs(l.y-e.pos.y)>2.5)continue;
    const it=l.item;if(e.ammo[it.t]>=AMMO[it.t].max)continue;
    // bots/humans only want ammo they can use or always accept
    this.removeLoot(l.id);this.emit({k:'lt-',id:l.id});if(e.peer!==undefined&&!e.local)this.emit({k:'grant',g:it},e.id);else this.applyGrantLocal(e,it)}}},
 // ---- visuals
 makeLootMesh(l){
  if(!(l.chest||l.ammobox)){const g=makeItemLootVis(l);g.position.set(l.x,l.y,l.z);return g}
  const g=new THREE.Group(),gold=!!l.chest,supply=!!l.supply;
  const wood=gold?(supply?'#a83232':'#8a5a26'):'#526b48',trim=gold?'#f4bd45':'#a8b98b';
  const body=part(g,new THREE.BoxGeometry(1.18,.62,.82),wood,0,.36,0);
  // raised lid, reinforced corner plates, visible front latch and glowing seams
  part(g,new THREE.BoxGeometry(1.24,.18,.88),gold?'#d99a35':'#718c5b',0,.77,0,1,1,1,0,0,0,.15);
  for(const x of[-.53,.53])for(const z of[-.38,.38]){
   part(g,new THREE.BoxGeometry(.12,.78,.12),trim,x,.42,z);
   part(g,new THREE.BoxGeometry(.13,.13,.13),'#30394a',x,.12,z,1,1,1,0,0,0,.55);
  }
  for(const y of[.18,.57])part(g,new THREE.BoxGeometry(1.22,.055,.9),trim,0,y,0);
  part(g,new THREE.BoxGeometry(.22,.24,.08),'#30394a',0,.48,.46,1,1,1,0,0,0,.45);
  part(g,new THREE.BoxGeometry(.1,.16,.045),trim,0,.49,.51,1,1,1,0,0,0,.5);
  // top emblem
  if(gold){part(g,new THREE.CylinderGeometry(.2,.2,.035,6),trim,0,.88,0);part(g,new THREE.OctahedronGeometry(.12),supply?'#ff6a52':'#fff0a0',0,.99,0)}
  else{part(g,new THREE.BoxGeometry(.36,.08,.2),'#d9e7b5',0,.89,0);part(g,new THREE.BoxGeometry(.1,.12,.24),'#d9e7b5',0,.92,0)}
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(gold?.38:.25,gold?.38:.25,18,10,1,true),glowMat(gold?(supply?'#ff4b42':'#ffd23d'):'#9bff78',.15));
  beam.position.y=9;g.add(beam);
  g.userData.crate=true;g.userData.phase=l.id*.91;g.position.set(l.x,l.y,l.z);
  if(supply)g.scale.setScalar(1.45);
  return g;
 },
 updateLootVis(dt){
  this.accum.lv=(this.accum.lv||0)+dt;const cam=this.camera.position;
  if(this.accum.lv>.25){this.accum.lv=0;const R2=(this.settings.dist==='Far'?85:this.settings.dist==='Medium'?65:45)**2;
   for(const l of this.loot.values()){const dx=l.x-cam.x,dz=l.z-cam.z;const near=dx*dx+dz*dz<R2||(l.chest&&dx*dx+dz*dz<(l.supply?40000:3600));
    if(near&&!l.mesh){l.mesh=this.makeLootMesh(l);this.dynamic.add(l.mesh)}else if(!near&&l.mesh){this.dynamic.remove(l.mesh);l.mesh=null}}}
  for(const l of this.loot.values()){
   if(l.mesh&&l.mesh.userData.float)animLootMesh(l.mesh,dt,this.t);
   else if(l.mesh&&l.mesh.userData.crate){const u=l.mesh.userData,p=.5+.5*Math.sin(this.t*2.1+u.phase);l.mesh.rotation.y=Math.sin(this.t*.7+u.phase)*.035;l.mesh.position.y=l.y+Math.sin(this.t*1.8+u.phase)*.045;const beam=l.mesh.children.find(m=>m.geometry&&m.geometry.type==='CylinderGeometry'&&m.position.y>5);if(beam)beam.material.opacity=.1+p*.12}
  }
  // supply drop visuals
  for(const s of this.supplies){const k=clamp((this.t-s.t0)/9,0,1);
   if(!s.mesh&&k<1){const g=new THREE.Group();const c=new THREE.Mesh(new THREE.BoxGeometry(2,1.4,2),mat('#ff3d3d'));g.add(c);const p=new THREE.Mesh(new THREE.SphereGeometry(3.2,14,8,0,6.283,0,1.6),new THREE.MeshLambertMaterial({color:'#ffd23d',side:THREE.DoubleSide}));p.position.y=4.2;g.add(p);for(const[sx,sz]of[[1,1],[-1,1],[1,-1],[-1,-1]]){const r=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,4.4,4),mat('#fff'));r.position.set(sx*1.4,2.2,sz*1.4);r.rotation.z=-sx*.35;r.rotation.x=sz*.35;g.add(r)}
    const b=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,300,8,1,true),new THREE.MeshBasicMaterial({color:'#ff5a3d',transparent:true,opacity:.3,depthWrite:false,fog:false,blending:THREE.AdditiveBlending}));b.position.y=150;g.add(b);s.mesh=g;this.dynamic.add(g)}
   if(s.mesh){const gy=W.H(s.x,s.z);s.mesh.position.set(s.x+Math.sin(this.t)*.6,lerp(s.y0,gy+.7,k),s.z);if(k>=1){this.dynamic.remove(s.mesh);s.mesh=null;s.landed=true}}}
 },
};
