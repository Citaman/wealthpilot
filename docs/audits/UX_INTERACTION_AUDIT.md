# WealthPilot — audit UX, interactions et parcours fonctionnels

Date de l’audit : 29 septembre 2026
Application testée : `http://localhost:3000`
Périmètre : toutes les routes produit, navigation globale, deux comptes, import, transactions, budgets, objectifs, plan 13 semaines, analytics, récurrents, calendrier, notifications, réglages, thèmes, confidentialité, accessibilité et responsive.
Nature : audit uniquement. Aucun fichier produit ni aucune donnée financière n’a été volontairement modifié ou supprimé.

## 1. Convention de lecture

| Valeur | Définition |
|---|---|
| PASS | Le contrôle accomplit l’action attendue, avec un résultat compréhensible et vérifiable. |
| FAIL | Le contrôle ne fonctionne pas, trompe sur son effet, produit une incohérence, ou rend la tâche impossible. |
| AMBIGU | L’action technique existe, mais son périmètre, son résultat ou son feedback n’est pas suffisamment clair. |
| P0 | Risque de décision financière erronée, perte/corruption de donnée, mauvais compte, ou fonction centrale inutilisable. |
| P1 | Blocage important, forte perte de confiance, accessibilité critique, ou page centrale à refaire. |
| P2 | Friction fréquente, compréhension insuffisante, incohérence ou défaut responsive sérieux. |
| P3 | Finition, microcopie, détail visuel ou optimisation secondaire. |
| S/M/L | Effort estimé petit / moyen / grand. |

Les contrôles destructifs ont été ouverts ou inspectés jusqu’à l’étape précédant leur confirmation. Les suppressions de compte, transaction, objectif, récurrent, catégorie, checkpoint, sauvegarde et reset complet n’ont pas été confirmées.

## 2. Données et preuves de référence

Les écrans ont été observés avec les données existantes des comptes suivants :

| Compte | Solde affiché | Observation |
|---|---:|---|
| Société Générale | 0 € | Compte vraisemblablement orphelin ou créé avant les deux imports définitifs. |
| Anthonny | 1 774 € | Institution affichée `Unknown`; dernier checkpoint signalé au 25/09. |
| Mirane | −253 € | Institution affichée `Unknown`. |
| Foyer | 1 521 € | Somme visible des comptes actifs. |

Contradictions reproduites :

| Surface | Période visible | Revenus | Dépenses | Net | Règle apparente |
|---|---|---:|---:|---:|---|
| Dashboard / résumé septembre | septembre partiel | 4 616 € | 5 624 € | −1 009 € | Tous les crédits sont assimilés à des revenus. |
| Goals / connexion au flux | septembre partiel | implicite | implicite | −1 009 € | Réutilise l’ancien moteur Dashboard. |
| Analytics / Spending Calendar | septembre partiel | 4 401 € | 5 624 € | −1 223 € | Salaire + CAF; remboursements et transferts internes exclus. |
| Analytics / YTD | jan.–sept. | 25 506 € | 25 652 € | −146 € | Moteur mensuel corrigé. |
| Categories / 12 mois | 12 mois | 28 001,67 € | 25 652,05 € | non affiché | Somme brute des crédits/débits par catégorie. |
| Transactions / filtre par défaut | 01/07–30/09 | 16 542 € | 17 715 € | −1 173 € | Tous crédits/débits de la période; période différente peu rappelée dans les KPI. |

La différence de 215 € entre Dashboard et Analytics en septembre est visible simultanément dans le produit et détruit la confiance. Le moteur d’Analytics doit devenir l’unique source de vérité.

## 3. Journal des dix passes

| Passe | Angle | Routes et actions réellement couvertes | Résultat principal |
|---:|---|---|---|
| 1 | Inventaire exhaustif | `/`, `/transactions`, `/analytics`, `/budgets`, `/plan`, `/goals`, `/goals/1`, `/subscriptions`, `/calendar`, `/accounts`, `/import`, `/settings`, `/categories`, `/lab`, `/lab/v1` à `/lab/v10`; inventaire des boutons, tabs, menus, dialogues et liens par arbre d’accessibilité et code source. | Toutes les surfaces produit et routes internes ont été cartographiées. `/lab` reste publiquement accessible. |
| 2 | Navigation et découvrabilité | Dock, six destinations primaires, menu More, notifications, thème, compte, Cmd/Ctrl+K, raccourcis `G …`, liens secondaires et retours. | Recherche et confidentialité sont cachées; Categories absent; compte actif représenté uniquement par une pastille. |
| 3 | Foyer et multi-comptes | Ouverture du sélecteur, affichage All/Anthonny/Mirane, sélection Mirane, observation du recalcul Dashboard, retour All Accounts, navigation vers les pages. | Dashboard se recalcule, mais le périmètre n’est jamais nommé dans la page; certaines pages sont foyer par nature, d’autres filtrables, sans contrat visible. |
| 4 | Import et qualité | Sélection de compte, état désactivé avant sélection, choix Anthonny, zone de fichier activée, création rapide inspectée, états Preview/Import/Complete et logique d’erreur/doublon inspectés. | Parcours de base solide; risque d’import dans le mauvais compte insuffisamment prévenu; absence d’un vrai parcours « deuxième compte ». |
| 5 | Transactions | Recherche, 4 familles de filtres, dates, tri, pagination, sélection, édition, exclusion, type budget, tags, création récurrente, bulk et export inspectés; dialogues ouverts sans sauvegarde/suppression. | Très riche fonctionnellement; table inaccessible, actions cachées au hover et création récurrente susceptible d’utiliser le mauvais compte. |
| 6 | Budgets, Goals, Plan | Paramètres budget, presets, cartes catégorie, types; liste objectifs, détail objectif 1, contributions et menus; scénarios et hypothèses du plan. | Les trois surfaces ne forment pas encore un parcours décisionnel. Le plan calcule bien mais une cible 0 rend le succès trivial. |
| 7 | Analytics | Tabs 1M/3M/6M/1Y/YTD, trois graphiques, table salaires, marchands, habitudes, calendrier et textes méthodologiques. | Meilleure base de calcul; manque drilldown/table accessible; périmètre « household » ambigu sous filtre compte. |
| 8 | Récurrents, calendrier, notifications | Cinq tabs Subscriptions, boutons Add/Auto-Detect, dialogues add/link/merge/history inspectés; calendrier mois/jours/détail; cloche et actions notification inspectées. | Trois moteurs concurrents; Auto-Detect « tous comptes » ne traite que le premier compte; calendrier vide malgré de nombreuses habitudes. |
| 9 | Mobile, clavier, états limites | Navigation clavier Cmd/Ctrl+K, Escape, focus; arbres AX; états disabled/empty/loading; inspection responsive des grilles et tables; rendu clair/sombre observé. | Dock trop large pour 390 px; tables Transactions/Accounts non enveloppées; nombreux boutons sans nom; clair sous-contrasté. |
| 10 | Nielsen, cohérence et retest | Retest des chiffres, comptes, plan, thèmes, contrôles Settings et actions sans feedback; relecture du code des actions destructrices. | Les anomalies majeures sont reproductibles et proviennent de moteurs/périmètres distincts, pas d’un simple défaut cosmétique. |

Note d’environnement : une seconde session de navigateur demandée pour une dernière boucle mobile n’était plus disponible après la première série exhaustive. Les constats mobile ont donc été recoupés avec les classes responsive et largeurs minimales des composants. Les observations desktop, clair/sombre et clavier proviennent bien de `localhost:3000`.

## 4. Passe 1 — inventaire route × composant × action

### 4.1 Navigation globale — `src/components/layout/command-dock.tsx`

| Route | Contrôle | Précondition | Action testée | Attendu | Observé | Résultat | Impact | Sév. | Effort | Correction | Critère d’acceptation |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Toutes | Dashboard | Aucune | Clic icône | Aller à `/` et indiquer l’état actif | Navigation OK; icône seule, tooltip desktop | AMBIGU | Découverte faible au toucher | P2 | M | Libellé visible ou nav adaptative | Destination identifiable sans hover |
| Toutes | Transactions | Aucune | Clic icône | Aller à `/transactions` | Navigation OK | PASS | — | P3 | S | Conserver | Route atteinte et focus logique |
| Toutes | Analytics | Aucune | Clic icône | Aller à `/analytics` | Navigation OK | PASS | — | P3 | S | Conserver | Idem |
| Toutes | Budgets | Aucune | Clic icône | Aller à `/budgets` | Navigation OK | PASS | — | P3 | S | Conserver | Idem |
| Toutes | Goals | Aucune | Clic icône | Aller à `/goals` | Navigation OK | PASS | — | P3 | S | Conserver | Idem |
| Toutes | 13-week plan | Aucune | Clic icône | Aller à `/plan` | Navigation OK | PASS | — | P3 | S | Conserver | Idem |
| Toutes | More navigation, icône clé | Aucune | Ouvrir menu | Exposer les destinations secondaires | Subscriptions, Calendar, Accounts, Import, Settings présents; icône « outil » non standard | AMBIGU | Mauvaise prédictibilité | P2 | S | Icône ellipsis + libellé Plus | 90 % des testeurs anticipent sa fonction |
| Toutes | Categories | Aucune | Chercher dans navigation | Accès direct | Absent du dock et de More; seulement via Dashboard | FAIL | Fonction importante quasi cachée | P1 | S | Ajouter dans More/gestion | Atteignable en ≤2 actions |
| Toutes | Recherche globale | Aucune | Cmd/Ctrl+K | Ouvrir palette | Fonctionne et propose actions + syntaxe avancée | PASS | Très utile | P3 | S | Conserver | Palette ouverte au clavier |
| Toutes | Recherche globale tactile | Aucune | Chercher un bouton Search | Bouton visible | `Search` importé mais aucun contrôle rendu | FAIL | Inaccessible mobile/souris | P1 | S | Ajouter bouton dans barre/dock | Ouverture sans raccourci clavier |
| Toutes | Raccourcis `G D/T/B/A/G/P/S/I` | Focus hors champ | Séquence clavier | Navigation rapide | Implémentée; non documentée hors palette | AMBIGU | Peu découvrable | P3 | S | Aide raccourcis | Raccourcis visibles et désactivés dans champs |
| Toutes | Notifications | Alertes existantes | Ouvrir cloche | Lire/agir/marquer/dismiss | Menu fonctionne; actions internes | PASS | — | P3 | S | Conserver | Lecture/dismiss persistants |
| Toutes | Mark all read | Notifications non lues | Clic | Marquer l’ensemble | Implémenté avec feedback visuel via compteur | PASS | — | P3 | S | Conserver | Compteur devient zéro |
| Toutes | Dismiss notification | Notification visible | Clic X | Masquer sans activer lien | Propagation stoppée et statut stocké | PASS | — | P3 | S | Ajouter label accessible | X annoncé « Masquer … » |
| Toutes | Toggle theme | Aucune | Clic | Basculer clair/sombre | Bascule visible; système concurrent dans Settings | AMBIGU | Icône/état peut se désynchroniser | P1 | M | Un seul ThemeProvider | Même état partout après reload |
| Toutes | Privacy mode | Aucune | Chercher contrôle puis `Shift+P` | Masquer les montants | Raccourci contextuel existe, aucun bouton dans le dock | FAIL | Fonction privée invisible sur mobile | P1 | S | Restaurer œil/œil barré | Contrôle visible et état annoncé |
| Toutes | Account switcher | ≥1 compte | Ouvrir pastille | Choisir foyer/compte | Menu affiche All, Société Générale, Anthonny, Mirane et soldes | PASS | — | P3 | S | Conserver menu | Tous comptes listés |
| Toutes | Indication du compte actif | Compte individuel sélectionné | Fermer menu | Voir le périmètre courant | Une pastille de couleur sans texte | FAIL | Risque de lire des chiffres dans le mauvais périmètre | P0 | M | Afficher `Foyer`, `Anthonny`, `Mirane` | Chaque page montre compte + période |
| Toutes | Dock mobile | 320–390 px | Inspection structure | Tenir sans masquer | 6 icônes + More + 3 utilitaires, largeur estimée > viewport | FAIL | Navigation coupée/compacte illisible | P1 | L | 4 tabs + Plus mobile | Aucun overflow à 320 px |
| `/lab` | Routes de variantes | URL connue | Accès direct | Dev-only | Index et dix variantes accessibles | FAIL | Surface interne exposée/confuse | P2 | S | Gater hors développement | 404 en production |

### 4.2 Dashboard — `src/app/page.tsx` et `src/components/dashboard/*`

