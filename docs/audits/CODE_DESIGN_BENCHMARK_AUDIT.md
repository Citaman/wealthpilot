# WealthPilot — audit CODE UI × DESIGN SYSTEM × BENCHMARK

**Date de l’audit :** 29 septembre 2026
**Périmètre :** tout le front `src/app`, `src/components`, `src/contexts`, `src/hooks`, thèmes clair/sombre, desktop/mobile, PWA et routes laboratoire.
**Nature :** audit uniquement ; aucun code produit n’a été modifié.
**Méthode :** lecture exhaustive des routes et composants, recherches statiques reproductibles, tests de l’application locale, inspection visuelle et arbre d’accessibilité, comparaison à des sources officielles.

## 0. Verdict exécutable

WealthPilot possède une base fonctionnelle riche, mais pas encore un système produit unifié. Le principal défaut n’est pas « le style » : trois couches se contredisent — calculs, primitives de présentation et navigation. L’écran Dashboard affiche pour septembre `4 616 €` de revenus, Analytics `4 401 €`, et le Plan démarre à `0 €` alors que le Dashboard montre `1 521 €`. Une interface financière ne peut pas inspirer confiance si deux cartes censées parler du même mois divergent. C’est le P0 absolu avant toute cosmétique.

Les cinq risques dominants sont :

1. **P0 — vérité financière incohérente.** Les totaux Dashboard utilisent tous les crédits/débits (`useDashboard`, `src/hooks/use-data.ts:133-142`) alors qu’Analytics passe par `buildMonthlyFinancialHistory`; le Plan utilise un solde de départ distinct. Critère : un même fixture donne exactement le même revenu, dépense, net et solde sur Dashboard, Analytics, Transactions et Plan.
2. **P0 — contraste de marque insuffisant.** `#FF6B4A` sur blanc mesure environ **2,82:1** et le muted `#8E8E93` environ **3,26:1** : insuffisant pour le texte normal. Pourtant `Button`, `Tabs`, `Badge`, liens et états actifs l’emploient comme texte/fond. Critère : texte ≥4,5:1, composants/graphismes ≥3:1 dans les deux thèmes.
3. **P1 — navigation flottante non responsive.** `CommandDock` affiche six destinations, More, notifications, thème et compte dans la même rangée fixe (`src/components/layout/command-dock.tsx:252-389,560-586`), sans breakpoint ni safe-area; Catégories est absente. Critère : navigation primaire stable, toutes routes trouvables, 320 px sans collision, cible ≥44 px.
4. **P1 — composants interactifs non sémantiques.** `DataTable` est un assemblage de `div` (`src/components/ui/data-table.tsx:35-79`), les actions de lignes Transactions sont invisibles hors hover (`src/app/transactions/page.tsx:531-558`), et de nombreux boutons icône n’ont pas de nom accessible. Critère : lecture tableau correcte, tri annoncé, actions clavier/tactile visibles.
5. **P1 — dette de design systémique.** 156 hex de production, 38 occurrences de `ResponsiveContainer`, 83 cibles probablement <40 px, 127 usages de `Card`, 106 fichiers client sur 112 TSX et plusieurs milliers de lignes de composants Analytics morts. Critère : tokens sémantiques, bibliothèque de chart unique, composants morts supprimés ou documentés, budgets bundle/interaction suivis.

## 1. Journal des dix passes

| Passe | Travail réalisé | Preuve / résultat | Conclusion |
|---|---|---|---|
| 1 | Inventaire routes, imports directs/barrels, LOC, composants actifs/morts | 14 routes produit, 11 routes lab; pages produit 6 476 LOC; registre §6–§13 | Architecture très client et plusieurs branches UI abandonnées |
| 2 | Shell/navigation/responsive | Test réel Dashboard/Transactions; `AppLayout:14-44`, `CommandDock:252-389,560-586` | Dock surchargé; ancien Header/Sidebar encore présents mais morts |
| 3 | Primitives/tokens clair/sombre | `globals.css`, 156 hex, contrastes calculés, test clair/sombre | Accent et muted échouent; couleurs sémantiques aliasées au coral |
| 4 | Forms/dialogs/tables/menus/toasts | Revue exhaustive `components/ui` | focus dark cassé, tableau non sémantique, dialogs non bornés, toasts en conflit avec dock |
| 5 | Dashboard/Transactions | Chaque composant et interaction, test visuel + AX | chiffres divergents; graphe trompeur; actions hover-only |
| 6 | Analytics/charts/Budgets | Chaque composant, 38 ResponsiveContainer, test Analytics | chart AX vide, couleurs hardcodées, contrôle list/chart cassé |
| 7 | Plan/Goals/Subscriptions/Calendar | Chaque page et composant | écrans monolithiques, Plan hypothèses denses, calendrier inaccessible au clavier |
| 8 | Accounts/Import/Categories/Settings/PWA | Chaque page et composant | suppression parfois native, thème dupliqué, manifest incohérent |
| 9 | Perf/client/a11y/i18n/privacy/errors/states | 106/112 TSX clients; erreurs et états recensés | frontière serveur presque absente, anglais/français mêlés, confidentialité incomplète |
| 10 | Benchmark composant par composant, modèle cible et retest | Sources officielles §15; retest HTTP 200, UI déjà observée; le second navigateur CUA était indisponible | migration proposée en vagues atomiques avec critères mesurables |

### Protocole de test réel

- `http://localhost:3000/` : observé en clair et sombre. Valeurs vues : épargne `-22 %`, dépense/jour `194 €`, projection `5 818 / 6 720 €`, solde `1 521 €`, résumé septembre revenus `4 616 €`, dépenses `5 624 €`, net `-1 009 €`.
- `/analytics` : observé en clair. YTD revenus `25 506 €`, dépenses `25 652 €`, net `-146 €`; septembre `4 401 / 5 624 / -1 223 €`. Les graphiques apparaissent comme conteneurs anonymes dans l’arbre AX.
- `/transactions` : observé en clair. `16 542 €` revenus, `17 715 €` dépenses, net `-1 173 €`, 466 opérations. Les lignes sont essentiellement des conteneurs anonymes et les actions icône n’ont pas de libellé exploitable.
- `/plan` : observé. Solde initial `0 €`, point bas `-1 931 €`, fin `6 062 €`, en contradiction avec le solde Dashboard; hypothèses anglaises et données financières françaises.
- Retest final : serveur toujours joignable (HTTP 200). L’outil navigateur intégré n’exposait plus de surface au second passage; les constats UI ci-dessus proviennent des captures et arbres AX obtenus pendant la passe initiale, et les causes ont été revalidées dans le code.

## 2. Couverture routes et statuts

