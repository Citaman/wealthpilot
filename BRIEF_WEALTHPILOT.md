# Brief WealthPilot

Mis à jour le 5 octobre 2026. **Décisions actives : section 25 pour le périmètre et la refonte ; section 26 pour le shell sans header et le dock contextuel approuvé.** Elles remplacent les décisions contradictoires des sections précédentes. Les anciennes notes 95/100 ou 100/100 ne valent pas validation du produit : l’utilisateur a rejeté son utilisation et son rendu. Ma semaine doit d’abord faire l’objet de dix propositions en images, puis d’un choix utilisateur avant implémentation.

## 1. La décision

WealthPilot repart sur une application neuve. Le code historique et le prototype du 30 septembre sont **en attente, comme références**, pas des fondations à prolonger. Les données personnelles sont conservées. Aucune suppression de données, migration de navigateur ni modification du moteur n'est réalisée par ce brief.

Un seul document pilote désormais la refonte : celui-ci. Les anciens briefs, roadmaps et planches de composants restent des archives consultables. En cas de contradiction, les règles fonctionnelles ci-dessous priment sur leurs textes et sur les chiffres dessinés dans les images.

L'objectif est de répondre, chaque semaine, à ces questions : combien puis-je encore dépenser, quelles charges arrivent, quel compte doit être approvisionné, où en sont mes projets et que puis-je ajuster avant de passer dans le rouge ? Il ne s'agit ni d'une application de crypto ni d'un tableau de patrimoine décoratif.

Le premier chantier est le dashboard. La V0 n'est toutefois utilisable qu'avec l'import, l'historique, les comptes, les budgets et la sauvegarde. La V1 réunit les 14 espaces définis ci-dessous et les 30 composants fonctionnels. Une page absente d'une version n'a pas de faux bouton actif.

## 2. Ce qui existe réellement

| Ensemble | Observation au 2 octobre | Décision |
| --- | --- | --- |
| Application racine, `src/` | Next 16.1.3, React 19.2.3, Dexie, Recharts, TypeScript ; version package 0.15.0, badge README 0.14.6 | Maintenir comme référence historique, ne pas développer la nouvelle interface dedans |
| Métier historique | Import CSV, catégorisation, doublons, transferts, budgets, objectifs, récurrences, prévisions, sauvegardes | Extraire les cas de test utiles ; réécrire et revalider les contrats, pas recopier aveuglément |
| `specs/rebuild/` | Prototype HTML/JS autonome, stockage localStorage distinct de l'ancien IndexedDB, neuf destinations | Mettre en attente ; conserver les enseignements et tests, abandonner le rendu global |
| `/lab`, essais et anciens styles | Plusieurs variantes concurrentes | Hors produit, ne pas les exposer dans la nouvelle navigation |
| `design/rime-direction-2026-10-02/` | Direction visuelle récemment approuvée | Référence esthétique principale |
| `design/component-sheets-rime-2026-10-02/` | 30 planches de composants | Références visuelles, pas preuve de fonctionnement ni vérité comptable |
| Anciens briefs et roadmaps | Vocabulaire, priorités et états parfois contradictoires | Bannière historique et renvoi ici, pas suppression |
| Données financières | CSV et classeurs dans les dossiers voisins | Sources privées à reprendre avec contrôle, jamais assets de démonstration |

L'application historique expose aujourd'hui `/`, transactions, plan, analytics, budgets, goals, subscriptions, calendar, accounts, categories, import et settings, avec un détail d'objectif et des laboratoires. Cela indique une couverture de code, **pas une validation de tous les parcours**.

Vérification effectuée pendant cet audit : `npx --no-install vitest run` termine avec 24 fichiers de tests réussis, 111 tests réussis et 1 ignoré. Les 16 tests de domaine du prototype en font partie. Aucun nouveau contrôle navigateur, build de production ni audit exhaustif d'accessibilité n'a été exécuté ici. Les anciens comptes rendus Playwright restent datés de leur exécution.

Le prototype appelle un rendu général après une mutation et remplace le contenu principal via `innerHTML`, puis tente de réutiliser les graphiques et de restaurer les formulaires. Cette structure est un risque pour le focus et les transitions. Elle ne constitue pas une reproduction ni une cause démontrée de chaque bug signalé. Le nouveau contrat interdit ce remplacement global.

Le dépôt était déjà modifié avant l'audit, notamment package.json, son verrouillage, ESLint et plusieurs dossiers non suivis. Ces changements sont préservés. Le ménage de cette étape est **documentaire et réversible** : aucune ancienne implémentation n'est effacée ou déplacée.

## 3. Sources à reprendre et limites de confiance

Sources locales identifiées, sans publier les opérations personnelles :

| Source | Contrôle effectué | Traitement prévu |
| --- | --- | --- |
| `../data/transactions_2026_consolidated.csv` depuis ce dépôt | 1 385 lignes, 15 colonnes, aucun défaut de parsing signalé | Candidat principal, à rapprocher de soldes réellement observés |
| `/Users/anthonny.olime/Personal_Repos/Perso/life_os/outputs/01a0e797-2e9b-7f31-aafa-b1eabd44a61d/transactions_2026_consolidated.csv` | Même contenu binaire que le précédent | Une seule source, pas 2 770 opérations |
| `/Users/anthonny.olime/Personal_Repos/Perso/life_os/data/import_2026-06-06_bank_transactions.csv` | 255 lignes, 13 colonnes, parsing sans erreur | Vérifier le recouvrement avec le consolidé |
| `/Users/anthonny.olime/Personal_Repos/Perso/life_os/data/import_2026-04-28_bank_transactions.csv` | 58 lignes, 13 colonnes, parsing sans erreur | Même contrôle, ne pas additionner aveuglément |
| `life_os/budget_famille_partage_2026.xlsx` et classeurs dans le dossier outputs ci-dessus | Fichiers repérés, pas recalculés dans cet audit | Sources de règles et rapprochement, jamais écrasement automatique du ledger |

Les deux consolidés ont l'empreinte SHA-256 `3becc12db2a61e42a4dd8f60b402fff457db3e9f600f58385584e131be320053`. Leurs colonnes incluent compte, date, montant, sens, commerçant, catégories, caractère récurrent/interne, solde journalier, libellé, détail et source.

Un parsing réussi ne prouve ni la complétude ni l'exactitude d'un solde. Le champ `daily_balance` peut provenir d'une reconstruction. Il faut saisir ou importer un **solde observé daté**, connaître la couverture des opérations et afficher les écarts. Ne jamais inventer un solde initial nul pour prétendre que le compte est réconcilié.

Les données IndexedDB du navigateur et le localStorage du prototype ne sont pas contenues dans les fichiers du dépôt. Leur sauvegarde et migration restent à faire avec export explicite. Notion n'a pas été inspecté : les sources locales suffisent à préparer la reprise, sans élargir l'accès aux données privées.

## 4. Expérience et direction visuelle

Direction par défaut : crème chaud #EEE8DA, charbon #25221D, jaune #F3C447, rose #E68BDC, cyan #21A9C0. Gros montants et titres condensés, libellés techniques monospace, texte courant lisible. Modules arrondis, bordures franches, graphiques plats, boutons en capsule. Pas de glassmorphism, de dégradés systématiques, de photographies d'iPhone/maison ni de grands espaces inutiles.

La couleur d'une catégorie reste stable entre les vues ; positif/négatif ne repose jamais uniquement sur la couleur. Les montants sont tabulaires, localisés en français et alignés. La police condensée n'est pas utilisée pour les longs tableaux. Contraste, focus et cibles tactiles doivent être vérifiés, pas supposés à partir des maquettes.

Navigation proposée : dock inférieur compact Dashboard, Historique, Budgets, Prévisions, Plus. Plus ouvre les autres destinations avec recherche. En V0, une destination non livrée est absente du dock. Le haut contient marque, contexte foyer/période/comptes, fraîcheur et action principale. Aucun menu permanent ne réduit toute la largeur de travail. Le dock ne masque jamais la dernière ligne : espace réservé et prise en compte des zones sûres.

Desktop : grille de 12 colonnes, modules reconfigurables. Tablette : 8 colonnes. Mobile : une colonne avec ordre explicite, représentation simplifiée et accès au détail. Une longue page desktop ne doit pas devenir une image miniature sur téléphone. Les maquettes longues montrent un contenu défilant complet, pas tout ce qui doit tenir dans un écran.

## 5. Les pages et leur contrat

Les liens ci-dessous ouvrent les maquettes cibles. Elles décrivent la V1 ; la colonne de livraison indique le premier périmètre réellement prévu.

| N° | Page et maquette | Route cible | Livraison | But |
| --- | --- | --- | --- | --- |
| 01 | [Dashboard](design/pages-v1-2026-10-02/01-dashboard.png) | `/` | V0 | Solde, disponible semaine et mois, grand graphique réel/prévision, budgets, échéances et opérations récentes. Vue personnalisable. |
| 02 | [Historique](design/pages-v1-2026-10-02/02-historique.png) | `/transactions` | V0 | Rechercher, filtrer, corriger, rapprocher et catégoriser les opérations sans perdre le contexte. |
| 03 | [Budgets](design/pages-v1-2026-10-02/03-budgets.png) | `/budgets` | V0 | Allouer les enveloppes, suivre dépensé et engagé, simuler une réallocation. |
| 04 | [Prévisions et scénarios](design/pages-v1-2026-10-02/04-previsions.png) | `/previsions` | V0.2 | Projeter la trésorerie et comparer des hypothèses sans modifier le réel. |
| 05 | [Objectifs](design/pages-v1-2026-10-02/05-objectifs.png) | `/goals` | V0.1 | Financer des projets et arbitrer leur effort d’épargne. |
| 06 | [Récurrents](design/pages-v1-2026-10-02/06-recurrents.png) | `/recurrents` | V0.1 | Valider les récurrences détectées et suivre les prochaines occurrences. |
| 07 | [Calendrier](design/pages-v1-2026-10-02/07-calendrier.png) | `/calendar` | V0.2 | Lire les échéances et leur effet quotidien sur les comptes. |
| 08 | [Comptes](design/pages-v1-2026-10-02/08-comptes.png) | `/accounts` | V0 | Réconcilier les soldes observés, organiser le périmètre et préparer les virements. |
| 09 | [Foyer et répartition](design/pages-v1-2026-10-02/09-foyer.png) | `/foyer` | V0.3 | Répartir les charges et calculer les comptes à approvisionner. |
| 10 | [Analyse](design/pages-v1-2026-10-02/10-analyse.png) | `/analytics` | V0.3 | Explorer les dépenses, leurs évolutions et leurs exceptions. |
| 11 | [Import et qualité des données](design/pages-v1-2026-10-02/11-import.png) | `/import` | V0 | Importer, contrôler et annuler un lot sans perdre les corrections. |
| 12 | [Catégories et règles](design/pages-v1-2026-10-02/12-categories.png) | `/categories` | V0.3 | Organiser la classification et tester les règles avant application. |
| 13 | [Réglages et données](design/pages-v1-2026-10-02/13-reglages.png) | `/settings` | V0 puis V1 | Configurer les conventions, sauvegarder, restaurer et gérer la confidentialité. |
| 14 | [Bibliothèque et personnalisation](design/pages-v1-2026-10-02/14-bibliotheque.png) | `/library` | V0 puis V1 | Choisir les widgets, leurs sources, leurs représentations et les vues enregistrées. |

### 5.1 Dashboard

Ordre initial : fraîcheur et contexte ; évolution du solde avec futur clairement séparé ; disponible semaine/mois ; enveloppes ; échéances et actions ; opérations récentes ; objectif choisi. Ne pas placer les 30 composants par défaut.

Changer la période ou les comptes met à jour seulement les widgets qui héritent de ce contexte. Cliquer sur une catégorie ouvre l'historique filtré ; revenir conserve le scroll et la vue. « Voir le calcul » montre les éléments composant le disponible. Les alertes sont des faits expliqués avec une action, pas un score mystérieux.

Personnaliser ouvre un mode explicite : ajouter, déplacer, redimensionner, dupliquer, retirer, annuler et enregistrer une vue. Le mode lecture ne présente pas de poignées permanentes. Retirer un widget ne supprime aucune donnée. Sans données, guider vers import et solde initial ; ne pas afficher une santé financière verte fictive.

### 5.2 Historique

Table recherchable : date, commerçant, catégorie, compte, montant, statut et provenance. Filtres combinables, tri, sélection multiple, total du périmètre et nombre de résultats. Éditeur latéral sans perdre la sélection ni la position. Montrer séparément libellé bancaire brut et commerçant normalisé.

Actions : correction, ventilation d'une opération, exclusion analytique motivée, rapprochement d'un transfert, affectation manuelle et règle proposée. Une ventilation conserve exactement le total original. Une correction manuelle est protégée des prochaines règles/imports. Supprimer une ligne importée demande confirmation et traçabilité ; préférer exclure/corriger selon le cas.

Les icônes suivent commerçant reconnu puis sous-catégorie puis symbole générique. Aucun libellé privé n'est envoyé à un service de recherche. Un catalogue de marques local et une substitution manuelle suffisent à la V0 ; récupération distante de logos uniquement avec consentement et domaine validé, mise en cache et repli hors ligne.

### 5.3 Budgets

Enveloppes par période avec alloué, dépensé, engagé et restant. Vues liste, barres ou anneaux, même calcul. La version anneaux ne mélange pas des pourcentages aux dénominateurs différents sans légende.

Éditer une limite ou déplacer une somme entre enveloppes ouvre un aperçu des conséquences : disponible, rythme, projection et objectifs concernés. Enregistrer produit une mutation atomique ; annuler ne touche pas les données. Les reports et budgets hebdomadaires sont explicites. Le budget hebdomadaire peut être autonome ou issu d'une répartition mensuelle choisie, jamais d'une division implicite par quatre.

### 5.4 Prévisions et scénarios

Horizon 7 jours, fin de mois ou 13 semaines ; réel jusqu'à la date de référence puis projection. Montrer dates des revenus attendus, charges, essentiels estimés, apports projets et seuil de sécurité. Point bas, date et compte à risque priment sur une seule valeur de fin de mois.

Une hypothèse modifiée crée une simulation, pas une opération bancaire. Comparer scénario et référence, nommer/enregistrer/dupliquer ; appliquer une hypothèse au plan exige une action distincte avec impact visible. Incertitude de date/montant représentée, pas promesse de solde futur garanti.

### 5.5 Objectifs

Liste priorisée et détail dans la page : cible, montant affecté, reste, échéance souhaitée, effort, historique des contributions et comptes supports. Représentations jauge, barre, chiffres ou chronologie ; aucune image produit obligatoire.

Affecter de l'argent à un objectif réserve une partie du cash, cela ne crée ni revenu ni mouvement bancaire. Un versement réellement transféré et son affectation ne doivent pas compter deux fois. Date estimée seulement si hypothèse d'effort valide ; sinon « À définir ». Un achat confirmé clôture ou réduit le projet selon choix explicite.

### 5.6 Récurrents

Deux espaces séparés : engagements confirmés et suggestions détectées. Une suggestion indique opérations source, cadence et variations. Accepter crée une règle ; refuser la masque sans supprimer les opérations. Prévoir montant variable, date décalée, occurrence ignorée et fin de contrat.

Rapprocher l'occurrence payée avec l'opération réelle remplace le prévisionnel au lieu de l'ajouter. « Arrêter le suivi » ne signifie jamais résilier chez le fournisseur. Un montant ou une date modifiés affectent les futures occurrences sélectionnées, pas l'historique silencieusement.

### 5.7 Calendrier

Mois, semaine et agenda ; revenu, dépense, objectif et événement de scénario différenciés. Cliquer sur un jour révèle les événements et le solde projeté par compte. Les jours sans mouvement restent lisibles.

Déplacer une échéance simulée peut modifier un scénario ; déplacer une opération bancaire est interdit comme simple glisser-déposer. Toute modification de date réelle passe par correction avec provenance. Les dates échues non rapprochées deviennent « À vérifier », pas automatiquement payées.

### 5.8 Comptes

Comptes du foyer, type, propriétaire, devise, inclusion dans le disponible et solde observé daté. Vue rapprochement : observé, calculé, différence, couverture et dernière importation. Corriger un checkpoint explique le changement d'historique de solde.

Préparer un virement signifie afficher origine, destination, somme et date conseillée ; WealthPilot ne l'exécute pas. Un virement interne a deux côtés liés : aucun revenu/dépense au total foyer, mais effet sur chaque compte. Une moitié absente reste à rapprocher. Archiver un compte conserve son historique.

### 5.9 Foyer et répartition

Membres, charges, payeur, bénéficiaires et règle de partage : égalitaire, fixe ou proportionnelle à des revenus explicitement fournis. Aucune règle 50/50 imposée. Prévisualiser un changement de règle sur les charges futures ; l'historique reste stable sauf recalcul demandé et traçable.

Distinguer consommation du foyer, avance d'un membre et remboursement entre membres. Afficher qui doit approvisionner quel compte avant quelle échéance. La V1 reste locale : représenter plusieurs membres ne crée pas des comptes utilisateurs synchronisés ni des permissions serveur.

### 5.10 Analyse

Répartition, rythme, comparaison de périodes et opérations atypiques avec sources visibles. Choix mesure, granularité, période, catégories et comptes. Une dépense exceptionnelle reste explicable, pas étiquetée comme mauvaise sans contexte.

Comparaison à durée comparable ; signaler un mois incomplet. Un clic filtre le détail ou un groupe de widgets explicitement lié, jamais toute l'application par surprise. Exporter seulement le périmètre indiqué. Aucune corrélation présentée comme causalité.

### 5.11 Import et qualité

Parcours complet décrit en section 8. L'écran contient progression, profil de colonnes, erreurs, doublons, aperçu et historique des lots. Reprendre un brouillon sans réimporter. Le bouton final annonce le nombre exact d'opérations, d'ignorées et de décisions restantes.

La V0 accepte les CSV testés et le mapping manuel. XLSX est prévu ensuite, avec sélection explicite des feuilles et mêmes contrôles. L'export consolidé n'est pas présumé être un export bancaire brut.

### 5.12 Catégories et règles

Arborescence modifiable : catégorie, sous-catégorie, icône, couleur et statut. Archiver préserve les références ; fusionner annonce les budgets et opérations touchés. Les identifiants restent stables malgré un renommage.

Règles ordonnées : conditions lisibles, priorité, résultat, test sur échantillon et aperçu d'impact. Une nouvelle règle ne réécrit pas automatiquement toutes les corrections humaines. Simuler, sélectionner le périmètre puis appliquer. Suggestions automatiques toujours réversibles.

### 5.13 Réglages et données

Période financière, devise, fuseau, format, densité, mouvement réduit, sauvegarde, restauration, stockage et confidentialité. Changer la convention de mois montre les budgets concernés avant confirmation, sans déplacer les dates réelles.

Exporter une sauvegarde versionnée ; vérifier une restauration dans un espace temporaire puis remplacer seulement après confirmation et sauvegarde de sécurité. Le chiffrement doit être testé ; ne pas promettre une récupération de mot de passe inexistant. Local ne signifie ni sauvegardé ni chiffré au repos.

Migration de l'ancien IndexedDB et du prototype : lecteur/export indépendant, audit à blanc, rapport des différences, nouveau stockage séparé, ancien laissé intact. Effacement intégral dans une zone distincte, périmètre explicite et confirmation renforcée.

### 5.14 Bibliothèque et personnalisation

Catalogue de 30 composants avec finalité, aperçu, tailles disponibles et source requise. Ajouter une instance indépendante ; sélectionner taille, représentation, données et interaction de sortie. Les tailles impossibles ne sont pas proposées comme fonctionnelles.

Le panneau configure héritage du contexte ou filtre local, source, mesure, période, catégorie, visualisation et liens entre widgets. Les sorties sont des actions typées : ouvrir un détail, émettre une sélection à un groupe lié ou lancer une commande confirmée. Pas de code arbitraire ou de formules exécutables en V1.

Une vue enregistre disposition, paramètres, ordre mobile et identifiants d'instances, pas une copie figée des données. Enregistrer sous un nom, dupliquer, revenir aux réglages par défaut, annuler l'édition et exporter/importer la configuration. Les widgets privés d'une source affichent une réparation guidée.

## 6. Le contrat des 30 composants

T = tiny, S = small, M = medium, L = large, XL = extra-large. La taille augmente l'information utile, pas simplement les pixels. T donne une réponse ; S ajoute tendance et statut ; M donne contexte et interaction ; L expose détail/filtrage ; XL devient un espace d'analyse. À contenu égal, les variantes large ou haute adaptent l'organisation. Le viewport peut imposer une représentation mobile sans modifier la préférence desktop.

