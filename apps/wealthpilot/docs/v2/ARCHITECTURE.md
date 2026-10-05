# WealthPilot v2 — Architecture

Contrats liés : [INTERACTIONS.md](INTERACTIONS.md) (produit), [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) (visuel), [DATA_COMPAT.md](DATA_COMPAT.md) (données).

## Principes
1. **Pur d'abord.** Tout calcul financier vit dans `src/domain/` : fonctions pures, sans React, sans Dexie, sans `Date.now()` implicite (`asOf` toujours passé). Testées unitairement.
2. **Une seule source de calcul par notion.** Les cartes, Ma semaine et Transactions consomment les mêmes sélecteurs. Aucune formule dans un composant.
3. **Écritures centralisées.** Toute mutation passe par `src/data/commands.ts` (transactions Dexie rw, contrôles d'unicité/concurrence, retour d'un `undo()`). Les composants n'appellent jamais `db.*` directement.
4. **Lecture réactive ciblée.** `useLiveQuery` par table ; préférences séparées en *financières* et *présentation* pour que bouger une carte ne recalcule aucune finance.
5. **UI from scratch.** `src/ui/` (primitives + graphes) n'importe rien de `features/`. `features/*` n'importe pas d'une autre feature sauf via `src/ui` ou `src/domain` (exception : `features/shared` pour le simulateur d'achat et le menu de catégorie).
6. **Petit.** Pas de dépendance pour ce qui tient en 100 lignes. Pas de registre générique de « représentations ». Pas de options mortes. Pas de commentaires paraphrasant le code ; un commentaire = une raison métier non évidente.
7. **Aucune copie explicative permanente** dans l'UI (voir DESIGN_SYSTEM §8).

## Arborescence cible
```
src/
  main.tsx                 // fonts, tokens, <App/>
  app/
    App.tsx                // routes, pages montées, contexte, first-run
    router.ts              // hash ⇄ {page, params}, redirections legacy
    context.tsx            // AppContext: account, period, asOf, setters (persistés)
    Dock.tsx               // nav + slot de commandes (portail)
    DockSlot.tsx           // <DockActions> portail pour les pages
    toast.tsx              // ToastProvider, useToast() avec action Annuler
  data/
    db.ts                  // Dexie (schéma v1 inchangé)
    hooks.ts               // useTransactions, useAccounts, useBudgets, useDues, useBatches, usePrefs, useLedger() → Ledger
    commands.ts            // toutes les écritures (voir plus bas)
    backup.ts              // export, validate, restore
    importer/              // parse.ts, mapping.ts, preview.ts, commit.ts, worker.ts
  domain/
    types.ts               // types persistés (compatibles) + types dérivés
    money.ts               // format, parse, sum
    dates.ts               // ISO helpers sans fuseau (addDays, weekStart, diffDays, labels fr)
    periods.ts             // calendrier des mois budgétaires (revenus)
    balances.ts            // checkpoints, balanceAt, série quotidienne ancrée, couverture
    recurring.ts           // détection, occurrences estimées, règles/ignorés
    forecast.ts            // projection par compte/jour, point bas, bandes
    budget.ts              // enveloppes (alloué/payé/engagé/libre), disponible du mois
    week.ts                // plan hebdo, frise 7 jours
    simulate.ts            // test d'achat
    spending.ts            // catégories, flux mensuels, habitudes, inhabituel
    inbox.ts               // file « À traiter »
    categories.ts          // catalogue, règles, couleurs stables
    search.ts              // recherche floue
    merchants.ts           // logos locaux
    ledger.ts              // Ledger = vue indexée (par compte, par date) + cache memo
  ui/
    tokens.css, base.css   // tokens, reset, typo, focus
    *.tsx                  // primitives (voir liste)
    charts/                // scales.ts + composants SVG
    sortable.ts            // moteur de réordonnancement pointeur+clavier+FLIP
  features/
    dashboard/  Board.tsx, cards/*.tsx, catalog.ts (types, largeurs, défauts), layout.ts (lecture/validation `dashboard` v2)
    week/       WeekPage.tsx + composants
    transactions/ TransactionsPage.tsx + Toolbar, Table, Row, RowDetail, Pagination, SelectionBar
    import/     ImportPage.tsx + Dropzone, AccountDialog, Mapping, Preview, Batches, Backup
    shared/     PurchaseTester.tsx, CategoryMenu.tsx, DueMenu.tsx
```

