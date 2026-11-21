import * as THREE from 'three';
import {mulberry32,clamp,lerp} from './data.js';
import {MATS} from './materials.js';
export const ISL=300,HALF=430,WATER=0;
const TREE_HP=100;const rockHp=sc=>Math.round(130+50*sc);
export const ROADS=[[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],[2,5],[1,6],[3,7],[4,7],[0,8],[8,3],[8,7],[2,9],[9,12],[12,4],[0,12],[0,10],[10,1],[6,11],[11,3],[5,1]];
export const POIS=[
 {n:'Downtown Dunk',x:0,z:0,r:58,type:'city'},
 {n:'Pleasant Pickle',x:-150,z:95,r:44,type:'suburb'},
 {n:'Salty Shores',x:150,z:115,r:42,type:'town'},
 {n:'Lonely Lodge',x:-125,z:-150,r:36,type:'cabins'},
 {n:'Retail Rodeo',x:135,z:-140,r:44,type:'warehouse'},
 {n:'Misty Mill',x:15,z:190,r:34,type:'town'},
 {n:'Radar Ridge',x:-215,z:-25,r:32,type:'base'},
 {n:'Frosty Fort',x:30,z:-218,r:36,type:'fort'},
 {n:"Mc Dongal's",x:-30,z:-168,r:27,type:'diner'},
 {n:'Sunny Sands',x:195,z:20,r:32,type:'resort'},
 {n:"Farmer's Folly",x:-100,z:5,r:30,type:'farm'},
 {n:'Tomato Town',x:-190,z:-100,r:28,type:'town'},
 {n:'Dusty Depot',x:170,z:-62,r:26,type:'town'},
];
function hash(ix,iz){let h=Math.imul(ix,374761393)^Math.imul(iz,668265263);h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return (h>>>0)/4294967295}
function vnoise(x,z){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;const u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);const a=hash(ix,iz),b=hash(ix+1,iz),c=hash(ix,iz+1),d=hash(ix+1,iz+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
function fbm(x,z){return vnoise(x,z)*.5+vnoise(x*2.1+7,z*2.1+3)*.25+vnoise(x*4.3+1,z*4.3+9)*.125+vnoise(x*8.7,z*8.7)*.0625}
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
function rawH(x,z){
 const r=Math.hypot(x,z),ang=Math.atan2(z,x);
 const edge=ISL*(.8+.22*vnoise(Math.cos(ang)*1.7+10,Math.sin(ang)*1.7+10)+.08*vnoise(ang*4+50,3));
 const L=clamp((edge-r)/60,-1,1);
 let h;
 if(L>0){const s=sstep(0,1,L);h=s*(3+fbm(x*.011,z*.011)*22);
  h+=38*Math.exp(-(((x+75)**2+(z+95)**2)/(2*38*38)))*s;
  h+=18*Math.exp(-(((x+215)**2+(z+25)**2)/(2*34*34)))*s;
  h+=14*Math.exp(-(((x-80)**2+(z-30)**2)/(2*45*45)))*s;
  h-=13*Math.exp(-(((x-95)**2+(z+62)**2)/(2*19*19)))*s;h-=11*Math.exp(-(((x+62)**2+(z-150)**2)/(2*15*15)))*s;h+=9*Math.exp(-(((x-190)**2+(z+40)**2)/(2*22*22)))*s;}
 else h=L*14;
 return h;
}
const poiY=POIS.map(p=>clamp(rawH(p.x,p.z),3,30));
export function H(x,z){
 let h=rawH(x,z);
 for(let i=0;i<POIS.length;i++){const p=POIS[i];const dx=x-p.x,dz=z-p.z;if(dx>p.r*1.3||dx<-p.r*1.3||dz>p.r*1.3||dz<-p.r*1.3)continue;
  const d=Math.hypot(dx,dz);const w=sstep(p.r*1.25,p.r*.85,d);if(w>0)h=lerp(h,poiY[i],w);}
 return h;
}
export function roadDist(x,z){let best=1e9;for(const[a,b]of ROADS){const A=POIS[a],B=POIS[b];const dx=B.x-A.x,dz=B.z-A.z;const l2=dx*dx+dz*dz;let t=((x-A.x)*dx+(z-A.z)*dz)/l2;t=t<0?0:t>1?1:t;const wob=Math.sin(t*9+a*3)*6*Math.sin(t*3.14159);const nx=-dz/Math.sqrt(l2),nz=dx/Math.sqrt(l2);const px=A.x+dx*t+nx*wob,pz=A.z+dz*t+nz*wob;const d=Math.hypot(x-px,z-pz);if(d<best)best=d}return best}
export function slope(x,z){const e=1.2;return [(H(x+e,z)-H(x-e,z))/(2*e),(H(x,z+e)-H(x,z-e))/(2*e)]}
export function poiAt(x,z){for(const p of POIS)if(Math.hypot(x-p.x,z-p.z)<p.r*1.1)return p;return null}
// ---------------- colliders
export const boxes=[],circles=[],lootSpots=[],boxVis=[];
const CELL=16;let grid=new Map();let stamp=0;
const gk=(ix,iz)=>ix*8192+iz;
function gadd(ix,iz,o){const k=gk(ix,iz);let a=grid.get(k);if(!a){a=[];grid.set(k,a)}a.push(o)}
function insertBox(b){const x0=Math.floor(b.x0/CELL),x1=Math.floor(b.x1/CELL),z0=Math.floor(b.z0/CELL),z1=Math.floor(b.z1/CELL);for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++)gadd(i,j,b)}
function insertCircle(c){const x0=Math.floor((c.x-c.r)/CELL),x1=Math.floor((c.x+c.r)/CELL),z0=Math.floor((c.z-c.r)/CELL),z1=Math.floor((c.z+c.r)/CELL);for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++)gadd(i,j,c)}
export function query(x,z,r,out){out.length=0;stamp++;const x0=Math.floor((x-r)/CELL),x1=Math.floor((x+r)/CELL),z0=Math.floor((z-r)/CELL),z1=Math.floor((z+r)/CELL);
 for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++){const a=grid.get(gk(i,j));if(!a)continue;for(let k=0;k<a.length;k++){const o=a[k];if(o._q!==stamp){o._q=stamp;if(!o.gone)out.push(o)}}}return out}