| ID | Composant | Défaut ; tailles | Représentations autorisées au défaut | Données et action principale |
| --- | --- | --- | --- | --- |
| 01 | Solde du foyer | M ; T–XL | Montant, comptes empilés | Checkpoints + ledger ; ouvrir comptes |
| 02 | Disponible semaine | S ; T/S/M/L | Chiffre, barre | Allocation et consommé semaine ; voir calcul |
| 03 | Reste à vivre mois | M ; T–XL | Montant expliqué, cascade | Cash moins engagements/réserves ; détails |
| 04 | Évolution du solde | L ; S/M/L/XL | Courbe, aire, petits multiples | Historique/projection ; date et séries |
| 05 | Point bas prévisionnel | S ; T/S/M/L | Alerte chiffrée, mini-courbe | Projection ; ouvrir jour/compte |
| 06 | Revenus et dépenses | M ; S/M/L/XL | Barres, deux tendances | Flux externes ; détailler période |
| 07 | Budget par catégorie | L ; S/M/L/XL | Liste, barres, anneaux | Enveloppes/consommé/engagé ; ajuster |
| 08 | Puis-je dépenser | M ; S/M/L/XL | Simulateur compact, avant/après | Somme/catégorie/date ; simuler uniquement |
| 09 | Prochaines échéances | M ; T–XL | Liste, chronologie | Occurrences non rapprochées ; vérifier |
| 10 | Scénarios du mois | L ; M/L/XL | Courbes comparées, tableau | Hypothèses ; comparer/enregistrer |
| 11 | Objectif en vedette | M ; T–XL | Arc, barre, chiffres | Cible et affectations ; contribuer |
| 12 | Tous mes objectifs | M ; S/M/L/XL | Liste, cartes, barres | Projets ; choisir/prioriser |
| 13 | Date d'achat estimée | S ; T/S/M/L | Date expliquée, horizon | Reste/effort ; ajuster hypothèse |
| 14 | Effort d'épargne | M ; M/L/XL | Curseur et résultat, tableau | Cible/date/disponible ; simuler |
| 15 | Fonds de sécurité | S ; T/S/M/L | Barre, jauge | Réserve/cible ; expliquer protection |
| 16 | Répartition des comptes | M ; S/M/L/XL | Barres, liste, anneau | Soldes et périmètre ; compte |
| 17 | Charges du foyer | M ; S/M/L/XL | Liste, empilement | Obligations/règles ; modifier |
| 18 | Compte à approvisionner | M ; T/S/M/L | Proposition, chronologie | Prévision par compte ; préparer transfert |
| 19 | Qui a payé quoi | M ; S/M/L/XL | Barres, matrice | Payeurs/bénéficiaires ; détail |
| 20 | Épargne des projets | M ; S/M/L/XL | Empilement, liste | Affectations sans double compte ; arbitrer |
| 21 | Transactions récentes | L ; S/M/L/XL | Tableau, liste groupée | Ledger filtré ; corriger/détailler |
| 22 | À catégoriser | M ; T–XL | File de revue, liste | Non classées/suggestions ; accepter/refuser |
| 23 | Abonnements | M ; T–XL | Liste, prochaines dates | Engagements confirmés ; suivi |
| 24 | Répartition dépenses | M ; S/M/L/XL | Barres, anneau, treemap accessible | Flux catégorisés ; drilldown |
| 25 | Rythme de dépenses | M ; S/M/L/XL | Courbe cumulée, barres hebdo | Réalisé/plafond ; période |
| 26 | Dépense inhabituelle | S ; T/S/M/L | Alerte, comparaison | Écart explicable ; inspecter |
| 27 | Comparaison des mois | M ; S/M/L/XL | Barres, tableau, tendances | Périodes comparables ; filtres |
| 28 | Source et fraîcheur | S ; T–XL | Statut, couverture | Lots/checkpoints ; importer/réconcilier |
| 29 | Configurer un widget | L ; M/L/XL | Formulaire avec aperçu | Configuration d'instance ; appliquer/annuler |
| 30 | Bibliothèque et vues | XL ; S/M/L/XL | Catalogue, vues enregistrées | Registre/configurations ; ajouter/restaurer |

Les composants 29 et 30 sont des outils d'édition, pas des montants financiers du dashboard. Les variantes restent interchangeables sans perdre sélection ou filtres. Une représentation ne change pas la définition de la mesure. Pour une petite taille, masquer les contrôles secondaires dans un menu accessible, jamais un montant essentiel.

Chaque composant doit posséder : identifiant stable, configuration versionnée, schéma d'entrée, résultat calculé avec provenance, actions autorisées, tailles, état vide/chargement/erreur/périmé, rendu accessible et tests. Les planches historiques détaillent des pistes esthétiques ; l'implémentation exige une fixture vérifiée pour chaque taille et variante.

## 7. Modèle de données et calculs

Montants stockés en centimes entiers et devise explicite. Une seule convention de signe interne. Date comptable, date de valeur et instant d'import sont distincts ; les dates civiles bancaires ne doivent pas glisser avec le fuseau. Pas de somme multidevise sans taux daté et mode explicite ; V0 limitée aux comptes EUR.

Entités minimales : compte, checkpoint, opération brute, opération normalisée, ventilation, lot d'import, rapprochement, catégorie, règle, budget, récurrence, occurrence, objectif, affectation, membre, règle de partage, scénario, configuration de widget et vue. Les fichiers sources restent immuables ; les corrections ont leur propre historique.

Définitions canoniques :

- Solde calculé = checkpoint observé + mouvements postérieurs couverts. Afficher date de référence et couverture ; absence de checkpoint = solde non confirmé.
- Dépense consommée = flux externes éligibles, nets des remboursements liés selon convention. Transferts internes exclus ; aucun doublon entre ligne mère et ventilations.
- Restant enveloppe = alloué + report validé − consommé − engagé non encore payé.
- Reste à vivre = cash disponible du périmètre − obligations non payées sur l'horizon − essentiels restant à financer − réserves projets − réserve de sécurité. Une somme réservée porte une affectation unique, pour ne pas être soustraite deux fois.
- Disponible semaine = allocation hebdomadaire choisie − consommation − engagements de cette semaine. Ce n'est ni tout le solde ni automatiquement le reste du mois.
- Prévision = solde confirmé + flux futurs du scénario, avec remplacement des événements par leur réalisé rapproché. Point bas calculé par jour et par compte, puis au niveau foyer.
- Objectif = affectations nettes/cible. Une affectation n'est pas une nouvelle entrée de trésorerie.

Le détail du calcul est consultable partout. Si une donnée indispensable manque, afficher « À confirmer » et expliquer, pas zéro. Garder une estimation visible avec ses hypothèses est possible, mais elle ne doit pas être confondue avec du confirmé.

Jeu de démonstration fictif commun : cash 4 820 € = 3 120 + 1 700 ; disponible mensuel 1 250 € = 4 820 − 2 140 charges restant dues − 480 essentiels − 350 projets − 600 sécurité ; semaine 290 € = 400 − 110 ; point bas 940 €, seuil 600 €, marge 340 € ; fin de mois 2 180 €. Objectif : 780/1 200 = 65 %, reste 420 €. Enveloppes : 1 000 alloués, 650 consommés, 50 engagés, 300 restants. Ces exemples sont indépendants lorsqu'ils décrivent des périmètres différents ; l'interface doit les nommer.

## 8. Import hebdomadaire et migration

1. Sélectionner le fichier local ; empreinte, taille, encodage, séparateur, en-têtes et aperçu. Aucun envoi serveur.
2. Reconnaître un profil déjà validé ou proposer un mapping : date, libellé, débit/crédit ou montant signé, compte, devise et éventuellement solde. Toujours permettre la correction.
3. Valider chaque ligne : date ambiguë, décimales françaises, champs vides, signe, compte inconnu, encodage et doublons internes au fichier. Une ligne invalide est isolée avec motif, pas perdue.
4. Distinguer fichier déjà importé, opération exactement identique et ressemblance probable. Deux achats identiques le même jour peuvent être réels : ne pas les fusionner automatiquement.
5. Proposer catégories, commerçants, transferts et récurrences avec provenance. Les corrections humaines restent prioritaires. Détection n'est pas décision.
6. Afficher nouvelles, ignorées, à vérifier, erreurs et effet attendu sur comptes/période. L'utilisateur choisit le traitement des lignes litigieuses.
7. Enregistrer le lot et ses opérations dans une transaction atomique ; échec = aucun demi-import. Progression et annulation avant commit pour les gros fichiers.
8. Recalculer les seules dépendances affectées ; afficher bilan, écarts de rapprochement et prochaines actions. Conserver le lot, sa configuration et ses décisions.
9. Annuler un lot par compensation contrôlée : prévisualiser corrections, rapprochements et affectations dépendants ; ne jamais effacer des modifications ultérieures sans traitement explicite.
10. La semaine suivante, réutiliser le mapping et reconnaître le recouvrement ; ne pas remplacer toute la base par le nouveau CSV.

Prévoir protections contre fichiers excessifs, archive malformée pour XLSX, HTML dans les cellules, noms de fichiers suspects et formules actives lors d'un export CSV. Les exports utilisent une représentation sûre pour les tableurs.

Migration : sauvegarde indépendante des deux anciens stockages, copie des sources hors dépôt, import à blanc dans une nouvelle base, comparaison des comptes/lignes/totaux/écarts, validation utilisateur puis bascule. Conserver l'ancien accès jusqu'à validation et restauration testée. Pas de lecture magique de données d'une autre origine de navigateur.

## 9. Des interactions rapides et prévisibles

Trois couches distinctes : état de présentation (onglet, taille, graphique), contexte de lecture (période, comptes, filtre), commandes métier (corriger, affecter, importer). Une sélection visuelle ne doit jamais écrire dans le ledger. Une commande validée crée une révision cohérente ; les widgets concernés lisent cette révision sans mélange de résultats anciens et nouveaux.

| Action | Doit évoluer | Doit rester intact |
| --- | --- | --- |
| Liste → anneaux sur Budget | Rendu de cette instance | Données, autres widgets, scroll |
| Changer période globale | Widgets héritant de la période | Widgets à période locale, formulaires ouverts |
| Recatégoriser une opération | Historique, budgets, analyse, consommé et projections concernés | Soldes bancaires, objectifs sans lien |
| Modifier une enveloppe | Restant, simulation et indicateurs dépendants | Opérations et solde réel |
| Confirmer une récurrence | Occurrences, calendrier, projection, disponible | Historique réellement payé |
| Affecter à un objectif | Projet, réserves, disponible | Cash total et revenus |
| Préparer un virement | Brouillon et simulation | Ledger et banque |
| Corriger checkpoint | Soldes et projections du compte/périmètre | Catégorisation, dépenses constatées |
| Importer un lot | Ledger et agrégats affectés, fraîcheur | Disposition, sélection encore valide, autres comptes |
| Redimensionner un widget | Dimensions et niveau de détail | Instance, données et autres animations |

Les groupes de widgets liés sont explicites et configurables. Un clic « Courses » peut sélectionner Courses dans un groupe nommé ; un bouton permet d'effacer cette sélection. Les autres pages ne conservent pas un filtre invisible.

Requêtes indexées, résultats dérivés mémorisés par paramètres et révision ; éviter un grand objet global recréé et relu pour tout. Calculs d'import/prévision lourds dans un worker, réponses identifiées et résultats obsolètes ignorés. Les corrections financières sont confirmées après commit ; une anticipation visuelle doit être réversible et ne pas annoncer un succès fictif.

## 10. Animation et stabilité

Pas de redémarrage à zéro à chaque clic. Une animation d'entrée ne joue qu'à la vraie création d'une instance ; un nouveau montant part de la valeur affichée ou change sans compteur animé. Interruption d'une transition = poursuite depuis l'état courant. Un clic répété ne crée pas une pile de transitions.

