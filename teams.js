// Team modes: who is on which team, and how empty teammate slots are filled.
// Pure data + functions (no three.js), so it can be tested on its own.
export const MODES={
  solo:{name:'Solo',size:1,sub:'1 player per team'},
  duo:{name:'Duos',size:2,sub:'2 players per team'},
  trio:{name:'Trios',size:3,sub:'3 players per team'},
  squad:{name:'Squads',size:4,sub:'4 players per team'}};
export const MODE_KEYS=['solo','duo','trio','squad'];
export const modeSize=m=>(MODES[m]||MODES.solo).size;

// humans: party members in join order (host first): {pid,name,char,cos,hostMe}
// roster: one entry per bot to add: {name,char,persona,cos}
// fill: put bots into empty teammate slots before forming bot-only teams
// Returns entities {id,name,char,cos,team,pid?,peer?,hostMe?,bot?,persona?} with ids 0..n-1.
// Each team is a group of entities that share a team number; team numbers are unique per match.
export function buildEntrants({mode,humans,roster,fill}){
  const size=modeSize(mode);
  const bots=roster.slice();
  const teams=[];
  // 1. humans: solo gives each human a team of their own, team modes group the party in order
  for(let i=0;i<humans.length;i+=size)teams.push(humans.slice(i,i+size).map(h=>({kind:'h',h})));
  // 2. optionally pad partly filled human teams with bots
  if(fill&&size>1)for(const t of teams)while(t.length<size&&bots.length)t.push({kind:'b',b:bots.shift()});
  // 3. remaining bots form their own teams (one bot per team in solo)
  while(bots.length){const t=[];while(t.length<size&&bots.length)t.push({kind:'b',b:bots.shift()});teams.push(t)}
  // 4. flatten into entities
  const ents=[];
  teams.forEach((members,team)=>{
    for(const m of members){
      const id=ents.length;
      if(m.kind==='h'){const h=m.h;ents.push({id,name:h.name,char:h.char,cos:h.cos||{},team,pid:h.pid,peer:h.pid==='host'?undefined:h.pid,hostMe:!!h.hostMe})}
      else{const b=m.b;ents.push({id,name:b.name,char:b.char,cos:b.cos||{},team,bot:true,persona:b.persona})}
    }
  });
  return ents;
}

// Summary used by the lobby: how many teams a match will have and how many are human-led.
export function teamSummary(ents){
  const teams=new Set(ents.map(e=>e.team));
  return{teams:teams.size,players:ents.length,bots:ents.filter(e=>e.bot).length};
}
