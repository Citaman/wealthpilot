# Archive des plans initiaux

Ces plans sont historiques. La cible actuelle est constituee de six vues principales fonctionnelles et trois services, documentes dans [le referentiel actuel](README.md). Aucun wireframe ci-dessous n'est expose dans la navigation.

# Ecrans et parcours : WealthPilot Rebuild

Version 0.1, 30 septembre 2026. Conception avant code. Reference : [design system](DESIGN_SYSTEM.md).

## Livraison progressive

Le MVP vise toutes les destinations ci-dessous, mais pas dans une seule implementation. Une page non livree n'apparait pas comme destination inactive ou ecran vide dans l'application quotidienne.

| Tranche | Ecrans | Experience complete attendue |
|---|---|---|
| U0 : prototype UI | Aujourd'hui, Historique, detail, composants et etats | Jeu fictif clairement identifie, consultation/filtre/navigation/edition simulee coherents ; aucune donnee bancaire |
| U1 : usage quotidien | U0 + Comptes, Import neuf, sauvegarde/restauration et Reglages essentiels | Creer les comptes, importer, controler, corriger, retrouver, sauvegarder et restaurer |
| U2 : comprendre et arbitrer | Analyse, Budget et Repartition | Drill-down vers les mouvements, enveloppes et avances familiales explicables |
| U3 : anticiper | Recurrents, Calendrier et Plan | Echeances confirmees, rapprochement prevu/reel et scenarios dates |
| Hors coeur MVP | Objectifs avances, investissements, assistant, connexion bancaire et synchronisation | Aucun faux bouton ni dependance pour la qualite d'U1 |

U0 est un prototype, pas la version qui gere les vrais comptes. U1 ne sera quotidiennement utilisable que lorsque le nouveau moteur aura ses propres tests, meme si U0 est beau. Le comportement reactif, le rollback et la persistance sont reconstruits, pas branches sur l'ancien moteur.

## Regles de composition

Notation desktop : colonne de debut et span dans une grille de 12 colonnes. Tablet : grille de 8 colonnes et recomposition explicite. Mobile : tous les modules principaux occupent 4 colonnes ; les petites valeurs peuvent partager 2 + 2 si leurs libelles et nombres tiennent a 320 px.

Les spans sont des relations, pas des largeurs en pixels. Les modules se dimensionnent par contenu ; les graphiques ont un minimum de 240 px. Une table large est une surface de travail, pas une mosaïque d'une carte par transaction.

Header et contexte sont hors grille de cartes. Le dock est toujours reserve. La hauteur du canvas couvre le viewport ; la grille peut depasser et scroller. Aucun ecran n'est comprime pour forcer une capture complete.

Les identifiants C01 a C18 renvoient aux contrats de composants. Les pages exposent leurs propres etats complets, meme si leurs briques sont partagees.

## P01. Aujourd'hui

Question : "Ou en est le foyer, et que dois-je regarder maintenant ?"
Tranche U0 pour conception ; U1 pour donnees reelles.

| Module | Desktop debut/span | Contenu | Composants |
|---|---|---|---|
| A / Solde et evolution | 1 / 8 | Solde date, ouverture, courbe quotidienne et comptes inclus | C03, C06, C09 |
| B / A venir | 9 / 4 | Trois a cinq echeances confirmees, dates et montant total de l'horizon | C06, C14 |
| C / Flux de la periode | 1 / 4, ligne 2 | Revenus, sorties, net, avec definitional source et periode | C03, C06 |
| D / Budget du moment | 5 / 4, ligne 2 | Enveloppes prioritaires et restant ; absent si non configure | C06, C13 |
| E / A verifier | 9 / 4, ligne 2 | Operations incertaines, compte ancien ou ecart de rapprochement | C06, C12 |
| F / Dernieres operations | 1 / 8, ligne 3 | Cinq lignes maximum, lien vers Historique | C07 |
| G / Repartition des sorties | 9 / 4, ligne 3 | Trois categories, montant et lien source ; pas de donut illisible | C03, C09 |

Tablet : A sur 8, B/E sur 4 + 4, C/D sur 4 + 4, F sur 8 ; G integre a l'analyse secondaire. Mobile : A -> E si bloquant -> B -> C -> D -> F -> G. Ne pas pousser un ecart bancaire sous quatre cartes rassurantes.