| Contrôle/composant | Fichier source | Précondition | Action | Attendu | Observé | Résultat | Impact | Sév. | Effort | Correction | Critère |
|---|---|---|---|---|---|---|---|---|---|---|---|
| WelcomeHeader | `welcome-header.tsx` | Données chargées | Lire | Contexte personnalisé | « Good morning, there » générique | AMBIGU | Faible valeur | P3 | S | Nom de foyer ou retirer | Salutation pertinente |
| Savings rate | `quick-stats.tsx`, `use-data.ts` | Septembre | Comparer Analytics | Même taux | −22 % basé sur 4 616 €, donc ancien moteur | FAIL | Décision erronée | P0 | M | Source unique | Identique Analytics |
| Daily spending | `quick-stats.tsx` | Mois partiel | Lire | Moyenne interprétable | 194 €/jour, sans jours avec dépense vs jours calendaires | AMBIGU | Mauvaise interprétation | P2 | S | Préciser formule | Tooltip + formule |
| Month progress | `quick-stats.tsx` | Date courante | Lire | Progression | 29/30 lisible | PASS | — | P3 | S | Conserver | Correct au fuseau local |
| Month projection | `quick-stats.tsx` | Mois partiel | Lire | Projection fiable/comparable | 5 818 € vs 6 720 €, mais remboursements/transferts non harmonisés | FAIL | Faux signal | P0 | M | Même moteur et intervalle comparable | Projection documentée |
| Cash-flow précédent | `cash-flow-chart.tsx` | Graphique | Clic flèche gauche | Période précédente | Fonctionne; bouton sans nom AX | AMBIGU | Clavier/lecteur d’écran | P1 | S | `aria-label` | « Période précédente » annoncé |
| Cash-flow suivant | Même | Offset >0 | Clic | Revenir | Fonctionne et disabled à 0; sans nom | AMBIGU | Accessibilité | P1 | S | Label + tooltip | État disabled annoncé |
| Menu période | Même | Aucune | Ouvrir puis 3M/6M/1Y/YTD/weekly/daily | Recalcul | Options présentes | PASS | — | P3 | S | Conserver | Plage mise à jour |
| Barres revenu/dépense | Même | Données | Lire/hover | Valeurs mensuelles fiables | Tous crédits additionnés; exact seulement au hover | FAIL | Contradiction avec Analytics | P0 | M | Moteur commun + tableau | Valeurs exactes accessibles |
| BalanceCard / View all | `balance-card.tsx` | Comptes | Clic | Ouvrir Accounts | Lien fonctionne | PASS | — | P3 | S | Conserver | Route correcte |
| Sélection compte par carte | Même | Comptes | Clic Anthonny/Mirane | Filtrer Dashboard | KPI, dépenses et transactions changent | PASS | — | P2 | S | Ajouter état scope | Titre indique le compte |
| Total foyer | Même | Compte individuel actif | Lire | Comprendre global vs filtré | La carte reste foyer tandis que KPI deviennent compte | AMBIGU | Mélange de périmètres | P0 | M | Bandeau de scope | Aucun KPI hybride |
| ExpenseDonut / Details | `expense-donut.tsx` | Dépenses | Clic | Categories | Fonctionne | PASS | — | P3 | S | Conserver | Catégorie drilldown filtrée |
| Répartition dépenses | Même | Septembre | Lire | Dépenses réelles | Transfers 1 900 € = 34 % | FAIL | Transfert interne présenté comme consommation | P0 | M | Appariement transferts | Interne exclu |
| BudgetControl / Manage | `budget-control.tsx` | Budget | Clic | Budgets | Fonctionne | PASS | — | P3 | S | Conserver | Route correcte |
| Budget used | Même | Septembre | Lire | Ratio cohérent | « 100 % » mais 5 624/3 692 = 152 %; valeur plafonnée | FAIL | Gravité masquée | P1 | S | Afficher 152 % + état over | Ratio non plafonné |
| UpcomingBills | `upcoming-bills.tsx` | Historique | Lire | Factures imminentes | « No bills » avec moteur différent de Calendar/Subscriptions | AMBIGU | Faux sentiment de sécurité | P1 | L | Moteur récurrent unique | Totaux cohérents |
| Goals View all | `goals-progress.tsx` | Objectifs | Clic | Goals | Fonctionne | PASS | — | P3 | S | Conserver | Route correcte |
| Goals Create Goal | Même | Aucun objectif | Clic | Formulaire goal | Redirige vers liste, pas directement création | AMBIGU | Étape en plus | P3 | S | Query `?new=1` | Dialogue ouvert |
| Recent View all | `recent-transactions.tsx` | Données | Clic | Transactions | Fonctionne | PASS | — | P3 | S | Conserver | Route correcte |
| Recent transaction | Même | Données | Chercher action | Ouvrir détail | Lignes non cliquables depuis Dashboard | FAIL | Investigation lente | P2 | S | Lien `editId` | Un clic ouvre transaction |
| MonthlySummary | `monthly-summary.tsx` | Septembre | Lire | Identique Analytics | 4 616/5 624/−1 009 | FAIL | Contradiction directe | P0 | M | Moteur commun | Identité stricte |
| View analytics | Même | Données | Clic | Analytics même scope/période | Navigation, mais chiffres changent | FAIL | Perte de confiance | P0 | M | Passer scope + période | Aucun changement inattendu |
| Anomaly list | `anomaly-detection.tsx` | Historique | Lire | Anomalies actionnables | 5 items; Transfer Out 1 194 € signalé comme anomalie | AMBIGU | Bruit dû transferts | P1 | M | Exclure transferts appariés + CTA | Chaque item ouvre transaction |

### 4.3 Transactions — `src/app/transactions/page.tsx`

| Contrôle | Précondition | Action | Attendu | Observé | Résultat | Impact | Sév. | Effort | Correction | Critère |
|---|---|---|---|---|---|---|---|---|---|---|
| KPI Income | Période par défaut | Lire | Revenu fiable et période visible | 16 542 €; période seulement dans filtres plus bas | AMBIGU | Comparaison inter-page difficile | P1 | M | Moteur commun + sous-titre période | Scope visible dans carte |
| KPI Expenses | Idem | Lire | Dépenses fiables | 17 715 € bruts | AMBIGU | Transferts inclus | P1 | M | Toggle flux bancaires/réels | Définition explicite |
| KPI Net | Idem | Lire | Net cohérent | −1 173 € | AMBIGU | Règles non explicites | P1 | M | Même source | Identique pour même période |
| Search | Données | Saisir marchand/catégorie/note/tag | Filtrer | Implémenté multi-champs | PASS | — | P3 | S | Conserver | Compteur et liste changent |
| Category filter | Données | Ouvrir/choisir | Filtrer | Fonctionne | PASS | — | P3 | S | Conserver | Reset accessible |
| Type filter | Données | Income/Expense | Filtrer | Fonctionne | PASS | — | P3 | S | Conserver | KPI recalculés |
| Recurring filter | Données | Recurring/One-time | Filtrer | Fonctionne sur flag existant | PASS | — | P2 | S | Expliquer flag | Correspond au moteur unique |
| Tag filter | Tags présents | Choisir | Filtrer | Apparaît seulement si tags | PASS | — | P3 | S | Conserver | Option All Tags |
| Start date | Données | Modifier | Changer plage | Fonctionne | PASS | — | P3 | S | Ajouter presets | Date validée |
| End date | Données | Modifier avant start | Prévenir | Aucun message de validation explicite identifié | FAIL | État vide incompris | P2 | S | Validation inline | End ≥ start requis |
| Reset filters | Filtres actifs | Chercher action | Retour défaut | Aucun bouton | FAIL | Friction fréquente | P2 | S | Clear all | Un clic remet défaut |
| Select mode | Données | Clic Select | Montrer checkboxes | Fonctionne; libellé devient Done | PASS | — | P3 | S | Conserver | État visible |
| Select all page | Select actif | Checkbox header | Sélectionner 25 visibles | Implémenté | PASS | — | P3 | S | Clarifier « page » | Libellé page courante |
| Bulk Categorize | ≥1 sélection | Clic | Ouvrir workbench | Dialogue implémenté | PASS | — | P2 | S | Conserver | Nombre sélection visible |
| Bulk Add Tags | ≥1 sélection | Clic | Ajouter tags | Dialogue implémenté | PASS | — | P2 | S | Conserver | Feedback succès |
| Bulk Delete | ≥1 sélection | Clic jusqu’à confirm | Confirmer explicitement | `window.confirm` inspecté, non confirmé | AMBIGU | Style/erreur pauvre | P1 | S | Dialog riche + résumé | Double confirmation ciblée |
| Export | Résultats | Clic | CSV filtré | Exporte les transactions filtrées | PASS | — | P2 | S | Ajouter compteur/périmètre | Nom inclut plage |
| Sort Date | Données | Clic répété | Asc/desc visible | Fonctionne, flèche visible | PASS | — | P3 | S | Conserver | `aria-sort` |
| Sort Amount | Données | Clic répété | Asc/desc | Fonctionne | PASS | — | P3 | S | Conserver | `aria-sort` |
| Pagination pages | >25 résultats | 1–5/Next/Previous | Naviguer | Fonctionne | PASS | — | P3 | S | Conserver | Focus au début liste |
| Clic ligne | Données | Clic | Ouvrir edit | Implémenté | PASS | — | P2 | S | Rendre ligne clavier | Enter/Space ouvre |
| Edit icon | Hover | Clic | Ouvrir edit | Fonctionne mais hover-only et sans nom | FAIL | Inaccessible touch/AX | P1 | M | Menu toujours disponible | Action nommée |
| Exclude icon | Hover | Clic | Exclure analyses/budgets | Fonctionne immédiatement sans undo visible | AMBIGU | Changement discret | P1 | S | Toast Undo | Feedback + annulation |
| Budget type dot | Hover | Ouvrir | Need/Want/Saving | Fonctionne, mais point seul et badges illisibles | FAIL | Classification incompréhensible | P1 | M | Libellé visible | Contraste AA |
| More/Edit | Données | Menu puis Edit | Ouvrir dialogue | Fonctionne | PASS | — | P3 | S | Conserver | Nom accessible |
| More/Create Recurring | Transaction | Clic, sans sauvegarder | Préremplir + bon compte | Préremplit; sauvegarde utiliserait le compte primaire | FAIL | Mauvais compte possible | P0 | S | Hériter `transaction.accountId` | Test second compte |
| More/Exclude | Transaction | Clic | Même action | Implémenté | AMBIGU | Doublon d’action | P3 | S | Unifier | Action unique claire |
| Edit/Category | Dialogue ouvert | Choisir catégorie/sous-cat | Modifier localement | Fonctionne | PASS | — | P2 | S | Conserver | État unsaved visible |
| Edit/Merchant | Dialogue | Modifier | Renommer | Fonctionne | PASS | — | P2 | S | Conserver original | Original affiché |
| Edit/Tags | Dialogue | Ajouter/retirer | Modifier | Fonctionne | PASS | — | P2 | S | Conserver | Tags clavier |
| Edit/Notes | Dialogue | Saisir | Modifier | Fonctionne | PASS | — | P3 | S | Conserver | Label associé |
| Edit/Recurring checkbox | Dialogue | Toggle | Flag récurrent | Fonctionne mais différent de création récurrente | AMBIGU | Deux concepts concurrents | P1 | M | Clarifier « marquer » vs objet | Un seul modèle |
| Edit/Excluded checkbox | Dialogue | Toggle | Exclure | Fonctionne | PASS | — | P2 | S | Conserver + explication | Scope détaillé |
| Apply to similar | SimilarCount >0 | Toggle puis save | Bulk + règle marchand | Implémenté | AMBIGU | Portée difficile à anticiper | P1 | M | Aperçu transactions touchées | Liste/compteur avant save |
| Advanced details | Dialogue | Expand | IDs/date/solde/description | Fonctionne | PASS | — | P3 | S | Conserver | Copie possible |
| Reset edit | Changements | Clic | Annuler localement | Fonctionne, disabled sinon | PASS | — | P3 | S | Conserver | Valeurs restaurées |
| Save edit | Changements | Clic | Sauver/fermer/feedback | Sauve et ferme; pas de toast explicite | AMBIGU | Doute sur sauvegarde | P2 | S | Toast success | Confirmation visible |
| Delete edit | Transaction | Clic jusqu’à confirm | Protection | `window.confirm`; non confirmé | AMBIGU | Récupération faible | P1 | S | Dialog + Undo | Cible/montant/date montrés |
| Table AX | Lecteur écran | Parcourir | Table/rows/cells nommés | `div` grid; lignes presque absentes de l’arbre AX; boutons sans nom | FAIL | Inutilisable lecteur écran | P1 | L | Table sémantique/ARIA grid | Axe sans violation |
| Table mobile | <700 px | Lire | Carte ou scroll | Grid min ~700 px, pas de wrapper horizontal | FAIL | Contenu coupé | P1 | M | Layout cartes mobile | Aucun overflow page |

### 4.4 Analytics — `src/app/analytics/page.tsx` et `src/components/analytics/financial-history.tsx`

