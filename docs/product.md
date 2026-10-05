# Règles métier

## Calendrier

Un mois budgétaire commence au premier salaire régulier réellement reçu par le foyer et finit la veille du suivant. Il n'y a pas de jour fixe. Le foyer partage le même calendrier ; filtrer un compte change les montants, pas les dates.

## Soldes et prévision

- Solde reconstruit depuis un solde observé daté ; inconnu = « à confirmer », jamais 0.
- Les virements internes sont neutres pour le foyer et réels pour chaque compte. Un même montant sorti d'un compte et entré sur un autre à ≤ 3 jours est proposé comme virement (« À traiter »).
- Prévision : charges connues et estimées (récurrences), revenus à leur date. Un revenu en retard n'est pas compté ; une charge échue depuis plus de 31 jours sort du calcul et passe en « à vérifier ».
- Récurrences : 3 occurrences ou plus, un rythme mensuel qui tolère un paiement décalé (≤ 42 jours) ; un revenu prend le montant de son dernier versement.

## Enveloppes et semaine

- Libre d'une enveloppe = max(0, alloué − payé − engagé). Elle n'est jamais déduite deux fois entre la semaine, le mois et la prévision.
- Disponible = trésorerie − charges du mois − enveloppes restantes − réserve − épargne réservée.
- Limite hebdo proposée = médiane des semaines comparables, en euros entiers. Un achat dans l'enveloppe ne baisse pas la fin de semaine une seconde fois.

## Notre plan

- Clé de partage = dernier salaire de chacun / total (ou 50/50, ou réglage manuel). Un salaire de référence saisi remplace le salaire détecté.
- Chaque charge (par sous-catégorie) a sa répartition : selon revenus, 50/50, 100 % l'un ou l'autre, chacun le sien. Les comptes joints sont comptés comme payés par la personne qui les alimente.
- Sortie du rouge : solde de fin de mois sur 18 mois, avec un effort hebdo ; chaque mois indique l'effort nécessaire et la pression.
- Montants affichés en euros entiers, arrondis au-dessus.

## Libellés et catégories

Le libellé bancaire brut est conservé. L'affichage utilise le nom saisi, sinon un nom lisible (« Crédit auto BFM », « Virement d'Anthonny Olime · Voiture »). La sous-catégorie manquante vient de la colonne brute, de l'historique du commerçant ou d'une liste de commerçants connus, et elle est marquée « déduite ».
