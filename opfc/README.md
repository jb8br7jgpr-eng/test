# OPMercato FC — état de développement

Branche exclusive : `opfc-development`. **Ne jamais fusionner dans `main`,
déployer GitHub Pages ni modifier le serveur d’OPMercato classique sans accord
explicite.**

## Jeu local

Le mercato des 50 personnages, les formations 7 contre 7, les enchères,
les Hakis du marché, le terrain iPhone, les actions de jeu ouvert, les duels,
les coups de pied arrêtés, les tirs, la mi-temps, les tirs au but, la mort
subite et la feuille de match sont développés.

Les écrans validés incluent les portraits officiels WebP, les boutons tactiques
centrés avec emojis, les deux portraits de frappe, la carte de réception
compacte, le bilan à 45', les indicateurs de tirs au but et la page de victoire.

## Mode en ligne — code prêt pour recette, PAS déployé

- Salon privé à six caractères, session séparée par iPhone, reconnexion.
- Serveur prévu : `supabase/functions/opfc-online/index.ts`.
- Base dédiée à préparer : `supabase/opfc-schema.sql`.
- Autorités serveurs : `online-market.mjs`, `online-lineup.mjs`,
  `online-match.mjs`, `online-set-piece.mjs`, `online-endgame.mjs`.
- Vues client publiques : `ui-online.mjs`, `ui-online-game.mjs`,
  `online-client.mjs`. Boutons reliés aux commandes serveur, sans accès
  client aux tirages futurs ni aux choix secrets adverses.
- `online-config.mjs` reste intentionnellement vide tant que le projet
  Supabase **OPFC distinct** n'est pas créé et approuvé.
- Aucun test réseau sur deux vrais téléphones n'a encore été effectué.

## Recette automatisée

- Tests Node : `node --test opfc/tests/*.test.mjs`.
- Chrome mobile : `node opfc/browser/mobile-preview.mjs` — vues locales.
- Double iPhone simulé : `node opfc/browser/online-dual-preview.mjs` —
  parcours authentiques dans deux navigateurs séparés, serveur simulé
  intercepté par Playwright ; **aucun appel à Supabase réel**.
- Les trois workflows GitHub contrôlent moteur, régressions et vues iPhone.

## Avant toute publication

1. Faire passer tous les workflows sur le dernier commit.
2. Autorisation expresse pour créer/configurer un projet Supabase OPFC
   indépendant, en indiquant d'abord les frais éventuels.
3. Appliquer le schéma et déployer uniquement `opfc-online` dans ce projet,
   avec ses protections anti-abus / CORS / secrets.
4. Renseigner l'URL publique du projet OPFC, publier la page OPFC seulement
   après accord explicite, et tester deux vrais iPhone de bout en bout.
5. Conserver `main` et le jeu OPMercato classique inchangés tant que
   l'utilisateur n'approuve pas une procédure de publication sécurisée.

Le trophée HD illustré de la Grandline Cup sera créé ultérieurement,
après les premiers essais publics du jeu.