| Contrôle/composant | Précondition | Action | Attendu | Observé | Résultat | Impact | Sév. | Effort | Correction | Critère |
|---|---|---|---|---|---|---|---|---|---|---|
| Tab 1M | Données septembre | Clic | Septembre seulement | Recalcul prévu | PASS | — | P3 | S | Conserver | Toutes cartes/graphiques suivent |
| Tab 3M | Données | Clic | Juil.–sept. | Recalcul prévu | PASS | — | P3 | S | Conserver | Plage visible en texte |
| Tab 6M | Données | Clic | Avr.–sept. | Recalcul observé | PASS | — | P3 | S | Conserver | État sélectionné visible |
| Tab 1Y | Données | Clic | 12 mois roulants | Recalcul prévu | PASS | — | P3 | S | Conserver | Pas confondu avec année |
| Tab YTD | Données | Clic | Jan.–sept. | 25 506 / 25 652 / −146 | PASS | Base la plus fiable | P3 | S | En faire source commune | Tests contractuels |
| KPI Total income | YTD | Lire | Revenu réel | 25 506 €, remboursements/transferts exclus | PASS | — | P3 | S | Conserver méthode | Définition accessible |
| KPI Total expenses | YTD | Lire | Dépenses | 25 652 € | PASS | — | P3 | S | Conserver | Identique catégories corrigées |
| KPI Net | YTD | Lire | Net exact | −146 € | PASS | — | P3 | S | Conserver | Exact au centime |
| Moyennes mensuelles | Mois courant partiel | Lire | Exclure mois incomplet | 4 006 € dépenses, 4 221 € revenus; note présente | PASS | — | P3 | S | Conserver | Mois retenus listables |
| Scope compte | Compte individuel via dock | Ouvrir Analytics | Titre reflète scope | Copie reste « household cash flow » | FAIL | Périmètre trompeur | P0 | S | Libellé dynamique | Compte + période en titre |
| Income vs Expenses | Données | Lire/hover | Tendance + valeurs | Axe/légende accessibles, exact au hover seulement | AMBIGU | Comparaison difficile touch/clavier | P1 | M | Tableau + focus points | Chaque mois lisible sans souris |
| Note transferts | Données | Lire | Expliquer exclusions | Texte présent | PASS | — | P3 | S | Conserver | Définition complète |
| Current month partial | Données | Lire | Prévenir | Note présente | PASS | — | P3 | S | Conserver | Badge sur septembre |
| Fixed vs Flexible | Données | Lire/hover | Comprendre méthode | Définition catégorie/récurrence présente | AMBIGU | Correction utilisateur impossible | P1 | M | Drilldown + override | Chaque montant explique ses lignes |
| Spending by Category | Données | Lire | Top 5 + Other | Fonctionne; couleurs proches, valeurs hover-only | AMBIGU | Faible distinction/accessible | P1 | M | Palette sémantique + tableau | Contraste 3:1 entre séries |
| Category drilldown | Graphique | Clic barre/légende | Ouvrir transactions filtrées | Aucun drilldown | FAIL | Investigation impossible | P1 | M | Liens période+catégorie | Un clic montre composition |
| Salary cards | Historique salaire | Lire | Dernier/médiane/variance | 3 690 / 3 847 / −157 | PASS | Très utile | P3 | S | Conserver | Règle salaire documentée |
| Salary table | Historique | Lire | Compte et mois | Mai–septembre + partiel | PASS | — | P3 | S | Ajouter bonus distingué | Bonus identifié |
| Top Merchants | Données | Lire | Marchands actionnables | Transfer Out 5 756 €, Unknown 4 801 € dominent | FAIL | Insight pollué | P1 | M | Exclure transferts, CTA nettoyer Unknown | Top marchand réel |
| Merchant drilldown | Liste | Clic ligne | Transactions marchand | Lignes non actionnables | FAIL | Analyse bloquée | P2 | S | Lien query merchant | Résultat filtré |
| Recurring sort | Données | Ouvrir | Trier fréquence/montant/total | Contrôle présent | PASS | — | P3 | S | Ajouter label accessible | Option active annoncée |
| Recurring item | Habitudes | Clic | Détail/transactions | Boutons présents mais signification faible; non intégrés Subscriptions | AMBIGU | Deux modèles concurrents | P1 | L | Inbox de détection unique | Confirmer/rejeter |
| Spending Calendar prev | Données | Clic | Mois précédent | Fonctionne; bouton sans nom | AMBIGU | AX | P1 | S | Label | Mois annoncé |
| Spending Calendar next | Données | Clic | Mois suivant | Fonctionne; bouton sans nom | AMBIGU | AX | P1 | S | Label | État disabled si futur |
| Jour avec transactions | Données | Clic | Détail jour | Bouton fourni; détail attendu | PASS | — | P2 | S | Conserver | Liste + total |
| Jour vide | Aucune transaction | Clic | Aucun comportement ou état non interactif | Apparence bouton identique, sans feedback | FAIL | Affordance trompeuse | P2 | S | Rendre non bouton | Pas focusable si vide |

### 4.5 Budgets — `src/app/budgets/page.tsx` et `src/components/budgets/*`

| Contrôle/composant | Précondition | Action | Attendu | Observé | Résultat | Impact | Sév. | Effort | Correction | Critère |
|---|---|---|---|---|---|---|---|---|---|---|
| Settings toggle | Aucune | Clic | Ouvrir/fermer configuration | Fonctionne | PASS | — | P3 | S | Conserver | `aria-expanded` |
| Preset 50/30/20 | Settings ouvert | Choisir | Recalcul allocations | Implémenté | PASS | — | P2 | S | Expliquer base revenu | Sommes = 100 % |
| Preset 60/20/20 | Idem | Choisir | Recalcul | Implémenté | PASS | — | P3 | S | Conserver | Valeurs visibles |
| Preset 70/20/10 | Idem | Choisir | Recalcul | Implémenté | PASS | — | P3 | S | Conserver | Valeurs visibles |
| Custom | Idem | Choisir/éditer | Personnaliser | Implémenté | AMBIGU | Validation somme non prouvée | P1 | S | Bloquer si ≠100 % | Erreur inline |
| Monthly income override | Settings | Saisir | Piloter budget | Fonctionne localement | AMBIGU | Persistance/provenance peu claire | P1 | M | Label source + save explicite | Valeur conservée et datée |
| Smart income | All accounts | Lire budget | Revenu stable | Moyenne salaire appliquée | PASS | — | P2 | S | Montrer valeur source | Tooltip mois utilisés |
| Smart income individuel | Compte sélectionné | Lire | Revenu compte | Utilise crédits du mois, donc remboursements possibles | FAIL | Budget surestimé | P0 | M | Revenu reconnu uniquement | Remboursement exclu |
| Budget scope | Compte individuel | Lire | Budget du compte ou foyer | Budgets DB globaux, dépenses filtrées compte | FAIL | Comparaison hybride | P0 | L | Scope explicite/schema accountId | Même périmètre |
| Budget vs Actual | Données | Lire | Vue claire | Donut/graph; valeurs Need/Wants/Savings | AMBIGU | Les transferts faussent Savings | P0 | M | Exclure transferts internes | Savings = épargne réelle |
| Spending Pace status | Septembre | Lire | Synthèse fiable | « On track » malgré 6 alertes; agrégé peut être mathématiquement vrai | AMBIGU | Message rassurant contradictoire | P1 | M | Distinguer total vs catégories | Copie non contradictoire |
| Daily Budget | Septembre | Lire | Budget/jour | 154 € | PASS | — | P2 | S | Préciser restant | Formule visible |
| Daily Average | Septembre | Lire | Dépense/jour | 128 € | PASS | — | P2 | S | Idem | Formule visible |
| Can Spend/Day | 1 jour restant | Lire | Aide prudente | 891 €, chiffre dangereux hors contexte | FAIL | Invite à dépenser le reste | P1 | S | Afficher reste du mois | Pas formulé comme recommandation |
| Projected Total | Mois partiel | Lire | Projection | 3 853 €, incompatible dépenses Dashboard 5 624 € car classifications/exclusions | FAIL | Confusion | P0 | M | Source unique | Même dépense totale |
| Budget Alerts | Dépassements | Lire | Alertes actionnables | 6 alertes mais détails limités | AMBIGU | Pas de prochaine action | P1 | M | Montant à réduire + lien | Chaque alerte drilldown |
| Need category card | Catégorie | Clic edit | Modifier budget | Fonctionne inline | PASS | — | P2 | S | Conserver | Save/cancel feedback |
| Save category budget | Edition | Clic | Persister mois | Implémenté | AMBIGU | Pas de toast clair | P2 | S | Toast | Valeur persistante |
| Cancel category budget | Edition | Clic | Restaurer | Implémenté | PASS | — | P3 | S | Conserver | Valeur initiale |
| Variation catégorie | Historique | Lire `Food −46 %` | Comprendre comparaison | Libellé de référence absent | FAIL | Chiffre incompréhensible | P1 | S | `vs mois dernier` | Direction expliquée |
| Transfers Savings | Transactions transferts | Lire | Épargne réelle | 1 900 €, 206 % used, over 977 € | FAIL | Transfert présenté comme « dépense d’épargne » | P0 | L | Modèle transfer/savings | Interne neutralisé |
| Category overrides | Settings | Changer Need/Want/Savings | Reclassifier | Fonctionne | PASS | — | P2 | S | Conserver | Recalcul immédiat |
| Reset overrides | Overrides | Clic jusqu’avant action | Restaurer defaults | Action globale sans aperçu | AMBIGU | Erreur possible | P1 | S | Confirmation + liste | Nombre affecté affiché |
| Transaction type badge | Transactions | Lire | Type lisible | `bg-info/warning/success` tous coral; texte parfois coral sur coral | FAIL | Illisible | P1 | S | Tokens distincts + texte contrasté | WCAG AA |

### 4.6 Plan 13 semaines — `src/app/plan/page.tsx`

| Contrôle/composant | Précondition | Action | Attendu | Observé | Résultat | Impact | Sév. | Effort | Correction | Critère |
|---|---|---|---|---|---|---|---|---|---|---|
| Starting balance | Comptes | Lire | Solde foyer réel | 1 521 € | PASS | — | P2 | S | Conserver | Somme comptes datée |
| Freshness alert | Checkpoint ancien | Lire | Identifier risque + agir | Signale Anthonny 25/09, sans CTA | AMBIGU | Correction difficile | P1 | S | Bouton Update balance | Ouvre Settings/Balances ciblé |
| Lowest point | Plan | Lire | Risque cash | −410 € | PASS | Très utile | P2 | S | Mettre en évidence date | Semaine/date associée |
| End of 13 weeks | Plan | Lire | Résultat | 7 583 € prudent | PASS calcul | Peut paraître irréaliste | P1 | M | Montrer hypothèses totales | Total entrées/sorties |
| Against target | Target 0 | Lire | Écart objectif | +7 583 € | AMBIGU | Succès trivial | P1 | S | Forcer confirmation target | Aucun badge avant cible |
| Status Target reached | Target 0 par défaut | Lire | Statut significatif | Affiché sans action utilisateur | FAIL | Fausse réussite | P1 | S | État « Configure target » | Cible confirmée requise |
| Save assumptions | Valeurs | Clic | Persister + feedback | Toast prévu | PASS | — | P2 | S | Ajouter dirty state | Disabled sans changement |
| Scenario Prudent | Aucune | Clic | Appliquer hypothèses prudentes | Change montants revenus | PASS | — | P2 | S | Résumer différences | Delta listé |
| Scenario Réaliste | Aucune | Clic | Appliquer | +329 € fin vs prudent | AMBIGU | Différence opaque | P1 | S | Tableau hypothèses | Sources modifiées visibles |
| Scenario Reprise | Aucune | Clic | Appliquer | +896 € fin vs prudent | AMBIGU | Même problème | P1 | S | Idem | Idem |
| Salaire Anthonny amount | Plan | Edit local | Recalcul live | Fonctionne par scénario | PASS | — | P2 | S | Afficher source bulletin | Provenance/date |
| Salaire Anthonny day | Plan | Edit | Recaler semaine | Clamp 1–31 | PASS | — | P2 | S | Validation inline | Jours invalides refusés |
| Salaire Mirane amount | Estimation | Edit | Recalcul | 1 900 € estimés, note présente | PASS | — | P2 | S | Badge Estimated | Confirmé vs estimé distinct |
| Salaire Mirane day | Estimation | Edit | Recaler | Fonctionne | PASS | — | P2 | S | Conserver | Date explicite |
| CAF | Historique | Edit | Recalcul | 711,03 €, note présente | PASS | — | P3 | S | Conserver | Source observée |
| Essential envelope | Historique | Edit | Recalcul | 273,43 €/sem., provenance non détaillée | AMBIGU | Confiance faible | P1 | M | Drilldown catégories | Composition visible |
| Flexible envelope | Historique | Edit | Recalcul | 314,98 €/sem., provenance non détaillée | AMBIGU | Décision difficile | P1 | M | Composition + recommandations | Montant explicable |
| Fixed monthly costs | Historique | Edit | Recalcul | 876,88 €, dérivé seulement des flags recurring | AMBIGU | Sous/surestimation possible | P0 | L | Moteur récurrent confirmé | Liste des charges |
| Temporary tax | Connu | Edit | Recalcul | 854 € | PASS | — | P2 | S | Date/fin | Échéances listées |
| Tax payments remaining | Connu | Edit | Recalcul | 3 | PASS | — | P2 | S | Conserver | 0–12 validé |
| December target | Défaut 0 | Edit | Recalcul gap | Fonctionne | AMBIGU | Label ne précise date exacte | P1 | S | Date + aide | Cible datée |
| Safety floor | Défaut −800 | Edit | Alerter franchissement | Fonctionne, ligne graphique | PASS | — | P2 | S | Badge semaine | Première violation visible |
| Balance chart | Plan | Lire/hover | Trajectoire claire | Ligne + repères, exact au hover | AMBIGU | Mobile/clavier | P1 | M | Valeurs/table compacte | Points focusables |
| Recovery alert | Gap >0 | Lire | Action concrète | Calcule amélioration/semaine | PASS | — | P2 | S | Ajouter leviers | CTA budget/revenus |
| Success alert | Gap 0 | Lire | Marge | « Keep margin uncommitted » | PASS | — | P2 | S | Traduire/unifier langue | Copie française |
| Week table | Plan | Scroll | Comprendre 13 semaines | Table détaillée et scroll horizontal | PASS | — | P2 | S | Sticky week/closing | Utilisable mobile |
| Actual vs planned | Semaine écoulée | Chercher | Suivre exécution | Absent | FAIL | Plan non pilotable | P1 | L | Colonnes prévu/réel/reste | Mise à jour hebdo |
| Safe to spend this week | Plan | Chercher | Décision immédiate | Nécessite interpréter enveloppe/table | FAIL | Besoin central non servi | P1 | M | Carte action | Montant + date visible en tête |
| Langue | Page | Lire | Cohérence | Titres anglais, scénarios/notes français | FAIL | Charge cognitive | P2 | M | Localisation FR complète | Une langue par préférence |

