// Bot navigation: a lazily-built 1m walkability grid over the island + A* with budgeted search.
// Cells are only evaluated when a search touches them, so start-up cost is zero.
import * as W from './world.js';
import {HSTAND} from './shared.js';

const OFF=350,N=700;           // grid covers -350..350 on both axes
const RN=.42;                   // = real body radius. Doors are 1.9 wide so a 1m grid always keeps >=1 walkable cell in every doorway
const ST=new Int8Array(N*N);    // 0 unknown, 1 walkable, 2 blocked
const GY=new Float32Array(N*N); // ground height per cell
const GS=new Float32Array(N*N);
const PAR=new Int32Array(N*N);
const STAMP=new Uint32Array(N*N);
const CLOSED=new Uint32Array(N*N);
let stamp=0;
const bad=new Map();            // temporary "this cell trapped someone" marks: idx -> expiry time
let now=0;
export function navTime(t){now=t}

export function cellOf(x){return Math.floor(x)+OFF}
export function cellCentre(i){return i-OFF+.5}
function state(ix,iz){
 if(ix<0||iz<0||ix>=N||iz>=N)return 2;
 const i=iz*N+ix;let s=ST[i];
 if(s===0){
  const x=ix-OFF+.5,z=iz-OFF+.5,h=W.H(x,z);let ok=h>.2;
  if(ok){const gy=W.groundAt(x,z,h+.05,RN,.65);GY[i]=gy;ok=!W.blocked(x,gy+.03,z,RN,HSTAND,.65)}else GY[i]=h;
  ST[i]=s=ok?1:2}
 if(s===1){const b=bad.get(i);if(b!==undefined){if(b>now)return 2;bad.delete(i)}}
 return s}
export function walkable(x,z){return state(cellOf(x),cellOf(z))===1}
export function groundOfCell(x,z){const ix=cellOf(x),iz=cellOf(z);return state(ix,iz)===1?GY[iz*N+ix]:W.H(x,z)}
export function markBad(x,z,secs=12){const ix=cellOf(x),iz=cellOf(z);if(ix<0||iz<0||ix>=N||iz>=N)return;bad.set(iz*N+ix,now+secs)}
// nearest walkable cell to (x,z) within maxR cells; returns [x,z] or null
export function nearestWalkable(x,z,maxR=6){
 const cx=cellOf(x),cz=cellOf(z);if(state(cx,cz)===1)return[cellCentre(cx),cellCentre(cz)];
 for(let r=1;r<=maxR;r++){let best=null,bd=1e9;
  for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;
   if(state(cx+dx,cz+dz)===1){const px=cellCentre(cx+dx),pz=cellCentre(cz+dz),d=(px-x)**2+(pz-z)**2;if(d<bd){bd=d;best=[px,pz]}}}
  if(best)return best}
 return null}
// real body-radius test used for steering/smoothing (not cached)
export function clearSpot(x,z,r=.43){r=Math.max(r,.43);const h=W.H(x,z);if(h<.1)return false;const gy=W.groundAt(x,z,h+.05,r,.65);return !W.blocked(x,gy+.03,z,r,HSTAND,.65)}
export function lineClear(ax,az,bx,bz,r=.38){
 const dx=bx-ax,dz=bz-az,d=Math.hypot(dx,dz);if(d<.01)return true;const n=Math.ceil(d/.45);
 for(let i=1;i<=n;i++){const t=i/n;if(!clearSpot(ax+dx*t,az+dz*t,r))return false}return true}

// ---- binary heap (ids + f scores in parallel arrays)
const HI=[],HF=[];
function hpush(i,f){let k=HI.length;HI.push(i);HF.push(f);while(k>0){const p=(k-1)>>1;if(HF[p]<=f)break;HI[k]=HI[p];HF[k]=HF[p];k=p}HI[k]=i;HF[k]=f}
function hpop(){const top=HI[0],li=HI.pop(),lf=HF.pop();const n=HI.length;if(n>0){let k=0;for(;;){let c=k*2+1;if(c>=n)break;if(c+1<n&&HF[c+1]<HF[c])c++;if(HF[c]>=lf)break;HI[k]=HI[c];HF[k]=HF[c];k=c}HI[k]=li;HF[k]=lf}return top}
const DX=[1,-1,0,0,1,1,-1,-1],DZ=[0,0,1,-1,1,-1,1,-1];
let lastSearch={exp:0,partial:false,ok:false};
export function lastInfo(){return lastSearch}
/** A* from world (sx,sz) to (tx,tz). Returns array of [x,z] cell-centre waypoints (start excluded) or null. */
export function findPath(sx,sz,tx,tz,maxExp=7000){
 const s=nearestWalkable(sx,sz,4),g=nearestWalkable(tx,tz,8);
 lastSearch={exp:0,partial:false,ok:false};
 if(!s||!g)return null;
 const s0=cellOf(s[0])+cellOf(s[1])*N,g0=cellOf(g[0])+cellOf(g[1])*N;
 if(s0===g0){lastSearch.ok=true;return[[g[0],g[1]]]}
 const gx=cellOf(g[0]),gz=cellOf(g[1]);
 stamp++;HI.length=0;HF.length=0;
 GS[s0]=0;STAMP[s0]=stamp;PAR[s0]=-1;hpush(s0,0);
 let exp=0,bestI=s0,bestH=1e9;
 const hh=(ix,iz)=>{const dx=Math.abs(ix-gx),dz=Math.abs(iz-gz);return dx+dz+(1.414-2)*Math.min(dx,dz)};
 let found=false;
 while(HI.length){
  const cur=hpop();if(CLOSED[cur]===stamp)continue;CLOSED[cur]=stamp;
  if(cur===g0){found=true;bestI=cur;break}
  if(++exp>maxExp)break;
  const cx=cur%N,cz=(cur/N)|0;const ch=hh(cx,cz);if(ch<bestH){bestH=ch;bestI=cur}
  for(let k=0;k<8;k++){
   const nx=cx+DX[k],nz=cz+DZ[k];if(state(nx,nz)!==1)continue;
   if(k>=4&&(state(cx+DX[k],cz)!==1||state(cx,cz+DZ[k])!==1))continue; // no corner cutting
   const ni=nz*N+nx;if(CLOSED[ni]===stamp)continue;
   let step=k>=4?1.414:1;
   // keep a little distance from walls and prefer flatter ground
   if(state(nx+1,nz)!==1||state(nx-1,nz)!==1||state(nx,nz+1)!==1||state(nx,nz-1)!==1)step+=.45;
   step+=Math.abs(GY[ni]-GY[cur])*1.2;
   const ng=GS[cur]+step;
   if(STAMP[ni]!==stamp||ng<GS[ni]){STAMP[ni]=stamp;GS[ni]=ng;PAR[ni]=cur;hpush(ni,ng+hh(nx,nz)*1.05)}}}
 lastSearch={exp,partial:!found,ok:true};
 if(!found&&bestI===s0){lastSearch.ok=false;return null}
 const out=[];for(let i=bestI;i!==-1&&i!==s0;i=PAR[i])out.push([cellCentre(i%N),cellCentre((i/N)|0)]);
 out.reverse();
 return out}

// ---- structure support: when solids or trees change, forget cached walkability in that rectangle
export function invalidateRect(x0,z0,x1,z1){
 const ix0=Math.max(0,cellOf(x0)),ix1=Math.min(N-1,cellOf(x1)),iz0=Math.max(0,cellOf(z0)),iz1=Math.min(N-1,cellOf(z1));
 for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++)ST[iz*N+ix]=0}
export function resetAll(){ST.fill(0);bad.clear()}
