(function(){
"use strict";
const SHIPS={
 sunny:["☀️","Thousand Sunny","Coup de Vent","+3 refus supplémentaires"],
 redforce:["🐉","Red Force","Terre Sainte","+1 à +3 puissance par recrue"],
 mobydick:["🐋","Moby Dick","Protection du Père","10 % de réduction sur chaque achat"],
 polartang:["💛","Polar Tang","Opération de Jouvence","Haki de l'Armement à +40"],
 orojackson:["👑","Oro Jackson","Vision du Futur","Six visions et une inversion"]
};
let env=null;
const e=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const img=id=>'<img class="v3-ship-img" src="./v3-ships/'+e(id)+'.webp" alt="">';
const btn=(id,title,disabled=false)=>'<button type="button" data-v3="'+e(id)+'" class="primary" '+(disabled?'disabled':'')+'>'+title+'</button>';
const scoreVal=(p,id)=>Math.max(0,Math.min(100,Number(window.CARDS?.[id]?.power||0)+Number(p?.smileModifiers?.[id]||0)+Number(p?.shipBonus?.[id]||0)+(p?.armamentId===id?Number(p.armamentBonus||0):0)));
const affiliation=id=>window.MERCATO_EXPANSION?.details?.[id]?.crew||window.CARDS?.[id]?.affiliation||"";
function score(p,roster,originals={}){
 const groups={};let sum=0;
 for(const id of roster){sum+=scoreVal(originals[id]||p,id);const crew=affiliation(id);if(crew)groups[crew]=(groups[crew]||0)+1;}
 for(const n of Object.values(groups))if(n>=2)sum+=n>=5?50:(n-1)*10;
 return sum;
}
function changes(a,b,give,take){
 if(!a||!b||!give||!take)return null;
 const aScore=score(a,a.roster.filter(id=>id!==give).concat(take),{[take]:b});
 const bScore=score(b,b.roster.filter(id=>id!==take).concat(give),{[give]:a});
 return [aScore-a.score,bScore-b.score];
}
const signed=n=>n>0?"+"+n:String(n);
const card=id=>'<div class="v3-char"><div class="portrait portrait-medium"><img data-portrait-id="'+e(id)+'" class="portrait-photo" alt=""></div><b>'+e(window.CARDS?.[id]?.name||id)+'</b><small>'+Number(window.CARDS?.[id]?.power||0)+' pts · rang '+(Number(window.CARDS?.[id]?.power||0)>=95?"S":Number(window.CARDS?.[id]?.power||0)>=80?"A":Number(window.CARDS?.[id]?.power||0)>=65?"B":Number(window.CARDS?.[id]?.power||0)>=50?"C":Number(window.CARDS?.[id]?.power||0)>=35?"D":Number(window.CARDS?.[id]?.power||0)>=20?"E":"F")+'</small></div>';
const name=p=>e(p?.name||"Pirate");
function shipStatus(p){
 if(!p?.ship)return "";
 const label=p.ship==="sunny"?(8-p.passesUsed)+" refus":p.ship==="redforce"?"Actif":p.ship==="mobydick"?"−10 %":p.ship==="polartang"?(p.armamentUsed?"Utilisé":"Prêt"):(p.observationUsed?"Utilisé":"Prêt");
 return '<span class="v3-ship-label">'+img(p.ship)+'<small>'+e(label)+'</small></span>';
}
function dice(v){
 const me=v.players[v.yourSeat],roll=v.v3.rolls;
 return '<h2>🎲 Lancer de dé initial</h2><div class="v3-dice-anim">🎲</div>'+
 '<p>Le plus grand résultat choisit son navire en premier. Le dernier à choisir commence la première enchère.</p>'+
 '<div class="v3-table">'+v.players.map(p=>'<p>'+name(p)+' : <b>'+(roll[p.id]??"À lancer")+'</b></p>').join("")+'</div>'+
 btn("roll",roll[me.id]!==undefined?"✓ Dé déjà lancé":"🎲 Lancer mon dé",roll[me.id]!==undefined);
}
function ships(v){
 const current=v.v3.choiceOrder[v.v3.choiceIndex],used=new Set(v.players.map(p=>p.ship).filter(Boolean));
 return '<h2>⛵ Choisis ton navire</h2><p>'+(current===v.yourSeat?"C'est ton tour !":"Au tour de "+name(v.players[current]))+'</p>'+
 '<div class="v3-grid">'+Object.entries(SHIPS).map(([id,data])=>'<article class="v3-ship '+(used.has(id)?"v3-used":"")+'">'+
 img(id)+'<h3>'+data[0]+' '+e(data[1])+'</h3><b>'+e(data[2])+'</b><p>'+e(data[3])+'</p>'+
 btn("ship:"+id,used.has(id)?"Déjà choisi":"Choisir",used.has(id)||current!==v.yourSeat)+'</article>').join("")+'</div>';
}
function morgans(v){
 const m=v.v3.morgans,me=v.players[v.yourSeat],winner=v.players[m.winner],id=m.id;
 const n=Number(window.CARDS?.[id]?.power||0);
 const reveal=id?'<div class="v3-focus">'+card(id)+'</div>':"";
 let html='<h2>📰 Les Prédictions de Morgans</h2>';
 if(m.stage==="intro")html+='<p>Devine la puissance d’origine du personnage mystère (entre 1 et 100).</p>'+
 btn("morgans-ready",m.ready.includes(me.id)?"En attente…":"Continuer",m.ready.includes(me.id));
 if(m.stage==="guesses")html+=m.submitted.includes(me.id)?'<p>✓ Ta prédiction est enregistrée. Elle reste secrète.</p>':
 '<p>Quel est ton pronostic ?</p><input type="number" id="v3-guess" min="1" max="100" inputmode="numeric" placeholder="1 à 100">'+btn("morgans-guess","🔒 Valider ma prédiction");
 if(m.stage==="character")html+='<p>Morgans dévoile le personnage !</p>'+reveal+(v.host?btn("morgans-next","Continuer →"):"");
 if(m.stage==="reveal")html+=reveal+'<h3>Révélation des prédictions</h3>'+
 '<div class="v3-table">'+v.players.map((p,i)=>'<p>'+name(p)+' : '+(i<m.shown?'<b>'+m.guesses[p.id]+' pts (écart '+Math.abs(Number(m.guesses[p.id])-n)+')</b>':'❔')+'</p>').join("")+'</div>'+
 (v.host?btn("morgans-next","Continuer →"):"<p>Révélation en cours…</p>");
 if(m.stage==="wheel")html+=reveal+'<div class="v3-wheel">🎡</div><p>Égalité entre '+(m.tied||[]).map(x=>name(v.players[x])).join(" et ")+'</p>'+
 (v.host?btn("morgans-wheel","Lancer la roue"):"");
 if(m.stage==="winner")html+=reveal+'<h3 class="v3-win">🏆 '+name(winner)+' gagne !</h3>'+
 (v.host?btn("morgans-next","Continuer →"):"");
 if(m.stage==="offer"){
  const bonus=Number(m.bonus||0),target=winner||me;
  const predicted=score(target,target.roster.concat(id),{[id]:{...target,shipBonus:{...target.shipBonus,[id]:bonus},armamentId:null}});
  html+=reveal+(bonus?'<p>🐉 Terre Sainte : +'+bonus+' points !</p>':"")+
   '<p>Gain total estimé : <b>'+signed(predicted-target.score)+' points</b>, synergies comprises.</p>'+
   (m.winner===me.id?btn("morgans-accept","Recruter gratuitement")+btn("morgans-decline","Refuser le personnage"):'<p>En attente du choix de '+name(target)+'</p>');
 }
 if(m.stage==="armament")html+=reveal+'<p>🛡 Ce personnage peut bénéficier du Haki de l’Armement.</p>'+
 (m.winner===me.id?btn("morgans-armament","Utiliser le Haki +"+(me.ship==="polartang"?40:20))+btn("morgans-skip","Conserver pour plus tard"):
 '<p>Le vainqueur choisit…</p>');
 return html;
}
function tradePreview(v){
 const frm=env.root.querySelector("#v3-give"),dst=env.root.querySelector("#v3-destination"),take=env.root.querySelector("#v3-take"),out=env.root.querySelector("#v3-preview");
 if(!frm||!dst||!take||!out)return;
 const from=v.players[v.yourSeat],to=v.players[Number(dst.value)],prev=take.value;
 const options=to?.roster.filter(id=>!v.v3.market.locked.includes(id))||[];
 take.innerHTML=options.map(id=>'<option value="'+e(id)+'">'+e(window.CARDS?.[id]?.name||id)+' · '+scoreVal(to,id)+' pts</option>').join("");
 if(options.includes(prev))take.value=prev;
 const d=changes(from,to,frm.value,take.value);
 out.innerHTML=d?'<b>'+name(from)+' : '+signed(d[0])+' pts | '+name(to)+' : '+signed(d[1])+' pts</b>':"";
}
function market(v){
 const t=v.v3.market,now=v.players[t.order[t.step]],me=v.players[v.yourSeat];
 let html='<h2>🔄 Marché des transferts</h2><p>Une proposition par joueur, sans Berrys. Les personnages échangés sont verrouillés jusqu’à la fin du marché.</p>';
 if(t.offer){
  const o=t.offer,a=v.players[o.from],b=v.players[o.to],d=changes(a,b,o.give,o.take);
  html+='<h3>'+name(a)+' propose un échange à '+name(b)+'</h3><div class="v3-pair">'+card(o.give)+card(o.take)+'</div>'+
   '<p>'+name(a)+' : '+signed(d?.[0]||0)+' pts | '+name(b)+' : '+signed(d?.[1]||0)+' pts</p>'+
   (o.to===me.id?btn("trade-accept","Accepter")+btn("trade-reject","Refuser"):'<p>En attente de '+name(b)+'</p>');
 }else if(now?.id===me.id){
  const chars=me.roster.filter(id=>!t.locked.includes(id));
  const targets=v.players.filter(p=>p.id!==me.id&&p.roster.some(id=>!t.locked.includes(id)));
  if(!chars.length||!targets.length)html+=btn("trade-pass","Passer (aucun échange disponible)");
  else html+='<h3>À toi de proposer un échange</h3>'+
   '<label>Personnage proposé<select id="v3-give">'+chars.map(id=>'<option value="'+e(id)+'">'+e(window.CARDS?.[id]?.name||id)+' · '+scoreVal(me,id)+' pts</option>').join("")+'</select></label>'+
   '<label>Destinataire<select id="v3-destination">'+targets.map(p=>'<option value="'+p.id+'">'+name(p)+'</option>').join("")+'</select></label>'+
   '<label>Personnage demandé<select id="v3-take"></select></label><div id="v3-preview"></div>'+
   btn("trade-offer","Proposer l’échange")+btn("trade-pass","Passer mon tour");
 }else html+='<p>Au tour de '+name(now)+' de faire sa proposition.</p>';
 if(t.exchanges?.length)html+='<h3>Échanges effectués</h3>'+t.exchanges.map(o=>
  '<p>'+name(v.players[o.from])+' ↔ '+name(v.players[o.to])+' : '+e(window.CARDS?.[o.give]?.name||o.give)+' / '+e(window.CARDS?.[o.take]?.name||o.take)+'</p>').join("");
 return html;
}
function screen(){
 const v=env.getView();if(!v?.v3)return "";
 const phase=v.v3.stage;
 const body=phase==="dice"?dice(v):phase==="ships"?ships(v):phase==="morgans"?morgans(v):phase==="market"?market(v):"";
 return '<div class="online-room-bar">Salon <strong>'+e(v.code)+'</strong> · OPMercato 3.0</div>'+
 env.hud()+'<section class="online-card v3-special">'+body+'</section>'+env.teams()+
 (v.host?env.button("finish","Terminer la partie","online-text"):"");
}
function init(x){
 env=x;
 env.root.addEventListener("change",ev=>{if(["v3-give","v3-destination","v3-take"].includes(ev.target.id))tradePreview(env.getView());});
 document.addEventListener("click",async ev=>{
  const b=ev.target.closest("button[data-v3]");if(!b||b.disabled)return;
  ev.preventDefault();ev.stopImmediatePropagation();
  const id=b.dataset.v3;
  if(id==="roll")return env.action("v3-roll");
  if(id.startsWith("ship:"))return env.action("v3-ship",{ship:id.slice(5)});
  if(id==="morgans-ready")return env.action("v3-morgans-ready");
  if(id==="morgans-guess")return env.action("v3-morgans-guess",{guess:Number(env.root.querySelector("#v3-guess")?.value)});
  if(id==="morgans-next")return env.action("v3-morgans-next");
  if(id==="morgans-wheel")return env.action("v3-morgans-wheel");
  if(id==="morgans-accept"||id==="morgans-decline")return env.action("v3-morgans-recruit",{accept:id==="morgans-accept"});
  if(id==="morgans-armament")return env.action("v3-morgans-armament");
  if(id==="morgans-skip")return env.action("v3-morgans-skip");
  if(id==="trade-pass"||id==="trade-accept"||id==="trade-reject")return env.action("v3-"+id);
  if(id==="trade-offer")return env.action("v3-trade-offer",{
   give:env.root.querySelector("#v3-give")?.value,to:Number(env.root.querySelector("#v3-destination")?.value),
   take:env.root.querySelector("#v3-take")?.value});
 },true);
}
const css=document.createElement("style");
css.textContent=".v3-special{padding:18px!important}.v3-special h2{margin:5px 0 12px}.v3-special h3{margin:14px 0 8px}.v3-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:11px}.v3-ship{border-radius:14px;border:1px solid #7894a344;background:#142d3e;padding:10px;text-align:center;display:flex;flex-direction:column;gap:7px}.v3-ship h3{font-size:15px;margin:3px 0}.v3-ship b{font-size:12px}.v3-ship p{font-size:12px;margin:0 0 10px;flex:1}.v3-ship-img{aspect-ratio:1;width:100%;object-fit:cover;border-radius:11px;background:#315568}.v3-used{opacity:.45}.v3-ship-label{display:inline-flex;align-items:center;gap:5px}.v3-ship-label img{width:27px;height:27px;border-radius:50%;object-fit:cover}.v3-dice-anim{font-size:80px;text-align:center;animation:v3-rock .8s infinite alternate}@keyframes v3-rock{from{transform:rotate(-15deg)}to{transform:rotate(15deg)}}.v3-wheel{text-align:center;font-size:80px;animation:v3-rotate 1s linear infinite}@keyframes v3-rotate{to{transform:rotate(360deg)}}.v3-table p{display:flex;justify-content:space-between;padding:10px;border:1px solid #ffffff22;border-radius:10px}.v3-pair{display:grid;grid-template-columns:1fr 1fr;gap:9px}.v3-char{border-radius:11px;background:#153447;padding:12px;text-align:center;min-width:0}.v3-char .portrait{display:block;margin:0 auto 8px}.v3-char small{display:block;color:#b6d0df}.v3-focus{max-width:210px;margin:12px auto}.v3-special select,.v3-special input{display:block;width:100%;background:#17364b;color:white;border:1px solid #65879d;border-radius:10px;min-height:45px;margin:6px 0 13px;padding:9px}.v3-special button{margin:6px 0}.v3-win{color:#85e4ad}";
document.head.appendChild(css);
window.OPMERCATO_V3_UI={init,screen,shipStatus,tradePreview:()=>tradePreview(env.getView())};
})();