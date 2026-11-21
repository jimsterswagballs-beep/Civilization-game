// Ability icons + character-select artwork, drawn as inline SVG so the game stays a single self-contained file.
const uri=svg=>'data:image/svg+xml;utf8,'+encodeURIComponent(svg);
const ICON_BG=(a,b)=>`<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect x="2" y="2" width="60" height="60" rx="12" fill="url(#g)"/><rect x="2" y="2" width="60" height="60" rx="12" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2"/>`;
const icon=(a,b,body)=>uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${ICON_BG(a,b)}${body}</svg>`);
const flake=(cx,cy,r,col,w)=>[0,60,120].map(a=>`<line x1="${cx}" y1="${cy-r}" x2="${cx}" y2="${cy+r}" transform="rotate(${a} ${cx} ${cy})" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`).join('');

export const ICON={
 // ---- Chill Guy (ice / stealth)
 disappear:icon('#0d1e3d','#1b5a86',
  `<path d="M20 50V28c0-8 5-14 12-14s12 6 12 14v22" fill="none" stroke="#e8fbff" stroke-width="3" stroke-dasharray="5 4" stroke-linecap="round"/>
   <circle cx="27" cy="29" r="2.6" fill="#e8fbff" opacity=".7"/><circle cx="37" cy="29" r="2.6" fill="#e8fbff" opacity=".7"/>
   <circle cx="16" cy="48" r="6" fill="#9be0ff" opacity=".55"/><circle cx="26" cy="53" r="5" fill="#9be0ff" opacity=".4"/><circle cx="46" cy="51" r="7" fill="#9be0ff" opacity=".5"/><circle cx="39" cy="55" r="4" fill="#9be0ff" opacity=".35"/>`),
 cold:icon('#0b2c55','#2aa4d6',
  `${flake(32,32,17,'#f2fdff',4)}<circle cx="32" cy="32" r="4" fill="#fff"/>
   <path d="M47 14l5 6-5 6" fill="none" stroke="#ffe27a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 52l-3-5 5-3" fill="none" stroke="#ffe27a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".0"/>`),
 strike:icon('#1a1030','#5b1f6e',
  `<path d="M10 52L40 22" stroke="#e8f4ff" stroke-width="5" stroke-linecap="round"/><path d="M38 14l12 12-6 3-9-9z" fill="#cfe9ff" stroke="#fff" stroke-width="1.5"/>
   <path d="M14 48l-5 5" stroke="#6b3a1d" stroke-width="5" stroke-linecap="round"/>
   <path d="M8 34h14M4 42h12M12 26h10" stroke="#9be0ff" stroke-width="3" stroke-linecap="round" opacity=".75"/><path d="M44 40l10 10M54 40L44 50" stroke="#ff5a7a" stroke-width="3.5" stroke-linecap="round"/>`),
 quiet:icon('#0d1e3d','#1b5a86',
  `<ellipse cx="24" cy="40" rx="7" ry="11" fill="#e8fbff" opacity=".9"/><ellipse cx="40" cy="26" rx="7" ry="11" fill="#e8fbff" opacity=".45"/><path d="M14 18l6 6M20 18l-6 6" stroke="#ff7a7a" stroke-width="2.5" stroke-linecap="round" opacity="0"/>`),
 // ---- Jay (kitchen / chaos)
 pan:icon('#4a1a10','#c4552b',
  `<path d="M10 46C6 20 36 6 52 20" fill="none" stroke="#ffe0a0" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="1 5"/><path d="M46 13l9 8-12 3z" fill="#ffe0a0"/>
   <circle cx="28" cy="38" r="12.5" fill="#2a2a2e" stroke="#9aa0a6" stroke-width="3"/><circle cx="28" cy="38" r="7.5" fill="#3a3a40"/><path d="M21 34a8 8 0 0 1 6-4" fill="none" stroke="#c7ccd3" stroke-width="2" stroke-linecap="round" opacity=".7"/>
   <path d="M37 47l12 10" stroke="#8a5a2a" stroke-width="6" stroke-linecap="round"/>`),
 food:icon('#5a1c12','#d9552b',
  `<path d="M7 52Q20 6 45 21" fill="none" stroke="#ffe0a0" stroke-width="2.4" stroke-dasharray="2 4" stroke-linecap="round"/>
   <path d="M17 35a15 13 0 0 1 30 0z" fill="#e0983a"/><circle cx="25" cy="27" r="1.5" fill="#fff3c0"/><circle cx="32" cy="24" r="1.5" fill="#fff3c0"/><circle cx="39" cy="28" r="1.5" fill="#fff3c0"/>
   <path d="M15 36q4-3 8 0t8 0 8 0 8 0v3H15z" fill="#4cd964"/><rect x="15" y="39" width="34" height="6" rx="3" fill="#5a2d12"/>
   <path d="M16 46h32a2 4 0 0 1-2 6H18a2 4 0 0 1-2-6z" fill="#e0983a"/>
   <path d="M52 8l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#ffd23d"/>`),
 kitchen:icon('#143c2a','#2fae6a',
  `<ellipse cx="32" cy="48" rx="23" ry="5" fill="#d9e2e8"/><path d="M11 46a21 21 0 0 1 42 0z" fill="#f2f5f7" stroke="#aab4bc" stroke-width="2"/><circle cx="32" cy="24" r="3.4" fill="#aab4bc"/>
   <path d="M22 26c-3-4 3-6 0-10M30 26c-3-4 3-6 0-10" fill="none" stroke="#e8fff0" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>
   <rect x="46" y="8" width="6" height="16" rx="2" fill="#6cff8a"/><rect x="41" y="13" width="16" height="6" rx="2" fill="#6cff8a"/>`),
 chef:icon('#4a1a10','#c4552b',
  `<rect x="20" y="38" width="24" height="12" rx="2" fill="#fff"/><circle cx="22" cy="30" r="9" fill="#fff"/><circle cx="32" cy="25" r="11" fill="#fff"/><circle cx="42" cy="30" r="9" fill="#fff"/><rect x="20" y="44" width="24" height="3" fill="#dde"/>`)
};

