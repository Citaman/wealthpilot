# Archive : validation du premier atelier

Ce releve concerne la proposition rejetee. Pour les sources et tests actuels, consulter [la verification de l'experience](VERIFICATION.md).

Date : 30 septembre 2026.
Statut : proposition de conception testee sur la planche, pas certification de la future application.

## Perimetre reel

- [Referentiel](DESIGN_SYSTEM.md) : dix-huit familles de composants et registre de mouvement.
- [Compositions et parcours](SCREENS_AND_FLOWS.md) : treize pages et cinq parcours.
- [Tokens](tokens.json) : palettes, typographie, dimensions et mouvement.
- [Planche autonome](preview.html) : deux ecrans detailles, panneau d'operation, specimens de composants et treize plans de composition.

La planche utilise uniquement des donnees fictives. Aucun acces a IndexedDB, aucune lecture bancaire, aucune migration, aucune sauvegarde et aucun appel au moteur existant. Ses courbes sont des fixtures de conception, pas des calculs du futur moteur. Les specimens de categories et de prochaines echeances ne sont pas un historique exhaustif ; ils sont identifies comme exemples.

## Controles executes

Controles effectues avec Node et Playwright dans le navigateur integre de VS Code, sur le fichier local. Ce sont des verifications de session ; aucune suite CI de la nouvelle application n'est encore creee.

| Controle | Resultat observe |
| --- | --- |
| JavaScript inline et Lucide | Syntaxe valide |
| Ressources locales | Liens resolus ; police WOFF2 valide ; Instrument Sans chargee ; icones Lucide presentes |
| Images du moodboard | Trois images chargees, dimensions naturelles non nulles ; capture inspectee |
| Contrastes | 20 paires passees : dix par theme, texte 4,5:1 et controles 3:1 selon la matrice |
| Parite des palettes | Variables utilisees dans le HTML conformes au JSON pour les deux themes |
| Structure du referentiel | 18 contrats C01-C18, 13 destinations, 5 parcours ; references de composants et liens locaux valides |
| Responsive detaille | Aujourd'hui, Historique et Bibliotheque a 320, 390, 768, 1440 et 1920 px |
| Plans responsive | Les treize compositions a 320 et 1440 px |
| Debordement horizontal | Aucun sur ces 41 compositions |
| Dock | Dans le viewport ; dernier module accessible 24 px au-dessus du dock en fin de scroll, a 390 et 1440 px |
| Ordre mobile Aujourd'hui | Solde, verification, echeances, flux, budget, historique, categories ; ordre DOM et visuel identiques |
| Graphique | Canvas non vide : 4 563 pixels peints dans le controle mobile ; ouverture et tableau alternatif presents |
| Source ancienne | Courbe et selection arretees au 12 septembre, contre le 29 en etat normal |
| Historique | Recherche donnant une ligne, filtre attente donnant une ligne, compte joint donnant deux lignes ; zero resultat et remise a zero testes |
| Confidentialite | Masquage et reaffichage des montants testes |
| Etats de donnees | Premiere utilisation, chargement statique, erreur avec reprise et source ancienne testes |
| Detail desktop | Largeur 440 px ; body avec padding 24 px |
| Detail mobile | Plein ecran a 390 px ; capture inspectee, champs et footer lisibles |
| Clavier | Ouverture, fermeture par Echap, retour du focus, retour apres enregistrement et boucle Shift+Tab dans le dialogue testes |
| Edition | Validation d'un nom trop court, sauvegarde fictive, erreur avec conservation des valeurs, reprise et abandon testes |
| Themes | Variantes claire et sombre actives ; valeurs de canvas et texte conformes |

Les captures d'Aujourd'hui desktop/mobile, du detail mobile et du moodboard ont ete inspectees dans la session. Elles ne constituent pas encore une suite de comparaison visuelle persistante.

## Mouvement effectivement controle

| Interaction | Decision | Controle |
| --- | --- | --- |
| Navigation, montants, graphique, filtres | Aucune animation | Rendu immediat ; pas de compteur, de morphing ni de stagger |
| Feedback des commandes | Transition couleur/fond/bordure de 100 ms | Definition CSS controlee ; aucune modification de geometrie |
| Menu Plus | Apparition en opacite de 120 ms | Duree calculee controlee ; fermeture et retour au declencheur par Echap testes |
| Scrim | Apparition de 120 ms ; fond a 24 %, sans blur | Duree calculee controlee |
| Detail | Apparition de 160 ms, opacite et translation de 16 px | Keyframes lus ; etat final opacite 1 et transform none ; fermeture/reouverture testees |
| Fermeture des couches | Immediate dans la planche | Ne retarde pas le retour au contexte |
| Mouvement reduit | Durees nulles | `prefers-reduced-motion: reduce` teste : detail, commandes et menu a 0 s |

Le controle du mouvement reduit se fait aussi via un bouton de specimen dans la bibliotheque. Le scenario d'enregistrement dure 220 ms uniquement pour rendre l'etat pending observable ; ce delai n'est ni une animation ni une promesse de performance.

## Limites explicites

- Pas de fichier Figma natif, de composants React definitifs ni de nouvelle application.
- Les plans sont des wireframes fonctionnels, pas treize ecrans finalises et certifies.
- La periode du jeu fictif est fixe. Les preferences de specimen et les editions ne persistent pas.
- Aucun import, calcul de rapprochement, budget reel, projection reelle, synchronisation ou sauvegarde n'est implemente.
- Pas encore de certification VoiceOver, axe, zoom 200 %, navigateur iOS reel, clavier virtuel ou compatibilite multi-navigateurs.
- La planche ne valide pas encore le retour de navigation, l'historique navigateur et la restauration du scroll de la future application.
- Les 18 contrats sont documentes ; toutes leurs variantes et interactions ne sont pas deja executees dans la planche. La validation d'une famille future reste obligatoire lors de son implementation.

## Gates avant livraison UI

1. Revue et accord sur la direction, la densite, le dock et les proportions. Le statut reste propose jusque-la.
2. Premiere tranche coherente : shell, dock reduit aux fonctions livrees, Aujourd'hui, Historique et detail, avec toutes les variantes requises.
3. Tests persistants des composants effectivement livres : focus, pending/error, clavier, geometrie, motion normale/reduite et regressions visuelles.
4. Tests de navigation et de retour contextualise ; lecture et ordre mobile ; cibles tactiles ; zoom et lecteurs d'ecran.
5. Puis import, stockage et moteur neufs, avec invariants financiers, erreurs explicables et mises a jour reactives testes independamment.

Les anciens tests de WealthPilot ne satisfont aucune de ces gates par leur seule reussite. Ils documentent l'ancien comportement, dont certaines erreurs ont ete observees en usage.

## Ressources et licences

- Instrument Sans variable latin : [source Google Fonts](https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400..700&display=swap), [licence OFL locale](assets/Instrument-Sans-OFL.txt).
- Lucide 0.468.0 UMD : [distribution](https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js), [licence locale](assets/Lucide-LICENSE.txt).
- Les images restent les references fournies dans le workspace, sans modification ni imitation integrale.