| Route | Fichier (lignes) | État/charge | Clair/sombre/mobile/desktop | Verdict |
|---|---|---|---|---|
| `/` | `src/app/page.tsx:1-157` | Dashboard, 10 composants, états loading/empty | test clair+sombre; grilles responsive | P0 chiffres incohérents; P1 densité |
| `/transactions` | `src/app/transactions/page.tsx:1-916` | 466 lignes, filtres, tri, bulk, export, édition | clair desktop testé; mobile cassable à ~640 px | P1 refonte table |
| `/analytics` | `src/app/analytics/page.tsx:1-117` | tabs périodes, 5 KPI, 4 modules | clair testé; graphiques sans alternative AX | P1 chart system |
| `/budgets` | `src/app/budgets/page.tsx:1-507` | presets, smart income, overrides, alertes | responsive déclaratif non retesté visuellement | P1 hiérarchie/refonte |
| `/plan` | `src/app/plan/page.tsx:1-360` | scénarios 13 semaines, hypothèses, chart, table | testé; chart minWidth=0 | P0 source de solde; P1 flow |
| `/goals` | `src/app/goals/page.tsx:1-853` | KPI, recherche, tri, tabs, CRUD | page monolithique | P1 simplifier et relier au budget |
| `/goals/[id]` | `src/app/goals/[id]/page.tsx:1-752` | progression, contributions, CRUD | méta shell absente | P1 route dynamique |
| `/subscriptions` | `src/app/subscriptions/page.tsx:1-816` | tabs, cartes, prêts, CRUD, merge | page monolithique | P1 calendrier/transactions liés |
| `/calendar` | `src/app/calendar/page.tsx:1-629` | mois, factures, dialog jour | grille boutons natifs | P1 clavier/mobile |
| `/accounts` | `src/app/accounts/page.tsx:1-546` | KPI, DataTable, CRUD, checkpoints | tableau div | P1 source de vérité solde |
| `/import` | `src/app/import/page.tsx:1-26` + wizard | CSV, mapping, preview, commit | assistant 623 LOC | P1 progressive disclosure |
| `/categories` | `src/app/categories/page.tsx:1-591` | revenus/dépenses, accordéon, CRUD | route non trouvable dans dock/search | P1 découvrabilité |
| `/settings` | `src/app/settings/page.tsx:1-206` | 8 sections | nav locale; beaucoup client | P2 unifier préférences |
| PWA | `layout.tsx`, `manifest.ts`, SW | installation | thème manifest bleu vs UI coral | P1 cohérence marque |

**Routes laboratoire exposées :** `/lab`, `/lab/v1` … `/lab/v10`, via `src/app/lab/**/page.tsx`. Elles sont routables en production, utilisent dix systèmes visuels CSS incompatibles et de nombreux boutons décoratifs. Décision exacte : les déplacer vers Storybook/Chromatic ou les exclure du build public. Acceptation : aucune route `/lab*` dans le manifeste de production et chaque piste conservée comme story versionnée.

## 3. Inventaires techniques obligatoires

### 3.1 Hex et couleurs hors tokens

Recherche reproductible : `rg -n -o '#[0-9A-Fa-f]{3,8}' src/app src/components src/contexts`. Résultat : **156 occurrences production hors lab**, auxquelles s’ajoutent des centaines dans les variantes lab. Familles et emplacements exhaustifs par fichier :

- Coral/gris palette répétée : Accounts `57-61`; Goals list `64-68`; Goal detail `47-51`; `goal-utils:90,114`; ExpenseDonut `20`; CategoryTrends `45-46`; SpendingCalendar `103-107,152,266-270`; BudgetVsActual `56-71,205`; Appearance `155,163`; PaymentHistory `150-152`; SubscriptionCard `287-289`.
- Charts : Plan `308-310`; CashFlow `364,370,375,396,404,417,421`; FinancialHistory `46,118-141,170`; BalanceTimeline `261-412`; DailyHeatmap `137-143,236`; Forecast `286-388`; Trends `214,224-225`; Velocity `99-111`; RecurringExpenses `287`; RecurringAnalysis `82,101,225`; Predictions `209,224`; HealthScore `413`.
- Budget : Alerts `95,99`; Pace `78-98`; BudgetVsActual ci-dessus; CategoryBudget `86`.
- Divers : layout metadata `src/app/layout.tsx:26`; manifest `11-12`; catégories `468,490`; dashboard page `67`; wizard `114,193`; Data management `621`; accent presets `src/contexts/accent-context.tsx:30-35`.

Changement : remplacer par `--color-income`, `--color-expense`, `--color-balance`, `--color-warning`, `--chart-categorical-*`, chacun avec valeurs clair/sombre/contraste augmenté. Interdire les hex dans ESLint hors fichier tokens. Acceptation : recherche ci-dessus = 0 hors tokens, fixtures et lab non livré.

### 3.2 ResponsiveContainer

**38 occurrences** (imports + ouvertures/fermetures) dans 12 fichiers : Plan `7,303,312`; BalanceTimeline `5,336,397`; CategoryTrends `5,188…`; DailyHeatmap; FinancialHistory `72` avec `minWidth={0}`; MonthComparison; RecurringAnalysis; RecurringExpenses; SpendingForecast; SpendingTrends; BudgetVsActual; CashFlowChart. Seuls FinancialHistory et Plan définissent `minWidth={0}`. Changement : `ChartFrame` central avec `min-width:0`, ratio/hauteur par breakpoint, état vide, table alternative, légende et palette. Acceptation : aucune utilisation directe hors `ChartFrame`, aucun warning width/height, resize 320→1440 sans clipping.

### 3.3 Tailles arbitraires, cibles et boutons natifs

- Tailles arbitraires critiques : `h-[320px]` Plan; `min-w-[560px]` FinancialHistory; `h-[280px]` FinancialHistory/Forecast; `h-[300px]` RecurringAnalysis; `h-[200px]` BudgetVsActual/TopMerchants/RecurringExpenses; `w-[120/130/140/160/180px]` filtres et selects; `w-[260/280px]` Sidebar morte; `sm:max-w-[500/550/600px]` dialogs; textes `text-[9px]`/`text-[10px]` dans calendriers, charts, badges et kbd.
- Ombres arbitraires : Dropdown/Select `shadow-[0_8px_30px_-6px_rgba(...)]`; plusieurs cartes/layouts utilisent des variantes voisines. Créer tokens elevation 0–3.
- **83 occurrences probables de tailles <40 px**, notamment `h-8 w-8`, `h-7`, `h-6`, boutons calendrier, catégories et transaction. Standard cible tactile : 44×44; compact desktop autorisé 36×36 uniquement avec densité explicite et alternative tactile.
- Boutons natifs production : Accounts `493`; Calendar `433`; Goals detail `621`; Goals `672`; Plan `257`; Settings `148`; PersonalInsights `352`; RecurringExpenses `230`; SpendingCalendar `184`; BalanceCard `36`; GoalsProgress `30`; CommandDock `263,294,362,381,482,526,572`; Header `393,437`; Appearance `106,118`; SubscriptionCard `300`; CategorySelect `163`; TagInput `69,101`; TransactionEditDialog `255`. Tous doivent soit utiliser `Button`, soit documenter leur rôle, cible, focus et nom accessible.

### 3.4 Frontières client

**106 fichiers client sur 112 TSX.** Les 13 pages produit ont toutes `"use client"`. Les contextes Theme/Accent/Account/Currency/Privacy/Database et les gros hooks data/search résident haut dans l’arbre. Conséquence : hydratation et JS élevés, calculs répétés et détection tardive du thème. Cible : layouts et cadres serveur, îlots clients par interaction, requêtes Dexie derrière stores ciblés, import différé des dialogs/charts. Acceptation : budget JS par route défini, Command palette ne charge pas 2 000 transactions tant qu’elle est fermée, Lighthouse interaction mesuré.

## 4. Design system : tokens et primitives

### Tokens

`globals.css` assimile `primary`, `destructive`, `success`, `warning` et `info` au même coral. Cela rend impossible de distinguer gain, perte, avertissement et action de marque. En clair, `muted-foreground: 142 142 147` est trop faible sur blanc. En sombre, les champs forcent `focus-visible:bg-white` (`Input:24`, `Textarea:11`). AccentContext modifie `primary`, `ring` et `chart-1` depuis un hex arbitraire sans validation (`accent-context.tsx:77-150`).

**Modèle cible :** base neutre; marque séparée des états; valeurs financières sémantiques; 8 couleurs catégorielles testées en daltonisme; focus indépendant de l’accent; mode clair/sombre/contraste augmenté; tabular numerals. Pas de “glass” généralisé : l’opacité sur données denses réduit la lecture. Les tendances durables 2026–2027 sont la personnalisation contrôlée, la densité adaptative, la narration de données, les actions contextuelles et la transparence/confidentialité; les halos, gradients et verre liquide sont des effets de mode à limiter au shell.

### Registre exhaustif des primitives