En U0/U1, B et D ne montrent pas de faux recurrents ou budgets : dans le prototype ils sont explicitement fictifs ; dans l'app ils montrent une etape de configuration ou sont remplaces par la qualite des comptes.

Actions : selection du point de solde -> Historique de ce jour/perimetre ; echeance -> detail recurrent ; alerte -> probleme precis ; ligne -> detail. Le libelle "disponible" n'apparait qu'avec une politique de calcul validee, sinon afficher "solde comptabilise".

Etats : aucun compte, comptes sans transactions, couverture partielle, ancien, rapprochement bloque, loading, erreur locale et donnees normales. Une erreur d'un module n'efface pas tout le dashboard.

Acceptation UI : hierarchie claire en cinq secondes ; date/perimetre visibles ; premier point de solde explicable ; dernier element accessible au-dessus du dock ; aucune mutation financiere depuis un clic de consultation.

## P02. Historique des transactions

Question : "Que s'est-il passe, et est-ce correct ?" Tranches U0/U1.

| Module | Desktop debut/span | Contenu | Composants |
|---|---|---|---|
| A / Resume filtre | 1 / 4 | Nombre d'operations, entrees/sorties visibles, sources couvertes | C03, C06 |
| B / Qualite et revue | 5 / 4 | A classer, en attente, transferts a confirmer | C06, C12 |
| C / Dernier import | 9 / 4 | Compte/date, couverture et bilan ; lien controle | C06, C16 |
| D / Registre | 1 / 12, ligne 2 | Toolbar, filtres, table, pagination et barre de selection dans une surface | C07, C08 |

Detail ouvert a >= 1600 px : D utilise 8 colonnes et le panneau les 4 restantes quand cela preserve une table utile. Plus petit desktop : panneau modal lateral 440 px. Mobile : resume A/B compact, C apres la liste ou dans source, D liste verticale ; detail plein ecran.

Colonnes : selection, date, marchand, categorie, compte, statut, montant et action. Payeur/share disponibles sans encombrer U1 ; ils deviennent colonnes optionnelles d'U2.

Actions : rechercher, filtrer, trier, ouvrir detail, selectionner, corriger une categorie, appliquer aux operations similaires apres revue. Les actions de masse precisent leur nombre et ce qui changera. Montant et libelle source ne sont pas modifiables par une simple recategorisation.

Etat sans resultat : conserver les filtres et offrir Reset. Etat non importe : expliquer la source absente, action Importer. Retour du detail : selection, tri et scroll conserves. Une operation en cours n'interdit pas la consultation d'autres lignes, sauf risque documente de conflit.

Acceptation : liste et total filtre concordent ; aucun hover obligatoire ; deux achats identiques restent representables ; texte long, montant negatif et statut en attente tiennent sur mobile ; edition reussie met a jour la ligne sans reload manuel.

## P03. Analyse

Question : "Pourquoi cette evolution ?" Tranche U2.

| Module | Desktop debut/span | Contenu | Composants |
|---|---|---|---|
| A / Comparaison de periodes | 1 / 8 | Revenus/sorties par mois ou semaine, bornes comparables | C06, C09 |
| B / Synthese | 9 / 4 | Variation de net, comparaison explicite et couverture | C03, C06 |
| C / Categories | 1 / 5, ligne 2 | Barres classees, montant, part et changement | C09 |
| D / Marchands | 6 / 4, ligne 2 | Frequence, montant et moyenne, liens vers mouvements | C07 |
| E / Fixe / variable | 10 / 3, ligne 2 | Distinction definie et corrections accessibles | C03, C06 |
| F / Exploration temporelle | 1 / 12, ligne 3 | Activite par jour et table, sans compter une absence de source comme zero | C09 |

Tablet : A 8, B/E 4 + 4, C/D 4 + 4, F 8. Mobile : B -> A -> C -> D -> E -> F. Une section repond a une question, pas dix graphiques independants au-dessus du fold.

Actions : choisir comparaison, cliquer barre/categorie/marchand -> Historique avec perimetre et periode conserves ; afficher table alternative. Aucun pourcentage "vs dernier mois" sans base equivalente si mois courant incomplet.

Etats : une seule periode, mois partiel, categories inconnues, remboursements, plusieurs devises, loading/error. Les insights incertains sont des questions ou actions de revue, pas des diagnostics certains.

Acceptation : chaque graphique a question, source, unite et drill-down ; aucune conclusion fondee sur le compte joint absent ; retour d'Historique au meme graphique et a la meme periode.

