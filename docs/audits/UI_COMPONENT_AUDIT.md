# WealthPilot — audit UI composant par composant

**Date de recette :** 29 septembre 2026
**Application testée :** `http://localhost:3000`
**Référentiel :** WCAG 2.2 AA, navigation clavier, responsive 390 px / tablette / grand écran, thèmes clair et sombre
**Nature du document :** audit uniquement. Aucun correctif produit n'a été appliqué.

## 1. Verdict exécutif

WealthPilot possède une base visuelle propre et plutôt cohérente (Inter, cartes arrondies, nombres tabulaires, dock commun, composants Radix), mais ne peut pas encore être considéré comme une interface financière fiable et accessible. Les défauts les plus graves ne sont pas décoratifs : ils changent le sens de l'information ou empêchent l'usage.

1. **P0 — projection trompeuse dans le plan 13 semaines.** Sans dépenses configurées, les revenus par défaut créent un solde final de `16 342 €`, affichent « Target reached » et « December target is covered ». Un utilisateur en difficulté peut interpréter cela comme une prévision réelle. Source : `src/app/plan/page.tsx`.
2. **P0 — route Accounts blanche après navigation directe dans la session de recette.** Le serveur renvoie bien un HTML complet (HTTP 200), mais le rendu client Chrome devient entièrement blanc, dock compris. Le même phénomène est apparu ensuite sur `/import`. C'est un défaut runtime/hydratation intermittent à reproduire avec les logs navigateur, pas une absence de HTML serveur.
3. **P1 — Settings est cassé à 390 px.** La colonne de contenu déborde : `bodyScrollWidth = 484 px` pour un viewport de 390 px ; le titre est rejeté vers la droite. Cause visible : `flex gap-8` sans empilement responsive dans `src/app/settings/page.tsx:132`.
4. **P1 — dock mobile rogné.** À 390 px, le dock mesure environ 425 px (`left=-20`, `right=405`) : les extrémités sont coupées et les cibles deviennent difficiles.
5. **P1 — contrastes de l'accent et du texte secondaire insuffisants en clair.** `#FF6B4A` sur blanc = **2,82:1** et `#8E8E93` sur blanc = **3,26:1**. Le texte normal et les libellés d'action ne satisfont pas 4,5:1. Tous les presets d'accent proposés échouent avec un premier plan blanc pour du petit texte.
6. **P1 — états sémantiques indifférenciés.** `success`, `warning`, `info` et `destructive` utilisent la même famille corail (`globals.css:17-24`, `70-76`). Une alerte, un succès et une erreur sont visuellement confondus.
7. **P1 — nombreuses actions icône sans nom accessible.** Précédent/suivant du calendrier, menus de catégories et d'objectifs, édition/suppression de comptes et pastilles de couleur sont annoncés « button » seulement.
8. **P1 — tables non responsives.** Accounts impose `minmax(240px,2fr) 140px 140px 140px 100px` dans un conteneur `overflow-hidden`; à 390 px, les colonnes sont coupées sans défilement.
9. **P1 — budgets vides faussement positifs.** Avec zéro revenu et zéro budget, la page affiche « On Track », « Well under budget! Great job! » et « All Good ». L'absence de données est traitée comme une réussite.
10. **P2 — densité et hiérarchie irrégulières.** 374 occurrences de `text-xs`/10/11 px, de grandes surfaces vides sur desktop, des cartes statiques qui réagissent au survol et des titres de détail Goal en `h2` au lieu de `h1` affaiblissent la lecture.

## 2. Méthode, sévérité et limites de sûreté

### Niveaux

| Niveau | Définition | Délai conseillé |
|---|---|---|
| P0 | Blocage, écran blanc, ou information financière susceptible d'induire une décision dangereuse | Avant toute utilisation réelle |
| P1 | Fonction essentielle très difficile, inaccessible ou trompeuse | Prochain lot correctif |
| P2 | Friction importante, incohérence, dette responsive/design system | Itération suivante |
| P3 | Polissage, préférence, optimisation | Backlog |

**Effort :** S = moins d'un jour ; M = 1 à 3 jours ; L = chantier transversal.

### Règles de recette

- Les contrôles de navigation, filtres, onglets, menus, thèmes, périodes et dialogues ont été manipulés réellement.
- Les actions irréversibles ou mutantes — import final, création/suppression de données, restauration, reset, auto-détection écrivant en base — ont été arrêtées avant soumission. Leur état, leur libellé, leur garde et leur source ont été inspectés.
- Deux profils ont été observés : état vide propre de Chrome et données déjà peuplées dans la session initiale. Le profil vide a révélé des états que les données réelles masquaient.
- Les routes `/lab/*` sont des prototypes internes, pas des routes de production dans la navigation ; elles sont recensées séparément et exclues du registre fonctionnel de production.
- Pendant la recette, la compilation à chaud évoluait dans un dépôt modifié en parallèle. L'écran blanc Accounts/Import est donc marqué **à reproduire**, mais reste P0 tant que l'origine n'est pas isolée.

## 3. Journal des dix passes

| Passe | Travail réel effectué | Résultat / preuve |
|---|---|---|
| 1 — inventaire | Inventaire des routes `page.tsx`, du dock, des sections, contrôles, dialogues et états conditionnels. Lecture croisée des pages et composants enfants. | 15 routes de production (dont 6 détails Goals) et tous les contrôles visibles recensés ci-dessous. |
| 2 — desktop clair | Parcours navigateur en grand écran : Dashboard, Transactions, Analytics, Budgets, Plan, Goals + 6 détails, Subscriptions + 5 onglets, Calendar, Accounts/Import, avec ouverture de dialogues sûrs. | États vides, cartes, tableaux, onglets et dialogues consignés. Accounts/Import ont révélé l'écran blanc après navigation directe. |
| 3 — desktop sombre | Bascule réelle du thème via le dock sur Transactions et revue des tokens/écrans. | Fond et cartes restent lisibles ; accent blanc/corail demeure insuffisant ; champs peuvent forcer un fond blanc au focus. |
| 4 — mobile 390 clair | Mesures réelles des largeurs, inspection Settings, Calendar, Accounts, Transactions et dock. | Débordement Settings 484 px, dock 425 px, table Accounts coupée, calendrier trop dense. |
| 5 — mobile 390 sombre | Revue des mêmes structures en sombre, des surfaces, champs, dock et contrastes. | Le texte secondaire sombre passe (environ 6,17:1), mais l'accent clair sur blanc/foreground et le focus blanc des champs restent incohérents. |
| 6 — tablette / large desktop | Comparaison des grilles à leurs breakpoints et du grand écran 2400×2160. | Sur desktop, cartes et listes s'étalent avec beaucoup de vide ; sur tablette, tables à colonnes fixes ne s'adaptent pas ; le dock reste une largeur intrinsèque. |
| 7 — typographie / géométrie | Audit Inter, niveaux de titres, tabular nums, 10/11/12 px, espacements, alignements, rayons, ombres, icônes. | Hiérarchie globalement stable, mais petits textes surutilisés, titres Goals incorrects, marges/dialogues et affordances hover incohérents. |
| 8 — couleurs / sémantique / graphiques | Calculs de contraste, revue des tokens, palettes et graphiques Recharts. | Plusieurs échecs AA ; succès/alerte/erreur identiques ; graphiques monochromes et avertissements Recharts `width(-1)/height(-1)`. |
| 9 — états interactifs | Ouverture/fermeture des menus et dialogues, changement d'onglets et périodes, hover/focus/disabled/loading/empty/error/success par UI et source. | Actions hover-only, noms accessibles manquants, feedback implicite dans Budgets Settings, plusieurs états vides trompeurs. |
| 10 — cohérence / validation croisée | Croisement navigateur ↔ source ↔ responsive ↔ thèmes ; validation que chaque route et contrôle connu possède une entrée. | Matrices et registre ci-dessous ; aucun fichier produit modifié. |

## 4. Matrice de couverture

Légende : **✓** testé visuellement/manipulé ; **S** vérifié dans la source ou SSR ; **N/A** état impossible sans donnée ; **R** à reproduire à cause d'un écran blanc runtime ; **—** non applicable.

| Route | Clair desktop | Sombre desktop | 390 clair | 390 sombre | Tablette/large | Vide | Peuplé | Dialogues/menus | Source |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `/` Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/transactions` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/analytics` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| `/budgets` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ Settings | ✓ |
| `/plan` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | S | — | ✓ |
| `/goals` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ New/menus | ✓ |
| `/goals/1` à `/goals/6` | ✓ | S | S | S | ✓ | ✓ | N/A | ✓ tabs/menu | ✓ |
| `/subscriptions` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | S | ✓ 5 tabs + Add | ✓ |
| `/calendar` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ mois/jours | ✓ |
| `/accounts` | R + SSR | R | ✓ ancien état | ✓ ancien état | S | SSR ✓ | ✓ ancien état | S Add/Edit/Delete | ✓ |
| `/import` | R + SSR | R | ✓ ancien état | S | S | ✓ | ✓ preview antérieure | S étapes | ✓ |
| `/categories` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ Add/menu | ✓ |
| `/settings` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ sections/dialogues sûrs | ✓ |

## 5. Registre global des composants

Chaque ligne contient explicitement route/nom/source/variantes/comportement/sévérité/contexte/recommandation/critère d'acceptation.

| ID | Route / composant visible | Source | Variantes testées | Comportement et constat | Sev./effort | Thème / breakpoint | Recommandation | Critère d'acceptation |
|---|---|---|---|---|---|---|---|---|
| G-01 | Toutes — conteneur AppLayout | `src/components/layout/app-layout.tsx` | toutes routes, vide/peuplé | PASS : titre et sous-titre cohérents ; padding desktop généreux. `pb-28` réserve le dock. | PASS | clair/sombre, desktop | Conserver ; réduire éventuellement la largeur de lecture sur pages textuelles. | Aucun contenu n'est masqué par le dock à 320–2560 px. |
| G-02 | Toutes — dock fixe | `src/components/layout/command-dock.tsx:247` | desktop + 390, clair/sombre | Largeur intrinsèque ~425 px à 390 ; déborde de 15–20 px. | P1/M | mobile, deux thèmes | Mode mobile compact : 4 destinations + More, `max-width:calc(100vw - 16px)`, scroll ou labels masqués. | À 320/360/390 px, dock entièrement visible, cibles ≥44 px, aucune collision. |
| G-03 | Dock — Dashboard | `command-dock.tsx` | clic/navigation | PASS : nom accessible et destination correcte. | PASS | tous | Conserver. | Annoncé « Dashboard », état actif perceptible visuellement et via `aria-current`. |
| G-04 | Dock — Transactions | idem | clic/navigation | PASS navigation ; contrôle compact à 36 px. | P2/S | mobile | Porter la cible tactile à 44 px. | Cible réelle ≥44×44 px. |
| G-05 | Dock — Analytics | idem | clic/navigation | PASS navigation. | P2/S | mobile | Même correction tactile. | Cible ≥44 px et `aria-current`. |
| G-06 | Dock — Budgets | idem | clic/navigation | PASS navigation. | P2/S | mobile | Même correction tactile. | Idem. |
| G-07 | Dock — Goals | idem | clic/navigation | PASS navigation. | P2/S | mobile | Même correction tactile. | Idem. |
| G-08 | Dock — 13-week plan | idem | clic/navigation | PASS navigation, mais langue différente du contenu français. | P2/S | tous | Choisir une langue produit unique ou localisation complète. | Navigation et page utilisent la même locale. |
| G-09 | Dock — More navigation | `command-dock.tsx:268` | popup ouvert | PASS d'ouverture ; sert à Calendar, Accounts, Import, Categories, Subscriptions, Settings. Sur mobile, extrémité proche du bord. | P2/S | mobile | Contraindre et repositionner le popover dans le viewport. | Popover visible à 320 px, focus piégé et retour au déclencheur. |
| G-10 | More — Calendar | `command-dock.tsx` | navigation | PASS. | PASS | tous | Conserver. | Destination et état actif corrects. |
| G-11 | More — Accounts | idem | navigation | La navigation directe a produit un écran blanc runtime. | P0/M | desktop session de recette | Capturer erreur console/hydratation, test E2E direct-route et client-nav. | `/accounts` rend 10/10 rechargements et navigations, dock compris. |
| G-12 | More — Import | idem | navigation | Même écran blanc après incident Accounts. | P0/M | desktop session de recette | Vérifier chunks/HMR/contextes IndexedDB et ajouter ErrorBoundary. | `/import` n'est jamais blanc ; erreur récupérable affichée. |
| G-13 | More — Categories | idem | navigation | PASS. | PASS | tous | Conserver. | Destination correcte. |
| G-14 | More — Subscriptions | idem | navigation | PASS. | PASS | tous | Conserver. | Destination correcte. |
| G-15 | More — Settings | idem | navigation | PASS desktop ; page déborde mobile. | P1/M | 390 | Corriger structure Settings, voir SET-02. | Aucun overflow horizontal. |
| G-16 | Dock — Notifications | `command-dock.tsx:299-355` | popup vide/ouvert | Nom accessible présent. État vide lisible ; badge 10 px trop petit. | P2/S | tous | Badge ≥12 px, message vide et bouton « Mark all read » seulement si pertinent. | Nom accessible, compteur lisible, clavier complet. |
| G-17 | Dock — Toggle theme | `command-dock.tsx:369` | clic clair→sombre | PASS fonctionnel. Libellé ne dit pas la destination (« passer en sombre »). Possible flash initial via `useEffect`. | P2/S | tous | Libellé dynamique + initialisation avant paint. | Pas de flash ; annonce « Activer le thème sombre/clair ». |
| G-18 | Dock — Account switcher | `command-dock.tsx:386-434` | popup ouvert | Affiche compte courant et comptes ; taille/densité correcte. Risque de libellés tronqués. | P2/S | mobile | Largeur max viewport, marque claire du compte actif. | Tous comptes atteignables clavier, actif annoncé. |
| G-19 | Recherche globale / commande | `command-dock.tsx:439-551`, `use-command-search.ts` | Cmd/Ctrl+K/source | Recherche riche mais aucun déclencheur évident dans le dock principal ; fonctionnalité cachée. | P2/M | tous | Ajouter bouton Recherche visible, raccourci dans tooltip et états zéro résultat. | Découvrable sans connaître le raccourci ; résultat activable clavier. |
| G-20 | Confidentialité | `src/components/layout/header.tsx:284` | source / ancien header | Fonction présente dans Header, pas exposée clairement dans le dock courant. | P2/M | tous | Intégrer un contrôle cohérent dans le shell unique et persister l'état. | Masquage de tous montants sur toutes routes, annonce claire. |
| G-21 | Titres/page headings | `app-layout.tsx`, pages | toutes pages | Majorité en `h1`; Goal detail commence en `h2`. | P2/S | tous | Un `h1` unique par route et hiérarchie sans saut. | Audit axe : un h1 par page, niveaux ordonnés. |
| G-22 | Cartes | `src/components/ui/card.tsx:13` | statique/cliquable, thèmes | Toutes les cartes prennent une ombre au survol, même sans action : fausse affordance. | P2/S | desktop | Réserver hover/elevation aux cartes interactives. | Carte statique inchangée au hover ; carte cliquable a focus et curseur. |
| G-23 | Boutons | `src/components/ui/button.tsx:8-35` | primary/outline/ghost/icon/disabled | Système cohérent, mais `sm` 36 px et icônes 32–36 px sous 44 px tactile. | P2/M | mobile | Tailles tactiles séparées des tailles visuelles. | Tous contrôles tactiles ≥44×44 px. |
| G-24 | Inputs/Textarea | `ui/input.tsx:24`, `textarea.tsx:11` | focus/disabled/error, sombre | `focus-visible:bg-white` force une surface blanche en sombre ; erreur en petit corail. | P1/S | sombre | Utiliser `focus-visible:bg-background/card`, token erreur contrasté. | Aucun flash blanc ; texte/erreur ≥4,5:1. |
| G-25 | Select/menu/dialog | `ui/select.tsx`, `dropdown-menu.tsx`, `dialog.tsx` | ouvert/fermé/clavier/source | Base Radix solide. Dialog `w-full max-w-lg` sans marge explicite peut toucher les bords mobile. | P2/S | 320–390 | `max-w-[calc(100vw-2rem)]`, scroll interne, focus visible. | Dialog entier visible, fermeture Esc, focus restauré. |
| G-26 | DataTable | `ui/data-table.tsx:36-79` | desktop/mobile/source | Grille `div`; ligne cliquable sans rôle, tabindex ni clavier ; conteneur `overflow-hidden`. | P1/M | mobile/a11y | Vraie table ou grid ARIA ; overflow-x-auto ou cartes mobile ; Enter/Space. | Lecture SR avec en-têtes, ligne atteignable clavier, aucune colonne perdue. |
| G-27 | EmptyState | `ui/empty-state.tsx` | multiples routes | Visuel clair et CTA explicite quand l'état est réellement vide. Budgets détourne le pattern vers un faux succès. | PASS/P1 budgets | tous | Conserver composant ; définir état `unconfigured` distinct. | Vide, non configuré et succès sont trois messages distincts. |
| G-28 | Toast | `ui/toast.tsx:18-83` | source | Position correcte ; bouton fermer opaque 0 hors hover, donc difficile à découvrir au clavier/souris. | P2/S | tous | Garder close visible ou ≥0.6 ; nom accessible. | Fermeture toujours perceptible et atteignable. |
| G-29 | Loading skeletons | pages | source/chargement | Squelettes existent sur Accounts/Categories et plusieurs pages ; pas de `aria-busy`/annonce explicite. | P2/S | tous | `aria-busy`, région live, respecter reduced motion. | SR annonce chargement puis contenu ; pas de pulse si reduced-motion. |
| G-30 | Erreur base de données | `database-status-banner.tsx` | source | Bannière utile, texte d'erreur technique potentiellement exposé. | P2/S | tous | Message utilisateur + détail repliable, actions retry/export. | Erreur compréhensible, sans stack/secrets, retry accessible. |

