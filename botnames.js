import {CHARS} from './data.js';
// Bot roster generation: hundreds of curated names + thousands of generated combinations,
// themed by personality so "Sir Hidesalot" is more likely to be a camper than a rusher.
export const PERSONA_WEIGHTS={balanced:20,rusher:16,camper:13,sniper:10,looter:14,survivor:12,opportunist:12,trickster:6};

const CURATED=['Noodle','Sir Quacks','Turbo Toast','Pixel Pete','Captain Crunch','Waffle','Sneaky Sam','Big Chungus','Lil Bandit','Dr. Pickle','Banana Joe','Zoomer','Gizmo','Cheese Wiz','Ninja Nan','Boop','Chad','Meatball','Fuzzy','Rocket Raccoon','Grumpy','Sassy','Taco Tim','Doodle','Blip','Moonpie','Toaster','Yeet','Mr. Bean','Gremlin','Skibidi','Potato','Wobbly','Kevin','Bongo','Pancake',
 'Spud Muffin','Captain Cringe','Professor Pew','Granny Smith','Lag Spike','Sir Loots-a-Lot','Dave','Gary','Brenda','Pixelina','Doug the Rug','Crispy Bacon','Ketchup Kid','Noodle Ninja','Tilted Tim','Soggy Biscuit','Mango Man','Wasabi','Mochi','Beans','Biscuit','Dumpling','Gumbo','Pickles','Nugget','Pretzel','Cupcake','Sprinkles','Meep','Zorp','Blorp','Klaus','Hank','Phil','Marge','Steve','Karen','Derek','Larry','Janet','Tiny Tony','Slippery Pete','Sir Dodgealot','Lady Luck','Captain Whoops','Oops','Nope','Bruh','Bonk','Sploosh','Squish','Zonk','Wiggles','Bubbles','Mittens','Waddles','Hoppy','Sparky','Ziggy','Fidget','Munchkin','Chonk','Orbit','Cosmo','Nova','Pixel','Glitch','Static','Ping','Latency','Buffer','Reboot','Kernel','Macro','Byte','Cache','Packet','Router'];

const ADJ=['Soggy','Turbo','Sneaky','Mighty','Tiny','Giant','Crispy','Spicy','Salty','Sweaty','Lucky','Cursed','Sleepy','Angry','Happy','Grumpy','Wobbly','Fuzzy','Chonky','Slippery','Cosmic','Funky','Rusty','Shiny','Silent','Rapid','Radical','Lazy','Hyper','Cranky','Dizzy','Jolly','Tactical','Tilted','Epic','Legendary','Rogue','Savage','Brave','Clumsy','Sassy','Salty','Stealthy','Frosty','Toasty','Smooth','Spooky','Wild','Wacky','Zesty','Bouncy','Mellow','Rowdy','Sly','Plucky','Gloomy','Nimble','Fierce','Chill','Mega','Ultra','Super','Hungry','Thirsty','Burnt','Raw','Golden','Neon','Pixelated','Haunted','Atomic'];
const NOUN=['Waffle','Goblin','Noodle','Pickle','Muffin','Bandit','Wizard','Ninja','Pirate','Viking','Raccoon','Duck','Llama','Penguin','Walrus','Badger','Otter','Gecko','Moose','Yeti','Dragon','Taco','Burrito','Pretzel','Biscuit','Potato','Turnip','Radish','Banana','Mango','Pickaxe','Toaster','Kettle','Spatula','Sock','Banjo','Trombone','Cactus','Mushroom','Pumpkin','Tornado','Comet','Rocket','Robot','Zombie','Ghost','Knight','Samurai','Cowboy','Sheriff','Captain','Wanderer','Hunter','Rascal','Gremlin','Hamster','Pigeon','Crab','Lobster','Shark','Narwhal','Platypus','Sloth','Koala','Meerkat','Ferret','Falcon','Raven','Bison','Marshmallow','Cupcake','Dumpling','Sandwich','Nugget'];
const TITLE=['Sir','Lord','Lady','Captain','Doctor','Professor','Chef','Baron','Duke','Big','Lil','Mr.','Ms.','Agent','Coach','Uncle','Granny','Major','King','Queen'];
const SUFFIX=['OP','YT','TV','Pro','HD','XL','Jr','Prime','Plus','Max','Gaming','IRL','Fan','Dev'];
const TAGWRAP=[['xX_','_Xx'],['~','~'],['<','>'],['[',']'],['_','_'],['',''],['The',''],['i',''],['Not','']];