| Composant; fichier | Props/états et usages | Tokens / comportement | Constat, sévérité, risque | Changement exact + dépendances + acceptation |
|---|---|---|---|---|
| Accordion `ui/accordion.tsx:1-58` | Radix single/multiple; Help | border, muted; responsive natif | PASS structure; P2 focus à vérifier | garder; story clavier, focus visible clair/sombre; axe 0 violation |
| Alert `ui/alert.tsx:1-59` | default/destructive; Plan/Subscriptions/banner | foreground/destructive | P1 : pas success/warning/info réels | variants sémantiques; tokens états; texte+icône, jamais couleur seule |
| Badge `ui/badge.tsx:1-33` | default/secondary/destructive/outline | default `text-primary` | P0 contraste | foreground calculé; test 4,5:1 et snapshot deux thèmes |
| Button `ui/button.tsx:1-59` | 6 variants, 5 tailles | primary coral; 36/40/44/48 | P0 contraste; P1 cibles sm/icon | foreground accessible; icon ≥44 tactile; loading/disabled; WCAG 2.2 |
| Card `ui/card.tsx:1-81` | 6 sous-composants; 127 usages | card/border, hover global | P2 toutes cartes paraissent cliquables | `interactive` explicite; padding responsive; titre non imposé uppercase |
| Checkbox `ui/checkbox.tsx:1-29` | Radix checked | primary/ring | P1 target 16×16 sans wrapper garanti | label cliquable 44 px; mixed annoncé; tests clavier |
| CircularProgress `ui/circular-progress.tsx:1-57` | value/size/stroke | stroke primary | P2 valeur visuelle seule | `role=progressbar`, min/max/now et texte équivalent |
| ClientOnly `ui/client-only.tsx:1-20` | fallback/hydration | aucun | PASS utile charts; P2 multiplication | intégrer au ChartFrame; fallback dimensionné sans layout shift |
| Collapsible `ui/collapsible.tsx:1-12` | Radix | aucun | PASS primitive | trigger doit annoncer expanded; test Budgets/Subscription |
| DataTable `ui/data-table.tsx:1-81` | columns/data/key/onRowClick | grid div, overflow-hidden | P1 sémantique/clavier/mobile | vraie table ou grid ARIA complète; scroll horizontal; tri annoncé |
| Dialog `ui/dialog.tsx:1-118` | Radix open/content/header/footer | overlay, card | P1 pas max-height/scroll/inset mobile | `max-h-dvh`, overflow, safe-area, focus return; 320 px sans coupe |
| DropdownMenu `ui/dropdown-menu.tsx:1-194` | Radix complet | shadow arbitraire | P2 elevation et targets | token elevation; item min 40/44; danger sémantique |
| EmptyState `ui/empty-state.tsx:1-61` | icon/title/description/action | card/primary, PilotOrb | PASS; P2 ton générique | variantes first-use/no-result/error; action explicite |
| ErrorBoundary `ui/error-boundary.tsx:1-135` | class boundary + fallback | Card/Button | P1 **non monté** | monter par segment de route; journal sans données sensibles; recovery test |
| FilterBar `ui/filter-bar.tsx:1-43` | search/actions/children | Input/flex | P1 mobile déborde et filtres non récapitulés | drawer mobile + chips actifs + clear all; état URL persistant |
| InlineError `ui/inline-error.tsx:1-35` | message/retry | destructive | P1 **non utilisé** | standardiser erreurs query/mutation; retry ciblé |
| Input `ui/input.tsx:1-41` | natif | muted/primary; focus blanc | P1 dark focus; erreurs absentes | tokens field; `aria-invalid`, description/error slots; autofill |
| Label `ui/label.tsx:1-26` | Radix | foreground | PASS si htmlFor présent | lint label/control et champs numériques Plan |
| Money `ui/money.tsx:1-37` | amount/currency/digits | useMoney + privacy | PASS direction; P1 adoption incomplète | interdire formatage direct; tabular-nums; signe/locale cohérents |
| Popover `ui/popover.tsx:1-31` | Radix | popover | P2 mobile | collision padding et drawer mobile; focus return |
| PrivacyBlur `ui/privacy-blur.tsx:1-34` | children | blur | P1 utilisé seulement via Money et 2 analytics | couvrir soldes formatés hors Money, labels sensibles, export aperçu |
| Progress `ui/progress.tsx:1-32` | value | primary/muted | P2 sémantique et seuils | progressbar ARIA, seuil texte, couleur non seule |
| RadioGroup `ui/radio-group.tsx:1-40` | Radix | primary/ring | PASS base; P2 target | cartes radio 44 px et description |
| ScrollArea `ui/scroll-area.tsx:1-48` | Radix | scrollbar 10 px | P2 découverte tactile | éviter zones imbriquées; scrollbar toujours détectable |
| Select `ui/select.tsx:1-156` | Radix | popover/shadow arbitraire | P2 longue liste catégories | search/virtualisation pour catégories; token elevation |
| Skeleton `ui/skeleton.tsx:1-15` | class | animate-pulse | P1 pas reduced-motion | `motion-reduce:animate-none`, dimensions proches contenu |
| SkeletonCard `ui/skeleton-card.tsx:1-223` | variants pages | h arbitraires | P2 duplication | skeletons co-localisés aux modules; pas de CLS |
| Slider `ui/slider.tsx:1-28` | Radix | primary | P1 cible/valeur | label, value text, clavier, 44 px thumb hitbox |
| Tabs `ui/tabs.tsx:1-54` | Radix | text-primary actif, gap-6 | P0 contraste; P1 overflow | pill/underline accessible, scroll horizontal, actif non color-only |
| Textarea `ui/textarea.tsx:1-22` | natif | focus blanc | P1 dark focus | même API field que Input; error/help/counter |
| Toast/Toaster `ui/toast.tsx:1-146`, `toaster.tsx:1-39` | variants + queue | viewport bottom, couleurs aliasées | P1 chevauche dock; états indistincts | top-right desktop/above dock mobile, live-region, états vrais, action undo |
| Tooltip `ui/tooltip.tsx:1-27` | Radix | popover | PASS aide; P1 ne pas compenser noms manquants | chaque icon button a aria-label; tooltip secondaire |

## 5. Shell, contextes et hooks transverses

| Élément | Usage/fichier | États/tokens/comportement | Verdict | Action et acceptation |
|---|---|---|---|---|
| AppLayout | toutes routes; `layout/app-layout.tsx:1-46` | pageMeta exact-match; main `pb-32`; CommandDock | P1 route dynamique sans titre, espace dock constant | route registry typée; breadcrumb/title/actions; safe-area mesurée |
| CommandDock | AppLayout, `1-588` | open search/more/account/theme/notifs; fixed bottom | P1 desktop/mobile identiques, 36 px, Catégories absente | nav rail desktop + bottom 4/5 mobile + More; 44 px; toutes routes |
| Header | `layout/header.tsx:1-469` | recherche/privacy/theme/notifs | P2 mort mais duplique dock | extraire capacités utiles puis supprimer fichier |
| Sidebar | `layout/sidebar.tsx:1-398` | nav/account/theme/collapse/mobile | P2 mort, theme state dupliqué | supprimer après migration rail; aucune deuxième source thème |
| DatabaseStatusBanner | `1-76` | DBContext + Alert | P1 mort | monter globalement ou supprimer contexte; offline/error test |
| ThemeContext | `contexts/theme-context.tsx:1-77` | system/light/dark | P1 Appearance écrit DOM/localStorage directement | API unique `setTheme`; aucun flash; system réactif |
| AccentContext | `contexts/accent-context.tsx:1-173` | presets/custom hex | P0 contraste non validé | palettes certifiées + contrôle automatique; refuser couleur non conforme |
| PrivacyContext | `contexts/privacy-context.tsx:1-80` | toggle, Shift+P | P1 commande invisible dans shell actif | bouton dock/menu, annonce d’état, persistance et audit Money |
| AccountContext | `contexts/account-context.tsx:1-137` | comptes/selected/all | P1 mélange compte et household | scope explicite partout; URL/persist; badge “Tous les comptes” |
| CurrencyContext | `contexts/currency-context.tsx:1-91` | devise/locale | P2 import indirect seulement | fusionner contrat Money; multi-currency conversion explicitée |
| DatabaseContext | `contexts/database-context.tsx:1-112` | status/error/retry | P1 consommateur mort | monter banner et télémétrie locale non sensible |
| useCommandSearch | `hooks/use-command-search.ts:1-493` | nav/actions/2000 tx | P1 charge toujours; Categories absente | lazy à l’ouverture, index local, toutes routes, groupe actions |
| useData | `hooks/use-data.ts:1-727` | dashboard/tx/budgets/goals | P0 définitions financières dispersées | selectors domaine uniques, contrats testés par fixture |
| useFinancialMonth | `hooks/use-financial-month.ts:1-217` | dates salaire | P1 app adoption partielle | période financière unique injectée dans toutes vues |
| useMoney | `hooks/use-money.ts:1-151` | format/privacy/scope | PASS base; P1 contournements | lint no Intl/format direct UI; snapshots locales |
| useNotifications | `hooks/use-notifications.ts:1-149` | list/unread | P2 modèle interne | centre notifications actionnable, source et date |
| useToast | `hooks/use-toast.ts:1-195` | queue reducer | P2 API ok, usage irrégulier | mutation feedback standard + undo |