## 6. Dashboard `/`

| ID | Section / contrôle visible | Source | Variantes testées | Résultat observé | Sev./effort | Contexte | Recommandation | Acceptation |
|---|---|---|---|---|---|---|---|---|
| D-01 | Titre Dashboard / aperçu | `src/app/page.tsx` | vide, peuplé, 390/desktop | PASS de hiérarchie dans l'état peuplé. Dans l'état vide, le grand onboarding remplace utilement le bruit analytique. | PASS | tous | Conserver la séparation vide/peuplé. | Un h1, description courte, pas de métriques zéro inutiles. |
| D-02 | « Welcome to WealthPilot » | `src/app/page.tsx` | vide clair desktop | Message clair, centré, mais anglais alors que Plan est partiellement français. | P2/M | toutes tailles | Choisir locale globale et traduire en bloc. | 100 % des chaînes d'une session utilisent la locale choisie. |
| D-03 | Texte local-first | `src/app/page.tsx` | vide | « data stays on this device » rassure ; PASS. | PASS | tous | Conserver, relier à Data/backup. | Mention exacte et lien d'explication. |
| D-04 | CTA Import transactions | `src/app/page.tsx` | clic/navigation | CTA principal pertinent ; la route Import doit toutefois être robuste à l'écran blanc. | P0 dépendance | desktop | Corriger `/import`, puis conserver. | Clic rend l'étape Select Account à chaque fois. |
| D-05 | Footer « Nothing is uploaded » | `src/app/page.tsx` | vide | PASS informatif, contraste muted à corriger. | P1/S | clair | Renforcer le token muted. | Ratio ≥4,5:1. |
| D-06 | Quick stats | `components/dashboard/quick-stats.tsx` | peuplé, responsive | Nombres tabulaires lisibles ; cartes nombreuses et grandes sur très grand écran. | P2/S | large desktop | Largeur max et grille 4 colonnes seulement si densité utile. | Lecture groupée sans balayage excessif à 1440–2560 px. |
| D-07 | Monthly summary | `components/dashboard/monthly-summary.tsx` | peuplé/source | Revenus/dépenses/net compréhensibles. Couleur seule insuffisante pour le sens. | P2/S | deux thèmes | Ajouter signe, libellé et icône, pas seulement teinte. | Sens disponible en monochrome et lecteur d'écran. |
| D-08 | Cash-flow chart | `components/dashboard/cash-flow-chart.tsx` | peuplé, thèmes | Courbe lisible, mais palette très proche et warnings Recharts de dimension négative au montage. | P1/M | tous | Conteneur avec min-width/min-height, palette catégorielle accessible, fallback table. | Aucun warning ; séries distinguables sans couleur. |
| D-09 | Upcoming bills | `components/dashboard/upcoming-bills.tsx` | vide/peuplé | PASS de structure ; dates et montants doivent rester prioritaires. | P2/S | mobile | Empiler date/merchant/montant, tronquer secondaire. | Aucune donnée critique tronquée à 320 px. |
| D-10 | Personal insights | `components/analytics/personal-insights.tsx` | peuplé/source | Bon potentiel mais recommandations parfois présentées avec la même force que des faits. | P2/M | tous | Taguer « insight », indiquer période/source/confiance. | Chaque insight cite sa période et reste explicable. |

## 7. Transactions `/transactions`

| ID | Section / contrôle visible | Source | Variantes testées | Résultat observé | Sev./effort | Contexte | Recommandation | Acceptation |
|---|---|---|---|---|---|---|---|---|
| T-01 | Titre Transactions / sous-titre | `src/app/transactions/page.tsx` | vide/peuplé | PASS. | PASS | tous | Conserver. | H1 unique et sous-titre lié. |
| T-02 | Carte Income | idem | vide 0 / peuplé | Montant clair ; manque la période directement dans la carte. | P2/S | tous | Afficher « période filtrée ». | L'utilisateur sait ce que le total agrège sans remonter aux filtres. |
| T-03 | Carte Expenses | idem | vide/peuplé | Même constat. | P2/S | tous | Idem. | Idem. |
| T-04 | Carte Net | idem | vide/peuplé | Signe utile ; couleur seule à éviter. | P2/S | tous | Libellé surplus/déficit + signe. | Compréhensible en niveaux de gris. |
| T-05 | Search transactions | `transactions/page.tsx:596+` | saisie/empty | PASS fonctionnel ; résultats vides expliqués. | PASS | tous | Conserver, ajouter raccourci facultatif. | Label accessible et effacement évident. |
| T-06 | Select All Categories | idem | ouvert/source | PASS ; la longueur peut devenir importante. | P2/S | mobile | Recherche interne si >15 catégories. | Choix en moins de 5 secondes avec 30 catégories. |
| T-07 | Select All Types | idem | ouvert/source | PASS. | PASS | tous | Conserver. | Valeur courante annoncée. |
| T-08 | Select All fréquence | idem | ouvert/source | Libellé visible « All » trop ambigu hors contexte. | P2/S | tous | Label persistant « Frequency ». | Lecteur d'écran et visuel annoncent le domaine. |
| T-09 | Date de début | idem | valeur `2026-07-01` | Dans AX, seul le contenu date est exposé ; pas de nom accessible distinct. | P1/S | tous | `<label>` associé ou `aria-label="Start date"`. | VoiceOver annonce « Start date, date ». |
| T-10 | Date de fin | idem | valeur `2026-09-30` | Même défaut. | P1/S | tous | Label associé. | Annonce correcte. |
| T-11 | Bouton Select | idem | clic/source | Mode de sélection compréhensible mais changement d'état peu explicite. | P2/S | tous | Libellé dynamique « Cancel selection », compteur sélectionné. | État annoncé et réversible. |
| T-12 | Bouton Export | idem | état vide/peuplé | Présent même avec zéro résultat ; action potentiellement vide. | P2/S | vide | Disabled avec explication quand aucun résultat. | Impossible d'exporter un fichier inutile ; raison visible. |
| T-13 | Titre All Transactions + compteur | idem | 0 et peuplé | PASS ; compteur reflète filtre. | PASS | tous | Conserver. | Compteur mis à jour dans une région live. |
| T-14 | Tri Date | idem | clic/source | PASS conceptuel ; état asc/desc pas suffisamment annoncé. | P2/S | tous | `aria-sort` et icône avec texte SR. | SR annonce ordre courant. |
| T-15 | Tri Amount | idem | clic/source | Même défaut. | P2/S | tous | `aria-sort`. | Idem. |
| T-16 | En-têtes Merchant / Date / Amount | idem | vide/peuplé | À grand écran, zone de tableau très large et vide ; en mobile, structure grille compresse. | P2/M | 390/large | Table responsive : ligne en carte sur mobile, largeur max desktop. | Données critiques visibles sans zoom ni coupe. |
| T-17 | Ligne transaction — marchand | idem | peuplé | Texte principal correct, mais actions n'apparaissent qu'au hover. | P1/M | tactile/clavier | Menu actions toujours disponible, focus-visible. | Modifier/supprimer accessible sans hover. |
| T-18 | Ligne — catégorie | `category-select.tsx` | peuplé/source | Contrôle utile ; densité et nombreuses options. | P2/S | mobile | Nom accessible + recherche et regroupement. | Choix clavier et touch complet. |
| T-19 | Ligne — édition icône | `transactions/page.tsx:525-572` | source/hover | Bouton sans nom explicite dans de nombreux rendus. | P1/S | tous | `aria-label="Edit transaction …"`. | Axe ne contient aucun bouton sans nom. |
| T-20 | Ligne — suppression icône | idem | source/hover | Même défaut, action dangereuse très proche de l'édition. | P1/S | tous | Label + confirmation + séparation spatiale. | Aucun déclenchement accidentel ; nom contextualisé. |
| T-21 | Checkboxes de sélection | idem | source | Cibles étroites ; sélection globale/partielle à clarifier. | P2/S | mobile | 44 px, état mixed, label par marchand/date. | Sélection utilisable VoiceOver et tactile. |
| T-22 | Empty « No transactions found » | idem | vide/filtre sans résultat | PASS du texte ; « Try adjusting » pertinent. | PASS | tous | Différencier base vide et filtre vide avec CTA Import. | Base vide propose Import ; filtre vide propose Reset filters. |
| T-23 | Dialog édition transaction | idem | source | Champs complets ; test final non soumis. Risque de scroll mobile. | P2/M | 390 | Dialog responsive, erreurs inline, sauvegarde disabled tant qu'invalide. | Tout champ et boutons visibles à 320×568. |
| T-24 | Résultat DOM accessible | page live peuplée | inventaire | 151 contrôles pour 101 noms vides mesurés dans la session peuplée : dette a11y massive, surtout icônes/lignes. | P1/L | tous | Audit axe automatisé + labels systématiques. | 0 contrôle interactif sans nom accessible. |

## 8. Analytics `/analytics`

