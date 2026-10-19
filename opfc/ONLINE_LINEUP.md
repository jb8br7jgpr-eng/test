# OPFC — bloc 10A3B1 : compositions et coup d'envoi en ligne

**Statut : code de préparation sur \`opfc-development\`, non déployé.**
La branche \`main\`, le jeu classique et les projets Supabase existants sont préservés.

## Actions autorisées par le serveur

\`POST {action:"lineup",roomId,token,expectedVersion,command}\`

- \`{type:"formation",formation:"3-2-1"}\` — modification de la formation de **son club seulement**, avant confirmation.
- \`{type:"place",cardId:"luffy",slot:1}\` — placement ou échange de deux cases de **son club seulement**.
- \`{type:"ready"}\` — verrouille la composition validée et attend l'autre club.
- \`{type:"kickoff"}\` — réservé au club de l'hôte quand **les deux équipes ont confirmé**.

Les transitions utilisent \`engine.mjs\` et \`match.mjs\` communs au local.
Le calendrier de 10 à 12 séquences est généré **côté serveur** avec
\`crypto.getRandomValues\`, sans option de calendrier fournie par le client.

## Synchronisation des deux iPhone

- Le serveur déduit l'acteur grâce au jeton de session, jamais d'un champ \`club\` dans le POST.
- Chaque action inclut \`expectedVersion\`; l'écriture serveur suit le même
  contrôle de version atomique (compare-and-swap) que les enchères.
- Le client peut \`refreshRoom()\` et \`lineupAction(command)\`.
- Les réponses \`GET\` et \`lineup\` renvoient une **vue blanche** : pendant
  les compositions, les cartes acquises et placements ; au coup d'envoi, le
  score 0–0 et la prochaine action, sans révéler le calendrier complet,
  le paquet, le curseur, le Haki d'Observation ni les jetons.
- Les compositions deviennent non modifiables après validation, sauf les
  mécanismes distincts de mi-temps (à intégrer au bloc suivant).

## Limites de ce bloc

Le match n'est **pas encore pilotable en ligne** : le moteur est déclenché
au coup d'envoi, mais les tactiques secrètes, les phases arrêtées, la mi-temps
et les tirs au but restent à synchroniser dans 10A3B2.

L'interface de salon et le client en ligne sont préparés, mais l'écran iPhone
n'est pas encore raccordé à la vue réseau du match. Aucun serveur OPFC n'a
été créé ou déployé.

Tests prévus : \`opfc/tests/online-lineup.test.mjs\` et
\`opfc/tests/online-lineup-client.test.mjs\`.
