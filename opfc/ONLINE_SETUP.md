# OPFC — Serveur privé indépendant (Supabase)

## Installation effective

- Organisation existante, projet **OPMercato FC** : `cihzwaxernachchpjktj`
- Région : Paris (`eu-west-3`)
- État Supabase : actif
- Schéma appliqué : `opfc_initial_private_rooms` depuis `supabase/opfc-schema.sql`
- Table : `public.opfc_rooms` — état maître privé, jetons hachés, version atomique, date d'expiration
- Sécurité : RLS active, droits publics / anon / authenticated révoqués, accès `service_role` exclusivement côté fonction Edge
- Fonction Edge déployée : `opfc-online`, avec `verify_jwt=false` pour autoriser création et jonction anonymes, puis contrôle strict des jetons pour les actions privées.
- Origine navigateur acceptée : `https://jb8br7jgpr-eng.github.io`
- URL utilisée par le client de développement : `https://cihzwaxernachchpjktj.supabase.co/functions/v1/opfc-online`
- Aucune clé `service_role` n'est présente sur GitHub ni dans le JavaScript du navigateur.

La fonction embarque les vingt modules `opfc/*.mjs` nécessaires au moteur. Lors d'une mise à jour du serveur, reprendre les sources du commit approuvé, actualiser si nécessaire `supabase/functions/opfc-online/edge-deploy-pack.json` (qui conserve deux modules en copie) et redéployer seulement dans ce projet.

### Test de connexion réel

La CI `OPFC - smoke test Supabase réel` a réussi :
1. Création d'un salon, génération du code et du jeton privé.
2. Connexion d'un deuxième joueur et relecture des deux vues filtrées.
3. Première enchère officielle, application de `expectedVersion` et synchronisation entre les joueurs.
4. Rejet d'une commande sur une ancienne version (409) et d'un jeton non autorisé (403).
5. Aucun paquet secret de personnages ni jeton adverse exposé dans les réponses publiques.

Ce test HTTP prouve que le backend répond, mais **pas encore** qu'un match complet a été joué sur deux vrais iPhone.

## Isolation impérative

- **OPMercato classique** : projet `nezqupnhcqwuewfilioa`, reste actif et inchangé.
- **ARCHIPEL** : projet `lrmgtnbxujdvswaykyxi`, mis en pause, non supprimé.
- **OPFC** : seul projet sur lequel les migrations et fonctions OPFC peuvent s'exécuter.

## À faire avant le lancement public

1. Mettre en place une limitation de fréquence anti-abus pour les créations et entrées anonymes. Le contrôle CORS ne suffit pas contre les scripts non navigateurs.
2. Recette en réseau réel à deux iPhone, du premier mercato jusqu'au résultat final, avec rechargement, pauses et déconnexions.
3. Évaluer les performances et les éventuels quotas de l'offre gratuite Supabase.
4. Publication sur GitHub Pages et éventuelle fusion avec `main` **uniquement après autorisation explicite**.

**Le backend a été installé avec accord. Le site local/en ligne n'a pas encore été rendu public.**