## 6. Dashboard — registre composant par composant

Comparaison de référence commune : Monarch et Copilot séparent clairement flux, soldes et période; IBM exige contexte et cohérence graphique. Chaque acceptation ci-dessous inclut clair/sombre, 320/768/1440 px, clavier et données vide/chargement/erreur.

| Composant | Props/états; tokens; affichage | Constat / sévérité / dette | Changement exact, dépendances, acceptation |
|---|---|---|---|
| WelcomeHeader `dashboard/welcome-header.tsx:1-30` | `userName`; text foreground/muted; actif `/` | P2 “there” générique, peu utile | remplacer par titre période + scope compte + fraîcheur; accepte nom absent |
| QuickStats `1-138` | `accountId`; tx/loading; Card/Money | P0 agrège tous crédits/débits, “Savings” ambigu | consommer `MonthlyFinancialSummary`; mêmes chiffres Analytics/Transactions au centime |
| CashFlowChart `1-428` | `accountId`; range/view/menu/tooltip; 2 ResponsiveContainer; hex | P0 aire dépenses négative empilée avec revenus positifs et domaine symétrique : comparaison visuelle trompeuse; P1 couleurs/AX | chart groupé ou lignes, axe zéro, table alternative, description période; tokens income/expense; chiffres identiques summary |
| BalanceCard `1-52` | balance/change/onAdd; Card/Money; bouton natif | P1 libellé “Balance” sans compte/date; action icon non nommée | afficher scope + “mis à jour”; bouton 44 px nommé; checkpoint lié |
| ExpenseDonut `1-72` | data/total; Pie; palette hex | P1 catégories par nuances coral indiscernables | barres triées prioritairement; donut seulement avec labels/legend/table; palette categorical |
| BudgetControl `1-37` | spent/budget | P1 barre sans contexte période/remaining | montant restant + rythme attendu + statut textuel; lien Budgets |
| UpcomingBills `1-176` | `accountId`; loading/empty | P1 statut prévu/payé non relié visuellement au Calendar | modèle occurrence partagé; date, source, confiance; clic ouvre occurrence |
| GoalsProgress `1-67` | goals/onAddClick; progress; bouton natif “View all” | P2 mélange action add/view; barre color-only | séparer lien liste et CTA add; statut/ETA textuels |
| RecentTransactions `1-103` | transactions/limit | P1 vue non interactive/information limitée | lignes accessibles vers détail, catégorie/scope; même Row primitive |
| MonthlySummary `1-97` | `accountId`; use hook | P0 chiffres divergents Analytics | selector commun, libellé mois financier/calendaire; fixture septembre identique |
| AnomalyDetection `1-71` | transactions | P2 seuil opaque, faux sentiment IA | expliquer règle/baseline, possibilité dismiss, pas de terme “anomaly” sans confiance |
| CategoryBreakdown `1-124` | data chart | P2 **mort** | supprimer ou remplacer ExpenseDonut après décision; zéro import mort |
| IncomeCard `1-154` | sources/trend | P2 **mort** | intégrer dans Analytics si besoin ou supprimer; pas de palette locale |
| InsightsCard `1-114` | insights | P2 **mort** | remplacer par Insight primitive sourcée ou supprimer |
| KpiCard `1-99` | title/value/change/icon | P2 **mort**, duplique SummaryCard et cartes routes | créer `MetricCard` unique puis supprimer |

## 7. Transactions — registre composant par composant

Référence : Copilot Web offre filtres compte/catégorie/date/récurrent/review/tag/type; Dispatch affiche les totaux recalculés du filtre et conserve les splits; Lunch Money propose split/group/tag/rules. Le produit doit atteindre cette cohérence avant d’ajouter de l’IA.

| Élément | Props/états/tokens/comportement | Constat / sévérité | Changement exact + acceptation |
|---|---|---|---|
| Page Transactions `app/transactions/page.tsx:1-916` | 18+ states : recherche, catégorie/type/fréquence, dates, tri, sélection, édition, bulk, recurring; Card/FilterBar/DataTable | P1 monolithe, totaux filtre difficiles à attribuer, largeur grille ~640 px masquée | state URL + toolbar responsive; total “sur N résultats”; virtualisation/pagination; 320 px cards ou scroll explicite |
| Colonnes/lignes inline `page.tsx:420-591` | checkbox, merchant, badges, montant, actions | P1 actions `opacity-0 group-hover` non tactiles/clavier; icônes sans nom | actions visibles au focus/touch, menu unique nommé; row accessible; `focus-within` |
| DataTable `ui/data-table.tsx:35-79` | div grid | P1 lecteur d’écran/tri | table sémantique desktop + list mobile; headers/sort/selection annoncés |
| TransactionRow `transactions/transaction-row.tsx:1-299` | tx/select/edit/delete/category/type; BatchActionBar | P1 partiellement importé seulement pour BatchActionBar : ligne dupliquée dans page | rendre Row canonique ou supprimer la partie morte; une seule implémentation |
| TransactionEditDialog `1-337` | form category/tags/date/notes/excluded | P1 bouton natif et `confirm`; dialog long | validation schéma, autosave explicite, delete via AlertDialog, max-height mobile |
| CategorySelect/Badge `1-187` | categories/search/size/color | P1 trigger natif; couleurs locales | combobox Radix accessible, recherche, catégorie personnalisée, tokens categorical |
| TagInput `1-140` | tags/suggestions | P1 boutons remove/suggestion natifs petits | chips remove nommées 44 px hitbox; combobox keyboard complet |
| BulkWorkbench `1-203` | ids/action/progress/toast | P1 risque action massive sans preview/undo | résumé impact, validation, undo, erreurs partielles par ligne |
| BatchActionBar `transaction-row.tsx:204-299` | count/category/exclude/delete | P1 chevauche CommandDock/Toast | layer manager; safe-area; confirmation destructive détaillée |
| AddEditRecurringDialog via barrel | tx→récurrent | P1 contexte perdu | préremplissage affiché, lien transaction originale, critères de matching |
| Export CSV `page.tsx:641` | filtre courant | P2 portée/confidentialité peu claire | dialog scope + colonnes + avertissement privacy; export testé UTF-8/locale |

## 8. Analytics et graphiques — registre exhaustif

