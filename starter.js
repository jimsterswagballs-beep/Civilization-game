// Starter Island: the walkable waiting area behind the title and party lobby screens.
// The player's hero stands on the plaza, the party's Battle Bus is parked on the north side of the island,
// and "Play" flies the bus off with the hero aboard before the match starts (see App.boardThen).
import * as THREE from 'three';
import {charTex,makeBusModel} from './shared.js';

const ISLAND_R=40;               // walkable radius
const sstep=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
const hash=(i,j)=>{let h=Math.imul(i,374761393)^Math.imul(j,668265263);h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return (h>>>0)/4294967295};
const vnoise=(x,z)=>{const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;const u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
 const a=hash(ix,iz),b=hash(ix+1,iz),c=hash(ix,iz+1),d=hash(ix+1,iz+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v};

// flat plateau in the middle, bumpy grass, sloping down into the sea past r = 33
export function islandH(x,z){
 const r=Math.hypot(x,z);
 let h=3.4-5*sstep(33,46,r);
 h+=(vnoise(x*.09+3,z*.09+7)-.5)*1.1*sstep(8,20,r)*(1-sstep(24,34,r));
 return h}

const M=(c,opts={})=>new THREE.MeshLambertMaterial(Object.assign({color:c,flatShading:true},opts));
const sunTint=['#ffeac4'];
// a name label that always faces the camera (canvas texture on a sprite)
function nameTag(name,col){
 const cv=document.createElement('canvas');cv.width=256;cv.height=64;const x=cv.getContext('2d');
 const label=String(name||'Player').slice(0,16);
 x.font='bold 26px Arial Black, Arial';x.textAlign='center';x.textBaseline='middle';x.lineWidth=6;x.strokeStyle='rgba(0,0,0,.85)';
 x.strokeText(label,128,34);x.fillStyle=col||'#ffffff';x.fillText(label,128,34);
 const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),transparent:true,depthWrite:false}));
 s.scale.set(3,.75,1);s.position.y=2.45;return s}

export class StarterIsland{
 constructor(renderer,input){
  this.renderer=renderer;this.input=input;
  this.scene=new THREE.Scene();
  this.scene.fog=new THREE.Fog('#b9dcf5',110,520);
  this.camera=new THREE.PerspectiveCamera(50,1,.1,1200);
  this.camYaw=0;this.camPos=new THREE.Vector3(0,6,12);
  this.t=0;this.heroYaw=Math.PI;this.dance=0;this.char=null;this.view='front';this.boardT=null;this.onBoard=null;
  this.crowd=[];this.hero=new THREE.Group();this.scene.add(this.hero);
  this.buildLights();this.buildSky();this.buildIsland();this.buildDecor();this.buildBus();this.buildHero();
  this.reset();
 }