## Le `Ledger` (lecture mémorisée)
`useLedger()` compose les tables en un objet stable `Ledger` (même référence tant qu'aucune table financière ne change) :
```ts
interface Ledger {
  transactions: Transaction[]; accounts: Account[]; budgets: Budget[]; dues: Due[]; batches: Batch[];
  prefs: FinancePrefs;              // safety, budgetOrder, weeklyPlans, recurrenceRules, ignoredOccurrences, dismissedRecurrences, categoryDefinitions, categoryRules
  byAccount: Map<string, Transaction[]>;   // triées par date
  calendar: BudgetCalendar;          // calculé une fois par (transactions, asOf)
}
```
Les sélecteurs prennent `(ledger, scope)` où `scope = { account: string /* "" = foyer */, range: DateRange, asOf: string }`, et sont mémorisés par `useMemo` sur `(ledger, scope)` dans un hook `useSelector(fn, ...args)` ou par un petit cache WeakMap(ledger) → Map(clé de scope).

## API domaine (contrat consommé par l'UI)
Signatures indicatives — l'implémentation peut ajuster les noms, pas la sémantique.
```ts
// périodes
budgetCalendar(tx, asOf): BudgetCalendar
monthOf(date, calendar): string                      // clé YYYY-MM du mois budgétaire
monthRange(key, calendar): DateRange & { partial?: boolean; estimatedEnd?: boolean }
periodOptions(calendar, asOf): PeriodOption[]        // pour le menu du dock
resolvePeriod(value: PeriodValue, calendar, asOf): DateRange & { label: string }

// soldes
balanceAt(account, tx, date): number | null
balanceSeries(ledger, scope, { granularity?: 'auto'|'day'|'week'|'month' }): { points: {date, value|null, observed?: boolean, gap?: boolean}[]; perAccount; events: ChartEvent[] }
accountStatus(ledger, asOf): AccountStatus[]          // solde, dernier checkpoint, couverture, fraîcheur, dernier import

// prévision
forecast(ledger, scope, horizonEnd): { points: {date, value, low, high}[]; events: Occurrence[]; lowPoint: {date, value, account?} | null; shortfalls: Shortfall[] }
upcoming(ledger, scope, until): Occurrence[]          // réelles futures + dues + estimées, dédoublonnées, triées
nextIncome(ledger, scope): Occurrence | null

// budget
envelopes(ledger, scope, monthKey): Envelope[]        // {category, allocated, paid, committed, free, over, budgetId}
available(ledger, scope): AvailableBreakdown          // {cash, upcomingCharges, envelopesFree, safety, free, until, expectedIncome[], unknownBalance?: boolean, sharedReserveNote?: boolean}

// semaine
weekPlan(ledger, account, weekStart, asOf): WeekPlan  // {days[7]: {date, spent, charges[], incomes[], endBalance}, envelopes: {category, limit, proposed, paid, committed, possible}[], totals, lowPoint, assumptions}

// simulation
simulatePurchase(ledger, { amount, category, date, account }, asOf): Simulation  // {inEnvelope, envelopeBefore/After, freeBefore/After, lowBefore/After, verdict: 'ok'|'outside'|'risk', riskDate?}

// analyses
monthlyFlows(ledger, scope, count): { month, income, spending, net, complete }[]
spendingByCategory(ledger, scope): { category, amount, share, usual: number|null, deltaPct: number|null }[]
inbox(ledger, scope): InboxItem[]                    // non classées, récurrences à confirmer, soldes anciens, futures importées

// transactions
filterTransactions(ledger, filters): Transaction[]   // compte, période, type, catégories, montant, recherche, tri
summarize(rows): { count, income, spending, net }
```

## Commandes (src/data/commands.ts)
Toutes retournent `Promise<Undo | void>` où `Undo = () => Promise<void>`.
```ts
patchPreferences(fn)                                  // read-modify-put, ne touche que les clés produites
updateTransactions(ids, patch)                        // champs éditables uniquement → Undo
setBudget({month, category, account?}, amount|null)   // crée/maj/supprime → Undo
reorderEnvelopes(order: string[])
saveDue(due) / deleteDue(id)                          // unicité originOccurrenceId + transactionId dans la tx
ignoreOccurrence(id) / confirmRecurrence(key) / stopRecurrence(key) / adjustOccurrence(occ, amount)
setCheckpoint(accountId, {date, amount})              // checkpoint observé manuel, dédoublonné
renameAccount(accountId, alias)                       // alias d'affichage dans prefs.accountAliases (nouvelle clé)
saveWeekLimit(account, weekStart, category, cents|null)
setSafety(cents)
saveDashboard(layout: DashboardLayoutV2)
commitImport(...) / undoImport(batchId)
restoreBackup(snapshot)
```

## Primitives UI (src/ui)
`Button` (variants: primary | accent | outline | ghost | danger ; size: s | m), `IconButton`, `Segmented`, `Picker` (Radix Select stylé, `side` configurable), `Menu` (Radix DropdownMenu), `Popover` (Radix Popover), `Dialog` (Radix Dialog), `Sheet` (Dialog latéral), `Toast` (via app/toast), `Money` (format + signe + couleur), `EditableMoney` / `EditableText` (édition inline), `Disclosure`, `Badge`, `Skeleton`, `Empty`, `CardShell` (titre, actions, palette, container query), `ErrorBoundary`, `CategoryDot`, `MerchantLogo`, `ProgressBar` (payé/engagé/reste), `DateChip`, `VisuallyHidden`, `Field` (input avec label/erreur).
Graphes : `scales.ts` (linear, time, niceTicks), `LineChart` (séries, prévision, bande, seuil, annotations anti-collision, réticule clavier/pointeur), `DivergingBars`, `RankedBars`, `ConcentricRings`, `SegmentBar`, `Sparkline`, `DayStrip`, `Waterfall`.
`sortable.ts` : `useSortable({ ids, onCommit, axis: 'grid'|'y', getLabel })` → props pour items et poignées, gère pointeur (avec auto-scroll rAF + scroll listener), clavier, annonces live, FLIP, Échap.

## Dépendances
- Garder : react, react-dom, dexie, dexie-react-hooks, papaparse, lucide-react, @radix-ui/react-dialog, @radix-ui/react-select, @fontsource/barlow-condensed, @fontsource/dm-sans.
- Ajouter : @radix-ui/react-dropdown-menu, @radix-ui/react-popover, @fontsource/ibm-plex-mono.
- Retirer : react-grid-layout, simple-icons (15 Mo de SVG générés ; on garde le catalogue local `merchant-assets`) — sous réserve de la reprise des logos utiles dans `merchant-assets`.

## Tests
- `src/domain/*.test.ts` : invariants financiers (repris des tests existants qui protègent un invariant réel), cas chiffrés du brief (fixture semaine 5–11 oct., scène 12–18 oct.).
- `src/data/*.test.ts` : import (SG, générique, doublons multiplicité, réimport idempotent, annulation), sauvegarde/restauration (anciennes sauvegardes acceptées), concurrence des occurrences.
- `src/features/**/*.test.tsx` : peu, ciblés sur les interactions critiques (édition inline + Annuler, pagination, organiser).
- `scripts/e2e.mjs` : parcours Playwright sur données fictives (4 pages, 390/1024/1512/2560 px).

## Décisions de calcul (issues de l'audit domaine du 5 oct.)
1. **Réserves de projets** : les montants `saved` des objectifs retirés (`goal`, `extraGoals`) restent réservés (brief §25 : le retrait visuel ne libère pas l'argent). Ils apparaissent comme une ligne visible « Réservé aux projets » dans le calcul du disponible et de la semaine, uniquement si > 0. Jamais une soustraction invisible.
2. **Une seule définition des réserves** : `safety + projets` (le champ legacy `essentials` est ignoré : les enveloppes restantes sont déjà une ligne du calcul). Sous filtre compte : réserves du foyer non réparties → `sharedReserveNote`, pas de chiffre inventé.
3. **Une seule implémentation** de payé/engagé/libre par enveloppe (`envelopes.ts`), utilisée par disponible, prévision, semaine et simulation.
4. **Échéances échues non rapprochées** : incluses dans la projection au jour `asOf` (statut « à vérifier »), donc cohérentes entre point bas, graphe et disponible.
5. **Le disponible du mois** utilise les enveloppes du mois budgétaire courant et les obligations jusqu'à la fin de ce mois (pas du mois sélectionné dans le dock). Il est indépendant de la période du dock.
6. **Prévision sans prochain revenu identifié** : horizon = fin du mois budgétaire courant estimée (cadence) ou 35 jours, jamais étiré jusqu'à la plus lointaine échéance.
7. **Un seul `forecast` par (ledger, compte, asOf)** mémorisé ; `weekPlan` et `simulatePurchase` le réutilisent (pas 7 recalculs par frappe). `detectRecurrences` mémorisé par (transactions, asOf).
8. **Formats figés** : clé de récurrence `JSON.stringify([account, identity, sign])`, ids `estimate:<key>:<date>`, `normalizedText` (sans suppression d'apostrophe) pour l'identité ; la recherche garde sa propre normalisation (avec suppression d'apostrophe).
9. **Médianes** : `money.median` (moyenne des deux valeurs centrales) pour les montants ; là où l'ancienne détection de périodes/récurrences utilisait la valeur centrale supérieure, conserver ce comportement (fonction locale nommée `upperMedian`) pour ne pas déplacer les frontières de mois existantes.
10. **Non classé** = catégorie vide ou « À catégoriser » (insensible à la casse/accents) ; « Autre(s) » est une vraie catégorie.