// Destructible parts: every box added while `partMat` is set (building walls, roofs, props, boulders) gets hp.
// Thin ground slabs (floors, paving) are shorter than .2 m and are never destructible.
export const wparts=[];let partMat=null;
const poiMat=t=>(t==='city'||t==='fort'||t==='diner')?'stone':(t==='base'||t==='warehouse')?'metal':'wood';
export let boxInst=null; // instanced mesh of all visible static boxes, so a destroyed box can be hidden
function addBox(x0,y0,z0,x1,y1,z1,color,vis=true){
 const b={x0,y0,z0,x1,y1,z1,c:color,circ:false};
 if(partMat&&y1-y0>=.2){b.pk='box';b.mat=partMat;b.hp=MATS[partMat].hp;b.maxHp=b.hp;b.wi=wparts.length;wparts.push(b)}
 boxes.push(b);insertBox(b);if(vis){b.vi=boxVis.length;boxVis.push(b)}return b}
function wallX(x0,x1,z,y0,H_,openings,color,th=.4){ // wall along x at z (thickness th)
 openings=openings.slice().sort((a,b)=>a.s-b.s);let cur=x0;
 for(const o of openings){if(o.s>cur)addBox(cur,y0,z-th/2,o.s,y0+H_,z+th/2,color);if(o.y0>0)addBox(o.s,y0,z-th/2,o.e,y0+o.y0,z+th/2,color);if(o.y1<H_)addBox(o.s,y0+o.y1,z-th/2,o.e,y0+H_,z+th/2,color);cur=o.e}
 if(cur<x1)addBox(cur,y0,z-th/2,x1,y0+H_,z+th/2,color)}
function wallZ(z0,z1,x,y0,H_,openings,color,th=.4){
 openings=openings.slice().sort((a,b)=>a.s-b.s);let cur=z0;
 for(const o of openings){if(o.s>cur)addBox(x-th/2,y0,cur,x+th/2,y0+H_,o.s,color);if(o.y0>0)addBox(x-th/2,y0,o.s,x+th/2,y0+o.y0,o.e,color);if(o.y1<H_)addBox(x-th/2,y0+o.y1,o.s,x+th/2,y0+H_,o.e,color);cur=o.e}
 if(cur<z1)addBox(x-th/2,y0,cur,x+th/2,y0+H_,z1,color)}
