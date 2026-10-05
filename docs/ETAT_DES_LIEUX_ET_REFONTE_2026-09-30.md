# WealthPilot : etat des lieux et proposition de refonte

Date : 30 septembre 2026.
Objet : premier parcours produit, code, donnees, Excel, references et installation.
Statut : rapport de decision. Aucun code applicatif ni aucune donnee personnelle modifies.

> **Decision utilisateur posterieure a cet audit :** reconstruire l'application et le moteur a partir d'une base neuve, avec UI/UX en priorite. La recommandation de reutiliser l'ancien moteur n'est plus retenue. Les constats restent des cas de regression a couvrir. Voir le [design system de reconstruction](../specs/rebuild/README.md).

## 1. Recommandation

**Refaire l'experience, mais ne pas supprimer aveuglement le moteur existant.**

Le projet contient deja beaucoup plus qu'une vieille maquette : une base locale versionnee, un import transactionnel, des sauvegardes, une classification explicable, des calculs en centimes, des recurrences et une projection de tresorerie. Ces briques ont de la valeur. En revanche, elles ne constituent pas encore un produit quotidien suffisamment fiable et coherent pour le foyer.

Je recommande une refonte progressive avec trois chantiers indissociables :

1. Une verite financiere verifiable : comptes, soldes dates, flux, transferts, operations en attente et rapprochement.
2. Un vrai produit de gestion familiale : compte joint, attribution personnelle/partagee, budget et echeances.
3. Une nouvelle interface construite a partir de contrats de composants, puis validee avec les donnees et les parcours reels.

Il faut viser une application de travail calme, lisible et rapide. Pas un dashboard bancaire de demonstration rempli de cartes, de jauges et de boutons sans consequences reelles.

## 2. Perimetre et fiabilite de ce rapport

### Ce qui a ete examine

- WealthPilot : dependances, stockage, moteur financier, import actif, checkpoints, sauvegardes, projection, shell, modals, tableau et documentation existante.
- Inventaire : 13 fichiers de pages produit, 11 pages de laboratoire et 73 fichiers TSX de composants hors tests. Ce sont des fichiers, pas un comptage des composants exportes.
- Navigation reelle sur 11 destinations principales en desktop 1440 px et mobile 390 px, principalement dans leurs etats vides.
- Modal de creation de compte : ouverture, geometrie, padding et fermeture sans validation du formulaire.
- Un contexte navigateur distinct avec deux comptes et sept operations fictives : dashboard, transferts, remboursement et tableau de transactions. Contexte ferme apres le test.
- Les deux vrais classeurs XLSX, leurs onglets, leurs formules stockees, leurs scripts de generation et les structures de donnees associees.
- Le dossier Account : les sept prototypes de reference et les autres supports de finance identifies dans l'inventaire.
- Life OS : architecture documentee, transmission du workflow transactions, formats CSV et workflow de publication GitHub Pages.
- Les references fournies dans images_ref et les apercus Excel comme supports de direction, pas comme specification exhaustive.
- Documentation officielle Apple pour les web apps Mac/iPhone et documentation Tauri pour l'integration Next.js.

Les chemins externes autorises pour cet examen sont les dossiers Account, life_os, et la sortie life_os identifiee par `01a0e797-2e9b-7f31-aafa-b1eabd44a61d`.

### Verifications executees

| Verification | Resultat |
|---|---|
| `npx vitest run` | 23 fichiers : 95 tests reussis, 1 ignore |
| `npx tsc --noEmit --incremental false` | Reussi |
| `npm run lint` | Reussi |
| Lecture structuree des deux XLSX | Aucun resultat de cellule mis en cache avec un type erreur |
| Cas fictif de migration Life OS | Revenu interprete comme debit, description perdue |
| Cas fictif de rapprochement contradictoire | Import accepte et ecart annonce nul alors qu'un ancien checkpoint est viole |
| Cas fictif de fraicheur | Un recalcul recent suffit a annoncer des donnees anciennes comme fiables aujourd'hui |
| Dashboard fictif multi-comptes | Soldes consolides, transfert neutralise et remboursement deduit dans le cas teste |
| Transactions fictives | Tableau expose dans l'arbre accessible ; pas de debordement mobile dans le cas teste |

**Limites :** pas d'acces en direct a Notion, pas de verification de la visibilite effective du site GitHub Pages, pas de lancement des notebooks ni de tous les anciens HTML, pas de recalcul dans Microsoft Excel, pas de test de chaque interaction des 73 fichiers, pas de certification d'accessibilite axe/lecteur d'ecran, pas de test d'installation native ou hors ligne en production. Le build de production n'a pas ete relance pendant cet audit du serveur de developpement existant.

Un classeur sans erreur Excel peut parfaitement produire une metrique conceptuellement incorrecte. Des tests verts ne prouvent pas non plus que tous les cas de rapprochement sont couverts.

L'[audit precedent](UI_UX_AUDIT_2026.md) reste une source utile. Ses observations du 29 septembre ne doivent toutefois pas etre presentees comme des bugs encore tous presents : le code actuel et les controles du jour montrent plusieurs corrections.

## 3. Constats prioritaires

### P0 : migration des donnees incompatible

