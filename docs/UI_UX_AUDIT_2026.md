# WealthPilot — audit UI/UX exhaustif 2026

Date : 29 septembre 2026
Statut : audit en lecture seule, aucune correction incluse
Périmètre : toutes les routes produit, thèmes clair/sombre, desktop et mobile, composants partagés, graphiques, accessibilité, feedback, code UI et benchmark.

## Méthode

Trois audits spécialisés ont été menés en parallèle :

1. UI, design system et accessibilité : inspection visuelle de toutes les routes en clair/sombre, desktop et 390 × 844, puis audit des tokens, contrastes et composants.
2. UX produit et parcours : cartographie des fonctions et actions, audit heuristique, puis reconstruction des parcours « comprendre le foyer », « revenir à zéro », « importer deux comptes » et « suivre un objectif ».
3. Benchmark et code UI : comparaison avec les pratiques fintech actuelles, audit de l’architecture front, des graphiques et du responsive, puis définition du modèle cible.

Cela représente neuf passes spécialisées, consolidées ici en sept vagues de reprise et une validation finale.

## Verdict

WealthPilot possède déjà les briques importantes : traitement local, import guidé, multi-comptes, budgets, objectifs, analyse mensuelle et projection à treize semaines. Le problème principal n’est pas le manque de fonctionnalités, mais l’absence d’une vérité financière et d’un langage d’interface uniques.

Avant d’embellir le produit, il faut :

1. rendre les montants identiques entre toutes les pages ;
2. rendre le périmètre compte/foyer et la période toujours visibles ;
3. corriger les blocages mobile et accessibilité ;
4. construire un vrai système de design et de graphiques ;
5. refaire les pages autour des décisions de l’utilisateur, pas autour d’une accumulation de cartes.

## Preuves critiques observées

- Septembre, Dashboard : revenus 4 616 €, dépenses 5 624 €, net −1 009 €.
- Septembre, Analytics : revenus 4 401 €, dépenses 5 624 €, net −1 223 €.
- Goals reprend encore le net −1 009 € et un taux d’épargne de −22 %.
- Categories affiche 28 001,67 € de revenus sur douze mois contre 25 506 € dans Analytics YTD.
- Budgets traite 1 900 € de transferts comme de l’épargne dépensée.
- Subscriptions et Calendar affichent 0 €, alors qu’Analytics détecte 15 945 € d’habitudes récurrentes sur six mois.
- Le dock mesure environ 425 px dans un viewport de 390 px.
- Settings atteint environ 484 px de largeur sur ce même viewport et son contenu devient presque inaccessible.
- Sur Transactions, 101 contrôles sur 151 sont sans nom accessible.
- Le corail `#FF6B4A` avec texte blanc atteint seulement 2,82:1 ; le gris secondaire `#8E8E93` sur blanc 3,26:1.
- `success`, `warning`, `info`, `destructive` et `primary` utilisent actuellement la même couleur corail.

## Backlog consolidé

### P0 — confiance et usage bloqué

| Sujet | Effort | Reprise attendue | Critère d’acceptation |
|---|---:|---|---|
| Moteur financier commun | L | Une seule définition des revenus, remboursements, transferts internes, dépenses et exclusions pour Dashboard, Analytics, Goals, Categories, Budgets et Plan. | À période et périmètre identiques, tous les écrans affichent les mêmes revenus, dépenses et net ; contrat automatisé inter-pages. |
| Portée compte/foyer | M | Ajouter une barre de contexte persistante avec compte ou foyer, période, exclusions et fraîcheur des soldes. | Aucun libellé « foyer » en vue mono-compte ; le périmètre est visible avant tout chiffre. |
| Settings mobile | S | Corriger le layout horizontal en `flex-col` mobile puis `md:flex-row`. | Aucun scroll horizontal à 320/390 px ; navigation et contenu restent visibles. |
| Navigation mobile | M–L | Remplacer le dock de dix commandes par quatre ou cinq destinations et un menu « Plus », avec safe area. | Aucune troncature ni contenu masqué à 320/390/768 px. |
| Transactions accessibles | L | Remplacer la grille de `div` par une vraie table desktop et une liste mobile ; rendre les lignes et actions utilisables au clavier. | En-têtes, montant et actions annoncés au lecteur d’écran ; parcours complet clavier/tactile. |
| Récurrents multi-comptes | M | Auto-Detect doit analyser tous les comptes quand « Foyer » est actif ; un récurrent créé depuis une transaction conserve son compte source. | Résultat détaillé par compte et test sur le second compte. |
| Périmètre des budgets | M–L | Assumer explicitement un budget foyer ou ajouter un vrai périmètre par compte. | Budget et dépenses comparées couvrent exactement les mêmes comptes. |
| Palette accessible | M | Recalculer primaire/foreground et séparer vert, rouge, ambre, bleu et corail de marque. | Texte normal ≥ 4,5:1 ; composants et grands textes ≥ 3:1 en clair et sombre. |

### P1 — refontes majeures

