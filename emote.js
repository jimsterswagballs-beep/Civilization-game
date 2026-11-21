// Emotes and Swag Tokens. An emote stuns the player until they press the emote key again, get shot, or the emote ends.
// Media is embedded at build time (esbuild dataurl loader). Timers and state run on the host; clients get 'emo' events.
import * as THREE from 'three';
import {keyLabel} from './data.js';
import BART from './bart.png';
import BESTVID from './best_weapon.mp4';
import LAUGH from './streamer_laugh.mp3';
import HOMER from './homer_barts_out.mp3';

export const EMOTE_LIST=[
 {id:'bestweapon',name:'Best Weapon',price:1000,kind:'video',dur:39.5,video:BESTVID,audio:BESTVID,icon:'\u{1F52B}',asp:480/360,desc:'Become the best weapon. The video fills your screen until you cancel.'},
 {id:'streamer',name:'Streamer Jumps',price:600,kind:'hop',dur:30,audio:LAUGH,icon:'\u{1F3AE}',desc:'Hop around and twirl to the baby laugh.'},
 {id:'bart',name:'Bart',price:700,kind:'bart',dur:36.5,audio:HOMER,img:BART,asp:204/567,desc:'Become Bart and slide around to Let the Barts Out.'},
 {id:'dab',name:'Dab',price:300,kind:'dab',dur:4,sfx:'bell',icon:'\u{1F646}',desc:'A quick pose with a chime.'},
 {id:'floss',name:'Floss',price:400,kind:'floss',dur:6,sfx:'fun',icon:'\u{1F483}',desc:'Sway side to side.'}
];
export const EMOTE_BY=Object.fromEntries(EMOTE_LIST.map(e=>[e.id,e]));
export const CHAR_PRICES={chillguy:900,jay:900};
export const TOKENS={kill:15,perMinute:2,top10:25,win:100,played:10};

let bartTex=null;
function bartTexture(){if(!bartTex){bartTex=new THREE.TextureLoader().load(BART);bartTex.colorSpace=THREE.SRGBColorSpace;bartTex.magFilter=THREE.LinearFilter}return bartTex}
// the fullscreen overlay is used only for the local player's Best Weapon video
function showFullscreen(v){let o=document.getElementById('emoteFull');if(!o){o=document.createElement('div');o.id='emoteFull';document.body.appendChild(o)}o.appendChild(v);o.style.display='block'}
function hideFullscreen(v){const o=document.getElementById('emoteFull');if(!o)return;if(v&&v.parentNode===o)o.removeChild(v);o.style.display='none'}

export const emoteMethods={
 // local player: the emote key starts the equipped emote, or cancels one that is playing
 emoteInput(){
  const me=this.me;if(!me||!me.alive||!this.app.inputActive()||!this.input.pressed('emote'))return;
  if(me.emote){this.requestEmote(me,false);return}
  const id=this.app.profile.equipEmote;
  if(!id){this.hud.toast('Pick an emote in the Locker first','#ffb347');return}
  if(me.drop||me.use||me.eatT>0||me.stun>0){this.hud.toast("Can't emote right now",'#ffb347');return}
  this.requestEmote(me,true,id);
 },
 requestEmote(e,on,id){
  if(this.role==='client'){if(e.local)this.net.toHost({t:'emo',on:on?1:0,id});return}
  if(on)this.startEmote(e,id);else this.stopEmote(e);
 },
 // host only: validate, then broadcast the start event (emit also applies it locally)
 startEmote(e,id){
  if(!EMOTE_BY[id]||!e.alive||e.emote||e.drop||e.use||e.eatT>0||e.stun>0||e.knocked)return;
  this.emit({k:'emo',i:e.id,id,on:1});
 },
 stopEmote(e){if(e.emote)this.emit({k:'emo',i:e.id,on:0})},
 // host only: emotes end after their length, or when the player dies
 updateEmotes(){for(const e of this.list){const em=e.emote;if(em&&(!e.alive||this.t>=em.end))this.stopEmote(e)}},

 applyEmote(e,id){
  const d=EMOTE_BY[id];if(!d)return;
  this.clearEmote(e);
  const em={id,d,t0:this.t,end:this.t+d.dur,tex:null,vid:null,src:null,done:false};e.emote=em;
  if(d.kind==='video'){
   const v=document.createElement('video');v.src=d.video;v.muted=true;v.playsInline=true;v.preload='auto';v.play().catch(()=>{});
   em.vid=v;em.tex=new THREE.VideoTexture(v);em.tex.colorSpace=THREE.SRGBColorSpace;
   if(e.local)showFullscreen(v);
  }else if(d.kind==='bart')em.tex=bartTexture();
  if(e.spr)e.spr.view='';                       // force the sprite texture to refresh
  // sound: emotes with music play it through the proximity chain; others play a short sound effect
  if(d.audio)this.audio.playEmote(d.audio,e.pos,.9).then(s=>{if(em.done){if(s)try{s.stop()}catch(_){}}else em.src=s});
  else if(d.sfx)this.audio.play(d.sfx,e.pos,.8);
  if(e.local)this.hud.toast(d.name+' · press '+keyLabel(this.input.binds.emote)+' to cancel','#9be0ff');
 },
 clearEmote(e){
  const em=e.emote;if(!em)return;
  em.done=true;
  if(em.src){try{em.src.stop()}catch(_){}}
  if(em.vid){em.vid.pause();hideFullscreen(em.vid);em.vid.removeAttribute('src');em.vid.load()}
  if(em.tex&&em.tex.dispose)em.tex.dispose();
  const s=e.spr;if(s){s.plane.scale.x=1;s.view=''}
  e.emote=null;
 },
 // per-frame sprite offsets for the current emote (returned values are added to the normal animation)
 emoteAnim(e,s){
  const em=e.emote,d=em.d,t=this.t-em.t0;
  const R={py:0,rz:0,sx:1,sy:1,px:0,asp:1};
  if(d.kind==='video')R.asp=d.asp;
  else if(d.kind==='bart'){R.asp=d.asp;R.px=Math.sin(t*3.1)*.85;R.rz=Math.cos(t*3.1)*.14;R.py=Math.abs(Math.sin(t*6.2))*.06}
  else if(d.kind==='hop'){R.py=Math.abs(Math.sin(t*5.5))*.9;R.rz=Math.sin(t*5.5)*.08;const ph=t%2.6;if(ph<.7)R.sx=Math.abs(Math.cos(ph/.7*Math.PI))}
  else if(d.kind==='dab'){const k=Math.min(1,t/.25);R.rz=-.5*k;R.px=-.25*k;R.py=.05*k}
  else if(d.kind==='floss'){R.px=Math.sin(t*9)*.3;R.rz=Math.sin(t*9)*.22;R.py=Math.abs(Math.sin(t*9))*.12}
  s.plane.scale.x=R.asp;
  return R;
 },

 // rewards for the local player, paid once per match when they die or the match ends
 awardTokens(won){
  if(this.tokensPaid)return;this.tokensPaid=true;
  const me=this.me;const survived=me.alive?this.t:(this.deathT||this.t);
  const parts=[['Eliminations',me.kills*TOKENS.kill],['Survival',Math.floor(survived/60)*TOKENS.perMinute],['Played',TOKENS.played]];
  if(won)parts.push(['Victory Royale',TOKENS.win]);else if(me.place&&me.place<=10)parts.push(['Top 10',TOKENS.top10]);
  const total=parts.reduce((a,p)=>a+p[1],0);
  this.app.addTokens(total,parts.filter(p=>p[1]>0).map(p=>p[0]+' +'+p[1]).join(' · '));
 }
};
