# OPFC — 10A3B2a : synchronisation du jeu ouvert (non déployé)

**Statut :** uniquement sur \`opfc-development\`. Aucun projet Supabase
OPFC n'est encore connecté et aucune interface de match réseau n'est
activée dans le jeu public. Les modules locaux conservent leur comportement.

## Actions de match côté serveur

Une fois les deux équipes validées et le coup d'envoi lancé :

\`POST {action:"match",roomId,token,expectedVersion,command}\`

Le serveur déduit le club du **jeton individuel**, vérifie l'étape et le tour,
puis appelle uniquement les transitions officielles :

- \`{type:"begin-open"}\` — club attaquant : prépare les rôles et le contexte.
- \`{type:"choose",choice:"COMBINER"}\` — attaquant, puis réponse défensive
  \`PRESSER\`, \`INTERCEPTER\` ou \`CONTENIR\`.
- \`{type:"reveal-duel"}\` — après les deux choix, l'attaquant révèle le duel ;
  le serveur tire son résultat (chance, stoppé ou faute).
- \`{type:"continue-duel"}\` — l'attaquant continue après l'annonce.
- \`{type:"choose",choice:"PLACEE"}\` puis réaction du gardien : deux choix
  secrets, avec vérification du tour.
- \`{type:"reveal-shot"}\` — le serveur calcule le tir, l'arrêt ou le but.
- \`{type:"continue-result"}\` — après affichage du résultat, l'attaquant
  ouvre la séquence suivante ou la mi-temps.

Tous les tirages viennent de \`crypto.getRandomValues\` côté Edge.
Les commandes ne peuvent pas fournir leur propre résultat, probabilité,
nom de club ou calendrier.

## Confidentialité et concurrence

- Le serveur garde l'état maître complet, le paquet, le calendrier et les
  deux choix de chaque duel. \`onlineMatchView\` renvoie **uniquement** le
  score, les statistiques, la séquence actuelle, l'historique déjà joué,
  les acteurs annoncés et les confirmations, jamais les valeurs secrètes
  avant la révélation officielle.
- Chaque écriture est validée avec \`room.version\` ; une requête obsolète
  renvoie HTTP 409 sans écraser les actions adverses.
- \`get\` permet à chaque iPhone de recharger la vue du match, même après
  avoir fermé ou rechargé sa page.
- La sauvegarde d'Observation issue du mercato reste strictement serveur :
  elle ne passe pas dans la vue de match.

## Limites restantes

**10A3B2b** : connecter les corners, coups francs, penalties et ceux issus
des fautes dans le jeu ouvert, toujours sans séquence supplémentaire.

**10A3B2c** : gérer la mi-temps avec double validation, les tirs au but et
l'écran final, avec réponses spécifiques à chaque joueur.

**10A4** : raccorder les vues et commandes en ligne aux boutons iPhone déjà
développés en mode local, en préservant les décisions secrètes.
Véritables tests sur deux téléphones après autorisation de déployer
un backend OPFC **séparé**.

Ne pas présenter ce sous-bloc comme un match en ligne déjà jouable.


## 10A3B2b — Phases arrêtées du match (développement, non déployé)

Les actions \`POST action:"match"\` acceptent désormais également :
\`begin-setpiece\`, \`select-taker\` (avec \`takerId\`),
\`choose\` (avec \`choice\`), \`reveal-setpiece-duel\`,
\`continue-setpiece-duel\`, \`finish-corner\` et \`reveal-penalty\`.
Le serveur contrôle **à chaque transition** le club authentifié, l'étape
attendue et le numéro de séquence. Aucun client ne peut envoyer le résultat
du tir ni le générateur aléatoire : les calculs restent ceux du moteur local
et les tirages proviennent de \`crypto.getRandomValues\`.

Pour un corner : tireur → zones secrètes → duel révélé → geste de finition
secret du tireur → résultat. Pour un coup franc : tireur → stratégies secrètes
→ duel révélé → finition automatique. Pour un penalty : tireur → deux directions
secrètes → résolution unique. Les fautes du jeu ouvert sont reprises comme
coup franc ou penalty **dans la même séquence**, et une seule ligne entre
dans les statistiques du match.

Les valeurs choisies restent uniquement dans \`private_state\` ; le client
reçoit les confirmations et les calculs révélés à l'étape autorisée. Tous les
POST passent par le verrou de version du salon déjà présent dans Edge.

Tests dédiés : \`opfc/tests/online-set-piece.test.mjs\` (moteur et sécurité)
et \`opfc/tests/online-set-piece-client.test.mjs\` (deux iPhone simulés,
conflits de version et résultats synchronisés).

**Les fonctionnalités restantes :** synchroniser la mi-temps, les tirs au but
et le résultat final (10A3B2c), puis connecter l'interface graphique des
deux téléphones au véritable salon (10A4). Le backend OPFC n'est pas déployé.


## 10A3B2c — Mi-temps, tirs au but et résultat final en ligne

Actions \`POST action:"match"\` ajoutées :
\`half-formation\` (\`formation\`), \`half-place\` (\`cardId\`, \`slot\`),
\`half-ready\`, \`resume\`, \`begin-shootout\`, \`shootout-choose\`
(\`choice\` = \`GAUCHE\`, \`CENTRE\` ou \`DROITE\`),
\`shootout-reveal\`, \`shootout-continue\`.

- **Mi-temps :** chaque club change uniquement ses propres placements
  et sa formation. Quand il confirme, l'équipe devient verrouillée.
  Les deux validations ouvrent \`resume-ready\`. Seul l'hôte
  reprend la seconde période ; le calendrier ne change pas.
- **Après 90 minutes :** si le score est égal, l'hôte lance le tirage
  initial côté serveur. Les titulaires et le classement des tireurs
  sont déterminés par le moteur existant et ne peuvent plus être modifiés.
- **Un tir :** direction du tireur → direction du gardien → révélation
  calculée côté serveur → écran de résultat → « Continuer ».
  Le client ne peut pas choisir le tireur, le résultat ou le hasard.
- **Confidentialité :** avant la révélation, la vue \`shootout\` montre
  les deux confirmations mais **jamais les directions**. Après le tir,
  seules les tentatives résolues entrent dans l'historique public ;
  les probabilités et ordres de tireurs ne sont pas transmis.
- **Fin :** vainqueur, score du match, statistiques et score
  de séance séparé sont disponibles dans la vue réseau,
  y compris après une reconnexion. Le dernier tir reste affiché
  jusqu'à « Continuer ».
- **Concurrence :** l'API \`match\` accepte les phases \`half-time\`,
  \`resume-ready\`, \`shootout-ready\`, \`shootout\` et \`finished\`
  et utilise le verrou de version du salon déjà en place.

Modules : \`opfc/online-endgame.mjs\`, \`opfc/online-match.mjs\`,
\`opfc/online-client.mjs\`, \`supabase/functions/opfc-online/index.ts\`.
Tests : \`opfc/tests/online-endgame.test.mjs\` et
\`opfc/tests/online-endgame-client.test.mjs\`.

**Reste le bloc 10A4 : raccordement des vraies interfaces iPhone et
déploiement/test réel d'un projet Supabase OPFC dédié après accord.**
Aucun projet Supabase ni site public n'a été modifié.