| Composant | Route/props/états/tokens | Problème/PASS, sévérité, risque | Pratique officielle, changement, acceptation |
|---|---|---|---|
| Page Analytics `app/analytics/page.tsx:1-117` | period 1m/3m/6m/1y/ytd; 5 KPI; 4 modules | P0 septembre diffère Dashboard; P1 tabs overflow/contraste | Monarch Cash Flow : filtres et totaux cohérents; selector unique + scope/period chips |
| SummaryCard local `100-117` | label/amount/icon | P2 duplique KpiCard/cartes routes | `MetricCard` avec delta/source/fraîcheur; supprimer local |
| FinancialHistory `analytics/financial-history.tsx:1-211` | history/accounts; area/line/table; minWidth=0; 6 hex | P1 axes 11px, couleurs fixes, table min 560 | IBM : contexte et cohérence; ChartFrame + palette + table scroll/accessible |
| TopMerchants `1-158` | transactions; empty/list/progress | PASS hiérarchie; P2 merchant max width fixe | filtre/scope explicite, contribution %, “Other”; clic filtre transactions |
| RecurringExpenses `1-305` | transactions; `viewMode list|chart` | P1 contrôle cassé : bouton fixe `setViewMode('list')`, aucune branche render | deux tabs réelles ou supprimer toggle; test change DOM et focus |
| SpendingCalendar `1-277` | tx/month/selected day; 5 hex; boutons jours | P1 cellules denses `9/10px`, couleur seule, clavier incomplet | calendar grid ARIA, intensité + montant, légende, touch 44 px |
| BalanceTimeline `1-464` | accounts/tx/range/chart/table | P2 **mort** et complexe, nombreux hex | réévaluer après source de solde; si conservé, selector solde canonique + ChartFrame |
| CategoryTrends `1-258` | categories/range/chart/toggles | P2 **mort**, palette répétée | intégrer dans Analytics via configuration ChartFrame ou supprimer |
| DailyHeatmap `1-260` | daily values/tooltips | P2 **mort**, doublon SpendingCalendar | supprimer au profit du calendrier canonique |
| FinancialHealthScore `1-427` | ratios/sliders/score | P2 **mort**, benchmarks sans provenance, textes 10px | ne pas exposer score normatif; sourcer chaque seuil ou supprimer |
| MonthComparison `1-387` | months/select/pies/bars | P2 **mort**, tailles fixes 140/160 | remplacer par compare mode du ChartFrame, période accessible |
| PersonalInsights `1-365` | insight cards/actions | P2 **mort**, bouton natif, conclusions opaques | InsightCard avec “Pourquoi je vois ceci?”, données/règle, dismiss |
| Predictions `1-233` | forecast/confidence | P2 **mort**, privacy wrapper partiel | ne réactiver qu’avec backtest/confiance et langage probabiliste |
| RecurringAnalysis `1-242` | patterns/chart | P2 **mort**, doublon RecurringExpenses | fusionner logique dans module récurrent unique |
| SavingsPotential `1-271` | suggestions/progress | P2 **mort**, prescriptions peu sourcées | relier à dépenses réelles et action budget, expliquer méthode |
| SpendingForecast `1-402` | forecast/scenario/slider/popover | P2 **mort**, hex et ResponsiveContainer | fusionner avec Plan, scénarios sauvegardés, intervalles confiance |
| SpendingTrends `1-271` | period/chart/stats | P2 **mort**, doublon history | supprimer ou mode “dépenses” du chart canonique |
| SpendingVelocity `1-219` | pace/progress | P2 **mort** mais concept utile | intégrer BudgetPace avec attendu vs réalisé, pas écran isolé |

**Dette morte mesurée :** au moins 11 fichiers Analytics exportés mais non rendus, plus `daily-heatmap` et `recurring-analysis` sans référence. Le barrel `analytics/index.ts:1-16` masque cette dérive. Acceptation : chaque export a au moins un consommateur/story/test, sinon suppression; bundle analyzer prouve l’absence des modules morts.

## 9. Budgets — registre composant par composant

| Composant | Props/états/tokens | Verdict | Changement exact + benchmark + acceptation |
|---|---|---|---|
| Page `app/budgets/page.tsx:1-507` | income, preset, settings collapse, override, type budgets, category budgets | P1 trop de configuration avant décision | YNAB Targets : funded/underfunded clair; afficher “à affecter”, catégories sous-financées, puis détails |
| BudgetVsActual `1-228` | budget/spent by type; bar chart; hex | P1 couleurs fixes et ResponsiveContainer sans minWidth | ChartFrame horizontal, valeur/écart/%, table alternative |
| BudgetPace `1-194` | monthly budget/spent/day | PASS concept; P1 seuils palette locale | attendu à date vs réel, projection, statut textuel; même période financière |
| BudgetAlerts `1-193` | category data/severity | P1 alertes nombreuses sans priorité/action | grouper par criticité, CTA exact “réallouer”, dismiss/snooze |
| CategoryBudgetCard `1-218` | category/budget/spent/edit | P1 input inline dense, badge 10px | row budget canonique, remaining/pace, editing keyboard, 44 px |
| CategoryTypeOverrides `1-240` | category→fixed/needs/wants | P1 jargon interne exposé, select 120px | onboarding et définitions; bulk apply; sauvegarde/undo visibles |
| TransactionTypeButton/Badge `1-229` | tx/category override/dropdown | P1 logique financière cachée dans bouton par transaction | règle de classification expliquée, appliquer merchant/category, audit trail |

## 10. Plan, Goals, Subscriptions, Calendar

| Composant/page | Props/états/tokens/comportement | Constat / sévérité | Changement exact + dépendances + acceptation |
|---|---|---|---|
| Plan page `app/plan/page.tsx:1-360` | 13 semaines, 3 scénarios, income sources, 7 inputs, chart/table/localStorage | P0 solde 0 ≠ Dashboard 1521; P1 toutes hypothèses simultanées, anglais/français | wizard : 1 solde confirmé, 2 revenus, 3 fixes, 4 enveloppes, 5 résultat; source Balance service; chaque chiffre traçable |
| Scénarios `249-269` | optimistic/base/conservative cards/buttons natifs | P1 comparaison sans hypothèses différentielles visibles | tableau delta par hypothèse; radio cards; scénario actif annoncé |
| Plan chart/table `299-352` | line + floor/target hex; vraie table | P1 chart couleur seule; PASS table sémantique | labels lignes, tokens, tooltip clavier, table sticky responsive |
| Goals page `app/goals/page.tsx:1-853` | CRUD, KPI, search/sort/tabs/dialog | P1 énorme monolithe et contribution séparée du cash plan | liste simple + “available to fund”; dialogs extraits; allocations liées comme Monarch Goals 3.0 |
| GoalCard `components/goals/goal-card.tsx:1-240` | health/progress/actions | P1 informations nombreuses et couleurs health | priorité, date, reste, prochain versement; état textuel; carte cliquable correcte |
| GoalUtils `1-147` | health/color/projection | P1 retourne hex et logique UI | retourner statut domaine, mapper token dans vue; tests seuil/date |
| Goal detail `app/goals/[id]/page.tsx:1-752` | contributions/history/edit/delete | P1 route dynamique sans meta shell; bouton contribution natif | breadcrumb et title registry; contribution liée compte/transaction; undo |
| Subscriptions page `app/subscriptions/page.tsx:1-816` | 5 tabs, totals, add/merge/history | P1 très long, chevauche Calendar/recurring analytics | domaine `RecurringItem` unique; liste groupée upcoming/status; liens Calendar/Transactions |
| SubscriptionCard `1-314` | recurring/actions/chart mini | P1 bouton natif, hex, surcharge | Card interactive explicite; next payment/status/source; actions menu 44 px |
| LoanCard `1-197` | principal/payment/progress | P1 hypothèses dette peu explicites | APR/échéance/restant, source, schedule; pas de projection sans taux |
| AddEditDialog `1-674` | type/frequency/category/account/form | P1 674 LOC et ScrollArea fixe 300 | wizard/type-specific fields, schema validation, responsive sheet mobile |
| MergeDialog `1-241` | candidates/selection | P1 conséquence irréversible peu visible | preview avant/après, conservation history, undo |
| PaymentHistoryDialog `1-253` | expected/paid/history | P1 couleurs locales et 60vh | table dates/montants/statuts, liaison tx, export ciblé |
| Calendar page `app/calendar/page.tsx:1-629` | month/date/bills/dialog; 4 KPI | P1 grille bouton native, cellules tactiles, paid detection | ARIA grid keyboard, swipe/month select, agenda mobile, statut non color-only |