const PAL={wall:['#e8d9b8','#d9c7a0','#cfd8dc','#e6b8a2','#b8c9a8','#d8c0d0','#c9b79c','#aebfd0'],roof:['#8a4b3a','#5b6b7a','#7a5b3a','#4f5f4f','#6a4a5a'],conc:['#9aa0a6','#8b9096','#a7adb3']};
function makeBuilding(rng,cx,cz,w,d,h,doorSide,opts={}){
 const y0=H(cx,cz),wc=opts.color||PAL.wall[Math.floor(rng()*PAL.wall.length)],rc=PAL.roof[Math.floor(rng()*PAL.roof.length)];
 const x0=cx-w/2,x1=cx+w/2,z0=cz-d/2,z1=cz+d/2,th=.4;
 const door=(len,c)=>({s:c-.95,e:c+.95,y0:0,y1:2.7});
 const win=(c)=>({s:c-.8,e:c+.8,y0:1,y1:2.3});
 const sides={n:[],s:[],e:[],w:[]};
 const dc={n:cx,s:cx,e:cz,w:cz};
 sides[doorSide].push(door(0,dc[doorSide]));
 for(const k of ['n','s','e','w']){const len=(k==='n'||k==='s')?w:d;const c=dc[k];if(k!==doorSide){if(len>9&&rng()<.9){sides[k].push(win(c-len*.22));sides[k].push(win(c+len*.22))}else if(rng()<.6)sides[k].push(win(c))}else if(len>12){sides[k].push(win(c-len*.3));sides[k].push(win(c+len*.3))}}
 wallX(x0,x1,z0,y0,h,sides.n,wc,th);wallX(x0,x1,z1,y0,h,sides.s,wc,th);wallZ(z0,z1,x0,y0,h,sides.w,wc,th);wallZ(z0,z1,x1,y0,h,sides.e,wc,th);
 addBox(x0-.3,y0+h,z0-.3,x1+.3,y0+h+.35,z1+.3,rc);
 addBox(x0,y0,z0,x1,y0+.08,z1,'#7b7468',true);
 // props
 const np=Math.floor(rng()*3)+(opts.props||0);
 for(let i=0;i<np;i++){const px=lerp(x0+1.5,x1-1.5,rng()),pz=lerp(z0+1.5,z1-1.5,rng());const s=.7+rng()*.6;addBox(px-s/2,y0,pz-s/2,px+s/2,y0+s,pz+s/2,['#8b6b3e','#6b7a8b','#a05a3c'][i%3])}
 // door outside point
 const dd={n:[cx,z0-2.5],s:[cx,z1+2.5],w:[x0-2.5,cz],e:[x1+2.5,cz]}[doorSide];
 const spots=Math.max(1,Math.floor(w*d/55)+Math.floor(rng()*2));
 for(let i=0;i<spots;i++){lootSpots.push({x:lerp(x0+1.2,x1-1.2,rng()),z:lerp(z0+1.2,z1-1.2,rng()),y:y0+.1,door:dd,inside:true,chest:false,q:opts.q||1})}
 if(rng()<(opts.chest??.65)){const bx=lerp(x0+1.5,x1-1.5,rng());const bz=rng()<.5?z0+1.1:z1-1.1;lootSpots.push({x:bx,z:bz,y:y0+.1,door:dd,inside:true,chest:true,q:opts.q||1})}
 return {x:cx,z:cz,w,d,y0,h,door:dd};
}
export const buildings=[];
function genPOI(rng,p,idx){partMat=poiMat(p.type);try{genPOI_(rng,p,idx)}finally{partMat=null}}
function genPOI_(rng,p,idx){
 const S={city:21,suburb:26,town:24,cabins:28,warehouse:32,base:30,fort:40}[p.type]||24;
 const dirTo=(bx,bz)=>{const dx=p.x-bx,dz=p.z-bz;if(Math.abs(dx)>Math.abs(dz))return dx>0?'e':'w';return dz>0?'s':'n'};
 if(p.type==='fort'){
  const R=24,wh=7,th=1.2,yy=H(p.x,p.z);
  const gap=[{s:p.x-3,e:p.x+3,y0:0,y1:4.5}];
  wallX(p.x-R,p.x+R,p.z-R,yy,wh,gap,PAL.conc[0],th);wallX(p.x-R,p.x+R,p.z+R,yy,wh,gap,PAL.conc[0],th);
  const gz=[{s:p.z-3,e:p.z+3,y0:0,y1:4.5}];wallZ(p.z-R,p.z+R,p.x-R,yy,wh,gz,PAL.conc[1],th);wallZ(p.z-R,p.z+R,p.x+R,yy,wh,gz,PAL.conc[1],th);
  for(const[sx,sz]of[[-1,-1],[1,-1],[-1,1],[1,1]])addBox(p.x+sx*R-4,yy,p.z+sz*R-4,p.x+sx*R+4,yy+11,p.z+sz*R+4,'#7e858c');
  buildings.push(makeBuilding(rng,p.x,p.z,16,14,5,'s',{color:'#cfd8dc',props:3,chest:1,q:1.6,}));
  buildings.push(makeBuilding(rng,p.x-12,p.z+10,8,8,3.6,'e',{q:1.2}));buildings.push(makeBuilding(rng,p.x+12,p.z-10,8,8,3.6,'w',{q:1.2}));
  return}

 const yy0=H(p.x,p.z);
 if(p.type==='diner'){
  const yy=yy0;
  buildings.push(makeBuilding(rng,p.x,p.z,22,13,5,'s',{color:'#f0cf2e',q:2.4,props:4,chest:1}));
  SIGN("MC DONGAL'S",p.x,yy+6.4,p.z+6.75,0,14,2.8,'#d92b2b','#ffd23d');
  addBox(p.x-17,yy,p.z+8.5,p.x+17,yy+.06,p.z+23,'#4a4e55',true);
  for(let i=0;i<6;i++){if(i===3)continue;const cx=p.x-13+i*5.2;const col=['#d33','#37c','#3a5','#ec3','#a4c'][i%5];addBox(cx-.9,yy+.06,p.z+12,cx+.9,yy+1.4,p.z+16.2,col);addBox(cx-.75,yy+1.4,p.z+13,cx+.75,yy+2,p.z+15.2,'#bfe8ff')}
  addBox(p.x+11,yy+3.4,p.z-6,p.x+17,yy+3.7,p.z+7,'#c0392b');for(const[px,pz]of[[11.2,-5.8],[16.6,-5.8],[11.2,6.6],[16.6,6.6]])addBox(p.x+px-.2,yy,p.z+pz-.2,p.x+px+.2,yy+3.4,p.z+pz+.2,'#888');
  addBox(p.x-19.4,yy,p.z+8.6,p.x-18.6,yy+13,p.z+9.4,'#9aa0a6');landmarks.push({k:'burger',x:p.x-19,y:yy+15.2,z:p.z+9});
  for(let i=0;i<3;i++){const tx=p.x-8+i*5;addBox(tx-.7,yy,p.z-9.4,tx+.7,yy+.9,p.z-8.2,'#d33');addBox(tx-.5,yy+.9,p.z-9.2,tx+.5,yy+1.05,p.z-8.4,'#fff')}
  buildings.push(makeBuilding(rng,p.x-15,p.z-9,8,7,3.4,'e',{q:1.4}));
  for(let i=0;i<5;i++)lootSpots.push({x:p.x-14+i*7,z:p.z+19.5,y:yy+.2,inside:false,chest:false,q:1.6});
  return}
 if(p.type==='resort'){
  const yy=yy0;
  const pastel=['#ffb3c7','#b3e5ff','#fff0a8','#c7f0b0'];
  [[-19,-17,'e'],[19,-17,'w'],[-19,17,'e'],[19,17,'w']].forEach((q,i)=>buildings.push(makeBuilding(rng,p.x+q[0],p.z+q[1],10,9,3.8,q[2],{color:pastel[i],q:1.5,props:1,chest:.8})));
  addBox(p.x-6.5,yy,p.z-.7,p.x-5.5,yy+10.5,p.z+.7,'#d8dde2');addBox(p.x+5.5,yy,p.z-.7,p.x+6.5,yy+10.5,p.z+.7,'#d8dde2');addBox(p.x-6.5,yy,p.z-.9,p.x+6.5,yy+.5,p.z+.9,'#c0392b');
  landmarks.push({k:'wheel',x:p.x,y:yy+11,z:p.z});
  standSign('SUNNY SANDS',p.x,p.z+14,0,9,2.2,'#2bb6e0','#fff');
  for(let i=0;i<6;i++){const a=i/6*6.283;addBox(p.x+Math.cos(a)*11-.5,yy,p.z+Math.sin(a)*11-.5,p.x+Math.cos(a)*11+.5,yy+1,p.z+Math.sin(a)*11+.5,i%2?'#ffd23d':'#ff6b9a')}
  return}
 if(p.type==='farm'){
  const yy=yy0;
  buildings.push(makeBuilding(rng,p.x+2,p.z+4,18,12,6,'w',{color:'#b03a2e',q:2.1,props:5,chest:1}));
  buildings.push(makeBuilding(rng,p.x-12,p.z+18,9,8,3.6,'n',{color:'#e8d9b8',q:1.3}));
  addCyl(p.x+16,p.z-8,2.6,yy,yy+11);landmarks.push({k:'silo',x:p.x+16,y:yy,z:p.z-8});addCyl(p.x+16,p.z-2,2.6,yy,yy+11);landmarks.push({k:'silo',x:p.x+16,y:yy,z:p.z-2});
  addCyl(p.x-14,p.z-10,1.9,yy,yy+13);landmarks.push({k:'windmill',x:p.x-14,y:yy,z:p.z-10});
  for(let i=0;i<6;i++)addBox(p.x-4+i*2.4,yy,p.z-16,p.x-2.6+i*2.4,yy+1.3,p.z-14.6,'#d9b84a');
  standSign("FARMER'S FOLLY",p.x+2,p.z+16,0,10,2.2,'#7a4a2a','#ffe9b0');
  return}
 const n=p.type==='cabins'?2:3;
 for(let gx=-n;gx<=n;gx++)for(let gz=-n;gz<=n;gz++){
  const bx=p.x+gx*S+(rng()-.5)*S*.25,bz=p.z+gz*S+(rng()-.5)*S*.25;
  if(Math.hypot(bx-p.x,bz-p.z)>p.r*.88)continue;if(gx===0&&gz===0&&(p.type==='city'||rng()<.5))continue;if(rng()<.12)continue;
  let w,d,h,o={};
  if(p.type==='city'){w=11+rng()*7;d=11+rng()*6;h=rng()<.4?9:4.2;o={q:1.5,props:1};}
  else if(p.type==='warehouse'){w=18+rng()*6;d=12+rng()*5;h=5.5;o={q:1.3,props:3};}
  else if(p.type==='city'){const yy=H(p.x,p.z);addBox(p.x-3.2,yy,p.z-3.2,p.x+3.2,yy+23,p.z+3.2,'#c9c0b0');addBox(p.x-3.8,yy+23,p.z-3.8,p.x+3.8,yy+24,p.z+3.8,'#8a7a66');addBox(p.x-2.4,yy+24,p.z-2.4,p.x+2.4,yy+26,p.z+2.4,'#7a3b2e');addBox(p.x-1,yy+26,p.z-1,p.x+1,yy+28,p.z+1,'#7a3b2e');landmarks.push({k:'clock',x:p.x,y:yy+19,z:p.z,h:3.2});lootSpots.push({x:p.x+4.5,z:p.z+4.5,y:yy+.1,inside:false,chest:true,q:2});}
 if(p.type==='base'){w=12+rng()*6;d=10+rng()*5;h=4.2;o={q:1.4,color:'#9aa6a0',props:2};}
  else if(p.type==='cabins'){w=8+rng()*3;d=7+rng()*3;h=3.4;o={q:1.1,color:'#9b7653'};}
  else if(p.type==='suburb'){w=9+rng()*3;d=8+rng()*3;h=3.5;o={q:1};}
  else {w=9+rng()*4;d=8+rng()*4;h=3.6+(rng()<.2?3:0);o={q:1.1};}
  buildings.push(makeBuilding(rng,bx,bz,w,d,h,dirTo(bx,bz),o));
 }
 if(p.type==='base'){const yy=H(p.x,p.z);addBox(p.x-3,yy,p.z-3,p.x+3,yy+16,p.z+3,'#c0c4c8');addBox(p.x-6,yy+16,p.z-.5,p.x+6,yy+17,p.z+.5,'#e04a4a')}
}
export const landmarks=[];
function addCyl(x,z,r,y0,y1){const c={x,z,r,y0,y1};insertCircle(c);circles.push(c);return c}
const SIGN=(text,x,y,z,rot,w,h,bg,fg)=>landmarks.push({k:'sign',text,x,y,z,rot:rot||0,w,h,bg:bg||'#c0392b',fg:fg||'#fff'});
function standSign(text,x,z,rot,w,h,bg,fg){const pm=partMat;partMat=null;try{standSign_(text,x,z,rot,w,h,bg,fg)}finally{partMat=pm}}
function standSign_(text,x,z,rot,w,h,bg,fg){const y=H(x,z);const c=Math.cos(rot),sn=Math.sin(rot);for(const o of[-w/2+.4,w/2-.4]){addBox(x+c*o-.2,y,z-sn*o-.2,x+c*o+.2,y+h+1.6,z-sn*o+.2,'#6b5a45')}SIGN(text,x,y+1.6+h/2,z,rot,w,h,bg,fg)}
let built=false,treeList=[],rockList=[];
export const decorInst={tree:[],rock:[]}; // instanced meshes + pristine matrices, so felled trees/rocks can be hidden and restored
export function buildMap(){
 if(built)return;built=true;const rng=mulberry32(1337);
 POIS.forEach((p,i)=>genPOI(rng,p,i));
 POIS.forEach(p=>{if(p.type==='fort')return; for(let i=0;i<10;i++){const a=rng()*6.283,r=p.r*(.25+rng()*.7);const cx=p.x+Math.cos(a)*r,cz=p.z+Math.sin(a)*r;if(buildings.some(b=>Math.abs(cx-b.x)<b.w/2+2.5&&Math.abs(cz-b.z)<b.d/2+2.5))continue;const y=H(cx,cz);const sz=1.1+rng()*.9;const col=['#9b6a3a','#7a8a9a','#c0463a','#4a8a5a'][Math.floor(rng()*4)];partMat='stone';addBox(cx-sz/2,y,cz-sz/2,cx+sz/2,y+sz,cz+sz/2,col);if(rng()<.4)addBox(cx-sz/3,y+sz,cz-sz/3,cx+sz/3,y+sz*1.6,cz+sz/3,col);partMat=null}
});
 // lighthouse on the coast
 {let lx=0,lz=0;const a=1.9;for(let r=340;r>120;r-=3){const x=Math.cos(a)*r,z=Math.sin(a)*r;if(H(x,z)>3.4){lx=x;lz=z;break}}const yy=H(lx,lz);addCyl(lx,lz,2.6,yy,yy+24);landmarks.push({k:'lighthouse',x:lx,y:yy,z:lz});lootSpots.push({x:lx+3.5,z:lz,y:yy+.1,inside:false,chest:true,q:1.8})}
 // Mount Muffin summit
 {let bx=-75,bz=-95,bh=-9;for(let x=-115;x<=-35;x+=2)for(let z=-135;z<=-55;z+=2){const hh=H(x,z);if(hh>bh){bh=hh;bx=x;bz=z}}landmarks.push({k:'flag',x:bx,y:bh,z:bz});standSign('MOUNT MUFFIN',bx+3,bz+3,0.6,8,1.8,'#6a5acd','#fff');lootSpots.push({x:bx-2,z:bz+1.5,y:bh+.1,inside:false,chest:true,q:2.4});lootSpots.push({x:bx+1,z:bz-2,y:bh+.1,inside:false,chest:false,q:2})}
 // trees
 for(let x=-ISL-20;x<ISL+20;x+=8)for(let z=-ISL-20;z<ISL+20;z+=8){
  const tx=x+(rng()-.5)*7,tz=z+(rng()-.5)*7;const h=H(tx,tz);if(h<2.6||h>34)continue;
  const f=fbm(tx*.03+40,tz*.03+40);if(f<.46&&rng()<.85)continue;if(f<.52&&rng()<.5)continue;
  let bad=false;for(const p of POIS)if(Math.hypot(tx-p.x,tz-p.z)<p.r*(p.type==='cabins'?.55:1.12)){bad=true;break}if(bad)continue;
  const[gx,gz]=slope(tx,tz);if(Math.hypot(gx,gz)>.7)continue;
  const sc=.8+rng()*.8;const c={x:tx,z:tz,r:.55*sc,y0:h,y1:h+9*sc,tree:true,sc,kind:rng()<.25?1:0,pk:'tree',mat:'tree',hp:TREE_HP,maxHp:TREE_HP,idx:treeList.length};treeList.push(c);insertCircle(c);circles.push(c)}
 for(let i=0;i<160;i++){const a=rng()*6.283,r=Math.sqrt(rng())*ISL*.9;const x=Math.cos(a)*r,z=Math.sin(a)*r;const h=H(x,z);if(h<2.4)continue;let bad=false;for(const p of POIS)if(Math.hypot(x-p.x,z-p.z)<p.r*.9){bad=true;break}if(bad)continue;
  const sc=1+rng()*2.2;const c={x,z,r:1.1*sc,y0:h-1,y1:h+1.3*sc,rock:true,sc,rot:rng()*6,pk:'rock',mat:'rock',hp:rockHp(sc),maxHp:rockHp(sc),idx:rockList.length};rockList.push(c);insertCircle(c);circles.push(c)}
 // outdoor loot spots
 for(const p of POIS){for(let i=0;i<10;i++){const a=rng()*6.283,r=Math.sqrt(rng())*p.r*.9;lootSpots.push({x:p.x+Math.cos(a)*r,z:p.z+Math.sin(a)*r,y:0,inside:false,chest:false,q:.7})}}
 for(let i=0;i<70;i++){const a=rng()*6.283,r=Math.sqrt(rng())*ISL*.85;const x=Math.cos(a)*r,z=Math.sin(a)*r;if(H(x,z)<2.4)continue;lootSpots.push({x,z,y:0,inside:false,chest:false,q:.5})}
 for(const s of lootSpots)if(!s.inside)s.y=H(s.x,s.z)+.1;
 fixLootSpots();
}
// ---- loot spot cleanup + extra chests (runs once after the map is built; uses its own rng so the map layout is unchanged)
function spotBlocked(x,y,z,r){return blocked(x,y,z,r,1.2,.05)}
function nudgeSpot(s,r){ // find a nearby clear position, return true if found
 if(!spotBlocked(s.x,s.y,s.z,r))return true;
 for(let k=1;k<=14;k++){const rad=.6+k*.45;for(let j=0;j<8;j++){const a=j/8*6.283+k;const x=s.x+Math.cos(a)*rad,z=s.z+Math.sin(a)*rad;
  const y=s.inside?s.y:H(x,z)+.1;if(!s.inside&&H(x,z)<2.4)continue;
  if(s.inside&&!insideAnyBuilding(x,z))continue;
  if(!spotBlocked(x,y,z,r)){s.x=x;s.z=z;s.y=y;return true}}}
 return false}
