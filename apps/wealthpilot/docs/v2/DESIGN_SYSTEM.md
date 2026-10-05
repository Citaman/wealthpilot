# WealthPilot v2 — Design system « Rime »

Source : `design/rime-direction-2026-10-02/four-components.png` (référence approuvée), `images_ref/`, brief §4/§21.6/§26.
Ce fichier est le contrat visuel. Toute valeur ici existe sous forme de token CSS dans `src/ui/tokens.css`. Aucune couleur en dur dans les composants.

## 1. Couleurs

### Thème Papier (défaut)
| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#EEE8DA` | Fond de page |
| `--surface` | `#F3EEE3` | Carte claire |
| `--surface-sunk` | `#E4DDCD` | Tuiles internes, en-tête de tableau, groupes de jours |
| `--track` | `#DDD5C4` | Pistes de barres/anneaux sur clair |
| `--ink` | `#25221D` | Texte, bordures de carte 2px, cartes sombres, dock, bouton primaire sombre |
| `--ink-2` | `#3A362F` | Tuiles et champs sur carte sombre |
| `--track-dark` | `#4A453D` | Pistes sur carte sombre |
| `--text-muted` | `#665F53` | Méta, axes (≥4.5:1) |
| `--on-dark` | `#EEE8DA` / `--on-dark-muted` `#A9A091` | Texte sur sombre |
| `--hairline` | `rgba(37,34,29,.14)` | Séparateurs, grilles de graphe |
| `--hairline-dark` | `rgba(238,232,218,.16)` | Séparateurs sur sombre |
| `--yellow` `#F3C447`, `--pink` `#E68BDC`, `--cyan` `#21A9C0` | | Accents |
| `--yellow-soft` `#F8E3A6`, `--pink-soft` `#F6D3F0`, `--cyan-soft` `#CFE9EE` | | Puces teintées, ligne sélectionnée |
| `--positive` `#1E7A3F` / `--positive-bg` `#CFEFD8` | | Montants et pastilles positives |
| `--negative` `#C2352B` / `--negative-bg` `#F7D2CC` | | Montants et pastilles négatives |

### Thème Encre (sombre, `prefers-color-scheme: dark` ou palette de carte « Encre »)
`--bg #1A1814`, `--surface #24211C` (bordure `#3E392F` 1.5px), `--surface-sunk #2F2B25`, `--track #3E392F`, texte `#EEE8DA` / muted `#A79E8E`, accents pink `#EB9BE2`, cyan `#3DB8CD`, positive `#6FD796`, negative `#F08A80`, dock `#0F0E0C`.

### Règles d'accent
- **Jaune** : montant héros sur carte sombre, CTA primaire rempli, item actif du dock, série 1. **Jamais de texte jaune sur crème.** Sur jaune, texte encre.
- **Cyan** : prévision (ligne pointillée future), série 2, info.
- **Rose** : seuil de réserve, badges d'attention (« 3 à classer »), série 3, motif décoratif.
- Motif : deux disques plats rose/cyan qui se chevauchent — uniquement dans le logo et en coin d'**une** carte héros par écran, coupés par le bord, jamais derrière des données.
- Une seule carte/tuile remplie d'accent par rangée. Le reste : crème bordé d'encre, ou sombre.
- Vert/rouge = sémantique uniquement (deltas signés, statuts). Jamais seuls : toujours avec signe `+`/`−` ou libellé.

### Séries de catégories (stables sur toutes les vues)
Couleur dérivée de façon déterministe de l'identifiant de catégorie (ou de sa couleur définie) parmi :
`#F3C447` jaune, `#21A9C0` cyan, `#E68BDC` rose, `#9CCBEF` ciel, `#F08A5D` corail, `#8FBF7A` sauge, `#B9A3E3` lavande, `#4D473F` charbon ; « Autres » toujours `#CBC3B3`, toujours en dernier. 5 séries nommées max dans un graphe, puis « Autres ».