const THEMED={
 rusher:{adj:['Reckless','Rapid','Furious','Berserk','Turbo','Raging','Frantic','Rowdy','Savage','Chaotic'],noun:['Rush','Charger','Breacher','Hotdrop','Rampage','Bulldozer','Wrecker','Stampede','Brawler','Smash'],misc:['Hot Drop Harry','Rush B Randy','Send It Steve','YOLO Yolanda','Full Send Fred','No Brakes Brenda']},
 camper:{adj:['Patient','Hidden','Quiet','Cozy','Bushy','Lurking','Sneaky','Silent','Hunkered','Shady'],noun:['Bush','Lurker','Hideout','Burrow','Shadow','Corner','Ambush','Watcher','Stakeout','Hermit'],misc:['Sir Hidesalot','Bush Wookie','Corner Carl','Stay Put Pete','Under the Bed','Tent Tony','Ctrl Alt Camp']},
 sniper:{adj:['Distant','Steady','Eagle-Eyed','Longshot','Precise','Far','Calm','Keen'],noun:['Scope','Sniper','Marksman','Crosshair','Longshot','Hawkeye','Overwatch','Headshot','Bullseye'],misc:['One Shot Olly','Scope Dope','Zoom Zoom','Hawk Eye Hal','Nine Iron','Long Range Larry']},
 looter:{adj:['Greedy','Shiny','Rich','Loaded','Hoarding','Gold','Rare','Epic'],noun:['Looter','Hoarder','Chest Goblin','Magpie','Treasure','Scavenger','Collector','Bagman','Pirate'],misc:['Chest Chad','Loot Goblin','Epic Eddie','Need More Ammo','Mine Mine Mine','Legendary Larry','Lootzilla']},
 survivor:{adj:['Careful','Cautious','Nervous','Timid','Wary','Prudent','Cowardly','Lucky'],noun:['Survivor','Runner','Dodger','Escapist','Worrier','Sidestep','Backpedal','Cockroach','Hider'],misc:['Run Away Ray','Nope Nancy','Live To Fight','Last Place Larry','Scaredy Cat','Cowardly Lion','Safety First']},
 opportunist:{adj:['Crafty','Cunning','Sneaky','Vulture','Opportune','Clever','Patient','Third'],noun:['Vulture','Scavenger','Thief','Jackal','Hyena','Fox','Third Party','Snatcher','Opportunist'],misc:['Third Party Tim','Kill Stealer Kim','Easy Pickings','Cleanup Crew','Leftovers Larry','Steal Yo Kill']},
 trickster:{adj:['Wacky','Silly','Zany','Goofy','Bonkers','Loopy','Chaotic'],noun:['Jester','Prankster','Clown','Banana','Trickster','Meme','Bouncer','Joker','Gremlin'],misc:['Slip n Slide','Banana Bandit','Boogie Bob','Dance Party','Peel Out','Prank Patrol','Silly Sally']}
};

function pickW(rng,obj){let t=0;for(const k in obj)t+=obj[k];let r=rng()*t;for(const k in obj){r-=obj[k];if(r<=0)return k}return Object.keys(obj)[0]}
const pick=(rng,a)=>a[Math.floor(rng()*a.length)];
function gen(rng,persona){
 const th=THEMED[persona];const r=rng();
 if(th&&r<.42){const q=rng();if(q<.3)return pick(rng,th.misc);if(q<.65)return pick(rng,th.adj)+' '+pick(rng,NOUN);return pick(rng,ADJ)+' '+pick(rng,th.noun)}
 if(r<.5)return pick(rng,CURATED);
 if(r<.72)return pick(rng,ADJ)+' '+pick(rng,NOUN);
 if(r<.80)return pick(rng,TITLE)+' '+pick(rng,NOUN);
 if(r<.86)return pick(rng,ADJ)+pick(rng,NOUN)+(rng()<.5?Math.floor(rng()*99):'');
 if(r<.92){const w=pick(rng,TAGWRAP);return w[0]+pick(rng,NOUN)+w[1]}
 if(r<.96)return pick(rng,NOUN)+pick(rng,SUFFIX);
 return pick(rng,NOUN)+(rng()<.5?'_':'')+(2005+Math.floor(rng()*21));
}
const NAME_COLS=['#ffffff','#ffd84a','#6ec6ff','#ff7ab8','#7aff9a','#ff9a3c','#c08aff','#ff5a5a','#ffd0d0'];
const TRAILS=['#ffd84a','#6ec6ff','#ff7ab8','#7aff9a','#ff9a3c','#c08aff','#ff5a5a'];
/** Returns n unique bots: [{name, persona, char, cos}] */
export function makeBotRoster(n,rng=Math.random){
 const used=new Set(),out=[];
 for(let i=0;i<n;i++){
  const persona=pickW(rng,PERSONA_WEIGHTS);let name='',tries=0;
  do{name=gen(rng,persona).trim();tries++}while((used.has(name.toLowerCase())||name.length>16||name.length<2)&&tries<60);
  if(used.has(name.toLowerCase()))name=name.slice(0,12)+' '+(i+2);
  used.add(name.toLowerCase());
  out.push({name,persona,char:CHARS[Math.floor(rng()*CHARS.length)].id,cos:{nameColor:rng()<.35?'#ffd0d0':pick(rng,NAME_COLS),trail:rng()<.3?pick(rng,TRAILS):'',emote:Math.floor(rng()*3)}});
 }
 return out}
export const NAME_POOL_SIZE=CURATED.length+ADJ.length*NOUN.length;