## P04. Budget

Question : "Que puis-je arbitrer dans cette periode ?" Tranche U2.

| Module | Desktop debut/span | Contenu | Composants |
|---|---|---|---|
| A / Situation budgetaire | 1 / 8 | Alloue, consomme, restant, couverture et periode | C03, C13 |
| B / Semaine | 9 / 4 | Enveloppe variable, consomme et projection clairement qualifiee | C03, C13 |
| C / Enveloppes | 1 / 8, ligne 2 | Tableau/carte par enveloppe, montant reel et restant | C07, C13 |
| D / Arbitrages | 9 / 4, ligne 2 | Deux ou trois ecarts prioritaires avec commandes utiles | C12, C13 |
| E / Partage | 1 / 6, ligne 3 | Vue familiale resume et lien vers Repartition | C15 |
| F / Hypotheses | 7 / 6, ligne 3 | Periode, methode, reports et revenus de reference | C05, C13 |

Tablet : A 8, B/D 4 + 4, C 8, E/F 4 + 4. Mobile : A -> D -> B -> C -> E -> F.

Actions : editer une enveloppe via panneau, proposer reallocation, voir operations d'une categorie, choisir mois/semaine. Une modification de budget ne change pas un montant bancaire. La confirmation resume le total et la source du financement.

Etats : budget non configure, revenu incertain, enveloppe zero, depassement, remboursements et perimetre incomplet. "Restant de budget" n'est pas un synonyme de "solde disponible sur compte".

Acceptation : aucun budget fictif cree pour remplir les cartes ; valeur depassee lisible ; historique des changements ; compensations familiales non comptees une deuxieme fois en consommation.

## P05. Repartition du foyer

Question : "Qui a avance quoi et comment equilibrer ?" Tranche U2, vue dediee du Budget accessible depuis Plus.

| Module | Desktop debut/span | Contenu | Composants |
|---|---|---|---|
| A / Situation de partage | 1 / 8 | Depenses partagees, contributions et compensation datee | C03, C15 |
| B / Methode | 9 / 4 | 50/50, prorata confirme ou montant fixe | C05, C15 |
| C / Justificatifs | 1 / 8, ligne 2 | Operations, payeur, part partagee et part attribuee | C07, C15 |
| D / Exceptions | 9 / 4, ligne 2 | Personnel, exclusion ou cle speciale, avec justification | C05, C15 |
| E / Reglements | 1 / 12, ligne 3 | Historique des compensations, source et annulation | C07, C15 |

Tablet : A 8, B/D 4 + 4, C/E 8. Mobile : A -> B -> C -> D -> E.

Actions : modifier le partage d'une operation, simuler une methode, confirmer sa periode d'application, enregistrer un reglement observe. Aucun bouton pretend envoyer un virement bancaire.

Etats : un seul membre, aucun partage, revenu reference absent, compte joint manquant, reglement partiel, desaccord de classification. Un changement retroactif montre ses consequences avant confirmation.

Acceptation : somme des parts egale la depense en centimes ; la compensation s'explique par ses lignes ; modification d'une part actualise la vue sans reload ; labels payeur/proprietaire/beneficiaire non interchangeables.

## P06. Recurrents et abonnements

Question : "Que payons-nous regulierement et que faut-il verifier ?" Tranche U3.

| Module | Desktop debut/span | Contenu | Composants |
|---|---|---|---|
| A / Cout confirme | 1 / 4 | Equivalent mensuel et annuel avec convention explicite | C03, C14 |
| B / Prochaines dates | 5 / 4 | Horizon court et montant attendu par compte | C14 |
| C / Revue | 9 / 4 | Suggestions et preuves, pas total des abonnements actifs | C12, C14 |
| D / Registre | 1 / 8, ligne 2 | Recurrents confirmes, frequence, montant, statut, compte | C07, C14 |
| E / Selection | 9 / 4, ligne 2 | Historique des montants et occurrences d'un recurrent | C09, C14 |

Tablet : A/B 4 + 4, C 8 si non vide, D 8, E panneau. Mobile : C si revue urgente -> A/B -> D ; detail plein ecran.

Actions : confirmer/rejeter detection, creer manuellement, changer montant/date, mettre en pause, marquer annule dans l'app et rapprocher une occurrence. La resiliation externe n'est jamais promise.