Identifiants de widget et de séries stables ; aucune clé React basée sur le montant, la date choisie ou un compteur de rendu. Conserver graphique, focus, scroll et brouillon lors d'une mise à jour. Les règles de conservation d'état reposent notamment sur la position et l'identité des composants, pas sur une reconstruction générale. [React, conservation et réinitialisation d'état](https://react.dev/learn/preserving-and-resetting-state).

Cibles proposées : retour de bouton 80–120 ms ; panneau 160–220 ms ; mise à jour de données 180–220 ms. Ce sont des paramètres à tester, pas des animations obligatoires. Pas de fondu de toute la page, pas de boucle décorative. Pendant resize/drag, ajuster la géométrie sans rejouer les courbes. Fin du geste : stabilisation unique. Mouvement réduit : pas de translation, morphing ou compteur, seulement changements immédiats et indicateurs nécessaires.

Chargement initial : squelette dimensionné. Actualisation : garder les données précédentes avec statut discret ; en cas d'échec, les marquer périmées et proposer réessayer. Ne jamais les présenter comme fraîches. Les lecteurs d'écran reçoivent un résumé utile, pas chaque variation de centime. Les graphiques disposent d'une alternative tabulaire.

## 11. Fondation technique proposée

Nouvelle application isolée proposée dans `apps/wealthpilot/`, nouveau stockage et nouvelles clés ; aucun import de code métier historique par défaut. L'application racine reste démarrable comme historique tant que la migration n'est pas validée. Cette séparation n'est pas encore créée.

Choix de départ à valider par une tranche verticale : React + TypeScript, Vite pour une application locale sans besoin de rendu serveur, Dexie/IndexedDB pour persistance transactionnelle, primitives accessibles et CSS à tokens, ECharts pour les graphiques. Ne pas ajouter un framework pour chaque interaction. Next n'est pas rejeté comme défectueux ; son rôle serveur n'est simplement pas nécessaire au périmètre local proposé. [Documentation Vite](https://vite.dev/guide/).

Les abonnements aux données doivent observer des requêtes ciblées ; Dexie fournit une observation réactive des requêtes, ce qui n'autorise pas à relire systématiquement toute la base dans chaque widget. [Dexie, useLiveQuery](https://dexie.org/docs/dexie-react-hooks/useLiveQuery()).

Le choix ECharts est motivé par ses mises à jour de séries par différences, à tester avec identités stables et dimensions réelles. La bibliothèque seule ne garantit pas l'absence de bugs. [ECharts, transitions](https://echarts.apache.org/handbook/en/how-to/animation/transition/).

Modules neufs : domaine/calculs purs ; stockage et migrations ; import/adaptateurs ; sélecteurs ; commandes ; registre de widgets ; pages ; design system. La grille, la table et les graphes n'hébergent pas leurs propres versions des formules.

Application locale sur une origine stable, assets embarqués, export de sauvegarde et restauration dès V0. Installation/offline complet à valider avant V1 ; stockage navigateur susceptible d'être supprimé. Pas de synchronisation cloud, agrégation bancaire, virements exécutés, conseil automatisé ou service IA externe dans cette V1. Ces choix ne nécessitent aucune installation aujourd'hui.

## 12. Livraison étape par étape

| Étape | Travail concret | Condition de sortie |
| --- | --- | --- |
| 0 — Sécuriser | Brief unique, inventaire, références figées, sources protégées, schéma et fixtures | Ancien intact ; définitions de calcul et scénarios de migration testables |
| 1 — Dashboard d'abord | Nouvelle coque, tokens, registre, composants 01/02/03/04/07/09/21/28, éditeur minimal 29/30 | Interaction complète sur données fictives, tailles supportées, pas de remount global ; ce n'est pas encore une V0 utilisable |
| 2 — V0 utilisable | Dashboard + historique + budgets + comptes + import CSV + réglages/sauvegarde | Importer son CSV, réconcilier, corriger, connaître disponible et préparer la semaine sans données inventées |
| 3 — V0.1 | Objectifs, affectations, récurrences confirmées et suggestions | Aucun double compte, rapprochement payé/prévu, achat projet simulable |
| 4 — V0.2 | Prévisions complètes, scénarios, calendrier et simulation d'achat | Cas revenus décalés/charge exceptionnelle/seuil franchi expliqués et testés |
| 5 — V0.3 | Foyer, analyse, catégories/règles avancées, import XLSX contrôlé | Partages cohérents, règles réversibles, périodes comparables |
| 6 — V1 | 30 composants, bibliothèque complète, vues, migration, offline, robustesse | Toutes les 14 pages et actions définies fonctionnent sur données réelles validées ; restauration prouvée |

La V0 a une projection simple d'engagements confirmés pour alimenter son dashboard ; elle n'affiche pas une courbe future arbitraire en attendant le moteur complet. Les entrées de pages futures sont masquées ou clairement annoncées hors navigation opérationnelle. Pas de bouton qui ouvre une page vide « bientôt ».

Chaque tranche suit : fixture et règles → composant interactif → intégration à la page → tests → validation visuelle → données réelles en copie → acceptation. On ne construit pas quatorze façades avant d'avoir éprouvé le premier parcours.

## 13. Critères de recette

Fonctionnel : import initial et import chevauchant ; deux vrais achats identiques ; remboursement ; transfert avec une moitié absente ; solde inconnu ; charge variable ; dépense ventilée ; mois financier non calendaire ; contribution puis achat projet ; changement de règle de partage ; annulation de lot après correction ; migration et restauration.

Interface : chaque taille autorisée et variante des 30 composants ; état vide, erreur, attente, périmé, données négatives et longs libellés ; retour navigateur ; clavier ; focus conservé après mutation ; 20 changements rapides de filtre sans réponse obsolète ; resize pendant mise à jour ; affichage mobile ; mouvement réduit.

Exactitude : sommes en centimes, égalité des ventilations, invariance du cash lors d'une affectation, neutralité des virements au foyer, aucun cumul prévu/réalisé, même résultat entre toutes les représentations. Les exemples d'image ne remplacent pas ces tests.

Performance cible à mesurer sur matériel documenté : retour visuel d'une action sous 100 ms ; actualisation habituelle de widgets sous 200 ms au p95 sur 10 000 opérations ; import de 50 000 lignes avec progression et sans bloquer durablement l'interface. Si le budget n'est pas tenu, profiler avant d'ajouter des caches. Mesurer aussi mémoire et abonnements après navigation répétée.

Sécurité et données : aucune transaction dans les prompts d'images, télémétrie ou recherche de logo ; export/import de sauvegarde testé ; absence de fichiers privés suivis par Git ; suppression/migration strictement ciblées ; données de démonstration identifiées et jamais mélangées au réel.

Une page est terminée lorsque ses actions produisent le résultat annoncé, les dépendances se mettent à jour sans perte de contexte, les erreurs sont récupérables et l'état est conservé après fermeture/réouverture. « Le bouton se clique » ne suffit pas.

## 14. Références visuelles et décisions restantes

Les 14 images dans `design/pages-v1-2026-10-02/` sont des maquettes de pages complètes générées avec des données fictives. Leurs prompts sont conservés avec les assets. Leur rôle est la hiérarchie, le style et les interactions visibles ; le présent brief reste la source de vérité des calculs, libellés et états. Une galerie permet de les parcourir sans créer un second document de spécification.

[Ouvrir la galerie des 14 pages](design/pages-v1-2026-10-02/index.html). Génération effectuée avec l'outil d'images intégré, puis corrections ciblées du dashboard et des budgets ; [prompts initiaux](design/pages-v1-2026-10-02/prompts.json) et [prompts de correction](design/pages-v1-2026-10-02/refinement-prompts.json).

La revue visuelle confirme des pages entières, sans dernière section coupée, et une direction graphique commune. Elle relève aussi des écarts résiduels : dates et sous-totaux illustratifs, navigation parfois variable, libellés de sélection incohérents et quelques totaux non réconciliés. La galerie les signale page par page. Ces images sont donc des maquettes de direction, pas des spécifications pixel-perfect ni des fixtures chiffrées validées. En particulier, le budget a 300 € restants après 50 € engagés, la recherche distante de logos est désactivée par défaut et les rapprochements de doublons exigent une identité réelle.

Référence approuvée : [quatre composants Rime](design/rime-direction-2026-10-02/four-components.png). Archive : [30 planches](design/component-sheets-rime-2026-10-02/index.html) et [ancienne spécification détaillée](design/component-library-2026-10-02/component-library-specification.md). La personnalité visuelle vient de ces références, pas du thème bancaire historique.

Hypothèses à confirmer au moment de construire, sans bloquer ce plan : un foyer local, comptes EUR, période financière choisie explicitement, aucune règle de partage imposée, aucune connexion bancaire. Les soldes observés et la période couverte par les exports devront être validés par l'utilisateur lors de la reprise. Un service multi-appareils serait un autre chantier.

Ne pas supprimer l'ancien projet pour donner l'impression d'être reparti de zéro ; démontrer la nouvelle base, puis migrer avec une possibilité de retour.

## 15. Première tranche implémentée — dashboard et import

### Démarrage et isolation

Le code actif de cette tranche est dans `apps/wealthpilot/` : React, TypeScript, Vite, Dexie, Papa Parse en worker et dialogues Radix accessibles. Les graphiques sont en SVG avec alternative tabulaire ; ECharts reste une option pour les besoins ultérieurs, pas une dépendance déjà installée. Les polices sont locales. La direction Rime reprend crème, charbon, jaune, rose et cyan, titres condensés, composants éditoriaux et navigation basse.

Depuis la racine : `npm --prefix apps/wealthpilot ci`, puis `npm run dev:pilot`. Adresse stable : `http://127.0.0.1:5173/`. `npm run build:pilot` compile et `npm run test:pilot` teste. L'ancienne application reste accessible par ses anciennes commandes. Aucune migration ou suppression de son IndexedDB n'a été réalisée. La nouvelle base s'appelle `WealthPilotNext_v1` et appartient à l'origine du navigateur : changer d'hôte, de port ou de navigateur donne une autre base.

### Ce qui fonctionne maintenant

- Import CSV UTF-8 ou Windows-1252, séparateur détecté, association automatique et manuelle des colonnes, montants signés ou débit/crédit, dates françaises/ISO, comptes multiples EUR. Limites : 20 Mo et 50 000 lignes.
- Aperçu paginé, erreurs par ligne, sélection explicite, ressemblances décochées à vérifier. Les deux achats identiques d'un nouveau fichier ne sont pas supprimés arbitrairement. Un fichier strictement identique déjà importé est bloqué. Les ressemblances sans identifiant bancaire ne sont pas des doublons certifiés.
- Enregistrement atomique du lot, historique et annulation confirmée d'un lot. L'annulation retire ses opérations, y compris leurs corrections ; les soldes saisis restent et les échéances rapprochées sont déliées. Sauvegarder avant cette action.
- Solde observé et daté par compte, filtres compte/mois, évolution calculée, choix solde ou flux nets cumulés, tableau des valeurs, dépenses/revenus hors virements internes et fraîcheur des sources.
- Disponible explicable après échéances, réserves de sécurité, dépenses essentielles encore à couvrir et montant affecté au projet. Allocation hebdomadaire configurable. Affecter au projet réserve de l'argent sans modifier le solde bancaire.
- Enveloppes mensuelles modifiables, consommation depuis les opérations, représentation liste ou anneaux. Les anneaux représentent au maximum trois enveloppes, explicitement indiquées ; la liste conserve les autres.
- Un objectif actif, échéances datées à saisir et rapprochement manuel avec une opération importée pour éviter de compter deux fois la charge. La courbe future ne représente que les événements renseignés ; les retards sont signalés, pas arbitrairement décalés.
- Consultation/recherche des opérations et modification catégorie/virement interne ; mises à jour réactives des métriques sans rechargement complet ni réinitialisation volontaire du graphique.
- Affichage/masquage et ordre des sept widgets persistants ; préférence de représentation des budgets et période conservées. Dialogues annulables, focus clavier et prise en compte du mouvement réduit.
- Export CSV des opérations, sauvegarde JSON complète, validation puis restauration atomique après confirmation. Le JSON n'est pas chiffré : le conserver comme un document bancaire privé.

### Données et références conservées

Le fichier `private-data/wealthpilot-base-2026.csv` est une copie exacte du consolidé identifié dans `../data/transactions_2026_consolidated.csv` : **1 385 opérations, deux comptes, du 2 janvier au 28 septembre 2026**. Ses 1 385 lignes passent les validations de l'importeur. Il est exclu de Git, non publié dans les assets web et protégé en lecture/écriture pour le propriétaire. Les autres anciens exports présentent des différences ; ils n'ont pas été fusionnés aveuglément. Ce CSV est la base consolidée disponible, pas une certification de l'exhaustivité de tous les comptes bancaires.

Pour démarrer, importer ce fichier dans la nouvelle page, vérifier l'aperçu, puis confirmer les soldes bancaires et leur date. Les anciennes valeurs dérivées `daily_balance` ne remplacent pas un solde observé. La fraîcheur jusqu'au 28 septembre est affichée : aucune opération ultérieure n'est inventée. Les catégories existantes sont conservées ; un export sans catégorie reste à classer.

Les 30 planches de composants, 14 pages, prompts, direction approuvée, spécification et références historiques restent dans `design/` et `images_ref/`. Le script `apps/wealthpilot/scripts/sync-references.mjs` reconstruit la galerie du dock Références au démarrage et au build. Les copies générées dans `public/references/` sont ignorées de Git ; les originaux restent dans le dépôt. Aucune donnée CSV privée n'y est copiée.

### Vérifications effectuées

55 tests réussis avec le test privé activé : calculs en centimes, dates, solde, projection, import de 50 000 lignes, doublons, export/réimport, transactions atomiques, annulation de lot, persistance, sauvegarde/restauration et stabilité de composants. Sans le chemin privé, ce contrôle seul est ignoré : `WEALTHPILOT_PRIVATE_CSV=/chemin/absolu.csv npm --prefix apps/wealthpilot test`.

Les 111 tests de l'application historique passent également, avec un test préexistant ignoré. Build TypeScript/Vite réussi. Audit npm de la nouvelle base : zéro vulnérabilité signalée à cette date ; cela ne constitue pas un audit de sécurité complet. Les avertissements de bundling Radix sur `use client` ne bloquent pas la compilation.

Recette navigateur sur une origine de test distincte, uniquement avec `fixtures/demo.csv` fictif : import de 12 opérations, deux comptes, saisie des soldes, budgets, affectation au projet sans changement du cash, réserves, échéance, changements de mois, anneaux persistants après rechargement, fichier identique bloqué. Contrôle mobile à 390 px : pas de débordement horizontal de page ; graphique déroulant dans son composant. Aucun avertissement/erreur console relevé au contrôle. Captures locales dans `apps/wealthpilot/test-results/` (non versionnées). Les données fictives ne sont pas injectées dans l'origine principale.

### Limites volontaires de cette tranche

Ce n'est pas encore toute la V0/V1 décrite plus haut : deux pages opérationnelles, sept widgets et leurs formulaires, pas trente composants exécutables. Pas encore de redimensionnement libre, de multiples instances d'un widget ni de connecteurs entrée/sortie configurables. Les autres pages ne sont pas proposées comme des boutons vides.

Les réserves, l'objectif et l'allocation hebdomadaire sont les réglages actuels, appliqués à la période consultée ; ils ne sont pas des archives de décisions historiques. Les remboursements positifs sont des entrées, sans rapprochement automatique à une dépense. Pas de règles automatiques de récurrence, ventilation, partage familial, mois financier personnalisé, synchronisation multi-appareils ou connexion bancaire. Les logos sont des icônes locales génériques, sans recherche distante sur les libellés privés. Les profils de colonnes ne sont pas encore enregistrés.

Le snapshot réactif reste global dans cette première base : le DOM des graphiques est préservé, mais les objectifs de performance p95 de la section 13 ne sont pas encore mesurés ni garantis. Prochaine tranche : retour utilisateur sur données réelles, puis tailles/instances de widgets et règles de catégorisation, avant les pages supplémentaires.

## 16. Deuxième tranche — dashboard modulaire et transactions (3 octobre 2026)

Cette section actualise la livraison et remplace les limites fonctionnelles de la section 15 lorsqu'elles concernent les fonctionnalités ci-dessous. La direction Rime et l'ancienne application sont conservées.

### Parcours et pages opérationnels

- Base vide : ouverture automatique de l'import CSV. Lecture et analyse dans un worker avec progression fondée sur les lignes parcourues, puis aperçu et validation atomique existants.
- Après le premier import : préparation du foyer dans la page, soldes datés, projets, minimum de fin de mois, historique des trois derniers mois observés terminés et propositions d'enveloppes modifiables. Les enveloppes déjà enregistrées sont conservées par défaut. Les futurs imports ne réinitialisent pas les projets ni la vue.
- Dashboard : tous les 30 identifiants de blocs sont exécutables et accessibles dans une bibliothèque intégrée. Sélection, ordre et tailles autorisées Tiny/Small/Medium/Large/Extra large sont persistants. Les tailles augmentent l'espace et, pour les listes, le nombre de lignes affichées. Les variations disponibles comprennent budgets en liste/anneaux, répartition en barres/anneau et graphique solde/flux. Ce sont des presets, pas des handles de redimensionnement libre.
- Transactions : toutes les opérations de la période et du compte choisis, recherche, catégorie, type de flux, tri date/montant, pagination de 25 lignes, totaux hors virements internes, export du résultat filtré et correction de catégorie/virement interne dans la ligne. Données brutes du CSV consultables. Les corrections se propagent aux métriques sans rechargement de page.
- Périodes : mois unique, 3, 4, 6, 12 mois, tout l'historique ou intervalle personnalisé. Fin de sélection et contexte conservés. Les flux sont cumulés ; les soldes ne sont jamais additionnés entre mois. Les budgets n'incluent que les dépenses des mois ayant une enveloppe définie pour la catégorie.
- Édition des objectifs, budgets, soldes, paramètres et échéances directement dans le composant ; bibliothèque intégrée et détail du disponible dans sa carte. La confirmation d'une annulation destructive d'import reste une exception avec dialogue.

### Calculs et récupération historique

Récurrences : regroupement par compte, libellé normalisé et signe, au moins trois dates, cadence hebdomadaire ou mensuelle et montants suffisamment stables. Les virements internes et signaux trop anciens sont exclus. Le score affiché est un indicateur heuristique, pas une probabilité. Une opération déjà importée ou une échéance manuelle correspondante empêche le double comptage. Les estimations restent dérivées des transactions ; ignorer une cadence retire ses événements des calculs et ce choix est sauvegardé. La préparation permet de la réactiver.

Le disponible protège les échéances de dépense, les enveloppes essentielles restantes, le seuil de sécurité et les montants déjà réservés à tous les projets. Une échéance rattachée à une enveloppe ne s'y ajoute pas une deuxième fois. Sans allocation hebdomadaire manuelle, une estimation répartit le disponible sur les jours restants. Le minimum de trésorerie est un stock : les propositions ne le soustraient pas en entier chaque mois, seulement son manque éventuel. Les contributions mensuelles des objectifs influencent les suggestions ; modifier un objectif ne réécrit pas silencieusement les enveloppes validées.

La courbe future distribue les enveloppes restantes automatiques et les événements datés futurs. Elle ne décale pas une échéance échue : celle-ci reste signalée et peut être prise en compte dans le disponible sans être reportée sur la courbe. Une réserve n'est pas une sortie bancaire ; le point bas de cash et le disponible protégé sont donc différents. Les données absentes et les opérations après la dernière importation ne sont pas inventées.

Les six projets trouvés dans l'ancien code sont proposés comme modèles avec montant réservé nul. Les objectifs/budgets personnels peuvent être lus dans l'ancienne base `WealthPilotDB` uniquement lorsqu'elle existe sur la même origine ; sinon une sauvegarde historique JSON non chiffrée est nécessaire. Un aperçu précède la fusion explicite, sans remplacement automatique des réglages actuels. Cette récupération ne migre pas les transactions historiques : celles-ci viennent du CSV validé.

### Vérification et limites

71 tests réussis, y compris le CSV privé consolidé, et compilation TypeScript/Vite réussie. Tests supplémentaires : cadences et faux positifs, fin de mois, exclusions, rapprochement, réserves multi-projets, suggestions en centimes, périodes multiples, enveloppes absentes et conversion des anciennes données euros vers centimes. Un test rend les 30 composants dans chacune des tailles autorisées ; la sauvegarde/restauration inclut leurs préférences, les projets supplémentaires et les exclusions de récurrences. Recette navigateur sur une origine isolée avec 75 opérations fictives sur trois mois : import, préparation, soldes, transactions/pagination/recherche/correction persistante, sélection de blocs et tailles persistantes, édition d'un projet avec recalcul du disponible et exclusion d'une récurrence. Contrôle mobile à 390 px : pas de débordement horizontal des pages dashboard et transactions. Aucun avertissement/erreur console relevé. Captures locales dans `apps/wealthpilot/test-results/`, non versionnées. Les données de recette ne sont pas injectées dans l'origine principale.

Les propositions réduisent proportionnellement les catégories historiques lorsque nécessaire ; ce n'est pas un optimiseur priorisant les dépenses incompressibles. L'utilisateur doit les vérifier. Pas de connexion bancaire, de synchronisation multi-appareils, de propriété personnelle des comptes devinée, ni de garantie de rester dans le vert. Pas encore de multiples instances d'un même bloc, de branchement arbitraire des données entrée/sortie ou d'archives versionnées des budgets et objectifs. Le snapshot réactif global et les performances p95 restent non garantis. Les limites d'interaction et de logos de cette tranche sont remplacées par l'itération suivante.

## 18. Itération de qualité — 3 octobre 2026

### Expérience livrée

- Organisation sur la grille : poignées de déplacement, raccourcis clavier, taille et couleur sur la carte sélectionnée, catalogue d'ajout, retrait non destructif, validation persistante et annulation. Les réglages s'affichent sur une seule carte à la fois, les actions de fin restent visibles au défilement. Une écriture en cours bloque les modifications concurrentes. Les données financières ne sont pas modifiées par l'organisation.
- Cinq fonds (crème, charbon, jaune, rose, bleu), courbes et sous-surfaces adaptés au contraste. La taille change immédiatement la densité des listes. Les dates de graphique s'espacent selon sa largeur réelle ; le tableau détaillé reste un choix explicite, pas une conséquence automatique de la taille XL.
- Catalogue : 28 cartes métier ajoutables ; Configuration et Bibliothèque restent des identifiants compatibles avec les anciennes préférences, mais ne sont plus proposés comme cartes financières. Les recouvrements d'informations sont signalés. Les métriques dédiées retirent leurs doublons du résumé principal. Achat mesure une dépense ponctuelle sur le disponible ; Scénario compare une réduction récurrente de charges à une perte récurrente de revenus, sans prétendre calculer un calendrier de trésorerie.
- Journal plat sans ombre de tableau : recherche par termes cumulés, accents, préfixes, distances de frappe et abréviations ordonnées (par exemple « mcdo »), classement par pertinence puis tri choisi. Pas de grand dictionnaire d'alias. Filtres catégorie, flux, vérification, montant, période et compte ; export du résultat ; sélection de page, correction groupée et annulation de la dernière écriture.
- Catégorie : petit formulaire dans la ligne. Commerçant : détail bancaire et formulaire complet dans la ligne. Les brouillons sont conservés pendant les filtres, la pagination et la fermeture du détail, pas après rechargement. Modifier le nom/classement d'une entité ne propage jamais le statut de virement interne ni la note des autres lignes. Changer de catégorie efface l'ancienne sous-catégorie ; l'annulation restaure les valeurs exactes.
- Menus partagés Radix au style de l'application, contrôlables au clavier. Logos de 3 463 marques générés depuis Simple Icons et servis localement ; matching sur mots/expressions entiers, pas sous-chaînes arbitraires. Une boulangerie n'obtient plus le logo Boulanger. Repli local diversifié selon sous-catégorie puis catégorie. Aucun libellé privé envoyé à un moteur de recherche de marques.

### Objectifs historiques : récupération explicite, pas données inventées

Les six modèles du code ancien ne remplacent pas les valeurs personnelles. Depuis l'éditeur d'objectifs ou la préparation, une même logique récupère l'ancienne base de même origine ou un JSON historique. L'aperçu et le résultat indiquent les ajouts, remplacements et valeurs conservées ; remplacer une collision demande un choix explicite. Identifiants et noms historiques traduits évitent les doublons. Les objectifs liés à un compte reprennent le solde à la date de la sauvegarde, pas une liaison bancaire permanente. Une valeur négative ou un objectif invalide est signalé et écarté sans empêcher les autres récupérations. Les échéances valides sont normalisées avant sauvegarde/restauration.

Le CSV consolidé actuellement vérifié se trouve dans `../data/transactions_2026_consolidated.csv`. Le dossier local `private-data/` est vide au contrôle de cette itération : la copie annoncée dans la première tranche n'y est plus présente. Aucun fichier privé n'a été supprimé pendant cette itération, aucune donnée réelle n'a été injectée dans l'origine de recette.

### Recette et revues

95 tests passent avec le CSV privé explicitement fourni : les contrôles existants plus persistance/annulation de classement, conservation des virements internes, brouillons et focus, récupération partielle, faux positifs de logos, migration/sauvegarde, contrôles de formulaire, disposition et espacement des dates. Compilation TypeScript et build Vite réussis ; audit npm des dépendances de production : zéro vulnérabilité signalée. Les avertissements de bundling Radix et de taille du bundle ne sont pas un échec, mais le découpage du bundle reste améliorable.

Recette navigateur sur `127.0.0.1:5176`, base fictive isolée de 87 opérations : recherche « mcdo », classement rapide et annulation, changement taille/couleur/ordre conservé au rechargement, déplacement au clavier puis annulation avec retour du focus, contrastes charbon, menus ouverts. Contrôles à 390 et 1440 pixels ; vérification de largeur du montant lui-même, pas uniquement de la page. Aucun avertissement ou erreur console au contrôle final. Captures dans `apps/wealthpilot/test-results/`, ignorées par Git.

Trois critiques distinctes ont évalué la première passe à 82 (design), 78 (interactions), 76 (données), puis ont identifié les défauts à corriger. Après corrections, tests et nouvelles preuves, chacune évalue son périmètre revu à 95/100. Ces notes sont des jugements de revue ciblés, pas une certification de tous les composants et combinaisons. Restent notamment : tests tactiles sur appareil réel et lecteur d'écran, précision de certaines compositions mixtes, multiples instances/configuration des sources, performance p95 et historique versionné des décisions.

### Références de conception consultées

Organisation directe inspirée des [widgets Apple](https://support.apple.com/en-gb/guide/ipad/ipadf6ea1ce5/ipados), filtres composables de [Linear](https://linear.app/docs/filters), parcours de vérification des [transactions Monarch](https://www.monarch.com/quicker-and-easier-transaction-review-and-more). Comportement des menus fondé sur [Radix Select](https://www.radix-ui.com/primitives/docs/components/select). Logos issus de [Simple Icons](https://github.com/simple-icons/simple-icons), dont les marques restent la propriété de leurs titulaires ; il ne s'agit pas d'un partenariat avec ces services.

## 19. Raffinement desktop, visualisations et explication du disponible

Le retour utilisateur remplace toute interprétation des notes précédentes comme une note globale du produit. Cette itération est décrite par ses changements et ses contrôles, sans nouvelle note de satisfaction.

### Changements livrés

- Espace de travail jusqu’à 3 200 pixels, grilles de 12, 18 ou 24 colonnes selon la largeur. Les cartes conservent leurs tailles relatives. Leur hauteur réelle détermine leur occupation verticale ; le compactage comble les espaces possibles, sans agrandir artificiellement toutes les cartes à la hauteur du plus grand voisin. Le placement visuel peut se compacter différemment selon l’écran ; l’ordre enregistré reste la séquence des cartes. Déplacement à la souris/clavier et boutons d’ordre restent disponibles. Les combinaisons de largeurs peuvent encore laisser de petits espaces : ce n’est pas un canevas à positions libres.
- Le catalogue affiche les composants réellement rendus, leurs données courantes et leur palette, avec contrôles désactivés dans l’aperçu. Deux, trois ou quatre colonnes de prévisualisations selon l’écran ; recherche et bouton d’ajout distincts. Les aperçus sont réduits à une largeur de référence, pas des captures pixel-identiques de chaque taille de dashboard.
- Couleurs sémantiques pour valeurs, tracés, pistes, états actifs et boutons. Les palettes claires utilisent des séries foncées ; le charbon utilise des séries claires et des valeurs jaunes. Les couleurs choisies pour les projets sont éclaircies sur charbon pour leurs tracés. L’éditeur intégré reste clair, avec contraste propre.
- Les visualisations de listes financières disposent de lignes, anneaux individuels ou tuiles lorsque pertinent : comptes/solde, projets, effort d’épargne, charges, dépenses par compte, réserves des projets, catégories, récurrences, dépenses inhabituelles et comparaisons mensuelles. Préférence mémorisée par composant et incluse dans la sauvegarde JSON. Les anneaux indiquent soit l’avancement vers une cible, soit la part d’un total, explicitement distingués. Ils sont désactivés pour les valeurs signées et pour les flux accompagnés de leur net, qui ne constituent pas une partition. Les tuiles ont une aire identique et une barre quantitative : elles ne prétendent pas être un treemap. Pas de sunburst artificiel sans hiérarchie de données.
- Budgets : ordre modifiable directement par monter/descendre, affichage de 3, 4, 6 ou toutes les enveloppes, choix persistants. « Voir les enveloppes » développe la liste au lieu d’ouvrir l’éditeur. Les trois anneaux concentriques existants restent limités aux trois premières enveloppes, avec liste détaillée en complément.
- Objectifs : sélection d’un projet par vignette, formulaire unique dans la page, dix icônes et six couleurs par projet, choix du projet mis en avant. Les icônes/couleurs se retrouvent dans les cartes et dans les sauvegardes. Aucun solde historique ou objectif personnel n’est inventé ; la récupération historique explicite demeure disponible.
- Logos complémentaires servis localement : G20, Free/Free Mobile, Société Générale, Amazon ; reconnaissance de BK et de variantes McDonald’s. Repli générique bancaire pour Cyberbanking, dont l’identité commerciale n’est pas assez certaine. Aucun libellé de transaction privé n’est envoyé à un service externe.

### Disponible négatif : signification et limite du diagnostic

La capture fournie montre **−3 107,19 €**, sans les postes du calcul. Elle ne suffit pas à attribuer ce déficit à une charge, un doublon ou une réserve précise. L’arithmétique n’a pas été modifiée pour forcer artificiellement un résultat positif.

Le disponible brut reste : solde calculé − échéances de dépense non rapprochées − enveloppes restantes (ou provision manuelle) − réserves de projets − réserve de sécurité. Les échéances et enveloppes d’une même catégorie ne sont pas comptées deux fois. Les revenus futurs ne sont pas traités comme du cash déjà disponible. Les enveloppes automatiques protègent **toutes les catégories budgétées**, pas seulement les dépenses dites essentielles ; le libellé du détail est corrigé en conséquence.

Lorsque le résultat est négatif, la carte montre 0 € de marge libre et un montant explicite « à couvrir ». Le détail conserve le résultat signé, sépare échéances saisies et récurrences estimées, et avertit d’une possible double affectation volontaire entre réserve de sécurité et projets. Ce déficit de plan n’est pas nécessairement un découvert bancaire. Pour diagnostiquer précisément la capture, il reste nécessaire de consulter ses postes « Voir le calcul » ou la sauvegarde correspondante. L’origine principale disponible dans le navigateur de recette est sur l’import ; aucune base financière personnelle n’y a été recréée.

### Vérifications et preuves

113 tests passent avec le CSV privé consolidé explicitement fourni. Couverture ajoutée : conservation du déficit brut, séparation estimé/saisi, persistance de l’ordre et du nombre d’enveloppes, variantes sans écrasement des réserves, absence de faux anneaux, vrais aperçus, identité des objectifs et validation de sauvegarde, logos et faux positifs. Build TypeScript/Vite et contrôle de formatage passent. Les avertissements Radix `use client` et bundle principal supérieur à 500 ko demeurent ; il n’y a pas de promesse de performance p95.

Recette isolée sur le port 5176 avec les 87 opérations fictives existantes : édition et sauvegarde d’un objectif, anneaux et budget réordonné conservés après rechargement, redimensionnement, déplacement clavier effectif puis annulation. Contrôles de grille à 390, 1 512, 2 560 et 3 840 pixels ; aucun chevauchement de cartes ni débordement horizontal observé. Console sans erreur/avertissement au contrôle. Pas de modification de la base principale, pas de validation sur appareil mobile physique ni de parcours complet au lecteur d’écran.

Captures locales ignorées par Git dans `apps/wealthpilot/test-results/` : `refinement-1512.png`, `refinement-2560.png`, `refinement-3840.png`, `refinement-390.png`, `refinement-catalog.png`. Elles utilisent uniquement des données fictives. Le code, les nouveaux assets et ce brief restent dans le dépôt ; les captures de recette ne remplacent pas les références de design versionnées.

### Provenance des logos ajoutés

G20 : [site officiel](https://www.supermarchesg20.com/), favicon du site. Free : [site officiel mobile](https://mobile.free.fr/), favicon 196 pixels. Société Générale : [site officiel particuliers](https://particuliers.sg.fr/particuliers), logo SVG du site. Amazon : marque graphique de l’archive [Simple Icons 13](https://github.com/simple-icons/simple-icons/tree/13.0.0), et non un logo inventé ; cette version historique ne certifie pas la toute dernière charte. Les URLs exactes des assets sont conservées dans `src/merchant-assets.json`. Les marques appartiennent à leurs titulaires.


## 20. Audit contradictoire complet des écrans existants — 3 octobre 2026

Trois agents distincts ont relu le produit : calculs et intégrité des données, parcours et accessibilité, présentation et responsive. Les constats sont fondés sur des cas rouges reproduits puis corrigés, suivis d'une seconde revue. Aucun score de satisfaction ni validation globale V1 n'est attribué.

### Corrections et nouvelles régressions couvertes

- Finances : compteur « À catégoriser », périmètre des provisions foyer versus compte, projection des essentiels manuels, comparaison mensuelle partielle explicitée. L'approvisionnement utilise le point bas daté : un salaire reçu avant une charge change effectivement le besoin, contrairement à un revenu reçu après.
- Rapprochement/restauration : compte et signe compatibles, unicité transaction/échéance, mois de budget valides et sans doublon. Une échéance hebdomadaire ne masque plus deux occurrences.
- Budgets : dépensé, engagements non payés et restant distincts ; engagements hachurés. Les réserves de sécurité/projets ne sont pas présentées comme des sorties bancaires futures.
- Interactions : recherche et brouillons conservés pendant la navigation ; clic budget transmet la catégorie au journal. Édition atomique des préférences ; annulation limitée aux champs modifiés et refus en cas de conflit. Les lectures JSON périmées ne remplacent plus la sélection récente.
- Échéances : compte sélectionné contrôlé, valeur initiale explicite et vérification avant sauvegarde.
- Accessibilité : focus sur le titre de l'édition intégrée puis retour au bouton, indication des erreurs dans la confirmation active, sélecteur JSON français, région de tableau import focusable et défilement horizontal expliqué sur mobile.
- Visuel : couleurs de catégories stables, contraste des petits textes, ordre de lecture sans remplissage dense rétroactif, Small demi-largeur sur ordinateur portable, tuiles de largeur minimale 180 px, marge de défilement pour le dock.

### Logos : lecture exhaustive du CSV, attribution prudente

Lecture locale et non destructive des 1 385 opérations / 308 libellés marchands distincts du CSV consolidé. Les recherches externes portent uniquement sur les noms publics d'enseignes, jamais sur les montants, personnes privées ou lignes bancaires brutes.

La résolution passe de 406 à **732 opérations avec une marque**, et de 46 à **112 libellés distincts**. Ce n'est pas une affirmation que les 653 autres lignes doivent toutes avoir un logo : elles comprennent aussi transferts, petits commerces, libellés génériques et identités ambiguës. 49 assets complémentaires portent le registre local à 53, en plus du catalogue Simple Icons.

SG avec suffixe de frais/cotisation et AG Société Générale utilisent le logo Société Générale. Kiabi et Chaussea utilisent leurs assets officiels, comme MAIF, EDF, CAF, Primark, Pathé, Veolia, RATP, Sogessur, etc. Navigo utilise l'icône de l'autorité Île-de-France Mobilités, pas un mot-symbole Navigo inventé. Sources exactes et précisions de vérification dans `src/merchant-assets.json`. Les fichiers sont dans `public/merchant-assets/`, servis sans requête externe au moment de consulter les transactions.

Exclusions assumées : Square/SumUp ne deviennent pas le commerçant derrière un paiement ; « Shein / Temu » n'est pas arbitrairement attribué à l'une des deux enseignes ; « Paul Martin » n'est pas la boulangerie PAUL. Kavi et Levain restent sans logo certain. Le logo SANEF identifié sur une source officielle n'a pas pu être récupéré (HTTP 403). Le domaine Esso redirigeant vers une autre marque n'a pas été repris. Certains favicons officiels sont de basse résolution : leur identité est vérifiée, pas une qualité vectorielle promise.

### Recette finale et limites

**184 tests passent**, CSV privé explicitement inclus ; TypeScript, build Vite, Prettier et contrôle de diff réussis. Les avertissements Radix et bundle principal supérieur à 500 ko demeurent.

Recette navigateur sur l'origine fictive 5176, sans modification de la base principale : quatre écrans existants (dashboard, transactions, import, données), recherche « mcdo », conservation entre pages, détail du calcul et focus retour, visualisations anneaux/tuiles. Captures aux largeurs réelles 390, 1512, 2560 et 3840 ; pas de débordement horizontal du dashboard observé. Ordre DOM/visuel mesuré concordant à 2560. Focus du sélecteur de visualisation observé hors dock à 1512. Console sans erreur/avertissement au contrôle. 53/53 images du registre local chargées dans la planche de vérification.

Preuves locales dans `apps/wealthpilot/test-results/` : `audit-dashboard-1512-final.jpg`, `audit-dashboard-2560.jpg`, `audit-dashboard-3840.jpg`, `audit-dashboard-390.jpg`, `audit-search.jpg`, `audit-import.jpg`, `audit-data.jpg`, leurs variantes mobile, `audit-goals-rings.jpg`, `audit-goals-tiles-final.jpg`, `audit-logos-final.jpg`. Les images ne contiennent que des données fictives ou des marques publiques. Les trois frames postclic montrent un état stabilisé : **elles ne constituent pas une mesure vidéo de fluidité**. Le changement anneaux/tuiles reste instantané ; aucune interpolation du tracé n'est prétendue.

Verdict limité : les défauts reproduits ci-dessus sont corrigés et retestés ; aucun blocage visuel identifié dans les états inspectés. Ce n'est pas une certification de toutes les combinaisons taille/couleur/source des 30 cartes, ni un audit physique de lecteur d'écran, ni une mesure p95. La V1 complète demeure inachevée : pages spécialisées, multiples instances et sources locales de widgets, vues nommées, profils d'import, ventilation/remboursements liés, partage et historique complet des décisions. Ne pas présenter les 14 maquettes de pages comme 14 pages fonctionnelles.


## 21. Plan actif — budget de la semaine et vraie liberté du dashboard

### 21.1 Ce que le retour du 4 octobre change

La bonne question n'est plus « ai-je reproduit les cartes ? », mais « peut-on décider des dépenses de la prochaine semaine, pour le bon compte, sans masquer un risque ultérieur ? ». Semaine de référence de cette demande : **lundi 5 au dimanche 11 octobre 2026**. Une note précédente ou des tests verts ne remplacent pas cette utilité.

Les décisions ci-dessous remplacent les choix antérieurs qui les contredisent :

1. Une grille spatiale à coordonnées, pas une liste réordonnée ni du masonry qui comble les trous.
2. Une visualisation propre à la question de chaque composant, pas les mêmes trois boutons universels.
3. Des anneaux **concentriques dans un seul graphique**, avec centre commun et légende lisible, quand la mesure le permet.
4. Le déplacement direct des enveloppes, du dernier rang au premier en un geste.
5. Une planification hebdomadaire par compte et foyer, plus un véritable simulateur d'achat.
6. Des soldes ancrés sur une observation bancaire datée, un historique reconstruit à rebours, des revenus récurrents inclus dans les prévisions.
7. Un journal réglable en densité et pagination, utilisable depuis le haut comme le bas.
8. Des objectifs compacts, plus d'icônes/couleurs, des actions dans le projet concerné.
9. Aucun quota artificiel de 30 cartes : conserver les 30 intentions, regrouper les doublons, justifier toute carte autonome.
10. Les scores doivent mesurer des preuves prédéfinies. **95/100 minimum ne signifie ni perfection garantie ni autorisation d'ignorer un défaut critique.**

### 21.2 État constaté, pas supposé

- `DashboardBoard.tsx` stocke un ordre de types, tailles et thèmes, pas des positions libres ni des instances multiples. Refaire son modèle est nécessaire.
- `TransactionsPage.tsx` est limité à 25 lignes et aux boutons précédent/suivant.
- Le widget achat retranche un montant du disponible global ; il ne répond pas correctement à une question contextualisée par catégorie, date et compte payeur.
- L'allocation semaine est globale. Sous filtre compte, elle est actuellement indisponible plutôt que fausse : le prochain moteur doit réellement calculer ce périmètre.
- Le détecteur existant accepte déjà des flux positifs. Il faut tester pourquoi un salaire précis manque : nom variable, montant, cadence, couverture, filtre, rapprochement. Ne pas prétendre qu'aucun revenu n'était prévu sans diagnostic.
- Le parseur de la nouvelle app considère la première ligne comme un en-tête de colonnes. Les exports SG fournis ont une ligne de métadonnées avant la table : un profil SG explicite est nécessaire.
- Le champ CSV `daily_balance` ne devient pas automatiquement un checkpoint dans l'app actuelle. Mettre le fichier à jour n'actualise pas l'IndexedDB du navigateur.

### 21.3 Ordre de réalisation et to-do vérifiable

Statut initial : **à faire**, sauf la consolidation et ce cadrage dont le résultat figure en 21.10. Aucun travail UI décrit ci-dessous n'est coché par anticipation.

| Lot / priorité | Travail à livrer | Dépendances | Critères de sortie et preuves |
| --- | --- | --- | --- |
| D0 / maintenant | Consolider les trois relevés, sauvegarder l'original, ajouter Conjoint, vérifier soldes et chevauchement | Sources locales | Nombre de lignes source = doublons rapprochés + ajouts ; occurrences légitimes préservées ; aucun montant changé ; reprise idempotente ; revue indépendante |
| D1 / P0 | Profil SG, identité stable de compte, dates de couverture, solde observé et provenance | D0 | Windows-1252, séparateur point-virgule, préambule détecté ; solde du 2/10 distinct de l'export du 4/10 ; aperçu avant acceptation ; aucun ajustement fictif ; réimport sans doublon |
| D2 / P0 | Historique de solde ancré, couverture, transferts liés et périmètres | D1 | Même valeur à une même date sur vue 1/3/6 mois ; total foyer contrôlé ; transfert neutre au foyer mais effectif sur chaque compte ; trou de couverture signalé |
| F1 / P0 | Prévision déterministe revenus/charges/essentiels, point bas par compte, scénarios | D2 | Salaire entre 25–27 testé, après/before charge distincts ; occurrence réalisée remplace prévision ; incertitude explicite ; hypothèses inspectables et désactivables |
| W1 / P1 | Page « Ma semaine » et carte récapitulative, aujourd'hui/cette semaine/semaine prochaine | F1 | Courses, restauration rapide, carburant, shopping et autres catégories présentes selon données ; maxima compatibles avec même enveloppe commune, dates et compte affichés ; semaine traversant deux mois testée |
| S1 / P1 | « Puis-je dépenser ? » utilisable et question guidée | W1 | Saisie montant/catégorie/date/payeur, exemple en langage naturel local avec confirmation des champs ; avant/après cash, enveloppe, semaine, point bas et manque ; zéro écriture réelle |
| G0 / P1 | Prototype comparatif de placement libre puis choix d'une bibliothèque | Sans données privées, en parallèle de D1 | 30 instances, trous, déplacements d'une cellule, collisions, resize, React 19, clavier ; choisir un seul moteur sur résultats, pas sur une capture |
| G1 / P1 | Modèle instances/vues/coordonnées et migration réversible | G0 | Anciennes préférences conservées, deux instances du même type possibles, sources distinctes, migration idempotente, sauvegardes anciennes compatibles |
| G2 / P1 | Nouveau mode organiser, aperçu catalogue réel et réglages contextuels | G1 | Placement précis gauche/droite/haut/bas, dimensions indépendantes, trous conservés après rechargement ; aucune carte automatiquement poussée à droite ; annuler/enregistrer fiables |
| B1 / P1 | Enveloppes déplaçables et anneaux concentriques | W1 + G1 | Dernière→première en un geste, autoscroll, alternative cliquer/déposer ; ordre identique entre vues ; consommé/engagé/restant distingués |
| T1 / P1 | Journal : densité, taille de page, pagination directe haute/basse | Indépendant de G1, conserver logique métier | 25/50/75/100/150 lignes, 3 densités ; première/dernière/page saisie ; ancrage et brouillons conservés ; recherche/export sur tout le résultat |
| C1 / P2 | Refonte des compositions, composant par composant | G2 + moteurs métier concernés | Fiche contrat, tailles utiles, variantes justifiées, états limites, comparaison des valeurs ; pas d'entête décoratif à trois bandes identique partout |
| O1 / P2 | Édition compacte des objectifs, icônes/couleurs et arbitrage | F1 + C1 projets | Un formulaire intégré au projet, cible/date/compte/réservé, recherche d'icône, palette étendue, annulation, contraste, 101 projets et noms longs testés |
| V1 / ensuite | Pages spécialisées restantes, règles, ventilation, partage | Lots précédents acceptés, vues enregistrées déjà livrées dans G2 | Reprendre chacune des 14 intentions de section 5 ; aucune route factice ; recette interpages complète avant label V1 |

Ordre conseillé pour les prochaines demandes : D1/D2 → F1/W1/S1 (utilité financière), avec G0/G1 puis T1 en parallèle lorsqu'il n'y a pas de conflit de fichiers ; G2/B1/C1/O1 ensuite. Pas de réécriture simultanée moteur financier + grille + tableau dans un seul lot non vérifiable.

### 21.4 Contrat de grille libre et catalogue

- Une **instance** porte `instanceId, type, source, période, représentation, thème, options`. Une **disposition** porte `instanceId,x,y,w,h,minW,minH,maxW,maxH`. Une **vue** nommée porte dispositions par largeur, ordre mobile, instances et version.
- Grille aimantée fine de 24 colonnes desktop, pas vertical de 12 px. Les tailles T/S/M/L/XL associent dimensions physiques et niveau d’information ; elles ne sont plus deux réglages indépendants.
- Pas de gravité ni compactage automatique. Les trous voulus restent des trous. En cas de collision, la carte manipulée garde son ancrage et les voisines concernées descendent pour lui faire de la place.
- Déplacement d’une cellule ou grand déplacement. Les poignées de redimensionnement choisissent le gabarit et le contenu correspondant. Poignée discrète en édition, zones sûres pour les champs et clics de lecture. Défilement automatique des longues pages.
- Clavier et alternative au pointeur sans glissement : choisir une carte puis un emplacement, commandes de position/dimension. Échap annule le geste, annuler la session restaure toute la configuration.
- Après placement, l'ordre desktop DOM/clavier/VoiceOver suit y puis x (identifiant stable en dernier départage), pas l'ancien tableau de types. Pendant le geste, le focus reste sur la même instance ; annoncer sa position, puis maintenir son focus à la validation ou à l'annulation. L'ordre mobile explicitement enregistré reste distinct.
- Le déplacement ne modifie pas les finances et ne remonte pas les graphiques/formulaires. Écrire la disposition à la validation, pas à chaque frame.
- Dispositions sauvegardées à 1512/2560/3840, comportement intermédiaire déterministe, mobile 390/768 avec ordre de lecture explicite. Un aller-retour entre écrans retrouve la disposition initiale.
- Migration copie les anciennes préférences dans une sauvegarde de schéma ; type inconnu ou carte hors bornes propose réparation, jamais suppression silencieuse. Aucun HTML/code exécutable sérialisé.
- Construire et valider le nouveau schéma avant activation dans une transaction atomique : identifiants uniques, références d'instances existantes, coordonnées bornées et minima/maxima cohérents. Une panne laisse l'ancienne vue intacte et ne remplace jamais la sauvegarde de retour. G1 livre ce modèle ; G2 livre aussi nommer, enregistrer, dupliquer et restaurer les vues (ce point n'attend donc pas V1). Dupliquer crée de nouveaux identifiants ; modifier la copie ne modifie pas l'original. Restaurer demande confirmation avec aperçu, sans toucher aux données financières.
- Concurrence : version/revision par vue et par entité financière, comparaison de revision à la sauvegarde. Deux onglets ne s'écrasent pas silencieusement ; conflit = recharger/comparer puis confirmer. Annuler Organiser ne restaure que son brouillon de disposition, jamais les données financières ou réserves modifiées entre-temps.
- Mesurer la largeur CSS du conteneur, pas la définition matérielle de l’écran. Ajouter/retirer un voisin conserve les trous voulus. Davantage de contenu ou un formulaire ouvert agrandit la carte et libère sa place : pas de scroll vertical imbriqué, ni de lignes cachées derrière une hauteur fixe. Les hauteurs temporaires ne deviennent pas des minima enregistrés.
- Catalogue : vrai rendu du composant sur fixture cohérente, taille annoncée et choix de variante pertinentes, recherche par question métier, indication déjà présent et possibilité de nouvelle instance. Pas de fausse miniature avec seulement trois bandes.
- Le moteur sera choisi après le prototype : React Grid Layout en candidat principal, GridStack en comparaison. Les versions/API seront figées seulement après validation de la compatibilité.

### 21.5 Calculs qui répondent à la semaine

**Ancrage et historique.** Pour un solde de fin de journée observé `B(D)`, reconstruire `B(d)=B(D)−Σ mouvements dont d<date≤D`. Après D, ajouter les opérations effectivement connues. Même date = même solde quel que soit le zoom. Conserver date comptable et éventuelle date d'achat séparées. Un intervalle sans source complète ne devient pas « réconcilié » parce que la somme tombe juste.

**Deux mesures différentes.** « Solde reconstruit » utilise cet ancrage. « Flux net cumulé » additionne des mouvements depuis une origine fixe explicitement affichée, indépendante de la fenêtre visible. Si l'on propose un flux relatif à la sélection, le nommer « Flux net de la période » et l'isoler ; ne pas changer discrètement l'origine de la même courbe.

**Contrat des checkpoints et imports.** Un checkpoint est un objet identifié par compte stable + date d'observation + source/lot, avec devise, valeur en centimes, couverture et statut observé/calculé/contesté. Ne pas transformer une ancienne reconstruction en nouvelle observation. Deux observations contradictoires à même date demandent un aperçu et un choix traçable, jamais « la dernière gagne ». Une opération tardive reconstitue l'histoire autour de l'ancrage sans changer l'observation ; montrer l'écart et la couverture. Réimport idempotent ; retirer un lot retire uniquement ses faits/checkpoints non partagés et avertit des dépendances, sans effacer une correction manuelle ou un checkpoint confirmé d'une autre source.

**Priorité et dédoublonnage.** Identifiant bancaire stable lorsqu'il est réellement disponible. Sinon clé conservatrice compte + date comptable + centimes signés + détail bancaire normalisé, avec **multiplicité**, jamais un simple ensemble date/montant. Les deux dépenses identiques à détail/référence différents restent deux opérations. Une identité supposée avec date/montant/compte discordant devient conflit à examiner, pas écrasement ni ajout aveugle. Conserver brut/provenance des deux sources. Les catégories, noms enrichis et décisions manuelles déjà présents sont prioritaires sur les suggestions du nouvel import.

**Prévision.** Par compte et par jour : solde observé + revenus attendus − charges attendues − dépenses variables prévues, avec transferts liés aux deux comptes. Réserves et objectifs sont des affectations, pas des sorties bancaires. Les revenus futurs apparaissent dans la projection à leur date ; ils ne deviennent pas du cash disponible aujourd'hui. L'horizon doit inclure les prochaines charges et dépasser la prochaine paie lorsque nécessaire.

**Récurrences positives et négatives.** Normaliser l'employeur/bénéficiaire sans écraser le libellé brut. Séparer salaire, remboursement, transfert, aide et revenu ponctuel. Montrer occurrences sources, plage de montant/date, dernière occurrence et raison d'exclusion. Tester salaire variable, primes, mois manquant, versements fractionnés et fin de mois/week-end ; un décalage de date reste une hypothèse si la règle bancaire n'est pas connue.

**Incertitude.** Scénarios central/prudent/favorable basés sur variation observée et hypothèses documentées. Zone basse/haute susceptible de s'élargir avec l'horizon, pas triangle décoratif systématique. Si l'historique est trop court, scénario hypothétique affiché comme tel ; aucune probabilité « 95 % » sans calibration et validation hors échantillon. Montrer point bas/date et intervalle de fin d'horizon.

**Enveloppe semaine.** Séparer budget alloué, consommé, engagé et restant pour le 5–11 octobre. Une course déjà planifiée ne doit pas être provisionnée à nouveau. Départ proposé : médiane des semaines complètes comparables (8–12 semaines si disponibles), nombre de semaines et couverture affichés, exceptions inspectables, puis ajustement aux obligations et objectifs explicites. Aucun « budget du mois / 4 ». Proposer un objectif de réduction choisi, pas imposer automatiquement une baisse arbitraire.

**Unicité des engagements.** Une occurrence a un identifiant stable et un état attendu/rapproché/ignoré/à-vérifier. L'enveloppe mensuelle contient consommé réel + engagements non payés + provision libre restante ; la part hebdomadaire est une projection de ces mêmes éléments, pas une réserve supplémentaire. La prévision émet chaque occurrence future une fois. Le rapprochement retire l'engagé et ajoute le réalisé, dans les mêmes catégories/périmètres ; un retard ne crée pas une nouvelle occurrence, une échéance échue non rapprochée reste à vérifier. Un remboursement lié réduit la consommation suivant la convention affichée et ne crée pas un salaire. Sans lien certain, le crédit reste à classer. Test requis : budget 100 €, dépensé 20 €, engagement 30 € → restant 50 €, aucun 30 € supplémentaire au passage semaine→mois→prévision.

**Fixture temporelle figée, à implémenter.** Horloge Paris au 4/10/2026, checkpoint observé au 2/10 ; 3–4/10 inconnus explicitement. Cas fictif autonome : 100 000 centimes de cash, charge 30 000 le 6/10, salaire 50 000 le 9/10, course additionnelle 10 000 le 10/10 → fins de journée 5–11/10 : 100 000, 70 000, 70 000, 70 000, 120 000, 110 000, 110 000 (sous hypothèse zéro mouvement manquant). Bas = 70 000 le 6/10 ; fin = 110 000. Salaire retardé au 12/10 → fin 60 000 ; ne pas le créditer le 9. Pour ces deux cas, réserve 20 000 n'est pas un débit cash mais réduit la marge protégée. Tester aussi paie le 26/10 puis charge le 28, couverture insuffisante et double import ; ces montants ne sont pas les données de la famille.

**Capacité réelle.** Les maxima par catégorie sont une répartition d'une capacité commune, pas plusieurs maxima indépendants dépensables simultanément. Contraindre le plan par le point bas quotidien et les réserves jusqu'aux prochaines échéances. Un revenu futur incertain ne doit pas justifier une dépense présentée comme sûre aujourd'hui. Un foyer positif peut cacher un compte payeur insuffisant.

**Périmètre.** Trois comptes distincts : personnel A, personnel B, conjoint. Le budget du compte sélectionné est attribué explicitement ou proposé à partir de son historique puis validé. « Tous les comptes » n'inclut le conjoint qu'une fois. Pas de partage 50/50 supposé, ni d'allocation proportionnelle au solde improvisée. Une réserve globale non répartie donne une limite de confiance sous filtre compte, pas zéro silencieux.

**Simulateur.** Question guidée « Puis-je dépenser 35 € en restauration aujourd'hui depuis ce compte ? ». Un champ libre local peut préremplir montant/catégorie/date, avec confirmation des ambiguïtés ; pas besoin d'envoyer les transactions à un modèle distant. Achat déjà inclus dans une enveloppe versus dépense supplémentaire doivent produire des calculs différents. Résultat : enveloppe restante, marge semaine, cash du payeur, point bas/date, effet foyer, hypothèses, somme à réduire ou transfert à préparer. Aucun virement ni opération réelle automatique.

### 21.6 Visualisations propres aux composants, sans supprimer les intentions

T/S/M/L/XL restent des niveaux d'information possibles, pas cinq tailles obligatoires. Chaque fiche livrée précisera défaut, minima, données d'entrée, résultats, actions, source/période, états vide/erreur/périmé, palette et animations. Les IDs historiques restent traçables dans la migration.

| IDs d'origine | Famille cible et distinction utile | Compositions à concevoir et contraintes |
| --- | --- | --- |
| 01 + 16 | Comptes et solde du foyer | Montant daté + liste compacte ; barres signées ; anneaux concentriques centrés pour soldes non négatifs, échelle commune explicitée (max des comptes, pas faux % d'objectif), montants en légende. Si dette, barres signées et explication. Répartition n'est plus une carte doublon par défaut |
| 02 + 03 | Disponible semaine / mois | Deux horizons nommés dans une famille ; semaine = enveloppes/actions, mois = cascade cash→charges→réserves→libre. Ne pas confondre les définitions |
| 04 + 05 | Trajectoire et risques | Courbe ancrée avec annotations permanentes utiles : aujourd'hui, pic/creux, salaire identifié, réserve chiffrée, point bas, estimation finale et fourchette ; petits multiples par compte en grand format |
| 06 | Entrées / sorties | Barres divergentes ou deux tendances alignées ; net séparé, jamais une part de donut additionnée aux flux |
| 07 | Enveloppes | Liste déplaçable, bandes consommé/engagé/restant, anneaux concentriques. Une seule zone centrale, ordre stable, légende précise |
| 08 + 10 | Simulations | Achat ponctuel et scénario récurrent distincts dans la même famille ; formulaire contextuel + avant/après ou trajectoires comparées, pas une carte statique générique |
| 09 + 17 | Échéances et charges | Agenda vertical ou frise datée ; revenus et dépenses distingués ; filtre charges, lien sources et rapprochement |
| 11 + 12 + 13 + 14 + 20 | Projets | Portefeuille compact, projet en vedette optionnel, financement en barre/arc, calendrier des contributions, simulation effort/date ; date d'achat/effort/épargne deviennent détails ou modes du projet, pas cinq répétitions du même montant |
| 15 | Réserve de sécurité | Jauge/bullet + montant protégé, objectif et couverture en durée si dépenses de référence connues ; affectation unique, distincte des réserves des projets |
| 18 | Approvisionner un compte | Frise des manques datés, origine/montant/date proposés et conséquence ; préparer un transfert, ne jamais l'exécuter |
| 19 | Dépenses par payeur | Matrice comptes×catégories et barres comparatives. N'appeler « Qui doit quoi » qu'après modèle de bénéficiaires/partage réellement livré |
| 21 + 22 + 26 | Journal et files de revue | Récentes = liste compacte ; à classer = file d'actions ; atypiques = comparaison avec raison/source. Filtres et workflows distincts, pas le même compteur repeint |
| 23 | Récurrents | Contrats/cadences/revenus réguliers à valider ; comparer montant/date observés. Une règle n'est pas une occurrence d'échéance |
| 24 | Où part l'argent | Barres classées, empilement 100 %, treemap si hiérarchie utile ; drilldown, remboursements et transferts explicités |
| 25 | Rythme semaine | Trajectoire consommé/plafond et jours restants, bandes journalières ; comparaison à jours équivalents |
| 27 | Comparaison | Barres alignées, slopechart pour deux périodes, tableau d'écarts ; mois incomplet signalé et comparable |
| 28 | Qualité des données | Couverture calendrier et fraîcheur par compte, dernier solde confirmé, trous et actions d'import ; pas une note de santé financière |
| 29 + 30 | Outils hors cartes financières | Inspecteur contextuel avec aperçu, bibliothèque, vues nommées, enregistrer/dupliquer/restaurer |

Nouveau besoin **W1** : le cockpit hebdomadaire synthétise dépenses réalisées, capacités restantes par catégorie, échéances et actions de réduction. Il a sa page dédiée « Ma semaine » et une carte de résumé, pas deux moteurs de calcul.

Anneaux concentriques : même centre, départ commun à midi, épaisseur/espacement constants, une série par anneau, 3–5 lisibles puis sélection/agrandissement explicites. Pour budgets/projets, l'angle correspond à consommation/cible propre et la légende le dit ; rayon/aire ne comparent pas des euros. Zéro = aucun arc, cible absente = « À définir », dépassement = marqueur + montant, aucune boucle supplémentaire ambiguë. Ne pas additionner des pourcentages de cibles différentes.

Graphique : limiter les annotations simultanées (par défaut 3–5 significatives), éviter les collisions, distinguer événement observé et attendu, permettre lecture clavier/table de données. Un pic ne devient « salaire » que si les opérations qui le causent le prouvent. Les changements de sélection gardent l'identité du graphique, les trajectoires ne repartent pas artificiellement de zéro.

Les annotations sont ancrées à une date/valeur/identité d'événement, jamais à des pixels : zoom et resize les maintiennent sur la bonne opération. Une lacune de couverture interrompt le segment réel ou le remplace par un segment explicitement hypothétique ; un avertissement seul ne suffit pas à rendre correcte une ligne continue.

### 21.7 Objectifs et journal : détails UX à ne pas oublier

**Objectifs** : une ligne/vignette compacte avec icône, nom, réservé/cible et reste ; expansion intégrée du seul projet choisi. Formulaire dense mais lisible, champs essentiels d'abord et options avancées repliées. Palette d'au moins 24 teintes réellement distinctes dont noir/neutres, couleur personnalisée avec contraste automatique ; accent, texte, piste et fonds secondaires coordonnés. Bibliothèque d'au moins 60 icônes recherchables et groupées, choix « sans icône » ; pas d'images produit obligatoires. Ordre/priorité déplaçables ; mise en vedette indépendante. Cas limites : zéro, cible atteinte/dépassée, échéance passée, libellé long, petit écran, 101 projets. Suppression/archivage expliquent le sort des réserves, avec annulation.

**Journal** : trois densités (compacte/standard/confortable), choix 25/50/75/100/150 indépendant de la densité, pagination synchronisée en haut et bas avec pages proches/ellipses, première/dernière et accès à un numéro. Garder la ligne d'ancrage au changement de taille et le focus cohérent au changement de page ; filtrer remet à la première page, une note éditée ne le fait pas. En-tête persistant, montants lisibles, zéro résultat sans page fantôme. Tout le filtrage/tri/total/export précède la pagination. Ne pas perdre brouillons/sélection à cause d'une densité. Tester page 38 avec données fictives suffisantes, pages hors borne, dernière page partielle et changement de taille au milieu du résultat. Si redimensionnement/masquage de colonnes ajouté, préserver toujours date, identité et montant accessibles.

Sélection : « cette page » ne signifie jamais « tout le résultat ». Identifiants et nombre sélectionnés persistent entre pages/densités ; changer un filtre efface la sélection après avertissement, sans effacer les brouillons. « Exporter les sélectionnées » et « Exporter le résultat filtré » sont distincts. Une action groupée annonce le nombre et le périmètre exact avant validation.

### 21.8 Recherche : références et choix à éprouver

- [React Grid Layout](https://github.com/react-grid-layout/react-grid-layout) : coordonnées/dimensions, responsive, compactage désactivable. Candidat de prototype, pas dépendance installée ni promesse de résultat.
- [Modes GridStack](https://gridstackjs.com/doc/html/types/GridStackMode.html) : comparaison du mode libre ; vérifier les collisions et l'intégration React, pas simplement activer float.
- [Pagination TanStack](https://tanstack.com/table/v8/docs/guide/pagination) : état page/taille partagé entre contrôles. Étudier le coût de migration avant de remplacer la table existante ; virtualisation seulement après mesure.
- [Activity gauge Highcharts](https://www.highcharts.com/samples/highcharts/demo/gauge-activity) : référence visuelle des anneaux concentriques. Ne nécessite pas d'adopter Highcharts ; vérifier licence avant toute éventuelle adoption.
- [WCAG glissement 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) : prévoir une alternative au pointeur sans glissement en plus du clavier.
- [YNAB : revenus futurs](https://support.ynab.com/en_us/assigning-future-income-an-overview-BJsTo0jCq) : utile pour distinguer argent détenu et futur. WealthPilot garde en plus une prévision datée ; le modèle de ce concurrent n'est pas copié tel quel.

### 21.9 Boucle des trois reviewers et notation sur preuves

Pour **chaque lot** : figer critères/fixtures → écrire les tests adversariaux → implémenter → vérifier unités/intégration/navigateur → envoyer aux trois reviewers indépendants → consigner défauts et points non acquis → corriger → nouvelle revue et tests croisés. Ne pas changer les poids pour faire passer une livraison.

Trois avis séparés : **A finance/données**, **B interactions/accessibilité**, **C design/visualisations/responsive**. Chacun note les mêmes critères applicables et peut refuser une preuve hors de son expertise. Désaccord >5 points ou défaut P0/P1 : arbitrage sur reproduction, pas moyenne flatteuse.

Grille de recette produit (100 points) :

| Domaine | Points | Sous-critères scorables, chacun exige un cas et une preuve |
| --- | ---: | --- |
| Données et finances | 25 | Import/doublons/ancrages 5 ; périmètres/transferts 5 ; revenus/charges/point bas 5 ; semaine 5 ; simulation sans double compte 5 |
| Liberté de placement | 20 | Coordonnées/trous 5 ; resize/collisions 5 ; migration/persistance 5 ; instances/vues/sources 5 |
| Enveloppes et visualisations | 15 | Drag complet 5 ; anneaux exacts 5 ; variantes sémantiques cohérentes 5 |
| Journal | 15 | Densité/25–150 5 ; pagination directe synchronisée 5 ; filtres/export/brouillons 5 |
| Objectifs/compositions | 10 | Éditeur compact/palette/icônes 5 ; utilité par composant/tailles/cas limites 5 |
| Accessibilité | 10 | Clavier/focus/alternative sans drag 5 ; contraste/zoom/VoiceOver 5 |
| Performance/stabilité | 5 | Recherche mesurée 2 ; gestures/traces/animation 2 ; stabilité/rechargement 1 |

Chaque sous-critère à 5 points : 1 contrat et fixture ; 2 comportement correct sur cas normal **exécuté** ; 1 cas limite exécuté ; 1 preuve persistante/revue indépendante. Sous-critères 2/1 points : même exigences, score entier attribué seulement si toutes les preuves correspondantes existent. Code présent sans exécution n'obtient pas les points de comportement ; test absent ou état non vérifié = zéro pour cette part.

**Passage : chaque reviewer ≥95/100 sur le périmètre gelé, aucune perte/corruption de données, aucun calcul critique faux, aucun P0/P1 ouvert, aucune fonction principale inaccessible.** Une moyenne ≥95 ne masque pas un reviewer à 80. Pour un lot partiel, publier points acquis/points applicables et conversion en pourcentage, mais maintenir à zéro les fonctions non livrées dans le score global V1. Ne pas exclure a posteriori une exigence du lot. 100 veut dire tous les critères testés satisfaits, pas absence garantie de tout bug.

Matrice minimale : 390/768/1512/2560/3840 px, zoom 200 %, clavier et VoiceOver, reduced-motion ; 0/1/3 comptes, 0/1/101 objectifs, 1 500/10 000/50 000 opérations, 30 instances ; trous de couverture, soldes négatifs, semaine intermois, salaire retardé, doublons légitimes et remboursements. Toutes les tailles/variantes promises ont une fixture ; tester les interactions croisées critiques, pas seulement les rendus isolés.

Performance cible **à mesurer** sur machine/navigateur documentés : recherche/filtre p95 ≤200 ms, aucun travail principal >50 ms pendant un geste représentatif, zéro calcul financier par mouvement du pointeur. Joindre protocole, nombre de répétitions et traces. Vidéo ou captures horodatées avant/pendant/après ; ne pas qualifier trois images après stabilisation de preuve de fluidité.

Protocole fixe : jeux fictifs déterministes et graine enregistrée, build production, machine/navigateur/viewport/cache documentés ; cinq échauffements puis trente mesures par scénario/volume. p95 = observation de rang plafond(0,95×30)=29 après tri, publier aussi médiane et pire cas. Mesurer input→rendu stabilisé sans temps humain ; traces des déplacements et mise à jour des graphiques, reduced-motion séparé. Mesurer à nouveau après correctif, sur les mêmes jeux et conditions.

**Cette étape n'est pas une livraison UI.** Le plan peut être évalué séparément (couverture du retour 30, contrats vérifiables 25, dépendances/migration 20, sûreté et limites 15, grille/protocole 10). Ce score de cadrage ne sera jamais présenté comme celui de l'application.


### 21.10 Consolidation du 4 octobre : périmètre et contrôles

Le candidat consolidé contient **1 508 opérations** : 1 029 Anthonny, 381 Mirane (nom historique conservé) et 98 Conjoint. Les 259 lignes des trois relevés se répartissent en 136 correspondances avec l'ancien consolidé et 123 ajouts : 12 Anthonny, 13 Mirane, 98 Conjoint. Aucune ligne rejetée au parsing ; montants signés, devise EUR, encodage source Windows-1252. Aucun doublon supprimé sur la seule égalité date/montant.

Les 251 soldes journaliers préexistants concordent au centime avec la reconstruction depuis les trois observations du **2 octobre**, sans écriture d'ajustement. Les soldes détaillés et identifiants bancaires sont conservés dans le dossier privé voisin, pas dans ce brief versionnable. Le champ daily_balance contient un solde de fin de journée une fois par compte/date, jamais la somme de plusieurs soldes.

Treize paires de virements conjoint/personnel sont identifiées par preuve de compte destinataire, montants opposés et rapprochement unique. Les deux mouvements restent présents ; seuls les marqueurs internes concernés changent, avec journal des anciens marqueurs. Une simple coïncidence date/montant restaurant/crédit a été explicitement rejetée. Les catégories enrichies existantes sont préservées. **75 opérations nouvelles restent à catégoriser** : aucune précision artificielle n'est attribuée aux cas incertains, notamment un nouveau payeur de crédit. Le champ récurrent N des ajouts non confirmés n'est pas une preuve qu'ils ne se répéteront pas.

Le compte de l'épouse reste nommé **Mirane**, cohérent avec le relevé et 36 correspondances historiques. Le prénom « Yaren » évoqué oralement n'est pas appliqué silencieusement. Un alias d'affichage pourra être confirmé sans créer un nouveau compte.

Limites de couverture : soldes observés au 2/10 ; les 3–4/10 ne sont pas documentés par des opérations ajoutées. Le conjoint n'a une couverture fournie qu'à partir du 4 avril, donc le total foyer janvier–mars est incomplet. Les futurs relevés/photos pourront compléter, sans inventer les dépenses manquantes.

Contrôle avec le parseur de l'app : 1 508 candidates, zéro erreur ; une seconde présentation du même fichier produit **1 508 doublons reconnus et zéro ajout**. L'actualisation des comptes/soldes du navigateur n'est pas effectuée : D1 est nécessaire pour reprendre les checkpoints automatiquement.

État de livraison : **consolidé remplacé après revue indépendante et sauvegarde récupérable de l'original**. Chemin canonique : `../data/transactions_2026_consolidated.csv`. Archive privée : `../data/reconciliation-2026-10-04/` (ancien consolidé, trois relevés bruts, rapprochements et rapport). Empreinte finale : `5bb23e72595cad0a885462ad8840e4f6aba0628afb1bf0fe00edd10b736ced08`. Sources d'origine non modifiées. Les copies historiques situées ailleurs dans life_os ne sont pas réécrites silencieusement.

Revue financière indépendante : 25 assertions sur le candidat ont passé, dont égalité exhaustive des opérations, contrôles de multiplicité, dates/centimes, seuls champs historiques autorisés changés, 13 paires de transferts neutres, reconstruction inverse et directe et 251 anciens soldes. Les tests de l'app passent **184/184 avec le nouveau CSV** ; le test privé a été actualisé pour 1 508 lignes / 3 comptes et vérifie le réimport. Cela ne valide pas encore le futur import SG et ses checkpoints dans le navigateur.

### 21.11 Résultat de la revue du plan (pas du produit)

| Reviewer | Première lecture | Seconde lecture | Réserves / suites |
| --- | ---: | ---: | --- |
| Finance et données | 91/100 | **96/100** (29+24+19+14+10) | Préciser les paramètres finaux des scénarios, remboursements et semaines atypiques avant F1/W1 ; aucun salaire réel inventé |
| Interactions et accessibilité | 93/100 | **99/100** (30+25+19+15+10) | Ambiguïté vues G2/V1 retirée après cette note ; conserver recette des trois sources en plus du simple réimport final |
| Design et responsive | — | **97/100** (30+22+20+15+10) | Ordre clavier spatial, ancrage date/valeur et rupture des segments incomplets ajoutés après cette note |

Les trois scores du **cadrage** dépassent 95. Les corrections des derniers points sont consignées sans gonfler rétroactivement les notes. À la clôture du cadrage, les nouvelles fonctions restaient à réaliser ; leur état d'implémentation est désormais suivi en section 22. La consolidation obtient **25/25** sur sa propre grille, distincte des 100 points de l'application : intégrité 5, exhaustivité 5, soldes 5, classification prudente/transferts 5, provenance/sauvegarde 5. Après remplacement, 13 contrôles indépendants de livraison confirment les empreintes du canonique, de la sauvegarde et des trois sources, l'absence de modification des originaux et les permissions privées des archives. Cette note ne signifie pas que les 75 opérations incertaines ont été catégorisées ni que l'interface a été validée.

## 22 Implémentation et recette du 4 octobre 2026

Cette section remplace le statut « à réaliser » des lots de section 21, sans réduire leurs critères. Le code est dans `apps/wealthpilot`. La base locale de l'utilisateur n'a pas été modifiée par les tests ; ceux-ci utilisent des contextes de navigateur isolés et des opérations fictives. Le consolidé privé reste à son emplacement canonique voisin. Ni commit ni publication distante n'ont été effectués.

### Fonctionnalités implémentées

| Lot | Résultat disponible | Contrôles et limites |
| --- | --- | --- |
| D1 et D2 | Import SG Windows-1252, préambule, compte bancaire stable, soldes observés datés et choix explicite en cas de conflit ; import de métadonnées même sans nouvelle opération ; chevauchements avec multiplicité ; retrait de lot préservant les faits partagés ; checkpoints historiques et couverture | Tests des achats identiques distincts, réimport, conflits, édition concurrente et retrait de lots ; ancrage identique à date donnée entre fenêtres. Les jours sans relevé ne deviennent pas vérifiés. |
| F1 | Prévision quotidienne central/prudent/favorable, revenus et charges à leur date, réserves séparées, point bas, couverture incertaine, annotations et fourchette | Les bandes sont des scénarios, pas une probabilité de 95 %. Un revenu passé n'est pas ressuscité en décalant un scénario. Les engagements confirmés ne reçoivent pas arbitrairement une dispersion de 15 %. |
| W1 et S1 | Page Ma semaine, proposition issue de l'historique, limites modifiables par périmètre, plafonds mensuels respectés, trésorerie commune aux catégories ; simulateur montant/date/catégorie/payeur, achat inclus ou supplémentaire | Impayés protégés ; semaine intermois ; dépenses d'un autre payeur réduisant le plafond commun ; réserve de projet ; salaire avant ou après charge ; aucun mouvement réel créé. Un texte libre préremplit les champs, il ne remplace pas la confirmation. |
| G0 à G2 | Grille de 24 colonnes sans compactage : positions libres et trous persistants ; tailles physiques liées au contenu ; les cartes voisines se décalent lorsqu’une carte occupe leur place ; clavier et placement sans glissement | La hauteur s’adapte au contenu sans défilement vertical interne. Les réglages remplacent temporairement le contenu de la carte, sans imposer leur hauteur à la sauvegarde. Migration non destructive, concurrence, annuler/enregistrer et duplication indépendante. |
| B1 | Réorganisation directe des enveloppes ; liste et anneaux concentriques de même centre ; réallocation atomique entre enveloppes | Les budgets de compte restent inclus dans le budget foyer, pas additionnés. Une réallocation ne peut pas prendre la partie déjà dépensée ou engagée. |
| T1 | Journal avec trois densités, 25/50/75/100/150 lignes, pagination haute et basse, accès direct, première/dernière, conservation des brouillons et sélection | Tests sur 6 000 opérations, page 38, ancrage au changement de taille, filtres/export avant pagination. Recherche locale approximative sans envoyer de libellés bancaires à un moteur distant. |
| O1 | Un éditeur intégré par projet, compte/date/priorité, vedette indépendante, 70 icônes recherchables, 28 couleurs et couleur personnalisée | Contraste automatique de l'icône, petit écran, 101 projets, conflit concurrent et annulation. L'ensemble des contrats avancés de projets de section 5.5 n'est pas encore livré. |
| Pages spécialisées | Budgets, Prévisions, Objectifs, Comptes, Analyse, Foyer, Récurrents, Calendrier, Catégories et règles ; bibliothèque dans la grille | Les routes exécutent leurs fonctions, pas des pages « bientôt ». Leur présence ne signifie pas que chaque exigence V1 de section 5 est terminée. |

Les récurrences distinguent suggestions détectées et règles confirmées : sources, cadence, montant, pause, fin et occurrence ignorée. Le calendrier propose mois/semaine/agenda, échéances et rapprochement avec opération réelle ; une occurrence exceptionnelle n'altère pas la cadence suivante. Le partage du foyer repose sur des pourcentages explicitement choisis, jamais sur un 50/50 implicite. Les catégories possèdent des identifiants stables, sous-catégories, couleur/icône, archivage et fusion avec aperçu ; les règles proposent un classement réversible et protègent les corrections manuelles.

### Corrections issues des contre revues

Les agents ont exécuté des cas adversariaux, puis une autre passe a vérifié les corrections : erreur de redimensionnement de la grille ; collision revenant au mauvais emplacement ; brouillon perdu au changement de semaine ; seconde sauvegarde de partage refusée à tort ; ancien revenu décalé dans le futur ; capacité hebdomadaire ignorant le calendrier des revenus ; plafond mensuel dépassé par une médiane hebdomadaire ; achat prévu compté deux fois entre compte et foyer ; impayé ancien non protégé ; centime attribué à une catégorie explicitement à zéro ; virement futur consommant à tort une enveloppe. Ces défauts ont des tests de non-régression. Une capture prise pendant la transition de largeur a aussi révélé des chevauchements transitoires ; la transition de changement d'écran est supprimée, sans supprimer les gestes d'organisation.

### Structure du code et vérification reproductible

- `importer.ts`, `import.worker.ts`, `coverage.ts`, `store.ts` : parsing, provenance, ancrage, persistance et validation des sauvegardes.
- `forecasting.ts` : moteur commun aux prévisions, à la semaine et au simulateur. Tous les montants sont des centimes entiers ; les vues n'ont pas leur propre formule financière divergente.
- `layout.ts`, `DashboardBoard.tsx`, `BoardInstanceContext.tsx` : modèle de grille, migration, interaction et état propre à chaque instance.
- `TransactionsPage.tsx`, `Planning.tsx` et pages spécialisées : formulaires contextuels et actions explicites. Les nouvelles pages spécialisées sont chargées à la demande ; React et le moteur de placement sont séparés en bundles stables.
- `category-rules.ts` et `category-definitions.ts` : classification et modifications d'arborescence sans changer le total des opérations.

Depuis `apps/wealthpilot` : `npm test`, `npx tsc --noEmit`, `npm run build`, `npm run format:check`. Les scripts navigateur attendent un serveur de test local au port 5201, distinct du serveur utilisateur. `scripts/action-plan-qa.mjs`, `scripts/grid-qa.mjs` et `scripts/pages-visual-qa.mjs` créent chacun un stockage isolé. `scripts/performance-qa.mjs` mesure un build production servi au port 5203. Les sources CSV privées ne sont jamais utilisées comme fixtures de performance.

Les preuves locales se trouvent dans `tmp/action-plan-qa`, `tmp/grid-qa`, `tmp/pages-visual-qa` et `tmp/performance-qa` : résultats JSON, captures et vidéos. Ce dossier est ignoré par Git pour éviter une publication accidentelle ; les scripts sont reproductibles et versionnables. Les maquettes de référence restent dans `design` et sont synchronisées dans l'espace Références de l'application. Sauvegarder le dépôt seul ne sauvegarde pas l'IndexedDB du navigateur : utiliser l'export de données de l'application.

### Éléments restant ouverts avant une V1 complète

La recette finale ne doit pas confondre couverture du code, score du lot courant et V1 entièrement livrée. Les exigences suivantes restent à implémenter ou à vérifier exhaustivement, sans les retirer du brief :

- Ventilation d'une opération avec conservation du total, exclusion analytique motivée et traçabilité complète de toutes les corrections du journal.
- Historique des contributions aux projets et clôture explicite après achat ; compositions avancées propres à chaque famille et interactions testées dans chaque taille annoncée.
- Propriétaire/type/archivage des comptes, rapprochement visuel complet des transferts ; règles de partage fixes ou proportionnelles aux revenus et bénéficiaires distincts du payeur.
- Report budgétaire choisi, scénarios appliqués au plan avec aperçu distinct, scénarios superposés au calendrier et comparaisons analytiques à durée strictement comparable.
- Conventions de période financière et réglages avancés. Les exports locaux restent non chiffrés ; aucun chiffrement ni synchronisation multiutilisateur n'est promis.
- Recette VoiceOver réelle, zoom navigateur natif et couverture exhaustive des variantes/tailles. Un contrôle de focus et un zoom CSS ne les remplacent pas.

**Le seuil de passage est inchangé : chacun des trois reviewers doit atteindre 95/100 et aucun défaut critique ne doit rester ouvert. Une réussite des tests ou une page supplémentaire ne vaut pas validation automatique de toute la V1.** Les scores définitifs et dernières mesures sont consignés à la clôture de la recette, pas déduits des anciennes notes de cadrage.

### Ancienne recette invalidée par le retour utilisateur

Les notes précédentes de 95/96/96 sont retirées comme preuve de qualité du produit. Le retour utilisateur et sa reproduction ont établi des régressions majeures : molette capturée par les cartes, contenu coupé, tailles de détail découplées des dimensions physiques, déplacement refusé au contact des voisines et annotations de revenus incomplètes. Les contrôles précédents n’exerçaient pas correctement ces exigences. Aucune nouvelle note globale ne les remplace ; les preuves ci-dessous sont historiques et ne valident pas la nouvelle version.

Vérification finale locale : **324 tests réussis sur 34 fichiers**, dont le test du CSV privé exécuté explicitement et sans afficher ses opérations ; TypeScript, build de production, Prettier et contrôle des espaces Git réussis. Les avertissements Radix `use client` ignoré restent informatifs pour cette application Vite côté client. Les dépendances de l'ancien moteur de glissement devenues inutilisées ont été retirées. Le chunk applicatif principal passe d'environ 980 Ko à 447 Ko minifiés grâce aux pages chargées à la demande et au découpage des bibliothèques ; le poids total n'est pas divisé d'autant, les bibliothèques sont déplacées dans des chunks réutilisables.

Preuves navigateur persistantes : 42 contrôles dans `tmp/action-plan-qa/results.json` ; 15 contrôles de grille dans `tmp/grid-qa/results.json` ; 16 contrôles de pages dans `tmp/pages-visual-qa/results.json` ; 8 contrôles de réorganisation des budgets dans `tmp/budget-interaction-qa/results.json` ; 9 contrôles clavier/palettes et 440 textes sans échec de contraste mesuré dans `tmp/palette-keyboard-qa`. Ce dernier échantillon ne constitue pas un audit WCAG exhaustif. Les vidéos réelles sont référencées par les manifestes des tests de grille et de budget.

Recherche finale sur Apple M5 Pro, macOS Darwin 25.6.0 ARM64, Chromium 153, viewport 1512×982, build production et jeux synthétiques déterministes : cinq échauffements puis trente mesures par volume. p95 input→rendu stabilisé : **34,1 ms / 49,6 ms / 116,3 ms** pour 1 500 / 10 000 / 50 000 opérations, sous la cible de 200 ms. Neuf pages chargées à la demande ont aussi été ouvertes avec succès dans ce build. Rapport et empreinte du build : `tmp/performance-qa/results.json`.

Gestes : trente instances de solde sur deux comptes, cinq échauffements puis trente mesures, intervalle entre frames p95 de 17 ms ; trace réanalysée indépendamment, tâche principale maximale de 44,277 ms, aucune supérieure à 50 ms. Dix fonctions financières instrumentées sur cinq replays donnent cinquante compteurs nuls pendant les mouvements. Le bundle profilé et ses sourcemaps sont archivés avec la trace dans `tmp/grid-performance-qa` ; ce scénario ne prétend pas mesurer trente familles de cartes différentes ni toutes les machines.

## 23 Correction des régressions de composants

Le contrat actif remplace le refus des collisions décrit dans les anciennes étapes de grille. Mini, Petit, Moyen, Grand et Très grand modifient ensemble l’encombrement et le contenu utile. Sur portable, le gabarit Mini occupe 6 colonnes et 14 lignes, contre 12 colonnes et 28 lignes pour Moyen ; la hauteur peut ensuite grandir pour montrer intégralement le contenu. Le déplacement garde l’ancrage choisi et les coordonnées horizontales des voisines ; seules les cartes en conflit descendent. Aucune réorganisation automatique ne remplit les trous volontaires.

La page possède le défilement vertical. Les cartes n’ont plus de région verticale défilante, ni de hauteur à 100 % qui cache des lignes. Leur contenu est mesuré, sans réenregistrer la hauteur temporaire d’un formulaire. La mise à niveau des anciennes dimensions s’effectue en mémoire ; les données financières et la sauvegarde précédente ne sont pas réécrites à l’ouverture. Enregistrer une disposition applique la nouvelle géométrie.

Les compositions compactes réduisent réellement l’information : Mini montre une valeur et son contexte ; Petit affiche une courte liste ; les tailles supérieures ajoutent les éléments pertinents et les références. Les budgets proposent par défaut 2, 3, 5 ou 8 enveloppes suivant leur taille, avec affichage étendu sur demande. Les objectifs larges et les budgets larges utilisent plusieurs colonnes lorsque la largeur le permet. Les anneaux partagent un centre et une légende ; les valeurs signées ne sont pas représentées comme des parts positives.

La courbe explique les mouvements de tous les comptes sélectionnés : revenus, aides, sorties importantes, transferts, pics et creux. Un revenu exceptionnel ne supprime plus une série mensuelle stable ; il ne devient pas pour autant un revenu récurrent. Les sources observées une seule fois ne sont pas extrapolées comme salaires certains. Chaque repère ouvre le détail du jour dans la carte.

Dashboard est la première entrée du dock. Ma semaine a une icône calendrier et commence sur la semaine à venir. Son budget et ses catégories sont visibles immédiatement ; simulation, calcul détaillé et édition s’ouvrent dans la page sur demande.

La nouvelle recette repose sur `scripts/layout-regression-qa.mjs` (cartes mixtes, gestes réels, molette, tailles, conservation après rechargement), `scripts/layout-usability-baseline.mjs` (familles et tailles, détection de contenu coupé), `scripts/week-readability-qa.mjs` et `scripts/chart-explanation-qa.mjs`. Les captures avant/après, résultats JSON et vidéos restent locaux dans `tmp`. Les tests des anciennes collisions refusées ont été remplacés par ceux du déplacement des voisines, pas conservés comme un critère de réussite contradictoire. Cette recette vérifie les régressions décrites ; elle ne certifie pas toutes les exigences V1 ni une satisfaction esthétique chiffrée.

### Vérification de cette correction

La suite complète passe 350 tests ; le contrôle du CSV privé, exclu par défaut, passe aussi lorsqu’il est activé explicitement. TypeScript, formatage et build de production passent. Les trois contre-relectures ont notamment découvert puis vérifié la correction de conflits de sauvegarde injustifiés entre cartes différentes, de la perte d’un brouillon lors du passage sur petit écran et de budgets enregistrés sur un nouveau périmètre après changement de filtre. Les véritables conflits sur le même champ restent protégés.

Le build de production a été contrôlé à 1512×982 et 3840×982 : 30 familles, 132 tailles à chaque largeur, aucun conteneur vertical défilant visible à l’intérieur des cartes. Le contrôle inspecte tous les descendants visibles, pas seulement l’ancien nom de classe du scroller. La molette au-dessus d’une carte fait avancer la page de 400 px. Les rapports et captures sont dans `tmp/layout-production-1512` et `tmp/layout-production-3840`. Le rail horizontal des repères du graphique reste volontairement défilant et accessible au clavier ; les sélecteurs ouverts d’icônes ou de projets restent des contrôles de choix défilants.

Les recettes d’interaction donnent 16 contrôles de grille mixte, 15 de déplacement/redimensionnement et annulation, 11 de semaine, 8 de brouillons intégrés et 13 de graphique, tous réussis. Ces nombres décrivent des contrôles exécutés, pas une note de qualité. Les captures ont été examinées notamment pour les soldes, objectifs, budgets, courbe et semaine ; elles ne constituent pas un jugement esthétique exhaustif de chaque combinaison. Certaines cartes simples ont encore des variantes Moyen/Grand/Très grand proches en contenu : leur différenciation complète reste ouverte, sans remettre un faux 95/100 sur l’ensemble.

## 24 Réactivité et recette des composants du 5 octobre 2026

Cette passe conserve la direction visuelle et les données existantes. Elle traite la lenteur des pages et des cartes, les gestes sans prévisualisation, le dock personnalisable et les représentations propres aux composants. Les recettes antérieures restent historiques : leurs scores ne sont pas réutilisés pour déclarer la V1 terminée.

### Comportements livrés

- **Réactivité.** Une lecture atomique de la base conserve les références des tables inchangées. Les prévisions et agrégats financiers sont réutilisés par périmètre, période et date ; changer une présentation ne relance plus tous les calculs. Modifier une opération, un compte, un budget, une échéance ou une préférence financière invalide les résultats concernés. Un changement de jour ou le retour dans l’application actualise les prévisions.
- **Grille.** Les voisines se déplacent pendant le glissement, avant le relâchement. Échap restitue les positions initiales, y compris sur WebKit. Les dimensions s’appliquent sans transition de largeur/hauteur ; la mesure du contenu évite le découpage au premier rendu. Les trous volontaires restent libres et la page garde le défilement vertical. Les déplacements conservent une courte transition, désactivée pour les changements de taille hors geste.
- **Budgets.** Déplacer une enveloppe réordonne immédiatement la liste pendant le survol ; le relâchement enregistre, Échap annule. Les vues Liste, Anneaux concentriques, Marges et Enveloppes répondent à des questions différentes : détail, consommation relative, disponible signé et montant encore utilisable par catégorie.
- **Visualisations.** Quinze familles proposent au total 51 vues effectivement activables. Les flux ont une cascade signée ; les échéances une chronologie ; les catégories une grille de 100 unités avec reste « Autres » ; les objectifs une lecture progression/cible ; l’évolution du solde une trajectoire, une surface ou des soldes quotidiens. Une valeur négative n’est pas transformée en part positive. Une cible ou une date absente ne produit pas un graphique trompeur. Les petites tailles gardent la vue choisie lorsqu’elle est pertinente ; Mini reste une synthèse.
- **Dock.** Cinq pages épinglables et un bouton Plus, chacune avec son icône. Épinglage, retrait et ordre sont persistants ; toutes les destinations restent accessibles. Les sauvegardes concurrentes ne remplacent pas silencieusement les préférences d’un autre onglet. La navigation remet le focus dans la page sans effacer les brouillons ni voler une saisie commencée.
- **Lisibilité.** Les actions actives s’adaptent au fond de la carte. Les synthèses du graphique se réorganisent sur petite largeur ; les grands objectifs ajoutent échéance, effort et durée sans agrandir inutilement une jauge. Les couleurs automatiques sont différenciées, les couleurs explicites des objectifs préservées.

### Recette indépendante et preuves

Trois agents ont relu séparément les finances, les interactions et les visualisations. Ils ont utilisé des comptes fictifs et, pour l’import financier, le CSV privé consolidé. Les sessions de recette sont isolées : elles ne remplacent pas les données du navigateur utilisateur. Les captures et vidéos sont synthétiques ; aucune opération privée n’y est exposée.

| Périmètre exécuté | Résultat vérifié |
| --- | --- |
| Import privé et concurrence | 1 508 opérations, trois comptes ; conservation exacte, rechargement, réimport bloqué, fichier source inchangé ; 11 contrôles réussis |
| Contrats financiers dans le navigateur | 21 contrôles réussis, dont périmètres, revenus/échéances et changement de date |
| Dock Chromium et WebKit | 43 contrôles réussis par moteur : destinations, icônes, clavier, focus, ordre et persistance |
| Interactions d’une grille mixte | 11 contrôles par moteur, 30 cartes de 15 types et 1 500 opérations ; 20 changements de taille et 20 changements de vue vérifiés à la première image |
| Brouillons intégrés | 8 contrôles réussis, navigation et changements de disposition compris |
| Familles et tailles | 30 familles, 132 gabarits sur chacune des largeurs 1 024, 1 512 et 3 840 px, soit 396 vérifications ; aucun défilement vertical interne |
| Variantes graphiques | 582 activations au pointeur et 45 rechargements sur trois largeurs ; 194 activations avec Entrée et 15 rechargements supplémentaires au clavier |
| Parcours transversaux | 42 contrôles d’import/pages/responsive, 15 de grille, 18 de régression mixte ; contrôles des pages et transactions également rejoués |

Mesures sur le poste de développement, build de production, après cinq échauffements puis vingt essais : navigation p95 **17 ms sur Chromium, 28 ms sur WebKit** ; changements de taille p95 **17 ms**, de vue **16 ms** dans les deux moteurs lors du dernier rejeu. Le protocole vérifie le contenu et les chevauchements dès la première image, pas seulement la fin d’une animation. Ces mesures ne garantissent pas la même latence sur tous les appareils ou volumes de données.

Les retours ont réellement produit des boucles rouge → correction → contre-test : absence de déplacement des voisines avant relâchement, découpe à la première image, chevauchement pendant une transition, annulation Échap défaillante sur WebKit, synthèse du graphique coupée à 1 024 px, boutons actifs insuffisamment lisibles, graduations trop proches et couleurs de catégories répétées. Une dernière capture a aussi révélé que le survol générique pouvait écraser le fond d’un bouton actif : les deux règles concernées excluent désormais les boutons déjà sélectionnés. Les résultats avant correction sont conservés lorsqu’un script les a produits.

Les preuves sont locales dans `tmp/` à la racine du dépôt : `mixed-interaction-qa`, `mixed-interaction-qa-webkit`, `dock-qa`, `dock-qa-webkit`, `inline-editor-qa`, `chart-explanation-qa`, `financial-completion-qa`, `visualization-variants-verified-1024`, `visualization-variants-verified-1512` et `visualization-variants-verified-3840`. Les scripts reproductibles restent dans `apps/wealthpilot/scripts`. Les rapports identifient leurs builds : la matrice complète et les contre-tests ciblés ne prétendent pas avoir tous été exécutés sur une seule empreinte.

### Code, tests et limites

Le code sépare lecture stable, calculs partagés, géométrie, navigation et rendus graphiques. Les anciens styles du dock ont été retirés. Les micro-tests redondants des imports, marchands, calculs et sauvegardes ont été regroupés en parcours métier ; les contrôles CSV, argent, conflits et sauvegardes restent présents. Aucun test n’a été masqué pour améliorer une note.

**La réduction globale par dix du code et le souhait de 30–40 tests ne sont pas atteints.** Les nouvelles fonctionnalités et recettes ajoutent du code malgré la suppression de doublons. La simplification obtenue concerne surtout les recalculs et les responsabilités ; elle ne constitue pas une division du nombre de lignes. Le cache suppose des instantanés immuables et compare encore les tables lors des mises à jour : ce coût reste à profiler sur de très gros imports avant toute optimisation supplémentaire.

Les contrôles ne certifient ni VoiceOver à l’écoute, ni les gestes d’un appareil tactile physique, ni toutes les combinaisons possibles de données, fonds et dimensions. WebKit automatisé n’est pas Safari natif sur chaque appareil. Les cartes à indicateur unique n’ont pas reçu cinq vues artificielles ; certaines tailles de cartes simples restent proches en information. L’appréciation esthétique globale et la validation de toute la V1 restent distinctes des notes de recette ci-dessous.

### Barèmes des contre-relectures

Ces scores portent sur des contrats énumérés et exécutés, **pas sur une note globale de beauté ou de complétude du produit**. Un point signifie que le contrôle correspondant est passé ; il ne remplace pas une validation utilisateur.

**Finances : 25/25, soit 100/100 sur ce protocole.** Cinq critères valent cinq points chacun ; les cinq contrats de chaque ligne valent un point chacun.

| Critère | Cinq contrats vérifiés | Points |
| --- | --- | ---: |
| Import | Centimes/dates conservés ; doublons distingués des achats légitimes ; métadonnées contrôlées ; ancrages reconstruits explicités ; import privé et réimport vérifiés | 5/5 |
| Soldes | Reconstruction autour de l’ancrage ; inconnu conservé ; périmètres cohérents ; virements internes neutres pour le foyer ; réserves non déduites deux fois | 5/5 |
| Prévisions | Revenus positifs séparés ; récurrence non inventée ; chronologie respectée ; plafonds semaine/mois ; engagements comptés une fois | 5/5 |
| Persistance | Import atomique ; annulation cohérente ; restauration non destructive ; conflit réel rejeté avec brouillon ; changements indépendants fusionnés | 5/5 |
| Actualisation | Présentation sans recalcul ; faits financiers invalidants ; égalité avec calcul direct ; isolation compte/période/date ; changement de jour et base reflétés sans recharge | 5/5 |

**Interactions : 100/100 sur ce protocole.** Navigation et icônes 15/15 ; épinglage/ordre/persistance/conflits 20/20 ; clavier/focus 15/15 ; déplacement avant relâchement et annulation 15/15 ; tailles/vues à la première image 15/15 ; brouillons 10/10 ; seuils de latence 5/5 ; contre-test WebKit 5/5. Les rapports `dock-qa`, `mixed-interaction-qa` et leurs versions WebKit, ainsi que `inline-editor-qa`, contiennent les assertions correspondantes. Les défauts de première image et d’Échap avaient fait échouer cette recette avant correction.

**Visualisations : 95/100 sur ce lot.** Le barème et les points non acquis restent explicites :

| Critère | Preuves et réserves | Points |
| --- | --- | ---: |
| Sémantique | Signes, totaux, reste « Autres », cascade, dates, cibles et échéances dépassées ; tests négatifs ; couleur commune budget/analyse | 25/25 |
| Pertinence | 51 vues sur 15 familles ; −1 pour certaines tailles L/XL encore trop proches et aérées avec peu de données | 19/20 |
| Lisibilité | 396 gabarits sur trois largeurs ; aucun scroll interne ni découpe constaté dans les nouvelles vues ; graduations corrigées | 25/25 |
| Interaction et sauvegarde | 582 activations pointeur, 194 avec Entrée, 60 rechargements de contrôle | 15/15 |
| Palettes et accessibilité | 40 contrôles de survol sur cinq fonds ; −1 chacun pour la matrice palettes exhaustive absente, le parcours Tab exhaustif absent, VoiceOver natif non testé et le zoom navigateur natif non testé | 11/15 |

Le dernier contre-test de survol, sur `index-bLcGeFLp.js`, passe 40/40 contrôles : quatre vues de budget et quatre vues de solde sur cinq fonds. Les contrastes minimaux mesurés des boutons actifs sont 12,97:1 et 10,42:1 respectivement. Rapports : `tmp/visualization-hover-budgets/report.json` et `tmp/visualization-hover-balance/report.json`. Les captures corrigées des flux, catégories, budgets et soldes se trouvent dans `tmp/visualization-corrected-*-1512` ; la passe clavier dans `tmp/visualization-variants-keyboard-1512`. L’examen visuel humainement interprété porte sur ces captures représentatives ; les contrôles géométriques, eux, couvrent la matrice annoncée. Le seuil des trois protocoles est atteint, sans déclarer que toute combinaison ou toute la V1 a été validée.

### Vérification de livraison

Le dernier rejeu complet passe **265 tests sur 42 fichiers**, contrôle du CSV privé activé explicitement ; TypeScript, build de production et formatage passent. Ce nombre remplace les 350 tests de la section précédente pour cette révision, sans prétendre atteindre la cible de 30–40. La dernière régression détectée par la suite complète — identité de couleur différente entre budget et analyse — a été corrigée par une palette commune au foyer, indépendante du classement affiché. Son test vérifie maintenant les quatre vues du budget, au lieu d’être supprimé.

Pour reproduire depuis `apps/wealthpilot` : `npm run format:check`, `npm run build`, puis `npm test`. Le test privé exige la variable `WEALTHPILOT_PRIVATE_CSV` pointant vers le CSV local ; ne pas copier son contenu dans un rapport public. Les scripts navigateur démarrent des contextes isolés ; `mixed-interaction-qa.mjs` utilise les serveurs locaux 5201 pour les données synthétiques et 5203 pour la production, puis `QA_ENGINE=webkit` permet le second moteur. Ne pas réutiliser le profil personnel du navigateur pour ces recettes.

## 25 Recentrage demandé le 5 octobre : pas de validation esthétique acquise

### Périmètre et décisions qui remplacent les anciennes

Quatre pages uniquement : **Dashboard, Ma semaine, Transactions, Import CSV**. Dashboard est la première entrée du dock ; les quatre destinations ont une icône. Pas de menu « Toutes les pages » réintroduisant les douze destinations retirées. Les anciennes URL ne doivent pas afficher un ancien écran. La sauvegarde/restauration reste un outil intégré à Import CSV, pas une cinquième page. Les réglages utiles des comptes et échéances restent intégrés au dashboard plutôt que des liens morts.

Retirer de l’interface et du catalogue les cinq familles liées aux objectifs : Mon objectif, Tous mes objectifs, Date d’achat estimée, Effort d’épargne et Réserves par projet. Elles ne sont pas à améliorer maintenant : leur future conception attendra. Les anciens rendus de cartes sont retirés ; les données de projets, réserves, contributions et sauvegardes restent conservées. Le retrait visuel ne libère donc pas artificiellement l’argent réservé. Les anciens identifiants restent lisibles pour pouvoir restaurer les sauvegardes. Aucune écriture de migration n’est effectuée au simple chargement ; enregistrer une disposition n’y réintroduit pas les cartes retirées.

**Le dashboard actuel n’est pas approuvé.** Les représentations génériques et le moteur de placement sont à reconcevoir, pas à déclarer acceptés parce que leurs dimensions passent un test. Ce recentrage ne livre pas encore leur remplacement complet. L’ancienne page Ma semaine reste provisoire jusqu’au choix d’une nouvelle proposition ; aucune nouvelle page Semaine ne doit être implémentée avant ce choix.

Les palettes deviennent des ensembles de couleurs : fond, texte principal, texte secondaire, surface interne, contour, focus, action, séries graphiques. Au moins douze palettes sélectionnables, dont plusieurs foncées et plusieurs colorées. Changer le fond doit changer ces rôles ensemble. Les identités de catégories et les signes monétaires restent reconnaissables ; pas de jaune sur jaune, ni de surfaces roses arbitraires sur tous les projets.

### Déplacement : contrat à reconcevoir et à montrer

- La poignée en haut à gauche est la prise principale ; les champs numériques de colonne/ligne ne constituent pas l’expérience de placement demandée.
- Le déplacement doit suivre le pointeur et rendre l’emplacement final évident avant le relâchement. L’utilisateur doit comprendre quelles cartes changeraient de place et pourquoi.
- Ne pas convertir silencieusement le geste en réorganisation hiérarchique, compactage vers le haut ou déplacement massif vers le bas. Conserver les espaces volontaires.
- Pouvoir atteindre le haut et le bas d’une longue page pendant le geste. Défilement de page, pas de conteneurs verticaux internes aux cartes.
- Vérifier depuis une vraie prise au pointeur : espace libre, voisin occupé, déplacement diagonal, bord de fenêtre, annulation, sauvegarde et rechargement.
- La politique exacte de collision doit être rendue visible dans le prototype et validée. Ne pas remplacer le problème par une autre politique arbitraire uniquement pour faire passer une assertion.

### Références relues pour Ma semaine

Sources consultées le 5 octobre. Ce sont des points d’appui fonctionnels ou visuels, pas une approbation de leurs produits ni des garanties financières.

- [Rime](https://www.rime.ai/) et l’affiche fournie : papier chaud, grands titres condensés, noir dense, couleurs franches. Référence de langage visuel, pas de structure budgétaire.
- [Weekly](https://weeklybudgeting.com/) : une réponse hebdomadaire immédiatement identifiable. Ne pas reprendre son absence de catégories : le foyer demande justement les limites courses/restaurants/transport.
- [Monarch — Flex Budgeting](https://help.monarch.com/hc/en-us/articles/32125337244052-Understanding-Flex-Budgeting) : distinguer dépenses fixes, irrégulières et flexibles ; ne pas compter deux fois plafond global et sous-enveloppes.
- [YNAB — Targets](https://support.ynab.com/en_us/getting-started-with-targets-ryAEP08xC) : dater le rythme hebdomadaire et traiter les mois à cinq occurrences, plutôt que diviser tous les mois par quatre.
- [Copilot — Recurrings](https://help.copilot.money/en/articles/3760068-creating-recurrings) et [produit](https://www.copilot.money/) : distinguer occurrence détectée et engagement confirmé ; associer montants, graphique et opérations consultables.
- [Lunch Money — Budget setup](https://support.lunchmoney.app/guides/budgeting/step-2-setting-up-your-budget) : adapter la période au rythme de dépenses ; séparer argent disponible et revenu attendu.

Les recherches Dribbble servent à découvrir des compositions, jamais à prouver qu’un parcours fonctionne. Aucun écran privé ou payant Mobbin n’a été consulté ; ne pas présenter cette recherche comme une étude Mobbin.

### Dix images à produire — architectures, pas recolorations

**État : spécifications préparées, images non générées.** L’outil image intégré est absent de cette session. L’utilisateur a autorisé le recours à l’API payante si la clé est configurée. Vérification limitée à sa présence : `OPENAI_API_KEY` est absente de l’environnement de cette session. Aucun appel payant n’a été lancé ; aucun rendu HTML ne sera présenté comme une image générée. Le skill imagegen impose d’attendre la configuration locale, sans demander la valeur de la clé dans le chat.

Consigne commune de génération : maquette UI web haute fidélité, page entière longue au ratio 9:16 environ, pas une interface mobile, aucun bord coupé, vue frontale sans appareil ni perspective. Marque WealthPilot, page « Ma semaine », sélecteur de période et compte/foyer, dock inférieur avec les quatre destinations autorisées. Identité Rime maintenue : crème, charbon, typographie condensée pour titres et montants, monospace ponctuel, texte de lecture sans-serif, couleurs franches et contrastées, pas de faux relief, pas de glassmorphism. Aucune photographie de projet, carte bancaire décorative ou crypto. Les dix structures diffèrent dans leur hiérarchie et leur outil principal, pas seulement dans leurs couleurs. Montrer tous les modules utiles de la page et de vrais libellés français lisibles. Les données ci-dessous sont fictives et communes. Mention discrète « Proposition · données fictives ». Une image séparée par direction, aucune mosaïque de dix petits écrans.

| Image | Composition dominante | Informations et interaction montrées | Risque à éviter |
| --- | --- | --- | --- |
| 01 — Briefing familial | Une grande réponse de semaine, trois enveloppes, puis un compte rendu éditorial à deux colonnes | 170 € encore dans les enveloppes ; charges proches ; achat 35 € ; calcul déplié en pied | Un slogan ou un chiffre géant sans décision possible |
| 02 — Sept jours | Calendrier horizontal pleine largeur, puis budget par catégorie et calcul | Jours et dates réels, revenus/charges séparés, aujourd’hui identifiable ; total semaine toujours visible | Dessiner les dépenses variables prévues comme des opérations déjà confirmées |
| 03 — Enveloppes actives | Trois grandes colonnes Courses, Restaurants, Transport, puis trésorerie et journal court | Payé/engagé/encore possible par colonne ; réaffectation inline explicitée | Déduire deux fois les engagements |
| 04 — Pistes des comptes | Trois rails Joint/Alex/Sam sur une même chronologie, synthèse foyer dessous | Responsabilité et compte de paiement distincts ; zones d’enveloppes partagées, test d’achat | Confondre virement entre comptes et revenu du foyer |
| 05 — Trajectoire | Courbe de cash dominante avec deux scénarios explicitement nommés, budgets dessous | Réalisé, revenu attendu vendredi, scénario revenu retardé ; repères et sources visibles | Faire passer une bande arbitraire pour un intervalle probabiliste |
| 06 — Atelier d’arbitrage | Deux colonnes Plan actuel / Mon essai, achat et répartition au milieu | Restaurant 35 €, effets avant/après simultanés, annulation claire, aucune écriture bancaire | Des curseurs ludiques sans contraintes ni explication |
| 07 — Feuille de pilotage | Table compacte de trois enveloppes avec ligne de détail ouverte, calendrier secondaire | Alloué, payé, engagé, disponible et payeur ; contrôle direct plutôt que modale | Trop de colonnes, ou une table aussi haute que trois cartes |
| 08 — Réunion du foyer | Responsabilités Alex/Sam/Commun et décisions à prendre en tête | Qui paie quoi ; réserves et limites communes ; arbitrage et journal sourcé | Déduire le responsable du seul titulaire du compte |
| 09 — Circuit de l’argent | Décomposition du cash en réserves, engagements, enveloppes et non-affecté | Diagramme de flux lisible, montants de chaque branche ; revenus futurs dans une zone séparée | Additionner stock, revenus attendus et dépenses passées |
| 10 — Cinq chapitres | Page ouverte Constater / Protéger / Répartir / Tester / Vérifier avec résumé latéral discret | Tout est visible sans assistant bloquant ; une section d’achat modifiée, conséquences visibles | Cinq étapes obligatoires ou cinq copies de la même carte |

Scène commune : semaine du **12 au 18 octobre 2026**, situation mercredi 14 matin. Comptes fictifs Joint 1 070 €, Alex 880 €, Sam 490 €, soit 2 440 €. Enveloppes : courses alloué 200 / payé 70 / engagé 60 / restant 70 ; restaurants 90 / 20 / 0 / 70 ; transport 60 / 10 / 20 / 30. Total 350 / 100 / 80 / **170 €**. Charges restantes hors enveloppes : Internet 30 €, école 80 €, assurance 90 €, soit 200 €. Engagements totaux restants 280 €, incluant les 80 € des enveloppes. Minimums protégés : Joint 700 € + Alex 500 € = 1 200 €. Revenu attendu sur Sam vendredi : 1 200 €, **estimé, pas acquis**. Non affecté : 790 €. Décomposition vérifiable : 1 200 + 280 + 170 + 790 = 2 440 €.

Avec toute la consommation restante prévue, fin de semaine 3 190 €, ou 1 990 € si le revenu arrive après dimanche. Test restaurant 35 € payé par Alex : restaurants restants 70 → 35 €, enveloppes restantes 170 → 135 €. La fin de semaine ne baisse pas une seconde fois : cette dépense était déjà incluse dans l’hypothèse de consommation complète. Chaque proposition doit permettre de retrouver la date, le périmètre, l’origine des valeurs et cette distinction.

### Méthode d’acceptation corrigée

Les trois relecteurs ne reçoivent plus « atteindre 95 » comme résultat à produire. Chacun rend des défauts observables, des captures/gestes reproductibles, les limites du protocole et ce qui reste non vérifié. Aucun bonus pour beaucoup de tests, beaucoup de variantes ou absence d’exception. Une interface incompréhensible reste refusée même si tous les calculs testés sont verts.

Ordre : (1) retrait du hors-périmètre et protection des données ; (2) dix images Semaine ; (3) choix utilisateur ; (4) prototype des gestes et de quelques cartes, à examiner dans le navigateur ; (5) implémentation retenue ; (6) contre-tests finances, interaction réelle et qualité visuelle. Ne pas consommer une nouvelle boucle exhaustive de centaines de captures pour noter une direction déjà rejetée.

Constats encore ouverts de la passe interrompue : choix « flux nets cumulés » non sauvegardé par instance ; certaines tailles L/XL peu différenciées ; visuel des dépenses inhabituelles sans référence historique comparable ; ancienne page Calendrier susceptible de créer deux ajustements concurrents de la même occurrence. Calendrier est désormais hors navigation, mais son défaut n’est pas prétendu corrigé. Les améliorations comptables déjà faites restent conservées ; elles ne prouvent pas la qualité du produit.

### Reproduction critique, sans score

La recette bornée `scripts/three-card-drag-observation.mjs` a reproduit sur trois cartes plusieurs causes du ressenti signalé : une voisine se déplace pendant la traversée d’une collision puis revient quand la carte atteint la case vide ; l’empreinte a une transition en retard sur la carte ; le premier message de statut pousse toute la grille d’environ 71 px ; défiler de 250 px pendant une prise immobile désolidarise la carte du pointeur jusqu’au mouvement suivant. Les captures immédiates ne prouvent pas que la position reste fausse après la fin de l’animation : le défaut concerne justement la compréhension pendant le geste. Ces points sont **ouverts**, pas présentés comme réparés. Preuves : `tmp/three-card-drag-observation/observations.json`, neuf captures consécutives et vidéo locale.

Les contrôles du recentrage remplacent les anciennes attentes d’affichage des cartes d’objectifs : ces cartes ne doivent plus apparaître, les réserves et les sauvegardes doivent rester inchangées. Les deux tests des anciens rendus d’objectifs ont été retirés avec ces rendus, pas les contrôles financiers. Le contre-test rouge des deux ajustements concurrents du Calendrier reste conservé et non corrigé ; il interdit d’annoncer une suite globale intégralement verte.

Palettes livrées : Papier, Encre, Jaune, Rose, Cyan, Corail, Lavande, Prune, Bleu nuit, Sauge, Forêt, Sable. Les contrôles ont détecté puis corrigé le contraste des marques contre leur piste, en plus du fond, ainsi que les deux cercles décoratifs qui gardaient auparavant des couleurs fixes. Vérification bornée dans Chromium à 1 512 px : Disponible, Évolution du solde et Budgets sur douze palettes, 1 032 textes et 36 marques contrôlés ; minimum des marques contre piste 3,001:1. Six captures relues et résultats dans `tmp/card-palettes-qa`. Cela ne valide ni le design général, ni toutes les cartes, tailles et fenêtres de sélection. Défaut distinct encore ouvert : si exactement trois enveloppes existent, « 3 » et « Tout » peuvent apparaître actifs ensemble.

Dernière suite globale exécutée après recentrage : **312 tests réussis, un test privé non activé, un échec conservé sur la concurrence de l’ancien Calendrier**. Le build et TypeScript passent ; les contrôles ciblés de retrait d’objectifs et de navigation passent. Ces résultats ne constituent pas une nouvelle note de satisfaction.

Navigation du recentrage : build `index-DoxfjrUW.js`, 29 contrôles navigateur ciblés réussis sur les quatre routes, les anciennes adresses retirées, la sauvegarde sous Import et les largeurs 390/1 512/3 840 px. La sélection du dock avait un fond transparent puis une transition héritée : les deux défauts ont été corrigés, sans ajouter un délai au test. Les préférences anciennes et données d’objectifs sont restées identiques. Rapport, captures et vidéo : `tmp/four-page-navigation-qa`. Les dix images et le nouveau moteur de déplacement restent **non livrés** à ce stade.

## 26. Shell approuvé — logo seul et dock contextuel

Demande confirmée le 5 octobre : supprimer le header, les slogans, les grands titres de page et les messages décoratifs de disposition. Conserver seulement le logo en haut à gauche. Les quatre pages commencent directement par leur contenu utile. Les titres restent présents pour les lecteurs d’écran, sans espace visuel. La phrase « Du … au … · flux et enveloppes cumulés… » a également été retirée à la demande explicite de l’utilisateur.

Le dock contient les quatre destinations fixes (Dashboard, Ma semaine, Transactions, Import CSV), une séparation et les commandes de la page active :

- Dashboard : compte, période, mois et Organiser ; pendant l’édition : Ajouter, Annuler, Terminer.
- Transactions : compte, période, mois et export du résultat filtré. Recherche et filtres détaillés restent avec le tableau.
- Ma semaine : compte et sélection de semaine, sans filtre mensuel trompeur.
- Import : sauvegarde/restauration et téléchargement du CSV exemple. Choix du fichier, vérification et validation restent dans le parcours d’import.

Les menus du dock s’ouvrent vers le haut. À faible largeur, les deux sections se superposent avec séparation horizontale et commandes sur plusieurs lignes. La hauteur mesurée du dock réserve automatiquement de l’espace en fin de page et pour le défilement au clavier. Aucun montant, CSV, compte ou objectif n’est modifié par ce changement de shell.

Implémentation : `PageActions` utilise un portail React pour afficher les actions dans le dock en gardant leur état dans la page propriétaire. Aucun clic DOM simulé ni copie des callbacks métier. Les commandes des pages masquées ne sont pas montées dans le dock. Ma semaine conserve désormais aussi son brouillon lors d’un aller-retour entre pages. Le statut de déplacement reste annoncé aux lecteurs d’écran sans pousser la grille ; les erreurs de sauvegarde restent visibles.

Vérification bornée par trois relecteurs : parcours réels d’ajout, annulation, sauvegarde/rechargement, filtres, export téléchargé, sélection de semaine et focus clavier ; captures aux largeurs 390, 768, 1 024, 1 512 et 3 840 px. Deux défauts trouvés puis corrigés : sélecteurs personnalisés se chevauchant à 768 px, et couleurs de survol héritées sur le dock. Le brouillon hebdomadaire perdu après navigation a aussi été corrigé et contre-testé. Dernier contre-test : sélecteur accessible aux quatre largeurs 390–1 512 px, contraste au survol Terminer/navigation active 10,81:1 ; aucun débordement global dans les vingt combinaisons de page/largeur. Preuves locales : `tmp/contextual-dock-qa`, `tmp/shell-visual-final-fixed`, `tmp/four-page-navigation-qa`.

Limites : dock encore assez haut sur mobile lorsque toutes les commandes sont présentes ; pas de recette VoiceOver ni de certification du produit complet. La première visite Transactions étend toujours la période globale à tout l’historique, comportement antérieur non remanié ici. Suite globale : 312 réussites, un test privé non activé, l’échec préexistant de concurrence de l’ancien Calendrier toujours conservé. Les 16 contrôles ciblés de navigation/disposition passent. Cette livraison ne prétend pas terminer la refonte des composants ni les dix images de Ma semaine.

### Passe boutons du 5 octobre

« Cette semaine / Prochaine » devient un contrôle groupé compact, deux cases de même largeur, libellés sur une ligne, sélection claire sur fond encre. Le jaune reste réservé à la navigation active et à la validation du dock. Actions, icônes, visualisations et contrôles de pagination adoptent des rayons et zones de clic cohérents. La règle générale de survol a une priorité faible pour ne pas effacer les états et palettes propres aux composants ; la page active de la pagination garde son contraste. Les chevrons reflètent l’ouverture des menus. Le double état « 3 » et « Tout » dans les budgets est corrigé sans modifier les montants.

Recette `scripts/button-states-qa.mjs` : parcours réels sur données fictives, souris et clavier, boutons normaux/sélectionnés/survolés/focalisés, absence de changement de dimensions au survol, affichage de semaine à 390/768/1 024/1 512/3 840 px. Échantillons et captures dans `tmp/button-states-qa` ; aucune erreur navigateur ni contraste inférieur à 4,5:1 dans les boutons actifs échantillonnés. Vérification complémentaire des trois cartes Disponible/Évolution/Budgets sur les douze palettes dans `tmp/buttons-palettes-qa`. Les 55 tests ciblés semaine, pagination, import, composants et palettes passent. Ce contrôle n’est pas un audit exhaustif de toutes les combinaisons de composants, ni une note de satisfaction.

## 27. Cycles salariaux, historique et import simplifié — 5 octobre

**Historique de livraison : le réglage de jour fixe décrit dans cette section a été rejeté et remplacé par la section 28. Il ne constitue plus la règle produit.** Les évolutions de grille, transactions et import restent valables.

Cette demande remplace explicitement deux anciens choix : les espaces verticaux volontaires de la grille ne sont plus conservés après repli, et une petite modale est souhaitée pour choisir le compte d’un import reconnu. Le périmètre reste les quatre pages existantes.

### Périodes communes

- Réglage « Début du cycle budgétaire » dans le dock, conservé localement et dans les sauvegardes. Une même frontière pour le foyer et ses comptes permet les comparaisons ; ce n’est pas un déplacement des dates réelles de paie.
- Jour 1 par défaut pour préserver la compatibilité. Jour 26 : le budget nommé octobre couvre le **26 septembre au 25 octobre inclus**. Le salaire du 26 septembre et le loyer du 1er octobre sont dans le même cycle. Pour un jour 29/30/31 absent d’un mois, la frontière est son dernier jour, sans chevauchement ni journée perdue.
- Revenus, dépenses, catégories, comparaisons, références d’enveloppes et provisions utilisent ces bornes. Le solde bancaire reste reconstruit depuis ses observations datées : changer de cycle ne réinitialise pas le cash. Les virements internes restent exclus des revenus/dépenses du foyer.
- Les dates de récurrence demeurent celles des opérations, positives comme négatives. Le salaire attendu n’est pas du cash disponible aujourd’hui. Les estimations et les lacunes de couverture restent explicites.
- Présélections : cycle actuel, 30 derniers jours, 1/3/4/6/12 cycles (mois si jour 1), tout l’historique, intervalle personnalisé entre cycles. La sélection historique ne propose pas de cycle commençant après aujourd’hui ; une ancienne préférence future est ramenée au cycle actuel. Transactions conserve la période du dashboard au lieu de passer silencieusement à tout l’historique à sa première ouverture.
- « Jour / Semaine / Mois » agrège les **soldes de clôture**, jamais leur somme. L’ancrage initial reste visible. Historique et prévision sont séparés, même dans un même groupe temporel. La prévision nécessite l’activation de « Avec prévision » et reste un scénario, pas une certitude.
- Les enveloppes sont des allocations de cycles entiers, non des budgets proratisés arbitrairement sur 30 jours. Les références automatiques utilisent les cycles terminés présents dans les fichiers ; elles ne garantissent pas que ces fichiers couvrent toutes les opérations.

### Grille et mouvements

- Placement horizontal conservé, mais compactage vertical après réduction/repli/retrait. La hauteur mesurée vient du contenu intrinsèque, pas d’une ancienne hauteur étirée par la grille.
- Pendant une prise : empreinte transparente en pointillés, position et déplacement des voisines visibles avant le relâchement. Le clavier reste utilisable ; Haut/Bas passe avant/après la voisine au lieu de se faire annuler immédiatement par le compactage.
- Les repères du graphique et leur détail deviennent un seul ensemble de lignes dépliables. Aucun détail automatique sous une autre carte, et aucun agrandissement du composant au simple survol du graphique. Cinq repères initiaux, les suivants restent accessibles.

### Transactions et import

- Colonne/action/filtre de pointage manuel retirés. Catégorisation, erreurs de parsing, dédoublonnage et vérification d’une observation de solde sont distincts et restent utiles. Les anciens champs de pointage sont préservés dans les données pour la compatibilité, pas exposés comme travail utilisateur.
- CSV reconnu : dépôt → choix du compte existant ou nouveau → aperçu des transactions et validation finale. Les colonnes sont détectées automatiquement. Le mapping est seulement un recours explicite pour un format ambigu/inconnu ou une correction volontaire.
- La création d’un compte et l’écriture des transactions ont lieu à la validation finale, jamais lors du simple choix dans la modale. Annuler ne crée rien. Le compte déjà identifié par son identifiant bancaire SG reste protégé ; un fichier multicomptes n’est pas aplati silencieusement.
- La devise supportée reste EUR. Un format ou une devise non pris en charge ne doit pas être interprété silencieusement comme valide. Les doublons et les lignes invalides ne sont pas importés automatiquement.

### Vérifications et limites de cette passe

Trois relecteurs distincts : calculs et limites de dates ; parcours import/périodes ; interaction réelle et grille. Les essais navigateur emploient des comptes fictifs dans des profils isolés, pas les données privées de l’utilisateur. Rapports et captures locaux : `tmp/import-flow-qa`, `tmp/cycle-integration-qa`, `tmp/compact-grid-qa`. Scripts reproductibles dans `apps/wealthpilot/scripts`.

Défauts démontrés puis corrigés pendant la revue : focus du choix de compte imbriqué dans une modale, dock recouvrant sa validation mobile, provision budgétaire variant avec la longueur de l’horizon, boutons Haut/Bas neutralisés par le compactage. L’invariance de l’horizon a un contre-test : une échéance après la fin du graphique continue à réduire l’enveloppe de son cycle sans être rendue comme un mouvement déjà affiché.

Limites assumées : reconnaissance CSV par formats/en-têtes connus, correction nécessaire si ambiguïté ; réserves communes sans allocation arbitraire aux comptes ; paramètres de cycle communs au foyer, pas encore un calendrier de cycles distinct par titulaire ; dock haut en période personnalisée sur mobile. Aucune certification 95/100 du produit entier. L’ancien test rouge de concurrence du Calendrier hors navigation reste conservé, hors de cette livraison.

Contre-recette finale : import **19/19**, périodes et navigation **27/27**, grille **26/26** et consultation d’une opération future **9/9** contrôles navigateur réussis. Le flash de largeur desktop au retour sur une page auparavant masquée est corrigé avant peinture ; six retours successifs à 390 px ne débordent plus dès la première image. Les captures du nouvel accordéon ont été relues ; sa légende garde la même hauteur au survol et au repli. La recette de grille utilise cinq cartes représentatives : ce n’est pas une couverture exhaustive de chaque famille/variante.

Le redimensionnement manuel conserve le contrat de **tailles de contenu** : poignée latérale pour choisir une taille, puis hauteur automatique selon son contenu. Les poignées sud et diagonale, qui suggéraient une hauteur libre non conservée, ont été retirées. Petit/Moyen/Grand reste réglable et persisté ; une carte peut ne pas diminuer en hauteur si le texte, plus étroit, exige autant de place. Aucun défilement vertical interne n’est ajouté pour le couper.

Un clic sur une opération future depuis les échéances ouvre son détail **hors période**, explicitement nommé, sans l’inclure dans les totaux ou le CSV de l’historique. Changer de compte ou de filtre ferme cet encart. La correction des notes y conserve les montants et les dates importés.

Build de production `index-QEav7CGa.js`, TypeScript et formatage des sources modifiées vérifiés. Le build avertit que le chunk principal dépasse légèrement 500 kB non compressés ; aucun seuil n’a été relevé pour cacher cet avertissement. Aucun import/sync de références ni modification des CSV privés lors de cette recette.

Dernière suite globale après gel des sources : **340 tests réussis, un test privé non activé, un échec préexistant conservé sur les ajustements concurrents de l’ancien Calendrier**. Aucun échec nouveau sur les cinq demandes. Le serveur temporaire de recette sur 5201 a été arrêté ; le serveur utilisateur n’a pas été touché.

## 28. Mois budgétaires détectés sur les revenus réels — correction du 5 octobre

### Règle produit qui remplace le jour fixe

- Aucun choix de jour de démarrage. L’ancien champ `cycleStartDay` reste lisible dans les sauvegardes, mais n’intervient plus dans les calculs et n’est plus proposé dans l’interface.
- Un mois budgétaire commence au **premier revenu régulier constaté du foyer** pour cette vague mensuelle. Le salaire reçu fin août finance septembre ; celui reçu fin septembre finance octobre. Leurs dates réelles peuvent être le 25, le 27, puis le 24 : aucune moyenne ne remplace ces dates historiques.
- La période se termine la veille de l’entrée réelle ouvrant la suivante. Plusieurs comptes partagent ces frontières : changer le compte filtre les montants, pas le calendrier du foyer. Les autres salaires, allocations et dépenses de la période restent inclus.
- Un salaire non encore reçu ne crée pas un nouveau mois historique. Un mois sans versement identifié reste ouvert ; les sélecteurs ne fabriquent pas de mois vide. Les opérations précédant la première paie restent accessibles dans une période initiale explicitement partielle.

### Détection et limites explicites

`periods.ts` centralise un calendrier dérivé des transactions, mis en cache par snapshot et date d’observation. L’identification de la contrepartie est partagée avec le moteur des récurrences (`transactionIdentity.ts`).

- Salaires et revenus réguliers explicitement reconnaissables dans le libellé/catégorie sont retenus ; une autre source doit présenter au moins trois occurrences à cadence mensuelle. Les virements internes, remboursements/avoirs, avances, primes isolées et remboursements de titres-restaurant n’ouvrent pas de mois. Une paie contenant une prime reste une paie.
- Le nom du mois financé est une inférence : une source initialement payée en seconde moitié de mois finance le suivant ; une source payée en première moitié finance le mois courant. Une paie retardée de quelques jours au-delà de la fin de mois est rattachée à sa vague la plus proche. Ce classement utilise l’historique disponible à chaque occurrence, pas les paiements ultérieurs pour réécrire une frontière déjà identifiée.
- La prochaine frontière n’est qu’une estimation de cadence, ou la date d’une paie future déjà enregistrée. Elle ne devient historique qu’à réalisation. Une CAF isolée ne suffit pas à prédire une série mensuelle. Sans revenu identifiable, repli explicite sur des mois civils provisoires ; sans prochaine entrée identifiable, avertissement de prévision, pas de date présentée comme certaine.
- La détection n’est pas omnisciente : un employeur inconnu sur une opération unique au libellé vague nécessite une catégorie exploitable ou davantage d’historique. Des versements très irréguliers ne prouvent pas un cycle mensuel. Aucun CSV source n’est modifié par cette détection.

### Conséquences fonctionnelles

Dashboard, historique des transactions, enveloppes, semaine, simulations d’achat, comparaison des mois et référence des dépenses inhabituelles partagent les mêmes frontières. Les soldes demeurent reconstruits depuis leurs observations bancaires ; ils ne sont pas remis à zéro au début d’une période.

Les filtres restent « Mois en cours », « Un mois », plusieurs mois, 30 jours et historique complet. Le menu des mois affiche les dates effectivement couvertes, le principe du premier revenu du foyer, et distingue la frontière suivante estimée/inconnue. Ces descriptions sont disponibles au clavier et sur écran tactile, sans ajouter de bandeau au dashboard. Compte, mois et période sont conservés au rechargement.

Une enveloppe n’est jamais consommée deux fois : une dépense future déjà engagée réduit sa provision libre. Cela reste vrai sans prochaine paie connue, et un horizon de graphique plus court ne change pas les montants des jours communs.

### Recette ciblée

Trois relectures séparées : contre-exemples financiers, intégration entre pages/cache, interface réelle à différentes largeurs. Les défauts trouvés ont fait l’objet de corrections puis de contre-rejeux : changement de phase réécrivant l’historique, paie retardée sautant un mois, prime/remboursement futur pris pour une paie, jours précédant le premier revenu perdus, historique de compte calculé avec d’autres frontières, provision consommée plusieurs fois sans prochain revenu, contexte de compte perdu au rechargement et dates non accessibles sur mobile.

Les tests de calcul sont regroupés dans `salary-cycles.test.ts` avec des cas synthétiques vérifiables ; le contrôle privé lit le CSV consolidé sans le modifier. Parcours reproductibles : `scripts/cycle-integration-qa.mjs` et `scripts/income-period-visual-qa.mjs`, profils fictifs isolés de la base utilisateur. Les rapports sont dans `tmp/cycle-integration-qa` et `tmp/income-period-visual-qa`. Il ne s’agit pas d’une certification de l’ensemble du produit ni d’une note globale à 95/100.

Contre-recette : **28/28** contrôles navigateur périodes/granularité/navigation de 390 à 3 840 px ; **20/20** contrôles UX sur les revenus automatiques, les dates accessibles et le rechargement. TypeScript, compilation et contrôle du CSV privé réussis. Suite globale : **344 tests réussis, un privé non activé dans la suite générale (exécuté séparément avec succès), un échec préexistant de concurrence dans l’ancien Calendrier**. Cet échec n’est ni supprimé ni présenté comme corrigé. Avertissement de taille du chunk principal toujours présent ; pas de modification du seuil pour le masquer. VoiceOver natif non testé.