L'export consolide Life OS utilise notamment `account`, `direction=income/expense`, `libelle`, `detail`, `is_internal`, `daily_balance` et parfois `status`. L'import historique actif de WealthPilot attend un autre contrat.

Le [parseur historique](../src/lib/csv-importer.ts#L198) ne considere comme credits que `credit` et `in`. Un cas fictif `income,1000` ressort comme debit de 1000. `libelle/detail` ne sont pas repris dans `description` dans ce chemin. Le compte cible est celui choisi dans l'import, pas une ventilation automatique par la colonne `account`.

**Consequence :** ne pas importer directement le CSV familial dans l'application en supposant sa compatibilite. La direction, le compte, la qualification interne et les statuts peuvent etre perdus ou mal interpretes.

**Correction attendue :** un adaptateur de migration explicite et teste, distinct de l'adaptateur bancaire SG. Il doit conserver les comptes, les signes, les descriptions brutes, les categories, les statuts et la provenance. Afficher un apercu par compte et refuser les valeurs inconnues plutot que les convertir silencieusement.

**Acceptation :** revenus, depenses, nombres de lignes, comptes et soldes dates compares entre source et destination ; relancer la migration ne cree pas de doublons.

### P0 : rapprochement circulaire

Dans le [chemin d'import](../src/lib/csv-importer.ts#L537), le solde final du relevé est d'abord enregistre comme checkpoint. Le recalcul derive ensuite le solde initial de ce checkpoint, puis le resultat est compare au solde qui vient de servir a le construire.

Reproduction uniquement avec des donnees fictives : ancien checkpoint a 100 ; nouvelle operation a -900 ; nouveau relevé annoncant 90. Le solde independant devrait etre -800. L'import annonce pourtant 90, un ecart de 0 et `isReconciled=true`. Le solde recalcule a la date de l'ancien checkpoint devient 990 au lieu de 100.

Cette operation peut servir a initialiser un compte sans historique fiable, mais elle ne constitue pas une preuve de rapprochement independant.

**Correction attendue :** distinguer initialisation par solde connu et verification contre un solde connu anterieur. Calculer l'ecart avant de remplacer une base fiable. Conserver les checkpoints comme observations immuables et signaler les contradictions.

**Acceptation :** une operation modifiee, une ligne manquante et deux checkpoints contradictoires doivent produire un ecart visible, sans reajuster silencieusement tout le passe.

### P1 : la fraicheur affichee n'est pas celle des donnees bancaires

Le [calcul de confiance](../src/lib/accounts.ts#L55) utilise d'abord `lastRecalculated`, puis `updatedAt`. Ces dates de traitement ne prouvent pas la date du dernier solde bancaire.

Reproduction fictive : un solde datant de janvier, simplement recalcule le 30 septembre, est affiche comme "Fiable au 2026-09-30".

**Correction attendue :** stocker separement la date du relevé, la date de couverture des transactions, la date du dernier import et la date du dernier calcul. Un changement de nom du compte ne rafraichit jamais les donnees bancaires.

### P1 : solde, flux cumule et disponible sont encore trop proches dans le langage produit

Le [dashboard](../src/app/page.tsx#L32) calcule la marge hebdomadaire avec le net du mois divise par les semaines restantes. Il ne retranche pas dans cette formule les echeances futures ni un plancher de securite, et ne part pas du solde liquide disponible.

Cela peut etre un indicateur retrospectif. Ce n'est pas une autorisation de depenser. Un mois beneficiaire peut coexister avec un compte a decouvert ; un mois deficitaire avec une reserve suffisante.

Le [graphique actuel](../src/components/dashboard/cash-flow-chart.tsx) montre des entrees/sorties par intervalle, pas une courbe de solde. Le [moteur d'historique de solde](../src/lib/balance.ts#L345), lui, tient deja compte des operations avant la fenetre et conserve le solde les jours sans mouvement. Il faut reutiliser cette distinction au lieu d'inventer un nouveau cumul dans chaque page.

**Correction attendue :** trois metriques distinctes : solde observe/reconstitue, flux de la periode, disponible estime jusqu'au prochain revenu. Ne pas appeler "sur" un disponible dont les donnees ou les hypotheses ne sont pas confirmees.

### P1 : multi-compte ne signifie pas encore gestion du foyer

Le [modele actuel](../src/lib/db.ts) sait rattacher une transaction a un compte. Il ne possede pas un modele explicite des membres du foyer, du proprietaire du compte, du payeur, du partage d'une depense et de sa methode de repartition.

Les budgets sont globaux, sans identifiant de compte ou de foyer dans leur type. L'Excel apporte des notions que ce modele ne represente pas encore : personnel/partage, pourcentage partage, payeur, prorata des revenus, operations en attente.

**Correction attendue :** un foyer peut contenir tes comptes, ceux de ta femme et le compte joint ; une depense partagee peut avoir ete payee sur n'importe lequel. Un reglement entre conjoints ne doit pas recreer une depense de consommation.

### P1 : le probleme des modals est concret et partage

La [primitive Dialog](../src/components/ui/dialog.tsx#L37) a `p-0`. Les slots header/footer n'imposent pas de padding ; plusieurs consommateurs ne compensent pas horizontalement. Le modal "Ajouter un compte" a effectivement 0 px de padding horizontal.

L'overlay est sombre a 55 % avec flou. Il attenue fortement le contexte, independamment du contenu du formulaire. Ce n'est pas en soi un bug Radix, mais un choix d'interaction et de presentation peu adapte a une edition frequente.

Le controle apres stabilisation du layout trouve une largeur de 512 px sur desktop et 358 px dans un viewport de 390 px : ce modal ne deborde pas dans ce cas. Le bouton de fermeture ne recouvre pas le texte du titre dans le cas teste.

**Correction attendue :** une composition de formulaire avec header/body/footer espaces de facon uniforme ; panneau lateral pour l'edition repetee, petite confirmation pour une action destructive, vue dediee pour l'import. Garder le focus, Escape et le retour au declencheur, deja facilites par Radix.

### P1 : des debordements mobile subsistent

Sur 390 px, la barre d'etapes d'Import pousse le document a environ 557 px ; des commandes de Categories depassent aussi le viewport. Navigation et Reglages ne montrent plus les anciens debordements dans les etats testes.

Le premier comptage DOM signalait trois controles sans texte dans le Plan. La verification de leur nom accessible montre qu'ils sont bien nommes via leurs labels parents : ce faux positif est exclu des constats.

### P1 : autonomie, sauvegarde et synchronisation restent des sujets distincts

La base Dexie est locale a une origine et a un profil navigateur. Installer une icone ne synchronise pas cette base entre Mac, telephone et conjoint. Changer de port ou de profil peut faire apparaitre une autre base vide.

Les [sauvegardes](../src/lib/backups.ts) existent, avec chiffrement optionnel de l'export. Cela ne signifie pas que la base IndexedDB elle-meme est chiffree. Le floutage de montants est une protection visuelle, pas un chiffrement.

Le [service worker](../public/sw.js) met en cache les ressources et les pages visitees, avec une page de secours. Ce n'est pas une preuve que toute l'application fonctionne hors ligne a froid. Son [enregistrement](../src/components/pwa/service-worker-registration.tsx) est desactive en developpement : l'audit sur `next dev` ne certifie donc pas le comportement PWA de production.

## 4. Ce que racontent vraiment les deux Excel

### Budget familial partage

Six onglets : Dashboard, Budget, Repartition, Abonnements, Transactions et Reglages. Le jeu de donnees associe contient 1392 operations du 2 janvier au 29 septembre 2026, sur deux comptes personnels, avec des operations comptabilisees et en attente.

Ce classeur exprime de bons besoins produit : perimetre personne/foyer, analyse mois/semaine/jour, budget hebdomadaire et mensuel, partage, suivi des recurrents, controle des imports et soldes dates.

Ses limites importantes :

- En mode jours, le graphique cumule les flux depuis le debut du mois sans solde d'ouverture. Il repart donc logiquement de zero en tant que flux, mais pas en tant que solde bancaire.
- Les echelles ne representent pas exactement la meme chose : flux mensuels, flux hebdomadaires et cumul journalier. Changer d'echelle change aussi la semantique.
- Les calculs de revenus/depenses consultes ne filtrent pas explicitement le statut comptabilise/en attente. Ce choix doit etre visible et configurable.
- Le compte joint n'est pas present dans les comptes du jeu familial. Les versements vers ce compte sont isoles puis retranches du net de tresorerie ; on ne voit pas pour autant sa consommation reelle.
- Le solde "actuel" est une combinaison de valeurs saisies dans Reglages a leurs dernieres dates disponibles. Ce n'est pas necessairement un solde a la meme date pour tous les comptes.
- Les analyses sont bornees a la ligne 5000 : c'est une contrainte du classeur, pas une limite a reprendre dans l'app.
- La repartition contient des choix personnels et des exceptions metier. Ils doivent devenir des regles configurables et comprehensibles, pas des conditions dispersees dans les pages.

### Budget de tresorerie

Quatre onglets dans le fichier actuel : Transactions, Vue d'ensemble, Plan decembre et Hypotheses. Il apporte une seconde logique utile : trajectoire, objectif de fin de periode et hypotheses explicites. Les apercus supplementaires ne sont pas tous des onglets de ces deux versions de classeur.

**Conclusion :** utiliser les Excel comme inventaire de besoins, source de migration et jeu de comparaison. Ne pas reproduire leurs limites de formules ou recopier leur structure de cellules comme architecture de l'application.

### Le contrat correct d'une courbe de solde

Pour un compte, avec une convention de solde connu en fin de jour :

$$
B(t) = B(t_0) + \sum_{t_0 < d_i \leq t} a_i
$$

Les montants signes incluent tous les mouvements bancaires, meme un mouvement exclu de l'analyse budgetaire. Pour une fenetre commencant plus tard que le checkpoint, le solde d'ouverture incorpore les mouvements anterieurs a la fenetre.

Exemple fictif : 1200 avant le debut du mois ; -100 le premier jour ; aucun mouvement le deuxieme ; +200 le troisieme. Courbe attendue : ouverture 1200, puis 1100, 1100, 1300. Ni 0, -100, -100, +100, ni uniquement des points aux jours de transactions.

Au niveau du foyer, reconstruire chaque compte a la meme date avant de sommer les soldes. Ne jamais prendre le `balanceAfter` de la derniere operation d'un seul compte comme solde familial.

## 5. Ce qu'il faut reprendre des autres projets

| Source | Reutiliser | Ne pas reprendre tel quel |
|---|---|---|
| WealthPilot actuel | Centimes, Dexie, transactions atomiques, sauvegardes, adaptation SG, classification, primitives Radix, recurrences et historique de solde | Assemblage de pages, contrats incomplets de confiance, formules locales de "disponible" |
| Excel familial | Personnes, payeur, partage, attentes, controles, budgets semaine/mois | Cumul confondu avec solde, plafond de lignes, hypotheses invisibles, exclusion implicite du joint |
| Excel tresorerie | Objectif date, hypotheses, trajectoire et scenarios | Hypotheses fixes rendues comme faits bancaires |
| Life OS | Historique, regles de conversion, provenance, identifiants de source, vocabulaire familial et cas de regression | Notion comme base operationnelle obligatoire pour la finance ; publication publique de details financiers |
| Prototypes 01 et 03 a 07 | Compositions, hierarchie et details visuels comme pistes a selectionner | Grands canvas redimensionnes, valeurs fictives, courbes dessinees a la main, fonctions bancaires simulees |
| Prototype 02 | Parcours mobile, activite groupee par jour, navigation reduite, controles de budget | Fausses donnees persistees seulement en memoire, score opaque, apparence de synchronisation bancaire |
| Notebooks et anciens dashboards HTML | Candidats pour extraction ulterieure de regles ou d'analyses utiles | Nouvelle dependance de fonctionnement quotidien avant verification |

Six des sept prototypes utilisent un mecanisme de canvas transforme avec `scale()`. Aucun des sept fichiers App inspectes ne persiste les donnees. Quelques interactions sont reelles localement, mais ne constituent pas une application financiere fiable.

Cela explique une partie du sentiment de reproduction "a 50 %" : la fidelite d'un grand screenshot n'est pas la fidelite d'un produit responsive, avec vraies donnees, textes longs, actions, erreurs et limites.

Le workflow Life OS genere des embeds financiers et publie `dist` sur GitHub Pages. **Risque a verifier**, et non fuite publique confirmee : si ces pages sont accessibles publiquement, les donnees qu'elles embarquent le sont aussi. Aucun secret .env n'a ete lu pour cet audit. Ne pas reutiliser ce canal comme stockage prive de la future app.

## 6. Le MVP recommande

La cible initiale est un outil local utilisable quotidiennement sur Mac, avec une interface vraiment adaptee au telephone. Le partage de la meme base entre appareils doit etre annonce separement, pas suppose present parce que l'interface est mobile.

| Destination | Question utilisateur | Contenu minimal et action principale |
|---|---|---|
| Aujourd'hui | Ou en sommes-nous, et qu'est-ce qui demande une action ? | Liquidite, dates de confiance, prochaines echeances, courbe de solde, file a verifier ; ouvrir le probleme concerne |
| Transactions | Que s'est-il passe et est-ce bien classe ? | Recherche, filtres, periode, compte/payeur, montant, statut, categorie, detail et edition groupee |
| Budget | Que reste-t-il dans les enveloppes ? | Prevu/reel/restant, mensuel et hebdomadaire, depenses partagees/personnelles ; ajuster une enveloppe |
| Analyse | Pourquoi l'argent entre-t-il ou sort-il ainsi ? | Revenus, depenses, categories, marchands, comparaisons ; ouvrir les transactions sources |
| Recurrents | Qu'allons-nous payer ou recevoir ? | Abonnements, charges, revenus, montant, compte, date, statut ; confirmer une detection ou ajuster une echeance |
| Calendrier | Quel mouvement arrive quand ? | Agenda des revenus et charges ; depuis un evenement, acceder au recurrent et au mouvement reel |
| Repartition | Qui a avance quoi pour le foyer ? | Part partagee, methode 50/50 ou prorata configure, payeur, compensation ; voir les operations justificatives |
| Plan | Quel risque dans les prochaines semaines ? | Tresorerie datee, hypotheses explicites, point bas, scenarios ; modifier une hypothese sans modifier le reel |
| Comptes et import | Quelles donnees sont incluses et jusqu'a quand ? | Comptes personnels/joint, couverture, checkpoints, import par compte, bilan et annulation |
| Reglages | Comment garder et configurer mes donnees ? | Membres, categories/regles, periodes, devise, confidentialite, sauvegarde/restauration, installation |

Les destinations ne doivent pas toutes etre des onglets de premier niveau. Mobile : Aujourd'hui, Transactions, Budget, Recurrents, Plus. Desktop : navigation groupee, contexte compte/foyer visible et stable.

L'import et les categories peuvent rester des routes accessibles depuis les outils d'organisation. La Repartition peut etre une vue du Budget au debut. Le Calendrier peut etre une vue des Recurrents. Le Plan garde sa profondeur, mais ne monopolise pas le dashboard.

Les objectifs d'epargne peuvent rester presents comme fonction secondaire. Leur refonte complete, les investissements, le score de sante, l'assistant conversationnel et la connexion bancaire ne doivent pas retarder le coeur quotidien.

## 7. Modele et architecture cibles

### Entites a rendre explicites

- Foyer et membres : identifiants stables, regles de partage, pas simplement noms de comptes.
- Compte : proprietaire(s), devise, type, inclusion dans la tresorerie ou le patrimoine, dates de couverture.
- Observation de solde : montant, date, convention debut/fin de jour, source et statut de validation.
- Transaction : reference source, compte, dates operation/valeur, montant, statut et libelle original immuable.
- Attribution : categorie, nature economique, personnel/partage, payeur, cle de repartition, justification et correction manuelle.
- Import : source, compte cible, couverture, empreinte, controles, creations/modifications et possibilite d'annulation.
- Transfert : lien entre mouvements, confirmation, perimetre concerne et traitement des contreparties absentes.
- Recurrent et occurrence : calendrier attendu, confiance, confirmation, rapprochement avec une transaction comptabilisee.
- Budget : periode, perimetre, enveloppes, reports eventuels et regles d'allocation.
- Scenario : solde de depart verifie, hypotheses, horizon, plancher et ecarts au realise.

Ne pas introduire une infrastructure multi-utilisateur lourde pour representer deux membres sur un seul appareil. En revanche, leurs notions metier doivent deja etre modelisees proprement.

### Separations essentielles

1. Donnees bancaires et corrections d'analyse : changer une categorie ne change jamais le solde bancaire.
2. Reel et prevu : une echeance ou un scenario ne devient jamais une transaction comptabilisee par simple calcul.
3. Solde comptabilise et disponible estime : les operations en attente ont une politique explicite, sans double comptage au relevé suivant.
4. Tresorerie et patrimoine : epargne bloquee, investissement et credit ne sont pas automatiquement de l'argent depensable.
5. Financement et consommation : approvisionner le compte joint n'est pas consommer une deuxieme fois ses futures courses.
6. Qualite de classification et fiabilite de solde : une categorie incertaine n'invalide pas necessairement le montant bancaire.

### Organisation technique

Conserver TypeScript, React, Dexie, Papa Parse, Recharts et Radix tant qu'ils remplissent leur fonction. Pas de remplacement de bibliotheques pour des raisons purement esthetiques.

Faire converger les pages vers des services et selecteurs communs : registre des comptes, reconstruction de solde, rapprochement, indicateurs de periode, recurrent/occurrences, budget et projection. Les composants consomment leurs resultats ; ils ne reinventent pas les definitions financieres.

Le contrat d'une requete doit contenir au minimum perimetre, comptes, periode, convention de date et politique de statuts. Le resultat doit porter les montants et leur couverture/confiance.

L'existant [financial-metrics](../src/lib/financial-metrics.ts) est un bon debut, pas une raison d'ignorer les divergences restantes. Par exemple, [calculateWeekActual](../src/lib/cash-plan.ts#L241) applique ses propres exclusions de categories et definitions des credits. Un contrat unique doit couvrir aussi le Plan.

Les remboursements doivent avoir une politique coherente, notamment lorsqu'ils concernent une depense du mois precedent. Le plafonnement des depenses nettes a zero et la presentation des categories en brut ne doivent pas produire des graphiques qui semblent contredire le total sans explication.

### Import et classification

Parcours : choisir le compte, reconnaitre le format, lire les metadonnees, valider lignes/dates/montants, comparer les doublons, proposer categories et transferts, verifier les soldes, confirmer et afficher un bilan par compte.

Un doublon certain et une ressemblance ne doivent pas etre traites comme le meme cas. Deux achats legitimes peuvent avoir le meme jour, montant et libelle ; sans identifiant bancaire stable, l'ambiguite doit pouvoir etre revue.

Priorite : correction manuelle, apprentissage local confirme, regles explicites, puis suggestion. L'IA locale reste facultative ; elle ne doit jamais arbitrer seule un montant, un compte, un doublon ou un checkpoint. Une inference sur le Mac n'est pas automatiquement disponible sur le telephone.

## 8. Methode de design : un composant est un contrat

### Pourquoi la copie d'image ne suffit pas

Une reference fournit des proportions, une densite, une hierarchie et un ton. Elle ne definit pas le comportement d'un menu, le droit de modifier une somme, la fermeture avec modifications non enregistrees, la provenance d'une courbe ou le feedback d'une erreur.

Il faut choisir une direction commune et extraire ses principes. Ne pas melanger le shell d'une reference, les couleurs d'une autre et dix styles de cartes issus du laboratoire.

Je proposerais un bureau financier clair : fond neutre legerement nuance, sections non encadrees, separateurs utiles, peu d'ombres, accent de marque reserve aux actions, vert/rouge/ambre pour des significations stables, chiffres tabulaires et precision commune. Une police lisible effectivement chargee ; pas un empilement de grosses valeurs et de petits textes pales.

Les vraies tables doivent rester denses et scannables. Les montants importants meritent une hierarchie forte, pas chaque carte secondaire. Aucun faux bouton "envoyer de l'argent" ou "synchroniser" tant que l'application ne propose pas cette action reelle.

### Fiche obligatoire avant implementation

Chaque composant recoit une fiche courte : decision utilisateur, donnees et provenance, geometrie desktop/mobile, actions et consequences, etats, clavier/tactile, animation et criteres d'acceptation.

Les etats minimum sont normal, survol/focus, actif/selectionne, chargement, vide, erreur, desactive et mutation en cours. Ajouter incomplet, perime et incertain quand ils ont une signification financiere.

Une animation peut orienter l'attention ou montrer la continuite d'un panneau. Elle ne doit pas ralentir la lecture, changer la largeur d'un montant, faire compter des euros artificiellement ou lisser un signal financier inexistant. Respecter la reduction de mouvement.

### Registre des composants existants a reprendre

| Famille existante | Role a conserver | Travail de refonte |
|---|---|---|
| AppLayout, CommandDock, route-registry, database-status-banner | Navigation, perimetre, acces aux outils, erreur de stockage | Contexte visible, navigation stable, hierarchie des destinations et vrais etats d'installation |
| Money, PrivacyBlur, use-money | Montants et confidentialite visuelle | Format unique, signes, precision, retour a la valeur source et distinction devise de compte/consolidation |
| Button, Badge, Input, Textarea, Label | Commandes, etats et saisie | Tailles fixes, libelles relies aux champs, erreurs inline, couleurs semantiques |
| Select, Checkbox, RadioGroup, Slider, Tabs | Choix et modes | Controle adapte au type de valeur, clavier, limites et selection explicite |
| Dialog, ConfirmationDialog, Popover, DropdownMenu, Tooltip, Toast/Toaster | Actions secondaires et feedback | Slots espaces, panneau d'edition, confirmation courte, annulation, aucun empilement de modals |
| Accordion, Collapsible, ScrollArea, Progress, CircularProgress | Detail progressif et progression | Usage fonctionnel ; eviter les jauges decoratives et le scroll interne non necessaire |
| Card, Alert, EmptyState, Skeleton, ErrorBoundary, ClientOnly | Surfaces et etats | Sections non traitees comme cartes flottantes ; distinguer vide, non importe, incomplet et indisponible |
| DataTable, FilterBar, MeasuredChart | Donnees, filtres et graphiques | Saisie mobile, semantique, total filtre, tri, drill-down et geometrie stable |
| CashFlowChart, RecentTransactions, UpcomingBills | Dashboard | Separer solde/flux, transactions justifiantes et echeances confirmees |
| TransactionEditDialog, CategorySelect, TagInput, BatchActionBar, BulkWorkbench | Correction quotidienne | Panneau contextualise, editions groupees verifiables, conservation des originaux, retour erreur |
| BudgetPace, BudgetAlerts, BudgetVsActual, CategoryBudgetCard, overrides | Budget | Prevu/reel/restant uniforme, perimetre explicite, arbitrage actionnable et remboursements coherents |
| FinancialHistory, RecurringExpenses, TopMerchants, SpendingCalendar | Analyse | Une question par vue, definitions partagees, source accessible et comparaison equivalente |
| SubscriptionCard, LoanCard, AddEditDialog, MergeDialog, PaymentHistoryDialog | Recurrents | Distinguer detection, confirmation, echeance et paiement observe ; ne pas assimiler abonnement et pret |
| GoalCard, goal-utils et detail d'objectif | Epargne | Eviter d'attribuer la meme reserve complete a plusieurs objectifs ; progression justifiable |
| MigrationWizard et page Import | Reprise des donnees | Adaptateurs distincts, dates de couverture, doublons ambigus et controle independant des soldes |
| Composants Settings et installation | Configuration et securite | Reglages ayant un effet reel, restauration testable et capacites plateforme annoncees honnêtement |
| PilotOrb et routes de laboratoire | Exploration visuelle | Hors coeur MVP ; aucune dependance du workflow quotidien a la decoration |

Ce registre couvre les familles inventoriees ; il ne pretend pas remplacer les fiches individuelles de chaque export de composant. Les hooks et contexts sont des dependances metier a valider, pas des elements a "reskinner".

### Exemples de contrats a construire en premier

| Composant cible | Comportement attendu | Controle d'acceptation |
|---|---|---|
| Barre de contexte | Change foyer/compte et periode ; conserve les filtres compatibles | Tous les chiffres et details affichent le meme perimetre |
| Montant avec confiance | Montre somme, nature et date ; ouvre ses sources si necessaire | Une donnee non importee n'est jamais un zero presente comme certain |
| Courbe de solde | Solde reel, ouverture visible, jours sans mouvement, prevu distinct | Premier point correct, valeurs retrouvables dans les transactions |
| Ligne de transaction | Selection distincte de l'ouverture du detail ; actions accessibles au clavier | Cliquer une checkbox ne declenche pas l'edition |
| Panneau d'edition | Garde le contexte, signale les changements, valide ou annule | Pas de perte silencieuse ; fermeture restaure le focus |
| Filtres | Resultat et nombre de filtres visibles, reset explicite | Totaux egaux aux seules operations filtrees |
| Enveloppe budgetaire | Edite un budget, pas une transaction ; montre sous/surconsommation | Pas de financement du compte joint compte deux fois |
| Suggestion de recurrence | Confirmer, corriger ou rejeter ; montre les preuves | Un rejet ne revient pas a chaque nouvel import sans raison |
| Echeance | Attendue, payee, en retard ou annulee ; relie le paiement observe | Une occurrence rapprochee n'est pas ajoutee deux fois a la projection |
| Controle de rapprochement | Compare une prediction independante a une observation | Un montant corrompu declenche un ecart, pas un reajustement automatique |
| Confirmation destructive | Explique la consequence exacte et propose annulation quand possible | Aucun changement avant validation ; feedback d'echec conservant le contexte |
| Repartition du foyer | Detaille la part partagee, l'avance et le reglement | Les compensations n'ajoutent pas de depenses de consommation |

### Validation visuelle

Valider d'abord une transaction complete, un panneau, un graphique et une enveloppe avec donnees realistes. Puis construire les pages. Chaque lot est compare a la direction retenue avec screenshots de l'application, pas seulement a un screenshot de reference.

Verifier 390, 768 et 1440 px, puis les extremes 320 px et zoom 200 %. Tester noms longs, montants negatifs, plusieurs comptes, liste vide, import incomplet, erreurs, sauvegarde et textes qui passent sur deux lignes. Le theme sombre ne doit pas etre declare termine parce qu'une classe `dark` existe.

## 9. Application dans le Dock et mobile

| Option | Ce qu'elle apporte | Limites et conditions |
|---|---|---|
| PWA installee | Icone Dock/ecran d'accueil, fenetre dediee, meme interface web | Stockage navigateur, offline a valider, origine stable, aucune synchronisation implicite |
| Paquet Mac Tauri | Application lancable independamment d'un serveur de developpement, acces fichiers et integration OS possibles | Packaging, signature/distribution, mises a jour, stockage et migration a concevoir |
| Application mobile native/hybride | Integration plus poussee aux fichiers, notifications et systeme | Travail plateforme supplementaire et meme probleme de partage de donnees a resoudre |

**Choix recommande :** stabiliser l'experience responsive et le moteur avant de maintenir plusieurs applications. Tester ensuite une PWA de production installee. Si "je redemarre le Mac, je clique l'icone, tout fonctionne sans terminal" est une exigence ferme, un paquet Mac devient un livrable explicite de la premiere version quotidienne, pas une simple promesse de PWA.

Pour la PWA, preferer une origine HTTPS stable et separer code servi/donnees stockees. Un site hebergeant seulement les fichiers de l'app n'a pas besoin d'embarquer les comptes et transactions. Pour une exploitation strictement locale, valider le fonctionnement apres arret du serveur ; sinon prevoir le paquet desktop ou un service local gere proprement.

Tauri n'est pas un emballage magique de `next dev`. La [configuration actuelle](../next.config.ts) ne produit pas d'export statique. Le guide officiel Tauri demande un frontend statique pour Next.js. Les routes dynamiques, assets et capacites eventuellement dependantes du serveur devront etre adaptes et verifies avec Next.js 16 ; ne pas ajouter seulement `output: 'export'` sans tester le build et les parcours.

Ne pas migrer Next.js vers Vite uniquement pour lancer ce chantier. Un petit essai de packaging doit determiner si cette adaptation est rentable. La separation du domaine et des selecteurs rendra cette decision moins couteuse.

**Partage entre Mac et telephones :** le MVP local peut gerer tout le foyer sur un appareil. Pour que vous utilisiez tous les deux la meme base sur plusieurs appareils, il faut une synchronisation privee, une politique de conflits, des identifiants stables, une authentification et une restauration. Des sauvegardes echangees manuellement sont une solution temporaire a un seul editeur, pas une collaboration fiable.

L'automatisation bancaire est techniquement possible via des connecteurs/agregrateurs compatibles et le consentement bancaire. Elle ajoute cout, couverture bancaire a verifier, renouvellement du consentement, backend et contraintes de confidentialite. Le CSV reste un choix raisonnable pour le MVP ; impossible aujourd'hui dans ce code ne signifie pas impossible techniquement.

## 10. Plan iteratif propose

| Lot | Livrable concret | Condition pour passer au suivant |
|---|---|---|
| 0. Verrouiller les sources | Sauvegarde, inventaire des comptes, source de chaque solde, jeu anonymise de comparaison | Plus aucune ambiguite sur compte joint, statuts et date de reference |
| 1. Fiabiliser le moteur | Migration adaptee, checkpoints independants, dates de confiance et definitions partagees | Les cas de corruption echouent ; chiffres identiques a perimetre identique |
| 2. Construire les fondations UI | Direction visuelle unique, shell, montants, tableau/liste, panneau et feedback | Mini-parcours avec donnees realistes valide en desktop/mobile |
| 3. Livrer une premiere tranche quotidienne | Import de plusieurs comptes, Transactions et Aujourd'hui | Importer, corriger, comprendre et sauvegarder fonctionne de bout en bout |
| 4. Budget familial et repartition | Enveloppes semaine/mois, payeur, partage et compensation | Aucun double comptage ; chaque total est explicable par ses operations |
| 5. Recurrents et tresorerie | Inbox de detection, agenda, rapprochement des occurrences, projection | Prevu et reel se remplacent proprement, risque date visible |
| 6. Analyse et fonctions secondaires | Analyses drill-down, objectifs utiles, categories/regles et reglages consolides | Toutes les pages parlent le meme langage et la meme periode |
| 7. Version quotidienne distribuable | Installation, offline, sauvegarde/restauration et packaging retenu | Demarrage sans workflow de developpement, restauration sur profil neuf |
| 8. Partage et automatisation optionnels | Synchronisation privee puis connecteur bancaire si necessaire | Aucun conflit silencieux, consentement et confidentialite documentes |

Le packaging peut etre explore en petit essai apres le lot 1 si l'autonomie Mac est bloquante. Le livrable reste une tranche testable, pas une nouvelle app parallele a construire entierement.

Chaque lot doit avoir une validation produit avant d'elargir le perimetre. Eviter une "grande refonte" ou toutes les pages sont remplacees simultanement et ou le premier vrai import arrive a la fin.

## 11. Definition de termine

### Finance et donnees

- Un meme perimetre/periode produit les memes revenus, depenses et net entre Aujourd'hui, Budget, Analyse et Plan, ou une difference explicitement definie.
- Un checkpoint fiable et le relevé suivant permettent de detecter une erreur de montant sans reajuster automatiquement l'ouverture.
- Le solde d'ouverture est non nul quand il doit l'etre ; une periode filtree et les jours sans operations ne remettent pas le solde a zero.
- Une correction de categorie n'altere pas le solde ; une suppression bancaire le recalcule et reste tracable.
- Les transferts sont neutres en consommation au bon perimetre, mais changent bien les soldes individuels.
- Les operations en attente deviennent comptabilisees sans duplication ; les ecarts de date/marchand peuvent etre revus.
- Une observation future n'est pas presentee comme argent disponible aujourd'hui ; un solde ancien n'est pas rendu frais par un recalcul.
- Les remboursements, le compte joint, les contreparties absentes et les mois incomplets ont des cas de regression dedies.

### Parcours et interface

- Importer les deux comptes personnels puis le joint, corriger une categorie et retrouver les nouvelles valeurs dans les vues concernees.
- Ouvrir une transaction, modifier, annuler, enregistrer, recevoir une erreur et recommencer sans perdre le contexte.
- Confirmer/rejeter un recurrent et suivre son echeance jusqu'a son paiement.
- Lire une courbe puis acceder a ses operations sources ; la valeur du tooltip correspond a la table accessible.
- Aucun debordement accidentel a 320/390 px ; les tables larges ont un scroll contenu ou une liste mobile.
- Clavier, noms accessibles, focus, cibles tactiles, contraste et reduction de mouvement verifies.
- Etats vide, incomplet, erreur, ancien et chargement valides visuellement, pas seulement cas ideal avec trois lignes.

### Installation et conservation

- Lancer la version installee apres fermeture des outils de developpement et redemarrage de l'appareil.
- Ouvrir les ecrans necessaires hors ligne et verifier que les donnees persistent.
- Exporter une sauvegarde, restaurer sur un profil neuf et comparer comptes, lignes, regles, recurrents et soldes.
- Une mise a jour de schema preserve les donnees ; une erreur de migration n'efface pas la base.
- La confidentialite distingue masquage visuel, chiffrement d'export, stockage local et partage reseau.

## 12. Decisions a prendre avant la premiere implementation

1. Le compte joint fait-il partie de la tresorerie pilotable, et ses exports sont-ils disponibles ? Recommandation : oui, sinon afficher explicitement la couverture incomplete.
2. Le partage veut-il dire "voir nos finances sur mon Mac" ou "editer tous les deux depuis plusieurs appareils" ? Ce sont deux perimetres techniques differents.
3. Quelle repartition par defaut : 50/50, prorata de revenus de reference, ou montant fixe, et quelles exceptions personnelles ?
4. Quels soldes bancaires dates serviront de points de controle independants ?
5. Quel indicateur est prioritaire : liquidite aujourd'hui, fin de mois, prochaine paie, ou sortie de decouvert ?
6. L'application doit-elle etre autonome sans serveur local des la premiere version quotidienne ?
7. Parmi les references, quelle direction desktop et quelle direction mobile doivent etre retenues, puis formalisees en tokens et geometrie ?

Ces decisions ne bloquent pas le diagnostic actuel. Elles determinent les criteres de la premiere tranche a implementer.

## 13. Conclusion

Il ne manque pas une technologie miraculeuse. Il manque un contrat financier complet, une definition claire du foyer et une methode de construction de l'interface qui traite les comportements aussi serieusement que les screenshots.

La bonne prochaine action est un petit socle fiable suivi d'une tranche Import -> Transactions -> Aujourd'hui, avec vrai solde d'ouverture, compte joint explicitement traite, edition contextualisee et sauvegarde restauree. Ensuite seulement etendre la meme exigence au budget, aux recurrents et aux analyses.

### Sources complementaires

- [Audit UI/UX precedent](UI_UX_AUDIT_2026.md).
- [Registre des audits specialises](audits/README.md).
- [Installation locale et classification hybride](LOCAL_AI_AND_INSTALLATION.md).
- [Travail deja realise le 29 septembre](P3_IMPLEMENTATION_2026-09-29.md).
- [Apple : utiliser une web app dans le Dock](https://support.apple.com/guide/safari/use-web-apps-ibrw9e991864/mac).
- [Apple : ajouter un site a l'ecran d'accueil iPhone](https://support.apple.com/guide/iphone/turn-a-website-into-an-app-iph42ab2f3a7/ios).
- [Tauri : integration Next.js et export statique](https://v2.tauri.app/start/frontend/nextjs/).