function insideAnyBuilding(x,z){for(const b of buildings)if(Math.abs(x-b.x)<b.w/2-.9&&Math.abs(z-b.z)<b.d/2-.9)return true;return false}
function fixLootSpots(){
 const keep=[];
 for(const s of lootSpots){
  if(!s.inside){ // outdoor: not in water, not on steep cliffs, not inside walls/trees/rocks
   s.y=H(s.x,s.z)+.1;if(s.y<2.4)continue;
   const[gx,gz]=slope(s.x,s.z);if(Math.hypot(gx,gz)>.9)continue}
  if(!nudgeSpot(s,s.chest?.75:.4))continue; // drop spots that are buried in a wall/prop and can't be moved
  keep.push(s)}
 lootSpots.length=0;for(const s of keep)lootSpots.push(s);
 // extra chests: one more in every building that has none, plus outdoor chests scattered around each POI
 const r2=mulberry32(4242);
 for(const b of buildings){
  if(lootSpots.some(s=>s.chest&&s.inside&&Math.abs(s.x-b.x)<b.w/2&&Math.abs(s.z-b.z)<b.d/2))continue;
  if(r2()<.55){const s={x:b.x+(r2()-.5)*(b.w-4),z:b.z+(r2()<.5?-1:1)*(b.d/2-1.1),y:b.y0+.1,door:b.door,inside:true,chest:true,q:1.3};if(nudgeSpot(s,.75))lootSpots.push(s)}}
 for(const p of POIS){
  const n=p.type==='fort'?3:2;let made=0;
  for(let t=0;t<40&&made<n;t++){const a=r2()*6.283,r=p.r*(.3+r2()*.7);const s={x:p.x+Math.cos(a)*r,z:p.z+Math.sin(a)*r,y:0,inside:false,chest:true,q:1.4};
   s.y=H(s.x,s.z)+.1;if(s.y<2.6)continue;const[gx,gz]=slope(s.x,s.z);if(Math.hypot(gx,gz)>.6)continue;
   if(!nudgeSpot(s,.75))continue;if(lootSpots.some(o=>o.chest&&Math.hypot(o.x-s.x,o.z-s.z)<14))continue;lootSpots.push(s);made++}}
 // wilderness chests so the open areas aren't empty
 let w=0;for(let t=0;t<400&&w<18;t++){const a=r2()*6.283,r=Math.sqrt(r2())*ISL*.8;const s={x:Math.cos(a)*r,z:Math.sin(a)*r,y:0,inside:false,chest:true,q:1};
  s.y=H(s.x,s.z)+.1;if(s.y<3)continue;const[gx,gz]=slope(s.x,s.z);if(Math.hypot(gx,gz)>.5)continue;
  if(!nudgeSpot(s,.75))continue;if(lootSpots.some(o=>o.chest&&Math.hypot(o.x-s.x,o.z-s.z)<35))continue;lootSpots.push(s);w++}
}
// ---------------- rays
const _q=[];
export function rayBoxT(b,ox,oy,oz,dx,dy,dz,maxT){let t0=0,t1=maxT;
 const sl=(o,d,mn,mx)=>{if(Math.abs(d)<1e-9){return o>=mn&&o<=mx}let a=(mn-o)/d,c=(mx-o)/d;if(a>c){const t=a;a=c;c=t}if(a>t0)t0=a;if(c<t1)t1=c;return t0<=t1};
 if(!sl(ox,dx,b.x0,b.x1)||!sl(oy,dy,b.y0,b.y1)||!sl(oz,dz,b.z0,b.z1))return Infinity;return t0}