## 2. Typographie
- **Display** : Barlow Condensed 700 (800 non dispo → 700), `letter-spacing:-0.02em`, `line-height:.9`. Titres de cartes, tout montant ≥20px, pourcentages.
- **Texte** : DM Sans 400/500/600. Libellés, lignes, boutons, champs, cellules.
- **Mono** : IBM Plex Mono 400/500. Eyebrows en MAJUSCULES `letter-spacing:.16em` (12px), données (`480 / 600 €`), axes, dates courtes.
- Nombres : `font-variant-numeric: tabular-nums`. Format fr-FR : espace fine insécable (U+202F) des milliers et avant €, virgule décimale, vrai signe moins `−`. Pas de décimales pour les montants ≥ 1 000 € dans les héros ; décimales dans les tableaux.

| Token | Taille / interligne | Usage |
|---|---|---|
| `--fs-hero` | clamp(56px, 7cqi, 112px) / .85 | Montant héros |
| `--fs-xl` | 56px / .9 | Héros secondaire |
| `--fs-l` | 40px / .9 | Titre carte large, centre d'anneau |
| `--fs-m` | 30px / .95 | Titre carte moyenne, tuiles de lecture |
| `--fs-s` | 22px / 1 | Titre petite carte, montants de liste |
| `--fs-text-l` | 17px / 1.35 | Sous-libellé héros |
| `--fs-text` | 15px / 1.4 | Lignes, boutons |
| `--fs-text-s` | 13px / 1.35 | Méta, cellules |
| `--fs-mono` | 12px / 1.3 | Eyebrow, axes, données |

Mobile : tailles display ×0.75.

## 3. Forme, espacement
- Rayons : carte 24px, tuile interne 16px, champ 12px, pilule/bouton 999px, dock 24px, item dock 16px, bulle de graphe 6px.
- Bordures : carte claire `2px solid var(--ink)` (1.5px < 1024px). Carte sombre sans bordure. Pilules secondaires 1.5px. Séparateurs 1px hairline. Pointillés 1.5px uniquement pour vide/projeté/placeholder de drag.
- Ombres : aucune sur cartes/dock. Popovers/menus : `0 8px 24px rgba(37,34,29,.16)`. Carte soulevée pendant un drag : `0 18px 40px rgba(37,34,29,.22)`. Pas de dégradé, verre, flou.
- Espacement base 4 : 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- Padding carte : large 28px, moyen 24px, étroit 20px, mobile 16px.
- Grille : 12 colonnes, gap 20px desktop / 16 tablette / 12 mobile. Gouttière page 32px / 16px mobile. Largeur max contenu 1600px (au-delà : centré ; à 2560+ la grille passe à 16 colonnes virtuelles = cartes plus nombreuses par rangée).
- Hauteurs : pilule 36px (compacte 30), bouton icône 32px, CTA 44px, champ 40px, ligne de liste 52px, ligne de tableau 44/52/60 selon densité.

## 4. Anatomie
- **En-tête de carte** (une ligne) : titre display à gauche (une ligne, ellipse), à droite ≤ 2 contrôles compacts (pilule/segmenté) + éventuel lien d'action. Cartes sombres héros : eyebrow mono au lieu du titre.
- **Bloc montant héros** : eyebrow → montant héros → sous-libellé court (≤ 6 mots) → séparateur → pied 2 colonnes.
- **Tuiles de lecture** : `surface-sunk`, rayon 16, padding 16, libellé DM Sans 500 13 + valeur display `--fs-m`. Par paires/trios sous les graphes.
- **Contrôle segmenté** : conteneur bordé 1.5px rayon 999 ; segment actif rempli encre, texte crème. Jamais teal.
- **Ligne de liste** : puce date 44×44 (jour condensé + mois mono, `pink-soft` si ≤ 3 jours) → icône/logo 32px → nom DM Sans 600 + méta mono → montant condensé à droite.
- **Ligne d'opération** : date mono → logo 28px → marchand + méta → point de catégorie 8px + nom → montant tabulaire à droite (`+` et `--positive` pour les entrées).
- **Barre de progression** : piste `--track`, hauteur 10px, remplissage couleur de catégorie, part « engagée » hachurée 45° (encre 30 %), % mono à droite.
- **Pastilles de statut** : 22px, padding 0 10, 12px 500 (Estimé, Confirmé, Nouvelle, Doublon, Erreur).
- **Dock** : fixe en bas, centré, `--ink`, rayon 24, padding 6, items 48px (icône 20 + libellé 12px), actif jaune/texte encre, séparateur vertical hairline-dark avant les commandes de page. Les menus s'ouvrent vers le haut.

