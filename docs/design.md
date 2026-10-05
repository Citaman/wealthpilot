# Design

Direction « Rime » : `references/rime/four-components.png`. Inspirations : `references/inspiration/`.

## Base

- Papier `#EEE8DA`, encre `#25221D`, accents jaune `#F3C447`, rose `#E68BDC`, cyan `#21A9C0`. Toutes les valeurs sont des tokens dans `src/ui/tokens.css` ; aucune couleur en dur dans un composant.
- Typo : Barlow Condensed (titres, montants), DM Sans (texte), IBM Plex Mono (étiquettes, axes).
- Cartes : bordure encre 2 px, rayon 24 px, pas d'ombre. Logos et icônes en squircle.

## Règles

- Jaune : montant héros sur fond sombre, action principale, page active. Jamais de texte jaune sur crème.
- Vert / rouge : montants signés uniquement, toujours avec `+` / `−`.
- Une couleur stable par catégorie ; jamais de lettre à la place d'un logo (icône de catégorie).
- Pas de phrase explicative permanente : libellés de 2 à 5 mots, explications dans « Voir le calcul » ou en info-bulle.
- Pas de scroll interne dans une carte, pas de hauteur fixe ; les cartes s'adaptent à leur largeur.
- Focus visible partout, cibles ≥ 24 px, mouvement réduit respecté.