| ID | Composant | Source | Variantes | Observation | Sev./effort | Contexte | Recommandation | Acceptation |
|---|---|---|---|---|---|---|---|---|
| A-01 | Titre et description | `src/app/analytics/page.tsx` | vide/peuplé | PASS ; périmètre mensuel annoncé. | PASS | tous | Conserver. | Période toujours visible. |
| A-02 | Onglet 1M | idem | clic | PASS de changement ; cible compacte. | P2/S | mobile | Cible 44 px. | Actif annoncé par `aria-selected`. |
| A-03 | Onglet 3M | idem | clic | PASS. | P2/S | mobile | Idem. | Idem. |
| A-04 | Onglet 6M | idem | clic | PASS. | P2/S | mobile | Idem. | Idem. |
| A-05 | Onglet 1Y | idem | clic | PASS. | P2/S | mobile | Idem. | Idem. |
| A-06 | Onglet YTD | idem | actif | PASS, actif visible. | P2/S | mobile | Idem. | Idem. |
| A-07 | Total Income | idem | 0 / `25 506 €` observé | Montant lisible ; divergence avec Categories peuplé (`28 001,67 €`) faute de période/source suffisamment explicite. | P1/M | peuplé | Afficher dates exactes et règles d'inclusion. | Les mêmes filtres donnent mêmes totaux partout. |
| A-08 | Total Expenses | idem | 0 / `25 652 €` | Même besoin de période/source. | P1/M | peuplé | Idem. | Réconciliation inter-pages documentée. |
| A-09 | Net Cash Flow | idem | 0 / `-146 €` | PASS visuel, ajouter libellé déficit. | P2/S | tous | Texte + signe. | Sens sans couleur. |
| A-10 | Avg monthly expenses | idem | 0 / `4 006 €` | Libellé assez clair, calcul non expliqué. | P2/S | tous | Tooltip formule et mois incomplets. | Calcul vérifiable. |
| A-11 | Avg monthly income | idem | 0 / `4 221 €` | Même constat. | P2/S | tous | Idem. | Idem. |
| A-12 | Financial History chart | `components/analytics/financial-history.tsx` | vide/peuplé, thèmes | Hauteur fixe 280 ; couleurs codées en dur ; warnings Recharts `width(-1)/height(-1)` au montage. | P1/M | tous | Tokens charts accessibles, min-size, légende et table alternative. | 0 warning, contraste ≥3:1 pour traits, données accessibles. |
| A-13 | État « No transactions in this period » | page | vide | PASS, mais doit proposer Import ou changer période. | P2/S | vide | Ajouter deux CTA contextuels. | Sortie d'état vide en un clic. |
| A-14 | Graphiques catégories | page/components | peuplé | Palette corail + neutres trop proche, surtout pour nombreuses catégories. | P1/M | deux thèmes | Palette multi-hue daltonisme + motifs/labels directs. | Séries distinguables en protanopie/deutéranopie. |
| A-15 | Salary history | `financial-history.tsx` | peuplé/source | Fonction pertinente, mais « salaire » doit exclure transferts et autres crédits de façon explicite. | P1/M | tous | Sous-titre méthode + détail source. | Chaque point peut ouvrir ses transactions sources. |

## 9. Budgets `/budgets`

| ID | Composant / contrôle | Source | Variantes | Observation | Sev./effort | Contexte | Recommandation | Acceptation |
|---|---|---|---|---|---|---|---|---|
| B-01 | Titre « Budgets — Plan with confidence » | `src/app/budgets/page.tsx` | vide/peuplé | PASS structure, langue anglaise. | P2/M | tous | Localisation globale. | Locale cohérente. |
| B-02 | Période September 2026 | idem | current | Période visible ; aucun contrôle mois évident dans l'état inspecté. | P2/S | tous | Ajouter précédent/suivant et Today accessibles. | Changement de mois évident et annoncé. |
| B-03 | Bouton Settings | idem | ouvert réellement | Ouvre panneau de paramétrage ; PASS fonctionnel. | PASS | desktop | Conserver ; indiquer sauvegarde auto. | Ouverture clavier, focus dans panneau. |
| B-04 | Budget vs actual chart | idem | zéro/peuplé | À zéro, axes 0–4 € inutiles ; dans la session peuplée, graphique parfois vide alors que des alertes existaient. | P1/M | tous | État non configuré au lieu d'un graphe zéro ; instrumentation d'erreur. | Zéro donnée => CTA ; données => barres et légende cohérentes. |
| B-05 | Spending pace | idem | jour 29/30, 97 %, 0 % utilisé | Mathématiquement lisible mais donne une impression de réussite sans budget. | P1/M | vide | État `not configured`; ne pas calculer de verdict. | Aucun verdict tant que revenu/budget incomplet. |
| B-06 | Budget alerts | idem | 0 / 6 alertes | À zéro affiche « All Good » : faux positif. | P1/S | vide | « Configure your budget » neutre. | Succès seulement si données suffisantes. |
| B-07 | Verdict « On Track » | idem | zéro | Trompeur. | P1/S | vide | Masquer ou afficher « Not enough data ». | Règle d'éligibilité testée. |
| B-08 | « Well under budget! Great job! » | idem | zéro | Trompeur et culpabilisant hors contexte. | P1/S | vide | Message factuel seulement après période significative. | Aucun encouragement calculé sur zéro budget. |
| B-09 | Needs | idem | vide/peuplé | Bloc attendu 50 %, bon modèle, mais dépend des types de catégorie. | P2/M | tous | Montrer formule, réel/objectif et catégories incluses. | Drill-down vérifiable. |
| B-10 | Wants | idem | vide/peuplé | Même constat. | P2/M | tous | Idem. | Idem. |
| B-11 | Savings | idem | vide/peuplé | Épargne ne doit pas compter deux fois transferts internes. | P1/M | peuplé | Règle d'exclusion explicite. | Totaux se réconcilient avec Accounts/Transactions. |
| B-12 | Lignes catégories | idem | source/peuplé | Actions terminales sous forme de boutons icône sans nom. | P1/S | tous | Labels contextuels et menu visible. | 0 bouton anonyme. |
| B-13 | Monthly Income | panneau Settings | ouvert, valeur 0 | Champ nombre ; Smart income 0 € « low ». « low » ambigu et anglais. | P2/S | tous | Expliquer source, niveau de confiance et permettre verrouillage. | Source et date du revenu affichées. |
| B-14 | Budget Rule 50/30/20 | panneau | select ouvert/source | Bon preset ; aucune prévisualisation de conséquence avant application. | P2/M | tous | Aperçu montants + confirmation si remplace overrides. | Impact connu avant changement. |
| B-15 | Monthly allocation | panneau | zéro | Résumé utile. | PASS | tous | Conserver avec état vide neutre. | Somme = revenu et règles. |
| B-16 | Overrides Housing | panneau | select | Contrôle présent. | P2/S | tous | Feedback « Saved » et reset to default. | Modification persistée et annoncée. |
| B-17 | Override Food | idem | select | PASS fonctionnel source ; même manque de feedback. | P2/S | tous | Idem. | Idem. |
| B-18 | Override Transport | idem | select | Idem. | P2/S | tous | Idem. | Idem. |
| B-19 | Override Shopping | idem | select | Idem. | P2/S | tous | Idem. | Idem. |
| B-20 | Override Bills | idem | select | Idem. | P2/S | tous | Idem. | Idem. |
| B-21 | Override Health | idem | select | Idem. | P2/S | tous | Idem. | Idem. |
| B-22 | Override Entertainment | idem | select | Idem. | P2/S | tous | Idem. | Idem. |
| B-23 | Override Family | idem | select | Idem. | P2/S | tous | Idem. | Idem. |
| B-24 | Override Services | idem | select | Idem. | P2/S | tous | Idem. | Idem. |
| B-25 | Override Transfers | idem | select | Très sensible au double comptage. | P1/M | tous | Interdire/avertir Needs/Wants pour transfert interne. | Transfert interne exclu des dépenses. |
| B-26 | Override Taxes | idem | select | Important pour le plan ; pas d'explication de synchronisation avec Plan. | P1/M | tous | Source unique budget/plan ou avertir divergence. | Modifier Taxes se reflète explicitement dans Plan. |
| B-27 | Persistance automatique | panneau | interaction/source | Aucun bouton Save et aucun feedback clair : l'utilisateur ignore si c'est enregistré. | P1/S | tous | Toast/inline « Saved » avec timestamp. | Toute modification annonce succès/échec. |

## 10. Plan 13 semaines `/plan`

| ID | Composant / contrôle | Source | Variantes | Observation | Sev./effort | Contexte | Recommandation | Acceptation |
|---|---|---|---|---|---|---|---|---|
| P-01 | Titre et sous-titre | `src/app/plan/page.tsx` | état initial | Mélange « 13-week plan » / « Household recovery » et contenu français. | P2/M | tous | Localiser entièrement. | Une langue par session. |
| P-02 | Save assumptions | idem | source/non soumis | Action nécessaire mais risque de confondre sauvegarde locale et scénario appliqué. | P2/S | tous | État dirty, « Saved locally », timestamp, undo. | Feedback explicite et réversible. |
| P-03 | Starting balance | idem | valeur 0 | Clair, mais ne se synchronise pas visiblement avec les deux comptes. | P0/L | financier | Calculer somme des comptes sélectionnés, afficher détail et date. | Le départ = total concilié des comptes, traçable. |
| P-04 | Lowest balance | idem | valeur 0 | PASS calcul si hypothèses valides ; ici hypothèses invalides. | P1/M | initial | Étiqueter scénario non configuré. | Aucun KPI prédictif avant coûts valides. |
| P-05 | End balance | idem | `16 342 €` | Valeur trompeuse issue de coûts zéro et revenus préremplis. | P0/M | initial | Bloquer verdict, rendre coûts obligatoires ou utiliser données réelles. | Scénario incomplet n'affiche pas un solde final affirmatif. |
| P-06 | Against target | idem | `16 342 €` | Amplifie le faux positif. | P0/S | initial | Remplacer par « Incomplete assumptions ». | Pas de comparaison sans cible + coûts. |
| P-07 | Scénario Prudent | idem | clic/source | Preset utile, mais effet exact non expliqué. | P1/M | tous | Résumé delta avant application. | Hypothèses modifiées listées. |
| P-08 | Scénario Réaliste | idem | actif/source | Accent sur « réaliste » donne une autorité injustifiée. | P1/S | tous | Renommer « Base » et montrer provenance/confiance. | Aucun preset n'est présenté comme vérité sans données. |
| P-09 | Scénario Reprise | idem | clic/source | Même besoin de transparence. | P1/M | tous | Comparaison côte à côte. | Delta visible. |
| P-10 | Salaire Anthonny amount | idem | `3690,24` | Valeur exacte mais origine/date non visible. | P1/M | tous | Lier historique salaire et afficher moyenne/plage. | Source de chaque revenu consultable. |
| P-11 | Salaire Anthonny day | idem | 25 | Clair ; validation jours 1–31 nécessaire. | P2/S | tous | Select ou validation calendrier. | Jours invalides impossibles. |
| P-12 | Salaire Mirane amount | idem | 1900 | Valeur estimée non distinguée d'un revenu confirmé. | P1/S | tous | Badge Confirmed/Estimated et date de début. | Estimation clairement marquée. |
| P-13 | Salaire Mirane day | idem | 28 | PASS avec validation. | P2/S | tous | Idem. | Idem. |
| P-14 | CAF amount | idem | `711,03` | Source/date non visible. | P1/S | tous | Badge source et possibilité de fin. | Montant traçable. |
| P-15 | CAF day | idem | 5 | PASS avec validation. | P2/S | tous | Idem. | Idem. |
| P-16 | Weekly essential | idem | 0 | Zéro autorisé conduit au faux surplus. | P0/M | initial | Requis ou auto-estimé depuis transactions ; warning bloquant. | Pas de forecast si enveloppe essentielle indéfinie. |
| P-17 | Weekly flexible | idem | 0 | Même défaut. | P0/M | initial | Idem. | Idem. |
| P-18 | Fixed monthly costs | idem | 0 | Même défaut, alors que Subscriptions pourrait alimenter ce chiffre. | P0/L | initial | Synchroniser recurring bills/subscriptions. | Coûts fixes sourcés et détail accessibles. |
| P-19 | Tax adjustment | idem | 854 | Bonne donnée métier, mais la période « 3 payments remaining » doit être datée. | P1/S | tous | Afficher échéances exactes et fin automatique. | Chaque paiement apparaît dans la semaine correspondante. |
| P-20 | Payments remaining | idem | 3 | Champ sensible ; pas de lien calendrier. | P1/M | tous | Générer occurrences visibles. | Calendrier et plan concordent. |
| P-21 | Target balance | idem | 0 | Cible zéro cohérente avec demande, mais « against target » ne doit pas flatter un scénario incomplet. | P1/S | tous | Séparer seuil minimum et objectif de fin. | Cible et plancher ont définitions distinctes. |
| P-22 | Floor | idem | -800 | Utile ; doit être interprété comme limite, pas objectif. | P1/S | tous | Texte « hard floor / never below ». | Alertes dès franchissement prévu. |
| P-23 | Forecast chart | idem | initial | Visuellement crédible malgré données invalides, ce qui augmente le risque. | P0/M | tous | Watermark « Draft / incomplete », bandes d'incertitude. | Chart désactivé ou clairement provisoire. |
| P-24 | Week table 1–13 | idem | 13 lignes inspectées | Vraie table sémantique, bonne base. Sur mobile, nombreuses colonnes. | P2/M | 390 | Carte par semaine ou scroll avec première colonne sticky. | Aucun montant coupé, en-têtes associés. |
| P-25 | « Target reached » | idem | initial | Faux positif financier. | P0/S | initial | Ne jamais produire de verdict avec hypothèses zéro/incomplètes. | Test automatisé : coûts zéro => incomplete, jamais success. |
| P-26 | « December target is covered » | idem | initial | Faux positif financier. | P0/S | initial | Même garde. | Idem. |
| P-27 | Cartes conseils | idem | initial | Conseils textuels basés sur projection invalide. | P0/M | initial | Conditionner à qualité des données et citer hypothèses. | Aucun conseil affirmatif si confiance insuffisante. |

## 11. Goals `/goals` et détails `/goals/[id]`

