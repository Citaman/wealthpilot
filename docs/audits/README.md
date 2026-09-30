# Index des audits exhaustifs UI/UX

Ces trois rapports remplacent l'audit synthétique initial comme source de travail détaillée.

| Rapport | Spécialité | Volume | Contenu principal |
|---|---|---:|---|
| [UI_COMPONENT_AUDIT.md](./UI_COMPONENT_AUDIT.md) | UI, design system, accessibilité visuelle | 829 lignes / 17 137 mots | Registre contrôle par contrôle, thèmes, breakpoints, géométrie, contrastes, états et critères d'acceptation |
| [UX_INTERACTION_AUDIT.md](./UX_INTERACTION_AUDIT.md) | UX produit et fonctionnement | 847 lignes / 17 415 mots | Parcours et actions, attendu/observé, PASS/FAIL/AMBIGU, contradictions, feedback et backlog de 100 items |
| [CODE_DESIGN_BENCHMARK_AUDIT.md](./CODE_DESIGN_BENCHMARK_AUDIT.md) | Code UI, architecture et benchmark | 453 lignes / 7 523 mots | Primitives et composants, dette front, benchmark officiel, architecture cible et 20 PR atomiques |

Total des rapports spécialisés : **2 129 lignes, 42 075 mots et environ 253 Ko**.

## Couverture vérifiée

- dix passes documentées par agent ;
- tests réels sur `localhost:3000` ;
- 24 fichiers de pages recensés, routes laboratoire comprises ;
- 102 fichiers de composants explicitement référencés dans au moins un rapport ;
- thèmes clair et sombre ;
- desktop, tablette et mobile, dont 390 px ;
- états chargement, vide, erreur, succès, disabled, hover et focus selon leur disponibilité ;
- navigation, boutons, menus, filtres, dialogues, tableaux, formulaires et graphiques ;
- recommandations, sévérité, effort et critères d'acceptation.

## Ordre de lecture recommandé

1. Commencer par l'audit UX pour comprendre les erreurs de fonctionnement et de décision.
2. Utiliser l'audit UI comme registre détaillé des surfaces à corriger.
3. Utiliser l'audit code/design pour organiser les fondations et les lots d'implémentation.

Le fichier [`../UI_UX_AUDIT_2026.md`](../UI_UX_AUDIT_2026.md) reste une synthèse stratégique courte ; il ne remplace pas ces registres composant par composant.
