# WealthPilot : reconstruction et design system

> **Prototype mis en attente — 2 octobre 2026.** Ce dossier reste une référence et n'est plus la base approuvée de reconstruction. Voir le [Brief WealthPilot](../../BRIEF_WEALTHPILOT.md), source de vérité des pages, calculs, interactions et étapes de livraison. Les fonctionnalités décrites ci-dessous appartiennent au prototype historique.

Date : 30 septembre 2026.
Statut : experience locale fonctionnelle, construite sur une base neuve.

## Decision directrice

Repartir d'une base neuve. L'ancien code, y compris import, calculs, stockage et mises a jour reactives, n'est pas une fondation approuvee ni un contrat a preserver. Il sert uniquement a documenter les besoins et les erreurs a ne pas reproduire. Les donnees personnelles sont preservees ; leur migration sera un chantier distinct et controle.

La priorite est une experience utilisable, pas une succession de pages en preconstruction. L'interface, ses calculs, son import et sa persistance sont neufs et independants de l'ancienne application. Aucun compte de l'ancienne base n'est lu, migre ou supprime.

## Contraintes de conception

- Dock inferieur comme navigation principale sur desktop et mobile ; pas de sidebar permanente.
- Canvas exploitant toute la largeur disponible et au moins toute la hauteur du viewport, sans reduire un grand screenshot avec une transformation d'echelle.
- Grilles Bento pour les pages : modules fonctionnels hierarchises, sans carte imbriquee dans une carte ni murs de petites statistiques.
- Images utilisees comme moodboard, jamais comme specifications a copier integralement.
- Composants definis par leur geometrie, variantes, donnees, interactions, etats et accessibilite.
- Chaque animation est justifiee et possede un protocole de test ; chaque absence d'animation est motivee lorsque pertinente.
- Aucune destination visible ne renvoie vers un wireframe ou une promesse de fonction future.
- Les chiffres, graphiques et libelles distinguent les donnees observees, les donnees fictives de conception et les hypotheses.

## Fonctions Livrees

