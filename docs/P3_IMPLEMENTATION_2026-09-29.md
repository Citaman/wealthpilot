# Lot P3 — implémentation et vérification

Date : 29 septembre 2026

## Terminé

- PWA installable : manifest, icônes PNG/SVG, mode standalone, raccourcis, cache versionné et écran Réglages → Installation.
- Deep link `goals?new=1` ouvrant directement la création d’un objectif.
- Barre d’actions groupées mobile, française et sans ancien composant TransactionRow mort.
- Messages des récurrences localisés et temporisation nettoyée au démontage.
- Suppression de l’ouverture IndexedDB implicite, des compteurs de données en console et de l’initialisation concurrente dans AccountProvider.
- Fichiers CSV libérés de la mémoire dès la fin de l’import ; l’annulation ne conserve plus que les identifiants créés.
- Taux de change hors ligne par défaut ; accès externe uniquement après action explicite.
- Classification hybride explicable : règles, apprentissage local dominant, modèle local optionnel, seuil de confiance et file de revue.
- Corrections manuelles réutilisées avec une pondération supérieure lors des imports suivants.
- Service MLX limité à loopback, CORS local, mode Hugging Face hors ligne, concurrence 1 et température 0.

## Validation

- ESLint : 0 avertissement.
- TypeScript : 0 erreur.
- Vitest : 23 fichiers, 94 tests réussis.
- Build Next.js production réussi.
- `git diff --check` réussi.
- Manifest et icônes servis en production.
- `/`, `/import`, `/settings?section=installation` et `/goals?new=1` : HTTP 200.
- `/lab` : HTTP 404 en production.
- Inférence MLX réelle : MONOPRIX → `Food / Groceries`, confiance 0,95.

## Limite documentée

Le modèle `rapid-mlx/Ling-3.0-tiny-MLX-4bit` est présent dans le cache local mais échoue avec `mlx-lm 0.32.0` : les poids quantifiés `kv_b_proj` de Bailing V3 ne sont pas pris en charge. L’intégration n’est pas couplée au modèle ; Granite 4.2 8B MLX, déjà local, est la solution opérationnelle actuelle. Ling peut être sélectionné via `WEALTHPILOT_LOCAL_MODEL` dès qu’un runtime compatible est installé.