| ID | Composant / contrôle | Source | Variantes | Observation | Sev./effort | Contexte | Recommandation | Acceptation |
|---|---|---|---|---|---|---|---|---|
| GO-01 | Titre Goals | `src/app/goals/page.tsx` | 6 objectifs actifs | PASS. | PASS | tous | Conserver. | H1 unique. |
| GO-02 | New Goal | idem | dialogue ouvert | CTA clair. | PASS | tous | Conserver. | Focus va sur Name ; retour au bouton à fermeture. |
| GO-03 | Search goals | idem | vide/source | PASS ; filtre local. | PASS | tous | Ajouter annonce compteur. | Résultat annoncé. |
| GO-04 | Sort | idem | ouvert/source | Libellé générique ; valeur courante doit rester visible. | P2/S | tous | « Sort by: … ». | Critère courant annoncé. |
| GO-05 | Summary Target | idem | `11 800 €` | Addition lisible. | PASS | tous | Conserver. | Réconcilié aux cartes. |
| GO-06 | Summary Saved | idem | 0 | « Saved » inclut progression virtuelle ; ambigu. | P1/S | tous | Séparer argent réel et progression virtuelle. | Aucun montant virtuel présenté comme disponible. |
| GO-07 | Net 30d | idem | 0 | Sens peu évident sans tooltip. | P2/S | tous | Libellé « contributions – withdrawals, last 30 days ». | Formule visible. |
| GO-08 | At risk | idem | 0 | Calcul/critère non expliqué. | P2/M | tous | Tooltip date/rythme et méthode. | Chaque objectif à risque explique pourquoi. |
| GO-09 | Lien Transactions | idem | clic/source | PASS. | PASS | tous | Conserver. | Destination correcte. |
| GO-10 | Lien Budgets | idem | clic/source | PASS. | PASS | tous | Conserver. | Destination correcte. |
| GO-11 | Lien Analytics | idem | clic/source | PASS. | PASS | tous | Conserver. | Destination correcte. |
| GO-12 | Tab Active (6) | idem | actif | PASS. | PASS | tous | Conserver. | `aria-selected` et compteur. |
| GO-13 | Tab Completed (0) | idem | clic/source | PASS ; état vide attendu. | PASS | tous | Conserver. | Empty state contextualisé. |
| GO-14 | Card Emergency Fund | `components/goals/goal-card.tsx` | détail `/goals/1` ouvert | 0/3000, action Details et contribution ; PASS structure. | P2/S | tous | Distinguer linked balance vs virtual. | Source du 0 visible. |
| GO-15 | Card Car Maintenance | idem | détail `/goals/2` ouvert | 0/1500 ; même constat. | P2/S | tous | Idem. | Idem. |
| GO-16 | Card Family Vacation | idem | détail `/goals/3` ouvert | 0/2500 ; même constat. | P2/S | tous | Idem. | Idem. |
| GO-17 | Card Big Plan (House/Car) | idem | détail `/goals/4` ouvert | 0/2400 ; nom parenthétique dense sur mobile. | P2/S | mobile | Ligne titre flexible, ne pas tronquer l'objectif critique. | Nom lisible à 320 px. |
| GO-18 | Card Child 1 Savings | idem | détail `/goals/5` ouvert | 0/1200 ; même constat. | P2/S | tous | Idem. | Idem. |
| GO-19 | Card Child 2 Savings | idem | détail `/goals/6` ouvert | 0/1200 ; même constat. | P2/S | tous | Idem. | Idem. |
| GO-20 | Menu `…` sur chaque carte | idem | popup/source | Six boutons annoncés sans nom contextualisé. | P1/S | tous | `aria-label="Actions for {goal}"`. | Six noms uniques dans l'arbre AX. |
| GO-21 | Progress bar de chaque carte | idem | 0 % | Visuel lisible ; annoncer actuel/cible, pas uniquement pourcentage. | P2/S | tous | `aria-valuenow/min/max` + description. | SR annonce « 0 of 3000 euros ». |
| GO-22 | Add virtual progress | idem | source/non soumis | Le mot « virtual » est honnête mais l'impact sur Saved reste ambigu. | P1/M | tous | Section dédiée « simulation », jamais agrégée au cash réel. | Virtuel visuellement et comptablement séparé. |
| GO-23 | Details | idem | clic sur 6 cartes | Les six routes chargent. PASS. | PASS | desktop | Conserver. | Retour préserve filtre/scroll. |
| GO-24 | New Goal — Name | `goals/page.tsx` | dialog ouvert | Champ requis clair. | PASS | tous | Conserver. | Erreur inline. |
| GO-25 | New Goal — linked account | idem | select None virtual | Choix important, mais « None (virtual) » devrait expliquer les conséquences. | P1/S | tous | Helper text réel vs virtuel. | Utilisateur sait si argent est réellement mis de côté. |
| GO-26 | New Goal — Target amount | idem | vide | PASS, validation positive nécessaire. | P2/S | tous | Min >0, devise visible. | Impossible de créer cible ≤0. |
| GO-27 | New Goal — Virtual progress | idem | 0 | Risque de confusion avec compte. | P1/S | tous | Masquer si compte lié ; texte explicatif. | Pas de double comptage. |
| GO-28 | New Goal — Deadline | idem | date | Label correct ; fuseau/date locale. | P2/S | tous | Format localisé et validation future. | Deadline passée avertie. |
| GO-29 | Six swatches couleur | idem | dialogue | Les six boutons sont sans nom accessible. Couleurs seules. | P1/S | tous | Noms « Coral/Ocean… », état sélectionné et échantillon non uniquement coloré. | Chaque swatch a nom et `aria-pressed`. |
| GO-30 | Cancel | idem | clic | PASS. | PASS | tous | Conserver. | Ferme sans mutation. |
| GO-31 | Create Goal | idem | disabled initial | PASS disabled ; expliquer requis si soumission. | P2/S | tous | Résumé erreurs. | Activation seulement quand valide. |
| GO-32 | Close dialog | idem | clic | PASS fonctionnel ; nom Radix attendu. | PASS | tous | Conserver. | Focus restauré. |
| GD-01 | Détail — Back to goals | `src/app/goals/[id]/page.tsx` | 6 routes | PASS. | PASS | tous | Conserver. | Retour conserve contexte. |
| GD-02 | Détail — titre | idem | 6 noms | Rendu comme niveau 2 sans h1. | P2/S | a11y | Passer en h1. | Un h1 unique par détail. |
| GD-03 | Add virtual contribution | idem | source | Même ambiguïté réel/virtuel. | P1/M | tous | Séparer simulation. | Cash réel inchangé et message clair. |
| GD-04 | Menu actions détail | idem | source | Bouton `…` sans nom. | P1/S | tous | Label contextualisé. | Nom AX unique. |
| GD-05 | Overview | idem | actif | PASS. | PASS | tous | Conserver. | `aria-selected`. |
| GD-06 | Activity | idem | clic sur Goal 1/source | Onglet accessible ; état vide « Add first contribution ». | PASS | tous | Conserver. | Activité chronologique et types annoncés. |
| GD-07 | Forecast | idem | source/empty | Une prévision à zéro ne doit pas inventer de date. | P1/S | vide | État « no contribution history ». | Pas de date si données insuffisantes. |
| GD-08 | Recent Activity | idem | vide | PASS empty state. | PASS | tous | Conserver. | CTA contextualisé. |
| GD-09 | Add first contribution | idem | vide/source | Doit préciser virtual vs linked. | P1/S | tous | Deux actions nommées distinctement. | Aucun transfert implicite. |

## 12. Subscriptions `/subscriptions`

| ID | Composant / contrôle | Source | Variantes | Observation | Sev./effort | Contexte | Recommandation | Acceptation |
|---|---|---|---|---|---|---|---|---|
| S-01 | Titre / Recurring commitments | `src/app/subscriptions/page.tsx` | vide | PASS. | PASS | tous | Conserver. | H1 unique. |
| S-02 | Auto-Detect | idem | non exécuté (écritures potentielles), source | Action puissante sans aperçu du volume ni explication. | P1/M | tous | Preview non mutante, sélection, confirmation, undo. | Aucun item créé avant confirmation explicite. |
| S-03 | Métrique monthly subscriptions | idem | 0 | PASS si libellé/période. | P2/S | tous | Afficher devise/mois. | Unité explicite. |
| S-04 | Bills metric | idem | 0 | PASS. | P2/S | tous | Conserver. | Idem. |
| S-05 | Loans metric | idem | 0 | PASS. | P2/S | tous | Conserver. | Idem. |
| S-06 | Income metric | idem | 0 | PASS. | P2/S | tous | Conserver. | Idem. |
| S-07 | Tab Subscriptions | idem | clic | Vide : « No subscriptions found », Add manually, Auto-detect, Add Subscription. Bon double chemin. | PASS | tous | Garder un seul CTA principal pour éviter répétition. | Hiérarchie primary/secondary claire. |
| S-08 | Tab Bills | idem | clic réel | « No bills tracked » + Add Bill. PASS. | PASS | tous | Conserver. | CTA ouvre type Bill. |
| S-09 | Tab Loans | idem | clic réel | « No loans tracked » + Add Loan. PASS. | PASS | tous | Conserver. | CTA ouvre champs prêt. |
| S-10 | Tab Income | idem | clic réel | « No income sources » + Add Income. PASS. | PASS | tous | Conserver. | CTA ouvre type Income. |
| S-11 | Tab Ended | idem | clic réel | État vide sans CTA, cohérent. | PASS | tous | Conserver. | Explique comment un item arrive ici. |
| S-12 | CTA Add Subscription | idem | clic réel | Première exposition AX « AddSubscription » sans espace, puis correcte : vérifier concaténation/hydratation. | P2/S | runtime | Label explicite stable. | AX annonce toujours « Add Subscription ». |
| S-13 | Dialog — Type | `components/subscriptions/add-edit-dialog.tsx` | ouvert | Select utile ; change les champs. | PASS | tous | Conserver. | Type annoncé et conditionnels mis à jour. |
| S-14 | Dialog — Name* | idem | vide | Requis clair. | PASS | tous | Conserver. | Erreur inline. |
| S-15 | Merchant | idem | vide | Optionnel ; différenciation Name/Merchant peu expliquée. | P2/S | tous | Helper text ou auto-remplissage. | Rôle compris. |
| S-16 | Amount* | idem | vide | Devise non intégrée visuellement au champ. | P2/S | tous | Affixe devise. | Devise annoncée SR. |
| S-17 | Frequency | idem | select | PASS. | PASS | tous | Conserver. | Options localisées. |
| S-18 | Category | idem | select | PASS ; dépend de Categories. | PASS | tous | Conserver. | Recherche si liste longue. |
| S-19 | Subcategory | idem | select | Doit se réinitialiser si Category change. | P2/S | tous | Validation dépendance. | Aucune sous-catégorie invalide persistée. |
| S-20 | Expected Day | idem | number | Validation calendrier nécessaire. | P2/S | tous | Jour 1–31 + logique fin de mois. | Mois courts gérés explicitement. |
| S-21 | Start Date | idem | date | PASS. | PASS | tous | Format localisé. | Nom accessible. |
| S-22 | Amount varies | idem | checkbox | Bon contrôle ; impact sur projections non expliqué. | P2/S | tous | Helper text et fourchette prévue. | Plan affiche estimation/incertitude. |
| S-23 | Cancel | idem | clic | PASS. | PASS | tous | Conserver. | Aucune mutation. |
| S-24 | Create | idem | disabled | PASS initial. | PASS | tous | Conserver. | Validation et feedback. |
| S-25 | Close | idem | clic | PASS. | PASS | tous | Conserver. | Focus restauré. |
| S-26 | Loan conditional fields | `loan-card.tsx`, dialog | source | Nombreuses données financières ; peu de résumé du coût total. | P1/M | tous | Calcul principal/intérêts/restant avec avertissement estimation. | Valeurs conciliées et explicables. |
| S-27 | Subscription card actions | `subscription-card.tsx` | source | Menus icône doivent être nommés et accessibles au tactile. | P1/S | mobile/a11y | Label contextualisé, 44 px. | 0 bouton sans nom. |
| S-28 | History / merge dialogs | `subscription-history.tsx`, `merge-dialog.tsx` | source | Fonctionnalités avancées, risque de densité et mutation. | P2/M | mobile | Preview, différence avant/après, annulation. | Merge ne se produit qu'après résumé confirmé. |

## 13. Calendar `/calendar`

| ID | Composant / contrôle | Source | Variantes | Observation | Sev./effort | Contexte | Recommandation | Acceptation |
|---|---|---|---|---|---|---|---|---|
| C-01 | Titre / cash-flow timing | `src/app/calendar/page.tsx` | vide/peuplé | PASS. | PASS | tous | Conserver. | H1 unique. |
| C-02 | This Month | idem | 0 | PASS métrique, préciser entrées/sorties si montant net. | P2/S | tous | Libellé non ambigu. | Formule comprise. |
| C-03 | Paid | idem | 0 | PASS. | PASS | tous | Conserver. | Devise/période. |
| C-04 | Upcoming | idem | 0 | PASS. | PASS | tous | Conserver. | Idem. |
| C-05 | Overdue | idem | 0 | Couleur seule à éviter. | P2/S | tous | Icône + texte. | Sens en monochrome. |
| C-06 | Titre September 2026 | idem | août/septembre via navigation | Mise à jour réussie. | PASS | desktop | Conserver. | Région live annonce nouveau mois. |
| C-07 | Bouton mois précédent | `calendar/page.tsx:409+` | clic réel | Fonctionne, mais AX annonce seulement « button ». | P1/S | tous | `aria-label="Previous month"`. | Nom accessible et focus visible. |
| C-08 | Today | idem | clic réel | PASS. | PASS | tous | Conserver. | Disabled ou actif quand déjà mois courant. |
| C-09 | Bouton mois suivant | idem | clic réel | Fonctionne, mais sans nom AX. | P1/S | tous | `aria-label="Next month"`. | Nom accessible. |
| C-10 | En-têtes Sun–Sat | idem | desktop/mobile | Compréhensibles en anglais seulement. | P2/M | tous | Localiser via Intl et utiliser `<abbr>`. | Locale cohérente, nom complet SR. |
| C-11 | Jour 1 | idem | clic | Nom AX « 1 » seulement, pas date complète ; même défaut jours 2–30. | P1/M | tous | `aria-label="Tuesday, September 1, 2026"`, `aria-current=date`. | Chaque cellule a date complète. |
| C-12 | Jours 2–7 | idem | visibles/clic source | Même défaut ; regroupés ici comme six contrôles distincts 2,3,4,5,6,7. | P1/M | tous | Même label complet. | Six noms complets uniques. |
| C-13 | Jours 8–14 | idem | visibles | Sept contrôles distincts 8,9,10,11,12,13,14 ; même défaut. | P1/M | tous | Idem. | Noms uniques. |
| C-14 | Jours 15–21 | idem | visibles | Sept contrôles distincts ; même défaut. | P1/M | tous | Idem. | Noms uniques. |
| C-15 | Jours 22–28 | idem | visibles | Sept contrôles distincts ; même défaut. | P1/M | tous | Idem. | Noms uniques. |
| C-16 | Jours 29–30 | idem | jour 29 cliqué | Clic sur jour vide ne fournit aucun feedback visible. | P2/S | vide | État sélectionné et panneau « no events ». | Sélection perceptible et annoncée. |
| C-17 | Grille 7 colonnes | `calendar/page.tsx:409,421` | 390 | Cellules ~38×86 px ; noms de marchands/événements tronqués. | P1/L | mobile | Vue agenda mobile, grille réservée ≥768 px. | À 390 px, date/montant/nom essentiels lisibles. |
| C-18 | Pastille Bill/Payment | `calendar/page.tsx:453+` | peuplé/source | `text-xs` et truncate ; couleur seule pour type. | P2/M | mobile | Icône/type, tooltip clavier/touch, vue agenda. | Type identifiable sans couleur. |
| C-19 | Légende | `calendar/page.tsx:471` | visible | Petite (12 px), contraste muted faible en clair. | P1/S | clair | Texte 14 px/contraste. | ≥4,5:1. |
| C-20 | Upcoming Bills | idem | vide | PASS : « No upcoming bills this month ». | PASS | tous | CTA Add Bill facultatif. | Sortie vers Subscriptions/Bills. |

