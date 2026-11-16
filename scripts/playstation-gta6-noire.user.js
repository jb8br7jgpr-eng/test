// ==UserScript==
// @name         PlayStation GTA VI noire - Essais precommande
// @namespace    https://www.playstation.com/
// @version      1.3.0
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
if(window.__psGtaV13) return;
window.__psGtaV13=true;
const PRODUCT='https://www.playstation.com/fr-fr/accessories/dualsense-wireless-controller/buy-now/product/grand-theft-auto-vi-black-limited-edition/';
const KEY='ps-gta6-retry-v13';
const INTERVAL=5000;
const norm=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const isProduct=()=>location.pathname.includes('grand-theft-auto-vi-black-limited-edition');
const isError=()=>/une erreur s.est produite|something went wrong|an error occurred/.test(norm(document.body?.innerText));
const get=()=>{try{return JSON.parse(sessionStorage.getItem(KEY)||'{}')}catch{return {}}};
const save=o=>sessionStorage.setItem(KEY,JSON.stringify(o));
let state=get(),timer=null,handling=false;
const active=()=>!!state.active;
function status(t){const e=document.getElementById('psgta-status');if(e)e.textContent=t;}
function stop(t){state.active=false;save(state);clearTimeout(timer);status(t);const b=document.getElementById('psgta-toggle');if(b)b.textContent='Démarrer';}
function next(delay=INTERVAL){clearTimeout(timer);if(active())timer=setTimeout(run,delay);}
const visible=e=>!!(e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
function closeCross(){
 const candidates=[...document.querySelectorAll('button,[role="button"],a,[aria-label]')].filter(visible);
 const label=e=>norm([e.innerText,e.getAttribute('aria-label'),e.title,e.getAttribute('data-testid')].filter(Boolean).join(' '));
 let x=candidates.find(e=>/^(fermer|close|×|✕|x)$/.test(label(e).trim()));
 if(!x)x=candidates.find(e=>/close|dismiss|fermer/i.test([e.id,e.className?.baseVal||e.className,e.getAttribute('data-testid')].join(' ')));
 if(!x){
   const w=innerWidth;
   x=candidates.find(e=>{const r=e.getBoundingClientRect();return r.top>65&&r.top<310&&r.left>w*.78&&r.right<w*.97&&r.width<100&&r.height<100;});
 }
 if(!x){
   const e=document.elementFromPoint(innerWidth*.90,Math.min(210,innerHeight*.13));
   x=e?.closest('button,a,[role="button"]');
 }
 if(x){x.click();return true;}
 return false;
}
function handleError(){
 if(handling||!active())return;
 handling=true;
 status('Erreur détectée : fermeture de la croix…');
 const clicked=closeCross();
 setTimeout(()=>{
   handling=false;
   if(!active())return;
   if(!isError()){next(INTERVAL);return;}
   // La page d'erreur peut être une navigation complète : retour à la fiche.
   if(!isProduct() && history.length>1){
     status('Retour vers la fiche PlayStation…');
     history.back();
     return;
   }
   stop(clicked?'La croix ne ferme pas l’erreur : arrêt':'Croix inaccessible : arrêt');
 },1200);
}
function run(){
 if(!active()||handling)return;
 if(isError()){handleError();return;}
 if(!isProduct()){
   // Ne pas agir sur les pages panier, connexion ou paiement.
   stop('Navigation hors fiche : vérifie ton panier');
   return;
 }
 const text=norm(document.body.innerText);
 if(/ajoute au panier|added to cart|article dans votre panier/.test(text)){
   stop('Ajout possible : vérifie ton panier');
   alert('🎮 Vérifie le panier PlayStation !');
   return;
 }
 const buttons=[...document.querySelectorAll('button,a,[role="button"]')].filter(visible);
 const preorder=buttons.find(e=>/precommander|pre-order|preorder/.test(norm([e.innerText,e.getAttribute('aria-label')].join(' ')))&&!e.disabled&&e.getAttribute('aria-disabled')!=='true');
 if(!preorder){status('Précommander introuvable : vérification dans 5 s');next();return;}
 const elapsed=Date.now()-(state.last||0);
 if(elapsed<INTERVAL){next(INTERVAL-elapsed);return;}
 state.count=(state.count||0)+1;
 state.last=Date.now();
 save(state);
 status('Essai n°'+state.count+' — attente 5 s');
 preorder.click();
 next();
}
function mount(){
 if(document.getElementById('psgta-panel'))return;
 const p=document.createElement('div');p.id='psgta-panel';
 p.style.cssText='position:fixed;bottom:85px;left:12px;right:12px;z-index:2147483647;background:#171717;color:white;border-radius:12px;padding:14px;font:14px Arial;box-shadow:0 4px 18px #0008';
 p.innerHTML='<b>🎮 GTA VI noire — v1.3</b><div id="psgta-status" style="margin:10px 0">Prêt — intervalle 5 s</div><button id="psgta-toggle" style="width:100%;padding:12px;border:0;border-radius:8px;background:#0070d1;color:white;font-weight:bold">Démarrer</button>';
 document.body.appendChild(p);
 document.getElementById('psgta-toggle').onclick=()=>{
   if(active())stop('Arrêté');
   else {state={active:true,count:0,last:0};save(state);document.getElementById('psgta-toggle').textContent='Arrêter';run();}
 };
 if(active()){document.getElementById('psgta-toggle').textContent='Arrêter';run();}
}
if(isProduct()||isError()) {
 if(document.body)mount();else document.addEventListener('DOMContentLoaded',mount);
}
})();
