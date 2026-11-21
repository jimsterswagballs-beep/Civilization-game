// Item Shop (characters, emotes, skins), Swag Token balance, and the locker's emote picker.
import {CHARS,RARITY,keyLabel} from './data.js';
import {IMG} from './shared.js';
import {charArt} from './icons.js';
import {EMOTE_LIST,EMOTE_BY,CHAR_PRICES,TOKENS} from './emote.js';

const $=id=>document.getElementById(id);
const h=html=>{const t=document.createElement('template');t.innerHTML=html.trim();return t.content.firstElementChild};
const VICTORY_POSES=[['Flip-Flop','&#128378;'],['Victory Hop','&#127942;'],['Spin Cycle','&#127744;']];

export const shopMethods={
 owns(kind,id){const P=this.profile;
  if(kind==='char')return !CHAR_PRICES[id]||P.ownedChars.includes(id);
  return P.ownedEmotes.includes(id)},
 addTokens(n,why){
  const P=this.profile;P.tokens=(P.tokens||0)+n;this.saveProfile();this.updateNav(this.screen);
  setTimeout(()=>this.toast('+'+n+' Swag Tokens'+(why?' · '+why:'')),1400)},
 buy(kind,id){
  const price=kind==='char'?CHAR_PRICES[id]:(EMOTE_BY[id]||{}).price;const P=this.profile;
  if(!price||this.owns(kind,id))return;
  if((P.tokens||0)<price){this.toast('Not enough Swag Tokens ('+(price-(P.tokens||0))+' short)');this.sfx('empty');return}
  P.tokens-=price;(kind==='char'?P.ownedChars:P.ownedEmotes).push(id);
  this.saveProfile();this.sfx('ui');this.toast('Unlocked!');this.enter_shop();this.updateNav(this.screen)},
 buildShop(){
  const p=$('shop');
  p.innerHTML=`<div class="pg"><div class="pg-head"><h2>Item Shop</h2><div id="shBack"></div></div>
  <div class="sh-top"><div class="sh-bal"><span class="sh-coin">&#9670;</span><div><small>Swag Tokens</small><b id="shBal">0</b></div></div>
   <p class="sh-how">Earn tokens from eliminations, surviving longer, placing in the top 10 and winning.</p></div>
  <div class="sh-sec"><div class="k">Characters</div><div class="sh-grid" id="shChars"></div></div>
  <div class="sh-sec"><div class="k">Emotes</div><div class="sh-grid" id="shEmotes"></div></div>
  <div class="sh-sec"><div class="k">Skins</div><div class="sh-empty">None at the moment</div></div>
  <div class="tip">Emotes are played with ${keyLabel(this.input.binds.emote)} (change it in Settings). Equip one in the Locker.</div></div>`;
  $('shBack').appendChild(this.back());
  p.addEventListener('click',e=>{const b=e.target.closest('[data-buy]');if(!b)return;const[k,id]=b.dataset.buy.split(':');this.buy(k,id)});
 },
 enter_shop(){
  $('shBal').textContent=this.profile.tokens||0;
  $('shChars').innerHTML=Object.keys(CHAR_PRICES).map(id=>{
   const c=CHARS.find(x=>x.id===id),owned=this.owns('char',id);
   return `<div class="sh-card${owned?' owned':''}"><div class="sh-pic" style="background-image:url('${charArt(id)}')"><img src="${IMG[id].front}" alt=""></div>
    <div class="sh-info"><b>${c.name}</b><small>${c.role}</small></div>
    ${owned?'<div class="sh-own">Owned</div>':`<button class="btn play sm" data-buy="char:${id}">&#9670; ${CHAR_PRICES[id]}</button>`}</div>`}).join('');
  $('shEmotes').innerHTML=EMOTE_LIST.map(d=>{
   const owned=this.owns('emote',d.id);
   const pic=d.img?`<img src="${d.img}" alt="">`:`<span class="sh-ico">${d.icon}</span>`;
   return `<div class="sh-card${owned?' owned':''}"><div class="sh-pic emo-pic">${pic}</div>
    <div class="sh-info"><b>${d.name}</b><small>${d.desc}</small></div>
    ${owned?'<div class="sh-own">Owned</div>':`<button class="btn play sm" data-buy="emote:${d.id}">&#9670; ${d.price}</button>`}</div>`}).join('');
 },
 // locker > Emote: the equipped emote (played with the emote key) plus the free victory-screen poses
 emotePicker(){
  const P=this.profile,wrap=document.createElement('div');
  wrap.appendChild(h(`<div class="k lk-sub">Emote · press ${keyLabel(this.input.binds.emote)} to play, press again to cancel</div>`));
  const box=h(`<div class="tiles"></div>`);
  const rc=i=>RARITY[Math.min(5,i+1)].c;
  EMOTE_LIST.forEach((d,i)=>{
   const owned=this.owns('emote',d.id);
   const pic=d.img?`<img src="${d.img}" alt="" style="height:88%;image-rendering:auto">`:`<span class="emo">${d.icon}</span>`;
   box.appendChild(this.mkTile({rc:rc(i),pic,label:d.name+(owned?'':' &#128274;'),sel:P.equipEmote===d.id,fn:()=>{
    if(!owned){this.toast('Unlock it in the Shop first');this.sfx('empty');return}
    P.equipEmote=d.id;this.saveProfile();this.enter_locker()}}));
  });
  wrap.appendChild(box);
  wrap.appendChild(h(`<div class="k lk-sub" style="margin-top:22px">Victory pose · shown on the win screen</div>`));
  const pose=h(`<div class="tiles small"></div>`);
  VICTORY_POSES.forEach(([name,ic],i)=>pose.appendChild(this.mkTile({rc:rc(i+2),pic:`<span class="emo">${ic}</span>`,label:name,sel:P.emote===i,fn:()=>{P.emote=i;this.saveProfile();this.enter_locker()}})));
  wrap.appendChild(pose);
  return wrap;
 }
};