| Surface | Niveau | Cible |
|---|---|---|
| Navigation globale | Refonte complète | Rail/sidebar desktop, barre de contexte, quatre destinations mobiles, recherche et confidentialité visibles, registre unique des routes. |
| Dashboard | Refonte complète | « Situation du foyer aujourd’hui », prochain risque, montant sûr jusqu’au prochain revenu, actions de la semaine, puis analyse secondaire. |
| Budgets | Refonte complète | Verdict unique, disponible réel, projection, sous-financement, catégories à arbitrer et action de réallocation. |
| Plan 13 semaines | Refonte complète | Objectif explicite, plancher de sécurité, prévu/réel, hypothèses visibles par scénario et budget hebdomadaire actionnable. |
| Calendar mobile | Refonte complète | Agenda chronologique mobile ; grille mensuelle seulement à partir de la tablette. |
| Transactions | Refonte majeure | Totaux filtrés, table accessible, liste mobile, file « à vérifier », édition en panneau, actions visibles et annulation. |
| Récurrents et subscriptions | Refonte complète | Un moteur unique et une inbox « confirmer/rejeter » alimentant Calendar, Upcoming Bills et le Plan. |
| Analytics | Refonte majeure | Une question par section, drill-down, tableau alternatif et qualité des données au lieu d’empiler tous les graphiques. |
| Thème | Fondation | Un seul provider ; aucun accès direct concurrent au DOM/localStorage ; aucune surface blanche au focus en sombre. |
| Feedback | Fondation | Pending/success/error sur chaque mutation, erreurs inline, confirmations uniformes et suppression annulable. |

### P2 — compréhension et cohérence

- Transactions : période visible, résumé et reset des filtres, actions toujours découvrables, suppression sans `window.confirm`.
- Goals : distinguer objectif virtuel et objectif lié à un compte ; expliquer chaque progression par des contributions réelles.
- Accounts : afficher fraîcheur, dernier import/checkpoint et institution ; traiter le compte orphelin à 0 €.
- Import : résumer compte cible, dates, ajoutés, doublons, erreurs, solde final et proposer immédiatement le second compte.
- Categories : séparer dépenses, revenus et transferts ; ajouter une file Unknown/faible confiance/transferts non appariés.
- Analytics : retirer `Unknown` et `Transfer Out` des insights finaux ou les transformer en actions de nettoyage.
- Settings : rendre effectifs le seuil de notification et le mois financier, ou retirer temporairement ces réglages.
- Langue : choisir le français par défaut ou mettre en place une locale ; ne plus mélanger français et anglais.
- PWA : aligner manifest, meta et tokens de marque.
- `/lab` : exclure les onze routes du build de production.

### P3 — qualité premium

- Virtualisation et chargement différé des listes/graphiques lourds.
- Suppression des composants morts et anciens systèmes de navigation.
- Reduced motion global.
- Micro-interactions limitées aux changements d’état utiles.
- Personnalisation d’accent uniquement avec validation automatique du contraste.

## Matrice page par page

| Page | Décision | Problème directeur |
|---|---|---|
| Dashboard | Refaire entièrement | Trop de cartes, chiffres hérités, ne répond pas à « que puis-je faire cette semaine ? ». |
| Transactions | Refaire interactions et mobile | Table non sémantique, actions cachées, nombreux contrôles anonymes. |
| Analytics | Conserver le moteur, refaire la présentation | Bonne vérité métier, mais page trop longue et graphiques sans drill-down/table accessible. |
| Budgets | Refaire entièrement | Verdicts contradictoires, transferts comptés comme dépenses d’épargne, graphe peu compréhensible. |
| Plan 13 semaines | Refaire entièrement autour de l’objectif | Bon moteur, mais cible par défaut trompeuse et absence de prévu/réel actionnable. |
| Goals | Refaire le modèle mental | Objectifs à zéro déconnectés de l’argent réel et de la trajectoire. |
| Goal detail | Corriger | Hiérarchie, activité, provenance des fonds et projection. |
| Subscriptions | Fusionner avec les récurrents | Détections concurrentes et faux écran à zéro. |
| Calendar | Refaire mobile, enrichir desktop | Grille illisible sur téléphone et absence des revenus prévus. |
| Accounts | Refaire mobile | Colonnes silencieusement coupées et confiance/checkpoints cachés. |
| Import | Conserver et renforcer | Parcours le plus clair, mais manque le résumé de contrôle et le second compte. |
| Categories | Refaire l’architecture de l’information | Transferts dominants, chiffres incompatibles et page cachée de la navigation. |
| Settings | Corriger immédiatement puis refondre | Layout mobile cassé, thème double et réglages sans effet. |
| Lab | Retirer de production | Dix directions visuelles incompatibles livrées comme routes produit. |

## Direction visuelle cible

Nom de travail : **Calm Financial Control**.

