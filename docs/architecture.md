# Architecture

React 19 + TypeScript strict + Vite. Dexie (IndexedDB). CSS simple avec tokens. Graphiques en SVG maison.

```
src/
  main.tsx       entrée ; ?demo charge src/dev/demo.ts
  app/           shell : routeur (hash), dock, contexte compte/période, toasts
  domain/        calculs purs : périodes, soldes, prévision, enveloppes, semaine, plan…
  data/          Dexie, lectures réactives, commandes (écritures), import CSV, sauvegarde
  ui/            primitives, graphiques, moteur de réordonnancement
  features/      un dossier par page + shared/ (CategoryLabel, Logo, menus, testeur d'achat)
scripts/         sync-brands.mjs (logos), e2e.mjs (parcours navigateur)
fixtures/        CSV d'exemple
references/      images de référence
```

## Règles

1. **Pas de calcul dans les composants.** Tout chiffre vient d'un sélecteur de `domain/` (mémoïsé par `Ledger`, appelable au rendu).
2. **Pas d'écriture directe.** Les composants appellent `data/commands.ts` ; chaque commande s'exécute dans une transaction et renvoie un `Undo` affiché dans le toast.
3. **Le `Ledger`** (`domain/ledger.ts`) regroupe les tables et dérive ce qui n’est jamais stocké : sous-catégories manquantes (`domain/subcategories.ts`) et calendrier des mois budgétaires. Les noms affichés viennent de `domain/labels.ts`.
4. **Couches :** `ui` n'importe pas `features` ; `domain` n'importe ni React ni Dexie.
5. **Code maigre :** `noUnusedLocals` est actif ; pas de commentaire qui paraphrase, pas d'option spéculative.

API détaillées : `src/domain/README.md`, `src/data/README.md`, `src/ui/README.md`.

## Tests

- `vitest` : invariants financiers et de données uniquement (≈ 27 cas).
- `scripts/e2e.mjs` : tout le comportement de l'interface, avec de vrais clics, dans Chromium, aux largeurs 390 / 1512 / 2560.