## 11. Accounts, Import, Categories, Settings, PWA

| Élément | Props/états/tokens | Constat / sévérité | Changement exact + acceptation |
|---|---|---|---|
| Accounts page `app/accounts/page.tsx:1-546` | accounts/tx/filter/CRUD/checkpoint; palette hex | P0 balance source ambiguë; P1 DataTable div | ledger + “as of” par compte, reconciliation/checkpoint explicite, total household dérivé |
| Delete account `519-546` | Dialog dédié | PASS mieux que confirm; P1 conséquence transactions à détailler | afficher nombre tx/recurring/goals affectés, règle delete safely, typed confirm si nécessaire |
| MigrationWizard `components/import/migration-wizard.tsx:1-623` | files/bank/mapping/preview/quality/import | P1 long, densité et score qualité isolé | étapes persistantes, mapping mémorisé par banque, doublons/anomalies avant commit, rollback |
| Import route `app/import/page.tsx:1-26` | wrapper + privacy note | PASS minimal | ajouter history imports, origine/compte, statut et undo |
| Categories page `app/categories/page.tsx:1-591` | stats/expanded/custom/edit/delete | P1 introuvable depuis dock/search; `confirm`; boutons icon 32 | destination More + search; AlertDialog; classification rule/audit; 44 px |
| Settings shell `app/settings/page.tsx:1-206` | 8 sections, active state | P2 section non reflétée URL, bouton natif mobile | routes/hash deep-linkables, recherche réglages, focus heading |
| Appearance `1-177` | theme/accent controls | P1 contourne ThemeContext; presets non testés contraste | API context unique; preview composants; bloquer palettes invalides |
| Notifications `1-132` | toggles/frequency | P2 préférence locale | indiquer canal/local, exemples, permission seulement à l’action |
| FinancialMonth `1-155` | salary day/month rule | P1 concept important caché | définir globalement, preview dates, re-calcul cohérent toutes pages |
| AccountBalanceSettings `1-347` | balances/checkpoints | P0 format montant direct et confusion import/manual | Money partout, provenance/date, reconciliation flow |
| Currency `1-82` | currency select | P1 multi-compte devise non défini | devise par compte + devise reporting + taux/source/date |
| DataManagement `1-763` | export/import/reset/sample/db tools | P1 écran dangereux massif | section “Backup & restore” séparée, confirmation impact, checksum/rollback |
| About `1-31` | version | PASS; P3 peu utile | build/version/schema + liens privacy |
| Help `1-104` | accordion FAQ | P2 documentation non contextuelle | aides liées écrans, glossaire fixed/needs/wants |
| StressTestControl `1-111` | dev data mutation | P1 **mort** mais dangereux si livré | déplacer dev-only, tree-shake production |
| ServiceWorkerRegistration `pwa/service-worker-registration.tsx:1-17` | register `/sw.js` | P1 aucune UI update/offline | lifecycle prompt, version, fallback offline, erreurs visibles |
| Manifest `app/manifest.ts:1-22` | theme `#0ea5e9`, bg `#0b0f19` | P1 bleu incohérent coral et thèmes | valeurs tokens de marque, screenshots/icons, display testé clair/sombre |

## 12. Accessibilité, responsive, performance, i18n, privacy, erreurs

| ID | Preuve précise | Sev./effort | Risque | Correction et critère d’acceptation |
|---|---|---|---|---|
| X-01 | contraste `#FF6B4A/#fff=2,82`, muted `#8E8E93/#fff=3,26` | P0/M | lecture et conformité | palette certifiée; CI axe + test contraste tokens |
| X-02 | `html lang="en"` `app/layout.tsx`, UI mélange anglais/français, montants fr-FR | P1/M | prononciation/mental model | choisir langue produit, dictionnaire i18n, dates/nombres/ARIA localisés |
| X-03 | aucune occurrence `prefers-reduced-motion`/`motion-reduce` | P1/S | animations inconfortables | règle globale et variants; skeleton/dock/dialog sans mouvement réduit |
| X-04 | icon-only buttons multiples sans aria-label | P1/M | actions anonymes | composant IconButton exige `label`; lint; AX nom unique partout |
| X-05 | 83 tailles <40, nombreux h-8 w-8 | P1/M | erreur tactile | cible 44 px ou hit-area; test Playwright bounding boxes mobile |
| X-06 | charts canvas/SVG sans table/description; AX conteneurs anonymes | P1/L | données inaccessibles | ChartFrame title/desc/table; navigation tooltip clavier |
| X-07 | FilterBar/table grid min ~640 + overflow-hidden | P1/M | coupe mobile | mode liste mobile ou scroll annoncé; 320 px sans contenu inaccessible |
| X-08 | Privacy toggle seulement ancien Header mort; Money pas universel | P1/M | données visibles partage écran | commande active globale; audit formatages; mode privacy couvre exports/previews |
| X-09 | catches logger-only; ErrorBoundary/InlineError morts | P1/M | écran silencieux | error boundary segments + inline retry + toast mutation; offline test |
| X-10 | `useCommandSearch` lit 2 000 tx même fermé | P1/M | démarrage/batterie | lazy/open, worker/index; aucun read tant que fermé |
| X-11 | 106/112 TSX client | P2/L | JS/hydratation | server shells + dynamic imports; budgets par route |
| X-12 | native `confirm` Transactions/Categories/dialog | P1/S | incohérence/non descriptif | AlertDialog standard impact + focus/undo |
| X-13 | Toast `bottom-0 z-100` et dock bottom | P1/S | feedback masqué | layer/safe-area tokens, toast au-dessus dock |
| X-14 | Card hover appliqué à toute Card | P2/S | fausse affordance | prop interactive; carte statique sans hover |

## 13. Matrice composants actifs, morts et dupliqués

| Domaine | Actifs production | Morts/non montés | Duplication à résoudre |
|---|---|---|---|
| Layout | AppLayout, CommandDock | Header, Sidebar, DatabaseStatusBanner | recherche, thème, compte, notifications en triple |
| Dashboard | Welcome, QuickStats, CashFlow, Balance, Donut, BudgetControl, Bills, Goals, Recent, Summary, Anomaly | CategoryBreakdown, IncomeCard, InsightsCard, KpiCard | KPI/card/chart/category |
| Analytics | FinancialHistory, TopMerchants, RecurringExpenses, SpendingCalendar | BalanceTimeline, CategoryTrends, DailyHeatmap, HealthScore, MonthComparison, PersonalInsights, Predictions, RecurringAnalysis, SavingsPotential, Forecast, Trends, Velocity | 9+ charts et 3 prévisions concurrentes |
| Budget | 6 composants via barrel | aucun confirmé | Pace vs Velocity; transaction classification dispersée |
| Transactions | page row inline, Edit, Category, Bulk, Batch, recurring dialog | portion TransactionRow non utilisée, TagInput seulement via dialog | deux lignes transaction |
| Subscriptions | 5 composants via barrel | aucun confirmé | recurring avec Calendar/Analytics/Transactions |
| Settings | 8 sections | StressTestControl | thème/accent et compte/solde |
| UI | 28 primitives actives | ErrorBoundary, InlineError non montés | Metric cards, charts, confirmations manquent |

