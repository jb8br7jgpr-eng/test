# OPFC — Intégration isolée, non déployée (25/10/2026)

**Ne jamais modifier OPMercato classique. Ne pas fusionner sur main ni publier sans l'accord explicite de l'utilisateur.**

## Périmètre intégré sur la branche
- Finitions du jeu ouvert uniquement : 3 contextes x 3 tirs x 3 réactions avec probabilités calibrées, sans toucher aux corners/coups francs/penalties/TAB.
- ⭐ « Tir conseillé » calculé sans tirage à partir des stats effectives du tireur et du gardien ; **visible seulement au tour du tireur**. Aucun secret adverse exposé.
- Libellés gardien : Rester sur sa ligne, Réduire l’angle, Plongeon anticipé ; mêmes IDs tactiques.
- Écran unique de but réglementaire compact : type de réalisation, minute, buteur, passeur réel si présent, score et écussons, aura et projecteurs aux couleurs du stade, sans confettis ; pas de son. Animation une seule fois par résultat et non à chaque mise à jour des acquittements.
- Double validation du but en local ; l'acquittement mutuel en ligne est réutilisé.
- Revanche : local une relance ; en ligne deux accords dans le même salon et possibilité de refuser. Formations et slots finaux identiques, mêmes clubs/stade/compétition/personnages. Nouveau calendrier/score/stats/UUID.
- Sauvegarde locale précédente placée en file persistante avant la revanche.
- En ligne, le déclencheur de résultat doit adopter une clé par **match officiel**, et non par salon.

## Bloqueur volontaire AVANT toute production
Le script `supabase/migrations-opfc-v3/03-rematch-final-id-DRAFT.sql` est un **brouillon non exécuté**.
Avec la fonction SQL de production existante, deux matchs dans un même salon partageraient la clé `online:<room-id>` : les revanches ultérieures ne seraient pas comptées. Le site et l'Edge Function **ne doivent pas être déployés avant d'avoir validé ce SQL et son pré/postflight**.

## Ordre d'activation ultérieur (sur accord exprès)
1. Vérifier et appliquer la migration SQL OPFC, en transaction, avec contrôle des triggers d'INSERT.
2. Mettre à jour **uniquement** l'Edge Function OPFC sur le projet OPFC dédié.
3. Vérifier les deux résultats successifs du même salon : clés distinctes, statistiques personnages + clubs + Hall + Ancre + palmarès, sans doublon.
4. Fusionner les fichiers OPFC/UI de la branche sur main et publier GitHub Pages OPFC.
5. Tester sur iPhone en local et deux appareils en ligne, avec requêtes doublons/reconnexions/absence de réseau, y compris après un résultat à 0–0 et TAB.

## Vérifications automatiques
Workflow spécifique à la branche `.github/workflows/opfc-integration-20261025.yml`.
- Syntaxe JS des modules OPFC locaux/serveur.
- Tests de probabilités sur 75 cartes et 20 412 combinaisons.
- Revanche : équipes, slots finaux, refus, doubles confirmations.
- Interface : détails de but et deux acquittements locaux.
- Tests OPFC V2, rééquilibrage, V3 statistiques et V3 visuels.
Ces tests ne remplacent **pas** un vrai test de partie entière avec navigateur et serveur déployé.

## Points à surveiller
- Mise en page sur petits écrans iPhone : hauteur proche du panneau existant.
- Secret du tir conseillé après passage du téléphone, et jamais du côté gardien en ligne.
- Première finale, seconde finale et éventuelle troisième finale enregistrées **exactement une fois**.
- Les TAB de départage ne doivent pas augmenter les buts ou tirs réglementaires des personnages.
