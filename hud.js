import * as THREE from 'three';
import {WEAPONS,ITEMS,RARITY,AMMO,CHARS,keyLabel,clamp,lerp} from './data.js';
import * as W from './world.js';
import {wstat,IMG} from './shared.js';
const $=id=>document.getElementById(id);
const el=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!==undefined)e.innerHTML=h;return e};
export class HUD{
 constructor(app){this.app=app;this.root=$('hud');this.scope=false;this.toastT=0;this.build();this.mapImg=null;this.dmgNums=[];this.lastSlotKey='';}
 build(){
  this.root.innerHTML=`
  <div id="vig"></div><div id="scope"></div><div id="dmgdir"></div>
  <div id="cross"><i></i><i></i><i></i><i></i><b></b></div><div id="hitm"><i></i><i></i><i></i><i></i></div>
  <div id="topr"><div class="pill" id="alive"><span>👥</span><b id="aliveN">100</b></div><div class="pill" id="kills"><span>☠</span><b id="killN">0</b></div><div class="pill" id="fps" style="display:none"></div></div>
  <div id="mmwrap"><canvas id="mm" width="340" height="340"></canvas><div id="stormbox"><div id="stormlbl">Storm</div><div id="stormtime">--</div></div><div id="locname"></div></div>
  <div id="killfeed"></div><div id="toasts"></div><div id="announce"></div>
  <div id="prompt"><span class="k"></span><span class="t"></span></div>
  <div id="usebar"><div><i></i></div><span></span></div>
  <div id="busHint"></div>
  <div id="bottom">
   <div id="abil"></div>
   <div id="barwrap"><div id="shbar"><i></i><b></b></div><div id="hpbar"><i></i><b></b></div></div>
   <div id="slots"></div>
  </div>
  <div id="ammoBox"><b id="magN">0</b><span id="resN">/ 0</span><em id="ammoT"></em></div>
  <div id="board"></div>
  <div id="dmgnums"></div>`;
  this.q=s=>this.root.querySelector(s);
  this.mm=$('mm');this.mx=this.mm.getContext('2d');
  this.abilEls=[];this.slotEls=[];
 }
 makeMapImage(){
  const S=700,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');const id=x.createImageData(S,S);const d=id.data;const k=W.HALF*2/S;
  const col=(h,sl)=>h<-4?[24,70,110]:h<-.2?[40,105,150]:h<1.8?[226,212,150]:h>34?[240,244,248]:(sl>.75||h>26)?[140,134,122]:[96+(h*.6|0),160+(h*.5|0),74];
  for(let j=0;j<S;j++)for(let i=0;i<S;i++){const wx=(i+.5)*k-W.HALF,wz=(j+.5)*k-W.HALF;const h=W.H(wx,wz);const[gx,gz]=W.slope(wx,wz);const sl=Math.hypot(gx,gz);const c2=col(h,sl);const sh=1+clamp((gx+gz)*-.25,-.2,.2);const p=(j*S+i)*4;d[p]=c2[0]*sh;d[p+1]=c2[1]*sh;d[p+2]=c2[2]*sh;d[p+3]=255}
  x.putImageData(id,0,0);x.fillStyle='rgba(60,60,60,.9)';
  for(const b of W.buildings){x.fillRect((b.x-b.w/2+W.HALF)/k,(b.z-b.d/2+W.HALF)/k,b.w/k,b.d/k)}
  this.mapImg=c;this.mapK=k;this.mapS=S}
 onStart(g){
  this.g=g;if(!this.mapImg)this.makeMapImage();
  this.q('#killfeed').innerHTML='';this.q('#toasts').innerHTML='';this.q('#announce').innerHTML='';this.q('#dmgnums').innerHTML='';this.dmgNums=[];
  this.root.style.display='block';this.q('#fps').style.display=g.settings.fps?'block':'none';
  const me=g.me;this.abilEls=[];const ab=this.q('#abil');ab.innerHTML='';
  me.cdef.ab.forEach((a,i)=>{const d=el('div','abil',`<div class="ico">${['①','②','③'][i]}</div><div class="cdo"></div><div class="cdt"></div><div class="kk"></div><div class="an">${a.n}</div>`);ab.appendChild(d);this.abilEls.push(d)});
  this.slotsKey='';this.announce('Battle Bus is launching – press SPACE to jump!','#ffd23d');this.board=false;
  this.finished=false;$('elim').style.display='none';$('victory').style.display='none';
 }
 hide(){this.root.style.display='none'}
 toast(m,c){const t=el('div','toast',m);if(c)t.style.color=c;const box=this.q('#toasts');box.appendChild(t);while(box.children.length>3)box.removeChild(box.firstChild);setTimeout(()=>t.remove(),2200)}
 announce(m,c='#fff'){const a=this.q('#announce');a.textContent=m;a.style.color=c;a.classList.remove('show');void a.offsetWidth;a.classList.add('show')}
 killfeed(by,v,w,mine,died){
  const wn=w>=0&&WEAPONS[w]?WEAPONS[w].n:w===-1?'Ground Slam':w===-2?'Energy Burst':w===-3?'Shockwave':w===-4?'Chomp':w===-5?'Grenade':w===-9||w===undefined?'The Storm':'Ability';
  const d=el('div','kf'+(mine?' mine':died?' died':''),`<b>${by||'Storm'}</b> <i>${wn}</i> <b>${v}</b>`);const kf=this.q('#killfeed');kf.appendChild(d);while(kf.children.length>5)kf.removeChild(kf.firstChild);setTimeout(()=>d.remove(),6000)}
 hitmarker(kill,head,sh){const h=this.q('#hitm');h.className=(kill?'kill ':'')+(head?'head ':'')+(sh?'sh ':'');void h.offsetWidth;h.className+='show'}
 dmgNumber(pos,d,head,g){const n=el('div','dn'+(head?' hd':''),d);this.q('#dmgnums').appendChild(n);this.dmgNums.push({n,p:pos.clone(),t:0,dx:(Math.random()-.5)*40});setTimeout(()=>{n.remove();this.dmgNums=this.dmgNums.filter(x=>x.n!==n)},900)}
 flashDamage(from,g){const v=this.q('#vig');v.classList.remove('hurt');void v.offsetWidth;v.classList.add('hurt');
  const dd=this.q('#dmgdir');if(from){const me=g.me;const dx=from.x-me.pos.x,dz=from.z-me.pos.z;const ang=Math.atan2(dx,-dz)+me.yaw;dd.style.transform=`rotate(${ang*57.3}deg)`;dd.classList.remove('show');void dd.offsetWidth;dd.classList.add('show')}}
 setPrompt(label,l){const p=this.q('#prompt');if(!label){p.style.display='none';return}p.style.display='flex';p.querySelector('.k').textContent=keyLabel(this.app.input.binds.interact);const t=p.querySelector('.t');t.textContent=label;t.style.color=l.item?(l.item.k==='w'?RARITY[l.item.r].c:'#fff'):(l.supply?'#ff8a8a':'#ffd23d')}
 useBar(u){const b=this.q('#usebar');b.style.display='block';b.querySelector('i').style.width=((1-u.t/u.dur)*100)+'%';b.querySelector('span').textContent=ITEMS[u.id]?ITEMS[u.id].n:''}
 abilityUsed(i){}
 markSupply(){}
 showElim(place,by,kills,g){setTimeout(()=>{if(g.over)return;const e=$('elim');e.style.display='flex';$('elimPlace').textContent='#'+place;$('elimBy').textContent='Eliminated by '+by;$('elimKills').textContent=kills+' eliminations';this.app.showCursor(true)},1500)}
 showVictory(g){}
 onEnd(g,ev){this.finished=true;$('elim').style.display='none';const won=g.me.alive&&ev.win===g.myId;const v=$('victory');v.classList.toggle('lose',!won);v.style.display='flex';
  if(won){$('vicTitle').textContent='VICTORY ROYALE';$('vicSub').textContent='#1 – last one standing!'}
  else{const w=g.ents.get(ev.win);$('vicTitle').textContent=(w?w.name:'Nobody')+' WINS';$('vicSub').textContent='You placed #'+g.me.place}
  $('vicKills').textContent=g.me.kills+' eliminations';if(won)this.confetti();setTimeout(()=>this.app.showCursor(true),800)}
 confetti(){const c=$('confetti');c.innerHTML='';for(let i=0;i<90;i++){const p=el('i');p.style.left=Math.random()*100+'%';p.style.background=`hsl(${Math.random()*360},90%,60%)`;p.style.animationDelay=Math.random()*2+'s';p.style.animationDuration=2.5+Math.random()*2.5+'s';c.appendChild(p)}}
 update(g,dt){
  const me=g.me,tgt=g.viewEnt(),I=this.app.input,B=I.binds;
  // bars
  const hp=tgt.hp,sh=tgt.sh+(tgt.ts||0);
  this.q('#hpbar i').style.width=clamp(hp/tgt.maxHp*100,0,100)+'%';this.q('#hpbar b').textContent=Math.ceil(hp)+' / '+tgt.maxHp;
  this.q('#shbar i').style.width=clamp(sh,0,100)+'%';this.q('#shbar b').textContent=Math.ceil(sh);this.q('#shbar').classList.toggle('temp',(tgt.ts||0)>0);
  this.q('#aliveN').textContent=g.aliveCount();this.q('#killN').textContent=me.kills;
  // storm
  const s=g.storm;let lbl='Storm approaching',tm=s.t;
  if(s.state==='idle'){lbl='Storm forming';tm=Math.max(0,10-g.t)+0}else if(s.state==='wait')lbl='Storm shrinks in';else if(s.state==='shrink')lbl='Storm closing';else lbl='Final circle';
  if(s.state==='idle')tm=Math.max(0,10-g.t);
  this.q('#stormlbl').textContent=lbl+(s.phase>=0?'  •  '+(s.phase+1):'');this.q('#stormtime').textContent=s.state==='done'?'--':Math.floor(Math.max(0,tm)/60)+':'+String(Math.floor(Math.max(0,tm)%60)).padStart(2,'0');
  const poi=W.poiAt(tgt.pos.x,tgt.pos.z);this.q('#locname').textContent=poi?poi.n:'';
  // slots
  const key=me.inv.map(s=>s?(s.k==='w'?s.w+'.'+s.r:s.id+s.n):'-').join(',')+me.cur;
  if(key!==this.slotsKey){this.slotsKey=key;const sl=this.q('#slots');sl.innerHTML='';
   me.inv.forEach((s,i)=>{const d=el('div','slot'+(i===me.cur?' cur':''));d.innerHTML=`<em>${i+1}</em>`;
    if(s){if(s.k==='w'){const w=WEAPONS[s.w];d.style.borderColor=RARITY[s.r].c;d.style.background=`linear-gradient(180deg,${RARITY[s.r].c}33,rgba(10,12,20,.75))`;d.innerHTML+=`<div class="wi">${w.t==='melee'?'⛏':w.t==='ar'?'🔫':w.t==='smg'?'🔫':w.t==='sg'?'💥':w.t==='sn'?'🎯':w.t==='pi'?'🔫':w.t==='ex'?'🚀':'🎉'}</div><div class="wn" style="color:${RARITY[s.r].c}">${w.n}</div>`}
     else{const it=ITEMS[s.id];d.style.borderColor=it.col;d.innerHTML+=`<div class="wi">${it.ic}</div><div class="wn">${it.n}</div><b>${s.n}</b>`}}
    sl.appendChild(d)})}
  // ammo
  const cur=me.inv[me.cur];const ab=this.q('#ammoBox');
  if(cur&&cur.k==='w'&&cur.w!==0){const wd=wstat(cur.w,cur.r);ab.style.display='flex';this.q('#magN').textContent=cur.mag;this.q('#resN').textContent='/ '+me.ammo[wd.ammo];this.q('#ammoT').textContent=me.reload>0?'RELOADING':AMMO[wd.ammo].n;this.q('#ammoT').style.color=me.reload>0?'#ffd23d':'#aab';this.q('#magN').style.color=cur.mag<=Math.ceil(wd.mag*.25)?'#ff6b6b':'#fff'}
  else if(cur&&cur.k==='i'){ab.style.display='flex';this.q('#magN').textContent=cur.n;this.q('#resN').textContent='';this.q('#ammoT').textContent=ITEMS[cur.id].n}
  else ab.style.display='none';
  if(!me.use)this.q('#usebar').style.display='none';
  // abilities
  me.cdef.ab.forEach((a,i)=>{const d=this.abilEls[i];if(!d)return;const cd=me.cd[i];d.querySelector('.cdo').style.height=(cd>0?cd/a.cd*100:0)+'%';d.querySelector('.cdt').textContent=cd>0?Math.ceil(cd):'';d.querySelector('.kk').textContent=keyLabel(B['ab'+(i+1)]);d.classList.toggle('ready',cd<=0);
   const act=(i===1&&me.auraT>0&&me.cdef.id==='coolguy15')||(i===2&&me.buffT>0&&me.cdef.id==='zach');d.classList.toggle('active',!!act)});
  // crosshair
  const wd=g.curWeapon(me);const c=this.q('#cross');const sp=Math.hypot(me.vel.x,me.vel.z);
  let gap=6+(wd?wd.sp*600:0)*(me.aiming?.4:1)+sp*.7+me.bloom*250+(g.view.recoilP*220);c.style.setProperty('--g',gap+'px');c.classList.toggle('ads',g.view.adsK>.5&&!!wd);c.style.opacity=(me.alive&&me.drop===null&&!(wd&&wd.zoom>=3&&g.view.adsK>.3)&&cur&&!(cur.k==='i'))?'1':(cur&&cur.k==='i'&&me.drop===null?'.8':'0');
  this.q('#scope').style.display=this.scope?'block':'none';
  // vignette storm
  const inS=g.insideStorm(tgt.pos.x,tgt.pos.z);this.q('#vig').classList.toggle('storm',!inS);
  // bus hint
  const bh=this.q('#busHint');if(me.drop==='bus'&&me.alive){bh.style.display='block';bh.innerHTML=`Press <b>${keyLabel(B.jump)}</b> to jump from the Battle Bus`}else if(me.drop==='free'||me.drop==='glide'){bh.style.display='block';bh.innerHTML=me.drop==='free'?`Dive with <b>${keyLabel(B.fwd)}</b> + look down · glider auto-deploys low`:'Gliding…';if(me.drop==='free'&&performance.now()%1e9<1e12)bh.innerHTML+=` · <b>${keyLabel(B.jump)}</b> deploys early`}else bh.style.display='none';
  if(!me.alive&&!g.over){bh.style.display='block';bh.innerHTML=`Spectating <b>${tgt.name}</b> · <b>${keyLabel(B.spec)}</b> next player`}
  // damage numbers
  const cam=g.camera;for(const d of this.dmgNums){d.t+=dt;const v=d.p.clone().project(cam);if(v.z>1){d.n.style.display='none';continue}d.n.style.display='block';d.n.style.left=((v.x*.5+.5)*innerWidth+d.dx*d.t)+'px';d.n.style.top=((-v.y*.5+.5)*innerHeight-d.t*60)+'px';d.n.style.opacity=Math.max(0,1-d.t/.9)}
  // fps
  if(g.settings.fps){this.fpsAcc=(this.fpsAcc||0)+dt;this.fpsN=(this.fpsN||0)+1;if(this.fpsAcc>.5){this.q('#fps').textContent=Math.round(this.fpsN/this.fpsAcc)+' FPS';this.fpsAcc=0;this.fpsN=0}}
  this.drawMinimap(g,tgt);
  // scoreboard
  const bd=this.q('#board');if(I.down('score')){bd.style.display='block';if(!this.bt||performance.now()-this.bt>300){this.bt=performance.now();const l=g.list.slice().sort((a,b)=>b.kills-a.kills||(b.alive-a.alive));bd.innerHTML='<h3>Players</h3>'+l.slice(0,16).map(e=>`<div class="${e.alive?'':'dead'}"><span>${e.name}${e.bot?' 🤖':''}</span><b>${e.kills}</b></div>`).join('')}}else bd.style.display='none';
 }
 drawMinimap(g,tgt,big){
  const cv=big||this.mm,x=big?big.getContext('2d'):this.mx,S=cv.width;x.clearRect(0,0,S,S);if(!this.mapImg)return;
  const view=big?W.HALF*2:230;const k=S/view;const m2px=this.mapS/(W.HALF*2);
  x.save();
  if(big){x.drawImage(this.mapImg,0,0,S,S)}
  else{x.beginPath();x.arc(S/2,S/2,S/2,0,6.283);x.clip();x.translate(S/2,S/2);if(g.settings.mapRotate)x.rotate(tgt.yaw);x.scale(k,k);x.translate(-tgt.pos.x,-tgt.pos.z);x.drawImage(this.mapImg,-W.HALF,-W.HALF,W.HALF*2,W.HALF*2)}
  const T=big?(px,pz)=>[(px+W.HALF)*k,(pz+W.HALF)*k]:null;
  const st=g.storm;
  // storm overlay
  if(!big){x.fillStyle='rgba(140,60,220,.45)';x.beginPath();x.rect(tgt.pos.x-300,tgt.pos.z-300,600,600);x.arc(st.cx,st.cz,st.r,0,6.283,true);x.fill('evenodd');x.strokeStyle='#cf8bff';x.lineWidth=2/k;x.beginPath();x.arc(st.cx,st.cz,st.r,0,6.283);x.stroke();
   const z=g.nextZone();if(z){x.strokeStyle='#fff';x.lineWidth=2/k;x.beginPath();x.arc(z.x,z.z,z.r,0,6.283);x.stroke()}
   for(const s of g.supplies)if(!s.landed||g.loot.has(s.id)){x.fillStyle='#ff4a4a';x.fillRect(s.x-5,s.z-5,10,10)}
   // bus
   if(g.busMesh&&g.busMesh.visible){x.fillStyle='#ffd23d';x.beginPath();x.arc(g.bus.pos.x,g.bus.pos.z,5/k*.9,0,6.283);x.fill()}
   x.restore();
   x.save();x.translate(S/2,S/2);if(!g.settings.mapRotate)x.rotate(-0)  ;
   x.rotate(g.settings.mapRotate?0:-tgt.yaw);
   x.fillStyle='#fff';x.strokeStyle='#000';x.lineWidth=2;x.beginPath();x.moveTo(0,-11);x.lineTo(8,8);x.lineTo(0,4);x.lineTo(-8,8);x.closePath();x.fill();x.stroke();x.restore();
   x.strokeStyle='rgba(255,255,255,.5)';x.lineWidth=3;x.beginPath();x.arc(S/2,S/2,S/2-1.5,0,6.283);x.stroke();return}
  // big map
  const P=(px,pz)=>[(px+W.HALF)*k,(pz+W.HALF)*k];
  x.fillStyle='rgba(140,60,220,.4)';x.beginPath();x.rect(0,0,S,S);const[c0,c1]=P(st.cx,st.cz);x.arc(c0,c1,st.r*k,0,6.283,true);x.fill('evenodd');x.strokeStyle='#cf8bff';x.lineWidth=3;x.beginPath();x.arc(c0,c1,st.r*k,0,6.283);x.stroke();
  const z=g.nextZone();if(z){const[a,b]=P(z.x,z.z);x.strokeStyle='#fff';x.lineWidth=3;x.beginPath();x.arc(a,b,z.r*k,0,6.283);x.stroke()}
  x.font='bold 15px Arial Black,Arial';x.textAlign='center';x.lineWidth=4;x.strokeStyle='rgba(0,0,0,.8)';x.fillStyle='#fff';for(const p of W.POIS){const[a,b]=P(p.x,p.z);x.strokeText(p.n,a,b);x.fillText(p.n,a,b)}
  // bus path
  const b=g.bus;const[s0,s1]=P(b.sx,b.sz),[e0,e1]=P(b.sx+b.dx*b.len,b.sz+b.dz*b.len);x.strokeStyle='#ffd23d';x.setLineDash([10,8]);x.lineWidth=3;x.beginPath();x.moveTo(s0,s1);x.lineTo(e0,e1);x.stroke();x.setLineDash([]);
  const[bp0,bp1]=P(b.pos.x,b.pos.z);if(g.busMesh.visible){x.fillStyle='#ffd23d';x.beginPath();x.arc(bp0,bp1,9,0,6.283);x.fill()}
  for(const s of g.supplies){const[a,c]=P(s.x,s.z);x.fillStyle='#ff4a4a';x.fillRect(a-7,c-7,14,14)}
  const[m0,m1]=P(tgt.pos.x,tgt.pos.z);x.save();x.translate(m0,m1);x.rotate(-tgt.yaw+Math.PI);x.fillStyle='#fff';x.strokeStyle='#000';x.lineWidth=2;x.beginPath();x.moveTo(0,12);x.lineTo(9,-10);x.lineTo(0,-5);x.lineTo(-9,-10);x.closePath();x.fill();x.stroke();x.restore();
  x.restore()}
}
