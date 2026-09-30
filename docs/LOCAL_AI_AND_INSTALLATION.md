# Installation locale et catégorisation hybride

## Installer WealthPilot dans le Dock

WealthPilot est préparé comme PWA : manifest, icônes 192/512, mode `standalone`, cache hors connexion et raccourcis Import/Plan/Transactions.

- Safari sur macOS : ouvrir l’application, puis **Fichier → Ajouter au Dock**.
- Chrome/Edge : utiliser l’action **Installer** dans la barre d’adresse ou dans Réglages → Installation.

Le stockage reste attaché au profil navigateur qui a installé l’application. Effectuer une sauvegarde chiffrée avant de changer de profil ou de navigateur.

## Ordre de décision de la catégorisation

1. Une règle déterministe directionnelle connue gagne toujours.
2. Pour une ligne ambiguë, un historique local dominant (au moins deux observations, ≥80 %) peut proposer une catégorie.
3. Le modèle local ne reçoit que les lignes encore ambiguës.
4. Une réponse du modèle doit utiliser un couple catégorie/sous-catégorie existant et atteindre 78 % de confiance.
5. Sinon la ligne reste explicitement « À vérifier » ; elle n’est jamais silencieusement forcée.
6. Une correction manuelle est pondérée davantage lors des imports suivants.

Chaque transaction conserve la source, la confiance et la justification de sa classification.

## Lancer le modèle local

```bash
npm run local-ai
```

Le lanceur :

- écoute uniquement sur `127.0.0.1:8080` ;
- limite les origines aux serveurs WealthPilot locaux ;
- désactive le raisonnement affiché et fixe la température à zéro ;
- utilise une requête à la fois pour éviter les pointes mémoire ;
- utilise par défaut Granite 4.2 8B MLX déjà présent sur cette machine.

Un autre modèle MLX peut être choisi :

```bash
WEALTHPILOT_LOCAL_MODEL=/chemin/vers/le/modele npm run local-ai
```

Le cache Ling 3.0 Tiny est bien présent, mais ses poids `kv_b_proj` quantifiés ne sont actuellement pas pris en charge par `mlx-lm 0.32.0` installé sur cette machine. Le lanceur l’accepte lorsqu’un runtime compatible sera disponible et affiche entre-temps un avertissement explicite.

## Données envoyées au modèle

Uniquement : sens débit/crédit, marchand normalisé et libellé nettoyé. Les dates, numéros de compte, soldes et fichiers CSV bruts ne sont pas transmis. L’URL du classifieur est verrouillée à `localhost`/`127.0.0.1` et les réponses sont validées contre la taxonomie locale.

Les taux de change n’effectuent plus d’appel automatique : ils restent hors ligne par défaut. Leur actualisation externe exige une action explicite dans les réglages.