Etats : aucune detection, faux positif, montant variable, annuel, suspendu, tardif, doublon et source ancienne. Suggestion et actif ont des traitements visuels distincts.

Acceptation : une correction ne cree pas une deuxieme recurrence ; montant annuel explique ; chaque suggestion a des mouvements sources ; l'echeance payee reste visible comme telle et sort du prevu non realise.

## P07. Calendrier

Question : "Quel compte risque de manquer d'argent a quelle date ?" Tranche U3, destination secondaire.

| Module | Desktop debut/span | Contenu | Composants |
|---|---|---|---|
| A / Periode | 1 / 8 | Calendrier mensuel ou semaine, mouvements attendus/reels distincts | C09, C14 |
| B / Jour selectionne | 9 / 4 | Agenda date, compte, montant et statut | C14 |
| C / Vigilance | 1 / 6, ligne 2 | Dates proches du plancher et donnees manquantes | C12, C17 |
| D / Revenus attendus | 7 / 6, ligne 2 | Sources confirmees et hypotheses | C14, C17 |

Tablet : A 8, B 8, C/D 4 + 4. Mobile : agenda en premier, jamais grille de 31 petits jours et libelles illisibles ; selection de date compacte, puis vigilance.

Actions : choisir jour, consulter echeance, naviguer vers recurrent, ouvrir scenario. Ne pas permettre de deplacer un paiement comptabilise par drag-and-drop comme une simple date prevue.

Etats : vide, jour sans operation, revenu hypothétique, echeance rapprochee, jour ferie et couverture incomplete.

Acceptation : agenda/graphique concordent ; non-payee n'est pas automatiquement "en retard" sans convention ; une date bank value/operation reste differenciee si pertinente.

## P08. Plan de tresorerie

Question : "Que se passe-t-il si nos prochaines hypotheses se realisent ?" Tranche U3.

| Module | Desktop debut/span | Contenu | Composants |
|---|---|---|---|
| A / Trajectoire | 1 / 8 | Reel puis prevu, plancher, point bas date et horizon | C09, C17 |
| B / Verdict conditionnel | 9 / 4 | Ecart a l'objectif, risque et niveau de confiance | C03, C12 |
| C / Hypotheses | 1 / 4, ligne 2 | Revenus, charges et variation, sans modifier les sources | C05, C17 |
| D / Semaines | 5 / 8, ligne 2 | Ouverture, entrees, sorties, prevu/reel et cloture | C07, C17 |
| E / Scenarios | 1 / 12, ligne 3 | Prudent/reference/alternatif et differences exposees | C05, C17 |

Tablet : A 8, B/C 4 + 4, D 8, E 8. Mobile : B -> A -> C -> D -> E, tables remplacees par des lignes de semaine expansibles.

Actions : modifier hypothese, comparer scenario, revenir au scenario de reference, enregistrer apres confirmation. Aucune annonce de surplus avant solde/ouverture/perimetre confirmes.

Etats : solde inconnu, hypothese non confirmee, depense avant paie, compte negatif, horizon vide et revenu retarde.

Acceptation : point bas intra-semaine verifiable ; changement d'hypothese ne touche pas l'historique ; le verdict mentionne les manques de couverture.

## P09. Comptes

Question : "Quelles sources sont incluses et jusqu'a quand ?" Tranche U1.

| Module | Desktop debut/span | Contenu | Composants |
|---|---|---|---|
| A / Comptes inclus | 1 / 8 | Registre des comptes, proprietaires, type, solde date et couverture | C03, C07 |
| B / Couverture | 9 / 4 | Dernier releve/import, solde connu et comptes manquants | C12 |
| C / Points de controle | 1 / 8, ligne 2 | Observations datees et ecarts independants | C07, C16 |
| D / Actions source | 9 / 4, ligne 2 | Nouveau compte, import, sauvegarde et institution | C04, C18 |

Tablet : A 8, B/D 4 + 4, C 8. Mobile : B si blocage -> A -> D -> C.

Actions : creer un compte via formulaire court, attribuer proprietaires, importer, consulter un checkpoint, archiver. Suppression definitive interdit le compte encore reference ou demande une migration explicite.

Etats : premiere utilisation, sans solde, inactif, ancien, institution inconnue et observation contradictoire.

Acceptation : recalcul ne rafraichit pas le releve ; epargne/patrimoine separes de liquidite ; le compte joint est un compte reel, pas un simple flag sur un virement personnel.

