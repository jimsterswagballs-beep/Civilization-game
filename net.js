import Peer from 'peerjs';
const ALPHA='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const genCode=()=>Array.from({length:5},()=>ALPHA[Math.floor(Math.random()*ALPHA.length)]).join('');
const ICE={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'},{urls:'stun:global.stun.twilio.com:3478'}]};
export class LocalNet{constructor(){this.isHost=true;this.peers=new Map()}send(){}toHost(){}broadcast(){}}
export class Net{
 constructor(){this.peer=null;this.conns=new Map();this.hostConn=null;this.isHost=false;this.code='';this.myPeer='';
  this.onMsg=()=>{};this.onJoin=()=>{};this.onLeave=()=>{};this.onClosed=()=>{};this.onError=()=>{}}
 get peers(){return this.conns}
 host(cb,tries=0){
  this.isHost=true;this.code=genCode();
  const p=this.peer=new Peer('brg-'+this.code,{config:ICE,debug:0});
  p.on('open',id=>{this.myPeer=id;cb(null,this.code)});
  p.on('connection',c=>{
   c.on('open',()=>{this.conns.set(c.peer,c);this.onJoin(c.peer)});
   c.on('data',d=>this.onMsg(c.peer,d));
   c.on('close',()=>{this.conns.delete(c.peer);this.onLeave(c.peer)});
   c.on('error',()=>{})});
  p.on('error',err=>{if(err.type==='unavailable-id'&&tries<5){try{p.destroy()}catch(e){}this.host(cb,tries+1)}else cb(err.type||'error')});
  p.on('disconnected',()=>{try{p.reconnect()}catch(e){}})}
 join(code,cb){
  this.isHost=false;this.code=code.toUpperCase().trim();
  const p=this.peer=new Peer({config:ICE,debug:0});let done=false;
  const to=setTimeout(()=>{if(!done){done=true;cb('timeout');this.close()}},15000);
  p.on('open',id=>{this.myPeer=id;const c=p.connect('brg-'+this.code,{reliable:true,serialization:'json'});this.hostConn=c;
   c.on('open',()=>{if(done)return;done=true;clearTimeout(to);cb(null)});
   c.on('data',d=>this.onMsg('host',d));
   c.on('close',()=>{this.onClosed()});c.on('error',()=>{})});
  p.on('error',err=>{if(!done){done=true;clearTimeout(to);cb(err.type||'error')}else this.onError(err)})}
 send(pid,msg){const c=this.conns.get(pid);if(c&&c.open)try{c.send(msg)}catch(e){}}
 broadcast(msg){for(const c of this.conns.values())if(c.open)try{c.send(msg)}catch(e){}}
 toHost(msg){if(this.hostConn&&this.hostConn.open)try{this.hostConn.send(msg)}catch(e){}}
 close(){try{this.peer&&this.peer.destroy()}catch(e){}this.peer=null;this.conns.clear();this.hostConn=null}
}
