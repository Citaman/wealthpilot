# WealthPilot v2 — Produit et interactions (contrat exhaustif)

Périmètre : 4 pages (Dashboard, Ma semaine, Transactions, Import CSV). Objectifs retirés de l'UI, données conservées.
Principe : chaque contrôle visible fait quelque chose de réel, a un état clavier, un état focus visible, un état désactivé expliqué, et ne déplace pas la mise en page au survol.
Trois couches strictement séparées : **présentation** (taille, disclosure ouvert), **contexte de lecture** (compte, période), **commandes métier** (écrire en base). Une sélection visuelle n'écrit jamais dans le ledger.

---

## 0. Règles transverses

| Sujet | Règle |
|---|---|
| Focus | Anneau `2px solid var(--ink)` + offset 2px (crème sur sombre). Jamais `outline:none` sans remplacement. Après une mutation, le focus reste sur le contrôle ou passe à l'élément logique suivant (jamais sur `body`). |
| Cibles | ≥ 32px desktop, ≥ 44px tactile (`pointer: coarse`). |
| Survol | Change couleur/fond seulement, jamais dimension ni bordure qui pousse. |
| Désactivé | `aria-disabled` + `title` expliquant pourquoi ; jamais un bouton mort sans raison. |
| Échap | Ferme le popover/menu/disclosure/dialog le plus récent, annule un drag en cours, quitte une édition inline sans enregistrer. |
| Entrée | Valide une édition inline. Tab hors d'un champ inline = valide aussi (comme un tableur) ; clic hors = valide. |
| Édition inline | Clic sur une valeur éditable (soulignement pointillé au survol) → champ à la même place, même taille, texte sélectionné. Erreur de saisie → bordure rouge + message court sous le champ, la valeur précédente est conservée. |
| Annulation | Toute mutation métier réversible (catégorie, montant d'enveloppe, ignorer une occurrence, retirer une carte, import) affiche un **toast** « … · Annuler » 6s. Le toast n'occupe pas d'espace dans la page (fixé au-dessus du dock), `aria-live=polite`. |
| Confirmation | Seulement pour l'irréversible ou le massif : restaurer une sauvegarde, annuler un import, action groupée > 1 ligne. Dialog avec le périmètre exact chiffré. |
| Chargement | Premier rendu : squelettes dimensionnés (pas de saut). Ensuite, données précédentes conservées pendant le recalcul. |
| Erreur | Une carte qui plante affiche « Cette carte n'a pas pu s'afficher · Réessayer », le reste du dashboard vit (error boundary par carte et par page). |
| Vide | Aucune donnée → redirection Import. Carte sans donnée pertinente → message d'une ligne + action (« Aucune enveloppe · Créer »). |
| Montants | Toujours `Money` : signe, espace fine, tabulaire, couleur sémantique + signe (jamais couleur seule). Montant inconnu → « — » + raison au survol. |
| Dates | Dates métier `YYYY-MM-DD` manipulées sans `new Date(str)` UTC. Affichage « 12 oct. », « mer. 14 oct. », « 26 sept. → 24 oct. ». |
| Mouvement réduit | Respecté partout (FLIP, disclosure, drag). |
| Persistance | Contexte (compte, période), densité, taille de page, disposition, palettes : persistants. Disclosures ouverts, hover : non persistants. |
| Multi-onglets | Dexie live query : un autre onglet qui écrit met à jour la vue. La disposition en cours d'édition n'est pas écrasée ; à l'enregistrement, si la version a changé, on enregistre quand même la nôtre (dernière action explicite) — pas de fusion silencieuse de données financières. |

---

## 1. Shell

### 1.1 Logo
- En haut à gauche, lien vers Dashboard (`aria-label="WealthPilot, Dashboard"`). Rien d'autre en haut. Chaque page a un `<h1>` visuellement masqué.

### 1.2 Dock (fixe en bas, centré)
- Section navigation : Dashboard, Ma semaine, Transactions, Import CSV (icône + libellé). Actif = jaune. `aria-current="page"`.
- Séparateur, puis commandes de la page active (montées seulement pour la page active).
- La hauteur du dock est mesurée (ResizeObserver) → variable `--dock-h` ; la page réserve `padding-bottom: calc(var(--dock-h) + 32px)` ; `scroll-padding-bottom` identique pour que le focus clavier ne finisse jamais sous le dock.
- Menus du dock : s'ouvrent vers le haut, se ferment à Échap / clic extérieur / sélection, focus rendu au déclencheur.
- < 720px : deux rangées (commandes au-dessus, navigation en dessous, icônes + libellés 11px), pleine largeur moins 8px, `env(safe-area-inset-bottom)`.
- Raccourcis : `Alt+1..4` pages ; `/` focus recherche (Transactions) ; `?` rien (pas de feature cachée non documentée).

### 1.3 Contexte partagé (Dashboard + Transactions)
- **Compte** : « Foyer (3 comptes) » ou un compte. Menu : Foyer, puis chaque compte avec son solde du jour à droite. Persisté.
- **Période** : un seul menu (fusion des anciens « période » + « mois ») :
  - Section « Mois budgétaire » : mois en cours (« Octobre · 26 sept. → auj. »), puis les mois précédents avec leurs dates réelles, la période initiale partielle marquée « partiel ».
  - Section « Glissant » : 30 derniers jours, 3 mois, 6 mois, 12 mois, Tout l'historique.
  - Pied du menu (une ligne mono) : « Mois = du 1er revenu du foyer à la veille du suivant · prochain ≈ 25 oct. (estimé) ».
  - Le déclencheur affiche « Octobre » ou « 30 jours » etc. ; flèches `‹ ›` accolées au déclencheur pour mois précédent/suivant quand un mois est sélectionné (désactivé au plus récent).
- Changer compte/période ne remonte pas la page, ne ferme pas les disclosures, garde le scroll.

### 1.4 Routage
- Hash : `#/`, `#/semaine`, `#/transactions`, `#/import`. Paramètres de drilldown en query du hash : `#/transactions?cat=…&from=…&to=…&acct=…&q=…&tx=…`.
- Anciennes routes (`#week`, `#transactions`, `#import`, `#budgets`, …) : redirigées (week→semaine, autres→dashboard), `replaceState`.
- Les pages visitées restent montées (masquées) pour garder état, brouillons et scroll ; à l'activation, focus sur le `<h1>` masqué et scroll restauré.
- Retour navigateur depuis un drilldown Transactions → Dashboard à la même position.
- Base vide au démarrage → `#/import` (une seule fois ; l'utilisateur peut ensuite visiter les pages, qui montrent un état vide avec bouton Import).

---

## 2. Dashboard

### 2.1 Lecture
- Grille 12 colonnes, cartes **ordonnées** avec une largeur parmi ¼ (3), ⅓ (4), ½ (6), ⅔ (8), 1 (12) selon ce que la carte autorise. Hauteur = contenu (aucun scroll interne, aucune hauteur fixe). Rangées : chaque carte s'étire à la hauteur de la plus haute de sa rangée (`align-items: stretch`) mais son contenu reste en haut ; pas de trous, pas de masonry.
- Tablette (720–1100px) : largeurs ¼/⅓ → ½ ; ⅔ → 1. Mobile (< 720px) : tout en pleine largeur, même ordre.
- ≥ 2200px : la grille garde 12 colonnes mais largeur de contenu max 2000px ; pas d'étirement géant.
- Le contenu de chaque carte s'adapte à **sa largeur mesurée** (container queries `@container card`) : étroit (< 360px), moyen (360–640px), large (> 640px). La largeur choisie détermine le niveau d'information.
- Aucune poignée visible en lecture.

### 2.2 Organiser (mode explicite)
- Dock : « Organiser » → commandes deviennent « + Ajouter », « Annuler », « Terminer ». Annonce live « Mode organisation ».
- Chaque carte reçoit une barre d'édition en haut (au-dessus de son contenu, sans le masquer) : poignée `⠿` (prise), nom, sélecteur de largeur (segmenté ¼ ⅓ ½ ⅔ 1, limité aux largeurs autorisées), palette (pastille → popover 12 pastilles), source (si la carte le supporte : « Compte du dock » / un compte), retirer `×`.
- Le contenu reste rendu en vrai (non interactif : `inert`), légèrement atténué.
- **Glisser (pointeur)** : pointerdown sur la poignée → la carte se soulève (ombre, suit le pointeur avec l'offset de prise exact, taille gelée) ; un **emplacement pointillé de la même taille** marque la position d'insertion ; les autres cartes se réarrangent en direct par FLIP 180ms. Le point d'insertion = carte survolée dont le centre est le plus proche du pointeur (avant si pointeur dans la moitié gauche/haute, après sinon). Auto-scroll quand le pointeur est à < 80px du haut ou du haut du dock (vitesse proportionnelle). Le défilement pendant une prise ne détache pas la carte (position recalculée sur `scroll`). Relâcher → la carte rejoint l'emplacement (FLIP), focus sur sa poignée. Échap ou pointercancel → retour à l'origine.
- **Clavier** : Tab jusqu'à la poignée → Espace/Entrée = prendre (annonce « Solde soulevée, position 2 sur 9 ») → ←/↑ avant, →/↓ après (annonce la nouvelle position) → Espace/Entrée = poser, Échap = annuler. Le focus reste sur la poignée.
- **Sans glisser (WCAG 2.5.7)** : dans le menu de la carte : « Déplacer au début », « Monter », « Descendre », « Déplacer à la fin ».
- **Largeur** : clic sur un segment → reflow FLIP immédiat ; le contenu passe au niveau d'information correspondant.
- **Retirer** : la carte disparaît (FLIP des voisines), toast « Carte retirée · Annuler ».
- **+ Ajouter** : panneau latéral (droite, 420px ; plein écran mobile) « Ajouter une carte » : liste des 11 types avec question métier, aperçu réel réduit (rendu à ⅓ avec les vraies données), largeurs possibles, badge « déjà présente ×N ». « Ajouter » insère après la carte focalisée (sinon à la fin), ferme le panneau, fait défiler jusqu'à la carte et la souligne 1s. Recherche texte en tête du panneau. Pied : « Rétablir la disposition par défaut » (confirmation inline : « Remplacer la disposition actuelle ? Oui / Non »).
- **Annuler** : abandonne le brouillon (aucune confirmation : rien de financier n'est en jeu), retour lecture.
- **Terminer** : enregistre le brouillon (prefs), retour lecture, toast « Disposition enregistrée ». Erreur d'écriture → toast d'erreur persistant + reste en mode organiser.
- Naviguer ailleurs pendant l'organisation : le brouillon est conservé (page montée) ; le dock de la page Dashboard reste en mode organiser au retour.
- Plusieurs instances d'un même type autorisées (ex. deux Enveloppes : Foyer et Commun).

### 2.3 Les 11 cartes
Chaque carte : identifiant de type stable, largeurs autorisées, largeur par défaut, question à laquelle elle répond. Toutes héritent compte+période du dock sauf source surchargée.

| # | Type | Question | Largeurs (défaut) |
|---|---|---|---|
| 1 | `balance` Solde | Combien avons-nous et où va le solde ? | ½ ⅔ 1 (⅔) |
| 2 | `available` Disponible | Combien est vraiment libre jusqu'à la fin du mois budgétaire ? | ⅓ ½ (⅓) |
| 3 | `week` Cette semaine | Combien encore d'ici dimanche ? | ⅓ ½ (⅓) |
| 4 | `envelopes` Enveloppes | Que reste-t-il dans chaque enveloppe ? | ⅓ ½ ⅔ 1 (½) |
| 5 | `upcoming` À venir | Quelles entrées/sorties arrivent, et un compte va-t-il manquer ? | ⅓ ½ ⅔ (½) |
| 6 | `flows` Entrées et sorties | Les revenus couvrent-ils les dépenses, mois après mois ? | ½ ⅔ 1 (⅔) |
| 7 | `spending` Où part l'argent | Quelles catégories pèsent, et lesquelles dépassent l'habitude ? | ⅓ ½ ⅔ (⅓) |
| 8 | `simulate` Puis-je dépenser ? | Cet achat passe-t-il ? | ⅓ ½ (⅓) |
| 9 | `recent` Opérations | Que s'est-il passé récemment ? | ⅓ ½ ⅔ 1 (⅔) |
| 10 | `inbox` À traiter | Qu'est-ce qui attend une décision ? | ¼ ⅓ ½ (⅓) |
| 11 | `accounts` Comptes | Mes soldes sont-ils à jour et fiables ? | ⅓ ½ ⅔ (⅓) |

Disposition par défaut : `balance ⅔, available ⅓ / envelopes ½, upcoming ½ / week ⅓, spending ⅓, inbox ⅓ / recent ⅔, accounts ⅓`.

#### 1 · Solde
- En-tête : « Solde » ; à droite, segmenté `Réel | + Prévision` (persisté par instance).
- Ligne héros : solde à la date d'observation (aujourd'hui) en `--fs-l`, delta sur la période (« +1 120 € depuis le 26 sept. »), date du dernier solde observé en mono (« observé le 2 oct. »).
- Graphe : soldes de clôture quotidiens ancrés sur les checkpoints ; granularité automatique (jour ≤ 120 jours, semaine ≤ 2 ans, sinon mois — en semaine/mois : solde de clôture du dernier jour) ; seuil de réserve rose ; prévision cyan pointillée jusqu'à la fin du mois budgétaire suivant + bande prudente/favorable pâle ; lacunes de couverture en segment gris pointillé ; ≤ 4 annotations (revenus identifiés, plus grosse sortie, point bas prévu) avec placement anti-collision.
- Survol / toucher / clavier (graphe focalisable, ←/→ par point, Origine/Fin) : réticule vertical + bulle « mer. 14 oct. · 2 440 € · 3 opérations (−86 €) ». Clic sur un point (ou Entrée) → Transactions filtrées sur ce jour.
- Tuiles sous le graphe (moyen/large) : « Point bas · 940 € · 18 oct. » (si prévision) et « Fin du mois · 2 180 € ».
- Large : légende par compte (pastille + nom + solde), clic sur un compte = surligne sa courbe fine (multi-séries en petites lignes), deuxième clic = revient au foyer. Étroit : pas de graphe, montant + sparkline.
- Solde inconnu (aucun checkpoint) : « Solde à confirmer » + bouton « Saisir le solde » (ouvre l'édition inline dans la carte Comptes ou ici même : champ montant + date).

#### 2 · Disponible
- Carte sombre (palette Encre par défaut), eyebrow « LIBRE JUSQU'AU 24 OCT. ».
- Montant héros jaune (ou rose + « Il manque » si négatif — jamais ramené à 0).
- Pied : « Cette semaine 170 € » (lien vers Ma semaine).
- « Voir le calcul » (disclosure inline, état non persisté) : cascade lisible
  `Trésorerie 4 820 € → − Charges à venir 2 140 € → − Enveloppes restantes 480 € → − Réserve de sécurité 600 € → = Libre 1 250 €`.
  Chaque ligne a sa barre horizontale proportionnelle (cascade). « Réserve de sécurité » est **éditable inline** (clic sur le montant). « Charges à venir » se déplie en liste (5 premières + « +3 »). Revenus attendus listés à part, grisés : « Non comptés : Salaire Sam ≈ 1 200 € le 25 oct. ».
- Compte filtré : réserves communes non réparties → mention « réserve foyer non répartie » au lieu d'un chiffre inventé.

#### 3 · Cette semaine
- « Encore 170 € » + « d'ici dim. 11 oct. » ; barre segmentée payé/engagé/possible ; mini-frise 7 jours (barres de dépense réelle, aujourd'hui marqué) ; 3 enveloppes au plus faible reste. Clic n'importe où (hors contrôles) → Ma semaine (même compte).

#### 4 · Enveloppes
- Moyen/large : anneaux concentriques (≤ 5 premières enveloppes, ordre = ordre de la liste) à gauche, centre « 650 € dépensés » ; liste à droite. Étroit : liste seule.
- Ligne : pastille couleur, nom, `payé / alloué` mono, barre (payé plein + engagé hachuré), reste à droite (négatif rouge + « dépassé »).
- **Alloué éditable inline** pour le mois budgétaire affiché (Entrée enregistre, toast avec Annuler). Champ vide + Entrée = supprimer l'enveloppe (toast Annuler).
- « + Enveloppe » en pied : menu des catégories de dépense sans enveloppe, triées par dépense moyenne ; choisir → nouvelle ligne avec allocation proposée (médiane des 3 derniers mois) en édition.
- Réordonner : poignée au survol de ligne (toujours visible sur tactile), glisser vertical (même moteur que la grille), clavier Alt+↑/↓ sur la ligne. Ordre persisté (`budgetOrder`) et partagé avec Ma semaine.
- Clic sur le nom → Transactions filtrées (catégorie, période).
- Survol d'un anneau ↔ surligne la ligne correspondante (et inversement).
- Plus de 5 enveloppes : anneaux = 5 premières ; la liste montre tout (large) ou 6 + « Voir les 4 autres » (disclosure).

#### 5 · À venir
- Agenda vertical jusqu'à la fin du mois budgétaire (≤ 8 lignes en moyen, toutes en large), groupé par date avec puce date. Entrées (`+`, cyan) et sorties (`−`). Pastille « Estimé » pour les occurrences détectées, rien pour les confirmées.
- **Alerte d'approvisionnement** en tête si un compte passe sous 0 ou sous sa réserve avant la fin : « Commun < 0 le 28 oct. (−120 €) · prévoir 120 € avant le 27 ». Pas d'exécution de virement.
- Menu de ligne (⋯) : « Confirmer cette récurrence » / « Ignorer cette occurrence » (toast Annuler) / « Modifier le montant » (inline) / « Arrêter le suivi » / « Voir l'historique » (Transactions filtrées sur le marchand).
- « + Échéance » : ligne inline (libellé, montant signé, date, compte) → Entrée crée.
- Écriture d'une occurrence ajustée : **unique par `originOccurrenceId`** (contrôle dans la transaction Dexie) — corrige le défaut de concurrence.

#### 6 · Entrées et sorties
- Barres divergentes par mois budgétaire (entrées au-dessus en jaune, sorties en dessous en cyan, net en point rose relié), N mois selon largeur (½ : 4, ⅔ : 6, 1 : 12). Mois en cours hachuré « en cours ». Virements internes exclus.
- Survol : bulle entrées/sorties/net. Clic → Transactions du mois. Clavier ←/→.
- Tuiles : moyenne des sorties des mois complets, net cumulé.

#### 7 · Où part l'argent
- Barres horizontales classées (catégories de dépense de la période), montant + part ; repère vertical fin = médiane des 3 mois budgétaires précédents complets ; écart > +25 % → pastille « +42 % vs habitude ».
- Étroit : top 5 + Autres. Moyen : top 8. Large : toutes + clic sur une catégorie déplie ses sous-catégories inline.
- Clic sur le nom → Transactions filtrées.

#### 8 · Puis-je dépenser ?
- Formulaire inline toujours visible : montant (autofocus non), catégorie (menu, défaut « Restaurants » si existe), date (auj.), compte (défaut compte du dock ou compte qui paie habituellement cette catégorie).
- Résultat **en direct** (pas de bouton Calculer) :
  - verdict une ligne : « Oui · il restera 35 € en Restaurants » / « Possible, mais hors enveloppe · libre 1 250 → 1 215 € » / « Non · Commun passe sous la réserve le 28 oct. ».
  - avant/après : enveloppe, disponible du mois, point bas du compte payeur (barres doubles).
  - si dans l'enveloppe : le disponible ne baisse pas une 2ᵉ fois (déjà provisionné), explicitement dit.
- « Effacer » remet à zéro. Aucune écriture.

#### 9 · Opérations
- Dernières opérations de la période (8 en ⅓, 12 en ½, 15 en ⅔/1), groupées par jour, logo/ icône catégorie, montant. Large : colonne compte et catégorie.
- Clic sur une ligne → Transactions avec la ligne ouverte (`tx=`). Pied « Tout voir (248) ».

#### 10 · À traiter
- File : « 12 opérations sans catégorie » (déplie les 3 premières avec 3 puces de catégorie suggérées + « Autre… » ; choisir = applique, toast Annuler, ligne suivante arrive), « 2 récurrences à confirmer » (Confirmer / Ignorer inline), « Solde Commun non observé depuis 9 j » (→ Import, compte présélectionné), « 3 opérations futures importées » (info).
- Vide : « Rien à traiter ✓ » (une ligne, carte compacte).

#### 11 · Comptes
- Une ligne par compte : nom (renommable inline : alias d'affichage), solde du jour, « observé le 2 oct. » ou « à confirmer », barre de couverture (12 derniers mois, segments couverts pleins, trous vides), dernier import.
- Statut : « À jour » (≤ 7 j), « À actualiser » (> 7 j), « Sans solde ».
- Actions de ligne : « Saisir le solde observé » (inline montant + date → crée checkpoint observé manuel ; montre l'écart avec le calculé avant d'enregistrer), « Importer un relevé » (→ Import), « Filtrer sur ce compte » (change le compte du dock).
- Pied : total foyer (virements internes neutres).

---

## 3. Ma semaine

Dock : compte (Foyer/compte), sélecteur de semaine `‹ 5 – 11 oct. ›` + bouton « Cette semaine » (masqué quand déjà sur la semaine courante). Semaines lundi→dimanche. Navigation libre dans le passé (lecture du réalisé) et jusqu'à 4 semaines dans le futur.

Composition (desktop) :
1. **Héros** (pleine largeur, carte sombre) : eyebrow « CETTE SEMAINE · 5 – 11 OCT. » ; montant héros « 170 € » + « encore possibles d'ici dimanche » ; barre segmentée payé (crème) / engagé (hachuré) / possible (jaune) avec légende chiffrée ; à droite deux faits : « Point bas jeu. 9 oct. · 940 € (réserve 600) » et « Salaire Sam attendu ven. · non compté » (si applicable). « Voir le calcul » (disclosure) : base de chaque enveloppe (médiane de N semaines comparables, N affiché), part des mois budgétaires traversés, engagements datés, limitation par la trésorerie/point bas.
   - Semaine passée : « 312 € dépensés » + comparaison au plan.
2. **Frise 7 jours** (pleine largeur) : 7 colonnes lun→dim ; chaque colonne : jour + date, aujourd'hui en encre ; barre de dépense réelle (passé) ; puces de charges prévues (rose, libellé court + montant) et de revenus attendus (cyan, pointillé si estimé) ; solde de fin de journée en mono en pied. Clic/Entrée sur un jour → panneau inline sous la frise : opérations du jour (réelles) et prévus, lien « Voir dans Transactions ». Re-clic ou Échap ferme. ←/→ entre jours quand la frise a le focus.
   - Mobile : liste verticale de jours.
3. **Enveloppes de la semaine** (⅔) : seulement les catégories actives (allocation ou dépense > 0 cette semaine), triées par l'ordre des enveloppes. Ligne : pastille, nom, barre payé/engagé/possible, « possible » en gros à droite, détail mono « payé 70 · engagé 60 · limite 200 ».
   - **Limite de la semaine éditable inline** (clic sur « limite 200 ») → enregistrée dans le plan de la semaine (compte+début), toast Annuler. Revenir à la proposition : lien « Proposé : 180 € » sous le champ.
   - Catégories à zéro : repliées en une ligne « 4 catégories sans dépense prévue ▸ ».
4. **Colonne droite** (⅓) : « Tester un achat » (même composant que la carte 8, date bornée à la semaine) ; « Charges de la semaine » (liste compacte, menu ⋯ identique à À venir) ; « Réserve » éditable inline.
- Mobile : héros → enveloppes → tester un achat → jours → charges.
- Brouillons (simulation, édition en cours) conservés en changeant de page.

---

## 4. Transactions

### 4.1 Synthèse (une bande compacte, pas de grand bloc jaune)
« 248 opérations · Sorties −3 412 € · Entrées +4 830 € · Net +1 418 € » sur le résultat filtré (hors virements internes pour sorties/entrées, mention si inclus).

### 4.2 Barre d'outils (collante sous le logo au défilement)
- Recherche (placeholder « Rechercher… », `/` pour focus, × pour effacer, debounce 120ms ; recherche floue existante : accents, abréviations « mcdo »).
- Type : segmenté Tout / Dépenses / Revenus / Virements.
- Filtres (popover) : catégories (multi, avec recherche), montant min/max, « Sans catégorie », « Avec note ». Chaque filtre actif = puce sous la barre avec × ; « Tout effacer ».
- Tri : menu Date ↓ (défaut), Date ↑, Montant ↓, Montant ↑, Marchand A→Z. Aussi clic sur en-têtes Date / Montant.
- Densité : segmenté 3 icônes (compacte 40px / standard 52px / confortable 64px), persisté.
- Changer recherche/filtre/tri → page 1, la ligne ouverte reste ouverte si elle est encore dans le résultat.

### 4.3 Tableau
- Colonnes : ☐ · Date (mono) · Opération (logo/icône + marchand, libellé bancaire brut en méta) · Catégorie (pastille + nom, cliquable) · Compte · Montant (droite). Groupement par jour avec total du jour (en tri par date). En-tête collant.
- Catégorie cliquable → menu de catégories (recherche, récentes en tête, sous-catégories) → applique (toast Annuler ; « Appliquer aussi aux 6 autres “CARREFOUR” ? » proposé dans le toast si des opérations similaires non corrigées existent).
- Clic ligne / Entrée → **détail inline** sous la ligne (un seul ouvert à la fois, la position de la ligne ne bouge pas) : libellé brut complet, marchand (éditable inline), catégorie + sous-catégorie, note (éditable, sauvegarde à la sortie du champ), « Virement interne » (interrupteur), compte, date, lot d'import (nom de fichier, date), champs bruts (disclosure). Échap ferme, focus revient sur la ligne.
- Clavier : ↑/↓ ligne précédente/suivante (roving tabindex), Entrée ouvrir/fermer, Espace cocher, Échap fermer.
- Opération future (date > aujourd'hui) : pastille « À venir », exclue des totaux de période.
- Drilldown `tx=` hors filtre : ligne épinglée au-dessus du tableau « Hors période · ✕ ».

### 4.4 Sélection et actions groupées
- Case par ligne ; case d'en-tête = cette page (état indéterminé si partiel). Barre de sélection collante en bas du tableau (au-dessus du dock) : « 12 sélectionnées · Sélectionner les 248 du résultat · Catégoriser… · Virement interne · Exporter · ✕ ».
- La sélection persiste entre pages, densités, tailles de page. Changer le filtre conserve la sélection et affiche « dont 3 hors du filtre ».
- Action groupée → dialog de confirmation chiffré (« Catégoriser 12 opérations en Courses ? ») → une seule transaction Dexie → toast Annuler.

### 4.5 Pagination (haut et bas, synchronisées)
- « 51–100 sur 248 » · Lignes [25 50 75 100 150] (persisté) · « ‹ 1 2 3 … 9 10 › » (page courante encre) · « Aller à [ ] » (Entrée ; hors borne → borné).
- Changer de page → défilement en haut du tableau, focus première ligne. Changer la taille → garde la première ligne visible dans la nouvelle page.
- Zéro résultat : « Aucune opération ne correspond · Effacer les filtres », pas de pagination fantôme.

### 4.6 Export (dock)
- « Exporter » → menu : « Résultat filtré (248) » / « Sélection (12) » (si sélection). CSV `;` UTF-8 BOM, montants fr, cellules commençant par `= + - @` préfixées d'une apostrophe.

---

## 5. Import CSV

Dock : « Sauvegarde » (menu : « Exporter une sauvegarde », « Restaurer… »), « CSV exemple ».

### 5.1 Dépôt
- Grande zone (pointillée) : « Déposer un relevé CSV » + bouton « Choisir un fichier » ; dépôt aussi possible n'importe où sur la page (surbrillance de la zone). Limites en mono : « CSV · 20 Mo · 50 000 lignes max ».
- Fichier refusé (extension, taille) : message dans la zone, rien ne change.
- Fichier déjà importé (même SHA-256) : « Déjà importé le 3 oct. (142 opérations) · Voir le lot » — pas d'étape suivante.

### 5.2 Analyse
- Barre de progression dans la zone (worker) + « Annuler ». Encodage (UTF-8 / Windows-1252), séparateur, profil (Société Générale / générique) affichés en mono une fois détectés.

### 5.3 Compte (petit dialog — seule modale du parcours)
- Format reconnu : « Ce relevé concerne quel compte ? » : liste des comptes existants (solde, dernier import) + « Nouveau compte » (champ nom). Si l'identifiant bancaire SG correspond à un compte : présélectionné et verrouillé (« reconnu par son numéro »). Fichier multicomptes : une ligne de choix par compte détecté.
- Rien n'est créé tant que l'import n'est pas validé. Annuler le dialog = retour au dépôt.

### 5.4 Correspondance des colonnes (seulement si format inconnu, ou « Corriger les colonnes »)
- Tableau d'aperçu (8 premières lignes) avec un menu par colonne : Date, Libellé, Montant, Débit, Crédit, Compte, Catégorie, Solde, Ignorer. Format de date détecté (JJ/MM/AAAA…) modifiable. Validation en direct : « Il manque : Montant (ou Débit + Crédit) ».

### 5.5 Aperçu
- Compteurs (onglets filtrants) : « 142 nouvelles · 30 déjà présentes · 2 erreurs ». Liste des lignes (paginée 50) avec statut ; erreurs avec n° de ligne et raison ; doublons avec la ligne existante correspondante.
- Solde détecté : « Solde observé au 2 oct. : 1 070,00 € » (avec écart vs calculé si existant) — case « Enregistrer comme solde observé » cochée par défaut.
- Bouton final explicite : « Importer 142 opérations dans Commun ». Si la base a changé depuis l'aperçu → « Les données ont changé, aperçu recalculé » et nouvel aperçu (pas d'écriture).
- Écriture atomique : compte (si nouveau) + lot + opérations + checkpoint.

### 5.6 Résultat
- « 142 opérations importées dans Commun · 2 oct. → 4 oct. » ; actions : « Voir les opérations » (Transactions filtrées sur le lot), « Annuler cet import », « Importer un autre fichier ». Toast identique.

### 5.7 Historique des imports (sous la zone)
- Liste : fichier, date d'import, compte(s), période couverte, nombre. Action « Annuler l'import » → dialog : « Supprimer les 142 opérations de ce lot ? » ; bloqué si des opérations du lot ont été corrigées : « 3 opérations de ce lot ont été modifiées à la main · Voir » (pas de suppression silencieuse).

### 5.8 Sauvegarde
- Exporter : télécharge `wealthpilot-sauvegarde-AAAA-MM-JJ.json` (toutes les tables + prefs, versionné). Toast.
- Restaurer : choisir un fichier → validation → dialog inventaire « Sauvegarde du 3 oct. : 1 508 opérations, 3 comptes, 12 enveloppes… / Actuel : 1 520 opérations… » → « Télécharger d'abord une sauvegarde de l'état actuel » (coché, fait automatiquement) → bouton rouge « Remplacer mes données ». Erreur de format → message clair, rien n'est modifié.
- CSV exemple : télécharge `fixtures/demo.csv`.
