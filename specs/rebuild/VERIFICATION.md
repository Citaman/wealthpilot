# Verification de l'experience WealthPilot

## QA Reel, Excel et Personnalisation

30 septembre 2026. Cette section remplace les affirmations de comportement des iterations historiques ci-dessous.

- `npm run qa:rebuild` : 13 scenarios Playwright passes, aucune erreur JavaScript. Ce sont des clics, survols et saisies dans des contextes isoles, pas seulement des controles de debordement.
- `npx vitest run specs/rebuild/domain.test.js` : 16 tests passes. `npm run lint` et `npx tsc --noEmit --incremental false` : passes.
- Club de sport, Historique vers Budget : editeur ferme. Brouillon modifie : confirmation dans la page source, conservation de la note et de la frequence manuelle, puis abandon et navigation sans resurrection du detail.
- Donut : vrai mouvement de souris sur un secteur ; montant/categorie au centre, retour au total en sortant, tooltip flottant desactive. Echelles Mois/Trimestre desactivees si la periode n'a qu'un intervalle ; six mois donnent six points. Semaine precedente/suivante sans modifier la periode generale.
- Personnalisation : ajouter, masquer, reordonner, largeur et presentation ; persistance apres rechargement. Marchands et bilan mensuel optionnels dans Analyse. Enveloppes en barres, anneaux concentriques ou tableau.
- Partage : montant et direction du remboursement, toujours calcules sur le foyer entier ; aucun mouvement cree. Confidentialite verifiee. Recurrents : revoir, ecarter, recharger, retablir ; identifiants, dates, montants et libelles des paiements inchanges.
- Responsive : neuf destinations par vrais clics a 1440, 1024, 768 et 390 px. Controles du dock dans le viewport, sans chevauchement ; editeur progressif et anneaux utilises a chaque largeur. Captures de dashboard, historique, editeur, Budget et anneaux sous tmp/rebuild-qa.

### Sources Privees Retrouvees

Les fichiers ne sont pas dans le workspace wealthpilot : ils sont dans les dossiers voisins Account/data et life_os. La recherche initiale limitee au workspace avait donc manque les classeurs.

| Source lue | Operations | Comptes |
| --- | ---: | ---: |
| CSV consolide 2026 | 1385 | 2 |
| Excel familial actuel, feuille Transactions | 1385 | 2 |
| Excel tresorerie, feuille Transactions | 1385 | 2 |

Lecture structuree ZIP/XML des deux XLSX, y compris leurs espaces de noms et dates Excel. Export des transactions en CSV en memoire pour le parcours d'import ; pas de copie des donnees privees dans le depot et aucune modification des sources.

Pour chacune des trois sources : demarrage personnel, selection de chaque compte source, attribution du titulaire, ouverture explicite, controle puis import. Les 1385 dates, montants, libelles et details bancaires sont compares a la source ; revenus et depenses affiches sont compares aux sommes du fichier, hors indicateurs internes. Reimport bloque sans ajouter d'operations. Les cas de doublons potentiels sont explicitement autorises dans l'import initial pour comparer toutes les lignes, puis exclus dans le reimport.

### Limites Actuelles

Les ouvertures des essais sont volontairement nulles, pas des observations bancaires. Ce QA certifie les parcours et la conservation des flux, pas les soldes reels. Les reglages du classeur contiennent des observations communiquees et bancaires de nature differente ; aucun ajustement n'est invente pour les faire concorder.

Pas de recalcul Excel ni de migration automatique de toutes ses hypotheses de repartition, pourcentages et formules. La detection des recurrents reste heuristique. Les trois sources ne certifient pas tous les formats CSV bancaires. Pas de validation Safari/VoiceOver/native/synchronisation. Les screenshots et tests ne valent pas acceptation esthetique par l'utilisateur.

Dependances de QA uniquement : Playwright et JSZip. Installation finale : `npm audit` signale 19 vulnerabilites dans l'arbre du depot ; aucun `audit fix --force` ni changement de production hors scope n'a ete execute.

## Iteration CSV et UX Non Modale

Historique de l'iteration precedente : les chiffres et choix visuels ci-dessous ne sont plus le contrat actuel.

- Sources : experience.html, workspace.js, workspace.css, domain.js. L'ancien controleur et l'ancienne feuille de style sont retires.
- `npm run lint` et `npx tsc --noEmit --incremental false` : passes.
- Noyau : 15 tests persistants passes, dont partage selon revenus, exceptions individuelles, recurrence depuis les CSV et budget global sans double comptage.
- Playwright : 45 compositions (neuf routes, 320/390/768/1440/1920 px), aucun debordement, aucune modale et aucune erreur JavaScript observee.
- Graphiques desktop : Aujourd'hui 3, Budget 1, Analyse 3, Recurrents 1, Comptes 1. Aucun mini-graphe decoratif.
- Echelle de six mois puis semaine : meme identifiant d'instance ECharts avant/apres, pas de reinitialisation.
- Detail du jour dans Analyse : route et preset conserves ; retour dans le meme module.
- Edition inline : abandon puis reouverture sans reutilisation du brouillon abandonne.
- Partage : 100 % pour une personne sauvegarde ; montant CSV inchange ; persistance apres rechargement.
- Budget global : 3000 EUR mensuels enregistres et convertis en 300000 centimes.
- Demarrage personnel : noms puis import du premier CSV ; aucun compte cree avant validation.
- CSV : ecart de solde bloque ; correction puis import de trois operations et d'un compte, ouverture preservee.
- Recurrence : Spotify detecte depuis les trois paiements CSV ; detail local, exclusion reversible, toujours trois transactions apres exclusion.
- Police locale DM Sans, fond neutre, palette bleu/corail/jaune. Les chiffres du donut ne contiennent plus un montant large ; montant explicite au-dessus, categories dans le centre.

