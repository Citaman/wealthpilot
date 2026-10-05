# Archive de la premiere proposition

Cette proposition a ete rejetee apres revue visuelle. Le referentiel actuel est [l'experience implementee](README.md) et son [releve de verification](VERIFICATION.md). Les plans et variantes ci-dessous ne decrivent pas les pages livrees.

# Design system : WealthPilot Rebuild

Version : 0.1, proposition du 30 septembre 2026. Phase : conception uniquement.
Autorite : [decision de reconstruction](README.md). Valeurs : [tokens](tokens.json).

## 01. Intention et priorites

Une application financiere de travail, visuellement soignee, a utiliser chaque jour. Le design est une architecture d'information et d'interaction ; les decorations ne remplacent ni les parcours ni les etats.

Ordre des priorites : comprendre, agir, corriger, retrouver, puis personnaliser. L'UI/UX de la tranche livree doit etre complete avant d'ajouter une destination. Aucune obligation de ressembler a l'ancienne application.

Direction : canvas neutre lumineux, texte graphite, accent vert profond pour les commandes, bleu pour le solde, rouge pour les sorties, ambre pour l'incertitude. Le theme n'est ni entierement vert, ni une collection de cards pastel. Les accents de categories restent des details, jamais des fonds dominants.

Les references sont un moodboard : retenir rythme, proportions, densite, dock et lisibilite. Ecarter les faux paiements, numeros de carte decoratifs, jauges arbitraires, mascottes animees et courbes sans donnees.

## 02. Structure type Figma

| Page de conception | Contenu | Condition de sortie |
|---|---|---|
| 00 / Decisions | Cible, perimetre, exclusions et variantes retenues | Aucune contrainte contradictoire |
| 01 / Foundations | Couleurs, typo, espacement, grilles, rayons, elevation et mouvement | Tokens nommes et contrastes verifies |
| 02 / Components | Master components, proprietes et variants | Etat normal et tous les etats pertinents |
| 03 / Patterns | Filtrer, editer, confirmer, importer, rapprocher et sauvegarder | Enchainements et retours d'erreur |
| 04 / Screens | Frames 1440 x 1000 et 390 x 844 ; controles 320, 768, 1920 | Ordres desktop/mobile explicites |
| 05 / Flows | Liens entre frames ; succes, erreur, interruption et reprise | Aucun cul-de-sac |
| 06 / Validation | Comparaisons, tests et decisions restant ouvertes | Liste des observations et verdict |

Nommage : `Navigation/Dock`, `Data/Money`, `Data/TransactionRow`, `Overlay/DetailPanel`. Les variantes sont des proprietes : `size=regular|compact`, `state=idle|pending|error`, `scope=household|account`. Ne pas dupliquer un composant par page ou par couleur.

Auto-layout conceptuel : taille minimale, comportement fill/hug/fixed, alignement, gap, padding et overflow specifies ci-dessous. Aucun element ne depend d'une position absolue issue d'un screenshot, sauf un overlay ou un trace de graphique.

## 03. Fondations visuelles

### Couleurs et semantique

Les valeurs exactes vivent dans le fichier de tokens. Clair est la premiere experience a valider ; sombre a ses propres tokens et sera valide avant d'etre livre, pas ajoute par inversion automatique.

| Role | Clair | Sombre | Regle |
|---|---|---|---|
| Canvas | #F5F6F8 | #17191C | Fond du shell, pas une carte geante |
| Surface | #FFFFFF | #212429 | Modules de travail et overlays |
| Texte principal | #1B212B | #F4F6F8 | Libelles, titres, valeurs |
| Texte secondaire | #5E6573 | #B5BEC9 | Metadonnees lisibles, pas gris decoratif pale |
| Primaire | #14634F | #8CDEC4 | Action principale, selection du dock |
| Solde / information | #255BA5 | #9CC3FF | Courbe de solde et information |
| Sortie / erreur | #A6263C | #FFA4B3 | Signe negatif ; erreur avec texte et icone |
| Incertitude / avertissement | #865000 | #EEC16F | Donnee incomplete, estimation ou controle requis |
| Transfert | #654B87 | #D4B5FA | Petit marqueur, pas fond d'une section |

Texte normal : contraste >= 4.5:1. Controles, focus et traces essentielles : >= 3:1. `border` est un separateur decoratif ; utiliser `controlBorder` pour identifier un champ. Aucune information par couleur seule. Les etats desactives sont nommes et expliquent leur indisponibilite quand utile.

### Typographie

Instrument Sans, fichiers auto-heberges dans la future application. Graisses 400/500/600/700. La planche visuelle doit utiliser la vraie police chargee, pas seulement son nom CSS.

| Role | Taille / interligne | Usage |
|---|---|---|
| Caption | 12 / 16 | Metadonnees non essentielles uniquement |
| Label | 13 / 18 | Etiquettes courtes et en-tetes de colonnes |
| Body | 14 / 20 | Table, controles et paragraphes courts |
| Body large | 16 / 24 | Explication d'une erreur ou d'une decision |
| Titre module | 16 / 22, 600 | Un titre par module |
| Titre page | 24 / 32, 600 | Pas de hero marketing |
| Valeur secondaire | 28 / 36, 600 | Sommes synthetiques |
| Valeur principale | 36 / 44, 600 | Un seul solde predominant sur Aujourd'hui |

Letter-spacing = 0 pour toutes les tailles. Aucun `vw` pour les polices. Chiffres tabulaires ; chiffres et symbole de devise inseparables. Un montant long passe sur une seconde ligne semantique ou adopte une taille fixe de la gamme inferieure, jamais une compression horizontale.

### Espacement, surfaces et elevation

Echelle : 4, 8, 12, 16, 20, 24, 32, 40, 48 px. Padding de module : 24 desktop, 16 mobile. Header/body/footer d'un meme module suivent ce rythme.

Rayons : controle 6 px ; module 8 px ; overlay 8 px. Le dock peut avoir une silhouette capsule. Pas de grandes cartes arrondies a 24/32 px partout.

Elevation : aucune ombre permanente sur les modules ; bordure fine. Ombre legere uniquement pour dock, menu et panneau superpose. Aucun glow, orb, bokeh, effet glass derriere les donnees ou gradient principal violet. Canvas legerement nuance ; le graphisme vient des donnees, des surfaces et de leur rythme.

## 04. Shell pleine largeur et pleine hauteur

Le shell occupe `min-height: 100dvh` et `width: 100%`. Pas de `max-width` global. Pleine hauteur ne signifie pas compresser tout le contenu dans un ecran : les pages longues scrollent naturellement.

Structure : barre de contexte haute, titre/actions de page, grille Bento, espace protege du dock. Pas de sidebar. Le contenu commence au meme alignement a travers les destinations.

| Viewport | Colonnes | Padding externe | Gap |
|---|---:|---:|---:|
| 320 a 767 | 4 | 16 | 12 |
| 768 a 1199 | 8 | 24 | 16 |
| >= 1200 | 12 | 32 | 24 |

Sur grand ecran, les colonnes s'etendent ; le texte de lecture est limite a environ 65 caracteres, pas la page. Une table et un graphique exploitent la place disponible. Sur 1920 px, utiliser des modules utiles cote a cote plutot que des lignes de texte de 180 caracteres.

Hauteurs : contenu naturel ; minimum de graphique 240 px ; listes et tables avec une zone de travail stable. Ne pas appliquer des hauteurs identiques a un nombre, une table et un formulaire.

Une grille Bento signifie que des modules repetes cadrent de vraies fonctions. Elle n'impose pas que chaque sous-partie soit une carte : un tableau, une legende et un header vivent dans la meme surface, separes par alignement et filets.

### Zone protegee du dock

Hauteur 64 px ; marge basse 16 desktop / 8 mobile, plus safe area. Reserve sous le contenu : hauteur dock + marge basse + 24 px + safe area. Derniere ligne, toast et bouton de validation ne doivent jamais etre caches.

Le dock ne grossit pas au survol et ne se deplace pas quand le libelle actif change. Il n'est pas masque automatiquement au scroll : la navigation doit rester previsible.

Desktop : Aujourd'hui, Historique, Budget, Analyse, Recurrents, Plus. Cibles de 44 px minimum ; largeur determinee par ces items, pas toute la largeur du canvas. A 768 px, conserver le modele si les libelles tiennent, sinon prendre le modele mobile.

Mobile : quatre destinations principales et Plus, cibles egales ; aucun dock miniature obtenu par `scale()`. A la premiere tranche : Aujourd'hui, Historique et Plus seulement ; ne pas remplir les places avec des boutons factices.

`Plus` ouvre les destinations secondaires actives : comptes/import, calendrier, repartition, plan et reglages. Une destination non livree n'apparait pas dans l'application. La planche de conception peut la montrer comme future, explicitement.

## 05. Bibliotheque : contrat commun

Chaque fiche indique : role, entree/sortie, fill/hug/fixed, dimensions, variantes, etats, activation, clavier, erreurs, mouvement, tests. Ces proprietes sont des contrats de conception, pas des API imposees a l'ancien code.

Les etats financiers `incomplete`, `stale`, `estimated`, `unverified` ne sont pas des etats techniques `loading`, `error`, `pending`. Un ecran peut etre charge et afficher une donnee incomplete.

### C01 / Navigation / ContextBar

- Role : rendre le perimetre de tous les chiffres visible avant une decision.
- Contenu : identite WealthPilot, foyer/compte, periode ; recherche et confidentialite a droite.
- Geometrie : header naturel, controle 44 px ; deux lignes mobile si necessaire, jamais texte coupe.
- Variantes : foyer/compte, periode globale/page, lecture seule pendant mutation non interruptible.
- Interaction : changement de compte conserve les filtres compatibles, retire ceux incompatibles avec message bref ; la periode reste visible dans chaque module independant.
- Etats : aucun compte, plusieurs comptes, source ancienne, chargement du nouveau perimetre et erreur.
- Test : annuler le choix ne change rien ; tous les modules suivent le meme perimetre ; focus revient au choix.

### C02 / Navigation / Dock

- Role : aller vers une destination ; pas concentrer aussi assistant, import, notifications et profil.
- Proprietes : destination active, items livres, viewport, popover Plus.
- Icones Lucide ; libelle visible. `aria-current=page` sur la destination active. Navigation faite de liens, pas de boutons imitant des liens.
- Etats : normal, hover, focus, actif ; pas de mise a l'echelle ; indicateur actif a taille fixe.
- Clavier : Tab suit l'ordre ; Escape ferme Plus ; pas de raccourcis exclusifs pour une fonction essentielle.
- Test : aucun overflow a 320 px ; safe area ; zoom ; item actif identifie sans couleur seule.

### C03 / Data / Money et Metric

- Money : montant, devise, precision, signe, confidentialite, nature et date de source.
- Format `fr-FR` ; 2 decimales en table/detail ; 0 ou 2 pour une synthese selon precision declaree. L'approximation est marquee, jamais changee au hasard entre pages.
- Masquage : remplace la valeur par un placeholder de largeur stable ; pas seulement un flou qui laisse deviner les chiffres.
- Metric : libelle 13 px, valeur 28 px, source 12/14 px. Solde principal 36 px ; quatre petites cartes identiques maximum, et seulement si utiles.
- Etats : connu, estime, absent, ancien, erreur. Absent = tiret avec libelle, pas 0 EUR.
- Action : clickable uniquement s'il existe une liste source ; annoncer la destination.
- Mouvement : aucun compteur anime. Test : signe, arrondi, montant long, masquage sans changement de geometrie.

### C04 / Actions / Button et IconButton

- Variantes : primary, secondary, ghost, destructive ; une action primaire par zone de decision.
- Hauteur 44 px ; compact 36 sur desktop uniquement ; largeur icon-only 44 px.
- Etats : idle, hover, focus, pressed, pending, disabled. Pending conserve largeur et libelle ; interdit le double envoi.
- Icone pour l'outil, icone + texte pour la commande ; tooltip pour une icone non evidente, nom accessible toujours.
- Disabled n'est pas le seul moyen d'indiquer une erreur ; expliquer le requisito manquant au bon endroit.
- Mouvement : couleur 100 ms, aucun zoom. Test : activation clavier, pending, annulation, erreur, largeur fixe.

### C05 / Forms / Field, Select, Checkbox et SegmentedControl

- Champ : label associe, valeur, aide optionnelle, erreur inline, requis. Ne pas utiliser le placeholder comme label.
- Hauteur 44 px ; texte 14 px. Champ financier : signe explicite, devise, parse local strict et validation future.
- Segmented : modes exclusifs (jour/semaine/mois), jamais boutons decoratifs pour des options sans effet.
- Checkbox : choix binaire ; RadioGroup : option exclusive ; Switch seulement si l'effet est immediat et reversible.
- Etats : pristine, edited, invalid, saving, saved ; la valeur reste saisie apres echec.
- Test : clavier mobile decimal, message lie au champ, format francais, label long, error ne recouvre rien.

### C06 / Layout / BentoModule

- Geometrie : fill de son span ; padding 24/16 ; border 1 px ; radius 8 ; titre/action sur header, body, footer facultatif.
- Variantes : summary, chart, records, form, attention. Pas un style de carte different pour chaque page.
- Header ne devient pas cliquable s'il contient d'autres actions. Les actions ont leur propre cible.
- Les modules se reordonnent selon la priorite mobile, pas seulement selon l'ordre visuel desktop.
- Etats : skeleton statique conservant la hauteur, empty contextualise, error local avec retry, incomplete non bloqueur.
- Test : longue liste, titre sur deux lignes, erreur, aucun nested card, absence de saut entre loading et donnees.

### C07 / Data / TransactionTable et TransactionList

- Desktop : table semantique, header 44 px, lignes 56 px ; compact 44 facultatif apres validation.
- Colonnes coeur : selection, date, marchand, categorie, compte/payeur, statut, montant, actions. Montants alignes a droite.
- Mobile : liste 72 px minimum, marchand/categorie/compte et montant ; date groupee, action detail 44 px ; selection distincte.
- Filtres et totals appartiennent au module d'historique ; ils ne flottent pas dans cinq cartes independantes.
- Tri stable, selection groupable, pagination/virtualisation concues sans faire disparaitre le focus. Pas de largeur auto selon le montant le plus grand a chaque rendu.
- Cliquer la checkbox ne doit pas ouvrir le detail. Le lien du marchand ouvre le panneau ; pas uniquement double-clic ou hover.
- Etats : vide, aucun resultat, selection, filtre, pending mutation, erreur et ancienne source.
- Test : lignes justifiant les totaux, clavier, 10 000 lignes pour la future tranche, textes longs et conservation du scroll.

### C08 / Data / FilterToolbar

- Recherche, periode et compte dans le contexte defini ; filtres complementaires dans un menu, chips actifs et reset visible.
- Mobile : une ligne recherche, une ligne commandes ; aucune barre horizontale debordant du document.
- Recherche differée si necessaire ; la liste garde sa geometrie et le focus. Distinguer total de la periode et total filtre.
- Interaction : suppression d'un chip ciblee ; tout reinitialiser conserve le compte global et la periode selon le contrat de page.
- Test : filter zero results, reset, historique navigateur, partage d'URL sans libelle bancaire sensible.

### C09 / Charts / FinancialChart

- Proprietes : question, unite, serie, perimetre, periode, source, opening balance, date de coupure, precision et politique de statuts.
- Solde : ligne droite ou step, pas une courbe lisse suggerant des soldes intermediaires fictifs. Barres pour flux de periode.
- Reel plein ; prevu pointille ; zone d'incertitude seulement si calculee et expliquee. Les axes ne disparaissent pas pour faire joli.
- Tooltip : date complete, valeurs exactes, statut et lien vers les operations ; table alternative accessible.
- Crosshair immediat, selection clavier et touch persistante jusqu'au prochain choix/Escape. Pas de hover obligatoire sur mobile.
- Etats : loading statique, absence de donnees, couverture partielle, ancien, error et donnees extremes.
- Test : premier point avec solde initial, jour sans operation, changement de periode, donnees negatives, marque prevu distincte ; aucun mouvement des valeurs lors du rendu.

### C10 / Overlay / DetailPanel

- Desktop : panneau lateral 440 px, limite a la place disponible ; preferer un detail en colonne lorsque l'espace permet de garder l'historique utile.
- Mobile : panneau plein ecran avec header et footer fixes, body seul scrollable et safe area ; pas un petit modal au milieu.
- Header : titre + fermeture 44 px dans une colonne reservee ; padding 24/16. Body idem. Footer separation + actions, jamais a bord zero.
- Observation du contenu avant edition ; edition explicite. Champs originaux separes des corrections. Changements non enregistres signales.
- Annuler restaure ; enregistrer ne ferme qu'apres succes ; echec garde valeurs et message. Fermer avec modifications demande confirmation courte.
- Radix ou equivalent eprouve pour focus/dialogue dans la nouvelle app, sans reprendre les anciens consommateurs.
- Test : ouvrir/fermer clavier, retour focus, date/montant, form error, long contenu, clavier virtuel, scroll bloque quand modal.

### C11 / Overlay / ConfirmDialog, Menu et Tooltip

- Confirmation : largeur max 400, texte concret, consequence et deux commandes ; destructive reservee a une destruction.
- Overlay 24 % maximum par defaut ; pas de flou du document. Le scrim peut monter uniquement si le contraste et le contexte l'exigent apres test.
- Menu : options d'un choix, max-height adaptee ; ouverture pres du declencheur, flip aux bords ; Escape et fleches.
- Tooltip : information complementaire seulement, accessible au focus ; aucun champ ou commande indispensable a l'interieur.
- Tests : focus initial sur annuler si destruction, ordre clavier, placement 320 px, fermeture et aucune succession de deux confirmations.

### C12 / Feedback / InlineStatus, Toast et EmptyState

- Succes non essentiel : toast bref au-dessus du dock ; erreur de saisie : inline ; erreur de stockage : banniere persistante.
- Suppression reversible : toast Annuler avec duree suffisante et alternative accessible ; pas efface avant confirmation de sauvegarde.
- EmptyState differencie premiere utilisation, filtre sans resultat, aucun evenement, source absente. Une seule action pertinente.
- `aria-live=polite` pour bilan ; assertive uniquement pour erreur bloquante. Ne pas relire chaque montant sur changement de crosshair.
- Test : aucun recouvrement du dock, message long, perte reseau, retry et focus conserves.

### C13 / Finance / BudgetEnvelope et AllocationEditor

- Enveloppe : libelle, budget, reel, restant ; barre avec echelle explicite. Si depassement, le montant reste visible et la barre indique ce cas.
- Mensuel/hebdomadaire sont des periodes, pas une multiplication arbitraire par 4. Report eventuel nomme.
- Allocation : modification d'une enveloppe, origine du financement, effet sur restant total ; simulation avant confirmation.
- Test : vide, budget zero, depassement, remboursement, perso/partage et aucune double consommation lors d'une compensation.

### C14 / Finance / RecurringItem, Occurrence et ReviewSuggestion

- Récurrent : nom, compte, montant fixe/variable, frequence, prochaine date, statut ; preuve de detection accessible.
- Suggestion n'est pas un abonnement actif. Confirmer, modifier ou rejeter ; rejet memorise dans le futur moteur neuf.
- Echeance distincte : attendue, rapprochee/payee, manquee, annulee. Annuler dans l'app ne resilie pas le service externe.
- Test : premier import, faux positif, changement de tarif, frequence annuelle, compte different et lien vers preuve.

### C15 / Finance / SharingLedger et Settlement

- Payeur != proprietaire du compte != beneficiaire. Part personnelle/partagee explicite.
- Methode 50/50, prorata confirme ou montant fixe ; detail par depense et solde de compensation date.
- Un reglement est un mouvement de compensation, pas une nouvelle depense de consommation.
- Test : arrondis en centimes, plusieurs payeurs, compte joint, correction d'une depense et zero apres reglement coherent.

### C16 / Import / Stepper, Preview et Reconciliation

- Page de travail, jamais modal de 5 etapes. Progression courte et responsive ; etape active accompagnee d'un titre.
- Selection du compte, fichier, controle et validation ; bilan et retour dans historique. Pas de redemarrage apres erreur recuperable.
- Montants, lignes ignorees, doublons possibles, dates et checkpoint presentes avant confirmation.
- Test : mauvaise banque, encodage, signe/date invalide, export chevauchant, solde contradictoire, annulation, reimport et bilan par compte.

### C17 / Planning / Scenario et Timeline

- Scenario = hypotheses, pas reel. Ouverture confirmee, revenus/charges dates, plancher et horizon toujours visibles.
- Comparaison sans modifier les donnees observees ; point bas date et compte a risque accessibles.
- Test : revenu retarde, charge avant salaire, compte manquant, hypotheses non confirmees et aucune promesse de "disponible sur" non calculee.

### C18 / Settings / SettingsSection et BackupPreview

- Sections en grille de modules, champs non imbriques en cartes ; recherche de reglages si le volume le justifie.
- Sauvegarde et restauration : apercu, perimetre, date/version, consequence de remplacer/fusionner, bilan.
- Test : sauvegarde vide, incompatible, mot de passe errone, restauration annulee et verification sur profil neuf dans la future app.

## 06. Mouvement : registre obligatoire

| Evenement | Mouvement | Motif | Test |
|---|---|---|---|
| Changement de destination | Aucun | La lecture et le retour historique doivent etre immediats | Scroll/top et focus corrects, pas de flash blanc |
| Hover/focus commande | Couleur 100 ms, linear | Confirmer la cible sans bouger la geometrie | Bounds identiques avant/apres |
| Ouverture menu | Opacite 120 ms | Rendre la couche visible sans zoom | Etat final, Escape, collision aux bords |
| Ouverture panneau | Opacite + 16 px, 160 ms, ease-out | Exprimer une couche de detail liee a l'historique | Stable a mi-parcours et a la fin, pas de contenu coupe |
| Scrim modal | Opacite 120 ms jusqu'a 0.24 | Delimiter la modalite, conserver le contexte | Focus trap et retour focus |
| Valeur financiere modifiee | Aucun compteur | Un montant ne doit jamais passer par de fausses valeurs | Mise a jour atomique, numerals stables |
| Changement de serie graphique | Aucun tween | Ne pas inventer une trajectoire entre deux jeux de donnees | Tooltip/table concordent au premier rendu |
| Tri, filtre, selection | Aucun stagger | Rapidite et maintien du focus | Premier/dernier element, scroll, selection |
| Chargement de donnees | Skeleton statique | Eviter bruit perpetuel et simuler une geometrie realiste | Meme taille entre etats |
| Operation longue en cours | Progression mesuree, spinner seulement si necessaire | Signaler le travail reel | Pas de spinner apres succes/erreur |

`prefers-reduced-motion` : aucune translation, duree 0, pas de spinner rotatif ; un texte de progression remplace le mouvement. Les durations proviennent des tokens et ne sont pas inventees dans chaque composant.

Une animation n'est approuvee qu'apres tests reel desktop/mobile, interruption/fermeture pendant ouverture, double activation, focus, reduced motion et absence de layout shift. Tant qu'elle n'est pas testee, elle ne doit pas etre livree.

## 07. Parcours transversaux

### Consulter et comprendre

Ouvrir Aujourd'hui -> voir perimetre/date -> choisir un point du solde -> ouvrir les transactions justifiantes -> consulter le detail -> revenir sans perdre compte/periode/scroll. Pas de reset implicite.

### Corriger

Historique -> detail en lecture -> modifier -> validation inline -> enregistrer -> pending -> succes -> chiffre et ligne actualises. Echec -> valeurs conservees, erreur situee, recommencer. Fermer edited -> conserver ou abandonner.

### Importer dans la future tranche neuve

Comptes -> choisir compte -> importer -> controles -> revue ambiguities -> validation -> bilan -> historique filtre sur cet import. Compte joint et second compte proposent le meme parcours ; rien n'est classe d'office a partir d'un ancien algorithme.

### Premiere utilisation

Version UI de conception : jeu fictif explicitement identifie. Version quotidienne future : aucun compte -> creation -> solde date -> import neuf -> controles -> Aujourd'hui. Ne pas semer automatiquement des objectifs et comptes factices dans la base personnelle.

## 08. Matrice de validation et handoff

| Couverture | Maintenant, conception | Avant livraison du composant |
|---|---|---|
| Tokens | Contrastes calcules, valeurs uniques | Usage effectif, theme et police charges |
| Geometrie | Frames et planche 1440/390, controle 320/768/1920 | Screenshot reel, zoom 200 %, clavier virtuel |
| Etats | Matrice et specimens | Tests interaction loading/error/pending/retry |
| Animation | Duree/propriete/motif specifies | Tests temporels, interruption, reduced motion |
| Finance | Semantique des libelles et cas limites | Moteur neuf teste, valeurs identiques entre vues |
| Accessibilite | Ordre, noms, contraste et interactions specifies | Axe, clavier, VoiceOver et focus tests |
| Persistance | Regles de retour/resume definies | Reload, restauration et mutations reactives |

La planche n'est ni un moteur financier ni une certification des ecrans futurs. Les controles executes sur cette planche sont consignes dans le referentiel ; les tests des composants futurs restent une porte de livraison obligatoire.

Handoff minimum : nom du composant, variantes actives, dimensions, sources des donnees, contrat de mutation, etats, exemple long/vide/erreur, et protocole de test. Sans ces elements, un composant n'est pas "pret a coder".