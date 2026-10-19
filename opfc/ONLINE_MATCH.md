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
