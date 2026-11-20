import * as THREE from 'three';
import {WEAPONS,ITEMS,RARITY,clamp,lerp} from './data.js';
import * as W from './world.js';
import {R,HSTAND,HCROUCH,EYE,EYEC,EYES,GRAV,JUMP,WALK,SPRINT,CROUCH,wstat,makeWeaponModel,mat} from './shared.js';

export const movementMethods={
 readInput(){
  const I=this.input,s=this.settings,me=this.me;
  const active=this.app.inputActive();
  if(!active){return {f:0,s:0,jump:false,jumpP:false,sprint:false,crouch:me.crouchState||false,crouchP:false}}
  const f=(I.down('fwd')?1:0)-(I.down('back')?1:0),st=(I.down('right')?1:0)-(I.down('left')?1:0);
  let sprint=I.down('sprint');if(s.autoSprint&&f>0)sprint=true;
  let crouch;if(s.crouchToggle){if(I.pressed('crouch'))me.crouchState=!me.crouchState;crouch=!!me.crouchState}else crouch=I.down('crouch');
  const crouchP=s.crouchToggle?I.pressed('crouch'):I.pressed('crouch');
  return {f,s:st,jump:I.down('jump'),jumpP:I.pressed('jump'),sprint,crouch,crouchP};
 },
 updateLocal(dt){
  const me=this.me,I=this.input,s=this.settings,v=this.view;const active=this.app.inputActive();
  const{dx,dy}=I.takeLook();
  const cur=me.inv[me.cur];const wd=cur&&cur.k==='w'?wstat(cur.w,cur.r):null;
  if(active){const ads=v.adsK>.05;const ratio=Math.tan(this.camera.fov*Math.PI/360)/Math.tan(s.fov*Math.PI/360);let k=.0022*s.sens*s.camSens*ratio*(ads?(1-v.adsK)+v.adsK*s.adsSens:1);if(me.eatT>0)k*=.3;me.yaw-=dx*k;me.pitch=clamp(me.pitch-dy*k*(s.invertY?-1:1),-1.5,1.5)}
  const inp=this.readInput();
  // bus
  if(me.drop==='bus'){
   const atEnd=this.bus.t*this.bus.speed>this.bus.len-25;
   if((active&&inp.jumpP)||atEnd)this.leaveBus(me);
   me.pos.copy(this.bus.pos);this.hud.setBusHint&&0;return}
  me.sprinting=inp.sprint&&inp.f>0&&me.grounded&&!me.crouch&&!me.sliding&&!me.use;
  this.move(me,inp,dt);
  // timers / buffs shown
  if(me.buffT>0)me.buffT-=0;
  // weapon switching
  if(active&&me.drop===null){
   for(let i=0;i<6;i++)if(I.pressed('s'+(i+1)))this.swapTo(me,i);
   if(I.pressed('next'))this.cycleSlot(me,1);if(I.pressed('prev'))this.cycleSlot(me,-1);
   if(I.pressed('ab1'))this.useAbility(me,0);if(I.pressed('ab2'))this.useAbility(me,1);if(I.pressed('ab3'))this.useAbility(me,2);
   if(I.pressed('drop'))this.dropCurrent(me);
   // interact
   this.updateNearLoot(me);
   if(I.pressed('interact')&&this.near)this.pickupLocal(me,this.near);
  }else this.near=null;
  const aimHeld=active&&(s.aimToggle?(I.pressed('aim')?(me.aimState=!me.aimState):me.aimState):I.down('aim'));
  this.tickWeapon(me,{fire:active&&I.down('fire'),firePressed:active&&I.pressed('fire'),reload:active&&I.pressed('reload'),aim:!!aimHeld&&!me.use},dt);
  // view recoil recovery
  const firing=this.t-(v.lastShot||-9)<.18;const rec=firing?2.2:9;v.recoilP*=Math.exp(-rec*dt);v.recoilY*=Math.exp(-rec*dt);v.kick*=Math.exp(-14*dt);
  v.adsT=clamp((v.adsT||0)+(me.aiming?1:-1)*dt/.15,0,1);v.adsK=v.adsT*v.adsT*(3-2*v.adsT);
  v.equipK=Math.min(1,v.equipK+dt*4.5);
  me.wi=cur&&cur.k==='w'?cur.w*10+cur.r:-1;
  // flags
  me.flags=this.packFlags(me);
  // sprint trail
  if(me.sprinting&&me.cos.trail&&Math.random()<.6)this.fx.emit(me.pos.x,me.pos.y+.2,me.pos.z,(Math.random()-.5)*.6,.5,(Math.random()-.5)*.6,me.cos.trail,.6,0);
 },
 leaveBus(e){if(e.drop!=='bus')return;e.drop='free';e.pos.copy(this.bus.pos);e.vel.set(this.bus.dx*this.bus.speed*.6,-2,this.bus.dz*this.bus.speed*.6);e.grounded=false;e.spawnT=this.t},
 move(e,inp,dt){
  if(!e.alive||e.drop==='bus')return;
  for(const k of ['stun','slip','dance','dazed','eatT','buffT','auraT'])if(e[k]>0)e[k]=Math.max(0,e[k]-dt);
  for(let i=0;i<3;i++)if(e.cd[i]>0)e.cd[i]-=dt;
  if(e.drop){this.moveDrop(e,inp,dt);return}
  const P=e.pos,V=e.vel;
  const stunned=e.stun>0||e.slip>0||e.dance>0||e.eatT>0;
  const h=(e.crouch||e.sliding)?HCROUCH:HSTAND;
  let gnd=W.groundAt(P.x,P.z,P.y,R),swim=false;
  if(W.H(P.x,P.z)<-.9){gnd=Math.max(gnd,-.9);swim=true}e.swim=swim;
  const wasG=e.grounded;const onG=P.y<=gnd+.07&&V.y<=.5;e.grounded=onG;
  let hs=Math.hypot(V.x,V.z);
  // slide
  if(!stunned&&inp.crouchP&&onG&&!e.sliding&&hs>6.2&&!swim&&!e.dash){e.sliding=true;e.slideT=0;e.slideAir=0;const k=Math.min(1.2,15/hs);V.x*=k;V.z*=k;this.audio.play('slide',e.pos,.6)}
  if(e.sliding){e.slideAir=onG?0:(e.slideAir||0)+dt;e.slideT+=dt;if(!inp.crouch||hs<3||e.slideAir>.3||stunned||swim)e.sliding=false}
  e.crouch=inp.crouch&&!e.sliding&&onG&&!stunned;
  // wish
  const sy=Math.sin(e.yaw),cy=Math.cos(e.yaw);
  let f=stunned?0:inp.f,sd=stunned?0:inp.s;
  let wx=-sy*f+cy*sd,wz=-cy*f-sy*sd;const wl=Math.hypot(wx,wz);if(wl>1){wx/=wl;wz/=wl}
  let sp=WALK;const spr=inp.sprint&&f>0&&!e.crouch&&!e.sliding&&!e.use&&!swim;
  if(spr)sp=SPRINT;if(e.crouch)sp=CROUCH;if(e.buffT>0)sp*=1.15;if(e.use)sp*=.5;if(swim)sp*=.5;if(e.dazed>0)sp*=.55;if(e.cdef.id==='zach')sp*=1;if(e.botSpeed)sp*=e.botSpeed;
  e.sprinting=spr&&wl>.1&&onG;
  let justJumped=false;
  // grapple
  if(e.grap){const g=e.grap;const gx=g.x-P.x,gy=g.y-(P.y+1),gz=g.z-P.z,gd=Math.hypot(gx,gy,gz);g.t+=dt;V.set(gx/gd*38,gy/gd*38,gz/gd*38);if(gd<3||g.t>2.4){e.grap=null;V.multiplyScalar(.45)}e.grounded=false}
  else if(e.dash){const d=e.dash;V.x=d.vx;V.z=d.vz;d.t-=dt;if(d.kind==='bite'&&this.findBiteTarget(e,1.9))d.t=0;if(d.t<=0){e.dash=null;V.x*=.25;V.z*=.25;if(d.end)d.end.call(this,e)}}
  else if(e.sliding){
   const[gx,gz]=W.slope(P.x,P.z);V.x+=-gx*30*dt;V.z+=-gz*30*dt;hs=Math.hypot(V.x,V.z);
   const sm=Math.hypot(gx,gz);const down=hs>.1?(V.x*-gx+V.z*-gz)/(hs*(sm+1e-4)):0;
   let fr=5.2-34*Math.max(0,down)*sm;const nh=Math.max(0,Math.min(25,hs-fr*dt));if(hs>.01){V.x*=nh/hs;V.z*=nh/hs}
   if(wl>.1){V.x+=(wx*nh-V.x)*Math.min(1,dt*1.1);V.z+=(wz*nh-V.z)*Math.min(1,dt*1.1)}
   if(inp.jumpP&&onG){V.y=JUMP*.95;V.x*=1.08;V.z*=1.08;e.sliding=false;justJumped=true;this.audio.play('jump',e.pos,.6)}
  }
  else if(e.slip>0){const k=Math.exp(-1.6*dt);V.x*=k;V.z*=k}
  else if(onG){
   const tx=wx*sp,tz=wz*sp;let ax=tx-V.x,az=tz-V.z;const al=Math.hypot(ax,az),md=(wl>.05?85:70)*dt;if(al>md){ax*=md/al;az*=md/al}V.x+=ax;V.z+=az;
   if(inp.jump&&!stunned&&!e.use){V.y=JUMP+(e.sprinting?.5:0);justJumped=true;e.grounded=false;e.airCap=Math.max(sp,Math.hypot(V.x,V.z));if(e.local)this.audio.play('jump',null,.5)}
   else e.airCap=Math.hypot(V.x,V.z);
  }else if(!e.grap){
   if(wl>.05){V.x+=wx*14*dt;V.z+=wz*14*dt;const hh=Math.hypot(V.x,V.z),cap=Math.max(sp,e.airCap||sp);if(hh>cap){V.x*=cap/hh;V.z*=cap/hh}}
  }
  if(e.sliding&&justJumped)e.sliding=false;
  // horizontal collision
  const sp2=Math.hypot(V.x,V.z),n=Math.max(1,Math.ceil(sp2*dt/.35));const sx=V.x*dt/n,sz=V.z*dt/n;
  for(let i=0;i<n;i++){
   if(sx!==0){if(!W.blocked(P.x+sx,P.y,P.z,R,h))P.x+=sx;else V.x*=.2}
   if(sz!==0){if(!W.blocked(P.x,P.y,P.z+sz,R,h))P.z+=sz;else V.z*=.2}}
  W.pushOutCircles(e,R,h);
  const rr=Math.hypot(P.x,P.z);if(rr>W.HALF-8){const k=(W.HALF-8)/rr;P.x*=k;P.z*=k}
  // vertical
  let ng=W.groundAt(P.x,P.z,P.y,R);if(W.H(P.x,P.z)<-.9)ng=Math.max(ng,-.9);
  if(e.grap){P.y+=V.y*dt;if(P.y<ng)P.y=ng;e.grounded=false}
  else if(V.y>0||justJumped){P.y+=V.y*dt;V.y-=GRAV*dt;if(P.y<ng)P.y=ng;const c=W.ceilingAt(P.x,P.z,P.y+h,R);if(P.y+h>c){P.y=c-h;V.y=Math.min(V.y,0)}e.grounded=false}
  else{
   V.y-=GRAV*(swim?.3:1)*dt;P.y+=V.y*dt;
   if(P.y<=ng){const imp=-V.y;P.y=ng;V.y=0;e.grounded=true;if(!wasG&&imp>5)this.onLand(e,imp)}
   else if(wasG&&P.y-ng<.5&&V.y<=0&&!e.dash){P.y=ng;V.y=0;e.grounded=true}
   else e.grounded=false}
  // footsteps
  if(e.grounded&&!e.sliding&&sp2>3&&!swim){e.stepD=(e.stepD||0)+sp2*dt;if(e.stepD>2.2){e.stepD=0;const dd=Math.hypot(e.pos.x-this.camera.position.x,e.pos.z-this.camera.position.z);if(dd<35)this.audio.play('step',e.pos,e.crouch?.3:.7)}}
  if(!e.local)e.crouchState=e.crouch;
 },
 onLand(e,imp){e.landT=.18;if(e.local){this.view.kick=Math.min(1,imp/20);if(imp>10)this.view.shake=Math.min(.5,this.view.shake+.2)}
  if(e.slamming){e.slamming=false;this.slamLand(e)}else if(imp>7){const dd=e.pos.distanceTo(this.camera.position);if(dd<40)this.audio.play('step',e.pos,.9)}},
 moveDrop(e,inp,dt){
  const P=e.pos,V=e.vel;const gnd=W.groundAt(P.x,P.z,P.y,R);const alt=P.y-gnd;
  const sy=Math.sin(e.yaw),cy=Math.cos(e.yaw);let wx=-sy*inp.f+cy*inp.s,wz=-cy*inp.f-sy*inp.s;const wl=Math.hypot(wx,wz);if(wl>1){wx/=wl;wz/=wl}
  if(e.drop==='free'){
   const dive=inp.f>0&&e.pitch<-.3;const vyT=dive?-62:-40,hsT=(dive?24:15);
   V.y+=(vyT-V.y)*Math.min(1,dt*1.8);V.x+=(wx*hsT-V.x)*Math.min(1,dt*1.5);V.z+=(wz*hsT-V.z)*Math.min(1,dt*1.5);
   if(alt<95||(inp.jumpP&&alt<170&&e.spawnT+1<this.t)){e.drop='glide';if(e.local)this.audio.play('ab',null,.4)}
  }else{
   V.y+=(-7.5-V.y)*Math.min(1,dt*2.5);const hsT=inp.f>0?14:9;V.x+=(wx*hsT-V.x)*Math.min(1,dt*2);V.z+=(wz*hsT-V.z)*Math.min(1,dt*2)}
  P.x+=V.x*dt;P.z+=V.z*dt;P.y+=V.y*dt;
  const rr=Math.hypot(P.x,P.z);if(rr>W.HALF-8){const k=(W.HALF-8)/rr;P.x*=k;P.z*=k}
  const g2=W.groundAt(P.x,P.z,P.y,R);if(P.y<=g2+.02){P.y=g2;V.set(V.x*.2,0,V.z*.2);e.drop=null;e.grounded=true;e.landT=.25;e.airCap=0;if(e.local){this.view.kick=.8;this.audio.play('step',null,1)}}
 },
 applyStatusLocal(e,st){
  switch(st.s){
   case'launch':e.vel.set(st.vx||0,st.vy||20,st.vz||0);e.grounded=false;e.sliding=false;e.airCap=Math.max(9,Math.hypot(st.vx||0,st.vz||0));if(e.local)this.audio.play('pad');break;
   case'kb':e.vel.x+=st.vx||0;e.vel.y+=st.vy||0;e.vel.z+=st.vz||0;if((st.vy||0)>0){e.grounded=false}e.sliding=false;break;
   case'slip':e.slip=st.t||1.5;e.sliding=false;e.use=null;if(e.local)this.audio.play('slip');break;
   case'dance':e.dance=st.t||3;e.use=null;break;
   case'daze':e.dazed=st.t||1;break;
   case'stun':e.stun=st.t||.5;break;
  }
 },
 positionFPS(dt){
  const me=this.me,v=this.view,s=this.settings,cam=this.camera;
  const sp=Math.hypot(me.vel.x,me.vel.z);
  const te=me.sliding?EYES:me.crouch?EYEC:EYE;v.eye=lerp(v.eye,te,1-Math.exp(-14*dt));
  if(me.grounded&&!me.sliding)v.bobT+=sp*dt*(me.sprinting?1.5:1.25);
  const bob=me.grounded&&!me.sliding?Math.sin(v.bobT*2)*.045*s.bob*Math.min(1,sp/7):0,bobX=me.grounded&&!me.sliding?Math.cos(v.bobT)*.03*s.bob*Math.min(1,sp/7):0;
  v.shake=Math.max(0,v.shake-dt*2.2);const sh=v.shake*v.shake*.14*s.shake;
  const yaw=me.yaw+v.recoilY+(Math.random()-.5)*sh,pitch=me.pitch+v.recoilP+(Math.random()-.5)*sh;
  let roll=(me.sliding?-.06:0)+(this.input.down('right')?-.018:0)+(this.input.down('left')?.018:0);if(me.drop==='free')roll*=0;
  v.roll=lerp(v.roll,roll,1-Math.exp(-10*dt));
  if(me.drop==='bus'){const b=this.bus;cam.position.set(b.pos.x-b.dx*26,b.pos.y+10,b.pos.z-b.dz*26)}
  else cam.position.set(me.pos.x+bobX*Math.cos(yaw),me.pos.y+v.eye-v.kick*.08+bob,me.pos.z-bobX*Math.sin(yaw));
  cam.rotation.set(pitch,yaw,v.roll,'YXZ');
  const cur=me.inv[me.cur];const wd=cur&&cur.k==='w'?wstat(cur.w,cur.r):null;const z=wd&&wd.zoom>1?wd.zoom:1.0;
  let fov=s.fov+(me.sprinting?5:0)+(me.sliding?7:0)+(me.drop==='free'?10:0);
  const adsFov=z>1?s.fov/(1+(z-1)*.95):s.fov*.8;fov=lerp(fov,adsFov,v.adsK);
  cam.fov=lerp(cam.fov,fov,1-Math.exp(-18*dt));
  this.hud.scope=z>=3&&v.adsK>.85&&!me.use;
 },
 updateViewmodel(dt){
  const me=this.me,v=this.view,cur=me.inv[me.cur];const sp=Math.hypot(me.vel.x,me.vel.z);
  let key=cur?(cur.k==='w'?'w'+cur.w+'_'+cur.r:'i'+cur.id):'none';
  if(me.eatT>0)key='none';
  if(key!==this.vmKey){this.vmKey=key;if(this.vmModel)this.vmScene.remove(this.vmModel);this.vmModel=null;
   if(key!=='none'){let m;if(cur.k==='w'){m=makeWeaponModel(cur.w,cur.r);m.rotation.y=0}else{const it=ITEMS[cur.id];m=new THREE.Group();const b=new THREE.Mesh(new THREE.BoxGeometry(.18,.3,.18),mat(it.col));b.position.set(0,0,-.4);m.add(b);if(it.kind==='throw'){b.geometry=new THREE.SphereGeometry(.12,10,8)}}
    m.scale.setScalar(.55);m.updateMatrixWorld(true);const bb=new THREE.Box3().setFromObject(m);this.vmTip=bb.min.z;this.vmModel=new THREE.Group();this.vmModel.add(m);this.vmScene.add(this.vmModel);
    const fl=new THREE.Mesh(new THREE.PlaneGeometry(.35,.35),new THREE.MeshBasicMaterial({color:'#ffd070',transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));fl.position.set(0,0,this.vmTip-.05);this.vmFlash=fl;this.vmModel.add(fl)}}
  if(!this.vmModel)return;
  const g=this.vmModel,a=v.adsK;v.sway=lerp(v.sway,0,1-Math.exp(-8*dt));
  const bobx=me.grounded&&!me.sliding?Math.cos(v.bobT)*.012*Math.min(1,sp/7):0,boby=me.grounded&&!me.sliding?Math.abs(Math.sin(v.bobT))*.012*Math.min(1,sp/7):0;
  const lowered=(1-v.equipK)*.35+(me.sprinting?.05:0);
  g.position.set(lerp(.2,0,a)+bobx,lerp(-.2,-.085,a)-boby-lowered-v.reloadK*.15,lerp(-.42,-.3,a)+v.kick*.06+v.recoilKick*.08||0);
  g.rotation.set(v.recoilKick*.07+v.reloadK*.7+(me.sprinting?.25:0)+(me.sliding?.15:0),(me.sprinting?.4:0)+v.reloadK*.2,v.reloadK*.3-(me.sliding?.15:0));
  v.recoilKick=(v.recoilKick||0)*Math.exp(-16*dt);
  if(this.vmFlash){this.vmFlash.visible=v.flash>0;if(v.flash>0){v.flash-=dt;this.vmFlash.rotation.z=Math.random()*6;this.vmFlash.scale.setScalar(.7+Math.random()*.6)}}
  const s=this.vmModel.children[0];
  this.vmCam.fov=60;this.vmCam.updateProjectionMatrix();
 },
};