## P10. Import neuf

Question : "Qu'est-ce qui va etre ajoute ou modifie ?" Tranche U1. Pas de connexion a l'ancien import.

| Module | Desktop debut/span | Contenu | Composants |
|---|---|---|---|
| A / Etapes et travail | 1 / 8 | Compte -> fichier -> controle/revue -> confirmation/bilan | C16 |
| B / Source et controle | 9 / 4 | Institution, compte, dates, compteurs et solde connu | C03, C16 |
| C / Revue des lignes | 1 / 12, ligne 2 | Apercu, doublons ambigus, lignes invalides et statut | C07, C16 |

Tablet : A 8, B 8 compact, C 8. Mobile : compte et etape -> B -> travail A -> lignes C. Stepper 4 numeros compact + titre de l'etape, pas quatre longs libelles sur une ligne.

Actions : revenir a une etape sans reperdre le fichier, corriger le compte cible, rejeter une ligne ambigue, confirmer en une operation atomique, consulter le bilan, annuler en securite selon contrat du futur moteur.

Etats : type inconnu, encodage/date/montant invalides, autre compte, solde contradictoire, reimport, fichier tronque, abandon et echec d'ecriture.

Acceptation : aucun import si contradiction non resolue ; apercu n'ecrit pas en base ; bilan distingue cree/modifie/ignore/erreur ; compte cible toujours visible ; operations en attente ne deviennent pas automatiquement comptabilisees.

## P11. Categories et regles

Question : "Comment classer de facon stable et explicable ?" Tranche U1 pour correction manuelle ; U2 pour gestion complete.

| Module | Desktop debut/span | Contenu | Composants |
|---|---|---|---|
| A / Arborescence | 1 / 4 | Categories et sous-categories, nom/icone/couleur semantique | C05, C07 |
| B / Categorie selectionnee | 5 / 8 | Definition, exemples, operations et impact d'un changement | C07 |
| C / Regles | 1 / 8, ligne 2 | Priorite, condition, effet, test sur exemples et provenance | C05, C07 |
| D / Revue | 9 / 4, ligne 2 | Faible confiance, conflit ou correction frequente | C12 |

Tablet : A 8 menu/arbre compact, B 8, C 8, D 8. Mobile : revue -> selecteur categorie -> B -> regles.

Actions : creer/renommer/archiver, tester regle sans mutation, confirmer son impact, lier correction a exemples similaires revus. Une suppression traite les references, elle ne les laisse pas orphelines.

Etats : inconnue, conflit de regles, aucune operation, categorie archivee et tentative de modification d'une nature economique.

Acceptation : aucune categorie par defaut "autre" utilisee pour cacher une absence de classification ; chaque effet automatique est expliquable et reversible.

## P12. Reglages

Question : "Comment configurer et conserver l'application ?" Tranche U1 pour essentiel ; enrichissement U2/U3.

| Module | Desktop debut/span | Contenu | Composants |
|---|---|---|---|
| A / Foyer et preferences | 1 / 6 | Membres, langue, devise d'affichage et convention de periode | C05, C18 |
| B / Donnees et sauvegarde | 7 / 6 | Sauvegarder, restaurer, version et derniere verification | C16, C18 |
| C / Apparence et accessibilite | 1 / 6, ligne 2 | Theme valide, densite, confidentialite et mouvement reduit | C05, C18 |
| D / Installation | 7 / 6, ligne 2 | Capacites reelles Mac/mobile/offline, origine et stockage | C12, C18 |

Tablet : 4 + 4 chaque ligne. Mobile : B -> A -> C -> D. Navigation interne par ancrages ou selecteur, pas sidebar rigide sur telephone.

Actions : changement reversible immediat pour apparence ; confirmation pour convention modifiant les analyses ; restauration avec apercu et consequence. Reset separe et protege, pas a cote d'un bouton d'export courant.

Etats : stockage indisponible, sauvegarde ancienne, restauration incompatible, mauvais secret, installation non disponible et profil sans donnees.

Acceptation : chaque reglage a un effet observable ou n'est pas propose ; aucun texte promet de synchronisation lorsqu'elle n'existe pas ; backup et stockage local ne sont pas confondus.

## P13. Objectifs, apres le coeur

Question : "Quelle reserve est vraiment affectee a cet objectif ?" Fonction secondaire, non bloquante pour U1/U2.

