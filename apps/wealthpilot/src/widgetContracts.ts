import type { WidgetId } from "./types";

type Contract = {
  question: string;
  scope: "account" | "household" | "none";
  period: "range" | "cutoff" | "live" | "none";
};

// A control is offered only when it changes this card's answer.
export const widgetContracts: Record<WidgetId, Contract> = {
  balance: {
    question: "Combien possédons-nous à cette date ?",
    scope: "account",
    period: "cutoff",
  },
  available: {
    question: "Quelle marge reste après les engagements et réserves ?",
    scope: "household",
    period: "cutoff",
  },
  chart: {
    question: "Quand le solde monte-t-il, baisse-t-il ou devient-il risqué ?",
    scope: "account",
    period: "range",
  },
  budgets: {
    question: "Que reste-t-il dans chaque enveloppe de la période ?",
    scope: "account",
    period: "range",
  },
  goal: {
    question: "Quelle est la prochaine étape de mon projet prioritaire ?",
    scope: "account",
    period: "live",
  },
  goals: {
    question:
      "Quels projets progressent et lesquels nécessitent une décision ?",
    scope: "account",
    period: "live",
  },
  goalDate: {
    question: "Quand l’effort prévu permettra-t-il de financer mes projets ?",
    scope: "account",
    period: "live",
  },
  effort: {
    question: "Mon effort mensuel suffit-il aux échéances de mes projets ?",
    scope: "account",
    period: "live",
  },
  savings: {
    question: "À quoi l’épargne déjà réservée est-elle affectée ?",
    scope: "account",
    period: "live",
  },
  dues: {
    question: "Quels mouvements sont attendus avant la fin du cycle ?",
    scope: "account",
    period: "cutoff",
  },
  transactions: {
    question: "Quelles opérations expliquent cette période ?",
    scope: "account",
    period: "range",
  },
  sources: {
    question: "Mes soldes et relevés sont-ils assez récents pour décider ?",
    scope: "account",
    period: "cutoff",
  },
  weekly: {
    question: "Combien reste-t-il par catégorie cette semaine ?",
    scope: "account",
    period: "live",
  },
  purchase: {
    question: "Cet achat compromet-il mes prochaines échéances ?",
    scope: "account",
    period: "live",
  },
  low: {
    question: "Quel est le jour le plus fragile du cycle ?",
    scope: "account",
    period: "cutoff",
  },
  flows: {
    question: "Les revenus de la période couvrent-ils ses dépenses ?",
    scope: "account",
    period: "range",
  },
  scenario: {
    question:
      "Quel effet aurait un changement mensuel de charges ou de revenus ?",
    scope: "none",
    period: "none",
  },
  safety: {
    question: "Le foyer reste-t-il au-dessus de son minimum de sécurité ?",
    scope: "household",
    period: "cutoff",
  },
  accounts: {
    question: "Quels comptes sont à découvert ou doivent être actualisés ?",
    scope: "account",
    period: "cutoff",
  },
  charges: {
    question: "À quelles dates faut-il garder l’argent des charges restantes ?",
    scope: "account",
    period: "cutoff",
  },
  funding: {
    question: "Quel compte faudra-t-il approvisionner et avant quelle date ?",
    scope: "account",
    period: "cutoff",
  },
  paidBy: {
    question: "Quels comptes supportent les dépenses du foyer ?",
    scope: "account",
    period: "range",
  },
  uncategorized: {
    question: "Quelles opérations ont besoin d’être classées ?",
    scope: "account",
    period: "range",
  },
  recurring: {
    question: "Quelles cadences détectées dois-je confirmer ou ignorer ?",
    scope: "account",
    period: "live",
  },
  categories: {
    question: "Quels usages absorbent les dépenses de la période ?",
    scope: "account",
    period: "range",
  },
  pace: {
    question: "À quel rythme ai-je réellement dépensé sur la période ?",
    scope: "account",
    period: "range",
  },
  unusual: {
    question: "Quelles opérations dépassent mon historique comparable ?",
    scope: "account",
    period: "range",
  },
  comparison: {
    question: "Comment les mois se comparent-ils, à couverture connue ?",
    scope: "account",
    period: "range",
  },
  configuration: {
    question: "Quelle disposition et quelles sources sont enregistrées ?",
    scope: "none",
    period: "none",
  },
  library: {
    question: "Quelle autre question puis-je ajouter à mon dashboard ?",
    scope: "none",
    period: "none",
  },
};

export const contractFor = (id: WidgetId) => widgetContracts[id];