## 14. Accounts `/accounts`

| ID | Composant / contrôle | Source | Variantes | Observation | Sev./effort | Contexte | Recommandation | Acceptation |
|---|---|---|---|---|---|---|---|---|
| AC-01 | Route complète | `src/app/accounts/page.tsx` | navigation directe live + SSR | Le navigateur est devenu blanc après navigation, alors que `curl` renvoie HTTP 200 et le HTML Accounts complet. | P0/M | runtime desktop | Reproduire hors HMR, capturer console, ErrorBoundary route et test Playwright direct/client navigation. | 10 rechargements + 10 navigations sans écran blanc. |
| AC-02 | Total Assets | `accounts/page.tsx:311-325` | SSR vide/ancien peuplé | Carte claire ; fallback `totals.assets || latestBalance` confond zéro réel et absence. | P1/S | tous | Tester null/undefined, pas truthiness. | Actifs réellement zéro restent zéro. |
| AC-03 | Liabilities | `accounts/page.tsx:327-341` | SSR vide | PASS. | PASS | tous | Conserver. | Montant et devise. |
| AC-04 | Net Worth | `accounts/page.tsx:342-356` | SSR vide | Même fallback truthy avec `latestBalance`; risque de valeur incohérente. | P1/S | tous | Calcul explicite selon présence de comptes. | Net = assets – liabilities. |
| AC-05 | Search accounts | `accounts/page.tsx:359-369` | source | PASS. | PASS | tous | Conserver. | Label accessible. |
| AC-06 | Add Account | idem | ancien état/source | CTA clair. | PASS | tous | Conserver. | Dialog focus correct. |
| AC-07 | Your Accounts + compteur | idem | vide/peuplé | PASS. | PASS | tous | Conserver. | Compteur live après ajout/suppression. |
| AC-08 | Empty No accounts yet | `accounts/page.tsx:387-404` | SSR | Très bon texte et CTA. | PASS | tous | Conserver. | CTA ouvre dialog. |
| AC-09 | Approx current balance | idem | conditionnel | Utile, mais « approximately » et origine transactions doivent être datées. | P2/S | tous | Afficher date/compte source. | Estimation traçable. |
| AC-10 | Table Account | `accounts/page.tsx:236-245` | desktop/mobile | Colonne min 240 px. | P1/M | mobile | Layout carte sur mobile. | Nom/institution visibles. |
| AC-11 | Table Type | idem | mobile | 140 px ajoutés à une grille déjà large. | P1/M | mobile | Badge dans première cellule. | Aucune colonne coupée. |
| AC-12 | Table Updated | idem | mobile | Information secondaire prend 140 px. | P1/M | mobile | Mettre sous le nom. | Lisible sans scroll horizontal. |
| AC-13 | Table Balance | idem | mobile | Montant critique peut sortir de l'écran. | P1/M | mobile | Position sticky ou carte alignée droite. | Solde toujours visible. |
| AC-14 | Table Actions | idem | mobile/hover | 100 px, mais `opacity-0` jusqu'au hover (`:281`). Inutilisable tactile/clavier. | P1/S | mobile/a11y | Menu toujours visible, focus-within. | Actions visibles au focus/touch. |
| AC-15 | Ligne cliquable | `ui/data-table.tsx:36-79` | source | `div` avec onClick sans rôle/tabindex/clavier. | P1/M | a11y | Button/link interne ou grid row keyboard. | Enter/Space ouvre édition. |
| AC-16 | Bouton Edit | `accounts/page.tsx:284-291` | source | Icône seule sans aria-label. | P1/S | tous | Label contextualisé. | « Edit account X ». |
| AC-17 | Bouton Delete | `accounts/page.tsx:292-302` | source | Icône seule sans aria-label, proche d'Edit. | P1/S | tous | Label + confirmation claire. | « Delete account X », pas de suppression accidentelle. |
| AC-18 | Grille fixe | `accounts/page.tsx:244`, `ui/data-table.tsx:36` | 390 mesuré | Largeur théorique ≥860 px dans conteneur 336 px, mais `overflow-hidden` coupe sans défilement. | P1/M | 390/tablette | Cartes responsive ou `overflow-x-auto`. | 100 % des colonnes accessibles. |
| AC-19 | Loading 3 skeletons | `accounts/page.tsx:381-385` | source | Bon feedback visuel, pas d'annonce SR. | P2/S | tous | `aria-busy`. | Loading annoncé. |
| AC-20 | Add/Edit — Name | `accounts/page.tsx:420+` | source | Requis attendu ; PASS sous réserve validation. | PASS | tous | Conserver. | Erreur inline. |
| AC-21 | Add/Edit — Type | idem | source | Types avec icônes ; bon. | PASS | tous | Conserver. | Sélection annoncée. |
| AC-22 | Add/Edit — Institution | idem | source | Optionnel. | PASS | tous | Conserver. | Placeholder non utilisé comme seul label. |
| AC-23 | Add/Edit — Balance | idem | source | Champ financier ; devise dépend du compte. | P1/S | tous | Affixe et décimales localisées, avertir impact historique. | Devise claire ; zéro accepté. |
| AC-24 | Add/Edit — Currency | idem | source | Nécessaire pour comptes multiples ; taux non expliqué. | P1/M | tous | Afficher conversion/date du taux ou absence de conversion. | Total assets traçable. |
| AC-25 | Delete confirmation | idem | source/non soumis | Garde présente. | PASS | tous | Inclure conséquences transactions/objectifs et option Cancel prioritaire. | Suppression impossible sans confirmation nommée. |

## 15. Import `/import`

| ID | Étape / contrôle | Source | Variantes | Observation | Sev./effort | Contexte | Recommandation | Acceptation |
|---|---|---|---|---|---|---|---|---|
| I-01 | Route complète | `src/app/import/page.tsx` | direct live + SSR/source | Après l'incident Accounts, route également blanche en Chrome ; HTML serveur disponible. | P0/M | runtime | Même investigation hydratation/ErrorBoundary. | Route rend systématiquement. |
| I-02 | Stepper Select Account | `components/import/migration-wizard.tsx` | ancien live/source | Étape explicite. | PASS | tous | Conserver. | Étape active annoncée. |
| I-03 | Stepper Preview | idem | ancien live/source | Bonne progression. | PASS | tous | Conserver. | `aria-current=step`. |
| I-04 | Stepper Importing | idem | source | Spinner/pulse ; texte présent. | P2/S | reduced motion | Respecter reduced-motion, `aria-live`. | Pas d'animation imposée ; statut annoncé. |
| I-05 | Stepper Complete | idem | source | Résumé complet et réconciliation. | PASS | tous | Conserver. | Résultat et erreurs annoncés. |
| I-06 | Select existing account | `migration-wizard.tsx:240+` | source | Étape obligatoire logique. | PASS | tous | Conserver. | Compte actif annoncé. |
| I-07 | New account name | `migration-wizard.tsx:258-264` | source | Enter crée immédiatement un compte : mutation sans aperçu et potentiels doublons. | P1/M | tous | Validation/normalisation, confirmation légère ou création dans transaction import. | Aucun doublon de nom involontaire ; rollback si import annulé. |
| I-08 | Create account | `:266-273` | disabled vide | Disabled correct. | P2/S | tous | Feedback succès et sélection automatique. | Nouveau compte sélectionné et annoncé. |
| I-09 | Dropzone CSV | `:278-303` | disabled sans compte/source | État disabled visible. Input fichier totalement transparent recouvre la zone ; dépend du label implicite. | P2/S | clavier | `<label for>`, focus visible, drag state et limites. | Action clavier, nom accessible, extension/taille annoncées. |
| I-10 | Supported formats | idem | visible | « Historical CSV, SG Bank Export » utile mais vague. | P2/S | tous | Lien exemples/colonnes attendues. | Utilisateur peut vérifier son fichier avant upload. |
| I-11 | Preview filename/format | `:311-323` | source | PASS. | PASS | tous | Conserver. | Nom long tronqué avec tooltip. |
| I-12 | Total Rows | `:326-349` | source | PASS. | PASS | tous | Conserver. | Valeur réconciliée. |
| I-13 | To Import | idem | source | PASS. | PASS | tous | Conserver. | Mise à jour avec seuil. |
| I-14 | Duplicates | idem | source | PASS. | PASS | tous | Conserver. | Drill-down disponible. |
| I-15 | Date Range | idem | source | Format ISO peu localisé. | P2/S | tous | Intl date, conserver ISO en détail. | Format local + date complète SR. |
| I-16 | Statement reconciliation | `:351-391` | source | Excellent garde métier, mais texte dense. | P2/M | mobile | Résumé visuel attendu/calculé/différence puis détails. | Compris à 390 px sans scroll horizontal. |
| I-17 | Badge Ready to verify / Needs review | idem | source | Utilise ambre distinct codé localement alors que DS global n'a pas de vrai warning. | P2/M | DS | Créer token warning. | Même sémantique partout. |
| I-18 | Category breakdown | `:393-408` | source | Badges nombreux ; risque de surcharge. | P2/S | mobile | Top 5 + Show all. | Aucun mur de badges. |
| I-19 | Skip duplicates | `:410-422` | source | Bon contrôle, mais conséquence doit être dans le résumé. | P2/S | tous | Compteur dynamique et explication. | Nombre final visible. |
| I-20 | Confidence range | `:423-436` | source | Slider natif sans label associé explicite, seuil complexe. | P1/M | a11y | Label, output, ticks/presets, explication faux positifs. | SR annonce nom/min/max/valeur ; clavier. |
| I-21 | Sample table Date | `:442-490` | source | Vraie table ; PASS. | PASS | desktop | Conserver, sticky header. | En-têtes associés. |
| I-22 | Sample Merchant | idem | source | PASS. | PASS | tous | Conserver. | Texte non perdu. |
| I-23 | Sample Category | idem | source | PASS. | PASS | tous | Conserver. | Catégorie source vs auto clairement marquée. |
| I-24 | Sample Amount | idem | source | PASS tabular/aligné. | PASS | tous | Conserver. | Signe + devise. |
| I-25 | Sample Status | idem | source | New/Duplicate textuels, bon. | PASS | tous | Conserver. | Pas couleur seule. |
| I-26 | Cancel | `:493-496` | source | Réinitialise ; si compte créé à l'étape 1, l'abandon peut laisser ce compte. | P1/M | tous | Rollback ou avertir. | Annulation restaure état initial. |
| I-27 | Import & verify | `:497-502` | non exécuté par sûreté | Libellé clair, atomicité indiquée. | PASS | tous | Conserver confirmation du compte et volume. | Résumé avant commit, aucun double clic. |
| I-28 | Importing spinner | `:509-521` | source | État présent ; manque progression réelle/annulation policy. | P2/M | tous | Pourcentage/phase ou indéterminé explicite, verrou anti-double import. | Statut stable et récupérable. |
| I-29 | Complete success/review | `:524-618` | source | Très bonne distinction reconciled/imported/review. | PASS | tous | Reprendre ce niveau de rigueur dans Plan/Budgets. | Aucun succès si réconciliation échoue. |
| I-30 | Errors list | `:597-605` | source | 5 premières seulement ; besoin d'export complet. | P2/S | tous | Compteur + download error report. | Toutes erreurs accessibles. |
| I-31 | Import More | `:608-612` | source | PASS. | PASS | tous | Conserver. | Réinitialise sans perdre compte inutilement. |
| I-32 | View Transactions | `:613-616` | disabled selon qualité | Excellente garde. | PASS | tous | Conserver. | Enabled uniquement si état acceptable. |

## 16. Categories `/categories`