Desktop : trajectoire/objectif span 8, reserve attribuee span 4 ; contributions span 8 et echeance/hypotheses span 4 sur la ligne suivante. Tablet : trajectoire 8, reserves/hypotheses 4 + 4, contributions 8. Mobile : reserve -> trajectoire -> contributions -> hypotheses.

Composants C03, C07, C09 et C17. Pas de carte fictive "voyage" creee d'office. Objectif virtuel, reserve et compte sont distingues ; une meme somme ne finance pas cinq objectifs simultanement.

Actions : creer, affecter reserve, consulter contributions, modifier cible et cloturer. Etats : aucun objectif, sans financement, depassement, echeance passee et compte archive. Acceptation : progression justifiee, attribution reversible et pas de promesse fondee sur un taux d'epargne arbitraire.

## F01. Parcours de consultation, premiere tranche

1. Ouvrir Aujourd'hui : foyer, date et origine visibles ; jeu fictif nomme dans U0.
2. Choisir compte/periode : contexte et modules se mettent a jour ensemble.
3. Cliquer un point ou "Voir l'historique" : ouvrir P02 avec filtre compatible.
4. Ouvrir une operation : lire source, statut, compte et categorie dans C10.
5. Fermer : meme filtre, meme selection et meme position de liste.

Branche vide : aucune operation ce jour -> message contextualise et choix de toute la periode. Branche erreur : module erreur avec retry, contexte conserve. Retour navigateur restaure la destination precedente.

## F02. Parcours de correction

1. Ouvrir detail en lecture ; passer en edition explicite.
2. Modifier categorie/marchand normalise/note, sans toucher au libelle bancaire original.
3. Erreur -> label et message inline, aucun effacement de saisie.
4. Enregistrer -> pending, commande bloquee sans changement de largeur.
5. Succes -> nouvelle valeur dans detail et liste, feedback bref ; retour a la ligne source.

Fermer modified -> choix conserver/abandonner dans le contexte, pas deux modals empiles. Echec d'ecriture -> conserver le formulaire et expliquer comment reprendre. Deux clics ne creent pas deux commandes.

## F03. Parcours d'import quotidien, tranche suivante

Creer comptes/personnes -> solde date independant -> adapter CSV reconnu -> apercu -> revue des lignes ambiguës -> controle independant du solde -> confirmation atomique -> bilan -> P02 avec source import selectionnee -> P01 actualise.

Erreur de fichier : rester a l'etape utile. Erreur de solde : ne pas accepter artificiellement en reecrivant l'ouverture. Import du second compte/joint : reutiliser le parcours neuf, jamais fusionner implicitement tous les comptes d'un fichier vers le compte actif.

## F04. Parcours familial, tranche U2

P04 -> P05 -> consulter une depense -> confirmer partage et payeur -> simulation de methode -> compensation expliquee -> enregistrer un reglement observe -> verifier le nouveau solde de compensation et les mouvements sources.

Si compte joint absent, couverture incomplete explicite. Si reglement n'a pas de preuve, il reste une annotation/hypothese selon politique, pas une operation bancaire creee silencieusement.

## F05. Parcours d'anticipation, tranche U3

P06 suggestion -> preuve -> confirmer -> P07 echeance -> P08 projection -> modifier hypothese -> importer paiement reel -> rapprocher occurrence -> projection actualisee sans double comptage.

Un rejet de suggestion n'apparait pas a nouveau sans raison. Une resiliation dans l'app indique "suivi annule" et ne promet pas d'action externe.

## Gate de validation UI/UX

- Chaque page a une question, une action principale, un contexte visible, un ordre mobile et ses etats.
- Toute action visible atteint un resultat, une erreur recuperable ou une annulation ; aucune fonction muette.
- Les modules n'empilent pas des cartes internes pour chaque nombre ; l'information garde sa hierarchie.
- Screenshots 1440/390 et controles 320/768/1920 ; textes longs, zoom 200 %, themes effectivement livres.
- Dock et footer ne masquent rien ; focus et retour navigateur/scroll testes.
- Chaque graphique a une alternative table et une source ; chaque montant affiche sa precision/statut.
- Registre de mouvement applique : aucune animation livree sans son test, aucune absence de mouvement par oubli.
- U0 est explicitement fictif. U1 a ses validations financieres, reactivite et persistance neuves avant tout usage reel.