export function rayCircleT(c,ox,oy,oz,dx,dy,dz,maxT){const fx=ox-c.x,fz=oz-c.z;const a=dx*dx+dz*dz;if(a<1e-9)return Infinity;const bb=2*(fx*dx+fz*dz),cc=fx*fx+fz*fz-c.r*c.r;const disc=bb*bb-4*a*cc;if(disc<0)return Infinity;const s=Math.sqrt(disc);let t=(-bb-s)/(2*a);if(t<0)t=(-bb+s)/(2*a);if(t<0||t>maxT)return Infinity;const y=oy+dy*t;if(y<c.y0||y>c.y1)return Infinity;return t}
// returns {t,kind} or null ; kind: 'box','tree','rock','ground'
export function rayWorld(ox,oy,oz,dx,dy,dz,maxT){
 let best=maxT,kind=null,bobj=null;const step=10;
 for(let t=0;t<=maxT+step;t+=step){const px=ox+dx*Math.min(t,maxT),pz=oz+dz*Math.min(t,maxT);query(px,pz,step*.8,_q);
  for(let i=0;i<_q.length;i++){const o=_q[i];const tt=o.circ===false?rayBoxT(o,ox,oy,oz,dx,dy,dz,best):rayCircleT(o,ox,oy,oz,dx,dy,dz,best);if(tt<best){best=tt;bobj=o;kind=o.circ===false?'box':(o.tree?'tree':'rock')}}}
 // terrain
 let prev=0;const st=best>80?2:1;
 for(let t=st;t<=best+st;t+=st){const tt=Math.min(t,best);const y=oy+dy*tt;const h=H(ox+dx*tt,oz+dz*tt);
  if(y<h){let a=prev,b=tt;for(let k=0;k<5;k++){const m=(a+b)/2;if(oy+dy*m<H(ox+dx*m,oz+dz*m))b=m;else a=m}if(b<best){best=b;kind='ground'}break}prev=tt;if(tt>=best)break}
 return kind?{t:best,kind,obj:bobj}:null;
}
export function losClear(ax,ay,az,bx,by,bz){const dx=bx-ax,dy=by-ay,dz=bz-az;const d=Math.hypot(dx,dy,dz);if(d<.01)return true;return !rayWorld(ax,ay,az,dx/d,dy/d,dz/d,d-.3)}
// ---------------- movement collision
const _b=[];
export function groundAt(x,z,feet,r,step=.65){let g=H(x,z);query(x,z,r+1,_b);
 for(let i=0;i<_b.length;i++){const b=_b[i];if(b.circ!==false)continue;if(x+r>b.x0&&x-r<b.x1&&z+r>b.z0&&z-r<b.z1&&b.y1<=feet+step&&b.y1>g)g=b.y1}return g}