| ID | Composant / contrôle | Source | Variantes | Observation | Sev./effort | Contexte | Recommandation | Acceptation |
|---|---|---|---|---|---|---|---|---|
| CAT-01 | Titre / description | `src/app/categories/page.tsx` | vide/peuplé | PASS. | PASS | tous | Conserver. | H1 unique. |
| CAT-02 | Add Category | `:201-208` | dialog/source | CTA clair. | PASS | tous | Conserver. | Focus champ nom. |
| CAT-03 | Total Income (12 months) | `:211-223` | 0 / `28 001,67 €` observé | Période explicite, mais total divergent d'Analytics YTD (`25 506 €`) sans explication. | P1/M | peuplé | Afficher dates exactes et règles de type/transfert. | Totaux cohérents pour même période. |
| CAT-04 | Total Expenses (12 months) | `:224-234` | vide/peuplé | PASS de libellé ; même besoin de réconciliation. | P1/M | peuplé | Idem. | Idem. |
| CAT-05 | All Categories card | `:237+` | liste | Bonne hiérarchie. | PASS | tous | Conserver. | Liste structurée. |
| CAT-06 | Housing row | idem | visible/source | Ligne cliquable via `div` si transactions, sans rôle/tabindex. | P1/M | a11y | Button/disclosure ARIA. | Clavier ouvre sous-catégories. |
| CAT-07 | Food row | idem | visible/source | Même défaut. | P1/M | a11y | Idem. | Idem. |
| CAT-08 | Transport row | idem | visible/source | Même défaut. | P1/M | a11y | Idem. | Idem. |
| CAT-09 | Shopping row | idem | visible/source | Même défaut. | P1/M | a11y | Idem. | Idem. |
| CAT-10 | Bills row | idem | visible/source | Même défaut. | P1/M | a11y | Idem. | Idem. |
| CAT-11 | Health row | idem | visible/source | Même défaut. | P1/M | a11y | Idem. | Idem. |
| CAT-12 | Entertainment row | idem | visible/source | Même défaut. | P1/M | a11y | Idem. | Idem. |
| CAT-13 | Family row | idem | visible/source | Même défaut. | P1/M | a11y | Idem. | Idem. |
| CAT-14 | Services row | idem | visible/source | Même défaut. | P1/M | a11y | Idem. | Idem. |
| CAT-15 | Transfers row | idem | peuplé `15 391,59 €` | Montant massif présenté près des dépenses : risque majeur de confusion/double comptage. | P1/M | finance | Séparer internal transfers de spending et expliquer. | Transfers exclus des dépenses/net cashflow selon règle unique. |
| CAT-16 | Taxes row | idem | visible/source | PASS structure, synchronisation Plan/Budgets nécessaire. | P1/M | finance | Catégorie source unique. | Totaux identiques entre modules. |
| CAT-17 | Income row | idem | visible/source | PASS structure. | P2/S | tous | Distinguer salaire, allocation, remboursement. | Revenus récurrents identifiables. |
| CAT-18 | Badge transaction count | `:288-300` | visible | Texte 12 px/muted ; faible contraste clair. | P1/S | clair | Token secondaire renforcé. | ≥4,5:1. |
| CAT-19 | Progress bar catégorie | idem | peuplé | Largeur donne une part, mais aucune sémantique accessible. | P2/S | tous | `role=progressbar` ou texte caché. | Pourcentage annoncé. |
| CAT-20 | Menu `…` de chaque catégorie | `:319-346` | source | Déclencheur sans aria-label. | P1/S | tous | « Actions for Housing ». | 0 bouton anonyme. |
| CAT-21 | Built-in category disabled | idem | source | Texte explique l'impossibilité d'éditer, bon, mais action disabled non découvrable tactile. | P2/S | tous | Info/tooltip accessible. | Raison disponible au focus. |
| CAT-22 | Delete custom category | idem | non exécuté | Disabled si transactions, bonne garde. | PASS | tous | Confirmation et stratégie de réaffectation. | Impossible de créer des transactions orphelines. |
| CAT-23 | Sous-catégories | `:349+` | peuplé/source | Retrait de 48 px coûte beaucoup sur mobile. | P2/M | 390 | Accordion pleine largeur, indentation légère. | Montant et nom restent visibles. |
| CAT-24 | Add — name | `:400+` | source | Champ simple. | PASS | tous | Conserver. | Validation unicité/casse. |
| CAT-25 | Add — type | idem | source | Si présent, doit distinguer income/expense. | P1/S | tous | Type requis, non modifiable si transactions sans migration. | Aucune inversion silencieuse. |
| CAT-26 | Add/Edit Cancel | idem | source | PASS. | PASS | tous | Conserver. | Pas de mutation. |
| CAT-27 | Add/Edit Save | idem | source | Feedback nécessaire. | P2/S | tous | Toast + focus sur ligne créée. | Création annoncée. |

## 17. Settings `/settings`

### Shell et navigation

| ID | Composant / contrôle | Source | Variantes | Observation | Sev./effort | Contexte | Recommandation | Acceptation |
|---|---|---|---|---|---|---|---|---|
| SET-01 | Titre Settings | `src/app/settings/page.tsx` | desktop/390 | Desktop correct. À 390 px, le titre/contenu sont repoussés par la navigation latérale. | P1/M | mobile | Empiler nav + contenu. | Titre x≥16 et largeur utile ≥viewport-32. |
| SET-02 | Wrapper navigation/contenu | `settings/page.tsx:132` | 390 mesuré | `flex gap-8` sans `flex-col` cause `scrollWidth=484` et contenu presque nul. | P1/S | ≤767 px | `flex-col md:flex-row`; nav en select/tabs scrollables mobile. | `document.scrollingElement.scrollWidth === innerWidth` à 320/390. |
| SET-03 | Nav Appearance | idem | clic/source | Destination claire. | PASS | desktop | Sur mobile, onglet horizontal ou select. | Actif annoncé. |
| SET-04 | Nav Notifications | idem | clic/source | PASS. | PASS | desktop | Idem. | Idem. |
| SET-05 | Nav Currency | idem | clic/source | PASS. | PASS | desktop | Idem. | Idem. |
| SET-06 | Nav Financial month | idem | clic/source | PASS. | PASS | desktop | Idem. | Idem. |
| SET-07 | Nav Balances | idem | clic/source | PASS. | PASS | desktop | Idem. | Idem. |
| SET-08 | Nav Data | idem | clic/source | PASS ; actions dangereuses doivent être séparées. | P1/S | tous | Zone « Danger » distante. | Reset jamais voisin d'Export. |
| SET-09 | Nav Help | idem | clic/source | PASS. | PASS | tous | Conserver. | Idem. |
| SET-10 | Nav About | idem | clic/source | PASS. | PASS | tous | Conserver. | Idem. |

### Appearance

| ID | Contrôle | Source | Variantes | Observation | Sev./effort | Contexte | Recommandation | Acceptation |
|---|---|---|---|---|---|---|---|---|
| APP-01 | Theme System | `components/settings/appearance-settings.tsx` | source | Bon choix. | PASS | tous | Conserver. | `aria-pressed` et aperçu. |
| APP-02 | Theme Light | idem | activé via dock/setting source | Clair fonctionne, mais muted/accent échouent au contraste. | P1/M | clair | Corriger tokens avant de présenter thème prêt. | WCAG AA texte. |
| APP-03 | Theme Dark | idem | testé | Globalement lisible ; focus blanc des inputs incohérent. | P1/S | sombre | Corriger Input/Textarea. | Aucun champ blanc au focus. |
| APP-04 | Accent Coral | `accent-context.tsx:29-35` | calcul contraste | Blanc sur coral = 2,82:1. | P1/M | clair | Foreground sombre ou accent plus foncé. | Ratio ≥4,5:1 petit texte. |
| APP-05 | Accent Ocean | idem | calcul | Blanc ≈4,02:1, échoue 4,5. | P1/M | clair | Foreground dynamique. | ≥4,5:1. |
| APP-06 | Accent Sage | idem | calcul | Blanc ≈2,22:1. | P1/M | clair | Foreground sombre. | ≥4,5:1. |
| APP-07 | Accent Violet | idem | calcul | Blanc ≈4,13:1. | P1/M | clair | Assombrir/dynamique. | ≥4,5:1. |
| APP-08 | Accent Rose | idem | calcul | Blanc ≈3,65:1. | P1/M | clair | Assombrir/dynamique. | ≥4,5:1. |
| APP-09 | Accent Graphite | idem | calcul | Blanc ≈3,26:1 dans une variante. | P1/M | thèmes | Calcul de contraste automatique. | ≥4,5:1. |
| APP-10 | Custom color | appearance component | source | L'utilisateur peut choisir n'importe quelle couleur sans garde de contraste. | P1/M | tous | Calcul live, choix foreground auto, refuser/pointer échec AA. | Aucun thème sauvegardé avec texte illisible. |
| APP-11 | Native color input | idem | source | Petit contrôle sans aperçu d'états (buttons/charts/focus). | P2/M | tous | Preview multi-composants. | Aperçu button/link/chart/focus. |

### Notifications

| ID | Contrôle | Source | Variantes | Observation | Sev./effort | Contexte | Recommandation | Acceptation |
|---|---|---|---|---|---|---|---|---|
| NOT-01 | Enable notifications | `components/settings/notification-settings.tsx` | source | Autorisation navigateur potentielle ; texte doit expliquer local/web. | P2/M | tous | Pré-écran explicatif avant permission. | Refus n'empêche pas l'app ; état visible. |
| NOT-02 | Budget threshold | idem | select | Bon réglage, mais dépend de budgets valides. | P1/S | tous | Disabled si budget non configuré + explication. | Aucune alerte absurde sur budget zéro. |
| NOT-03 | Feedback permission | idem | source | Besoin d'état enabled/denied/unsupported. | P2/S | tous | Badge état et lien réglages navigateur. | Statut exact visible. |

### Currency

| ID | Contrôle | Source | Variantes | Observation | Sev./effort | Contexte | Recommandation | Acceptation |
|---|---|---|---|---|---|---|---|---|
| CUR-01 | Base currency | `components/settings/currency-settings.tsx` | select/source | Modification peut changer l'affichage de toute l'app ; taux/conversion non expliqué. | P1/M | tous | Preview, source des taux, avertissement que données brutes ne changent pas. | Totaux avant/après explicables. |
| CUR-02 | Currency select options | idem | source | PASS contrôle standard. | PASS | tous | Conserver recherche si liste longue. | Devise + code annoncés. |

### Financial month

| ID | Contrôle | Source | Variantes | Observation | Sev./effort | Contexte | Recommandation | Acceptation |
|---|---|---|---|---|---|---|---|---|
| FM-01 | Mode Auto | `financial-month-settings.tsx` | source | Automatique basé salaire, mais logique/confiance non visibles. | P1/M | tous | Montrer date détectée et transactions sources. | Auto explicable, override possible. |
| FM-02 | Mode Fixed | idem | source | Clair. | PASS | tous | Conserver. | Jour requis/validé. |
| FM-03 | Mode Calendar | idem | source | Clair. | PASS | tous | Conserver. | Du 1 au dernier jour local. |
| FM-04 | Fixed day | idem | select | Jours invalides/mois courts à gérer. | P2/S | tous | Options 1–28 ou règle dernier jour. | Aucun intervalle impossible. |
| FM-05 | Minimum salary | idem | number | Critère technique, jargon. | P2/S | tous | Helper text/exemple. | Compréhensible sans connaissance du moteur. |
| FM-06 | Save | idem | clic/source | Feedback requis ; impact Analytics/Budgets immédiat. | P1/M | tous | Résumé des périodes recalculées + toast/undo. | Toutes pages utilisent la même période après save. |

### Balances et checkpoints

| ID | Contrôle | Source | Variantes | Observation | Sev./effort | Contexte | Recommandation | Acceptation |
|---|---|---|---|---|---|---|---|---|
| BAL-01 | Account select | `account-balance-settings.tsx` | source | PASS. | PASS | tous | Conserver. | Compte et devise. |
| BAL-02 | Initial balance | idem | number | Action financière structurante ; impact insuffisamment prévisualisé. | P1/M | tous | Preview solde actuel/recalculé. | Delta visible avant Save. |
| BAL-03 | Initial date | idem | date | PASS, validation vs première transaction. | P1/S | tous | Avertir si hors historique. | Cohérence temporelle. |
| BAL-04 | Save initial balance | idem | source | Feedback et confirmation nécessaires. | P1/S | tous | Toast + audit trail local. | Recalcul annoncé et réversible. |
| BAL-05 | Enable checkpoint | idem | toggle | Fonction avancée, bon concept. | P2/S | tous | Expliquer pourquoi/quand. | Effet compris. |
| BAL-06 | Checkpoint date | idem | date | PASS. | PASS | tous | Conserver. | Validation. |
| BAL-07 | Checkpoint balance | idem | number | Devise/impact. | P1/S | tous | Affixe + preview. | Réconciliation claire. |
| BAL-08 | Checkpoint note | idem | input | PASS. | PASS | tous | Conserver. | Label. |
| BAL-09 | Add checkpoint | idem | source | Mutant mais réversible par Delete ; feedback requis. | P1/S | tous | Confirmation inline et focus sur entrée. | Ajout annoncé. |
| BAL-10 | Cancel checkpoint | idem | source | PASS. | PASS | tous | Conserver. | Aucune mutation. |
| BAL-11 | Delete checkpoint | idem | non exécuté | Destructif ; confirmation et nom de date nécessaires. | P1/S | tous | Dialog explicite, Undo. | Aucun clic unique destructif. |
| BAL-12 | Recalculate | idem | source | Action complexe pouvant modifier affichage global. | P1/M | tous | Preview des comptes/écarts, journal. | Aucun recalcul silencieux. |

### Data, sauvegarde et zone dangereuse

| ID | Contrôle | Source | Variantes | Observation | Sev./effort | Contexte | Recommandation | Acceptation |
|---|---|---|---|---|---|---|---|---|
| DATA-01 | Compress export | `data-settings.tsx` | checkbox/source | Option technique « gzip » potentiellement obscure. | P2/S | tous | Valeur par défaut recommandée + helper. | Format de sortie clair. |
| DATA-02 | Encrypt export | idem | checkbox/source | Bonne option ; nécessite gestion passphrase. | P1/M | tous | Expliquer perte irrécupérable du mot de passe. | Avertissement avant export chiffré. |
| DATA-03 | Export | idem | source | Action sûre et importante. | PASS | tous | Afficher date/taille/format après téléchargement. | Fichier vérifiable et importable. |
| DATA-04 | Restore file | idem | file/source, non soumis | Action à haut impact. | P1/L | tous | Preview contenu/version/conflits, backup auto avant restore. | Aucune écriture avant preview. |
| DATA-05 | Passphrase dialog | idem | source | Champ secret ; erreurs doivent être neutres et action explicite. | P1/S | tous | Show/hide accessible, caps-lock, pas de stockage. | Mot de passe jamais journalisé. |
| DATA-06 | Restore strategy Replace | idem | source | Destructif. | P1/M | tous | Libellé « Replace all local data », confirmation forte. | Backup pré-restore obligatoire. |
| DATA-07 | Restore strategy Merge | idem | source | Risque doublons. | P1/L | tous | Rapport de conflits et déduplication. | Compteurs preview/after identiques aux attentes. |
| DATA-08 | Pre-restore backup | idem | checkbox/source | Bonne garde ; devrait être forcée par défaut. | P1/S | tous | Coché/verrouillé sauf justification. | Récupération testée. |
| DATA-09 | Download diagnostics | idem | source | Peut contenir données sensibles. | P1/M | tous | Lister/redacter le contenu, confirmation explicite. | Aucun montant/merchant personnel par défaut. |
| DATA-10 | Reset data | idem | non exécuté | Zone dangereuse présente. | P1/S | tous | Séparer visuellement, exiger export récent ou option, confirmation. | Impossible par clic accidentel. |
| DATA-11 | Type RESET | idem | source | Bonne friction, mais anglais/localisation. | P2/S | tous | Mot localisé ou phrase exacte affichée. | Validation exacte et accessible. |
| DATA-12 | Cancel reset | idem | source | PASS. | PASS | tous | Focus initial sur Cancel. | Action sûre prioritaire. |

