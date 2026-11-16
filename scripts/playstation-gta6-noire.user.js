// ==UserScript==
// @name         PlayStation GTA VI noire - Essais precommande
// @namespace    https://www.playstation.com/
// @version      1.2.0
// @description  Essais espaces de precommande, sans commande ni paiement.
// @match        https://www.playstation.com/*
// @match        https://direct.playstation.com/*
// @run-at       document-idle
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/jb8br7jgpr-eng/test/main/scripts/playstation-gta6-noire.user.js
// @updateURL    https://raw.githubusercontent.com/jb8br7jgpr-eng/test/main/scripts/playstation-gta6-noire.user.js
// ==/UserScript==
(() => {
'use strict';
if(window.__psGtaV12) return;
window.__psGtaV12=true;
if(!location.pathname.includes('grand-theft-auto-vi-black-limited-edition')) return;
let running=false,tries=0,timer=null,closing=false,waiting=false;
const norm=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const visible=e=>!!(e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
const controls=()=>[...document.querySelectorAll('button,a,[role="button"],[aria-label],input[type="button"]')].filter(visible);
const label=e=>norm([e.innerText,e.getAttribute('aria-label'),e.getAttribute('title'),e.getAttribute('data-testid')].filter(Boolean).join(' '));
const error=()=>/une erreur s.est produite|something went wrong|an error occurred/.test(norm(document.body.innerText));
const status=s=>{let e=document.getElementById('psgta-status');if(e)e.textContent=s;};
const later=(ms=3000)=>{clearTimeout(timer);if(running)timer=setTimeout(tick,ms);};
function stop(s){running=false;clearTimeout(timer);status(s);const b=document.getElementById('psgta-toggle');if(b)b.textContent='Démarrer';}
function closeError(){
 const dialogs=[...document.querySelectorAll('[role="dialog"],[aria-modal="true"],dialog')].filter(visible);
 const scoped=dialogs.length?dialogs[dialogs.length-1]:document;
 const list=[...scoped.querySelectorAll('button,[role="button"],a,[aria-label]')].filter(visible);
 let x=list.find(e=>/^(fermer|close|×|✕|x)$/.test(label(e).trim()));
 if(!x) x=list.find(e=>/close|dismiss|fermer|modal-close/i.test([e.className?.baseVal||e.className,e.id,e.getAttribute('data-testid')].join(' ')));
 if(!x){
   const candidates=list.filter(e=>{const r=e.getBoundingClientRect();return r.width>8&&r.width<100&&r.height>8&&r.height<100&&r.top>=80&&r.top<Math.min(420,innerHeight*.28)&&r.left>innerWidth*.72&&r.right<innerWidth*.98;});
   x=candidates.find(e=>{const r=e.getBoundingClientRect();return r.left<innerWidth*.94;});
 }
 if(!x)return false;
 x.click();
 return true;
}
function tick(){
 if(!running)return;
 if(error()){
   if(!closing){
     closing=true;
     const clicked=closeError();
     status(clicked?'Croix cliquée : vérification fermeture…':'Croix introuvable : arrêt');
     if(!clicked){stop('Impossible de fermer automatiquement');return;}
     setTimeout(()=>{
       closing=false;
       if(!running)return;
       if(error()){stop('Erreur toujours affichée : arrêt sécurisé');return;}
       later(1500);
     },900);
   }
   return;
 }
 if(closing)return;
 const text=norm(document.body.innerText);
 if(/ajoute au panier|added to cart|article dans votre panier/.test(text)){
   stop('Vérifie ton panier : ajout possible');
   alert('🎮 Vérifie le panier PlayStation !');
   return;
 }
 if(waiting)return;
 const b=controls().find(e=>/precommander|pre-order|preorder/.test(label(e))&&!e.disabled&&e.getAttribute('aria-disabled')!=='true');
 if(!b){status('Bouton Précommander introuvable');later(3000);return;}
 tries++;waiting=true;
 status('Essai réel n°'+tries+' — vérification…');
 b.click();
 setTimeout(()=>{waiting=false;if(running)later(1500);},1500);
}
const observer=new MutationObserver(()=>{
 if(running&&!closing&&error()){
   clearTimeout(timer);
   tick();
 }
});
observer.observe(document.documentElement,{subtree:true,childList:true});
function mount(){
 if(document.getElementById('psgta-panel'))return;
 const p=document.createElement('div');p.id='psgta-panel';
 p.style.cssText='position:fixed;bottom:85px;left:12px;right:12px;z-index:2147483647;background:#171717;color:#fff;border-radius:12px;padding:14px;font:14px Arial;box-shadow:0 4px 18px #0008';
 p.innerHTML='<b>🎮 GTA VI noire — v1.2</b><div id="psgta-status" style="margin:10px 0">Prêt</div><button id="psgta-toggle" style="width:100%;padding:12px;border:0;border-radius:8px;background:#0070d1;color:white;font-weight:bold">Démarrer</button>';
 document.body.appendChild(p);
 document.getElementById('psgta-toggle').onclick=()=>{
  if(running)stop('Arrêté');
  else{running=true;tries=0;closing=false;waiting=false;document.getElementById('psgta-toggle').textContent='Arrêter';tick();}
 };
}
if(document.body)mount();else document.addEventListener('DOMContentLoaded',mount);
})();
