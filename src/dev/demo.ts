// Deterministic fictional household for development and browser QA.
// Loaded only by the dev server (`?demo`) into an empty database.
import { db } from "../data/db";
import { restoreBackup, validateBackup } from "../data/backup";
import { fingerprint, transactionState } from "../data/importer/preview";
import { addDays, shiftMonth, today, weekday } from "../domain/dates";
import { defaultPreferences, type Budget, type Due, type Snapshot, type Transaction } from "../domain/types";

function random(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

interface Draft {
  date: string;
  account: string;
  amount: number;
  merchant: string;
  category: string;
  internal?: boolean;
  sub?: string;
}

export function demoSnapshot(asOf = today()): Snapshot {
  const rand = random(42);
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
  const cents = (min: number, max: number) => -Math.round((min + rand() * (max - min)) * 100);
  const drafts: Draft[] = [];
  const add = (d: Draft) => d.date <= addDays(asOf, 3) && drafts.push(d);
  const start = shiftMonth(asOf.slice(0, 7), -8);

  for (let m = 0; m <= 9; m++) {
    const month = shiftMonth(start, m);
    const day = (n: number) => `${month}-${String(n).padStart(2, "0")}`;
    const salaryAlex = day([25, 27, 26, 24, 27, 25, 26, 25, 27, 26][m]);
    const salarySam = day([27, 28, 27, 26, 28, 27, 28, 27, 28, 27][m]);
    add({ date: salaryAlex, account: "Alex", amount: 265000 + (m === 5 ? 40000 : 0), merchant: "Salaire Atelier Nord", category: "Income", sub: "Salary" });
    add({ date: salarySam, account: "Sam", amount: 218000, merchant: "Salaire Studio Ouest", category: "Income", sub: "Salary" });
    add({ date: day(5), account: "Commun", amount: 32000, merchant: "CAF", category: "Income", sub: "Benefits" });
    for (const [who, amount] of [["Alex", 90000], ["Sam", 70000]] as const) {
      add({ date: addDays(salaryAlex, 1), account: who, amount: -amount, merchant: "Virement vers Commun", category: "Transfers", sub: "To Joint", internal: true });
      add({ date: addDays(salaryAlex, 1), account: "Commun", amount, merchant: `Virement de ${who}`, category: "Transfers", sub: "To Joint", internal: true });
    }
    add({ date: day(1), account: "Commun", amount: -92000, merchant: "Loyer Foncia", category: "Housing", sub: "Rent" });
    add({ date: day(4), account: "Commun", amount: -7800, merchant: "Assurance MAIF", category: "Bills", sub: "Insurance" });
    add({ date: day(8), account: "Commun", amount: cents(55, 95), merchant: "EDF", category: "Housing", sub: "Utilities" });
    add({ date: day(10), account: "Commun", amount: -2999, merchant: "Free Mobile", category: "Bills", sub: "Mobile" });
    add({ date: day(12), account: "Alex", amount: -1349, merchant: "Netflix", category: "Entertainment", sub: "Streaming" });
    add({ date: day(15), account: "Sam", amount: -1099, merchant: "Spotify", category: "Entertainment", sub: "Streaming" });
    add({ date: day(18), account: "Commun", amount: -8000, merchant: "Cantine École", category: "Family", sub: "School" });
    for (let d = 1; d <= 28; d++) {
      const date = day(d);
      if (weekday(date) === 5 || rand() < 0.12)
        add({ date, account: "Commun", amount: cents(35, 130), merchant: pick(["Carrefour Market", "Lidl", "Monoprix", "Biocoop"]), category: "Food", sub: "Groceries" });
      if (rand() < 0.16)
        add({ date, account: pick(["Alex", "Sam"]), amount: cents(9, 48), merchant: pick(["McDonald's", "Big Fernand", "Pizza Hut", "Boulangerie Paul"]), category: "Food" });
      if (rand() < 0.1)
        add({ date, account: pick(["Alex", "Sam"]), amount: cents(25, 70), merchant: pick(["Total Énergies", "SNCF", "RATP"]), category: "Transport" });
      if (rand() < 0.05)
        add({ date, account: pick(["Alex", "Sam", "Commun"]), amount: cents(20, 160), merchant: pick(["Amazon", "Decathlon", "Kiabi", "Fnac"]), category: "Shopping", sub: "General" });
    }
    if (m === 6) add({ date: day(14), account: "Commun", amount: -64000, merchant: "Garage Midas", category: "Transport", sub: "Car Care" });
  }
  add({ date: addDays(asOf, -2), account: "Sam", amount: -2380, merchant: "CB LECLERC DRIVE 0412", category: "À catégoriser" });
  add({ date: addDays(asOf, -1), account: "Alex", amount: -1590, merchant: "PAYPAL *STEAM", category: "À catégoriser" });

  const batchId = "demo-batch";
  const transactions: Transaction[] = drafts
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d, i) => {
      const t = {
        date: d.date,
        account: d.account,
        amount: d.amount,
        merchant: d.merchant,
        label: d.merchant.toUpperCase(),
        category: d.category,
        ...(d.sub && { subcategory: d.sub }),
        internal: Boolean(d.internal),
        raw: {},
      };
      const full = { ...t, fingerprint: fingerprint(t), id: `demo-${i}`, batchId };
      return { ...full, importedState: transactionState(full) };
    });

  const observed = addDays(asOf, -3);
  const accounts = (["Commun", "Alex", "Sam"] as const).map((id, i) => ({
    id,
    checkpoints: [{ date: observed, amount: [107000, 88000, 49000][i], status: "observed" as const, accepted: true, batchId, sourceHash: "demo" }],
    coverage: [{ from: transactions[0].date, through: observed, sourceHash: "demo", batchId, complete: true }],
  }));

  const month = asOf.slice(0, 7);
  const budgets: Budget[] = [
    ["Food", 78000],
    ["Transport", 15000],
    ["Shopping", 12000],
    ["Bills", 12000],
    ["Entertainment", 3000],
  ].flatMap(([category, amount]) =>
    [shiftMonth(month, -1), month].map((m) => ({ id: `budget-${m}-${category}`, category: String(category), amount: Number(amount), month: m })),
  );
  const dues: Due[] = [
    { id: "due-school", label: "Sortie scolaire", amount: -4500, date: addDays(asOf, 4), account: "Commun", category: "Family" },
  ];

  return {
    transactions,
    accounts,
    budgets,
    dues,
    batches: [
      {
        id: batchId,
        name: "demo-foyer.csv",
        hash: "demo",
        createdAt: `${observed}T09:00:00.000Z`,
        count: transactions.length,
        minDate: transactions[0].date,
        maxDate: transactions.at(-1)!.date,
        transactionIds: transactions.map((t) => t.id),
      },
    ],
    preferences: { ...defaultPreferences, safety: 60000 },
  };
}

export async function loadDemoIfEmpty() {
  if ((await db.transactions.count()) > 0) return;
  await restoreBackup(validateBackup({ format: "wealthpilot-next", version: 1, data: demoSnapshot() }));
}