### Help et About

| ID | Contrôle | Source | Variantes | Observation | Sev./effort | Contexte | Recommandation | Acceptation |
|---|---|---|---|---|---|---|---|---|
| HELP-01 | FAQ accordions | `help-settings.tsx` | source | Structure adaptée. | PASS | tous | Conserver ; boutons full-width. | État expanded annoncé. |
| HELP-02 | Aide import | idem | source | Doit documenter formats SG/historical et réconciliation. | P2/S | tous | Lier exemples sûrs. | Répond aux erreurs fréquentes. |
| HELP-03 | Aide confidentialité | idem | source | Promesse local-first à détailler pour notifications/diagnostics. | P1/M | tous | Matrice données locales/exportées. | Promesse exacte et vérifiable. |
| ABOUT-01 | Version/app info | `about-settings.tsx` | source | PASS. | PASS | tous | Ajouter version schéma DB/export. | Support peut identifier environnement. |
| ABOUT-02 | Liens/credits | idem | source | Vérifier ouverture externe et focus. | P3/S | tous | Icône external, URL visible. | Navigation prévisible. |

## 18. Passe typographie, espacements, rayons, ombres et iconographie

| Sujet | Preuve | Diagnostic | Sev./effort | Recommandation | Critère d'acceptation |
|---|---|---|---|---|---|
| Police | `globals.css:130` Inter | Bonne police UI et chiffres lisibles. | PASS | Conserver Inter, fallback système. | Pas de layout shift au chargement. |
| Échelle typographique | 374 occurrences de `text-xs`, `text-[10px]` ou `text-[11px]` dans le corpus inspecté | Le produit dépend trop du petit texte pour métadonnées, badges, raccourcis et légendes. À 390 px et en clair muted, lecture pénible. | P1/M | Minimum 14 px pour information nécessaire ; 12 px réservé aux métadonnées non critiques avec contraste ≥4,5. | Aucune date, montant, erreur ou action essentielle sous 14 px. |
| Capitales espacées | Nombreux `uppercase tracking-wider` | Cohérent sur KPI, mais bruit si répété sur chaque carte. | P3/S | Réserver aux eyebrow/section labels. | Maximum un niveau capitales par groupe. |
| Nombres | `tabular-nums` fréquent | Excellente pratique pour montants/tableaux. | PASS | Étendre à tous KPI et cellules. | Alignement stable lors des changements. |
| H1/H2 | Goals detail en h2 | Rupture sémantique. | P2/S | H1 par page. | Axe heading-order sans erreur. |
| Largeur de lecture | `AppLayout` plein écran | Sur 2400 px, les cartes s'étendent et les relations sont éloignées. | P2/M | `max-w-[1600px] mx-auto`; pages formulaires 960–1200 px. | Parcours visuel compact sans perdre densité. |
| Padding page | `px-6 sm:px-10 lg:px-12` | Bon desktop, parfois trop coûteux avec layouts internes mobile. | P2/S | `px-4 sm:px-6 lg:px-10`. | ≥16 px à 320, pas de débordement. |
| Padding cartes | souvent `px-6 py-4` | Agréable desktop ; trop spacieux dans listes denses. | P3/S | Variantes compact/comfortable. | Densité choisie par contexte, pas ad hoc. |
| Espacement Settings | `flex gap-8` | Provoque le défaut mobile majeur. | P1/S | Responsive stack. | Aucun overflow. |
| Rayons | token 12 px mais cartes `rounded-2xl`, inputs `rounded-xl`, listes `rounded-lg` | Hiérarchie plausible mais non documentée. | P2/S | Tokens surface/input/control/pill. | 4 niveaux maximum, appliqués systématiquement. |
| Ombres | tokens + valeurs Tailwind répétées | Système déclaré, mais valeurs recopiées et hover universel. | P2/M | Utiliser tokens/utilitaires ; hover seulement interactif. | 0 valeur shadow ad hoc sur composants communs. |
| Icônes | Lucide cohérent | Bonne famille ; icônes seules souvent sans label et cibles petites. | P1/M | API IconButton exigeant `label`. | TypeScript interdit IconButton sans label. |
| Mouvement | `animate-float-in`, pulse/spin, transitions | Agréable, mais pas de garde `prefers-reduced-motion` visible. | P2/S | Variant motion-safe et désactivation globale. | Aucun mouvement non essentiel en reduced-motion. |

## 19. Passe couleurs, contrastes et sémantique

### Mesures

| Paire | Ratio approximatif | Exigence | Résultat |
|---|---:|---:|---|
| Muted clair `#8E8E93` / blanc | 3,26:1 | 4,5:1 texte normal | **Échec P1** |
| Primaire clair `#FF6B4A` / blanc | 2,82:1 | 4,5:1 petit texte | **Échec P1** |
| Primaire sombre `#FF785A` / blanc | 2,60:1 | 4,5:1 petit texte | **Échec P1** |
| Muted sombre `#98989D` / carte `#18181A` | 6,17:1 | 4,5:1 | PASS |
| Bordure clair `#EEEEF2` / blanc | 1,16:1 | 3:1 si seule délimitation | **Échec** lorsqu'elle porte seule la forme |

### Défauts de tokens

- `globals.css:17-24` donne exactement le corail à `destructive`, `success`, `warning` et `info`. En sombre, les quatre restent quasi identiques (`:70-76`). Une application financière doit distinguer au minimum : vert/teal succès, ambre avertissement, rouge erreur/danger, bleu information, en conservant icône et texte.
- Les presets d'accent ne recalculent que `primary`, `ring` et `chart-1` (`accent-context.tsx:29-35`). `primary-foreground` reste blanc, même quand l'accent choisi est trop clair.
- Les graphiques utilisent une rampe corail neutre (`globals.css:48-54`) : acceptable pour intensité ordonnée, mauvaise pour séries catégorielles indépendantes.
- La bordure à 1,16:1 disparaît sur écran lumineux. Les formulaires sans bordure reposent sur `bg-muted/50`, insuffisant selon l'écran.

### Critères d'acceptation couleurs

1. Tous textes normaux et icônes informatives : ≥4,5:1 ; gros texte ≥3:1.
2. Focus, frontières indispensables et éléments graphiques : ≥3:1 contre l'adjacent.
3. Aucun état n'est codé seulement par couleur : icône + libellé + éventuellement motif.
4. Chaque accent calcule automatiquement un foreground noir ou blanc conforme.
5. Tests automatisés couvrent les six presets en clair/sombre.
6. Les séries revenus, dépenses, solde, salaire, transfert conservent la même couleur sémantique sur toutes les pages.

## 20. Passe des états interactifs

| État | Couverture observée | Problème principal | Sev./effort | Acceptation |
|---|---|---|---|---|
| Default | toutes routes | Globalement cohérent. | PASS | Tokens uniques. |
| Hover | cartes, lignes, actions | Cartes statiques se soulèvent ; actions critiques uniquement au hover. | P1/M | Hover n'est jamais l'unique accès. |
| Focus | inputs, boutons, Radix | Ring présent ; input devient blanc en sombre ; lignes `div` non focusables. | P1/M | Focus ≥3:1, aucun changement de thème, ordre complet. |
| Active/pressed | tabs, thème, scénarios | Souvent visuel, parfois pas d'ARIA explicite. | P2/S | `aria-selected`, `aria-pressed`, `aria-current`. |
| Disabled | Create dialogs, file upload | Visuellement présent ; raison rarement exposée. | P2/S | Helper/tooltip focusable ou message requis. |
| Loading | skeletons/spinner | Bon visuel, peu d'annonce et reduced-motion. | P2/S | `aria-busy`, live status, motion-safe. |
| Empty | nombreuses routes | Transactions/Goals/Subscriptions bons ; Budgets/Plan transforment vide en succès. | P0/P1 | État `unconfigured` distinct. |
| Error | inline, banner, import | Import est le meilleur modèle ; erreur générale peut disparaître en écran blanc. | P0/M | ErrorBoundary utile et récupération. |
| Success | import, budgets | Import conditionne correctement le succès ; Budgets/Plan non. | P0/M | Succès seulement après règles de qualité. |
| Confirmation | delete/reset/restore | Gardes présentes dans plusieurs sources ; cohérence à renforcer. | P1/M | Pattern DangerDialog unique avec cible/impact/undo. |
| Toast | mutations | Feedback non systématique, notamment Budget Settings. | P1/M | Chaque mutation annonce pending/success/error. |
| Offline/local-first | Dashboard/Data | Promesse affichée, pas d'état stockage/quota. | P2/M | Statut local, dernière sauvegarde, quota/erreur. |

## 21. Pages à refaire entièrement

### 21.1 Plan — refonte complète, priorité P0

La page ne doit plus être un grand formulaire libre suivi d'un forecast convaincant. Direction recommandée :

1. **Étape « Situation de départ »** : comptes inclus, soldes réconciliés et date.
2. **Étape « Revenus »** : confirmé vs estimé, source et calendrier.
3. **Étape « Obligations »** : prélèvements et abonnements synchronisés, impôts datés.
4. **Étape « Vie courante »** : enveloppes issues des dépenses réelles avec plage modifiable.
5. **Étape « Scénarios »** : prudent/base/optimiste côte à côte, bandes d'incertitude.
6. **Résultat** : semaines à risque, action concrète et aucun verdict si une étape est incomplète.

Critère final : un profil vide ne peut jamais afficher « Target reached » ni une somme positive prévisionnelle.

### 21.2 Settings mobile — refonte structurelle P1

Remplacer la navigation latérale + contenu côte à côte par : titre, select/segmented navigation sticky, contenu pleine largeur, actions Save sticky uniquement quand nécessaires. Les zones Balance/Data doivent afficher le niveau de risque.

Critère final : 320×568, 390×844 et zoom 200 % sans overflow horizontal, contenu caché ou dialogue hors écran.

### 21.3 Calendar mobile — vue dédiée P1

La grille mensuelle 7 colonnes n'est pas adaptée à 390 px. Afficher une bande de jours ou mini-calendrier puis une liste agenda par date. Garder la grille complète sur tablette/desktop.

Critère final : chaque facture affiche date, marchand, montant, statut sans troncature à 320 px.

### 21.4 Accounts mobile — table → cartes P1

Carte compacte : icône/nom/type, institution/date, solde, menu actions toujours visible. Le desktop peut conserver une vraie table sémantique.

Critère final : aucun scroll/crop ; solde et actions accessibles clavier/tactile.

### 21.5 Budgets vide/non configuré — refonte de l'état initial P1

Remplacer KPI/graphes/verdicts à zéro par un assistant : détecter revenu, choisir règle, vérifier catégories, confirmer budget. Ensuite seulement afficher pace et alertes.

Critère final : aucune phrase positive/négative tant que les données ne permettent pas le calcul.

## 22. Direction visuelle 2026–2027 adaptée à WealthPilot

La bonne direction n'est pas un effet « futuriste » ou glassmorphism. Pour une finance familiale sous contrainte, l'esthétique doit évoquer un **carnet de pilotage calme et vérifiable** :

- surfaces sobres, peu d'ombres, séparation par espace et bordures réellement perceptibles ;
- chiffres très lisibles, tabulaires, avec période et provenance adjacentes ;
- une couleur d'accent de marque, mais des couleurs sémantiques indépendantes ;
- progressive disclosure : résumé familial → détail du compte → transaction source ;
- scénarios et prévisions présentés comme fourchettes, pas comme certitudes ;
- un « data confidence layer » visible : confirmé, estimé, incomplet, à réconcilier ;
- graphiques avec labels directs, comparaison au mois précédent et table alternative ;
- mobile orienté actions immédiates (solde, prochaine échéance, budget semaine), desktop orienté analyse ;
- densité confortable/compacte selon le composant, pas un unique gabarit de grande carte ;
- microfeedback local : sauvegarde, recalcul, filtre, import et erreur expliqués près de l'action.

### Tokens cibles

| Famille | Proposition fonctionnelle |
|---|---|
| Surface | background, surface-1, surface-2, overlay ; contraste clair/sombre vérifié |
| Texte | primary, secondary AA, tertiary AA pour 14 px minimum, inverse |
| Accent | accent + on-accent calculé, accent-muted, focus |
| Sémantique | positive, warning, danger, info + on-* + subtle-* |
| Données | income, expense, balance, transfer, forecast, uncertainty |
| Espace | 4/8/12/16/24/32/48 ; aucune valeur arbitraire hors exceptions documentées |
| Rayon | control 10, surface 16, overlay 20, pill 999 |
| Ombre | none, raised-interactive, overlay ; pas de hover sur statique |
| Mouvement | 120/180/240 ms ; reduced motion à zéro |

## 23. Validation finale de complétude

### Routes de production

- [x] Dashboard `/`
- [x] Transactions `/transactions`
- [x] Analytics `/analytics`
- [x] Budgets `/budgets` + panneau Settings
- [x] Plan `/plan`
- [x] Goals `/goals`
- [x] Goal detail `/goals/1` Emergency Fund
- [x] Goal detail `/goals/2` Car Maintenance
- [x] Goal detail `/goals/3` Family Vacation
- [x] Goal detail `/goals/4` Big Plan (House/Car)
- [x] Goal detail `/goals/5` Child 1 Savings
- [x] Goal detail `/goals/6` Child 2 Savings
- [x] Subscriptions `/subscriptions`, onglets Subscriptions/Bills/Loans/Income/Ended, Add dialog
- [x] Calendar `/calendar`, mois précédent/suivant/Today/jours
- [x] Accounts `/accounts`, SSR + état antérieur + source + incident runtime
- [x] Import `/import`, stepper + upload/preview/importing/complete source + incident runtime
- [x] Categories `/categories`, built-ins/sous-catégories/dialogues source
- [x] Settings `/settings`, huit sections et dialogues à risque source