### 4.7 Goals — `src/app/goals/page.tsx`, `src/app/goals/[id]/page.tsx`, `src/components/goals/goal-card.tsx`

| Contrôle/composant | Précondition | Action | Attendu | Observé | Résultat | Impact | Sév. | Effort | Correction | Critère |
|---|---|---|---|---|---|---|---|---|---|---|
| New Goal | Aucune | Ouvrir dialogue | Formulaire complet | Implémenté | PASS | — | P2 | S | Conserver | Focus premier champ |
| Goal name | Dialogue | Saisir | Requis | Implémenté | PASS | — | P3 | S | Validation inline | Empty bloqué |
| Target amount | Dialogue | Saisir | >0 | Implémenté | AMBIGU | Validation détaillée non visible | P2 | S | Message >0 | Erreur accessible |
| Current amount | Virtual goal | Saisir | Initialiser | Implémenté | AMBIGU | Argent virtuel vs réel peu clair | P1 | M | Choix mode explicite | Mode résumé |
| Deadline | Dialogue | Choisir | Forecast | Implémenté | PASS | — | P2 | S | Conserver | Passé refusé |
| Linked account | Comptes | Choisir | Progression réelle | Implémenté | PASS | — | P2 | S | Expliquer lecture seule | Solde source nommé |
| Create Goal submit | Valide | Clic | Créer + feedback | Implémenté | AMBIGU | Feedback à confirmer | P2 | S | Toast + focus carte | Carte créée visible |
| Search goals | ≥1 goal | Saisir | Filtrer | Fonctionne | PASS | — | P3 | S | Conserver | Compteur mis à jour |
| Sort | Goals | Ouvrir 5 options | Trier | Most funded/deadline/activity/remaining/name | PASS | — | P3 | S | Afficher mode actif | Libellé dynamique |
| KPI Active target | 6 actifs | Lire | Total | 11 800 € | PASS | — | P2 | S | Conserver | Scope account expliqué |
| KPI Saved | Virtuels à 0 | Lire | Progression | 0 € malgré foyer +1 521 € | AMBIGU | Attente argent réel | P1 | M | Séparer virtuel/lié | Labels explicites |
| KPI Net funding 30d | Transactions | Lire | Flux objectif | 0 € contributions | PASS technique | Peut être confondu avec net foyer | P2 | S | `Goal contributions` | Libellé précis |
| Connection net savings | Dashboard data | Lire | Même Analytics | −1 009 €, −22 % | FAIL | Contradiction | P0 | M | Moteur commun | −1 223 selon règle commune |
| Transactions link | Card connection | Clic | Liste | Fonctionne | PASS | — | P3 | S | Préfiltrer contributions | Contexte conservé |
| Budgets link | Idem | Clic | Budgets | Fonctionne | PASS | — | P3 | S | Conserver | — |
| Analytics link | Idem | Clic | Analytics | Fonctionne mais chiffres changent | FAIL | Confiance | P0 | M | Scope/période identiques | Chiffre stable |
| Active tab | Goals | Clic | 6 actifs | Fonctionne | PASS | — | P3 | S | Conserver | Count correct |
| Completed tab | Goals | Clic | 0 completed + empty state | Fonctionne | PASS | — | P3 | S | Conserver | Empty state clair |
| Goal title link | Carte | Clic | Détail | Fonctionne | PASS | — | P3 | S | Conserver | H1 détail |
| Card menu Edit | Carte | Ouvrir/clic | Dialogue edit | Implémenté | PASS | — | P2 | S | Label bouton | AX nommé |
| Card menu Delete | Carte | Clic jusqu’à confirm | Protéger | Dialogue state prévu; non confirmé | PASS | — | P1 | S | Montrer contributions affectées | Confirmation ciblée |
| Add virtual progress | Virtual goal | Clic | Contribution | Ouvre formulaire | PASS | — | P2 | S | Renommer contribution | Terme cohérent |
| Contribution amount | Dialog | Saisir +/− | Deposit/withdrawal | Accepte signé | AMBIGU | Erreur de signe probable | P1 | M | Choix Deposit/Withdrawal | Pas de signe manuel |
| Contribution date/note | Dialog | Saisir | Enregistrer événement | Implémenté | PASS | — | P3 | S | Conserver | Date/note visibles |
| Goal Details | Carte | Clic | Détail | Fonctionne | PASS | — | P3 | S | Conserver | — |
| Detail Back | `/goals/1` | Clic | Retour liste | Fonctionne | PASS | — | P3 | S | Conserver | Focus carte source |
| Detail Add contribution | Virtual | Clic | Dialogue | Fonctionne | PASS | — | P2 | S | Conserver | — |
| Detail menu Edit | Détail | Clic | Edit | Implémenté | PASS | — | P2 | S | Conserver | — |
| Detail menu Delete | Détail | Jusqu’à confirm | Protection | Implémenté | PASS | — | P1 | S | Résumé impact | — |
| Overview tab | Détail | Clic | Forecast/activity aperçu | Fonctionne | PASS | — | P3 | S | Conserver | — |
| Activity tab | Détail | Clic | Historique | Fonctionne | PASS | — | P3 | S | Conserver | — |
| Forecast empty | 0 contributions | Lire | Guide action | « Add a few contributions » | PASS | — | P3 | S | Conserver | CTA direct |
| Delete contribution | Historique | Jusqu’à confirm | Protection | Implémenté; non confirmé | PASS | — | P1 | S | Undo | Restore possible |

### 4.8 Subscriptions — `src/app/subscriptions/page.tsx` et `src/components/subscriptions/*`

| Contrôle/composant | Précondition | Action | Attendu | Observé | Résultat | Impact | Sév. | Effort | Correction | Critère |
|---|---|---|---|---|---|---|---|---|---|---|
| Auto-Detect global | All Accounts | Clic | Analyser tous les comptes | Code choisit `accounts.find(first active)` | FAIL | Compte 2 ignoré | P0 | M | Boucler comptes actifs | Résultat par compte |
| Auto-Detect compte | Compte individuel | Clic | Détecter motifs fiables | Fonction prévue + message résultat | PASS | — | P2 | S | Conserver | Compteur + erreurs |
| Feedback no pattern | Aucun nouveau motif | Détection | Informer | Message « No new reliable… » | PASS | — | P3 | S | Ajouter critères | Confiance expliquée |
| KPI Monthly Subscriptions | Données | Lire | Total normalisé | 0 € dans jeu courant | PASS technique | Contraste avec Analytics | P1 | L | Moteur commun | Habitudes à confirmer proposées |
| KPI Monthly Bills | Données | Lire | Total | 0 € | AMBIGU | Import riche mais vide | P1 | L | Inbox détection | Cohérent Calendar |
| KPI Loans | Données | Lire | Total | 0 € | PASS | — | P3 | S | Conserver | — |
| KPI Total Monthly | Données | Lire | Somme hors revenu | 0 € | PASS calcul | — | P2 | S | Ajouter income séparé | Définition visible |
| Subscriptions tab | Aucune | Clic | Liste/empty | Empty state + Add/Auto-detect | PASS | — | P3 | S | Conserver | — |
| Bills tab | Aucune | Clic | Liste bills | Fonctionne | PASS | — | P3 | S | Conserver | — |
| Loans tab | Aucune | Clic | Liste loans | Fonctionne | PASS | — | P3 | S | Conserver | — |
| Income tab | Aucune | Clic | Sources récurrentes | Fonctionne | PASS | — | P2 | S | Relier Plan | Confirmé synchronisé |
| Ended tab | Aucune | Clic | Cancelled/completed | Fonctionne | PASS | — | P3 | S | Conserver | — |
| Add [type] | Tab | Clic | Dialogue bon type | `openAddDialog` préconfigure type | PASS | — | P2 | S | Conserver | Titre dynamique |
| Add when All Accounts | All Accounts | Save | Choisir compte | Code assigne premier compte actif; dialogue sans choix explicite | FAIL | Mauvais compte | P0 | M | Champ compte requis | Aucun fallback silencieux |
| Add New vs Link Existing | Transaction source | Tabs dialogue | Créer ou lier | Deux modes présents | PASS | — | P2 | S | Conserver | Mode expliqué |
| Name | Add dialog | Saisir | Requis | Implémenté | PASS | — | P3 | S | Validation | — |
| Type | Add dialog | Choisir | Sub/bill/loan/income | Fonctionne | PASS | — | P2 | S | Conserver | Signe montant auto |
| Amount | Add dialog | Saisir | Montant | Fonctionne | PASS | — | P2 | S | Afficher devise/compte | — |
| Frequency | Add dialog | Choisir | weekly/biweekly/monthly/quarterly/yearly | Fonctionne | PASS | — | P2 | S | Ajouter aperçu prochaine date | — |
| Category/subcategory | Add dialog | Choisir | Classer | Fonctionne | PASS | — | P2 | S | Conserver | — |
| Start/expected date | Add dialog | Saisir | Calendrier | Implémenté | AMBIGU | Relation nextExpected complexe | P2 | M | Aperçu occurrences | 3 dates futures |
| Save recurring | Dialog valide | Clic | Persister + fermer | Implémenté | AMBIGU | Feedback réussite faible | P2 | S | Toast | Carte visible |
| Link Existing | Source tx | Choisir item | Attacher occurrence | Implémenté | PASS | — | P2 | S | Conserver | Tx marquée recurring |
| Card Edit | Item | Menu | Modifier | Implémenté | PASS | — | P2 | S | Label accessible | — |
| Pause/Resume | Item | Menu | Changer statut | Implémenté | PASS | — | P2 | S | Toast Undo | Statut visible |
| Cancel | Item | Menu | Déplacer Ended | Implémenté | AMBIGU | Pas de confirmation détaillée | P1 | S | Confirm + date fin | — |
| Exclude false positive | Item | Menu | Retirer détection | Implémenté | AMBIGU | Disparaît sans surface de récupération | P1 | M | Onglet Excluded/Undo | Restaurable |
| Delete | Item | Jusqu’à confirm | Supprimer | Dialogue prévu; non confirmé | PASS | — | P1 | S | Résumé occurrences | — |
| Change type | Item | Menu | Déplacer tab + signe | Implémenté avec message | PASS | — | P2 | S | Conserver | Montant/category cohérents |
| Merge | ≥2 items | Ouvrir/choisir | Fusionner | Dialogue + target selection | PASS | — | P1 | M | Aperçu résultat | Occurrences conservées |
| Payment history | Item | Ouvrir | Occurrences/statuts | Dialogue riche | PASS | — | P2 | S | Conserver | Liens transactions |

### 4.9 Calendar — `src/app/calendar/page.tsx`

