// ==UserScript==
// @name         PlayStation GTA VI noire - Essais precommande
// @namespace    https://www.playstation.com/
// @version      1.0.0
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
  if (window.__psGtaRetry) return;
  window.__psGtaRetry = true;
  const product = 'grand-theft-auto-vi-black-limited-edition';
  if (!location.href.includes(product)) return;
  let running = false, tries = 0, timer = null;
  const normalize = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const shown = el => !!el.getClientRects().length;
  const candidates = () => [...document.querySelectorAll('button,a,[role="button"]')].filter(shown);
  const name = el => normalize([el.innerText, el.getAttribute('aria-label'), el.title].filter(Boolean).join(' '));
  const find = regex => candidates().find(el => regex.test(name(el)));
  function status(message) { const el = document.getElementById('psgta-status'); if (el) el.textContent = message; }
  function stop(message) {
    running = false;
    clearTimeout(timer);
    status(message);
    const b = document.getElementById('psgta-toggle');
    if (b) b.textContent = 'Demarrer';
  }
  function retry() { clearTimeout(timer); if (running) timer = setTimeout(tick, 15000); }
  function tick() {
    if (!running) return;
    const body = normalize(document.body.innerText);
    if (/ajoute au panier|added to cart|article dans votre panier/.test(body)) {
      stop('Article potentiellement ajoute : verifie le panier !');
      alert('Manette GTA VI : verifie ton panier PlayStation.');
      return;
    }
    if (/une erreur s.est produite|something went wrong|an error occurred/.test(body)) {
      const close = find(/^(fermer|close|retour|back|×|✕)$/);
      if (close) {
        close.click();
        status('Erreur fermee, prochain essai dans 15 s');
        retry();
      } else stop('Erreur : fermeture manuelle necessaire');
      return;
    }
    const button = find(/precommander|précommander|pre-order|preorder/);
    if (button && !button.disabled && button.getAttribute('aria-disabled') !== 'true') {
      tries++;
      status('Tentative ' + tries + ' - attente 15 s');
      button.click();
    } else status('Bouton introuvable ou indisponible - nouvelle verification dans 15 s');
    retry();
  }
  function mount() {
    if (document.getElementById('psgta-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'psgta-panel';
    panel.style.cssText = 'position:fixed;bottom:85px;left:12px;right:12px;z-index:2147483647;background:#171717;color:#fff;border-radius:12px;padding:14px;font:14px Arial;box-shadow:0 4px 18px #0008';
    panel.innerHTML = '<b>🎮 GTA VI - Manette noire</b><div id="psgta-status" style="margin:10px 0">Pret</div><button id="psgta-toggle" style="width:100%;padding:12px;border:0;border-radius:8px;background:#0070d1;color:white;font-weight:bold">Demarrer</button>';
    document.body.appendChild(panel);
    document.getElementById('psgta-toggle').addEventListener('click', () => {
      if (running) stop('Arrete');
      else { running = true; tries = 0; document.getElementById('psgta-toggle').textContent = 'Arreter'; tick(); }
    });
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
