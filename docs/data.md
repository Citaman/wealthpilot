# Données et compatibilité

La base réelle de l'utilisateur et ses sauvegardes JSON doivent toujours se relire. Aucune migration destructive.

## Base

- IndexedDB `WealthPilotNext_v1`, Dexie `version(1)`, schéma figé dans `src/data/db.ts`. Ajouter un index imposerait `version(2)`.
- Argent en centimes entiers. Dates métier `YYYY-MM-DD`, sans fuseau.

## Formats figés

- `fingerprint` d'une opération (compte, date, montant, libellé) : compte, date, montant et libellé ne changent jamais après import. Champs modifiables : `merchantName, category, subcategory, categoryId, subcategoryId, note, internal`.
- `importIdentity` (détail bancaire brut, avec multiplicité) pour les doublons.
- `importedState` : garde-fou de l'annulation d'un lot.
- Clé de récurrence `JSON.stringify([compte, identité, signe])`, ids `estimate:<clé>:<date>`.
- Sauvegarde `{format: "wealthpilot-next", version: 1, data}`. Toute sauvegarde ancienne doit se restaurer ; les clés de préférences inconnues ou anciennes sont conservées telles quelles.

## Préférences (`preferences`, ligne `main`)

- Utilisées : `safety`, `budgetOrder`, `weeklyPlans`, `ignoredOccurrences`, `dismissedRecurrences`, `recurrenceRules`, `categoryDefinitions`, `categoryRules`, `accountAliases`, `dashboard` (disposition), `plan` (Notre plan).
- Anciennes, conservées sans être lues : `board`, `widgets`, `sizes`, `tones`, `goal`, `extraGoals`, `cycleStartDay`, etc. L'épargne des anciens objectifs reste comptée comme réservée.

## localStorage

`wealthpilot-account`, `wealthpilot-period`, `wealthpilot-ledger-presentation`, `wealthpilot-recent-categories`.

## Dérivé, jamais écrit

Sous-catégorie manquante et nom affiché sont calculés dans le `Ledger` ; le stockage reste intact.