Ouvrir [l'experience locale](experience.html) directement dans un navigateur. Le label Exemple distingue les donnees fictives du mode personnel Local. Mon foyer permet de renseigner les noms, puis le compte est cree avec son premier CSV, apres controle. Aucun compte ou mouvement bancaire n'est cree sans releve.

- Aujourd'hui : solde cumule, semaine navigable, categories, enveloppes et qualite des releves. Personnalisation inline des modules : ajouter, masquer, reordonner, redimensionner et choisir une presentation. Disposition conservee apres rechargement, separement des donnees financieres.
- Historique : recherche, categories, types, pagination, edition des annotations et de la classification, export CSV.
- Budget : plafond global, enveloppes en barres, anneaux concentriques ou tableau et comparaison des depenses cumulees au plafond. Toutes les depenses sont comptees, y compris sans enveloppe.
- Analyse : revenus, depenses, difference, evolution et categories ; marchands et bilan mensuel sont optionnels. Detail du jour dans le composant, sans redirection ni changement de periode.
- Partage : montant directionnel du remboursement pour tout le foyer, reglements importes deduits. Proportion des revenus CSV par defaut ; personnel, commun, 100 % pour une personne ou pourcentage par operation. Aucun ordre de paiement cree.
- Recurrents : detection depuis les repetitions CSV, estimation explicite, revue d'une transaction oubliee ou exclusion reversible. Aucune creation de charge, suspension ou resiliation bancaire.
- Comptes, Import et Foyer/sauvegardes : services fonctionnels, sans pages de preconstruction.

Periodes : mois courant, mois precedent, six mois, trimestre, annee ou dates libres. Chaque graphique a sa propre echelle Auto/Jour/Semaine/Mois/Trimestre. Les echelles qui ne produiraient qu'un seul intervalle sont desactivees ; Auto reste adapte a la duree. Un solde connu isole reste un point de courbe, pas une fausse tendance. La semaine a ses commandes precedent/suivant sans modifier la periode generale. Le choix de compte est dans le dock inferieur.

Aucune modale. Editeur compact sous la transaction, champs secondaires progressifs. Navigation, filtre ou pagination protègent le brouillon ; un changement confirme ferme le detail, sans injecter l'editeur dans une autre page. Les details et tableaux restent dans leur composant. Les instances ECharts sont preservees pendant les recalculs.

## Livrables de conception

1. [Design system implemente](workspace.css) : fondations nommees, grille, modules, controles, tableaux, edition inline et responsive.
2. [Tokens de reference](workspace.tokens.json) : palette claire neutre, dimensions et mouvement.
3. [Controleur de l'experience](workspace.js) : composants interactifs, parcours CSV et reactualisation des donnees.
4. [Calculs neufs](domain.js) et [tests persistants](domain.test.js) : periodes, soldes, budgets, partage et import.
5. [Verification actuelle](VERIFICATION.md) : resultats executes et limites verifiables.
6. [Scenarios navigateur reproductibles](workspace.browser.mjs) et [configuration Playwright](playwright.config.mjs) : vrais clics, survol, rechargement, imports prives et captures.

Police DM Sans, Lucide, ECharts et Papa Parse sont locaux. Aucune dependance reseau a l'ouverture. Les donnees sont conservees sous une cle localStorage propre a cet espace ; sauvegarde JSON complete et restauration avec confirmation inline. Ne pas confondre cette experience avec le serveur historique sur localhost:3000.

## Direction Visuelle

Le vert pastel a ete retire apres retour utilisateur. Fond neutre #F6F7FB, bleu vif, corail, jaune et accents secondaires. DM Sans remplace Instrument Sans. Les nouvelles references 5 et 6 servent a travailler le contraste et la hierarchie. Le total est au centre du donut ; un survol de secteur le remplace par le montant et le nom de la categorie. Aucune bulle ne couvre le centre.

Pour les graphiques temporels : tooltip borne, montant/date et repere pointille. Au clavier : fleches pour le point actif et Entree pour les valeurs tabulaires, sans dialogue. Les categories restent disponibles comme commandes et montants dans la legende.

## QA Reproductible

```sh
npx playwright install chromium
npm run qa:rebuild
npx vitest run specs/rebuild/domain.test.js
```

13 scenarios navigateur, dont trois imports complets des deux comptes a partir des sources privees retrouvees dans les dossiers voisins Account/data et life_os. Chaque source contient 1385 operations. Les XLSX sont lus en ZIP/XML avec les espaces de noms, leurs lignes de transactions sont converties en CSV en memoire pour tester le meme parcours ; aucun fichier personnel n'est ajoute au depot.

Les chemins peuvent etre remplaces avec REBUILD_CSV, REBUILD_FAMILY_XLSX et REBUILD_TREASURY_XLSX. Sans ces fichiers, les quatre tests de donnees privees sont explicitement ignores, pas declares passes. Captures et traces restent dans tmp/rebuild-qa. Les contextes navigateur de test sont isoles de la base utilisateur.

## Ce Qui Reste a Faire

Valider cette iteration visuelle avec l'utilisateur. La detection des recurrences reste heuristique et revisable, pas une preuve de contrat. L'import propose un compte source quand un consolide en contient plusieurs ; compte/IBAN existant reutilise, association explicite sinon. Les indicateurs internes et categories du consolide sont preserves/traduits sans inventer de mouvements bancaires.

Les lots d'import annulables, les regles de classification visibles et l'installation native restent des chantiers non livres. Aucune route vide n'est exposee pour ces fonctions. Les deux vrais Excel ont ete retrouves et leurs transactions testees. Leurs formules ne sont pas recalculees et leurs hypotheses de partage ne sont pas migrees automatiquement. Les tests d'import utilisent une ouverture nulle explicite : ils verifient les flux, pas les soldes bancaires observes.

## Convention type Figma

Organisation : Foundations, Components, Patterns, Screens, Flows, Validation.

Nommage des composants : `Famille/Composant` ; proprietes nommees et variantes explicites ; auto-layout conceptuel via contraintes de taille et grille ; frames desktop/mobile ; matrice des etats ; liens des parcours et annotations de comportement.

Ces livrables ne sont pas un fichier Figma natif. Ils doivent permettre de reconstruire la meme bibliotheque dans Figma ou dans un atelier de composants, sans inventer les details au moment de coder.

## Ordre de decision

Les anciens documents sont conserves comme archives, pas comme contrat des pages actuelles. L'experience et la verification ci-dessus font reference. Il ne s'agit pas d'un fichier Figma natif ni d'une certification bancaire universelle : les points de depart et observations bancaires doivent etre rapproches avant de se fier aux soldes personnels.