export function ceilingAt(x,z,head,r){query(x,z,r+1,_b);let c=Infinity;for(let i=0;i<_b.length;i++){const b=_b[i];if(b.circ!==false)continue;if(x+r>b.x0&&x-r<b.x1&&z+r>b.z0&&z-r<b.z1&&b.y0>=head-.3&&b.y0<c)c=b.y0}return c}
// does cylinder at (x,y,z) radius r height h collide horizontally?
export function blocked(x,y,z,r,h,step=.65){query(x,z,r+1,_b);
 for(let i=0;i<_b.length;i++){const b=_b[i];
  if(b.circ===false){if(x+r>b.x0&&x-r<b.x1&&z+r>b.z0&&z-r<b.z1&&y<b.y1-step&&y+h>b.y0)return true}
  else{const dx=x-b.x,dz=z-b.z,rr=b.r+r;if(dx*dx+dz*dz<rr*rr&&y<b.y1&&y+h>b.y0)return true}}return false}
export function pushOutCircles(e,r,h){query(e.pos.x,e.pos.z,r+3,_b);for(let i=0;i<_b.length;i++){const b=_b[i];if(b.circ===false)continue;const dx=e.pos.x-b.x,dz=e.pos.z-b.z,rr=b.r+r,d2=dx*dx+dz*dz;if(d2<rr*rr&&e.pos.y<b.y1&&e.pos.y+h>b.y0){const d=Math.sqrt(d2)||.001;e.pos.x=b.x+dx/d*rr;e.pos.z=b.z+dz/d*rr}}}
// ---------------- meshes
export function buildMeshes(scene,quality={}){
 const g=new THREE.Group();scene.add(g);
 const N=300,size=HALF*2;
 const geo=new THREE.PlaneGeometry(size,size,N,N);geo.rotateX(-Math.PI/2);
 const pos=geo.attributes.position,col=new Float32Array(pos.count*3);const c=new THREE.Color();
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);const h=H(x,z);pos.setY(i,h);
  const[gx,gz]=slope(x,z);const sl=Math.hypot(gx,gz);const n=fbm(x*.08,z*.08);
  if(h<-.2)c.set('#2d6a8a').lerp(new THREE.Color('#14304a'),clamp(-h/14,0,1));
  else if(h<1.8)c.set('#e3d39a').lerp(new THREE.Color('#d6c283'),n);
  else if(h>34)c.set('#f2f5f7').lerp(new THREE.Color('#cfd8de'),n*.5);
  else if(sl>.75||h>26)c.set('#8b8579').lerp(new THREE.Color('#6f6a60'),n);
  else{const pn=vnoise(x*.035+9,z*.035+4);c.set('#6fc04a').lerp(new THREE.Color('#4a9a38'),n*1.3).lerp(new THREE.Color('#9ad45a'),clamp(.5-n,0,.5)).lerp(new THREE.Color('#3f8a42'),clamp((pn-.5)*2,0,.7)).lerp(new THREE.Color('#b8d860'),clamp((.35-pn)*2,0,.5))}
  if(h>1.8&&h<34){const rd=roadDist(x,z);if(rd<3.4)c.lerp(new THREE.Color(rd<2?'#b09a74':'#9a8c68'),clamp((3.4-rd)/1.4,0,1)*.9)}
  for(const p of POIS){const d=Math.hypot(x-p.x,z-p.z);if(d<p.r*.92&&h>1.8){c.lerp(new THREE.Color(p.type==='suburb'?'#7bb85a':'#9a9a96'),sstep(p.r*.92,p.r*.5,d)*.75)}}
  col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b}
 geo.setAttribute('color',new THREE.BufferAttribute(col,3));geo.computeVertexNormals();
 const terrain=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({vertexColors:true}));terrain.receiveShadow=true;g.add(terrain);
 const water=new THREE.Mesh(new THREE.PlaneGeometry(4000,4000),new THREE.MeshPhongMaterial({color:'#2f86c8',transparent:true,opacity:.82,shininess:90,specular:'#aee'}));water.rotation.x=-Math.PI/2;water.position.y=WATER;g.add(water);
 // boxes
 const bg=new THREE.BoxGeometry(1,1,1),bm=new THREE.MeshLambertMaterial({color:0xffffff});
 const im=new THREE.InstancedMesh(bg,bm,boxVis.length);const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),sc=new THREE.Vector3(),ps=new THREE.Vector3();
 boxVis.forEach((b,i)=>{ps.set((b.x0+b.x1)/2,(b.y0+b.y1)/2,(b.z0+b.z1)/2);sc.set(b.x1-b.x0,b.y1-b.y0,b.z1-b.z0);m4.compose(ps,q,sc);im.setMatrixAt(i,m4);im.setColorAt(i,c.set(b.c))});
 im.instanceMatrix.needsUpdate=true;im.instanceColor.needsUpdate=true;im.castShadow=im.receiveShadow=true;g.add(im);
 boxInst={im,orig:im.instanceMatrix.array.slice()};
 // trees
 const trunkG=new THREE.CylinderGeometry(.22,.32,3,6);trunkG.translate(0,1.5,0);const crownG=new THREE.ConeGeometry(1.7,4.2,7);crownG.translate(0,5,0);const crown2=new THREE.ConeGeometry(1.2,3.2,7);crown2.translate(0,7.2,0);
 const tm=new THREE.InstancedMesh(trunkG,new THREE.MeshLambertMaterial({color:'#6b4a2b'}),treeList.length);
 const cm=new THREE.InstancedMesh(crownG,new THREE.MeshLambertMaterial({color:0xffffff}),treeList.length);
 const cm2=new THREE.InstancedMesh(crown2,new THREE.MeshLambertMaterial({color:0xffffff}),treeList.length);
 treeList.forEach((t,i)=>{ps.set(t.x,t.y0-.2,t.z);sc.set(t.sc,t.sc,t.sc);m4.compose(ps,q,sc);tm.setMatrixAt(i,m4);cm.setMatrixAt(i,m4);cm2.setMatrixAt(i,m4);const cc=t.kind?c.set('#3d7a44').offsetHSL(0,0,hash(i,5)*.06):c.set('#4f9a3a').offsetHSL(0,0,hash(i,9)*.08);cm.setColorAt(i,cc);cm2.setColorAt(i,cc)});
 [tm,cm,cm2].forEach(m=>{m.instanceMatrix.needsUpdate=true;m.castShadow=m.receiveShadow=true;g.add(m)});cm.instanceColor.needsUpdate=true;cm2.instanceColor.needsUpdate=true;
 decorInst.tree=[tm,cm,cm2].map(m=>({m,orig:m.instanceMatrix.array.slice()}));
 const rm=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:'#8a8a85',flatShading:true}),rockList.length);
 rockList.forEach((r,i)=>{ps.set(r.x,r.y0+r.sc*.4,r.z);q.setFromEuler(new THREE.Euler(r.rot,r.rot*2,0));sc.set(r.r*1.05,r.sc*.8,r.r*1.05);m4.compose(ps,q,sc);rm.setMatrixAt(i,m4)});q.identity();rm.castShadow=rm.receiveShadow=true;g.add(rm);
 decorInst.rock=[{m:rm,orig:rm.instanceMatrix.array.slice()}];
 // clouds
 const cg=new THREE.BoxGeometry(1,1,1),cmat=new THREE.MeshBasicMaterial({color:'#fff',transparent:true,opacity:.85,fog:false});const clouds=new THREE.InstancedMesh(cg,cmat,24);
 const r2=mulberry32(5);for(let i=0;i<24;i++){ps.set((r2()-.5)*1400,170+r2()*60,(r2()-.5)*1400);sc.set(60+r2()*80,10+r2()*8,30+r2()*40);m4.compose(ps,q,sc);clouds.setMatrixAt(i,m4)}g.add(clouds);
 return {group:g,water,terrain};
}
export {treeList,rockList};
export function addDecor(scene){
 const rng=mulberry32(77),pts=[];
 for(let i=0;i<1400;i++){const a=rng()*6.283,r=Math.sqrt(rng())*ISL*.92;const x=Math.cos(a)*r,z=Math.sin(a)*r;const h=H(x,z);if(h<2.2||h>30)continue;if(roadDist(x,z)<4)continue;let bad=false;for(const p of POIS)if(Math.hypot(x-p.x,z-p.z)<p.r*.8){bad=true;break}if(bad)continue;pts.push([x,h,z,.6+rng()*.9,rng()])}
 const g=new THREE.IcosahedronGeometry(1,0),m=new THREE.InstancedMesh(g,new THREE.MeshLambertMaterial({color:0xffffff,flatShading:true}),pts.length);
 const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),sc=new THREE.Vector3(),ps=new THREE.Vector3(),c=new THREE.Color();
 pts.forEach((p,i)=>{ps.set(p[0],p[1]+p[3]*.35,p[2]);sc.set(p[3],p[3]*.7,p[3]);m4.compose(ps,q,sc);m.setMatrixAt(i,m4);m.setColorAt(i,p[4]<.12?c.set('#ff7ab8'):p[4]<.2?c.set('#ffd84a'):c.set('#3f9a3a').offsetHSL(0,0,(p[4]-.5)*.12))});
 m.instanceMatrix.needsUpdate=true;m.instanceColor.needsUpdate=true;scene.add(m);

 const anim=[];const mk=(g,c,x,y,z,sx,sy,sz,rx,ry,rz,em)=>{const m=new THREE.Mesh(g,new THREE.MeshLambertMaterial(Object.assign({color:c,flatShading:true},em?{emissive:em,emissiveIntensity:.8}:{})));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.set(rx||0,ry||0,rz||0);return m};
 const BX=new THREE.BoxGeometry(1,1,1),CY=new THREE.CylinderGeometry(.5,.5,1,18),SP=new THREE.SphereGeometry(.5,16,12),TO=new THREE.TorusGeometry(1,.04,6,40);
 const signTex=(text,bg,fg)=>{const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,512,128);x.strokeStyle=fg;x.lineWidth=8;x.strokeRect(6,6,500,116);x.fillStyle=fg;x.font='900 64px Arial Black,Impact,sans-serif';x.textAlign='center';x.textBaseline='middle';let fs=64;while(x.measureText(text).width>470&&fs>20){fs-=4;x.font='900 '+fs+'px Arial Black,Impact,sans-serif'}x.fillText(text,256,68);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t};
 const clockTex=()=>{const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#f5efe0';x.beginPath();x.arc(128,128,124,0,6.283);x.fill();x.strokeStyle='#222';x.lineWidth=8;x.stroke();x.fillStyle='#222';for(let i=0;i<12;i++){const a=i/12*6.283;x.fillRect(128+Math.sin(a)*100-4,128-Math.cos(a)*100-4,8,8)}x.lineWidth=10;x.lineCap='round';x.beginPath();x.moveTo(128,128);x.lineTo(128,60);x.stroke();x.beginPath();x.moveTo(128,128);x.lineTo(176,150);x.stroke();const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t};
 for(const l of landmarks){
  const g=new THREE.Group();g.position.set(l.x,l.y,l.z);
  if(l.k==='sign'){const m=new THREE.Mesh(new THREE.PlaneGeometry(l.w,l.h),new THREE.MeshBasicMaterial({map:signTex(l.text,l.bg,l.fg),side:THREE.DoubleSide}));m.rotation.y=l.rot;m.position.set(l.x,l.y,l.z);scene.add(m);continue}
  if(l.k==='clock'){const tex=clockTex();for(const[ox,oz,ry]of[[0,3.25,0],[0,-3.25,Math.PI],[3.25,0,Math.PI/2],[-3.25,0,-Math.PI/2]]){const m=new THREE.Mesh(new THREE.PlaneGeometry(l.h*1.6,l.h*1.6),new THREE.MeshBasicMaterial({map:tex,transparent:true}));m.position.set(ox,0,oz);m.rotation.y=ry;g.add(m)}scene.add(g);continue}
  if(l.k==='burger'){const bg=new THREE.Group();bg.add(mk(CY,'#e0a050',0,0,0,4.6,1,4.6));bg.add(mk(CY,'#5a3418',0,.85,0,4.8,.8,4.8));bg.add(mk(BX,'#ffd23d',0,1.35,0,4.9,.22,4.9));bg.add(mk(CY,'#58c04a',0,1.6,0,5.2,.4,5.2));bg.add(mk(CY,'#e03a2a',0,2,0,4.8,.35,4.8));bg.add(mk(SP,'#e8a04a',0,2.5,0,4.9,3.4,4.9));for(let i=0;i<7;i++){const a=i*.9;bg.add(mk(SP,'#fff3d0',Math.cos(a)*1.4,3.5+Math.sin(i*2)*.15,Math.sin(a)*1.4,.35,.2,.35))}g.add(bg);scene.add(g);anim.push(t=>{bg.rotation.y=t*.9;bg.position.y=Math.sin(t*1.6)*.25});continue}
  if(l.k==='wheel'){const w=new THREE.Group();w.add(mk(TO,'#ffffff',0,0,0,8,8,8,0,0,0));w.children[0].scale.set(8,8,8);const gl=[];for(let i=0;i<8;i++){const sp=mk(BX,'#e0e6ee',0,0,0,.15,16,.15,0,0,i/8*Math.PI);w.add(sp)}for(let i=0;i<12;i++){const a=i/12*6.283;const gd=new THREE.Group();gd.position.set(Math.cos(a)*8,Math.sin(a)*8,0);gd.add(mk(BX,['#ff4a8a','#ffd23d','#3dd0ff','#6aff8a'][i%4],0,-.8,0,1.6,1.1,1.4));w.add(gd);gl.push(gd)}g.add(w);scene.add(g);anim.push(t=>{w.rotation.z=t*.22;for(const d of gl)d.rotation.z=-w.rotation.z});continue}
  if(l.k==='windmill'){g.add(mk(CY,'#e8dcc0',0,6.5,0,3.4,13,3.4));g.children[0].scale.set(3.4,13,3.4);g.add(mk(SP,'#8a3a2a',0,13.2,0,3.2,2.4,3.2));const bl=new THREE.Group();bl.position.set(0,13,2);for(let i=0;i<4;i++){const b=mk(BX,'#f4f0e6',0,0,0,1.1,7.5,.15,0,0,i*Math.PI/2);b.position.set(-Math.sin(i*Math.PI/2)*3.9,Math.cos(i*Math.PI/2)*3.9,0);bl.add(b)}g.add(bl);scene.add(g);anim.push(t=>{bl.rotation.z=t*.7});continue}
  if(l.k==='silo'){g.add(mk(CY,'#d5dadf',0,5.5,0,5.2,11,5.2));g.add(mk(SP,'#c0392b',0,11,0,5.2,2.6,5.2));scene.add(g);continue}
  if(l.k==='lighthouse'){for(let i=0;i<4;i++){const r=4.8-i*.55;g.add(mk(CY,i%2?'#d93a3a':'#f6f6f6',0,i*5.5+2.75,0,r,5.5,r))}g.add(mk(CY,'#333',0,22.2,0,5,.5,5));g.add(mk(CY,'#fff7a0',0,23.4,0,2.2,2,2.2,0,0,0,'#ffe066'));g.add(mk(SP,'#d93a3a',0,25,0,3,2.4,3));const beam=new THREE.Mesh(new THREE.BoxGeometry(60,1.2,2.6),new THREE.MeshBasicMaterial({color:'#fff3a0',transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));beam.position.set(0,23.4,0);g.add(beam);scene.add(g);anim.push(t=>{beam.rotation.y=t*1.2});continue}
  if(l.k==='flag'){g.add(mk(CY,'#cfcfcf',0,5,0,.25,10,.25));const cl=mk(BX,'#ff3d6a',1.4,9,0,2.8,1.8,.08);g.add(cl);scene.add(g);anim.push(t=>{cl.rotation.y=Math.sin(t*3)*.25;cl.scale.x=2.8+Math.sin(t*5)*.15});continue}
 }
 return {update(t){for(const a of anim)a(t)}}
}

// ---------------- building support
// runtime solids (player-built pieces). Removed boxes keep a `gone` flag so grid cells that still list them skip them.
export function addSolid(b){b.circ=false;b.gone=false;boxes.push(b);insertBox(b);return b}
export function removeSolid(b){b.gone=true;const i=boxes.indexOf(b);if(i>=0)boxes.splice(i,1)}
// hide a destroyed static box's instance (zero matrix)
export function hideBox(b){if(!boxInst||b.vi===undefined)return;boxInst.im.instanceMatrix.array.fill(0,b.vi*16,b.vi*16+16);boxInst.im.instanceMatrix.needsUpdate=true}
// true if the axis-aligned box overlaps any solid (static boxes, cylinders, pieces)
export function overlapsSolid(x0,y0,z0,x1,y1,z1){
 const cx=(x0+x1)/2,cz=(z0+z1)/2,r=Math.max(x1-x0,z1-z0)/2+1;query(cx,cz,r,_b);
 for(let i=0;i<_b.length;i++){const b=_b[i];
  if(b.circ===false){if(x1>b.x0&&x0<b.x1&&z1>b.z0&&z0<b.z1&&y1>b.y0&&y0<b.y1)return true}
  else{const nx=Math.max(x0,Math.min(b.x,x1)),nz=Math.max(z0,Math.min(b.z,z1));if((nx-b.x)**2+(nz-b.z)**2<b.r*b.r&&y1>b.y0&&y0<b.y1)return true}}
 return false}
// hide a tree or rock: zero its instance matrices and drop its collider
export function removeDecor(kind,c){
 if(!c||c.gone)return;c.gone=true;const arr=kind==='tree'?treeList:rockList;const i=arr.indexOf(c);if(i<0)return;
 for(const d of decorInst[kind]){d.m.instanceMatrix.array.fill(0,i*16,i*16+16);d.m.instanceMatrix.needsUpdate=true}}
// put every felled tree and rock back (between matches)
export function restoreDecor(){
 for(const kind of['tree','rock'])for(const d of decorInst[kind]){d.m.instanceMatrix.array.set(d.orig);d.m.instanceMatrix.needsUpdate=true}
 for(const c of[...treeList,...rockList]){c.gone=false;c.dead=false;c.hp=c.maxHp}
 for(const b of wparts){if(b.gone){b.gone=false;boxes.push(b)}b.dead=false;b.hp=b.maxHp}
 if(boxInst){boxInst.im.instanceMatrix.array.set(boxInst.orig);boxInst.im.instanceMatrix.needsUpdate=true}}