| Contrôle/composant | Précondition | Action | Attendu | Observé | Résultat | Impact | Sév. | Effort | Correction | Critère |
|---|---|---|---|---|---|---|---|---|---|---|
| Previous month | Aucune | Clic gauche | Mois précédent | Fonctionne; bouton sans nom | AMBIGU | AX | P1 | S | `aria-label` | Mois annoncé |
| Today | Hors mois courant | Clic | Revenir courant | Fonctionne | PASS | — | P3 | S | Conserver | — |
| Next month | Aucune | Clic droite | Mois suivant | Fonctionne; bouton sans nom | AMBIGU | AX | P1 | S | Label | — |
| This month KPI | Récurrents | Lire | Total | 0 € | PASS calcul | Moteur vide | P1 | L | Moteur commun | Cohérent Subscriptions |
| Paid KPI | Matching tx | Lire | Payé | 0 € courant | AMBIGU | Transactions récurrentes non liées | P1 | L | Auto-link unifié | — |
| Upcoming KPI | Récurrents | Lire | À venir | 0 € | AMBIGU | Faux sentiment | P1 | L | Distinguer confirmé/estimé | — |
| Overdue KPI | Récurrents | Lire | Retard | 0 | PASS | — | P2 | S | Conserver | — |
| Day with bill | Event | Clic | Détail dialog | Implémenté | PASS | — | P2 | S | Conserver | — |
| Empty day | Aucun event | Clic | Non interactif | Bouton focusable mais `handleDayClick` ne fait rien | FAIL | Feedback nul | P2 | S | Rendre statique | Vide non focusable |
| Type legend | Events | Lire | Bill/payment statuses | Légende minimale | AMBIGU | Paid/upcoming/overdue peu explicités | P2 | S | Légende complète | Couleur+texte+icône |
| Upcoming list | Événements | Lire | 5 prochains | Empty state « no upcoming » | PASS technique | Sans CTA détection | P1 | S | Lien Auto-Detect | Chemin récupération |
| Income events | Revenu récurrent | Lire | Cash flow complet | Explicitement exclus du calendrier | FAIL | Inutile pour plan de trésorerie | P1 | M | Toggle entrées/sorties | Salaires/CAF visibles |
| Matching paid | Recurring + tx ±5j ±20% | Lire | Statut payé | Heuristique séparée | AMBIGU | Diffère autres moteurs | P1 | L | RecurringEngine commun | Même occurrence partout |

### 4.10 Accounts — `src/app/accounts/page.tsx` et Settings/Balances

| Contrôle/composant | Précondition | Action | Attendu | Observé | Résultat | Impact | Sév. | Effort | Correction | Critère |
|---|---|---|---|---|---|---|---|---|---|---|
| Assets | Comptes | Lire | Actifs positifs | 1 774 € | PASS | — | P2 | S | Conserver | Devise base |
| Liabilities | Solde négatif | Lire | Passif | 253 € | PASS | — | P2 | S | Conserver | Carte Mirane reliée |
| Net worth | Comptes | Lire | Net | 1 521 € | PASS | — | P2 | S | Conserver | Identique foyer |
| Search accounts | ≥1 | Saisir | Filtrer | Implémenté | PASS | — | P3 | S | Conserver | — |
| Add Account | Aucune | Ouvrir | Formulaire | Dialogue observé | PASS | — | P2 | S | Conserver | Focus name |
| Account name | Dialog | Saisir | Requis | Add disabled si vide | PASS | — | P3 | S | Label associé | AX name |
| Type | Dialog | Choisir | checking/savings/credit/cash | Fonctionne | PASS | — | P2 | S | Effet solde expliqué | Credit liability |
| Current balance | Dialog | Saisir | Initialiser | Fonctionne | AMBIGU | Date du solde non demandée ici | P1 | M | Date effective requise | Solde daté |
| Institution | Dialog | Saisir | Nom banque | Fonctionne | PASS | — | P3 | S | Conserver | — |
| Currency | Dialog | Saisir | Devise supportée | Simple text field EUR | FAIL | Valeur invalide possible | P1 | S | Select supported currencies | Valeur contrainte |
| Color swatches | Dialog | Clic | Identifier compte | Fonctionne; boutons sans noms | AMBIGU | AX | P2 | S | Label couleur | État selected annoncé |
| Submit Add | Nom valide | Clic | Créer | Implémenté; non exécuté | PASS | — | P2 | S | Toast | Compte visible |
| Edit icon | Ligne | Clic | Dialogue edit | Implémenté; bouton sans nom | FAIL | AX/touch | P1 | S | Label | « Modifier Anthonny » |
| Delete icon | Ligne | Clic jusqu’au dialog | Protection | Dialogue spécifique | PASS | — | P1 | S | Afficher tx liées | Impact détaillé |
| Delete account | Compte avec tx | Confirmer non exécuté | Préserver/choisir | `deleteAccountSafely` inspecté | PASS technique | — | P1 | M | Résumé migration | Aucune orphan tx |
| Orphan Société Générale | Données | Lire | Comptes intentionnels | Compte 0 € sans transactions apparentes | AMBIGU | Bruit et erreurs import | P1 | S | Health check/merge | Orphelin signalé |
| Institution Unknown | Anthonny/Mirane | Lire | Banque | `Unknown` | AMBIGU | Faible confiance | P2 | S | Dériver SG ou demander | Institution correcte |
| Accounts table AX | Lecteur écran | Parcourir | Table sémantique | `DataTable` en divs | FAIL | Accessibilité | P1 | L | Table/ARIA grid | Axe propre |
| Accounts mobile | <700 px | Lire/actions | Cartes | Grid min ~720 px sans overflow wrapper | FAIL | Contenu coupé | P1 | M | Cards mobile | 320 px |
| Balance settings account | Settings > Balances | Choisir | Compte ciblé | Select présent | PASS | — | P2 | S | Deep-link | Compte préchoisi depuis alerte |
| Initial balance/date | Settings | Edit/save | Recalcul | Fonctionne | PASS | — | P1 | M | Conserver | Impact preview |
| Add checkpoint | Settings | Ouvrir/saisir/save non exécuté | Ajouter snapshot | Fonctionne | PASS | — | P1 | S | CTA sur Dashboard/Plan | Accessible direct |
| Delete checkpoint | Checkpoint | Jusqu’avant action | Supprimer | Action immédiate inspectée, pas de confirm riche | AMBIGU | Historique perdu | P1 | S | Confirm + Undo | Restaurable |
| Recalculate all | Settings | Jusqu’avant action | Recalcul soldes | Bouton global | AMBIGU | Impact non prévisualisé | P1 | M | Preview delta par compte | Confirmation informée |

### 4.11 Import — `src/app/import/page.tsx`, `src/components/import/migration-wizard.tsx`

| Contrôle/composant | Précondition | Action | Attendu | Observé | Résultat | Impact | Sév. | Effort | Correction | Critère |
|---|---|---|---|---|---|---|---|---|---|---|
| Stepper Upload/Preview/Import/Complete | Aucune | Lire | Comprendre progression | Visible | PASS | — | P3 | S | Conserver | Étape active annoncée |
| Account select | Comptes | Ouvrir | Choisir cible | Société Générale/Anthonny/Mirane visibles | PASS | — | P2 | S | Afficher solde/institution | Bonne cible vérifiable |
| Choose File disabled | Aucun compte | Clic | Bloqué + explication | Disabled + « Select an account first » | PASS | — | P3 | S | Conserver | Raison visible |
| Quick account field | Aucune | Lire AX | Créer compte | Champ sans nom accessible | FAIL | AX | P1 | S | Label/placeholder | Name annoncé |
| Quick Create disabled | Champ vide | Clic | Bloqué | Disabled | PASS | — | P3 | S | Conserver | — |
| Quick Create | Nom saisi | Clic | Créer/sélectionner | Implémenté | AMBIGU | Compte minimal sans solde/date/institution | P1 | M | Mini-wizard | Métadonnées suffisantes |
| Choose File | Compte sélectionné | Clic | File picker | Devient actif; non rouvert pour éviter réimport | PASS | — | P2 | S | Conserver | CSV only |
| Drag/drop | Compte sélectionné | Déposer | Charger | Zone présente | PASS code | — | P2 | S | Conserver | Erreur type claire |
| Format detection | CSV | Charger | Historique/SG | Support annoncé et implémenté | PASS | — | P2 | S | Afficher format détecté | Badge format |
| Account-file safeguard | CSV autre titulaire | Preview | Alerter | Aucune confirmation forte de titulaire/IBAN visible | FAIL | Mauvais compte | P0 | M | Heuristique titulaire + confirm | Incohérence bloque |
| Preview row count | Fichier | Lire | Total/valides/invalides | Implémenté | PASS | — | P2 | S | Conserver | Totaux concordants |
| Preview balances | Fichier | Lire | Solde initial/final | Informations de preview présentes selon format | PASS | — | P2 | S | Mettre en avant | Delta explicable |
| Category preview | Fichier | Lire | Catégorisation | Règles appliquées | PASS | — | P2 | S | Afficher confiance | Unknown quantifié |
| Quality warnings | Erreurs | Lire | Lignes/problèmes | Diagnostics import implémentés | PASS | — | P1 | S | Export erreurs | Chaque ligne localisable |
| Duplicate detection | Réimport | Preview/import | Éviter doublons | Moteur/tests présents | PASS code | — | P0 | M | Résumé doublons | 0 duplication sur réimport |
| Reset preview | Fichier chargé | Clic | Recommencer | Bouton présent | PASS | — | P3 | S | Conserver | État vidé |
| Import button | Preview >0 | Clic non exécuté | Importer | Enabled seulement si lignes | PASS | — | P1 | S | Confirm cible+counts | Résumé final avant write |
| Import error recovery | Erreur DB/ligne | Échec | Préserver état/réessayer | Diagnostics existent, UX détaillée variable | AMBIGU | Reprise difficile | P1 | M | Retry safe + checkpoint | Aucun doublon après retry |
| Complete summary | Import réussi | Lire | Added/duplicates/errors/account/dates | Étape existe | PASS code | — | P1 | M | Carte de rapprochement | Tous compteurs visibles |
| Import another account | Complete | Chercher | Continuer deuxième compte | Reset possible, mais pas CTA dédié « second account » | FAIL | Parcours foyer interrompu | P1 | S | CTA explicite | Retour Upload, autre compte suggéré |
| Continue | Complete valid | Clic | Transactions | Redirection `/transactions` | PASS | — | P2 | S | Ajouter choix Dashboard | Contexte conservé |
| Privacy notice | Aucune | Lire | Rassurer | « processed/stored locally » | PASS | — | P3 | S | Conserver | Lien backup |

### 4.12 Categories — `src/app/categories/page.tsx`

| Contrôle/composant | Précondition | Action | Attendu | Observé | Résultat | Impact | Sév. | Effort | Correction | Critère |
|---|---|---|---|---|---|---|---|---|---|---|
| Income total | 12 mois | Lire | Revenu réel | 28 001,67 €, différent Analytics | FAIL | Confiance | P0 | M | Moteur commun | Même période = même total |
| Expense total | 12 mois | Lire | Dépenses | 25 652,05 € | AMBIGU | Période 12m/YTD mélangée | P1 | S | Sélecteur période | Comparaison explicite |
| Category row expand | Transactions | Clic | Sous-catégories | Fonctionne | PASS | — | P3 | S | Conserver | `aria-expanded` |
| Empty category row | 0 tx | Clic | Non interactif | Handler seulement si transactions | PASS | — | P3 | S | Style disabled | Non focusable |
| Transfers row | Données | Lire | Transferts distingués | −15 391,59 €, 60 % expenses | FAIL | Dépense totalement dominée | P0 | L | Appariement/section flux | Internes exclus du spend |
| Unknown quality | Données Unknown | Chercher | Nettoyage | Unknown apparaît sous Services/marchands, pas une inbox | FAIL | 4 801 € peu explicables | P1 | M | Quality center | Nombre + CTA |
| Add Category | Aucune | Ouvrir | Dialogue | Fonctionne | PASS | — | P2 | S | Conserver | Focus name |
| Add name | Dialogue | Saisir | Valider unique | Validation code présente | PASS | — | P2 | S | Erreur inline | Doublon bloqué |
| Parent category | Dialogue | Choisir | Ajouter sous-catégorie | Fonctionne | PASS | — | P2 | S | Clarifier mode | Résumé avant save |
| Save Add | Valide | Clic | Créer | Implémenté + toast | PASS | — | P2 | S | Conserver | Visible immédiatement |
| Edit custom | Menu | Clic | Renommer | Fonctionne seulement custom | PASS | — | P2 | S | Indiquer custom | Système verrouillé expliqué |
| Delete custom no tx | Menu | Jusqu’avant action | Supprimer | Implémenté | PASS | — | P1 | S | Confirm/Undo | Restaurable |
| Delete category with tx | Menu | Clic | Bloquer + expliquer | Disabled selon count | PASS | — | P2 | S | CTA reclasser | Cause visible |
| Review uncategorized | Uncategorized >0 | Clic | `/transactions?category=Uncategorized` | Lien prévu | PASS | — | P2 | S | Conserver | Filtre appliqué |
| Navigation directe | Toutes | Chercher dans dock | Atteindre page | Absente de nav globale | FAIL | Page cachée | P1 | S | Ajouter More | ≤2 actions |

