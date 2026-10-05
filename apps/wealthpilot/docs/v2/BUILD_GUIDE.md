# WealthPilot v2 — Guide des builders d'écrans

Lis dans cet ordre : `docs/v2/INTERACTIONS.md` (ton écran = ta spec, exhaustive), `docs/v2/DESIGN_SYSTEM.md`, `src/ui/README.md`, `src/domain/README.md`, `src/data/README.md`, puis `src/app/*` (shell déjà écrit). Référence visuelle approuvée : `docs/assets/passation-2026-10-05/four-components.png`. Captures du kit : `../../tmp/v2-kit/*.png` (à cette hauteur de qualité). Captures de l'ancienne version rejetée : `docs/assets/passation-2026-10-05/{dashboard,week,transactions,import-empty}.png` (ce qu'il ne faut PAS refaire).

## Propriété des fichiers (ne modifie que les tiens)
| Builder | Fichiers |
|---|---|
| Board | `src/features/dashboard/DashboardPage.tsx`, `Board.tsx`, `catalog.ts`, `layout.ts`, `AddCardSheet.tsx`, `*.css` du dossier, cartes `BalanceCard`, `AvailableCard`, `FlowsCard` |
| Cards | cartes `EnvelopesCard`, `UpcomingCard`, `SpendingCard`, `RecentCard`, `InboxCard`, `AccountsCard` (+ leurs css), `src/features/shared/OccurrenceMenu.tsx` |
| Week | `src/features/week/*`, `src/features/shared/PurchaseTester.tsx`, cartes `WeekCard`, `SimulateCard` |
| Transactions | `src/features/transactions/*`, `src/features/shared/CategoryMenu.tsx` |
| Import | `src/features/import/*` |

Fichiers partagés en lecture seule : `src/app/*`, `src/ui/*`, `src/domain/*`, `src/data/*`, `src/features/dashboard/cards/types.ts`. Si un manque bloque vraiment (bug, fonction absente), contourne localement dans tes fichiers et **signale-le dans ton rapport final** (fichier, ligne, correctif proposé) ; n'édite pas le fichier d'un autre.
Les composants partagés (`CategoryMenu`, `OccurrenceMenu`, `PurchaseTester`) existent en stub avec leurs props figées : utilise-les dès maintenant, ils deviendront réels. Ne change pas leurs props.

## Contrats du shell
- Page : `export function XPage({ ledger, params, active }: PageProps)` (`src/app/App.tsx`). Le `<h1>` masqué est déjà rendu par le shell. Les pages restent montées une fois visitées : conserve brouillons/états dans la page.
- Commandes du dock : `<DockActions>…</DockActions>` (`src/app/DockSlot.tsx`), rendues seulement pour la page active. Contrôles partagés : `SharedAccountPicker`, `PeriodPicker`, `AccountPicker` (`src/app/ContextControls.tsx`). Utilise `Button`/`Picker` avec `variant="dock"` ou `variant="ghost"` adaptés au fond sombre.
- Contexte : `useReading()` → `{ asOf, account, setAccount, period, setPeriod, range }` (Dashboard + Transactions partagent compte et période).
- Toasts : `useToast()` → `undoable(message, undo)`, `show`, `error`. Toute commande renvoie un `Undo` : `toast.undoable("Catégorie changée", await updateTransactions(...))`. Les erreurs (`ConflictError`…) → `toast.error(e)`.
- Navigation : `navigate(page, params)` / `hrefFor(page, params)` (`src/app/router.ts`). Paramètres de drilldown vers Transactions : `cat` (catégorie), `from`, `to` (dates ISO), `acct` (compte, `household` pour foyer), `q` (recherche), `tx` (id d'opération à ouvrir), `batch` (lot d'import), `filter=uncategorized`. Vers Import : `acct` (compte présélectionné). Vers Ma semaine : `week` (lundi ISO), `acct`.

## Règles de code
- TypeScript strict, React 19, CSS co-localisé, **tokens uniquement** (aucune couleur/taille en dur), pas de nouvelle dépendance.
- Petits composants, pas d'options spéculatives, pas de commentaires qui paraphrasent, pas de code mort, pas de `any`.
- Aucun calcul financier dans les composants : uniquement les sélecteurs du domaine (`memo` : appelables en rendu).
- Textes français courts (DESIGN_SYSTEM §8) : pas de phrases explicatives permanentes, pas de slogans ; explications dans « Voir le calcul » ou `title`.
- Accessibilité : tout contrôle au clavier, focus visible, `aria-*` corrects, cibles ≥ 32px, aucune info portée par la seule couleur.
- Aucun scroll vertical interne dans les cartes. Aucune hauteur fixe de carte.

## Vérification obligatoire (navigateur réel)
- Lance ton propre serveur : `npx vite --host 127.0.0.1 --port <TON_PORT> --strictPort` (en arrière-plan) — ports : Board 5231, Cards 5232, Week 5233, Transactions 5234, Import 5235. Ne touche jamais au port 5173 (base réelle de l'utilisateur). Tue ton serveur à la fin.
- Données fictives : ouvre `http://127.0.0.1:<port>/?demo#/…` dans un contexte Playwright neuf (base vide → foyer fictif Commun/Alex/Sam chargé, cf. `src/dev/demo.ts`). Pour l'état vide : sans `?demo`.
- Playwright : `/Users/anthonny.olime/Personal_Repos/Perso/Account/wealthpilot/node_modules/playwright/index.mjs` (Chromium installé). Scripts dans **ton** sous-dossier du scratchpad (`…/scratchpad/<builder>/`), jamais dans le repo.
- Captures à 390, 1024, 1512 et 2560 px ; **lis-les** (outil Read) et itère jusqu'à ce que ce soit réellement beau, dense, lisible, cohérent avec la référence Rime. Exerce chaque interaction de ta spec avec de vrais événements (clic, clavier, pointeur) et vérifie l'effet (DOM + base). Aucune erreur console.
- Garde 3–6 captures finales dans `/Users/anthonny.olime/Personal_Repos/Perso/Account/wealthpilot/tmp/v2-<builder>/`.
- `npx tsc --noEmit` : zéro erreur dans tes fichiers. Quelques tests vitest ciblés (`*.test.tsx`) pour les interactions critiques de ton écran seulement.
- Ne commite pas.

## Rapport final attendu
Fichiers + lignes ; ce qui est livré vs INTERACTIONS.md (liste cochée honnête, y compris ce qui manque) ; interactions vérifiées en vrai ; captures ; problèmes trouvés dans les fichiers partagés (avec correctif proposé) ; limites.
