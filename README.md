# WealthPilot

Budget du foyer, en local. On importe ses relevés CSV ; l'app répond à trois questions : combien reste-t-il cette semaine, qui doit quoi à qui, et quand repasse-t-on au-dessus de zéro.

Aucune donnée ne quitte le navigateur (IndexedDB). Pas de serveur, pas de compte.

## Démarrer

```bash
npm ci
npm run dev        # http://127.0.0.1:5173
```

- `?demo` dans l'URL charge un foyer fictif dans une base vide (dev uniquement).
- Node 22+.

## Vérifier

```bash
npm test                                   # 27 tests : argent, données, calendrier
npx vite --port 5250 --strictPort &        # puis :
npm run e2e                                # parcours complet dans Chromium (≈ 120 contrôles)
npm run build
```

## Pages

| Page | Rôle |
|---|---|
| Dashboard | Cartes réordonnables : solde, disponible, enveloppes, à venir, dépenses, à traiter, comptes… |
| Ma semaine | Combien encore d'ici dimanche, jour par jour, par enveloppe, test d'achat |
| Notre plan | Sortie du rouge mois par mois, partage des charges selon les revenus, limites hebdo par personne |
| Transactions | Recherche, filtres (catégorie › sous-catégorie), édition en ligne, export |
| Import CSV | Import avec aperçu et annulation, sauvegarde / restauration |

## Documentation

- [docs/architecture.md](docs/architecture.md) — structure du code et règles
- [docs/data.md](docs/data.md) — base de données et compatibilité (à lire avant toute écriture)
- [docs/design.md](docs/design.md) — système visuel
- [docs/product.md](docs/product.md) — règles métier
- `references/` — direction visuelle approuvée et inspirations