- Corail conservé comme accent de marque et CTA principal, pas comme couleur universelle.
- Vert : revenu/succès ; rouge : dépense/erreur ; ambre : risque ; bleu : information/prévision.
- Fond légèrement teinté, surfaces moins nombreuses et hiérarchie plus nette.
- Typographie 14–16 px pour le contenu ; 12 px uniquement pour les métadonnées.
- Chiffres tabulaires, séparateurs et précision cohérents.
- Espacement unique 4/8/12/16/24/32/48.
- Rayons : 8 px contrôles, 12 px cartes, 16 px grandes surfaces.
- Ombre seulement pour overlay ou interaction réelle.
- Glass limité au shell flottant, jamais derrière les tableaux financiers.
- Synthèse d’abord, détails ensuite par panneau, drill-down ou vue dédiée.

## Navigation cible

```text
Vue d’ensemble
  Aujourd’hui

Activité
  Transactions
  Calendrier
  Récurrents

Planifier
  Budget
  Objectifs
  Plan 13 semaines

Organiser
  Comptes
  Catégories
  Import

Système
  Réglages
```

Mobile : Aujourd’hui, Transactions, Budget, Plan, Plus.
Barre persistante : Foyer/compte, période, recherche, confidentialité, notifications.

## Bibliothèque cible

- `PageHeader`, `ScopeBar`, `MetricCard`, `MoneyValue`, `DeltaBadge`, `StatusBadge`
- `ActionBanner`, `FilterToolbar`, `FilterChip`, `DateRangePicker`
- `ResponsiveDataTable`, `MobileRecordList`, `DetailsDrawer`
- `ChartCard`, `ChartTooltip`, `ChartLegend`, `ChartDataTable`
- `ConfirmDialog`, `UndoToast`, `EmptyState`, `InlineError`, `Skeleton`

## Contrat de chaque graphique

Chaque graphique doit déclarer :

1. la question à laquelle il répond ;
2. le périmètre et la période ;
3. les exclusions ;
4. la métrique et l’unité ;
5. une conclusion textuelle ;
6. un tooltip commun ;
7. une alternative tabulaire ;
8. un drill-down ;
9. les états vide, chargement et erreur ;
10. une palette accessible en clair et sombre.

## Sept vagues de reprise

### Vague 1 — vérité et confiance

Unifier les calculs, portées, soldes et définitions. Corriger les rattachements multi-comptes et ajouter les tests de contrat inter-pages.

### Vague 2 — responsive bloquant

Corriger dock, Settings, tables, dialogs et Calendar mobile. Valider 320, 390, 768, 1024 et 1440 px.

### Vague 3 — accessibilité

Contrastes, noms accessibles, clavier, focus, langue, zoom 200 %, reduced motion et alternative aux graphiques.

### Vague 4 — fondations UI

Tokens sémantiques, échelles de typo/spacing/radius/elevation, registre des routes, shell, composants de données et feedback.

### Vague 5 — cœur du produit

Refaire Dashboard, Transactions, Budgets, Analytics et Plan treize semaines autour des décisions et du drill-down.

### Vague 6 — planification et organisation

Refaire Goals, Récurrents, Calendar, Accounts, Categories, Import et Settings sur les fondations communes.

### Vague 7 — qualité premium

Performance, virtualisation, code splitting, suppression du code mort, animations utiles et cohérence PWA.

### Validation finale indépendante

- Snapshots clair/sombre aux cinq largeurs.
- Parcours clavier complet et zoom 200 %.
- Axe sans erreur critique.
- Console sans warning Recharts.
- États vide/partiel/extrême/multi-comptes/10 000 transactions.
- Contrat de cohérence des montants sur toutes les pages.
- Test des quatre parcours : comprendre le foyer, revenir à zéro, importer deux comptes, suivre un objectif.

## Benchmark retenu

- [Monarch Money — Cash Flow](https://help.monarch.com/hc/en-us/articles/20504904768020-Cash-Flow)
- [Monarch Money — Budget](https://help.monarch.com/hc/en-us/articles/360048883631-Understanding-Your-Budget-in-Monarch)
- [Monarch Goals 3.0](https://help.monarch.com/hc/en-us/articles/44373110771860-Introducing-Goals-3-0)
- [YNAB — Features](https://www.ynab.com/features)
- [YNAB — Targets](https://support.ynab.com/how-to-use-targets-rk5kkI9ks)
- [Copilot Money — Dashboard](https://help.copilot.money/en/articles/6045480-dashboard-tab-overview)
- [Copilot Money — Cash Flow](https://help.copilot.money/en/articles/9682232-cash-flow-tab-overview)
- [Lunch Money — Features](https://lunchmoney.app/features)
- [Actual Budget](https://actualbudget.org/)
- [WCAG 2.2](https://www.w3.org/TR/wcag/)
- [IBM Data Visualization](https://www.ibm.com/design/language/data-visualization/overview/)
- [Apple — Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)
- [Google — Material 3 Expressive research](https://design.google/library/expressive-material-design-google-research)

## Ordre de décision recommandé

Le prochain chantier ne doit pas être « rendre les cartes plus belles ». Il doit commencer par la vague 1 puis la vague 2. Une fois les chiffres cohérents et le produit réellement utilisable sur mobile, la direction Calm Financial Control pourra être appliquée sans repeindre des parcours encore contradictoires.