### Contrôles globaux

- [x] Six destinations principales du dock
- [x] More et ses six destinations secondaires
- [x] Notifications
- [x] Theme toggle clair/sombre
- [x] Account switcher
- [x] Recherche/commande et raccourci
- [x] Confidentialité dans le shell source
- [x] État base de données/toast/loading/error

### États

- [x] Desktop clair
- [x] Desktop sombre
- [x] Mobile 390 clair
- [x] Mobile 390 sombre
- [x] Tablette / grand desktop
- [x] Empty
- [x] Populated
- [x] Loading (source + rendu)
- [x] Disabled
- [x] Hover/focus/active
- [x] Error/success
- [x] Dialog/menu/tab/filter
- [x] Actions destructives inspectées sans exécution

### Routes non production

`/lab`, `/lab/v1` … `/lab/v10` sont des variantes de laboratoire non reliées à la navigation produit. Elles doivent être exclues du build de production ou protégées par un flag. Si elles sont destinées aux utilisateurs, elles nécessitent un audit distinct avant exposition.

## 24. Ordre de correction recommandé

1. **P0 :** fiabiliser Plan et bloquer tout verdict sur hypothèses incomplètes.
2. **P0 :** reproduire/corriger les écrans blancs Accounts/Import et ajouter ErrorBoundary + tests de navigation directe.
3. **P1 :** Settings mobile, dock mobile, Accounts/Calendar responsive.
4. **P1 :** noms accessibles, clavier DataTable, focus sombre, cibles tactiles.
5. **P1 :** tokens contraste/sémantique et presets d'accent.
6. **P1 :** états `empty`/`unconfigured`/`success` dans Budgets et Plan.
7. **P1 :** réconciliation inter-pages Analytics/Categories/Budgets/Plan et séparation transferts/dépenses.
8. **P2 :** densité, titres, cartes statiques, graphiques accessibles, localisation.
9. **P2/P3 :** direction visuelle, tokens unifiés, mouvement, finition.

Ce registre est le niveau de référence : une correction n'est terminée que lorsque son critère d'acceptation passe en thèmes clair et sombre, à 390 px et desktop, au clavier et dans l'arbre d'accessibilité.

## Annexe A — census explicite des contrôles répétés

Cette annexe évite qu'un contrôle répété soit masqué par une ligne générique. Les constats et critères détaillés restent ceux du registre principal.

### A.1 Boutons de jour rendus en septembre 2026

| Contrôle | Route/source | Variante réellement vue | Résultat | Sévérité | Acceptation |
|---|---|---|---|---|---|
| Jour 1 | `/calendar`, `calendar/page.tsx:421+` | desktop clair/sombre | nom AX « 1 » uniquement | P1 | date complète dans le nom |
| Jour 2 | idem | idem | nom AX « 2 » uniquement | P1 | date complète |
| Jour 3 | idem | idem | nom AX « 3 » uniquement | P1 | date complète |
| Jour 4 | idem | idem | nom AX « 4 » uniquement | P1 | date complète |
| Jour 5 | idem | idem | nom AX « 5 » uniquement | P1 | date complète |
| Jour 6 | idem | idem | nom AX « 6 » uniquement | P1 | date complète |
| Jour 7 | idem | idem | nom AX « 7 » uniquement | P1 | date complète |
| Jour 8 | idem | idem | nom AX « 8 » uniquement | P1 | date complète |
| Jour 9 | idem | idem | nom AX « 9 » uniquement | P1 | date complète |
| Jour 10 | idem | idem | nom AX « 10 » uniquement | P1 | date complète |
| Jour 11 | idem | idem | nom AX « 11 » uniquement | P1 | date complète |
| Jour 12 | idem | idem | nom AX « 12 » uniquement | P1 | date complète |
| Jour 13 | idem | idem | nom AX « 13 » uniquement | P1 | date complète |
| Jour 14 | idem | idem | nom AX « 14 » uniquement | P1 | date complète |
| Jour 15 | idem | idem | nom AX « 15 » uniquement | P1 | date complète |
| Jour 16 | idem | idem | nom AX « 16 » uniquement | P1 | date complète |
| Jour 17 | idem | idem | nom AX « 17 » uniquement | P1 | date complète |
| Jour 18 | idem | idem | nom AX « 18 » uniquement | P1 | date complète |
| Jour 19 | idem | idem | nom AX « 19 » uniquement | P1 | date complète |
| Jour 20 | idem | idem | nom AX « 20 » uniquement | P1 | date complète |
| Jour 21 | idem | idem | nom AX « 21 » uniquement | P1 | date complète |
| Jour 22 | idem | idem | nom AX « 22 » uniquement | P1 | date complète |
| Jour 23 | idem | idem | nom AX « 23 » uniquement | P1 | date complète |
| Jour 24 | idem | idem | nom AX « 24 » uniquement | P1 | date complète |
| Jour 25 | idem | idem | nom AX « 25 » uniquement | P1 | date complète |
| Jour 26 | idem | idem | nom AX « 26 » uniquement | P1 | date complète |
| Jour 27 | idem | idem | nom AX « 27 » uniquement | P1 | date complète |
| Jour 28 | idem | idem | nom AX « 28 » uniquement | P1 | date complète |
| Jour 29 | idem | clic réel, vide | aucun feedback après clic | P2 | sélection + panneau vide annoncés |
| Jour 30 | idem | visible | nom AX « 30 » uniquement | P1 | date complète |

### A.2 Lignes de semaine du plan

| Ligne | Route/source | État inspecté | Résultat | Sévérité | Acceptation |
|---|---|---|---|---|---|
| Week 1 | `/plan`, `plan/page.tsx` | forecast initial | table sémantique, données dérivées d'hypothèses incomplètes | P0 | watermark/bloqué si incomplet |
| Week 2 | idem | idem | idem | P0 | idem |
| Week 3 | idem | idem | idem | P0 | idem |
| Week 4 | idem | idem | idem | P0 | idem |
| Week 5 | idem | idem | idem | P0 | idem |
| Week 6 | idem | idem | idem | P0 | idem |
| Week 7 | idem | idem | idem | P0 | idem |
| Week 8 | idem | idem | idem | P0 | idem |
| Week 9 | idem | idem | idem | P0 | idem |
| Week 10 | idem | idem | idem | P0 | idem |
| Week 11 | idem | idem | idem | P0 | idem |
| Week 12 | idem | idem | idem | P0 | idem |
| Week 13 | idem | idem | idem | P0 | idem |

### A.3 Pastilles de couleur du dialogue New Goal

| Contrôle | Route/source | Résultat | Sévérité | Recommandation | Acceptation |
|---|---|---|---|---|---|
| Swatch 1 | `/goals`, New Goal | bouton sans nom | P1 | nom de couleur + `aria-pressed` | nom/état annoncés |
| Swatch 2 | idem | bouton sans nom | P1 | idem | idem |
| Swatch 3 | idem | bouton sans nom | P1 | idem | idem |
| Swatch 4 | idem | bouton sans nom | P1 | idem | idem |
| Swatch 5 | idem | bouton sans nom | P1 | idem | idem |
| Swatch 6 | idem | bouton sans nom | P1 | idem | idem |

## Annexe B — contrôles volontairement non soumis

| Contrôle | Pourquoi non soumis | Ce qui a tout de même été vérifié | Condition de recette ultérieure |
|---|---|---|---|
| Import & verify | Écrit un lot de transactions financières | enabled/disabled, libellé, preview, atomicité et écrans résultat via source | base jetable + fichier fixture |
| Auto-Detect subscriptions | Peut créer/modifier des récurrences | présence, emplacement, source et absence d'aperçu | clone IndexedDB puis comparaison |
| Create Goal / Add contribution | Crée/modifie les données | validation initiale, champs, états disabled, séparation virtuel/réel | profil fixture |
| Create Subscription/Bill/Loan/Income | Crée des engagements | tous champs et conditionnels du dialog | profil fixture + rollback |
| Add/Edit/Delete Account | Modifie soldes et historique | SSR, source, dialogues et gardes | profil fixture + test E2E |
| Delete Category | Peut affecter classification | règles disabled et menu | catégorie fixture sans transaction |
| Restore/Replace/Merge | Peut écraser toute la base locale | stratégie, passphrase, backup, garde source | copie complète + navigateur isolé |
| Reset data | Destruction complète | zone, saisie RESET et cancel source | profil jetable uniquement |
| Delete checkpoint | Change réconciliation des soldes | bouton, garde et impact source | compte fixture |

## Contre-audit phase 2 — lot B (29 septembre 2026)

### Protocole de revalidation

- Relecture croisée du registre D-01…D-10, T-01…T-24, A-01…A-15 et B-01…B-27 contre le code final.
- Rendus réels sur `http://localhost:3000` avec Chrome headless en 1440 px clair et 390 px sombre ; contrôle additionnel des points de rupture 768/320 par classes et structure responsive.
- Parcours des états sans données et chargement. Le bootstrap global reste bloqué par la bannière « Chargement de vos données locales… » dans le profil Chrome isolé : ce défaut appartient au shell/database context, hors lot B, et empêche un parcours destructif avec données réelles.
- Contrôles statiques : ESLint ciblé sans warning, TypeScript sans erreur, tests financiers et build de production.

### Matrice Dashboard

| IDs | État final | Preuve / décision |
|---|---|---|
| D-01, D-03, D-04 | PASS | H1, périmètre, onboarding et CTA Import conservés. |
| D-02, D-05 | PASS corrigé | Dashboard et messages local-first entièrement en français ; contraste dépend désormais des tokens globaux accessibles. |
| D-06, D-07 | PASS corrigé | Anciens composants redondants supprimés ; synthèse inline structurée, montants tabulaires, signes et explications factuelles. |
| D-08 | PASS corrigé | Conteneur Recharts dimensionné, palette tokenisée, période explicite, état vide réel et tableau alternatif. |
| D-09 | PASS corrigé | Échéances empilées sous 640 px ; date, libellé et montant restent visibles ; locale française. |
| D-10 | PASS corrigé par retrait | Le composant d’insights non explicables, mort et non importé a été supprimé. |

### Matrice Transactions

| IDs | État final | Preuve / décision |
|---|---|---|
| T-01…T-05 | PASS corrigé | Totaux liés explicitement aux dates filtrées ; flux net qualifié « Excédent/Déficit ». |
| T-06…T-08 | PASS avec réserve P3 | Filtres nommés et localisés. Recherche interne de catégories différée tant que la liste reste courte (<15). |
| T-09…T-10 | PASS corrigé | Noms accessibles distincts « Date de début/fin ». |
| T-11…T-13 | PASS corrigé | Libellé « Annuler la sélection », export désactivé avec raison à zéro résultat, compteur en région live. |
| T-14…T-16 | PASS corrigé | `aria-sort`, cartes mobiles dédiées et table desktop avec largeur minimale/scroll local. |
| T-17…T-21 | PASS corrigé | Actions visibles sur tactile, noms contextualisés, confirmation de suppression et checkboxes nommées. |
| T-22…T-23 | PASS corrigé | États base vide/filtre vide séparés ; dialogue localisé et responsive. |
| T-24 | PASS statique | Aucun contrôle anonyme trouvé dans les composants du lot ; une passe axe automatisée reste recommandée quand le bootstrap global est débloqué. |

### Matrice Analytics

| IDs | État final | Preuve / décision |
|---|---|---|
| A-01…A-06 | PASS corrigé | Périmètre, dates exactes, onglets français 1M/3M/6M/12M/Année, cibles tactiles 44 px. |
| A-07…A-11 | PASS corrigé | Règles d’inclusion visibles, surplus/déficit explicite, moyennes annoncées sur mois complets uniquement. |
| A-12 | PASS corrigé | Graphiques avec tokens, taille minimale, légendes et tableaux alternatifs accessibles. |
| A-13 | PASS corrigé | État vide propose changement vers 12 mois et import en un clic. |
| A-14 | PASS avec réserve P3 | Séries principales multi-hue + tableau alternatif ; la couleur historique des catégories reste secondaire et ne porte plus seule l’information. |
| A-15 | PASS corrigé | Méthode salaire explicitée et lien « Voir » par mois vers les crédits sources filtrés. |

### Matrice Budgets

| IDs | État final | Preuve / décision |
|---|---|---|
| B-01…B-03 | PASS corrigé | Français homogène ; mois précédent/suivant/Ce mois ; panneau accessible et sauvegarde automatique annoncée. |
| B-04…B-08 | PASS corrigé | Aucun graphe, verdict ou félicitation à revenu inconnu ; état non configuré neutre avec CTA. |
| B-09…B-11 | PASS corrigé | Réel/objectif visibles, tableaux alternatifs, remboursement déduit et transferts internes neutralisés. |
| B-12 | PASS corrigé | Boutons édition/enregistrement/annulation nommés par catégorie. |
| B-13…B-15 | PASS corrigé | Revenu intelligent expliqué, confiance traduite, impact des presets prévisualisé en montants. |
| B-16…B-24 | PASS corrigé | Overrides optimistes, spinner, annonce live de succès/échec et reset global. |
| B-25 | PASS financier | `isRealExpense` exclut les transferts quelle que soit leur présentation ; pas de double comptage. |
| B-26 | PASS lot B / dépendance Plan | Taxes alimentent correctement Budgets ; la synchronisation narrative avec Plan reste à valider dans le lot Plan. |
| B-27 | PASS corrigé | Preset, revenu manuel et répartition personnalisée persistés en IndexedDB avec feedback live ; test de round-trip ajouté. |

### Résidus hors lot B observés pendant la recette

| Résidu | Sévérité | Propriétaire |
|---|---|---|
| Bannière globale de chargement persistante dans un profil navigateur isolé, qui bloque l’interaction avec les données locales. | P0 | shell / `database-context` |
| Débordement horizontal mobile visible au niveau du shell/dock, y compris autour de 390 px. | P1 | shell / layout |
| Validation Analytics/Budgets avec un jeu IndexedDB peuplé impossible tant que le bootstrap global reste bloqué. | P1 recette | shell puis QA |