### 4.13 Settings — `src/app/settings/page.tsx` et `src/components/settings/*`

#### Navigation Settings

| Contrôle | Précondition | Action | Attendu | Observé | Résultat | Impact | Sév. | Effort | Correction | Critère |
|---|---|---|---|---|---|---|---|---|---|---|
| Appearance | Desktop | Clic | Section apparence | Fonctionne | PASS | — | P3 | S | Conserver | État actif |
| Notifications | Desktop | Clic | Section notifications | Fonctionne | PASS | — | P3 | S | Conserver | — |
| Currency | Desktop | Clic | Section devise | Fonctionne | PASS | — | P3 | S | Conserver | — |
| Financial Month | Desktop | Clic | Section période | Fonctionne | PASS | — | P3 | S | Conserver | — |
| Balances | Desktop | Clic | Section soldes | Fonctionne | PASS | — | P2 | S | Deep-link | URL ou query stable |
| Data Management | Desktop | Clic | Sauvegarde/reset | Fonctionne | PASS | — | P2 | S | Conserver | — |
| Help & FAQ | Desktop | Clic | Aide | Fonctionne | PASS | — | P3 | S | Conserver | — |
| About | Desktop | Clic | Version/info | Fonctionne | PASS | — | P3 | S | Conserver | — |
| Mobile settings select | `<md` | Choisir | Changer section | Native select | PASS code | — | P2 | S | Conserver | Label associé |
| Browser Back/deep link | Section interne | Back/URL | Restaurer section | État local, pas de route/query | FAIL | Lien depuis alerte impossible | P1 | M | `?section=balances` | Back/refresh conserve |

#### Appearance — `appearance-settings.tsx`

| Contrôle | Action | Attendu | Observé | Résultat | Impact | Sév. | Effort | Correction | Critère |
|---|---|---|---|---|---|---|---|---|---|---|
| Light | Clic | Mode clair global/persistant | Manipule localStorage + DOM directement | AMBIGU | Provider dock peut rester stale | P1 | M | Utiliser `useTheme` | Une seule source |
| Dark | Clic | Mode sombre | Rendu observé, contraste global meilleur | PASS visuel | — | P2 | S | Conserver via provider | Reload stable |
| System | Clic | Suivre OS et changements live | Lit media au moment du clic, mais composant n’écoute pas ensuite | FAIL | Ne suit pas changement OS | P1 | M | ThemeProvider unique listener | Bascule OS reflétée |
| Coral | Clic | Accent coral | Fonctionne | PASS | — | P3 | S | Corriger contraste | AA |
| Ocean/Sage/Violet/Rose/Graphite | Clic | Accent alternatif | Contexte preset prévu | PASS code | — | P2 | M | Tester contrastes tous thèmes | Matrice AA |
| Custom | Clic | Ouvrir picker | Fonctionne | PASS | — | P3 | S | Conserver | Focus picker |
| Add custom color | Choisir + Add non exécuté | Ajouter preset | Implémenté | PASS code | — | P2 | S | Calcul contraste en live | Refuser inaccessible |
| Remove custom | Hover X | Supprimer preset | Hover-only, minuscule, pas mobile | FAIL | Inaccessible touch | P1 | S | Menu visible | Bouton 44 px nommé |

#### Notifications — `notifications-settings.tsx`, `src/hooks/use-notifications.ts`

| Contrôle | Action | Attendu | Observé | Résultat | Impact | Sév. | Effort | Correction | Critère |
|---|---|---|---|---|---|---|---|---|---|---|
| Enable browser notifications | Clic non exécuté (permission OS) | Demander permission à l’action | Implémentation correcte + test notification | PASS code | — | P2 | S | Conserver | Permission seulement au clic |
| Permission denied | Refus | Expliquer récupération | Toast warning seulement | AMBIGU | Pas de chemin réglages navigateur | P2 | S | Aide ciblée | Instructions affichées |
| Budget threshold 50/75/80/90/100 | Changer | Modifier génération alertes | Valeur stockée, mais hook utilise 90 %/100 % en dur | FAIL | Faux réglage | P1 | S | Lire setting dans hook | Test chaque seuil |
| Notification account scope | Compte sélectionné | Recevoir alertes pertinentes | Hook agrège toutes transactions sans scope visible | AMBIGU | Périmètre caché | P1 | M | Badge foyer/compte | Corps nomme compte |

#### Currency — `currency-settings.tsx`

| Contrôle | Action | Attendu | Observé | Résultat | Impact | Sév. | Effort | Correction | Critère |
|---|---|---|---|---|---|---|---|---|---|---|
| Base currency select | Changer | Convertir agrégats | Context implémenté | PASS code | — | P1 | M | Conserver + confirmation | Tous agrégats changent |
| Rates status | Lire | Source/fraîcheur | Affiche « Live Exchange Rates » + updated | AMBIGU | Source absente | P1 | S | Nom source/offline fallback | Provenance visible |
| Conversion note | Lire | Explication | Affiche littéralement `**Total Balance**` et `**Analytics**` | FAIL | Finition cassée | P3 | S | JSX `<strong>` | Pas d’astérisques |
| Account currency invalid | Accounts | Devise libre | Liste supportée | Account form est texte libre | FAIL | Conversion impossible | P1 | S | Select commun | Code valide seulement |

#### Financial Month — `financial-month-settings.tsx`, `src/lib/financial-month.ts`

| Contrôle | Action | Attendu | Observé | Résultat | Impact | Sév. | Effort | Correction | Critère |
|---|---|---|---|---|---|---|---|---|---|---|
| Auto-detect salary | Choisir/save | Pages suivent date salaire | Settings/engine existent; Dashboard/Analytics/Budgets utilisent calendrier | FAIL | Faux contrôle | P1 | L | Brancher toutes pages ou retirer | Plages changent partout |
| Minimum salary | Saisir/save | Détection salaire | Utilisé par engine dédié, pas pages principales | FAIL | Idem | P1 | M | Source commune salaire | Cas 999/1001 testés |
| Fixed day | Choisir 1–28/save | Périodes fixes | Engine existe, UI principale ne l’emploie pas | FAIL | Idem | P1 | L | Hook global période | Titres reflètent |
| Calendar month | Choisir/save | 1er–fin | Correspond comportement actuel | PASS par défaut | — | P3 | S | Montrer état actif global | — |
| Save changes | Clic non exécuté | Persister + toast | Implémenté | PASS code | — | P2 | S | Conserver | Reload stable |

#### Balances — `account-balance-settings.tsx`

| Contrôle | Action | Attendu | Observé | Résultat | Impact | Sév. | Effort | Correction | Critère |
|---|---|---|---|---|---|---|---|---|---|---|
| Account select | Choisir | Charger état | Fonctionne | PASS | — | P2 | S | Conserver | — |
| Initial balance/date | Modifier/save non exécuté | Recalculer | Implémenté | PASS code | Risque fort | P1 | M | Preview delta | Avant/après visible |
| Add checkpoint toggle | Clic | Formulaire | Fonctionne | PASS | — | P2 | S | Conserver | `aria-expanded` |
| Checkpoint date/balance | Saisir | Ajouter | Implémenté | PASS | — | P1 | S | Validation chronologique | Doublon date géré |
| Add checkpoint | Clic non exécuté | Enregistrer/recalculer | Implémenté | PASS code | — | P1 | M | Toast + delta | Plan mis à jour |
| Delete checkpoint | Clic non exécuté | Confirmer | Handler direct | FAIL | Perte historique | P1 | S | Dialog + Undo | Restore possible |
| Recalculate all | Clic non exécuté | Réparer soldes | Implémenté | AMBIGU | Pas d’aperçu | P1 | M | Dry run | Delta par compte |

#### Data Management — `data-management-settings.tsx`

| Contrôle | Action | Attendu | Observé | Résultat | Impact | Sév. | Effort | Correction | Critère |
|---|---|---|---|---|---|---|---|---|---|---|
| Export backup plain | Clic non exécuté | Télécharger sauvegarde | Implémenté | PASS code | — | P1 | M | Afficher contenu/counts | Fichier restaurable |
| Encryption toggle/passphrase | Activer + dialog | Chiffrer | Dialog dédié | PASS code | — | P1 | M | Confirmation passphrase | Mauvaise passphrase testée |
| Import backup file | Choisir non exécuté | Preview avant write | Restore preview dialog | PASS code | — | P0 | L | Conserver | Aucun write avant confirm |
| Decrypt and Preview | Passphrase | Valider | Diagnostics | Implémenté | PASS code | — | P1 | M | Conserver | Erreur claire |
| Download diagnostics | Restore warnings | Clic | Télécharger rapport | Implémenté | PASS code | — | P2 | S | Conserver | Aucune donnée sensible imprévue |
| Confirm Restore | Preview | Clic non exécuté | Restore atomique | Implémenté | AMBIGU | Rollback non visible | P0 | L | Snapshot auto/transaction | Échec ne corrompt pas |
| Reset all data | Clic jusqu’au dialog | Protection forte | Dialog présent | PASS | — | P0 | M | Phrase de confirmation/export CTA | Impossible accidentel |
| Confirm Reset | Non exécuté | Supprimer | Bouton destructif | PASS code | — | P0 | M | Backup one-click avant | Audit log local |

#### Help/About

| Contrôle | Action | Attendu | Observé | Résultat | Impact | Sév. | Effort | Correction | Critère |
|---|---|---|---|---|---|---|---|---|---|---|
| FAQ items | Ouvrir | Réponse | Composant présent | PASS code | — | P3 | S | Mettre à jour terminologie | Réponses cohérentes |
| About version | Lire | Version actuelle | Surface présente | PASS | — | P3 | S | Lier changelog | Version package alignée |
| Stress test control | Chercher | Dev-only | Composant existe mais exposition à contrôler | AMBIGU | Données de test en prod | P1 | S | Dev gate | Absent production |

## 5. Passe 2 — navigation et architecture de l’information

L’architecture actuelle traite toutes les fonctions comme des destinations équivalentes. Or les tâches réelles sont hiérarchiques : comprendre aujourd’hui, décider cette semaine, corriger une donnée, puis analyser. Le dock ne communique pas cette hiérarchie.

Architecture cible :

1. **Aujourd’hui** : situation du foyer, prochain point bas, prochaine entrée, reste sûr à dépenser, actions.
2. **Transactions** : recherche, catégorisation, qualité des données.
3. **Plan** : semaine en cours, trajectoire 13 semaines, scénarios.
4. **Analyse** : mois, catégories, salaires, tendances.
5. **Gestion** : budgets, récurrents/calendrier, objectifs, comptes, catégories, import, réglages.

Le scope doit être un composant global textuel : `Foyer — 1 521 €`, `Anthonny — 1 774 €`, `Mirane — −253 €`. Une page obligatoirement foyer doit désactiver le switch ou expliquer pourquoi.

## 6. Passe 3 — parcours foyer et changement de compte

### Scénario testé

1. Ouvrir Dashboard en Foyer.
2. Ouvrir le sélecteur de comptes.
3. Choisir Mirane.
4. Observer KPI, dépenses, transactions et soldes.
5. Naviguer vers une page analytique.
6. Revenir à Foyer.

### Résultat

Le Dashboard Mirane affiche notamment un taux d’épargne −10 %, une dépense quotidienne 27 €, une projection 823 €, 796 € de dépenses et un net septembre −74 €. La carte Balance continue cependant d’afficher le foyer et les trois comptes. Ce mélange pourrait être utile, mais n’est jamais expliqué. Le dock n’affiche qu’une pastille de couleur, donc une capture ou une lecture ultérieure ne permet pas d’identifier le périmètre.

Critères globaux :

- chaque page affiche scope + période dans le premier viewport ;
- tout lien transmet scope et période, ou annonce le changement ;
- aucune carte d’un compte n’est alignée avec un total foyer sans label explicite ;
- Plan indique toujours « Foyer » et explique qu’il ignore le filtre individuel ;
- Goals indique quels objectifs sont virtuels, foyer ou liés à un compte.

## 7. Passe 4 — import de deux comptes et récupération d’erreur

Parcours cible recommandé :

1. Choisir/créer `Anthonny`.
2. Charger CSV; montrer format, titulaire détecté, période, nombre de lignes, solde début/fin.
3. Résoudre erreurs bloquantes; afficher doublons.
4. Confirmer compte + chiffres; importer.
5. Proposer `Importer le compte de Mirane`.
6. Répéter puis détecter transferts croisés.
7. Montrer rapprochement : comptes, soldes, transactions, transferts appariés, revenus reconnus.

États obligatoires : mauvais format, fichier vide, colonnes inconnues, encodage invalide, dates hors plage, montants invalides, compte incohérent, réimport intégral, import partiel après erreur, navigateur sans stockage, quota dépassé. Chaque erreur doit préciser ce qui a été écrit ou non.