## 14. Benchmark officiel composant par composant

| Besoin WealthPilot | Référence officielle | Pratique à reprendre | À ne pas copier |
|---|---|---|---|
| Dashboard/flux | [Monarch Cash Flow](https://help.monarch.com/hc/en-us/articles/20504904768020-Cash-Flow) | filtres catégorie/groupe/merchant/compte/tag, mois/trimestre/année, totaux et savings rate | multiplier les visualisations sans question claire |
| Budgets | [YNAB Features](https://www.ynab.com/features), [YNAB Targets](https://support.ynab.com/how-to-use-targets-rk5kkI9ks) | funded/underfunded, progression, move money, objectifs actionnables | jargon YNAB sans onboarding |
| Forecast | [YNAB Future Income](https://support.ynab.com/en_us/assigning-future-income-an-overview-BJsTo0jCq) | séparer argent disponible et revenu futur; scheduled tx | présenter forecast comme solde certain |
| Transactions | [Copilot Web](https://help.copilot.money/en/articles/11780342-copilot-money-for-web) | filtres riches, détails compte/catégorie, recurring attendu | interface uniquement desktop |
| Totaux filtrés/splits | [Copilot Dispatch](https://www.copilot.money/dispatch) | running totals liés au filtre; split conserve original; couleurs catégorie cohérentes | actions IA sans confirmation contextuelle |
| Goals | [Monarch Goals 3.0](https://help.monarch.com/hc/en-us/articles/44373110771860-Introducing-Goals-3-0) | allocations, comptes/transactions liés, migration/history | masquer les effets sur cash disponible |
| Catégories/règles | [Lunch Money Features](https://lunchmoney.app/features) | split/group/tag/rules/recurring/calendar/analytics | complexité exposée dès le premier écran |
| Privacy/local | [Actual Budget](https://actualbudget.org/) | local-first, E2EE, linked transfers, undo/redo, custom reports, dark | revendiquer confidentialité sans expliquer stockage/export |
| Insights IA | [Monarch AI](https://help.monarch.com/hc/en-us/articles/37526856682260-AI-in-Monarch) | expliquer dépenses/net worth, recap hebdo, action contextualisée | score/prescription opaque |
| Graphiques | [IBM Data Visualization](https://www.ibm.com/design/language/data-visualization/overview/), [IBM Technical Diagrams](https://www.ibm.com/design/language/infographics/technical-diagrams/design/) | compréhensible, essentiel, cohérent, contextuel; pas couleur seule; contraste 3:1 | décor et variété au détriment de la comparaison |
| Accessibilité | [WCAG 2.2](https://www.w3.org/TR/wcag/) | contraste, taille de cible, focus visible, noms/roles | viser seulement un score automatisé |
| Clair/sombre | [Apple Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode), [Apple Color](https://developer.apple.com/design/human-interface-guidelines/color) | couleurs adaptatives sémantiques, variantes thème, même sens par couleur | hardcoder des hex ou utiliser une couleur pour plusieurs sens |
| Système | [Atlassian Foundations](https://atlassian.design/foundations) | spacing/grid/color/type/icon/elevation/radius/a11y cohérents | tokens sans gouvernance ni CI |
| Tendances | [WWDC26 Design](https://developer.apple.com/wwdc26/guides/design/) | cohérence, lisibilité, accessibilité, adaptation appareils | “Liquid Glass” sur tableaux et chiffres denses |

## 15. Architecture cible

```text
AppShell
├── RouteRegistry (title, breadcrumb, nav, command search)
├── ResponsiveNavigation
│   ├── DesktopRail
│   └── MobileBottomNav + MoreSheet
├── FinancialScopeBar (household/account, period, freshness, privacy)
└── Route
    ├── PageHeader (title, summary, primary action)
    ├── StateBoundary (loading/empty/error/offline)
    └── Domain modules

Domain
├── Ledger selectors (income, expense, transfer, excluded)
├── Balance service (checkpoint + transactions + asOf)
├── Period service (calendar/financial)
├── Recurring service (expected ↔ matched transaction)
└── Plan service (assumptions versioned + provenance)

Design system
├── semantic tokens (surface/text/border/action/status/finance/chart)
├── Field, IconButton, AlertDialog, MetricCard, InsightCard
├── ResponsiveDataView (table desktop/list mobile)
└── ChartFrame (title/desc/legend/table/empty/loading/error)
```

Règles : tout montant passe par `Money`; tout KPI déclare `scope`, `period`, `source`, `freshness`; tout chart possède une table; toute mutation fournit pending/success/error et undo si possible; toute couleur porte un seul sens; toute page est utilisable à 320 px et au clavier.

## 16. Plan de migration atomique

| Vague | PR atomique | Sev./effort | Dépendances | Critère de sortie |
|---|---|---|---|---|
| 0.1 | fixtures de vérité financière et contrats income/expense/transfer/excluded | P0/M | aucune | mêmes totaux attendus pour 3 jeux de données |
| 0.2 | selectors uniques Dashboard/Analytics/Transactions | P0/L | 0.1 | septembre identique au centime sur 3 routes |
| 0.3 | Balance service + freshness + Plan source | P0/L | 0.1 | Plan commence au solde household affiché |
| 0.4 | tokens contraste/status/finance clair-sombre | P0/M | aucune | WCAG contrast CI; aucun alias status→brand |
| 1.1 | RouteRegistry + Catégories découvrable | P1/S | aucune | chaque route nav/search/meta, dynamic goals incluse |
| 1.2 | ResponsiveNavigation + safe areas/layers | P1/L | 1.1 | 320 px, 44 px, dock/toast/bulk sans collision |
| 1.3 | Field/IconButton/AlertDialog | P1/M | 0.4 | zéro confirm natif, zéro icon button sans nom |
| 1.4 | ResponsiveDataView Transactions/Accounts | P1/L | 1.3 | table AX desktop, cards mobile, tri/selection clavier |
| 1.5 | ChartFrame + palette/table/reduced motion | P1/L | 0.4 | aucune ResponsiveContainer directe; chart AX utile |
| 1.6 | migrer CashFlow/FinancialHistory/Budget/Plan charts | P1/L | 1.5 | axes/totaux/tables cohérents deux thèmes |
| 1.7 | StateBoundary, ErrorBoundary, InlineError, DB banner | P1/M | aucune | loading/empty/offline/error/retry démontrés par route |
| 2.1 | domaine Recurring partagé Subscriptions/Calendar/Analytics | P1/L | 0.1 | une occurrence mène à sa transaction et inversement |
| 2.2 | Plan wizard et hypothèses versionnées | P1/L | 0.3 | chaque résultat explique inputs/source/date |
| 2.3 | Goals allocations liées au cash | P1/L | 0.2 | financer un goal modifie l’available sans double compte |
| 2.4 | Import wizard progressif + rollback | P1/L | 0.1 | mapping, preview, duplicates, commit, undo testés |
| 2.5 | theme/accent/privacy context uniques | P1/M | 0.4 | no flash, accent validé, privacy global |
| 3.1 | découper pages >500 LOC et lazy dialogs/charts/search | P2/L | vagues 1–2 | budget JS et interaction respectés |
| 3.2 | supprimer morts/duplications/barrels opaques | P2/M | migrations | zéro composant sans consumer/story/test |
| 3.3 | sortir `/lab*` de production vers stories | P2/M | design system stable | routes 404 production, variantes documentées |
| 3.4 | i18n cohérent et multi-currency explicite | P1/L | Money/domain | langue, dates, montants, ARIA cohérents |
| 3.5 | PWA update/offline + manifest marque | P1/M | states/theme | installation, offline et update testés |

## 17. Matrice finale de couverture et Definition of Done

| Axe | Routes couvertes | Code couvert | Test demandé avant clôture |
|---|---|---|---|
| Navigation | 14 produit + 11 lab | AppLayout/Dock/Header/Sidebar/search | Playwright 320/768/1440, clavier complet |
| Thème | toutes | globals, Theme, Accent, 28 primitives | clair/sombre/system/contraste augmenté, no flash |
| Données | Dashboard/Tx/Analytics/Budget/Plan/Accounts | useData, Money, balance, monthly analysis | fixtures communes, égalité au centime |
| Charts | Dashboard/Analytics/Budget/Plan | 12 fichiers Recharts | resize, empty, reduced motion, table AX |
| CRUD/forms | Tx/Goals/Recurring/Calendar/Accounts/Categories/Settings | dialogs, fields, toasts | keyboard, validation, pending/error, undo |
| Privacy | toutes vues monétaires/import/export | Privacy/Money/formatters | toggle global, aucune fuite visuelle |
| Performance | toutes | client boundaries/search/charts | bundle par route, no eager 2000 tx, INP suivi |
| PWA | shell | manifest/SW/offline | install/update/offline deux thèmes |

**Definition of Done produit :** aucune divergence de chiffre pour même scope/période; aucune violation axe critique; contraste tokens validé; zéro action uniquement hover; zéro bouton icône sans nom; zéro confirmation native; graphiques accompagnés d’une table; erreurs et états vides testés; navigation complète à 320 px; confidentialité accessible; toutes les routes lab retirées du build public; chaque composant a consumer, story ou justification documentée.

## 18. Ordre de décision recommandé

1. Geler les nouveaux écrans jusqu’à la résolution des vérités financières P0.
2. Choisir une seule langue produit et la définition de période par défaut.
3. Valider la palette sémantique accessible, sans changer encore tous les layouts.
4. Refaire shell, tables et charts sur les primitives cibles.
5. Unifier Recurring, Goals et Plan autour du ledger et du solde canonique.
6. Ensuite seulement appliquer le polish 2026–2027 : densité adaptative, narration, contextual AI, micro-interactions sobres.

Ce séquencement évite une refonte visuelle coûteuse sur des chiffres et des composants qui devront être remplacés.

## Annexe A — registre explicite des frontières client

La recherche `rg -l '^"use client"' src/app src/components src/contexts src/hooks` donne les entrées suivantes. Cette liste est volontairement explicite afin qu’une migration serveur puisse être cochée fichier par fichier.

- **Pages client (13/13 produit) :** `accounts/page.tsx`, `analytics/page.tsx`, `budgets/page.tsx`, `calendar/page.tsx`, `categories/page.tsx`, `goals/page.tsx`, `goals/[id]/page.tsx`, `import/page.tsx`, `page.tsx`, `plan/page.tsx`, `settings/page.tsx`, `subscriptions/page.tsx`, `transactions/page.tsx`.
- **Analytics client :** `balance-timeline`, `category-trends`, `daily-heatmap`, `financial-history`, `month-comparison`, `personal-insights`, `predictions`, `recurring-analysis`, `recurring-expenses`, `savings-potential`, `spending-calendar`, `spending-forecast`, `spending-trends`, `spending-velocity`, `top-merchants`. `financial-health-score` n’a pas la directive en tête mais dépend de primitives/états clients et doit être évalué comme feuille interactive.
- **Dashboard client :** `anomaly-detection`, `balance-card`, `budget-control`, `cash-flow-chart`, `category-breakdown`, `expense-donut`, `goals-progress`, `income-card`, `insights-card`, `kpi-card`, `monthly-summary`, `quick-stats`, `recent-transactions`, `upcoming-bills`, `welcome-header`.
- **Budgets client :** `budget-alerts`, `budget-pace`, `budget-vs-actual`, `category-budget-card`, `category-type-overrides`, `transaction-type-button`.
- **Layout/brand/PWA client :** `pilot-orb`, `app-layout`, `command-dock`, `database-status-banner`, `header`, `sidebar`, `service-worker-registration`.
- **Goals/import client :** `goal-card`, `migration-wizard` (`goal-utils.ts` reste une fonction domaine pure et devrait le rester).
- **Settings client :** `about-settings`, `account-balance-settings`, `appearance-settings`, `currency-settings`, `data-management-settings`, `financial-month-settings`, `help-settings`, `notifications-settings`, `stress-test-control`.
- **Subscriptions client :** `add-edit-dialog`, `loan-card`, `merge-dialog`, `payment-history-dialog`, `subscription-card`.
- **Transactions client :** `bulk-workbench`, `category-select`, `tag-input`, `transaction-edit-dialog`, `transaction-row`.
- **Primitives client :** `accordion`, `button`, `card`, `checkbox`, `circular-progress`, `client-only`, `collapsible`, `data-table`, `dialog`, `dropdown-menu`, `empty-state`, `error-boundary`, `filter-bar`, `inline-error`, `input`, `label`, `money`, `popover`, `privacy-blur`, `progress`, `radio-group`, `scroll-area`, `select`, `skeleton-card`, `slider`, `tabs`, `toast`, `toaster`, `tooltip`. `alert`, `badge`, `skeleton`, `textarea` sont sans directive directe et peuvent rester rendables serveur si leurs dépendances le permettent.
- **Contextes/hooks client :** `accent-context`, `account-context`, `currency-context`, `database-context`, `privacy-context`, `theme-context`; `use-command-search`, `use-data`, `use-financial-month`, `use-money`, `use-notifications`, `use-toast`.

Décision : ne pas retirer mécaniquement `use client`. Commencer par rendre serveur `AppLayout`, PageHeader, cartes de structure et états statiques; injecter ensuite des îlots pour sélecteurs, dialogs et graphiques. Chaque conversion doit vérifier absence d’accès `window`, Dexie ou contexte client et mesurer le delta bundle.

## Annexe B — éléments hors tableaux principaux

| Élément | Preuve | Verdict et action |
|---|---|---|
| PilotOrb | `components/brand/pilot-orb.tsx:1-28`, utilisé par EmptyState | P2 : ornement animé client pour un SVG simple; rendre serveur/statique et respecter reduced-motion |
| Providers barrel | `contexts/index.ts:1-7` | P2 : rend les dépendances implicites; exporter des providers nommés et documenter l’ordre |
| Analytics barrel | `components/analytics/index.ts:1-16` | P2 : exporte de nombreux morts; exports explicites depuis la page après nettoyage |
| Budgets barrel | `components/budgets/index.ts:1-6` | P2 : masque TransactionType dans Transactions; acceptable si API publique testée |
| Subscriptions barrel | `components/subscriptions/index.ts:1-5` | P2 : idem; documenter domaine Recurring ou imports directs |
| `layout.tsx` | metadata, providers, toaster, SW | P1 : `lang="en"`, theme color coral, pile globale client; fixer langue et réduire providers |
| `manifest.ts` | manifest PWA | P1 : couleurs bleu/nuit incompatibles avec app; aligner tokens et screenshots |

## Annexe C — gabarit d’acceptation par composant

Un ticket de migration d’un composant n’est clos que si les cases suivantes sont prouvées :

- route et consommateur identifiés; composant mort supprimé plutôt que “amélioré”;
- props et états loading/empty/error/success/disabled documentés;
- aucun hex, ombre ou taille arbitraire non justifié; tokens clair/sombre vérifiés;
- desktop 1440/1024, tablette 768, mobile 390/320, zoom 200 %;
- ordre Tab, focus visible, Escape/retour focus, nom/rôle/valeur dans l’arbre AX;
- cible tactile 44 px, action disponible sans hover, reduced motion;
- nombres tabulaires, devise/locale/signe, scope compte et période visibles;
- confidentialité active, aucune donnée sensible dans logs/toasts/erreurs;
- comparaison visuelle par story, test interaction, axe et test domaine si calcul;
- aucun changement de total entre composants partageant le même selector.