// ----- selection artwork (portrait scenes that sit behind the character sprite) -----
const dots=(n,seed,w,h,col,rmin,rmax)=>{let s=seed,o='';const r=()=>{s=(s*16807)%2147483647;return s/2147483647};for(let i=0;i<n;i++)o+=`<circle cx="${(r()*w).toFixed(0)}" cy="${(r()*h).toFixed(0)}" r="${(rmin+r()*(rmax-rmin)).toFixed(1)}" fill="${col}" opacity="${(.25+r()*.6).toFixed(2)}"/>`;return o};
const ART={
 chillguy:()=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050a1c"/><stop offset=".55" stop-color="#0b3556"/><stop offset="1" stop-color="#58c6e8"/></linearGradient>
  <radialGradient id="moon" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#d6f6ff"/><stop offset="1" stop-color="#9be0ff" stop-opacity="0"/></radialGradient>
  <filter id="bl"><feGaussianBlur stdDeviation="14"/></filter></defs>
  <rect width="600" height="800" fill="url(#sky)"/>
  <circle cx="440" cy="150" r="150" fill="url(#moon)" opacity=".55"/><circle cx="440" cy="150" r="64" fill="#f4feff"/><circle cx="420" cy="132" r="12" fill="#d3eef8"/><circle cx="462" cy="170" r="8" fill="#d3eef8"/>
  ${dots(70,7,600,520,'#ffffff',1.2,3.2)}
  <g filter="url(#bl)" fill="#9be0ff" opacity=".5"><ellipse cx="120" cy="620" rx="180" ry="50"/><ellipse cx="500" cy="660" rx="170" ry="60"/><ellipse cx="300" cy="700" rx="260" ry="46"/></g>
  <g fill="#e6fbff" opacity=".18"><path d="M-20 300L420 -20 470 -20 0 340z"/><path d="M120 520L640 120 650 190 200 560z"/></g>
  <g fill="#bfefff" stroke="#fff" stroke-width="3" stroke-linejoin="round"><path d="M0 800V650l50-90 40 120 50-150 60 170 40-70 50 130 60-100 40 140V800z" opacity=".9"/><path d="M600 800V630l-50-80-40 110-50-130-50 150-40-60-40 120V800z" opacity=".9"/></g>
  <g fill="#7fd0ee" opacity=".85"><path d="M0 800V730l70-60 60 80 70-90 70 100 60-60 60 70 70-80 70 90 70-60V800z"/></g>
  <ellipse cx="300" cy="742" rx="190" ry="26" fill="#eafcff" opacity=".6"/>
  ${dots(60,11,600,800,'#ffffff',1.5,4)}
  </svg>`,
 jay:()=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb04a"/><stop offset="1" stop-color="#e2542b"/></linearGradient>
  <radialGradient id="glow" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#fff3c0" stop-opacity=".9"/><stop offset="1" stop-color="#fff3c0" stop-opacity="0"/></radialGradient>
  <pattern id="tile" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" fill="#fff4e0"/><rect width="60" height="60" fill="none" stroke="#e6c9a0" stroke-width="3"/></pattern></defs>
  <rect width="600" height="800" fill="url(#wall)"/>
  <rect y="120" width="600" height="360" fill="url(#tile)" opacity=".28"/>
  <g stroke="#fff3c0" stroke-width="5" opacity=".18">${Array.from({length:11},(_,i)=>`<line x1="300" y1="470" x2="${-300+i*120}" y2="0"/>`).join('')}</g>
  <circle cx="300" cy="470" r="330" fill="url(#glow)"/>
  <g fill="#3a1d12"><rect x="40" y="40" width="520" height="10" rx="5"/>
   <circle cx="110" cy="115" r="34"/><rect x="104" y="48" width="12" height="36"/><circle cx="110" cy="115" r="22" fill="#5a3a28"/>
   <circle cx="500" cy="105" r="28"/><rect x="494" y="48" width="12" height="32"/><circle cx="500" cy="105" r="17" fill="#5a3a28"/>
   <rect x="268" y="48" width="8" height="64" rx="4"/><path d="M252 112h40l-8 28h-24z"/><rect x="330" y="48" width="8" height="58" rx="4"/><circle cx="334" cy="122" r="16"/></g>
  <path d="M0 800V560l170 20 130-8 130 8 170-20V800z" fill="#2c1a14"/>
  <g>${Array.from({length:4},(_,r)=>Array.from({length:9},(_,c)=>{const w=70-(3-r)*8,x=-60+c*w+(r%2?w/2:0)-(r*10),y=600+r*50;return (r+c)%2?`<path d="M${x} ${y}h${w}l${w*.12} 50h-${w*1.12}z" fill="#f6e7c8"/>`:`<path d="M${x} ${y}h${w}l${w*.12} 50h-${w*1.12}z" fill="#c63a28"/>`}).join('')).join('')}</g>
  <g opacity=".85" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"><path d="M120 560c-30-40 30-60 0-110"/><path d="M470 540c-30-40 30-60 0-110" opacity=".7"/><path d="M300 520c-30-40 30-60 0-120" opacity=".5"/></g>
  <g><ellipse cx="86" cy="330" rx="30" ry="13" fill="#e0983a"/><rect x="58" y="340" width="56" height="10" rx="4" fill="#5a2d12"/><path d="M58 352h56l-4 12H62z" fill="#e0983a"/>
   <path d="M508 300l40 60a40 40 0 0 1-66 0z" fill="#ffd23d" stroke="#d9892b" stroke-width="4"/><circle cx="520" cy="338" r="6" fill="#e2432b"/><circle cx="508" cy="352" r="5" fill="#e2432b"/>
   <path d="M64 480c20-24 40-24 56-6l-8 10c-14-8-28-6-40 8z" fill="#ff3a1a"/><path d="M62 478c-6-8 2-14 8-10" stroke="#2fae6a" stroke-width="6" fill="none" stroke-linecap="round"/>
   <path d="M522 470c-10 6-16 20-6 34 10 14 30 6 36-6" fill="none" stroke="#ffe14a" stroke-width="16" stroke-linecap="round"/></g>
  ${dots(40,5,600,540,'#fff3c0',1.5,3.5)}
  </svg>`,
 coolguy15:()=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="a" cx=".5" cy=".55" r=".7"><stop offset="0" stop-color="#bfe9ff"/><stop offset=".5" stop-color="#2a79d8"/><stop offset="1" stop-color="#0a1442"/></radialGradient></defs><rect width="600" height="800" fill="url(#a)"/><g fill="none" stroke="#fff" stroke-width="6" opacity=".35"><circle cx="300" cy="440" r="140"/><circle cx="300" cy="440" r="230"/><circle cx="300" cy="440" r="330"/></g>${dots(40,3,600,800,'#ffffff',1.5,4)}</svg>`,
 zach:()=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="a" cx=".5" cy=".55" r=".75"><stop offset="0" stop-color="#fff0a0"/><stop offset=".55" stop-color="#ff9a3c"/><stop offset="1" stop-color="#5a1a2a"/></radialGradient></defs><rect width="600" height="800" fill="url(#a)"/><g stroke="#fff" stroke-width="10" opacity=".14">${Array.from({length:14},(_,i)=>`<line x1="300" y1="440" x2="${-400+i*110}" y2="-60"/>`).join('')}</g>${dots(30,9,600,800,'#fff7c0',2,5)}</svg>`
};
const cache={};
export const charArt=id=>cache[id]||(cache[id]=ART[id]?uri(ART[id]()):'');
export const abilityIcon=a=>a&&a.ic?ICON[a.ic]:'';