## 8. Passe 5 — transactions, édition et bulk

Le produit couvre déjà la majorité des actions expertes. La refonte doit préserver cette puissance mais appliquer une divulgation progressive : barre de recherche + 3 filtres principaux, bouton « Plus de filtres », résumé sous forme de chips, puis actions bulk uniquement en sélection.

Les actions d’une ligne doivent être disponibles sans hover. Sur mobile, une carte transaction doit montrer marchand, date, montant, catégorie et menu. La totalité de la ligne doit être un bouton clavier correctement nommé.

## 9. Passe 6 — décisions financières

Le parcours Budgets → Plan → Goals ne répond pas encore directement à la question « combien puis-je dépenser cette semaine sans retomber sous mon plancher ? ». La page Plan doit porter cette décision et recevoir les enveloppes de Budgets ainsi que les contributions Goals. Une modification dans l’un doit montrer son impact sur la trajectoire avant sauvegarde.

## 10. Passe 7 — analytics et compréhension des chiffres

Chaque visualisation doit offrir quatre niveaux : résumé textuel, graphique, tableau accessible, drilldown transactions. Les graphiques actuels couvrent surtout les deux premiers. Les tooltips seuls ne sont pas une interface acceptable sur tactile, clavier ou lecteur d’écran.

## 11. Passe 8 — récurrents, calendrier, notifications

Trois moteurs doivent être fusionnés : habitudes Analytics, prédiction Dashboard et objets Subscriptions/Calendar. La cible UX est une inbox de suggestions avec confiance, compte, marchand, montant, cadence et actions Confirmer/Rejeter/Fusionner. Une suggestion confirmée devient immédiatement visible dans Calendar, Dashboard et Plan.

## 12. Passe 9 — mobile, clavier, erreurs et états

### Défauts transverses

- Dock estimé à plus de 400 px, incompatible avec 320/390 px.
- `DataTable` Transactions et Accounts sans wrapper horizontal ni variante cartes.
- Actions hover-only non disponibles au tactile.
- 56 occurrences approximatives de boutons/icônes contre seulement 22 labels/titres repérés dans les surfaces ciblées.
- Dialogues destructifs parfois Radix, parfois `window.confirm`.
- États disabled souvent corrects mais rarement accompagnés d’une raison.
- Plusieurs empty states décrivent l’absence mais ne proposent pas la récupération appropriée.
- Les charts n’exposent pas leurs points exacts au clavier.

### Contrastes calculés

| Paire | Ratio | Verdict |
|---|---:|---|
| `#8E8E93` / blanc | 3,26:1 | Échec texte normal AA |
| `#FF6B4A` / blanc | 2,82:1 | Échec boutons texte blanc |
| `#EEEEF2` / blanc | 1,16:1 | Frontière presque invisible |
| `#98989D` / `#18181A` | 6,17:1 | Mode sombre lisible |

Le mode clair observé paraît délavé : frontières, sous-titres et axes se confondent. Le mode sombre a une meilleure hiérarchie, mais l’accent coral avec texte blanc reste à corriger.

## 13. Passe 10 — revue Nielsen

| Heuristique | Évaluation | Preuve | Priorité |
|---|---|---|---|
| Visibilité du statut système | Partiel | Import et save utilisent des états; exclusion transaction, changements budget et scope manquent de feedback durable | P1 |
| Correspondance monde réel | Faible | « Savings used 206 % », transferts comme dépenses, `Can spend/day 891 €` | P0 |
| Contrôle et liberté | Partiel | Reset/Cancel présents; exclusions/suppressions manquent souvent Undo | P1 |
| Cohérence et standards | Faible | Plusieurs moteurs, deux thèmes, deux confirmations, deux concepts recurring | P0 |
| Prévention des erreurs | Moyenne | Import protège fichier sans compte; mauvais compte récurrent/import reste possible | P0 |
| Reconnaissance plutôt que mémoire | Faible | Recherche/privacy/raccourcis cachés, dock icônes seules | P1 |
| Flexibilité et efficacité | Bonne experts | Cmd+K, filtres, bulk, raccourcis; non découvrables | P2 |
| Esthétique/minimalisme | Partiel | Style cohérent, mais trop de cartes blanches et graphiques sans détails accessibles | P2 |
| Diagnostic/récupération erreur | Inégal | Import/restore bons; autres actions affichent peu d’erreurs contextualisées | P1 |
| Aide/documentation | Partielle | Notes méthodologiques Analytics/Plan; pas de glossaire commun | P2 |

## 14. Matrice route × action × état × breakpoint × thème

Légende : D = desktop observé; M = comportement mobile déduit/inspecté; C = clair observé; S = sombre observé; E = empty; L = loading; F = filled; X = erreur/limite.

| Route | Action centrale | D | M | C | S | E | L | F | X | Verdict synthétique |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `/` | Comprendre situation | ✓ | △ | △ | ✓ | ✓ | ✓ | ✓ | △ | Chiffres faux vs Analytics; mobile dock; clair faible |
| `/` | Changer compte | ✓ | △ | ✓ | ✓ | ✓ | ✓ | ✓ | △ | Calcul change, scope invisible |
| `/` | Explorer cash flow | ✓ | △ | △ | ✓ | ✓ | ✓ | ✓ | △ | Tooltip-only, boutons non nommés |
| `/transactions` | Rechercher/filtrer | ✓ | △ | △ | ✓ | ✓ | ✓ | ✓ | △ | Puissant; pas reset; grille coupe mobile |
| `/transactions` | Éditer | ✓ | △ | ✓ | ✓ | — | ✓ | ✓ | △ | Bon dialog; actions hover-only |
| `/transactions` | Bulk | ✓ | △ | ✓ | ✓ | — | ✓ | ✓ | △ | Fonctionnel; delete confirm natif |
| `/analytics` | Changer période | ✓ | ✓ | △ | ✓ | ✓ | ✓ | ✓ | △ | Base fiable; scope label faux |
| `/analytics` | Lire charts | ✓ | △ | △ | ✓ | ✓ | ✓ | ✓ | △ | Pas de tableau/drilldown |
| `/budgets` | Configurer règle | ✓ | △ | △ | ✓ | ✓ | ✓ | ✓ | △ | Scope budget/compte incohérent |
| `/budgets` | Ajuster catégorie | ✓ | △ | △ | ✓ | ✓ | ✓ | ✓ | △ | Variation non expliquée |
| `/plan` | Configurer hypothèses | ✓ | △ | △ | ✓ | ✓ | ✓ | ✓ | △ | Calcul riche; cible triviale |
| `/plan` | Décider semaine | △ | △ | △ | ✓ | — | ✓ | ✓ | △ | Safe-to-spend non explicite |
| `/goals` | Créer/éditer | ✓ | △ | △ | ✓ | ✓ | ✓ | ✓ | △ | Virtuel vs réel ambigu |
| `/goals/:id` | Contribuer/forecast | ✓ | △ | △ | ✓ | ✓ | ✓ | ✓ | △ | États vides corrects |
| `/subscriptions` | Détecter | △ | △ | △ | ✓ | ✓ | ✓ | △ | △ | All accounts faux |
| `/subscriptions` | Ajouter/gérer | ✓ | △ | △ | ✓ | ✓ | ✓ | ✓ | △ | Compte cible caché |
| `/calendar` | Naviguer mois | ✓ | △ | △ | ✓ | ✓ | ✓ | △ | △ | Empty sans CTA, boutons jours vides |
| `/accounts` | Ajouter/éditer | ✓ | △ | △ | ✓ | ✓ | ✓ | ✓ | △ | Devise libre, table mobile |
| `/accounts` | Supprimer | ✓ | △ | ✓ | ✓ | — | — | ✓ | ✓ | Protection présente |
| `/import` | Choisir compte/fichier | ✓ | ✓ | △ | ✓ | ✓ | ✓ | ✓ | ✓ | Bon garde initial |
| `/import` | Preview/import/retry | ✓ | ✓ | △ | ✓ | ✓ | ✓ | ✓ | △ | Bon moteur; second compte non guidé |
| `/categories` | Explorer | ✓ | △ | △ | ✓ | ✓ | ✓ | ✓ | △ | Totaux bruts incohérents |
| `/categories` | Ajouter/éditer | ✓ | △ | △ | ✓ | ✓ | ✓ | ✓ | △ | Page cachée |
| `/settings` | Naviguer sections | ✓ | ✓ | △ | ✓ | — | ✓ | ✓ | △ | Pas de deep-link/back |
| `/settings` | Apparence | ✓ | △ | △ | ✓ | — | ✓ | ✓ | △ | Deux systèmes theme |
| `/settings` | Notifications | ✓ | △ | △ | ✓ | ✓ | ✓ | ✓ | ✓ | Seuil sans effet |
| `/settings` | Financial month | ✓ | △ | △ | ✓ | — | ✓ | ✓ | ✓ | Réglage non consommé |
| `/settings` | Balances | ✓ | △ | △ | ✓ | ✓ | ✓ | ✓ | ✓ | Essentiel mais enfoui |
| `/settings` | Backup/restore/reset | ✓ | △ | △ | ✓ | ✓ | ✓ | ✓ | ✓ | Bon niveau, rollback à renforcer |
| `/lab*` | Ouvrir variantes | ✓ | △ | variable | variable | — | — | ✓ | — | Doit être dev-only |

## 15. Actions sans feedback ou feedback insuffisant

| ID | Route/composant | Action | Feedback actuel | Correction atomique |
|---:|---|---|---|---|
| FB-01 | Transactions ligne | Exclure/inclure | Changement d’opacité seulement | Toast `Excluded from budgets & analytics` + Undo |
| FB-02 | Transactions edit | Save | Dialog se ferme | Toast avec marchand + lien Undo |
| FB-03 | Transactions bulk | Apply | Fermeture/refresh | Résumé `24 mises à jour, 1 ignorée` |
| FB-04 | Transactions export | Export | Téléchargement navigateur seulement | Toast nom du fichier + nombre de lignes |
| FB-05 | Budgets category | Save | Changement de valeur | Toast + période + ancienne/nouvelle valeur |
| FB-06 | Budgets overrides | Change type | Point/badge change | Toast + effet sur totaux |
| FB-07 | Plan inputs | Modifier | Recalcul silencieux | Marqueur `Unsaved assumptions` |
| FB-08 | Plan save | Save | Toast global | Ajouter timestamp `Saved just now` |
| FB-09 | Goals sort | Choisir | Ordre change | Libellé du bouton devient mode actif |
| FB-10 | Goal contribution | Save | Dialog ferme | Toast + nouveau progrès |
| FB-11 | Subscription pause | Pause | Carte change | Toast Undo |
| FB-12 | Subscription exclude | Exclude | Carte disparaît | Toast Undo + onglet Excluded |
| FB-13 | Calendar empty day | Clic | Rien | Ne pas rendre interactif |
| FB-14 | Account selected | Choisir | Pastille change | Afficher nom scope dans page/dock |
| FB-15 | Account recalc | Recalculate | Spinner puis valeur | Rapport delta par compte |
| FB-16 | Appearance accent | Choisir | Couleur change | Check persistant + nom visible |
| FB-17 | Notification threshold | Choisir | Valeur select change | Une fois corrigé, toast `Alerts at 80%` |
| FB-18 | Financial month | Save | Toast | Afficher période actuelle résultante |
| FB-19 | Import complete | Continue | Navigation | Résumé persistant accessible après import |
| FB-20 | Command shortcuts | Taper `g` sans suite | Rien | Petit overlay des destinations pendant 900 ms |

## 16. Pages à refaire entièrement

### 16.1 Dashboard — refonte complète P1/L

Ordre recommandé :

1. **Situation aujourd’hui** : solde foyer, comptes, date de fraîcheur.
2. **Avant le prochain revenu** : prochain point bas, prochaine entrée, factures, safe-to-spend.
3. **Cette semaine** : budget prévu, réalisé, reste, trois actions.
4. **Ce mois** : revenu réel, dépenses réelles, net et comparaison comparable.
5. **À vérifier** : transactions inconnues, transferts non appariés, anomalies.

Supprimer du premier viewport les métriques décoratives si elles ne conduisent pas à une décision. Tous les totaux doivent provenir du moteur Analytics.

### 16.2 Plan — refonte complète P1/L

Transformer le calculateur en boucle opérationnelle : confirmer soldes → fixer cible → confirmer hypothèses → obtenir plan → suivre réel → corriger. Ajouter une carte dominante : `Vous pouvez dépenser 588 € cette semaine; 178 € resteront avant le salaire; plancher −800 € non franchi`.

### 16.3 Budgets — refonte structurelle P1/L

Décider si le budget est foyer ou par compte. Remplacer Need/Want/Savings sur transferts par besoins fixes, variables contrôlables, épargne réelle et transferts neutres. Montrer le montant à ajuster, pas uniquement des pourcentages.

### 16.4 Subscriptions + Calendar — fusion P1/L

