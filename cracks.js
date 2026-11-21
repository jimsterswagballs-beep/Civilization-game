// Crack overlays for damaged parts. A damaged part gets a transparent overlay a little larger than
// itself, with a procedural crack texture that gets busier as its hp drops (stages 1 to 3).
import * as THREE from 'three';

const live=new Map();            // key -> {m, stage}
const stageMats=[];
const unitBox=new THREE.BoxGeometry(1,1,1);
const unitCyl=new THREE.CylinderGeometry(1,1,1,10,1,true);
const unitRock=new THREE.DodecahedronGeometry(1,0);
const LINES=[5,10,16];           // crack count per stage

function makeTexture(stage){
 const cv=document.createElement('canvas');cv.width=cv.height=256;const g=cv.getContext('2d');
 g.lineCap='round';g.lineJoin='round';
 for(let i=0;i<LINES[stage-1];i++){
  let x=Math.random()*256,y=Math.random()*256,a=Math.random()*6.283;
  const len=50+Math.random()*110,steps=5+Math.floor(Math.random()*3);
  g.strokeStyle=`rgba(20,14,8,${(.7+Math.random()*.3).toFixed(2)})`;g.lineWidth=1.2+Math.random()*1.8;
  g.beginPath();g.moveTo(x,y);
  for(let s=0;s<steps;s++){
   a+=(Math.random()-.5)*1.1;x+=Math.cos(a)*len/steps;y+=Math.sin(a)*len/steps;g.lineTo(x,y);
   if(stage>1&&Math.random()<.4){ // side branch
    g.stroke();g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a+1.2)*len*.6/steps,y+Math.sin(a+1.2)*len*.6/steps);g.stroke();g.beginPath();g.moveTo(x,y)}
  }
  g.stroke()}
 return new THREE.CanvasTexture(cv)}

function stageMat(stage){
 if(!stageMats[stage])stageMats[stage]=new THREE.MeshBasicMaterial({map:makeTexture(stage),transparent:true,depthWrite:false,
  polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,fog:false});
 return stageMats[stage]}

// 0 = undamaged, 1 = light cracks (below 75% hp), 2 = medium (below 50%), 3 = heavy (below 25%)
export function stageFor(T){const f=T.hp/T.maxHp;return f>.75?0:f>.5?1:f>.25?2:3}

function setCrack(scene,key,geo,pos,rot,scl,stage){
 if(stage<=0){removeCrack(key);return}
 const c=live.get(key);
 if(!c){const m=new THREE.Mesh(geo,stageMat(stage));m.position.set(pos[0],pos[1],pos[2]);m.rotation.set(rot[0],rot[1],rot[2]);m.scale.set(scl[0],scl[1],scl[2]);m.renderOrder=4;scene.add(m);live.set(key,{m,stage});return}
 if(c.stage!==stage){c.m.material=stageMat(stage);c.stage=stage}}

export function removeCrack(key){
 const c=live.get(key);if(!c)return;
 if(c.m.parent)c.m.parent.remove(c.m);
 live.delete(key)}

export function clearCracks(){for(const k of[...live.keys()])removeCrack(k)}

// a static or player-built box
export function boxCrack(scene,key,b,stage){
 setCrack(scene,key,unitBox,[(b.x0+b.x1)/2,(b.y0+b.y1)/2,(b.z0+b.z1)/2],[0,0,0],
  [(b.x1-b.x0)*1.03,(b.y1-b.y0)*1.03,(b.z1-b.z0)*1.03],stage)}

// a tree (trunk only) or a rock; the geometry matches how buildMeshes placed the instances
export function circCrack(scene,c,stage){
 if(c.pk==='tree')setCrack(scene,'t'+c.idx,unitCyl,[c.x,c.y0-.2+1.5*c.sc,c.z],[0,0,0],[.42*c.sc,3*c.sc,.42*c.sc],stage);
 else setCrack(scene,'r'+c.idx,unitRock,[c.x,c.y0+c.sc*.4,c.z],[c.rot,c.rot*2,0],[c.r*1.155,c.sc*.88,c.r*1.155],stage)}
