import * as THREE from 'three';
import {WEAPONS,ITEMS,RARITY,CHARS,AMMO,mulberry32,clamp,lerp} from './data.js';
import * as W from './world.js';
import {FX} from './fx.js';
import {R,HSTAND,HCROUCH,EYE,EYEC,EYES,charTex,wstat,makeWeaponModel,mat,angDiff,lerpAng,crispMat,makeBusModel} from './shared.js';
import {movementMethods} from './movement.js';
import {combatMethods} from './combat.js';
import {lootMethods} from './loot.js';
import {botMethods} from './bots.js';
import {netMethods} from './netsync.js';

export const PHASES=[{wait:35,shrink:30,r:235,dmg:1},{wait:28,shrink:26,r:155,dmg:2},{wait:24,shrink:22,r:95,dmg:4},{wait:20,shrink:18,r:52,dmg:6},{wait:15,shrink:15,r:22,dmg:8},{wait:10,shrink:14,r:0,dmg:10}];
const SKY_V=`varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const SKY_F=`varying vec3 vP;void main(){vec3 d=normalize(vP);float h=d.y;vec3 top=vec3(.20,.48,.92),mid=vec3(.60,.80,.97),hz=vec3(.725,.863,.961),bot=vec3(.75,.88,.95);vec3 c=h>0.?mix(mix(hz,mid,smoothstep(0.,.22,h)),top,pow(h,.65)):mix(hz,bot,min(1.,-h*3.));vec3 sd=normalize(vec3(200.,300.,120.));float s=max(dot(d,sd),0.);c+=vec3(1.,.82,.5)*pow(s,8.)*.2+vec3(1.,.9,.7)*pow(s,64.)*.3+vec3(1.,.97,.9)*smoothstep(.9985,.9995,s);c=mix(c,hz,exp(-abs(h)*9.)*.55);gl_FragColor=vec4(c,1.);}`;

// sun shadow: a camera-following ortho shadow map, snapped to whole texels so shadows don't shimmer; resolution follows the quality preset
const SUN_DIR=new THREE.Vector3(200,300,120).normalize(),SHADOW_R=62,SHADOW_RES={Low:0,Medium:1024,High:2048};
function updateSun(g,cam){
 const sun=g.sun,ql=(g.app.settings&&g.app.settings.quality)||'High',res=SHADOW_RES[ql]===undefined?2048:SHADOW_RES[ql],on=res>0;
 if(sun.castShadow!==on)sun.castShadow=on;
 if(!on)return;
 if(sun.shadow.mapSize.x!==res){sun.shadow.mapSize.set(res,res);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}}
 const ts=2*SHADOW_R/res,L=SUN_DIR,rl=Math.hypot(L.z,L.x),Rx=L.z/rl,Rz=-L.x/rl,Ux=L.y*Rz,Uy=L.z*Rx-L.x*Rz,Uz=-L.y*Rx;
 let tx=cam.position.x,ty=cam.position.y,tz=cam.position.z;
 const pr=tx*Rx+tz*Rz,pu=tx*Ux+ty*Uy+tz*Uz,dr=Math.round(pr/ts)*ts-pr,du=Math.round(pu/ts)*ts-pu;
 tx+=Rx*dr+Ux*du;ty+=Uy*du;tz+=Rz*dr+Uz*du;
 sun.target.position.set(tx,ty,tz);sun.position.set(tx+L.x*300,ty+L.y*300,tz+L.z*300);sun.target.updateMatrixWorld()}
export class Game{
 constructor(app){
  this.app=app;this.renderer=app.renderer;this.input=app.input;this.audio=app.audio;this.hud=app.hud;
  this.scene=new THREE.Scene();this.scene.fog=new THREE.Fog('#b9dcf5',80,800);
  this.camera=new THREE.PerspectiveCamera(92,1,.08,1600);this.scene.add(this.camera);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(1200,20,12),new THREE.ShaderMaterial({vertexShader:SKY_V,fragmentShader:SKY_F,side:THREE.BackSide,depthWrite:false,fog:false}));sky.renderOrder=-10;sky.frustumCulled=false;this.sky=sky;this.scene.add(sky);
  this.scene.add(new THREE.HemisphereLight('#dcecff','#76865c',1.3));
  const sun=new THREE.DirectionalLight('#ffeac4',2.0);sun.position.set(200,300,120);this.scene.add(sun);this.scene.add(sun.target);this.sun=sun;
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);{const sc=sun.shadow.camera;sc.left=-SHADOW_R;sc.right=SHADOW_R;sc.top=SHADOW_R;sc.bottom=-SHADOW_R;sc.near=1;sc.far=700;sc.updateProjectionMatrix()}sun.shadow.bias=-.0005;sun.shadow.normalBias=.5;
  this.vmScene=new THREE.Scene();this.vmCam=new THREE.PerspectiveCamera(58,1,.02,10);this.vmScene.add(new THREE.HemisphereLight('#fff','#778',1.4));const vs=new THREE.DirectionalLight('#fff',1.2);vs.position.set(1,2,1);this.vmScene.add(vs);
  this.fx=new FX(this.scene);this.fx.cam=this.camera;this.worldBuilt=false;this.running=false;this.dynamic=new THREE.Group();this.scene.add(this.dynamic);
  this.ents=new Map();this.list=[];this.loot=new Map();this.traps=new Map();this.projs=[];this.pvis=new Map();this.outEvents=[];this.tmpV=new THREE.Vector3();
  this.view={recoilP:0,recoilY:0,kick:0,shake:0,bobT:0,eye:EYE,roll:0,fov:92,adsK:0,equipK:1,reloadK:0,sway:0,flash:0,hitK:0,burgerT:0};
  this.accum={net:0,snap:0,think:0,loot:0,hud:0,ev:0};this.kills=[];this.spectateId=-1;this.winnerId=null;
 }
 ensureWorld(){if(!this.worldBuilt){W.buildMap();this.world=W.buildMeshes(this.scene);this.decor=W.addDecor(this.scene);this.worldBuilt=true}}
 renderMenu(dt){this.menuT=(this.menuT||0)+dt;if(this.decor)this.decor.update(this.menuT);const a=this.menuT*.06,cam=this.camera;cam.position.set(Math.cos(a)*270,95+Math.sin(a*2)*15,Math.sin(a)*270);cam.lookAt(0,8,0);cam.fov=60;cam.updateProjectionMatrix();this.sky.position.copy(cam.position);updateSun(this,{position:{x:0,y:8,z:0}});this.scene.fog.color.set('#b9dcf5');if(this.worldBuilt)this.world.water.position.y=Math.sin(this.menuT*.8)*.08;this.renderWorld(cam)}
 peerLeft(pid){const e=this.list.find(x=>x.peer===pid);if(!e)return;e.peer=undefined;if(e.alive){e.bot=true;this.initBot(e);e.ai.state='loot';e.name+=' (bot)'}}
 get settings(){return this.app.settings}
 get me(){return this.ents.get(this.myId)}
 cleanup(){
  for(const e of this.list){if(e.spr)this.dynamic.remove(e.spr.group)}
  for(const l of this.loot.values())if(l.mesh)this.dynamic.remove(l.mesh);
  for(const t of this.traps.values())if(t.mesh)this.dynamic.remove(t.mesh);
  for(const p of this.pvis.values())this.dynamic.remove(p.mesh);
  if(this.busMesh){this.dynamic.remove(this.busMesh);this.busMesh=null}
  if(this.stormMesh){this.dynamic.remove(this.stormMesh);this.stormMesh=null}
  if(this.vmModel){this.vmScene.remove(this.vmModel);this.vmModel=null}
  this.ents.clear();this.list=[];this.loot.clear();this.traps.clear();this.projs=[];this.pvis.clear();this.outEvents=[];
 }
 start(cfg){
  this.cleanup();this.role=cfg.role;this.net=cfg.net;this.myId=cfg.myId;this.seed=cfg.seed;this.diff=cfg.diff||'Normal';
  this.botDmg={Easy:.7,Normal:1,Hard:1.12}[this.diff]||1;
  this.ensureWorld();this.camera.fov=this.settings.fov;
  const rng=mulberry32(this.seed);this.rng=rng;
  const ang=rng()*Math.PI*2,off=(rng()-.5)*160;
  this.bus={dx:Math.cos(ang),dz:Math.sin(ang),speed:46,len:900,t:0,off,pos:new THREE.Vector3(),y:215};
  this.bus.sx=-this.bus.dx*450-this.bus.dz*off;this.bus.sz=-this.bus.dz*450+this.bus.dx*off;
  this.busPos(0);
  {const bm=makeBusModel();this.busMesh=bm.group;this.busProp=bm.prop;this.dynamic.add(this.busMesh)}
  for(const info of cfg.ents)this.makeEnt(info);
  this.t=0;this.state='bus';this.winnerId=null;this.spectateId=-1;this.over=false;this.kills=[];this.nextLootId=1000000;this.nextProjId=1;this.nextTrapId=1;
  this.storm={phase:-1,state:'idle',t:25,cx:0,cz:0,r:480,ocx:0,ocz:0,or:480,tcx:0,tcz:0,tr:480,dmg:0};
  this.supplyT=45;this.supplies=[];
  this.genLoot(mulberry32(this.seed+99));
  this.initStormMesh();
  this.me.pos.copy(this.bus.pos);
  this.view.recoilP=this.view.recoilY=0;this.running=true;this.audio.mode='game';
  const me=this.me;me.yaw=Math.atan2(-this.bus.dx,-this.bus.dz);
  this.hud.onStart(this);
 }
 busPos(t){const b=this.bus;b.pos.set(b.sx+b.dx*b.speed*t,b.y,b.sz+b.dz*b.speed*t)}
 makeEnt(info){
  const c=CHARS.find(c=>c.id===info.char)||CHARS[0];
  const e={id:info.id,name:info.name,char:c.id,cdef:c,bot:!!info.bot,peer:info.peer,local:info.id===this.myId,cos:info.cos||{},
   pos:new THREE.Vector3(),vel:new THREE.Vector3(),rpos:new THREE.Vector3(),yaw:0,pitch:0,hp:c.hp,maxHp:c.hp,sh:0,ts:0,tsT:0,alive:true,kills:0,place:0,
   grounded:false,crouch:false,sliding:false,sprinting:false,slideT:0,swim:false,drop:'bus',flags:0,
   inv:[{k:'w',w:0,r:0,mag:0},null,null,null,null,null],cur:0,ammo:{light:0,med:0,shells:0,heavy:0,rockets:0},
   fireCd:0,reload:0,equipT:0,use:null,stun:0,slip:0,dance:0,dazed:0,eatT:0,auraT:0,buffT:0,cd:[0,0,0],dash:null,grap:null,slamming:false,
   hitT:0,shootT:0,landT:0,walkT:0,lastHit:-99,lastBy:-1,padCd:0,airCap:0,wi:-1,bloom:0,deadT:0,spawnT:0,
   tgt:{x:0,y:0,z:0,yaw:0,pitch:0},jumpHeld:false,prevFire:false,prevCrouch:false,prevJump:false};
  e.pos.copy(this.bus.pos);e.rpos.copy(e.pos);
  this.ents.set(e.id,e);this.list.push(e);this.makeSprite(e);
  if(e.bot)this.initBot(e,info);
  return e}
 // ---------- sprites
 makeSprite(e){
  const g=new THREE.Group();const bb=new THREE.Group();g.add(bb);const pivot=new THREE.Group();bb.add(pivot);
  const geo=new THREE.PlaneGeometry(2.1,2.1);const m=crispMat(charTex(e.char,'front'));
  const plane=new THREE.Mesh(geo,m);plane.position.y=.88;plane.layers.set(1);pivot.add(plane);
  const sh=new THREE.Mesh(new THREE.CircleGeometry(.7,16),new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.32,depthWrite:false}));sh.rotation.x=-Math.PI/2;sh.position.y=.05;g.add(sh);
  const wg=new THREE.Group();g.add(wg);
  const aura=new THREE.Mesh(new THREE.SphereGeometry(1.25,16,12),new THREE.MeshBasicMaterial({color:'#6ec6ff',transparent:true,opacity:.28,blending:THREE.AdditiveBlending,depthWrite:false}));aura.position.y=1;aura.visible=false;g.add(aura);
  const cv=document.createElement('canvas');cv.width=256;cv.height=64;const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;
  const nmat=crispMat(tex);const name=new THREE.Mesh(new THREE.PlaneGeometry(1,1),nmat);name.scale.set(2.8,.7,1);name.position.y=2.45;name.layers.set(1);bb.add(name);
  e.spr={group:g,bb,pivot,plane,mat:m,nmat,shadow:sh,wg,aura,name,cv,tex,view:'front',wKey:-1,wModel:null,hpKey:-1,flip:1};
  this.dynamic.add(g);this.drawName(e,true)}
 drawName(e,force){
  const s=e.spr;const key=Math.round(e.hp/5)*1000+Math.round(e.sh/5)+(e.ts>0?7:0);if(!force&&key===s.hpKey)return;s.hpKey=key;
  const c=s.cv.getContext('2d');c.clearRect(0,0,256,64);c.font='bold 24px Arial Black, Arial';c.textAlign='center';c.lineWidth=5;c.strokeStyle='rgba(0,0,0,.8)';c.strokeText(e.name,128,24);c.fillStyle=e.cos.nameColor||'#fff';c.fillText(e.name,128,24);
  c.fillStyle='rgba(0,0,0,.65)';c.fillRect(40,34,176,10);c.fillStyle='#4cd964';c.fillRect(41,35,174*clamp(e.hp/e.maxHp,0,1),8);
  if(e.sh>0||e.ts>0){c.fillStyle='#3db8ff';c.fillRect(41,46,174*clamp((e.sh+e.ts)/100,0,1),5)}
  s.tex.needsUpdate=true}
 updateSprite(e,dt,cam){
  const s=e.spr;const spectating=!this.me.alive;const camTarget=this.viewEnt();
  const vis=(e.alive||e.deadT<2)&&e.drop!=='bus'&&!(e===camTarget&&this.fpv);
  s.group.visible=vis;if(!vis)return;
  const P=e.rpos;s.group.position.copy(P);
  const dx=cam.x-P.x,dz=cam.z-P.z,dl=Math.hypot(dx,dz)||1;const nx=dx/dl,nz=dz/dl;
  s.bb.rotation.y=Math.atan2(dx,dz);
  const fx=-Math.sin(e.yaw),fz=-Math.cos(e.yaw);const dot=fx*nx+fz*nz;
  const view=dot>.55?'front':dot<-.55?'back':'side';
  if(view!==s.view){s.view=view;s.mat.map=charTex(e.char,view);s.mat.needsUpdate=true}
  const rx=nz,rz=-nx;const faceRight=fx*rx+fz*rz>=0;
  let flip=view==='side'?(faceRight?1:-1):1;
  // animation
  const sp=Math.hypot(e.vel.x,e.vel.z);const gr=e.grounded&&!e.drop;
  if(gr&&!e.sliding)e.walkT+=sp*dt*1.5;
  let bob=gr&&!e.sliding?Math.abs(Math.sin(e.walkT))*.11*Math.min(1,sp/6):0,tilt=gr&&!e.sliding?Math.sin(e.walkT)*.07*Math.min(1,sp/6):0;
  let sx=1,sy=1,rz2=0,py=0;
  if(!gr&&!e.drop){const v=clamp(e.vel.y/12,-1,1);sy=1+v*.1;sx=1-v*.07}
  if(e.landT>0){e.landT-=dt;const k=e.landT/.18;sy*=1-.18*k;sx*=1+.12*k}
  if(e.crouch&&!e.sliding){sy*=.78;sx*=1.05}
  if(e.sliding){sy*=.72;sx*=1.08;rz2=(view==='side'?-.55*flip:0)}
  if(e.eatT>0||e.use){const k=Math.sin(this.t*14)*.5+.5;if(e.eatT>0){sy*=1+k*.07;sx*=1-k*.05}}
  if(e.stun>0||e.dazed>0){rz2+=Math.sin(this.t*18)*.12}
  if(e.dance>0){rz2+=Math.sin(this.t*11)*.28;py=Math.abs(Math.sin(this.t*9))*.35}
  if(e.slip>0){rz2+=this.t*14;py=.25}
  if(e.drop==='free'){rz2+=view==='side'?.5*flip*-1:0;sy*=.92}
  if(e.shootT>0){e.shootT-=dt;sx*=1-.04*(e.shootT/.12)}
  if(e.punch>0){e.punch=Math.max(0,e.punch-dt*7);sx*=1+e.punch*.16;sy*=1-e.punch*.12;py+=e.punch*.06}
  if(e.hitT>0){e.hitT-=dt;if(e.hitT>.09)s.mat.color.setRGB(2.2,2.2,2.2);else s.mat.color.setRGB(1.5,.45,.45)}else s.mat.color.setRGB(1,1,1);
  if(!e.alive){e.deadT+=dt;const k=Math.min(1,e.deadT/.5);rz2=(flip>0?-1:1)*1.45*k;sy*=1-.2*k;s.mat.opacity=clamp(1.6-e.deadT,0,1);s.mat.transparent=true}
  else s.mat.opacity=1;
  if(this.over&&e.id===this.winnerId){const em=e.cos.emote||0;const t=this.t*(em===0?5:em===1?3:4);if(em===0){flip*=Math.cos(t)}else if(em===1){py=Math.abs(Math.sin(t*2))*1.1;rz2=Math.sin(t*2)*.15}else{rz2=(t*2)%6.283;py=.5+Math.sin(t)*.2}}
  s.pivot.position.y=bob+py;s.pivot.rotation.z=rz2+tilt;s.pivot.scale.set(sx*flip,sy,1);
  // aura / buffs
  const aOn=(e.flags&512)||(e.flags&1024);s.aura.visible=!!aOn&&e.alive;if(aOn){s.aura.material.color.set((e.flags&512)?'#5ab8ff':'#ffd84a');s.aura.scale.setScalar(1+Math.sin(this.t*10)*.06)}
  // weapon
  const wi=e.wi;if(wi!==s.wKey){s.wKey=wi;if(s.wModel)s.wg.remove(s.wModel);s.wModel=null;if(wi>=0){const w=Math.floor(wi/10),r=wi%10;s.wModel=makeWeaponModel(w,r);s.wModel.scale.setScalar(.85);s.wModel.position.set(.36,.0,-.12);s.wg.add(s.wModel)}}
  s.wg.visible=e.alive&&e.drop!=='free';s.wg.position.set(0,1.1+(e.crouch?-.3:0)+(e.sliding?-.35:0),0);s.wg.rotation.set(e.pitch,e.yaw,0,'YXZ');
  const nd=Math.hypot(dx,dz);s.name.visible=e.alive&&nd<48&&e!==camTarget;if(s.name.visible)this.drawName(e)
  const ss=clamp(1.1+nd*.012,1,2.2);s.name.scale.set(2.8*ss,.7*ss,1);
  s.shadow.visible=e.grounded||!!e.drop===false;
  s.shadow.position.y=W.H(P.x,P.z)-P.y+.06;
 }
 viewEnt(){const me=this.me;if(me&&me.alive)return me;let t=this.ents.get(this.spectateId);if(!t||!t.alive){t=this.list.find(e=>e.alive&&e!==me);if(t)this.spectateId=t.id}return t||me}
 cycleSpectate(){const alive=this.list.filter(e=>e.alive&&e!==this.me);if(!alive.length)return;const i=alive.findIndex(e=>e.id===this.spectateId);this.spectateId=alive[(i+1)%alive.length].id}
 get fpv(){const me=this.me;return me&&me.alive}
 aliveCount(){let n=0;for(const e of this.list)if(e.alive)n++;return n}
 // ---------- events
 emit(ev,to){
  if(this.role==='client')return;
  if(to!==undefined&&to!==null){const e=this.ents.get(to);if(e&&e.peer!==undefined&&e.id!==this.myId){this.net.send(e.peer,{t:'ev',e:[ev]});return}if(e&&e.bot){if(ev.k==='st')this.applyStatusLocal(e,ev);return}this.handleEvent(ev);return}
  if((ev.k==='sh'||ev.k==='ex')&&this.botHear)this.botHear(ev);
  this.handleEvent(ev);this.outEvents.push(ev)}
 handleEvent(ev){
  const me=this.me;const fx=this.fx,au=this.audio;
  switch(ev.k){
   case'sh':{if(this.role==='client'&&ev.i===this.myId)break;const o=new THREE.Vector3(...ev.o);const sh=this.ents.get(ev.i);if(sh){sh.shootT=.12}
    if(ev.w>=0){const d=WEAPONS[ev.w];const sn=d.quiet?'quiet':d.laser?'laser':d.melee?'melee':d.t==='ar'?'ar':d.t==='smg'?'smg':d.t==='sg'?'sg':d.t==='sn'?'sn':d.t==='pi'?'pi':d.t==='ex'?'launch':'fun';au.play(sn,o,sn==='quiet'?.8:1);
     const col=d.laser?'#ff3dff':d.t==='sn'?'#cfe8ff':'#ffe9a0';if(ev.e)for(const p of ev.e){fx.tracer(o,new THREE.Vector3(...p),col,d.laser?.06:.035)}
     fx.burst(o.x,o.y,o.z,3,3,'#ffd070',.12)}
    else if(ev.e)for(const p of ev.e)fx.tracer(o,new THREE.Vector3(...p),'#ddd',.05,.25);
    if(ev.im)for(const p of ev.im){fx.spark(p[0],p[1],p[2],p[3],p[4],p[5],ev.w>=0&&WEAPONS[ev.w].laser?'#ff6bff':'#ffd070')}
    break}
   case'hit':{const t=this.ents.get(ev.t);if(!t)break;t.hitT=.16;t.punch=1;
    {const c=ev.h?'#ffd23d':ev.sh&&!ev.hp?'#5ac8ff':'#ff5a4a';fx.burst(ev.x,ev.y,ev.z,ev.h?16:10,ev.h?7:5,c,.35,10);fx.burst(ev.x,ev.y,ev.z,6,4,'#ffffff',.2,6);
     if(ev.h)fx.ring(new THREE.Vector3(ev.x,ev.y-.05,ev.z),1.1,'#ffd23d',.3);if(ev.sh&&ev.hp)fx.burst(ev.x,ev.y,ev.z,10,6,'#5ac8ff',.4,6)}
    if(ev.by===this.myId&&ev.t!==this.myId){this.hud.hitmarker(false,!!ev.h,ev.sh&&!ev.hp);au.play(ev.h?'head':'hit');if(this.settings.dmgNumbers)this.hud.dmgNumber(new THREE.Vector3(ev.x,ev.y,ev.z),ev.d,!!ev.h,this)}
    if(ev.t===this.myId){this.hud.flashDamage(ev.by>=0&&this.ents.get(ev.by)?this.ents.get(ev.by).pos:null,this);au.play('hurt');this.view.shake=Math.min(1,this.view.shake+Math.min(.6,ev.d/60));if(me.use){me.use=null;this.hud.toast('Interrupted',"#ff7a7a")}}
    break}
   case'kill':{const v=this.ents.get(ev.v),b=this.ents.get(ev.by);
    if(v){v.alive=false;v.hp=0;v.deadT=0;fx.burst(v.pos.x,v.pos.y+1,v.pos.z,40,9,'#ffd23d',.7,8);fx.burst(v.pos.x,v.pos.y+1,v.pos.z,24,6,'#ff6bd6',.8,6);fx.ring(v.pos,3,'#ffffff',.45)}
    this.hud.killfeed(b?b.name:null,v?v.name:'?',ev.w,ev.by===this.myId,ev.v===this.myId);
    if(ev.by===this.myId&&ev.v!==this.myId){this.hud.hitmarker(true,false);au.play('kill');this.hud.toast('Eliminated '+(v?v.name:''),'#ffd23d')}
    if(ev.v===this.myId){this.onMeDead(ev)}
    if(v&&v.spr)au.play('hurt',v.pos,.8);
    break}
   case'ex':{const p=new THREE.Vector3(ev.x,ev.y,ev.z);fx.explosion(p,ev.r,ev.c||'#ff9a3c');au.play('expl',p,1.4);const cam=this.camera.position;const d=cam.distanceTo(p);this.view.shake=Math.min(1.2,this.view.shake+clamp(1.4-d/45,0,1.2));break}
   case'lt+':this.addLootObj(ev.l,true);break;
   case'lt-':this.removeLoot(ev.id);break;
   case'cho':{const l=this.loot.get(ev.id);if(l){l.opened=true;if(l.mesh){this.dynamic.remove(l.mesh);l.mesh=null}au.play('chest',new THREE.Vector3(l.x,l.y,l.z));fx.burst(l.x,l.y+.6,l.z,30,5,'#ffd23d',.8,6)}this.loot.delete(ev.id);break}
   case'tp+':this.addTrapVis(ev);break;
   case'tp-':{const t=this.traps.get(ev.id);if(t){if(t.mesh)this.dynamic.remove(t.mesh);this.traps.delete(ev.id)}break}
   case'pj':this.addProjVis(ev);break;
   case'pjx':{const p=this.pvis.get(ev.id);if(p){this.dynamic.remove(p.mesh);this.pvis.delete(ev.id)}break}
   case'st':if(me&&(ev.i===undefined||ev.i===this.myId))this.applyStatusLocal(me,ev);break;
   case'grant':if(me)this.applyGrantLocal(me,ev.g);break;
   case'slam':{const p=new THREE.Vector3(ev.x,ev.y,ev.z);fx.ring(p,10,'#6ec6ff',.55);fx.ring(p,5,'#fff',.4);fx.burst(p.x,p.y+.3,p.z,60,16,'#6ec6ff',.6,0,.3);au.play('slam',p,1.2);this.view.shake=Math.min(1,this.view.shake+clamp(1-p.distanceTo(this.camera.position)/40,0,.8));break}
   case'burst':{const p=new THREE.Vector3(ev.x,ev.y+1,ev.z);fx.ring(p.clone().setY(ev.y),4.5,'#9be0ff',.35);fx.burst(p.x,p.y,p.z,40,10,'#6ec6ff',.5);au.play('ab',p);break}
   case'bite':{const t=this.ents.get(ev.t);if(t){fx.burst(t.pos.x,t.pos.y+1.2,t.pos.z,25,6,'#ff4a4a',.5,8);au.play('bite',t.pos)}break}
   case'storm':this.hud.announce(ev.m);au.play('storm');break;
   case'sd':{this.hud.announce('Supply drop incoming!','#ffd23d');au.play('drop');this.supplies.push({id:ev.id,x:ev.x,z:ev.z,t0:this.t,y0:ev.y0,landed:false});this.hud.markSupply(this.supplies);break}
   case'end':this.onEnd(ev);break;
   case'snd':au.play(ev.n,ev.p?new THREE.Vector3(...ev.p):null,ev.g||1);break;
   case'quip':break;
  }
 }
 onMeDead(ev){
  const me=this.me;me.alive=false;const killer=this.ents.get(ev.by);this.spectateId=killer&&killer.alive?killer.id:-1;this.audio.play('lose');
  const place=ev.p||me.place;me.place=place;this.hud.showElim(place,killer?killer.name:(ev.w||'the storm'),me.kills,this)}
 onEnd(ev){
  if(this.over)return;this.over=true;this.winnerId=ev.win;const w=this.ents.get(ev.win);this.overT=this.t;
  if(this.me.alive&&ev.win===this.myId){this.audio.play('win');this.hud.showVictory(this)}
  else this.hud.announce((w?w.name:'Nobody')+' wins!','#ffd23d');
  this.hud.onEnd(this,ev)}
 // ---------- main update
 update(dt){
  if(!this.running)return;dt=Math.min(dt,.05);this.t+=dt;
  const me=this.me;
  this.updateBus(dt);if(this.decor)this.decor.update(this.t);
  if(me.alive)this.updateLocal(dt);else this.updateSpectate(dt);
  if(this.role!=='client'){
   this.updateBots(dt);this.updateProjs(dt);this.updateTraps(dt);this.updateStorm(dt);this.updateSupplies(dt);this.updateEntTimers(dt);this.checkWin()}
  else{this.updateClientSim(dt)}
  for(const e of this.list){if(e===me)continue;this.updateRemoteMotion(e,dt)}
  this.updateLootVis(dt);this.updateProjVis(dt);this.updateTrapVis(dt);this.updateStormVis(dt);
  this.fx.update(dt);
  this.netTick(dt);
 }
 updateBus(dt){
  const b=this.bus;if(b.t*b.speed>b.len+60){this.busMesh.visible=false}else{b.t+=dt;this.busPos(b.t);this.busMesh.position.copy(b.pos);this.busMesh.rotation.y=Math.atan2(-b.dx,-b.dz)+Math.PI;
   // the bus mesh length is along z, rotate so z aligned with dir
   this.busMesh.rotation.y=Math.atan2(b.dx,b.dz);if(this.busProp)this.busProp.rotation.z+=dt*30}
  for(const e of this.list)if(e.drop==='bus'){e.pos.copy(b.pos);if(e.local&&b.t*b.speed>b.len-20&&this.role!=='client'){}}
  if(this.state==='bus'&&b.t*b.speed>b.len*.5)this.state='play';
 }
 updateEntTimers(dt){
  for(const e of this.list){if(!e.alive)continue;this.abilityTick(e,dt);
   if(e.tsT>0){e.tsT-=dt;if(e.tsT<=0)e.ts=0}
   if(e.local||e.bot){}
   if(e.peer!==undefined&&!e.local){e.auraT=Math.max(0,e.auraT-dt)}
  }
 }
 updateRemoteMotion(e,dt){
  if(e.local){e.rpos.copy(e.pos);return}
  if(e.bot&&this.role!=='client'){e.rpos.copy(e.pos);return}
  // interpolate toward network target
  const k=1-Math.exp(-14*dt);e.pos.x=lerp(e.pos.x,e.tgt.x,k);e.pos.y=lerp(e.pos.y,e.tgt.y,k);e.pos.z=lerp(e.pos.z,e.tgt.z,k);
  if(Math.hypot(e.pos.x-e.tgt.x,e.pos.z-e.tgt.z)>20)e.pos.set(e.tgt.x,e.tgt.y,e.tgt.z);
  e.yaw=lerpAng(e.yaw,e.tgt.yaw,k);e.pitch=lerp(e.pitch,e.tgt.pitch,k);e.rpos.copy(e.pos);
  if(e.drop==='bus')e.pos.copy(this.bus.pos);
 }
 updateSpectate(dt){
  const inp=this.input;if(inp.pressed('spec')&&!this.over)this.cycleSpectate();
  const{dx,dy}=inp.takeLook();this.specYaw=(this.specYaw||0)-dx*.0025;this.specPitch=clamp((this.specPitch||.3)+dy*.0025,-.2,1.2);
  const me=this.me;// keep dead body in place
  me.vel.set(0,0,0);
 }
 // ---------- camera & render
 render(dt){
  const cam=this.camera,s=this.settings,v=this.view;const tgt=this.viewEnt();if(!tgt)return;
  const fpv=this.fpv;
  if(fpv){this.positionFPS(dt)}
  else{ // third person chase
   const yaw=(tgt.id===this.myId)?(this.specYaw||0):(this.specYaw||tgt.yaw)+0;
   const dist=5.5,pitch=this.specPitch||.35;const cx=tgt.rpos.x+Math.sin(yaw)*dist*Math.cos(pitch),cz=tgt.rpos.z+Math.cos(yaw)*dist*Math.cos(pitch),cyy=tgt.rpos.y+1.5+Math.sin(pitch)*dist;
   cam.position.set(cx,Math.max(cyy,W.H(cx,cz)+.5),cz);cam.lookAt(tgt.rpos.x,tgt.rpos.y+1.2,tgt.rpos.z);
   if(this.over&&this.winnerId===tgt.id){const a=this.t*.5;cam.position.set(tgt.rpos.x+Math.sin(a)*5,tgt.rpos.y+2,tgt.rpos.z+Math.cos(a)*5);cam.lookAt(tgt.rpos.x,tgt.rpos.y+1.1,tgt.rpos.z)}
   cam.fov=lerp(cam.fov,s.fov,.1);cam.rotation.z=0}
  cam.updateProjectionMatrix();
  this.sky.position.copy(cam.position);updateSun(this,cam);
  this.audio.listener={x:cam.position.x,y:cam.position.y,z:cam.position.z,yaw:fpv?this.me.yaw:(this.specYaw||0)};
  for(const e of this.list)this.updateSprite(e,dt,cam.position);
  const st=this.storm;const inStorm=this.insideStorm(cam.position.x,cam.position.z)===false;this.scene.fog.color.set(inStorm?'#7a4ab0':'#b9dcf5');this.fx.stormy=inStorm;
  this.renderWorld(cam);
  if(fpv&&this.me.drop===null){this.updateViewmodel(dt);this.renderer.autoClear=false;this.renderer.clearDepth();this.renderer.render(this.vmScene,this.vmCam);this.renderer.autoClear=true}
 }
 renderWorld(cam){
  const r=this.renderer,pf=this.app.pf||1,use=pf<.99;
  const db=r.getDrawingBufferSize(this.dbv||(this.dbv=new THREE.Vector2()));
  let rt=null;
  if(use){const w=Math.max(8,Math.ceil(db.x*pf)),h=Math.max(8,Math.ceil(db.y*pf));
   if(!this.rt||this.rt.width!==w||this.rt.height!==h){if(this.rt){this.rt.dispose();this.rt.depthTexture.dispose()}
    this.rt=new THREE.WebGLRenderTarget(w,h,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthTexture:new THREE.DepthTexture(w,h)});
    if(!this.quad){this.quadCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);this.quadScene=new THREE.Scene();this.quadMat=new THREE.ShaderMaterial({uniforms:{t:{value:null}},depthTest:false,depthWrite:false,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D t;varying vec2 vUv;void main(){gl_FragColor=texture2D(t,vUv);\n#include <colorspace_fragment>\n}'});this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.quadMat);this.quad.frustumCulled=false;this.quadScene.add(this.quad)}}
   rt=this.rt}
  for(const e of this.list){for(const m of[e.spr.mat,e.spr.nmat]){const u=m.uniforms;u.uUse.value=use?1:0;u.uRes.value.set(db.x,db.y);u.tDepth.value=rt?rt.depthTexture:null;u.uNear.value=cam.near;u.uFar.value=cam.far}}
  r.autoClear=true;
  if(!use){cam.layers.enableAll();r.render(this.scene,cam);return}
  cam.layers.set(0);r.setRenderTarget(rt);r.clear();r.render(this.scene,cam);r.setRenderTarget(null);
  this.quadMat.uniforms.t.value=rt.texture;r.render(this.quadScene,this.quadCam);
  cam.layers.set(1);r.autoClear=false;r.render(this.scene,cam);r.autoClear=true;cam.layers.enableAll();
 }
 resize(w,h){this.camera.aspect=w/h;this.vmCam.aspect=w/h;this.camera.updateProjectionMatrix();this.vmCam.updateProjectionMatrix()}
}
Object.assign(Game.prototype,movementMethods,combatMethods,lootMethods,botMethods,netMethods);
