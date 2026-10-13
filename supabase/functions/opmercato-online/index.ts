import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(URL, SERVICE, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const REPO_CATALOG = "https://raw.githubusercontent.com/jb8br7jgpr-eng/test/main/opmercato-catalog.json?v=20261013-powerbalance-1";
const json = (v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{...CORS,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const fail = (message:string,status=400)=>json({error:message},status);
const rand = (n:number)=>crypto.getRandomValues(new Uint8Array(n));
const token = ()=>Array.from(rand(32),x=>x.toString(16).padStart(2,"0")).join("");
const hash = async(text:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,"0")).join("");
const code = ()=>Array.from(rand(8),x=>"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x%32]).join("");
const amount=(v:unknown)=>{if(!/^\d{1,64}$/.test(String(v)))throw Error("Montant de Berrys invalide.");return BigInt(String(v));};
const minBid=(s:any,a:any)=>BigInt(a.highBid)>0n?BigInt(a.highBid)+BigInt(s.bidStep):BigInt(s.baseBid);
const canBid=(s:any,p:any,v:bigint)=>p&&p.roster.length<s.teamSize&&BigInt(p.budget)>=v;
const hasHaki=(s:any,p:any)=>p&&!p.hakiUsed&&p.roster.length<s.teamSize;
const power=(s:any,id:string)=>s.catalog[id]?.power??0;
const rank=(n:number)=>n>=95?"S":n>=80?"A":n>=65?"B":n>=50?"C":n>=35?"D":n>=20?"E":"F";
const shuffle=(xs:any[])=>{const a=[...xs];for(let i=a.length-1;i>0;i--){const j=rand(1)[0]%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
// Meme planification qu'en mode local. Les deux surprises ont des tirages
// distincts, sans jamais superposer le mystere aux deux cartes de la Guerre.
function scheduleSurprises(playerCount:number,teamSize:number,requestedType:"war"|"marine"){
 const slots=Math.max(2,playerCount*teamSize);
 const last=Math.min(slots,12,Math.max(3,Math.ceil(slots*0.75)));
 const earliest=slots>=4?2:1;
 const rounds=Array.from({length:last-earliest+1},(_,i)=>earliest+i);
 const type=requestedType==="war"&&slots<3?"marine":requestedType;
 const events=type==="war"?rounds.filter(n=>n<last):rounds;
 const eventRound=events[rand(1)[0]%events.length];
 const excluded=new Set([eventRound]);
 if(type==="war")excluded.add(eventRound+1);
 const mysteries=rounds.filter(n=>!excluded.has(n));
 if(!mysteries.length){
   for(let n=1;n<=slots;n++)if(!excluded.has(n))mysteries.push(n);
 }
 const mysteryRound=mysteries[rand(1)[0]%mysteries.length];
 return {type,eventRound,mysteryRound};
}
// Les points de synergie proviennent uniquement de l'affiliation enregistree
// pour chaque personnage, et non plus d'anciennes combinaisons fixes.
const affiliationPoints=(count:number)=>count>=5?50:count>=2?(count-1)*10:0;
function affiliationBonuses(s:any,p:any){
 const counts=new Map<string,number>();
 for(const id of p.roster){
   const name=String(s.catalog[id]?.affiliation||"").trim();
   if(name)counts.set(name,(counts.get(name)||0)+1);
 }
 return [...counts].map(([name,count])=>({name,count,points:affiliationPoints(count)}))
   .filter(x=>x.points>0).sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name,"fr"));
}

type Special="war"|"marine"|"mystery"|"black"|"god"|"smile"|"reverie";
const SPECIALS:Special[]=["war","marine","mystery","black","god","smile","reverie"];
const randomIndex=(n:number)=>rand(2).reduce((v,x)=>v*256+x,0)%n;
function sevenSchedule(players:number,teamSize:number){
 const total=players*teamSize,qty=teamSize<=5?1:teamSize<=10?2:3;
 const allowed=SPECIALS.filter(t=>(t!=="smile"&&t!=="god")||total>=players*2+2);
 const picks:Special[]=[];
 while(picks.length<qty){picks.push(allowed.splice(randomIndex(allowed.length),1)[0]);}
 const plan:{type:Special,round:number}[]=[];const busy=new Set<number>();
 for(const type of picks){
   const earliest=type==="smile"?Math.max(players+1,Math.floor(total/2)+1):
     type==="god"?players+1:total<=2?1:2;
   const end=Math.max(earliest,Math.min(type==="war"?total-1:total,Math.ceil(total*.9)));
   const choices:number[]=[];
   for(let n=earliest;n<=end;n++){
     if(busy.has(n)||(type==="war"&&busy.has(n+1)))continue;
     if(type==="war"&&n>=total)continue;
     choices.push(n);
   }
   if(!choices.length)continue;
   const round=choices[randomIndex(choices.length)];plan.push({type,round});
   busy.add(round);if(type==="war")busy.add(round+1);
 }
 return plan.sort((a,b)=>a.round-b.round);
}
const effectivePower=(s:any,p:any,id:string)=>p.smileModifiers?.[id]===undefined?power(s,id):Math.max(0,Math.min(100,power(s,id)+p.smileModifiers[id]));
const taxed=(s:any)=>s.event?.active?.type==="reverie";
const scheduledAt=(s:any,n:number)=>s.event?.schedule?.find((e:any)=>e.round===n);
function eventReady(s:any,seat:number){
 const e=s.event.active;
 if(!e||!["intro","result"].includes(e.stage)||e.ready.includes(seat))throw Error("Validation indisponible.");
 e.ready.push(seat);
 if(e.ready.length<s.players.length)return;
 e.ready=[];
 if(e.stage==="result"){e.stage="auction";return;}
 e.stage=e.type==="marine"?"roll":e.type==="smile"?"coin":e.type==="black"?"select":e.type==="god"?"eliminate":"auction";
}

const score=(s:any,p:any)=>p.roster.reduce((n:number,id:string)=>n+effectivePower(s,p,id),0)+
  (p.armamentId&&p.roster.includes(p.armamentId)?5:0)+
  affiliationBonuses(s,p).reduce((n,b)=>n+b.points,0);
const publicPlayer=(s:any,p:any)=>({id:p.id,name:p.name,budget:p.budget,roster:p.roster,passesUsed:p.passesUsed,
  hakiUsed:p.hakiUsed,observationUsed:p.observationUsed,armamentUsed:p.armamentUsed,armamentId:p.armamentId||null,
  smileModifiers:p.smileModifiers||{},
  marineAward:p.marineAward,marineRoll:p.marineRoll??null,purchases:p.purchases,score:score(s,p),
  bonuses:affiliationBonuses(s,p)});
function snapshot(s:any,seat:number,version:number,room:any){
 const p=s.players[seat];const a=s.auction;
 const secret=!!(a?.mystery&&a.outcome===null);
 return {id:room.id,code:room.code,topic:"opmercato:"+room.id+":"+s.channelSecret,version,status:s.status,
   yourSeat:seat,host:seat===0,maxPlayers:s.maxPlayers||2,teamSize:s.teamSize,initialBudget:s.initialBudget,baseBid:s.baseBid,bidStep:s.bidStep,
   round:s.round,remaining:s.drawPile.length-s.drawIndex,event:{...s.event,schedule:undefined},
   players:s.players.map(x=>publicPlayer(s,x)),
   auction:a?{...a,charId:secret?null:a.charId,tier:rank(power(s,a.charId)),power:secret?null:power(s,a.charId)}:null,
   peek:p?.observationPeek||[],phase:s.status};
}
function nextBidder(s:any,from:number){
 const a=s.auction;const min=minBid(s,a);const first=a.leader===null&&a.highBid==="0"&&a.passed.length===0;
 for(let i=1;i<=s.players.length;i++){
   const p=s.players[(from+i)%s.players.length];
   if(p.id===a.leader||a.passed.includes(p.id)||p.roster.length>=s.teamSize)continue;
   if((taxed(s)?canBid(s,p,min*2n):canBid(s,p,min))||(first&&!taxed(s)&&hasHaki(s,p)))return p.id;
 }
 return null;
}
function isComplete(s:any) {
 return s.players.every((p:any)=>p.roster.length>=s.teamSize) ||
 !s.players.some((p:any)=>canBid(s,p,BigInt(s.baseBid))||hasHaki(s,p));
}
function settle(s:any){
 const a=s.auction;if(!a||a.outcome!==null)return;
 if(a.leader!==null){
   const p=s.players[a.leader],cost=BigInt(a.highBid)*(taxed(s)?2n:1n);
   if(p.roster.length>=s.teamSize||BigInt(p.budget)<cost)throw Error("Attribution invalide.");
   p.budget=(BigInt(p.budget)-cost).toString();
   p.roster.push(a.charId);p.purchases[a.charId]=cost.toString();a.outcome="sold";
 } else a.outcome="unsold";
 a.turnId=null;
}
function prepareWar(s:any){
 for(let i=0;i<2;i++){
   const j=s.drawIndex+i;
   const k=s.drawPile.findIndex((id:string,pos:number)=>pos>=j&&rank(power(s,id))==="S");
   if(k<0)return false;
   [s.drawPile[j],s.drawPile[k]]=[s.drawPile[k],s.drawPile[j]];
 }
 return true;
}
function legacyNext(s:any){
 if(isComplete(s)||s.drawIndex>=s.drawPile.length){s.status="finished";s.auction=null;return;}
 s.round++;
 if(!s.event.used&&s.round>=s.event.eventRound){
   s.event.used=true;s.event.activatedRound=s.round;
   if(s.event.type==="war"){
     if(prepareWar(s))s.event.warRounds=[s.round,s.round+1];
     else{s.event.type="marine";s.event.awaitingRolls=true;s.event.rollIndex=0;}
   }else{s.event.awaitingRolls=true;s.event.rollIndex=0;}
 }
 const charId=s.drawPile[s.drawIndex++];
 const mystery=!s.event.mysteryUsed&&s.round>=s.event.mysteryRound;
 if(mystery)s.event.mysteryUsed=true;
 s.auction={charId,highBid:"0",leader:null,passed:[],turnId:null,firstTurnId:null,
   outcome:null,mystery,warGuaranteed:s.event.warRounds.includes(s.round),hakiWinner:null};
 const from=(s.round-2+s.players.length)%s.players.length;
 const first=nextBidder(s,from);
 s.auction.turnId=first;s.auction.firstTurnId=first;
 if(first===null){s.status="finished";s.auction=null;}
}

function nextSeven(s:any){
 if(isComplete(s)||s.drawIndex>=s.drawPile.length){s.status="finished";s.auction=null;return;}
 s.event.active=null;s.round++;
 const spec=scheduledAt(s,s.round);
 if(spec&&["smile","god"].includes(spec.type)&&s.players.some((p:any)=>p.roster.length===0)){
   // Les équipages vides rendent SMILE et God Valley impossibles.
   // Choisir un autre événement non prévu plutôt que bloquer la partie.
   const reserved=new Set(s.event.schedule.map((e:any)=>e.type));
   const alternatives=(["mystery","marine","black","reverie"] as Special[]).filter(t=>!reserved.has(t));
   spec.type=alternatives[randomIndex(alternatives.length)]||"marine";
 }
 if(spec?.type==="war"&&!prepareWar(s)){
   const reserved=new Set(s.event.schedule.map((e:any)=>e.type));
   const alternatives=(["marine","mystery","black","reverie"] as Special[]).filter(x=>!reserved.has(x));
   spec.type=alternatives[randomIndex(alternatives.length)]||"marine";
 }
 const charId=s.drawPile[s.drawIndex++];
 const e=spec?{type:spec.type,round:s.round,stage:"intro",ready:[] as number[],step:0,
   choices:[] as string[],removed:[] as any[],flips:[] as any[]}:null;
 if(e){
   s.event.active=e;s.event.used=true;s.event.type=e.type;s.event.activatedRound=s.round;
   if(e.type==="war")s.event.warRounds=[s.round,s.round+1];
   if(e.type==="black"){
     e.choices=[charId,...s.drawPile.slice(s.drawIndex,s.drawIndex+2)];
     s.drawIndex+=e.choices.length-1;
   }
   if(e.type==="marine")s.event.rolls=[];
 }
 const mystery=e?.type==="mystery";
 if(mystery)s.event.mysteryUsed=true;
 s.auction={charId,highBid:"0",leader:null,passed:[],turnId:null,firstTurnId:null,outcome:null,
   mystery,warGuaranteed:s.event.warRounds.includes(s.round),hakiWinner:null};
 const from=(s.round-2+s.players.length)%s.players.length;
 const first=nextBidder(s,from);
 s.auction.turnId=first;s.auction.firstTurnId=first;
 if(first===null){
   if(e?.type==="reverie"){s.auction.outcome="unsold";s.auction.turnId=null;}
   else{s.status="finished";s.auction=null;}
 }
}
function next(s:any){if(s.event.schedule)return nextSeven(s);return legacyNext(s);}
function checkActor(s:any,seat:number){
 const a=s.auction;
 if(s.status!=="playing"||!a||a.outcome!==null)throw Error("Aucune enchère active.");
 if(s.event.awaitingRolls)throw Error("Terminez les lancers de dés.");
 if(s.event.schedule&&s.event.active&&s.event.active.stage!=="auction")throw Error("Valide l’événement avant l’enchère.");
 if(a.turnId!==seat)throw Error("Ce n'est pas ton tour.");
 return a;
}
function takeAction(s:any,seat:number,action:string,payload:any){
 const p=s.players[seat];
 if(!p)throw Error("Joueur introuvable.");
 if(action==="start"){
   if(seat!==0||s.status!=="lobby"||s.players.length!==(s.maxPlayers||2))throw Error("Attends que tous les joueurs aient rejoint le salon.");
   s.status="playing";next(s);return;
 }
 if(action==="finish"){if(seat!==0)throw Error("Seul l'hôte peut terminer la partie.");s.status="finished";s.auction=null;return;}

 if(action==="event-ready"){
   if(!s.event.schedule||s.status!=="playing")throw Error("Événement indisponible.");
   eventReady(s,seat);return;
 }
 if(action==="event-pick"){
   const e=s.event.active;
   if(!s.event.schedule||e?.type!=="black"||e.stage!=="select")throw Error("Marché Noir indisponible.");
   const first=s.auction.firstTurnId??0,acting=(first+e.step)%s.players.length;
   if(seat!==acting||e.step>=2)throw Error("Ce n'est pas ton choix.");
   const id=String(payload.charId||"");
   if(!e.choices.includes(id)||e.removed.includes(id))throw Error("Personnage non disponible.");
   e.removed.push(id);e.step++;
   if(e.step===2){
     const selected=e.choices.find((v:string)=>!e.removed.includes(v));
     s.auction.charId=selected;
     for(const returned of e.removed){
       const pos=s.drawIndex+randomIndex(s.drawPile.length-s.drawIndex+1);
       s.drawPile.splice(pos,0,returned);
     }
     e.stage="auction";
   }
   return;
 }
 if(action==="event-eliminate"){
   const e=s.event.active;
   if(!s.event.schedule||e?.type!=="god"||e.stage!=="eliminate")throw Error("God Valley indisponible.");
   const first=s.auction.firstTurnId??0,acting=(first+e.step)%s.players.length;
   if(seat!==acting)throw Error("Ce n'est pas ton choix.");
   const target=s.players[(acting+1)%s.players.length],id=String(payload.charId||"");
   if(id&&!target.roster.includes(id))throw Error("Ce personnage n'appartient pas à l'équipage adverse.");
   if(id){target.roster=target.roster.filter((x:string)=>x!==id);e.removed.push({from:target.id,id});}
   e.step++;
   if(e.step===s.players.length)e.stage="auction";
   return;
 }
 if(action==="coin"){
   const e=s.event.active;
   if(!s.event.schedule||e?.type!=="smile"||e.stage!=="coin"||e.flips.some((x:any)=>x.id===seat))
     throw Error("Lancer SMILE indisponible.");
   const id=p.roster.slice().sort((a:string,b:string)=>effectivePower(s,p,a)-effectivePower(s,p,b))[0];
   if(!id)throw Error("Aucun personnage à transformer.");
   const before=effectivePower(s,p,id),pile=randomIndex(2)===0,after=Math.max(0,Math.min(100,before+(pile?25:-25)));
   p.smileModifiers=p.smileModifiers||{};
   p.smileModifiers[id]=after-power(s,id);
   e.flips.push({id:seat,charId:id,pile,before,after});
   if(e.flips.length===s.players.length){e.stage="result";e.ready=[];}
   return;
 }
 if(action==="roll"){
   if(s.event.schedule){
     const e=s.event.active;
     if(s.status!=="playing"||e?.type!=="marine"||e.stage!=="roll"||e.step!==seat)
       throw Error("Ce n'est pas ton lancer.");
     const roll=randomIndex(6)+1,percent=roll*5;
     const prize=BigInt(s.initialBudget)*BigInt(percent)/100n;
     p.budget=(BigInt(p.budget)+prize).toString();p.marineAward=prize.toString();p.marineRoll=roll;
     s.event.rolls=s.event.rolls||[];s.event.rolls.push({id:seat,roll,percent,amount:prize.toString()});
     e.step++;
     if(e.step>=s.players.length){e.stage="result";e.ready=[];}
     return;
   }
   if(s.status!=="playing"||!s.event.awaitingRolls||s.event.rollIndex!==seat)throw Error("Ce n'est pas ton lancer.");
   const roll=rand(1)[0]%6+1,percent=roll*5;
   const prize=BigInt(s.initialBudget)*BigInt(percent)/100n;
   p.budget=(BigInt(p.budget)+prize).toString();
   p.marineAward=prize.toString();p.marineRoll=roll;
   s.event.rolls.push({id:seat,roll,percent,amount:prize.toString()});
   s.event.rollIndex++;
   if(s.event.rollIndex>=s.players.length)s.event.awaitingRolls=false;
   return;
 }
 if(action==="next"){
   if(seat!==0)throw Error("Seul l'hôte peut passer au personnage suivant.");
   if(s.status!=="playing"||!s.auction||s.auction.outcome===null)throw Error("Attends le résultat de l'enchère.");
   next(s);return;
 }
 const a=checkActor(s,seat);
 if(action==="bid"){
   const v=amount(payload.amount);
   if(v<minBid(s,a)||!canBid(s,p,taxed(s)?v*2n:v))throw Error("Montant insuffisant ou budget dépassé.");
   a.highBid=v.toString();a.leader=seat;
   a.turnId=nextBidder(s,seat);if(a.turnId===null)settle(s);return;
 }
 if(action==="pass"){
   if(taxed(s))throw Error("Rêverie : impossible de passer pendant l’enchère royale.");
   if(a.leader===null){
     if(p.passesUsed>=5)throw Error("Tu as utilisé tes 5 refus avant enchère.");
     p.passesUsed++;
   }
   a.passed.push(seat);a.turnId=nextBidder(s,seat);
   if(a.turnId===null)settle(s);return;
 }
 if(action==="haki"){
   if(taxed(s))throw Error("Haki des Rois interdit durant la Rêverie.");
   if(p.hakiUsed||a.firstTurnId!==seat||a.leader!==null||a.highBid!=="0"||a.passed.length>0)
      throw Error("Haki des Rois indisponible.");
   p.hakiUsed=true;p.roster.push(a.charId);p.purchases[a.charId]="0";
   a.leader=seat;a.hakiWinner=seat;a.highBid="0";a.outcome="sold";a.turnId=null;return;
 }
 if(action==="observation"){
   if(p.observationUsed)throw Error("Haki de l'Observation déjà utilisé.");
   p.observationUsed=true;
   p.observationPeek=s.drawPile.slice(s.drawIndex,s.drawIndex+3).map((id:string,pos:number)=>({
     id:(s.event.schedule?s.event.schedule.some((e:any)=>e.type==="mystery"&&e.round===s.round+pos+1):!s.event.mysteryUsed&&s.round+pos+1===s.event.mysteryRound)?null:id,
     tier:rank(power(s,id))}));
   return;
 }
 if(action==="armament"){
   const id=String(payload.charId||"");
   if(p.armamentUsed||!p.roster.includes(id))throw Error("Personnage non éligible.");
   p.armamentUsed=true;p.armamentId=id;return;
 }
 throw Error("Action inconnue.");
}
async function notify(room:any,s:any,version:number){
 try {
   await fetch(URL+"/realtime/v1/api/broadcast",{method:"POST",headers:{"Content-Type":"application/json","apikey":SERVICE},
     body:JSON.stringify({messages:[{topic:"opmercato:"+room.id+":"+s.channelSecret,event:"changed",payload:{version}}]})});
 } catch(e){console.log("broadcast fallback polling",String(e));}
}
let cached:{characters:any[]}|null=null;
async function catalog(){
 if(cached)return cached;
 const res=await fetch(REPO_CATALOG,{headers:{"Accept":"application/json"}});
 if(!res.ok)throw Error("Catalogue indisponible, réessaie.");
 const data=await res.json();
 if(!Array.isArray(data.characters)||data.characters.length<100||
   data.characters.some((c:any)=>typeof c.affiliation!=="string"||!c.affiliation.trim()))
   throw Error("Catalogue des affiliations incomplet, réessaie.");
 cached=data;return data;
}
// Met aussi a jour les vieux salons, sans supprimer leur progression.
async function ensureAffiliations(s:any){
 if(!s?.catalog||Object.values(s.catalog).every((c:any)=>typeof c.affiliation==="string"&&c.affiliation.trim()))return;
 const source=await catalog();
 const names=new Map(source.characters.map((c:any)=>[c.id,c.affiliation]));
 for(const [id,item] of Object.entries(s.catalog) as [string,any][]){
   if(!item.affiliation&&names.has(id))item.affiliation=names.get(id);
 }
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
 if(req.method!=="POST")return fail("Méthode interdite.",405);
 if(Number(req.headers.get("content-length")||0)>16000)return fail("Requête trop grande.",413);
 let arg:any;
 try{arg=await req.json();}catch{return fail("JSON invalide.");}
 if(!arg||typeof arg.action!=="string")return fail("Action manquante.");
 try{
   if(arg.action==="create"){
     const name=String(arg.name||"Pirate 1").trim().slice(0,25);
     const starting=amount(arg.budget||"250000000");
     const teamSize=Number(arg.teamSize??5),maxPlayers=Number(arg.maxPlayers??2);
     if(starting<1n||!Number.isInteger(teamSize)||teamSize<1||teamSize>30||
        !Number.isInteger(maxPlayers)||maxPlayers<2||maxPlayers>6)throw Error("Paramètres invalides.");
     const source=await catalog();
     const available=source.characters.filter((c:any)=>arg.spoilers!==false||!c.spoiler);
     const byId=Object.fromEntries(available.map((c:any)=>[c.id,{power:c.power,name:c.name,affiliation:c.affiliation}]));
     const hostToken=token(),roomCode=code();
     const eventType=rand(1)[0]%2===0?"war":"marine";
     const schedule=scheduleSurprises(maxPlayers,teamSize,eventType);
     const plan=sevenSchedule(maxPlayers,teamSize);
     const baseBid=starting>=1000n?starting/50n:20n;
     const bidStep=starting>=1000n?starting/100n:10n;
     const doc={status:"lobby",channelSecret:token(),maxPlayers,extraTokenHashes:[],players:[{id:0,name,budget:starting.toString(),roster:[],passesUsed:0,hakiUsed:false,
       observationUsed:false,armamentUsed:false,armamentId:null,observationPeek:[],marineAward:"0",marineRoll:null,purchases:{}}],
       teamSize,initialBudget:starting.toString(),baseBid:baseBid.toString(),bidStep:bidStep.toString(),
       catalog:byId,drawPile:shuffle(available.map((c:any)=>c.id)),drawIndex:0,round:0,auction:null,
       event:{type:schedule.type,eventRound:schedule.eventRound,mysteryRound:schedule.mysteryRound,
         schedule:plan,active:null,
         mysteryUsed:false,used:false,activatedRound:null,
         warRounds:[],awaitingRolls:false,rolls:[],rollIndex:0}};
     const {data,error}=await db.from("op_mercato_rooms").insert({code:roomCode,host_token_hash:await hash(hostToken),doc}).select("id,code,version").single();
     if(error)throw Error("Création du salon impossible. "+error.message);
     return json({token:hostToken,room:snapshot(doc,0,data.version,data)});
   }
   if(arg.action==="join"){
     const roomCode=String(arg.code||"").trim().toUpperCase();
     if(!/^[A-Z2-9]{8}$/.test(roomCode))throw Error("Code de salon invalide.");
     const {data:room,error}=await db.from("op_mercato_rooms").select("*").eq("code",roomCode).maybeSingle();
     if(error||!room)throw Error("Salon introuvable.");
     if(room.doc.status!=="lobby"||room.doc.players.length>=(room.doc.maxPlayers||2))throw Error("Cette partie a déjà démarré ou le salon est complet.");
     const guestToken=token();const guestHash=await hash(guestToken);
     const doc=structuredClone(room.doc),newSeat=doc.players.length;
     await ensureAffiliations(doc);
     doc.players.push({id:newSeat,name:String(arg.name||"Pirate 2").trim().slice(0,25)||"Pirate 2",
       budget:doc.initialBudget,roster:[],passesUsed:0,hakiUsed:false,observationUsed:false,armamentUsed:false,
       armamentId:null,observationPeek:[],marineAward:"0",marineRoll:null,purchases:{}});
     // One atomic join per slot, with optimistic concurrency on the room version.
     let data:any;
     if(newSeat===1){
       const joined=await db.from("op_mercato_rooms").update({
         guest_token_hash:guestHash,doc,version:room.version+1,updated_at:new Date().toISOString()
       }).eq("id",room.id).eq("version",room.version).is("guest_token_hash",null)
       .select("id,code,version").maybeSingle();
       if(joined.error||!joined.data)throw Error("Ce salon vient d'etre rejoint. Réessaie.");
       data=joined.data;
     }else{
       doc.extraTokenHashes=Array.isArray(doc.extraTokenHashes)?doc.extraTokenHashes:[];
       doc.extraTokenHashes[newSeat-2]=guestHash;
       const joined=await db.rpc("op_mercato_commit",{p_room:room.id,p_version:room.version,p_doc:doc});
       if(joined.error||!joined.data)throw Error("Ce salon vient d'etre rejoint. Réessaie.");
       data={id:room.id,code:room.code,version:room.version+1};
     }
     await notify(room,doc,data.version);
     return json({token:guestToken,room:snapshot(doc,newSeat,data.version,data)});
   }
   const roomId=String(arg.roomId||""),access=String(arg.token||"");
   if(!/^[0-9a-f-]{36}$/.test(roomId)||!/^[0-9a-f]{64}$/.test(access))throw Error("Session non reconnue.");
   const {data:room,error}=await db.from("op_mercato_rooms").select("*").eq("id",roomId).maybeSingle();
   if(error||!room)throw Error("Salon introuvable.");
   const digest=await hash(access);
   const extra=Array.isArray(room.doc.extraTokenHashes)?room.doc.extraTokenHashes.indexOf(digest):-1;
   const seat=digest===room.host_token_hash?0:digest===room.guest_token_hash?1:extra>=0?extra+2:-1;
   if(seat<0)throw Error("Session non autorisée.");
   if(arg.action==="get"){
     await ensureAffiliations(room.doc);
     return json({room:snapshot(room.doc,seat,room.version,room)});
   }
   const allowed=["start","bid","pass","haki","observation","armament","next","roll","finish","event-ready","event-pick","event-eliminate","coin"];
   if(!allowed.includes(arg.action))throw Error("Action inconnue.");
   const doc=structuredClone(room.doc);
   await ensureAffiliations(doc);
   takeAction(doc,seat,arg.action,arg);
   const {data:ok,error:casError}=await db.rpc("op_mercato_commit",{p_room:room.id,p_version:room.version,p_doc:doc});
   if(casError)throw Error("Sauvegarde refusée : "+casError.message);
   if(!ok)return fail("La partie a évolué sur l'autre téléphone. Actualisation nécessaire.",409);
   await notify(room,doc,room.version+1);
   return json({room:snapshot(doc,seat,room.version+1,room)});
 }catch(e){console.error("Mercato action error",String(e));return fail(e instanceof Error?e.message:"Erreur serveur.");}
});
