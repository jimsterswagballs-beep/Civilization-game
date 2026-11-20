import * as THREE from 'three';
const _c=new THREE.Color(),rnd=Math.random;
function softTex(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,'rgba(255,255,255,.75)');g.addColorStop(.6,'rgba(255,255,255,.22)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)}
// lumpy blob used for smoke / dust so puffs don't look like perfect discs
function puffTex(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');const blob=(px,py,r,a)=>{const g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,'rgba(255,255,255,'+a+')');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64)};
 blob(32,32,30,.5);for(const b of [[24,26,16],[40,28,15],[30,42,16],[42,40,13],[22,40,12]])blob(b[0],b[1],b[2],.5);return new THREE.CanvasTexture(c)}
// a pool of point sprites with per-particle size (aSize) and alpha (4-component vertex colour)
class Pool{
 constructor(scene,max,tex,additive){
  this.max=max;this.n=0;this.additive=additive;
  this.pp=new Float32Array(max*3);this.pc=new Float32Array(max*4);this.ps=new Float32Array(max);
  this.vel=new Float32Array(max*3);this.base=new Float32Array(max*3);
  this.life=new Float32Array(max);this.maxLife=new Float32Array(max);this.grav=new Float32Array(max);
  this.sz=new Float32Array(max);this.grow=new Float32Array(max);this.drag=new Float32Array(max);this.a0=new Float32Array(max);
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(this.pp,3));g.setAttribute('color',new THREE.BufferAttribute(this.pc,4));g.setAttribute('aSize',new THREE.BufferAttribute(this.ps,1));
  const m=new THREE.PointsMaterial({size:1,map:tex,vertexColors:true,transparent:true,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,depthWrite:false,sizeAttenuation:true});
  m.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('uniform float size;','uniform float size;\nattribute float aSize;').replace('gl_PointSize = size;','gl_PointSize = size * aSize;')};
  this.pts=new THREE.Points(g,m);this.pts.frustumCulled=false;scene.add(this.pts)}
 add(x,y,z,vx,vy,vz,r,g,b,life,grav,size,grow,drag,a){
  const i=this.n<this.max?this.n++:Math.floor(rnd()*this.max),o=i*3;
  this.pp[o]=x;this.pp[o+1]=y;this.pp[o+2]=z;this.vel[o]=vx;this.vel[o+1]=vy;this.vel[o+2]=vz;this.base[o]=r;this.base[o+1]=g;this.base[o+2]=b;
  this.life[i]=this.maxLife[i]=life;this.grav[i]=grav;this.sz[i]=size;this.grow[i]=grow;this.drag[i]=drag;this.a0[i]=a}
 update(dt){
  const P=this.pp,C=this.pc,S=this.ps,V=this.vel,B=this.base;
  for(let i=0;i<this.n;i++){
   if(this.life[i]<=0){ // swap-remove
    const j=this.n-1;if(i!==j){for(let k=0;k<3;k++){P[i*3+k]=P[j*3+k];V[i*3+k]=V[j*3+k];B[i*3+k]=B[j*3+k]}
     this.life[i]=this.life[j];this.maxLife[i]=this.maxLife[j];this.grav[i]=this.grav[j];this.sz[i]=this.sz[j];this.grow[i]=this.grow[j];this.drag[i]=this.drag[j];this.a0[i]=this.a0[j]}
    this.n--;i--;continue}
   this.life[i]-=dt;const o=i*3,dk=Math.exp(-this.drag[i]*dt);
   V[o]*=dk;V[o+1]=V[o+1]*dk-this.grav[i]*dt;V[o+2]*=dk;P[o]+=V[o]*dt;P[o+1]+=V[o+1]*dt;P[o+2]+=V[o+2]*dt;
   const f=Math.max(0,this.life[i]/this.maxLife[i]),k=1-f;
   S[i]=this.sz[i]*Math.max(.05,1+this.grow[i]*k);
   const al=this.additive?f*this.a0[i]:this.a0[i]*f*Math.min(1,k*9); // smoke fades in fast, out slowly
   C[i*4]=B[o];C[i*4+1]=B[o+1];C[i*4+2]=B[o+2];C[i*4+3]=al}
  const g=this.pts.geometry;g.setDrawRange(0,this.n);g.attributes.position.needsUpdate=true;g.attributes.color.needsUpdate=true;g.attributes.aSize.needsUpdate=true}
}
// ambient volume around the camera: pollen/dust motes by day, rising violet embers inside the storm
const AX=34,AYL=-8,AYH=14,AYR=AYH-AYL;
export class FX{
 constructor(scene){
  this.scene=scene;this.density=1;this.cam=null;this.stormy=false;this.stormK=0;this.t=0;
  const soft=softTex();
  this.add=new Pool(scene,2600,soft,true);this.smoke=new Pool(scene,700,puffTex(),false);
  this.tr=[];this.trGeo=new THREE.BoxGeometry(1,1,1);
  this.blasts=[];this.rings=[];
  this.initAmbient(scene,soft)}
 initAmbient(scene,tex){
  const N=this.NA=240;this.aP=new Float32Array(N*3);this.aC=new Float32Array(N*4);this.aS=new Float32Array(N);this.aV=new Float32Array(N*3);this.aPh=new Float32Array(N);this.aSp=new Float32Array(N);this.aInit=false;
  for(let i=0;i<N;i++){this.aV[i*3]=(rnd()-.5)*.5;this.aV[i*3+1]=(rnd()-.5)*.35;this.aV[i*3+2]=(rnd()-.5)*.5;this.aPh[i]=rnd()*6.283;this.aSp[i]=.6+rnd()*1.6;this.aS[i]=.11+rnd()*.14}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.aP,3));g.setAttribute('color',new THREE.BufferAttribute(this.aC,4));g.setAttribute('aSize',new THREE.BufferAttribute(this.aS,1));
  const m=new THREE.PointsMaterial({size:1,map:tex,vertexColors:true,transparent:true,blending:THREE.NormalBlending,depthWrite:false,sizeAttenuation:true});
  m.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('uniform float size;','uniform float size;\nattribute float aSize;').replace('gl_PointSize = size;','gl_PointSize = size * aSize;')};
  this.amb=new THREE.Points(g,m);this.amb.frustumCulled=false;scene.add(this.amb)}
 updateAmbient(dt){
  const cam=this.cam;if(!cam)return;const cp=cam.position,N=this.NA,P=this.aP,C=this.aC,V=this.aV,t=this.t;
  if(!this.aInit){for(let i=0;i<N;i++){P[i*3]=cp.x+(rnd()*2-1)*AX;P[i*3+1]=cp.y+AYL+rnd()*AYR;P[i*3+2]=cp.z+(rnd()*2-1)*AX}this.aInit=true}
  this.stormK+=((this.stormy?1:0)-this.stormK)*Math.min(1,dt*1.5);const sk=this.stormK;
  const wx=.9+Math.sin(t*.13)*.5,wz=.35+Math.cos(t*.09)*.4;
  const alt=1-Math.min(1,Math.max(0,(cp.y-70)/70)); // fade out while skydiving / on the bus
  const act=Math.floor(N*Math.min(1,this.density));
  const r=1-sk*.2,g=.97-sk*.57,b=.8+sk*.2;
  for(let i=0;i<N;i++){const o=i*3;
   if(i>=act||alt<=0){C[i*4+3]=0;continue}
   P[o]+=(V[o]+wx)*dt;P[o+1]+=(V[o+1]+sk*1.1+Math.sin(t*.7+this.aPh[i])*.12)*dt;P[o+2]+=(V[o+2]+wz)*dt;
   let dx=P[o]-cp.x,dy=P[o+1]-cp.y,dz=P[o+2]-cp.z;
   if(dx>AX)P[o]-=2*AX;else if(dx<-AX)P[o]+=2*AX;
   if(dz>AX)P[o+2]-=2*AX;else if(dz<-AX)P[o+2]+=2*AX;
   if(dy>AYH)P[o+1]-=AYR;else if(dy<AYL)P[o+1]+=AYR;
   dx=P[o]-cp.x;dy=P[o+1]-cp.y;dz=P[o+2]-cp.z;
   const e=Math.max(Math.abs(dx),Math.abs(dz))/AX,ey=(dy-(AYL+AYH)/2)/(AYR/2);
   const edge=Math.max(0,1-Math.pow(Math.max(e,Math.abs(ey)),4)); // fade near the volume edge so wrapping never pops
   const near=Math.min(1,Math.max(0,(Math.hypot(dx,dy,dz)-1)/4)); // and very close to the lens
   const tw=.55+.45*Math.sin(t*this.aSp[i]+this.aPh[i]);
   C[i*4]=r;C[i*4+1]=g;C[i*4+2]=b;C[i*4+3]=edge*near*tw*alt*(.6+sk*.2)}
  const ge=this.amb.geometry;ge.attributes.position.needsUpdate=true;ge.attributes.color.needsUpdate=true}
 // size/grow/drag/a are optional so older call sites (x,y,z,vx,vy,vz,color,life,grav) keep working; dark colours become real alpha-blended smoke
 emit(x,y,z,vx,vy,vz,color,life,grav=0,size=.45,grow=0,drag=0,a=1){
  _c.set(color);const r=_c.r,g=_c.g,b=_c.b;
  if(r*.3+g*.59+b*.11<.2)this.smoke.add(x,y,z,vx,vy,vz,r,g,b,life,grav,size*2.4,grow||1.3,drag||1.2,a*.55);
  else this.add.add(x,y,z,vx,vy,vz,r,g,b,life,grav,size,grow,drag,a)}
 puff(x,y,z,vx,vy,vz,color,life,size,grow=1.4,a=.6,grav=0,drag=1.2){_c.set(color);this.smoke.add(x,y,z,vx,vy,vz,_c.r,_c.g,_c.b,life,grav,size,grow,drag,a)}
 burst(x,y,z,n,speed,color,life=.6,grav=0,spreadY=1){n=Math.max(1,Math.floor(n*this.density));for(let i=0;i<n;i++){const a=rnd()*6.283,b=(rnd()*2-1)*spreadY,r=Math.sqrt(1-b*b);const s=speed*(.3+rnd()*.7);this.emit(x,y,z,Math.cos(a)*r*s,b*s,Math.sin(a)*r*s,color,life*(.6+rnd()*.6),grav,.22+rnd()*.4,-.55,.7)}}
 spark(x,y,z,nx,ny,nz,color='#ffd070'){const n=Math.max(3,Math.floor(9*this.density));
  for(let i=0;i<n;i++)this.emit(x,y,z,nx*4+(rnd()-.5)*6,ny*4+rnd()*3.5,nz*4+(rnd()-.5)*6,color,.22+rnd()*.25,14,.14+rnd()*.14,-.7,0);
  this.emit(x+nx*.05,y+ny*.05,z+nz*.05,0,0,0,'#fff3c0',.09,0,.9,.4,0)} // brief impact flash
 dust(x,y,z,n=10,r=3,color='#a89a7c'){n=Math.max(2,Math.floor(n*this.density));for(let i=0;i<n;i++){const a=rnd()*6.283,s=r*(.5+rnd()*.9);this.puff(x+Math.cos(a)*.4,y,z+Math.sin(a)*.4,Math.cos(a)*s,.3+rnd()*1.1,Math.sin(a)*s,color,.7+rnd()*.5,.9+rnd()*.9,1.5,.5,-.6,2.2)}}
 tracer(a,b,color='#ffe9a0',w=.035,life=.07){
  const m=new THREE.Mesh(this.trGeo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,fog:false}));
  const len=a.distanceTo(b);m.position.copy(a).lerp(b,.5);m.scale.set(w,w,len);m.lookAt(b);this.scene.add(m);this.tr.push({m,t:life,l:life})}
 explosion(p,r,color='#ff9a3c'){
  const m=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,fog:false}));m.position.copy(p);this.scene.add(m);this.blasts.push({m,t:.4,l:.4,r});
  this.ring(p,r,'#ffe0a0');this.ring(p,r*.6,'#ff9a3c',.35);
  const d=this.density,x=p.x,y=p.y,z=p.z;
  this.puff(x,y,z,0,0,0,'#fff2c8',.16,r*1.5,.8,.95,0,0);                              // white-hot core flash (alpha-blended so it reads against bright sky)
  for(let i=0,n=Math.max(8,Math.floor(34*d));i<n;i++){const a=rnd()*6.283,b=(rnd()*2-1)*.8,q=Math.sqrt(1-b*b),s=r*(.7+rnd()*1.6);
   this.puff(x,y,z,Math.cos(a)*q*s,b*s+r*.5,Math.sin(a)*q*s,rnd()<.5?'#ff7a1e':'#ffb83a',.45+rnd()*.5,r*(.3+rnd()*.3),1.1,.9,-1.5,.9)}  // billowing flames
  for(let i=0,n=Math.max(8,Math.floor(40*d));i<n;i++){const a=rnd()*6.283,b=(rnd()*2-1)*.9,q=Math.sqrt(1-b*b),s=r*(2+rnd()*2.4);
   this.emit(x,y,z,Math.cos(a)*q*s,b*s+2,Math.sin(a)*q*s,'#ffd060',.5+rnd()*.5,18,.16+rnd()*.14,-.7,.3)}                  // fast debris sparks
  for(let i=0,n=Math.max(4,Math.floor(14*d));i<n;i++){const a=rnd()*6.283,s=r*(.2+rnd()*.5);
   this.puff(x,y+.3,z,Math.cos(a)*s,r*(.35+rnd()*.5),Math.sin(a)*s,'#3a3a3a',1.6+rnd()*1.2,r*(.45+rnd()*.4),1.6,.65,-.5,1)} // rising smoke plume
  this.dust(x,y+.15,z,16,r*1.4)}
 ring(p,r,color='#6ec6ff',t=.5){const m=new THREE.Mesh(new THREE.RingGeometry(.85,1,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,side:THREE.DoubleSide,fog:false,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.copy(p);m.position.y+=.1;this.scene.add(m);this.rings.push({m,t,l:t,r});
  if(r>=4)this.dust(p.x,p.y+.15,p.z,Math.min(18,Math.round(r*1.6)),r*.9)} // big shockwaves kick up dust
 update(dt){
  this.t+=dt;this.add.update(dt);this.smoke.update(dt);this.updateAmbient(dt);
  for(let i=this.tr.length-1;i>=0;i--){const t=this.tr[i];t.t-=dt;t.m.material.opacity=Math.max(0,t.t/t.l);if(t.t<=0){this.scene.remove(t.m);t.m.material.dispose();this.tr.splice(i,1)}}
  for(let i=this.blasts.length-1;i>=0;i--){const b=this.blasts[i];b.t-=dt;const k=1-b.t/b.l;b.m.scale.setScalar(b.r*(.25+k*.55));b.m.material.opacity=.85*(1-k)*(1-k);if(b.t<=0){this.scene.remove(b.m);b.m.geometry.dispose();b.m.material.dispose();this.blasts.splice(i,1)}}
  for(let i=this.rings.length-1;i>=0;i--){const b=this.rings[i];b.t-=dt;const k=1-b.t/b.l;b.m.scale.setScalar(Math.max(.1,b.r*k));b.m.material.opacity=.9*(1-k);if(b.t<=0){this.scene.remove(b.m);b.m.geometry.dispose();b.m.material.dispose();this.rings.splice(i,1)}}
 }
}
