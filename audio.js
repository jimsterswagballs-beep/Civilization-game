export class Audio{
 constructor(){this.ctx=null;this.master=null;this.sfxG=null;this.musG=null;this.vol={master:.8,sfx:.9,music:.4};this.listener={x:0,y:0,z:0,yaw:0};this.musicOn=false;this.step=0;this.mode='menu'}
 init(){if(this.ctx)return;try{const C=window.AudioContext||window.webkitAudioContext;this.ctx=new C();this.master=this.ctx.createGain();this.sfxG=this.ctx.createGain();this.musG=this.ctx.createGain();this.sfxG.connect(this.master);this.musG.connect(this.master);this.master.connect(this.ctx.destination);
  const len=this.ctx.sampleRate;this.noiseBuf=this.ctx.createBuffer(1,len,this.ctx.sampleRate);const d=this.noiseBuf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;this.apply();this.startMusic()}catch(e){this.ctx=null}}
 apply(){if(!this.ctx)return;this.master.gain.value=this.vol.master;this.sfxG.gain.value=this.vol.sfx;this.musG.gain.value=this.vol.music*.35}
 setVol(m,s,mu){this.vol={master:m/100,sfx:s/100,music:mu/100};this.apply()}
 resume(){if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume()}
 noise(dur,f0,f1,g,type='lowpass',dest,delay=0){const c=this.ctx,s=c.createBufferSource();s.buffer=this.noiseBuf;const f=c.createBiquadFilter();f.type=type;f.frequency.setValueAtTime(f0,c.currentTime+delay);f.frequency.exponentialRampToValueAtTime(Math.max(30,f1),c.currentTime+delay+dur);const ga=c.createGain();ga.gain.setValueAtTime(g,c.currentTime+delay);ga.gain.exponentialRampToValueAtTime(.001,c.currentTime+delay+dur);s.connect(f);f.connect(ga);ga.connect(dest);s.start(c.currentTime+delay,Math.random()*.5,dur+.05)}
 tone(freq,dur,g,type='sine',dest,f1,delay=0){const c=this.ctx,o=c.createOscillator();o.type=type;o.frequency.setValueAtTime(freq,c.currentTime+delay);if(f1)o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),c.currentTime+delay+dur);const ga=c.createGain();ga.gain.setValueAtTime(g,c.currentTime+delay);ga.gain.exponentialRampToValueAtTime(.001,c.currentTime+delay+dur);o.connect(ga);ga.connect(dest);o.start(c.currentTime+delay);o.stop(c.currentTime+delay+dur+.05)}
 // play a sound; pos optional {x,y,z}
 play(name,pos,gain=1){
  if(!this.ctx)return;let d=0,pan=0;
  if(pos){const L=this.listener;const dx=pos.x-L.x,dz=pos.z-L.z;d=Math.hypot(dx,dz,(pos.y-L.y)*.5);gain*=1/(1+d*.045);if(gain<.02)return;const rx=Math.cos(L.yaw),rz=-Math.sin(L.yaw);pan=Math.max(-1,Math.min(1,(dx*rx+dz*rz)/(d+1)))}
  const c=this.ctx;let dest=this.sfxG;const g=c.createGain();g.gain.value=gain;let out=g;
  if(c.createStereoPanner){const p=c.createStereoPanner();p.pan.value=pan;g.connect(p);p.connect(this.sfxG)}else g.connect(this.sfxG);dest=g;
  switch(name){
   case'ar':this.noise(.12,5000,600,.8,'lowpass',dest);this.tone(140,.1,.5,'square',dest,60);break;
   case'smg':this.noise(.08,6000,900,.6,'lowpass',dest);this.tone(200,.06,.3,'square',dest,90);break;
   case'sg':this.noise(.3,3500,300,1,'lowpass',dest);this.tone(90,.25,.8,'sawtooth',dest,40);break;
   case'sn':this.noise(.5,6000,200,1,'lowpass',dest);this.tone(70,.4,.9,'sawtooth',dest,30);break;
   case'pi':this.noise(.1,4500,700,.7,'lowpass',dest);this.tone(180,.08,.4,'square',dest,80);break;
   case'quiet':this.noise(.06,3000,800,.25,'lowpass',dest);break;
   case'laser':this.tone(1200,.08,.25,'sawtooth',dest,300);break;
   case'launch':this.noise(.3,2000,200,.8,'lowpass',dest);this.tone(120,.3,.6,'triangle',dest,50);break;
   case'fun':this.tone(300,.18,.5,'triangle',dest,700);this.tone(500,.15,.3,'square',dest,200,.05);break;
   case'melee':this.noise(.12,2500,500,.5,'bandpass',dest);break;
   case'reload':this.tone(900,.04,.3,'square',dest);this.tone(500,.05,.3,'square',dest,null,.35);this.noise(.05,4000,2000,.2,'highpass',dest,.7);break;
   case'empty':this.tone(300,.05,.3,'square',dest);break;
   case'hit':this.tone(1100,.05,.4,'square',dest,700);break;
   case'head':this.tone(1800,.08,.5,'square',dest,1200);this.tone(900,.1,.3,'triangle',dest);break;
   case'hurt':this.tone(180,.15,.6,'sawtooth',dest,80);this.noise(.1,800,200,.4,'lowpass',dest);break;
   case'kill':this.tone(660,.12,.5,'triangle',dest);this.tone(990,.2,.5,'triangle',dest,null,.1);break;
   case'expl':this.noise(1.1,2500,60,1.4,'lowpass',dest);this.tone(70,.9,1,'sine',dest,25);break;
   case'pick':this.tone(600,.07,.4,'triangle',dest,900);this.tone(900,.1,.4,'triangle',dest,1200,.06);break;
   case'chest':this.tone(300,.15,.4,'triangle',dest,600);this.tone(600,.2,.5,'triangle',dest,1200,.1);this.tone(1200,.3,.4,'sine',dest,null,.2);break;
   case'ab':this.tone(200,.35,.5,'sawtooth',dest,900);this.noise(.3,300,3000,.3,'bandpass',dest);break;
   case'slam':this.tone(120,.5,.9,'sine',dest,30);this.noise(.5,2500,100,.8,'lowpass',dest);break;
   case'eat':for(let i=0;i<4;i++)this.noise(.08,1500,400,.5,'bandpass',dest,i*.22);break;
   case'bite':this.noise(.15,3000,600,.7,'bandpass',dest);this.tone(150,.15,.6,'square',dest,70);break;
   case'jump':this.noise(.12,800,2000,.12,'bandpass',dest);break;
   case'slide':this.noise(.5,2500,500,.25,'bandpass',dest);break;
   case'step':this.noise(.06,600,200,.12,'lowpass',dest);break;
   case'click':this.tone(700,.04,.3,'square',dest);break;
   case'ui':this.tone(500,.06,.3,'triangle',dest,800);break;
   case'storm':this.tone(110,1.2,.5,'sawtooth',dest,90);this.tone(165,1.2,.4,'sawtooth',dest,140);break;
   case'drop':this.tone(440,.3,.5,'triangle',dest);this.tone(660,.3,.5,'triangle',dest,null,.25);this.tone(880,.4,.5,'triangle',dest,null,.5);break;
   case'win':[523,659,784,1047,1319].forEach((f,i)=>this.tone(f,.5,.5,'triangle',dest,null,i*.14));break;
   case'lose':[400,340,280].forEach((f,i)=>this.tone(f,.4,.5,'sawtooth',dest,f*.8,i*.2));break;
   case'bounce':this.tone(300,.1,.4,'sine',dest,500);break;
   case'slip':this.tone(900,.35,.5,'triangle',dest,200);break;
   case'grapple':this.tone(300,.2,.5,'sawtooth',dest,1200);break;
   case'pad':this.tone(200,.3,.6,'square',dest,1200);break;
  }
 }
 startMusic(){if(this.musicOn||!this.ctx)return;this.musicOn=true;const scale=[0,3,5,7,10,12,15,12,10,7,5,3];const bass=[0,0,5,7];
  setInterval(()=>{if(!this.ctx||this.ctx.state!=='running')return;const s=this.step++;const base=this.mode==='game'?110:130.8;
   const note=base*Math.pow(2,scale[(s*(this.mode==='game'?5:1))%scale.length]/12);this.tone(note*2,.28,.22,'triangle',this.musG);
   if(s%4===0)this.tone(base/2*Math.pow(2,bass[(s>>2)%4]/12),.9,.35,'sine',this.musG);if(this.mode==='game'&&s%2===0)this.noise(.05,6000,3000,.05,'highpass',this.musG)},230)}
}