 buildLights(){
  this.scene.add(new THREE.HemisphereLight('#dcecff','#76865c',1.25));
  const sun=new THREE.DirectionalLight(sunTint[0],2);sun.position.set(60,90,40);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);const sc=sun.shadow.camera;sc.left=-60;sc.right=60;sc.top=60;sc.bottom=-60;sc.near=1;sc.far=400;sc.updateProjectionMatrix();
  sun.shadow.bias=-5e-4;sun.shadow.normalBias=.4;this.scene.add(sun);this.scene.add(sun.target);
 }

 buildSky(){
  const mat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
   vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:'varying vec3 vP;void main(){vec3 d=normalize(vP);float h=d.y;vec3 top=vec3(.2,.48,.92),hz=vec3(.725,.863,.961),bot=vec3(.75,.88,.95);vec3 c=h>0.?mix(hz,top,pow(h,.6)):mix(hz,bot,min(1.,-h*3.));gl_FragColor=vec4(c,1.);}'});
  this.sky=new THREE.Mesh(new THREE.SphereGeometry(900,24,16),mat);this.scene.add(this.sky);
  // a few slow clouds
  this.clouds=[];const cm=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.85,fog:false});
  for(let i=0;i<9;i++){const c=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),cm);
   const a=i/9*6.283+hash(i,3),d=260+hash(i,5)*200;c.position.set(Math.cos(a)*d,130+hash(i,9)*40,Math.sin(a)*d);
   c.scale.set(60+hash(i,1)*80,10+hash(i,2)*6,30+hash(i,4)*40);this.scene.add(c);this.clouds.push(c)}
 }

 buildIsland(){
  const seg=110,size=96;const geo=new THREE.PlaneGeometry(size,size,seg,seg);geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position,col=new Float32Array(pos.count*3),c=new THREE.Color();
  for(let i=0;i<pos.count;i++){
   const x=pos.getX(i),z=pos.getZ(i),h=islandH(x,z);pos.setY(i,h);
   const sl=Math.hypot(islandH(x+.6,z)-islandH(x-.6,z),islandH(x,z+.6)-islandH(x,z-.6))/1.2;
   if(h<.9)c.set('#e3d39a').lerp(new THREE.Color('#c9b57a'),sstep(-.5,.9,h)*.4);
   else if(sl>.55)c.set('#8b8579').lerp(new THREE.Color('#6f6a60'),vnoise(x*.3,z*.3));
   else c.set('#6fc04a').lerp(new THREE.Color('#4a9a38'),vnoise(x*.15+4,z*.15)).lerp(new THREE.Color('#9ad45a'),vnoise(x*.4,z*.4+9)*.5);
   col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b}
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));geo.computeVertexNormals();
  const land=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({vertexColors:true}));land.receiveShadow=true;this.scene.add(land);
  const water=new THREE.Mesh(new THREE.CircleGeometry(420,48),new THREE.MeshPhongMaterial({color:'#2f86c8',transparent:true,opacity:.86,shininess:90,specular:'#aee'}));
  water.rotation.x=-Math.PI/2;water.position.y=-.2;this.scene.add(water);this.water=water;
  // plaza ring under the hero's pad
  const ring=new THREE.Mesh(new THREE.RingGeometry(3.4,4.1,48),new THREE.MeshBasicMaterial({color:'#2ad4ff',transparent:true,opacity:.8,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;ring.position.y=islandH(0,0)+.06;this.scene.add(ring);this.padRing=ring;
  const disc=new THREE.Mesh(new THREE.CircleGeometry(3.4,48),new THREE.MeshBasicMaterial({color:'#1d3c6b',transparent:true,opacity:.6,depthWrite:false}));
  disc.rotation.x=-Math.PI/2;disc.position.y=islandH(0,0)+.05;this.scene.add(disc);
 }

 buildDecor(){
  const leafGeo=new THREE.ConeGeometry(.55,3.2,4);leafGeo.rotateX(Math.PI/2);const leafMat=M('#3f9a3a');
  const trunkMat=M('#8a5a2b');
  const palm=(x,z,s)=>{const g=new THREE.Group();g.position.set(x,islandH(x,z),z);
   const lean=(hash(x|0,z|0)-.5)*.35;
   const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18*s,.28*s,5.5*s,7),trunkMat);trunk.position.y=2.75*s;trunk.rotation.z=lean;trunk.castShadow=true;g.add(trunk);
   const top=new THREE.Group();top.position.set(lean*2.75*s,5.5*s,0);g.add(top);
   for(let i=0;i<6;i++){const piv=new THREE.Group();piv.rotation.y=i/6*6.283;piv.rotation.x=-.35;
    const lf=new THREE.Mesh(leafGeo,leafMat);lf.scale.set(s,s,s);lf.position.set(0,0,1.6*s);lf.castShadow=true;piv.add(lf);top.add(piv)}
   this.scene.add(g)};
  const pts=[[-24,-6],[22,-12],[26,8],[-20,18],[10,26],[-30,-22],[30,-30],[-8,-26],[16,-28],[-34,6],[34,14],[4,34]];
  for(const[x,z]of pts)palm(x,z,.9+hash(x|0,z|0)*.35);
  // rocks on the shore
  const rockGeo=new THREE.DodecahedronGeometry(1,0);const rockMat=M('#8a8a85');
  for(let i=0;i<16;i++){const a=i/16*6.283+hash(i,7)*.4,d=27+hash(i,8)*9;const x=Math.cos(a)*d,z=Math.sin(a)*d;
   const s=.9+hash(i,11)*1.6;const m=new THREE.Mesh(rockGeo,rockMat);m.scale.set(s,s*.7,s);m.position.set(x,islandH(x,z)+s*.2,z);m.rotation.set(hash(i,2)*3,hash(i,4)*3,0);m.castShadow=true;this.scene.add(m)}
  // a small cabin with a pyramid roof, door facing the plaza
  const cabinX=-15,cabinZ=8,cy=islandH(cabinX,cabinZ);
  const cabin=new THREE.Group();cabin.position.set(cabinX,cy,cabinZ);cabin.rotation.y=Math.atan2(-cabinX,-cabinZ);this.scene.add(cabin);
  const bx=(c,w,h,d,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),M(c));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;cabin.add(m);return m};
  bx('#e8d9b8',6,3,5,0,1.5,0);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(4.7,2.2,4),M('#8a4b3a'));roof.rotation.y=Math.PI/4;roof.position.y=4.1;roof.castShadow=true;cabin.add(roof);
  bx('#5a3418',1,2,.12,0,1,2.52);bx('#bfe8ff',1.2,1,.12,-2,1.7,2.52);bx('#bfe8ff',1.2,1,.12,2,1.7,2.52);
  // training dummies (visual only)
  for(const[x,z]of[[7,-7],[9.5,-5],[11,-9]]){const y=islandH(x,z);
   const body=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,1.7,10),M('#e8d9b8'));body.position.set(x,y+.85,z);body.castShadow=true;this.scene.add(body);
   const tg=new THREE.Mesh(new THREE.CircleGeometry(.36,24),new THREE.MeshBasicMaterial({color:'#e2432b'}));tg.position.set(x,y+1.3,z+.41);this.scene.add(tg)}
 }

 buildBus(){
  this.bus=makeBusModel();this.busGroup=this.bus.group;this.busProp=this.bus.prop;
  this.busGroup.scale.setScalar(1.05);this.scene.add(this.busGroup);
  // parked on the plaza's north side, nose towards the sea
  this.busHome=new THREE.Vector3(0,islandH(0,-22)+1.9,-22);
  this.busGroup.rotation.y=Math.PI;
  // runway strip under the bus
  const strip=new THREE.Mesh(new THREE.BoxGeometry(6,.3,18),M('#4b4f58'));strip.position.set(0,islandH(0,-22)+.02,-22);strip.receiveShadow=true;this.scene.add(strip);
 }

 buildHero(){
  this.heroSprite=new THREE.Group();this.hero.add(this.heroSprite);
  this.heroMat=new THREE.MeshBasicMaterial({transparent:true,alphaTest:.35,side:THREE.DoubleSide});
  this.heroPlane=new THREE.Mesh(new THREE.PlaneGeometry(2.1,2.1),this.heroMat);this.heroPlane.position.y=.88;this.heroSprite.add(this.heroPlane);
  this.shadow=new THREE.Mesh(new THREE.CircleGeometry(.6,20),new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.32,depthWrite:false}));
  this.shadow.rotation.x=-Math.PI/2;this.shadow.position.y=.04;this.scene.add(this.shadow);
 }

 setChar(id){
  this.char=id;this.heroMat.map=charTex(id,this.view);this.heroMat.needsUpdate=true;
 }
 setView(v){
  if(v===this.view)return;this.view=v;this.heroMat.map=charTex(this.char,v);this.heroMat.needsUpdate=true;
 }

 reset(){
  this.boardT=null;this.onBoard=null;this.hero.visible=true;this.busGroup.visible=true;
  this.busGroup.position.copy(this.busHome);this.busGroup.position.y=this.busHome.y;
  this.hero.position.set(0,islandH(0,0),0);this.heroYaw=Math.PI;
 }

 // Play pressed: the bus drives off with the hero aboard; onDone runs when the animation is over
 board(onDone){
  this.boardT=0;this.onBoard=onDone;this.busGroup.position.copy(this.busHome);this.busGroup.visible=true;
 }

 update(dt,charId){
  if(charId!==this.char)this.setChar(charId);
  this.t+=dt;
  const keys=this.input.keys,pr=this.input.pr;
  // boarding animation
  if(this.boardT!==null){
   this.boardT+=dt;const p=this.boardT;
   const v=4+p*p*16;
   this.busGroup.position.z-=v*dt;this.busGroup.position.y+=dt*p*1.2;
   if(p>.9)this.hero.visible=false;
   const bp=this.busGroup.position;
   this.camPos.lerp(new THREE.Vector3(bp.x,bp.y+6,bp.z+18),Math.min(1,dt*3));
   this.camera.position.copy(this.camPos);this.camera.lookAt(bp.x,bp.y+1.5,bp.z);
   this.sky.position.copy(this.camera.position);
   if(p>2.4){const cb=this.onBoard;this.boardT=null;this.onBoard=null;if(cb)cb()}
   this.animateWorld(dt);return;
  }
  // turn the camera with the arrow keys
  if(keys.has('ArrowLeft'))this.camYaw+=dt*2.2;
  if(keys.has('ArrowRight'))this.camYaw-=dt*2.2;
  // walk relative to the camera
  const f=(this.input.down('fwd')?1:0)-(this.input.down('back')?1:0);
  const s=(this.input.down('right')?1:0)-(this.input.down('left')?1:0);
  let dx=-Math.sin(this.camYaw)*f+Math.cos(this.camYaw)*s,dz=-Math.cos(this.camYaw)*f-Math.sin(this.camYaw)*s;
  const len=Math.hypot(dx,dz);
  if(len>.01){
   dx/=len;dz/=len;
   const sp=5.8*(this.input.down('sprint')?1.6:1)*(this.dance>0?0:1);
   this.hero.position.x+=dx*sp*dt;this.hero.position.z+=dz*sp*dt;
   const target=Math.atan2(-dx,-dz);let d=target-this.heroYaw;while(d>Math.PI)d-=6.2832;while(d<-Math.PI)d+=6.2832;
   this.heroYaw+=d*Math.min(1,dt*12);
  }
  if(pr.has('KeyG')&&this.dance<=0)this.dance=1.6;
  if(this.dance>0)this.dance-=dt;
  // stay on the island
  const hr=Math.hypot(this.hero.position.x,this.hero.position.z);
  if(hr>ISLAND_R){const k=ISLAND_R/hr;this.hero.position.x*=k;this.hero.position.z*=k}
  const hx=this.hero.position.x,hz=this.hero.position.z;
  const groundY=islandH(hx,hz);
  const bob=len>.01?Math.abs(Math.sin(this.t*9))*.12:Math.sin(this.t*2)*.03;
  const hop=this.dance>0?Math.abs(Math.sin(this.t*9))*.6:0;
  this.hero.position.y=groundY+hop;
  this.heroSprite.position.y=bob;
  this.hero.rotation.y=0;
  this.shadow.position.set(hx,groundY+.04,hz);
  // the sprite faces the camera; its view (front / side / back) follows where the hero is facing
  const cx=this.camera.position.x,cz=this.camera.position.z;
  const toCam=Math.atan2(cx-hx,cz-hz);
  this.heroSprite.rotation.y=toCam;
  const fx=-Math.sin(this.heroYaw),fz=-Math.cos(this.heroYaw);
  const tcx=Math.sin(toCam),tcz=Math.cos(toCam);
  const facing=fx*tcx+fz*tcz;
  const view=facing>.55?'front':facing<-.55?'back':'side';
  this.setView(view);
  this.heroPlane.scale.x=(view==='side'&&fx*tcz-fz*tcx<0)?-1:1;
  // third-person camera behind the hero
  const want=new THREE.Vector3(hx+Math.sin(this.camYaw)*7,groundY+3.2,hz+Math.cos(this.camYaw)*7);
  this.camPos.lerp(want,Math.min(1,dt*8));
  this.camera.position.copy(this.camPos);
  this.camera.lookAt(hx,groundY+1.5,hz);
  this.sky.position.copy(this.camera.position);
  this.animateWorld(dt);
 }

 // ---- crowd: the other players, standing and wandering on the island during the intermission
 setCrowd(list){
  this.clearCrowd();
  const geo=this.crowdGeo||(this.crowdGeo=new THREE.PlaneGeometry(2.1,2.1));
  for(const p of list){
   const g=new THREE.Group();
   const mat=new THREE.MeshBasicMaterial({map:charTex(p.char,'front'),transparent:true,alphaTest:.35,side:THREE.DoubleSide});
   const plane=new THREE.Mesh(geo,mat);plane.position.y=.88;g.add(plane);
   const tag=nameTag(p.name,p.nameColor||(p.cos&&p.cos.nameColor));g.add(tag);
   const s=this.spot();g.position.set(s.x,islandH(s.x,s.z),s.z);this.scene.add(g);
   this.crowd.push({g,plane,tag,mat,x:s.x,z:s.z,tx:s.x,tz:s.z,wait:Math.random()*2,speed:1.6+Math.random()*1.2,ph:Math.random()*6.28})}
 }
 clearCrowd(){
  for(const c of this.crowd){this.scene.remove(c.g);c.mat.dispose();c.tag.material.map.dispose();c.tag.material.dispose()}
  this.crowd=[];
 }
 // a random spot on the plateau, away from the sea
 spot(){
  for(let i=0;i<30;i++){const a=Math.random()*6.2832,r=5+Math.sqrt(Math.random())*24,x=Math.cos(a)*r,z=Math.sin(a)*r;if(islandH(x,z)>1)return{x,z}}
  return{x:0,z:-8}
 }
 updateCrowd(dt){
  if(!this.crowd.length)return;
  const cam=this.camera.position;
  for(const c of this.crowd){
   if(c.wait>0)c.wait-=dt;
   else{const dx=c.tx-c.x,dz=c.tz-c.z,d=Math.hypot(dx,dz);
    if(d<.3){c.wait=1+Math.random()*3;const s=this.spot();c.tx=s.x;c.tz=s.z}
    else{const st=Math.min(d,c.speed*dt);c.x+=dx/d*st;c.z+=dz/d*st}}
   const walking=c.wait<=0;
   c.g.position.set(c.x,islandH(c.x,c.z),c.z);
   c.plane.position.y=.88+(walking?Math.abs(Math.sin(this.t*9+c.ph))*.12:Math.sin(this.t*2+c.ph)*.03);
   c.plane.rotation.y=Math.atan2(cam.x-c.x,cam.z-c.z);
  }
 }
 animateWorld(dt){
  this.updateCrowd(dt);
  this.water.position.y=-.2+Math.sin(this.t*.8)*.05;
  this.padRing.material.opacity=.55+.25*Math.sin(this.t*3);
  for(const c of this.clouds){c.position.x+=dt*2.5;if(c.position.x>700)c.position.x=-700}
 }

 render(){
  const c=this.renderer.domElement;const w=c.clientWidth||innerWidth,h=c.clientHeight||innerHeight;
  if(this.camera.aspect!==w/h){this.camera.aspect=w/h;this.camera.updateProjectionMatrix()}
  this.renderer.render(this.scene,this.camera);
 }
}