Limites : meme perimetre local et meme absence de certification banque/natif/multi-navigateurs que ci-dessous. La qualite visuelle necessite encore une validation utilisateur ; les controles automatises ne la certifient pas.

## Historique de la Premiere Experience

30 septembre 2026. Perimetre : experience locale autonome, pas l'ancienne application.

## Executable

[Ouvrir l'experience](experience.html). Six vues principales et trois services : Aujourd'hui, Historique, Budget, Analyse, Partage, Recurrents, Comptes, Import et Foyer/sauvegardes. Aucune page en preconstruction, aucune route de bibliotheque, aucun selecteur d'etat artificiel, aucun mode nuit.

Le mode Exemple est fictif ; le mode Local est cree explicitement avec les noms du foyer et ses comptes. Les tests d'ecriture ont ete effectues dans des contextes navigateur isoles.

## Controles Passes

- `npm run lint` : passe. Seules les distributions tierces dans assets sont exclues ; les sources neuves sont controlees.
- `npx tsc --noEmit --incremental false` : passe pour le depot.
- `npx vitest run specs/rebuild/domain.test.js` : 12 tests passes, persistes dans le depot.
- Playwright : neuf vues a 320, 390, 768, 1440 et 1920 px, soit 45 controles de composition ; aucun debordement horizontal ni erreur JavaScript observe.
- Aujourd'hui : sept graphiques SVG charges ; Budget : cinq ; Analyse : cinq ; Recurrents : quatre. Tous sont rendus avec ECharts.
- Survol reel : tooltip date/montant au-dessus du pointeur, ligne pointillee et date sur l'axe observes. Apres initialisation synchrone, les sept instances du dashboard sont presentes immediatement.
- Periode : six mois donnent six points avec granularite mensuelle ; les jours, semaines, mois, trimestres et annees reposent sur les memes operations. Bornes de mois de 28/30/31 jours testees.
- Budget : modification d'une enveloppe, recalcul et persistance testes.
- Recurrents : suspension conservee apres rechargement.
- Import : CSV delimite par point-virgule, montant francais, direction expense, rapprochement avec ecart bloquant puis correction, commit et conservation de l'ouverture testes.
- Edition : annotation conservee apres rechargement ; retour du focus sur l'operation testee.
- Demarrage personnel : noms, passage au mode personnel, creation du premier compte et solde d'ouverture testes.
- Sauvegarde : contenu du Blob JSON, nom du fichier genere et coherence des donnees controles ; restauration par fichier, apercu et confirmation testes.
- Clavier : focus conserve sur la granularite, detail, confirmation d'abandon par Echap et retour a la ligne testes.
- Confidentialite : montants masques dans les compteurs et tooltips ; descriptions anglaises automatiques des graphiques desactivees au profit des labels francais et tableaux accessibles.
- Montants : adaptation mobile a 320 et 390 px controlee, sans debordement des indicateurs.
- Mouvement reduit : option animation des graphiques a false sous `prefers-reduced-motion: reduce` ; transitions et dialogues CSS a duree nulle.

## Decisions de Mouvement

| Interaction | Comportement |
| --- | --- |
| Commande au survol | Couleur/fond/bordure, 100 ms ; aucune modification de taille |
| Navigation et compteurs | Immediats, sans comptage anime |
| Periode et granularite | Donnees recalculees ensemble, dimensions stables ; traces ECharts 180 ms, sans animer les chiffres |
| Tooltip | Positionnement immediat ; au-dessus du pointeur et borne au graphe |
| Dialogue | Opacite et 8 px de translation, 160 ms ; aucun blur du fond |
| Menu | Opacite, 140 ms ; aucune amplification du dock |
| Barre de consommation | Largeur, 180 ms ; nombre et depassement toujours textuels |
| Mouvement reduit | Aucune transition CSS ni animation des traces |

## Invariants Testes

Calculs en centimes entiers. Le solde inclut les transferts, mais les depenses et revenus les excluent. Les paiements en attente n'affectent pas les chiffres comptabilises. Le solde ne devient pas certain avant l'ouverture ou apres la couverture connue. Un rapprochement independant ne modifie pas l'ancre pour masquer un ecart. Le partage conserve les centimes et ne recree pas une consommation lors d'une compensation. Les occurrences mensuelles ne derivent pas apres fevrier. Les sauvegardes incompatibles sont rejetees.

## Limites a Ne Pas Masquer

L'ensemble des banques et des CSV personnels n'a pas ete certifie. La saisie du solde d'ouverture et des dates de couverture engage le contexte des calculs. L'import propose un mapping explicite ; il ne pretend pas reconnaitre tous les schemas automatiquement. Les doublons exacts potentiels sont exclus par defaut et peuvent etre inclus apres revue.

Le navigateur integre n'a pas emis l'evenement Playwright download attendu ; le contenu du fichier et sa demande de telechargement ont ete controles, mais la reception dans le dossier Telechargements macOS n'est pas certifiee par ce test. Verifier la sauvegarde dans le navigateur choisi avant de conserver des donnees personnelles uniquement ici.

Pas encore de certification multi-navigateurs, VoiceOver, installation native, synchronisation ou migration de l'ancienne base. Les chiffres d'exemple ne sont jamais ceux du foyer de l'utilisateur. Les tests de l'ancienne application ne valent pas validation de ce nouveau noyau.

## Ressources

Instrument Sans, Lucide 0.468.0, ECharts 5.6.0 et Papa Parse 5.5.3 sont distribues localement dans assets avec leurs licences. Les images fournies ont servi de reference de composition, couleurs et densite, sans devenir des images bancaires fictives dans l'interface.