## 5. Graphiques (SVG maison)
- Hauteur de tracé : large 260–300px, moyen 180px, étroit 110px ; jamais > 40 % du viewport.
- Axe Y : 4 graduations rondes (« nice ticks »), mono 12 muted, à gauche hors tracé. Axe X : 4–6 dates espacées selon largeur mesurée.
- Grille : horizontale seulement, 1px hairline, pointillé `2 4`. Ligne de base encre 40 %.
- Réel : encre 2.5px, joints ronds. Prévision : cyan 2.5px, `8 6`, démarre exactement au point « aujourd'hui ». Lacune de couverture : segment gris pointillé.
- Aujourd'hui : verticale encre 1px + point 9px.
- Réserve : rose 1.5px, `4 4`, étiquette rose mono à droite au-dessus de la ligne, sans remplissage.
- Annotations : ≤ 4, ancrées sur date/valeur, placement par boîte de collision (au-dessus/en dessous, décalage), jamais sur les graduations.
- Bulle (tooltip) : fond encre, texte crème mono, rayon 6.
- Barres : coins hauts 6px, 60 % de bande, barre survolée pleine et les autres à 45 % d'opacité pendant le survol seulement.
- Anneaux concentriques : même centre, départ midi, sens horaire, épaisseur ~7 % du diamètre, écart 6px, bouts ronds, piste pâle complète, angle = consommé / alloué propre ; zéro = pas d'arc ; dépassement = arc plein + marqueur et montant ; 5 anneaux max.
- Chaque graphe a une alternative accessible (tableau masqué visuellement ou `aria-label` résumé) et est navigable au clavier quand il est interactif.

## 6. Mouvement
- Retour bouton 100ms ; panneau/disclosure 180ms ; reflow FLIP 180ms `cubic-bezier(.2,.8,.2,1)` ; pas d'animation de montant (compteur) ; pas de fondu de page.
- `prefers-reduced-motion: reduce` : aucune translation ni morphing, changements immédiats.
- Pendant drag/resize : géométrie seulement, les graphes ne rejouent pas.

## 7. Palettes de carte
12 palettes = jeux de rôles (`--card-bg`, `--card-text`, `--card-muted`, `--card-sunk`, `--card-border`, `--card-track`, `--card-accent`). Papier, Encre, Jaune, Rose, Cyan, Corail, Lavande, Prune, Bleu nuit, Sauge, Forêt, Sable. Le contraste texte/fond ≥ 4.5:1, piste/marque ≥ 3:1. Les couleurs de catégories restent identiques ; sur une carte colorée, la série qui coïncide avec le fond passe à l'encre.

## 8. Rédaction
- Pas de phrases explicatives permanentes. Libellés de 2–5 mots. Les explications vivent dans « Voir le calcul » (disclosure) ou dans `title`/aide contextuelle.
- Ton : direct, chiffré. « Encore 170 € d'ici dimanche », pas « Voici le montant que vous pouvez encore dépenser… ».
- Estimé ≠ confirmé : pastille « Estimé » plutôt qu'un paragraphe.
- Données manquantes : « À confirmer » + action, jamais 0 inventé.