Unifier suggestions, récurrents confirmés, échéances et paiements. Le calendrier devient une timeline cash avec sorties et revenus. Dashboard et Plan consomment la même source.

### 16.5 Navigation — refonte complète P1/L

Desktop : sidebar/rail avec libellés. Mobile : quatre tabs + Plus. Header : scope, search, privacy, notifications. Supprimer l’ancienne Sidebar/Header inutilisée après migration.

## 17. Backlog atomique priorisé

Chaque ligne correspond à un seul changement vérifiable.

| ID | Priorité | Composant | Tâche atomique | Effort | Critère d’acceptation |
|---:|---:|---|---|---:|---|
| 001 | P0 | Financial engine | Exposer une fonction unique `recognizedIncome` | M | Septembre retourne 4 401,27 € partout |
| 002 | P0 | Financial engine | Exposer une fonction unique `realExpenses` | M | Même total toutes pages |
| 003 | P0 | Financial engine | Exposer une fonction unique `netCashFlow` | S | `income-expenses` au centime |
| 004 | P0 | Dashboard | Remplacer revenu QuickStats par moteur commun | S | 4 401 € septembre |
| 005 | P0 | Dashboard | Remplacer MonthlySummary par moteur commun | S | Net −1 223 € |
| 006 | P0 | Dashboard chart | Exclure remboursements des crédits revenus | S | Barre septembre reconnue |
| 007 | P0 | Dashboard chart | Neutraliser transferts internes appariés | M | Aucun double comptage |
| 008 | P0 | Goals | Remplacer net savings Dashboard par moteur commun | S | Même net Analytics |
| 009 | P0 | Categories | Calculer total income avec règle reconnue | S | Même période = même montant |
| 010 | P0 | Categories | Exclure transferts internes du total expenses | M | Transfers section séparée |
| 011 | P0 | Budgets | Décider et encoder scope foyer/compte | L | Budget et spend même scope |
| 012 | P0 | Budgets | Retirer transferts internes de Savings spent | M | 1 900 € non dépensés |
| 013 | P0 | Transactions recurring | Utiliser `transaction.accountId` à la création | S | Test Mirane passe |
| 014 | P0 | Subscriptions detect | Boucler tous comptes en scope All | M | Résultat par compte |
| 015 | P0 | Subscriptions add | Rendre le compte cible obligatoire | M | Aucun fallback premier compte |
| 016 | P0 | Import | Ajouter garde titulaire/compte cible | M | Mismatch bloque import |
| 017 | P0 | Data contract | Ajouter test chiffres cross-pages septembre | M | Dashboard=Analytics=Goals |
| 018 | P0 | Restore | Rendre restauration atomique avec rollback | L | Échec conserve DB initiale |
| 019 | P1 | Navigation | Afficher nom du scope dans le dock/header | S | `Foyer/Anthonny/Mirane` visible |
| 020 | P1 | Navigation | Ajouter bouton Search visible | S | Palette ouverte tactile |
| 021 | P1 | Navigation | Ajouter bouton Privacy visible | S | Montants masqués tactile |
| 022 | P1 | Navigation | Ajouter Categories au menu | S | Accessible en ≤2 clics |
| 023 | P1 | Navigation mobile | Limiter nav primaire à quatre items | M | Aucun overflow 320 px |
| 024 | P1 | Navigation | Remplacer clé par ellipsis/Plus | S | Affordance comprise |
| 025 | P1 | Lab | Gater `/lab*` hors dev | S | 404 production |
| 026 | P1 | Dashboard | Ajouter carte Situation aujourd’hui | M | Solde + fraîcheur visibles |
| 027 | P1 | Dashboard | Ajouter carte Avant prochain revenu | L | Point bas/date/revenu |
| 028 | P1 | Dashboard | Ajouter safe-to-spend semaine | M | Montant actionnable |
| 029 | P1 | Dashboard budget | Ne pas plafonner ratio à 100 % | S | 152 % affiché |
| 030 | P1 | Dashboard anomalies | Exclure transferts appariés | S | Transfer Out absent |
| 031 | P1 | Dashboard recent | Rendre ligne ouvrable | S | Ouvre `editId` |
| 032 | P1 | Transactions | Ajouter Reset filters | S | Un clic défaut |
| 033 | P1 | Transactions | Valider end date ≥ start date | S | Message inline |
| 034 | P1 | Transactions | Ajouter toast Undo exclusion | S | Restauration 5 s |
| 035 | P1 | Transactions | Remplacer `window.confirm` delete transaction | S | Dialog ciblé |
| 036 | P1 | Transactions | Remplacer `window.confirm` bulk delete | S | Compteur/cible |
| 037 | P1 | Transactions | Rendre actions visibles au tactile | M | Menu toujours accessible |
| 038 | P1 | Transactions table | Implémenter sémantique table/ARIA grid | L | Axe sans erreur |
| 039 | P1 | Transactions mobile | Créer carte transaction mobile | M | 320 px sans coupe |
| 040 | P1 | Transaction badges | Donner couleurs distinctes Need/Want/Saving | S | 3:1 composants |
| 041 | P1 | Transaction badges | Corriger couleur texte sur fond | S | 4.5:1 texte |
| 042 | P1 | Analytics | Rendre sous-titre scope dynamique | S | Pas « household » en compte |
| 043 | P1 | Analytics | Ajouter tableau Income/Expenses mensuel | M | Valeurs clavier |
| 044 | P1 | Analytics | Ajouter drilldown barre → transactions | M | Filtres période+type |
| 045 | P1 | Analytics | Ajouter drilldown catégorie | M | Catégorie+mois |
| 046 | P1 | Top Merchants | Exclure transferts internes | S | Marchand réel premier |
| 047 | P1 | Top Merchants | Ajouter CTA Unknown cleanup | S | Transactions Unknown ouvertes |
| 048 | P1 | Plan | Exiger confirmation de cible | S | Pas Target reached par défaut |
| 049 | P1 | Plan | Afficher date du point bas | S | Semaine/date visibles |
| 050 | P1 | Plan | Ajouter CTA depuis alerte checkpoint | S | Ouvre balance ciblée |
| 051 | P1 | Plan | Afficher différences de scénario | M | Deltas hypothèses |
| 052 | P1 | Plan | Afficher provenance enveloppe Needs | M | Catégories/moyenne |
| 053 | P1 | Plan | Afficher provenance enveloppe Wants | M | Catégories/moyenne |
| 054 | P1 | Plan | Afficher liste coûts fixes | M | Somme = 876,88 € |
| 055 | P1 | Plan | Ajouter prévu/réel par semaine | L | Reste calculé |
| 056 | P1 | Plan | Ajouter carte safe-to-spend | M | Décision immédiate |
| 057 | P1 | Plan | Unifier toute la langue | M | 100 % FR choisi |
| 058 | P1 | Goals | Séparer création Virtual/Linked | M | Mode explicite |
| 059 | P1 | Goals | Renommer Net funding pour contributions | S | Aucun amalgame foyer |
| 060 | P1 | Goals | Remplacer montant signé par Deposit/Withdrawal | M | Signe dérivé |
| 061 | P1 | Recurring | Créer moteur unique partagé | L | Un seul résultat |
| 062 | P1 | Recurring | Créer inbox suggestions | L | Confirm/reject/merge |
| 063 | P1 | Calendar | Afficher revenus récurrents | M | Salaires/CAF visibles |
| 064 | P1 | Calendar | Rendre jours vides non interactifs | S | Non focusables |
| 065 | P1 | Calendar | Ajouter CTA Auto-Detect empty state | S | Chemin récupération |
| 066 | P1 | Accounts | Remplacer champ currency par Select | S | Code supporté seulement |
| 067 | P1 | Accounts | Ajouter date au solde initial | M | Solde daté |
| 068 | P1 | Accounts | Nommer boutons edit/delete | S | AX explicite |
| 069 | P1 | Accounts table | Sémantique table | L | Axe propre |
| 070 | P1 | Accounts mobile | Cartes responsive | M | 320 px |
| 071 | P1 | Account health | Signaler compte orphelin 0 € | S | Action merge/delete |
| 072 | P1 | Import | Ajouter CTA Import second account | S | Parcours continue |
| 073 | P1 | Import | Ajouter résumé target account avant write | S | Compte+titre visibles |
| 074 | P1 | Import | Ajouter retry idempotent | M | Aucun doublon |
| 075 | P1 | Categories | Ajouter Quality center Unknown | M | Total/compteur/actions |
| 076 | P1 | Settings nav | Deep-link sections | M | Back/refresh stable |
| 077 | P1 | Theme | Utiliser ThemeProvider dans Appearance | M | Dock synchronisé |
| 078 | P1 | Theme | Écouter changement système | S | Bascule live |
| 079 | P1 | Notifications | Lire budgetAlertThreshold dans hook | S | 50–100 % effectifs |
| 080 | P1 | Financial Month | Brancher période Dashboard | L | KPI plage choisie |
| 081 | P1 | Financial Month | Brancher période Budgets | L | Budget période choisie |
| 082 | P1 | Financial Month | Brancher période Analytics ou retirer option | L | Contrat clair |
| 083 | P1 | Balances | Confirmer suppression checkpoint | S | Pas suppression accidentelle |
| 084 | P1 | Balances | Preview recalculation delta | M | Avant/après par compte |
| 085 | P1 | Accessibility | Assombrir muted foreground clair | S | ≥4.5:1 |
| 086 | P1 | Accessibility | Corriger primary button contrast | S | ≥4.5:1 |
| 087 | P1 | Accessibility | Renforcer frontières composants | S | ≥3:1 utile |
| 088 | P1 | Accessibility | Nommer flèches de graphiques | S | Axe annonce action |
| 089 | P1 | Accessibility | Nommer actions Calendar | S | Axe annonce mois |
| 090 | P1 | Accessibility | Tester axe clair/sombre toutes routes | M | 0 critique |
| 091 | P2 | Dashboard | Remplacer `there` par foyer ou retirer | S | Copie pertinente |
| 092 | P2 | Dashboard | Expliquer moyenne quotidienne | S | Formule tooltip |
| 093 | P2 | Analytics | Ajouter motifs/patterns aux séries | M | Pas couleur seule |
| 094 | P2 | Analytics | Ajouter bonus vs salaire de base | M | Bonus distingué |
| 095 | P2 | Budgets | Libeller variation `vs last month` | S | Plus de −46 % nu |
| 096 | P2 | Budgets | Remplacer Can Spend/Day par Remaining | S | Pas incitation trompeuse |
| 097 | P2 | Goals | Afficher source progression sur carte | S | Virtual/account visible |
| 098 | P2 | Subscriptions | Ajouter aperçu 3 prochaines dates | M | Cadence vérifiable |
| 099 | P2 | Currency | Corriger Markdown littéral | S | Texte rendu |
| 100 | P2 | Feedback | Standardiser tous toasts + Undo | M | Pattern documenté |

## 18. Critères de sortie de la refonte

La refonte ne doit pas être considérée terminée avant que les conditions suivantes soient satisfaites :

1. Les chiffres de revenu, dépenses et net sont identiques sur toutes les surfaces pour une même période et un même scope.
2. Toute surface financière montre compte(s), période, date de fraîcheur et principales exclusions.
3. Importer ou créer un récurrent depuis Mirane ne peut jamais écrire silencieusement sur Anthonny.
4. Le Dashboard répond en moins de dix secondes à : solde, prochain point bas, prochain revenu, montant disponible cette semaine.
5. Le Plan compare prévu et réel et ne déclare pas une cible atteinte tant qu’elle n’a pas été confirmée.
6. Les budgets ne présentent aucun transfert interne comme dépense ou épargne consommée.
7. Subscriptions, Calendar, Upcoming Bills et Analytics utilisent le même moteur récurrent.
8. Toutes les actions sont accessibles à 320 px, au clavier, au toucher et au lecteur d’écran.
9. Tous les textes et composants atteignent WCAG AA dans chaque accent clair et sombre.
10. Chaque réglage visible a un effet observable et testé; sinon il est retiré.
11. Chaque action destructive montre la cible et offre une récupération lorsque techniquement possible.
12. `/lab` et les contrôles de stress ne sont pas exposés en production.

## 19. Conclusion

WealthPilot possède déjà une base fonctionnelle riche : import local, édition avancée, multi-comptes, règles marchands, bulk actions, objectifs, plan hebdomadaire, sauvegarde/restauration et un nouveau moteur Analytics crédible. Le travail prioritaire n’est pas d’ajouter encore des widgets. Il faut unifier les définitions, rendre le périmètre évident, transformer le Plan en outil de décision hebdomadaire et construire une navigation/accessibilité réellement utilisable.

La séquence recommandée est : contrats financiers P0 → comptes/récurrents P0 → navigation/contrastes P1 → Dashboard/Plan/Budgets P1 → fusion récurrents/calendrier P1 → responsive/accessibilité → finitions et tendances visuelles.
