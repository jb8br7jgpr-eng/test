# OPMercato FC — développement v0.8

Branche de travail indépendante de `main`. Les modes local et en ligne utiliseront exactement les mêmes règles et les mêmes modules. **Cette branche ne constitue pas une version jouable et n’est pas déployée sur GitHub Pages.**

Référence unique : `OPMercato_FC_Dossier_de_conception_v08(1).pdf` du 19 octobre 2026.

## Modules disponibles

- `catalog.mjs` : les 50 personnages officiels, 7 groupes, 6 statistiques, poste et rareté (§07–09).
- `rules.mjs` : notes par poste, malus de stats en match, entente, sept formations, puissance des six joueurs de champ, calendrier de 10 à 12 séquences (§03–05, §15–18).
- `engine.mjs` : deux clubs, dés initiaux, mercato 250 M, 7 recrues, réserve obligatoire, enchères, refus, Haki des Rois, Haki de l’Observation, placement manuel, validation des équipes (§14–15A).
- `tests/engine.test.mjs` : tests automatisés et campagne de 500 calendriers.

## Vérifier

```bash
node --test opfc/tests/engine.test.mjs
```

## Sécurité et séparation

Aucun module OPMercato classique n'est importé. Le paquet des cartes futures ne doit **jamais être envoyé aux clients en ligne** : utiliser la vue publique expurgée ; l’Observation fait l’objet d'une réponse privée contrôlée côté serveur. Les règles ne doivent pas être validées uniquement dans le navigateur en mode en ligne.

## Prochaines étapes, avant toute activation du bouton Jouer

1. Moteur complet de résolution des actions de match, finitions, fautes, phases arrêtées, penalties, tirs au but (§19–32C).
2. Interface iPhone premium, personnages temporaires puis illustrations plus tard.
3. Fonction Supabase **spécifique à OPFC** et état des salles stocké séparément, décisions secrètes et contrôle des tours côté serveur, reconnexion.
4. Tests de partie complète en local puis sur deux téléphones, corrections et seulement ensuite publication.

OPMercato classique, son backend et l’accueil public restent inchangés.
