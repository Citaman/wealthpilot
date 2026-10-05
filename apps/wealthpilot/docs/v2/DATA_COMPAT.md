# WealthPilot v2 — Compatibilité des données (non négociable)

La base IndexedDB réelle de l'utilisateur et ses sauvegardes JSON doivent rester lisibles et restaurables. Le rebuild ne fait **aucune** migration destructive.

## Dexie
- DB `WealthPilotNext_v1`, `version(1)`, stores **identiques à l'octet** :
  `transactions: "id,batchId,date,account,category,fingerprint"`, `accounts: "id"`, `batches: "id,&hash,createdAt"`, `budgets: "id,month"`, `dues: "id,date,account"`, `preferences: "id"`.
- Ne pas ajouter d'index (cela imposerait version(2)). Les scans complets de `dues`/`budgets` sont acceptables.

## Invariants des enregistrements
- Argent en centimes entiers ; dates métier `YYYY-MM-DD`.
- `Transaction.fingerprint === fingerprint(t)` = `JSON.stringify([account.trim().toLowerCase(), date, amount, normalisedLabel.toLowerCase()])` (formule actuelle de `importer.ts` : la recopier telle quelle). ⇒ account/date/amount/label immuables après import. Champs éditables : `merchantName, category, subcategory, categoryId, subcategoryId, note, internal`.
- `importedState` = snapshot JSON de l'état éditable à l'import (`transactionState`, `categoryId`/`subcategoryId` inclus seulement si définis) : format identique, sert au garde-fou d'annulation de lot.
- `importIdentity` = fingerprint calculé avec `raw.detail` / `raw["Détail de l'écriture"]` à la place du libellé quand présent ; dédoublonnage par **multiplicité** (compteur par identité).
- `Batch.transactionIds` peut référencer des opérations préexistantes (doublons non sélectionnés) : sémantique de partage conservée à l'annulation (réassignation au lieu de suppression). Anciens lots sans `transactionIds` acceptés.
- `Account.checkpoint` (ancre unique legacy) + `checkpoints[]` + `coverage[]` : règles de fusion de `coverage.ts` conservées (checkpoint legacy prioritaire à date égale).
- `Due` estimées : jamais persistées (id `estimate:<key>:<date>`). Une due persistée ajustant une occurrence porte `originOccurrenceId` **unique** (contrôle dans la transaction rw) ; `transactionId` unique parmi les dues.
- `Budget` : tuple (month, category, account) unique. `month` = clé du mois budgétaire `YYYY-MM`.

## Préférences (`preferences`, ligne `id:"main"`)
- Champs requis : `id, safety, essentials, weekly, goal, widgets, budgetView` — toujours présents à l'écriture (fusion avec les valeurs par défaut).
- **Lus et écrits par v2** : `safety`, `budgetOrder`, `weeklyPlans[] {start (lundi), account, limits: Record<catégorie, centimes>, reduction, reserve}`, `dismissedRecurrences[]` (dédoublonner à l'écriture), `ignoredOccurrences[]`, `recurrenceRules[]`, `categoryDefinitions[]`, `categoryRules[]`, et la nouvelle clé **`dashboard`** (v2, voir ci-dessous).
- **Legacy à préserver intacts (jamais supprimés, jamais réécrits par v2)** : `board`, `widgets`, `sizes`, `tones`, `widgetViews`, `budgetLimit`, `budgetView`, `essentials`, `weekly`, `cycleStartDay`, `goal`, `extraGoals`, `householdPlan`, `scenarios`, `dockPages`, `setupDone`, et toute clé inconnue.
- Écriture des préférences = un seul helper `patchPreferences(fn)` (read-modify-put dans une transaction rw) qui ne touche que les clés modifiées.

### Nouvelle clé `dashboard` (v2)
```ts
interface DashboardLayoutV2 {
  version: 2;
  cards: Array<{
    id: string;            // uuid stable de l'instance
    type: CardType;        // 'balance' | 'available' | 'week' | 'envelopes' | 'upcoming' | 'flows' | 'spending' | 'simulate' | 'recent' | 'inbox' | 'accounts'
    width: 3 | 4 | 6 | 8 | 12;
    palette?: CardPaletteId;
    account?: string;      // surcharge de source ; absent = compte du dock
    options?: Record<string, string | number | boolean>; // ex. { forecast: true }
  }>;
}
```
Absente ⇒ disposition par défaut. Validation à la lecture : types inconnus ignorés à l'affichage (mais conservés si on réécrit ? non : v2 réécrit seulement des cartes valides), largeur hors liste ⇒ largeur par défaut du type.

## localStorage (conserver les clés existantes)
- `wealthpilot-account` (`""` = foyer), `wealthpilot-period` (v2 : `month:YYYY-MM` | `30d` | `3m` | `6m` | `12m` | `all` ; lire aussi les anciennes valeurs `current|30d|1|3|4|6|12|all|custom` et les convertir), `wealthpilot-next-month` (legacy, lu pour la conversion), `wealthpilot-ledger-presentation` `{pageSize, density}`.

## Sauvegarde
- Format `{format:"wealthpilot-next", version:1, data: Snapshot}`. `validateBackup` doit accepter **toute sauvegarde valide aujourd'hui** (y compris champs legacy). Les validations de prefs legacy (`board`, `widgetViews`, `tones`…) restent tolérantes : en v2, une valeur legacy malformée ne bloque pas la restauration (elle est conservée telle quelle si c'est un objet JSON).
- La restauration remplace toutes les tables dans une transaction rw, après téléchargement d'une sauvegarde de sécurité.

## Défauts connus à corriger dans v2
1. Concurrence des occurrences ajustées (`originOccurrenceId` non unique) — test rouge `component-contracts.test.tsx:386`.
2. Garde-fou d'annulation de lot trop strict : ne bloquer que si une opération **réellement supprimée** a été modifiée.
3. Annulation : mettre à jour `count/minDate/maxDate` des lots auxquels on réassigne.
4. Jeton de fraîcheur d'aperçu d'import = multiset d'`importIdentity` + comptes, pas `JSON.stringify` de toute la base.
5. Éditeur de solde manuel : dédoublonner les checkpoints.
6. `uncategorized` ne doit pas traiter « Autre »/« Autres » comme non classé (seul « À catégoriser »/vide).
7. `useSnapshot` : un `useLiveQuery` par table + prefs séparées, sans `JSON.stringify` de signature.
8. Le décodage CSV se fait dans le worker (transfert de l'ArrayBuffer).
