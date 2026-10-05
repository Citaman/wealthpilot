import { expect, it } from "vitest";
import { upcoming } from "./events";
import { activeRecurrences, detectRecurrences, estimates } from "./recurring";
import { due, ledgerOf, tx, type World } from "./test-fixtures";
import type { RecurrenceRule, Transaction } from "./types";

const spotify = (
  date: string,
  amount = -5000,
  patch: Partial<Transaction> = {},
) =>
  tx(date, date, amount, {
    merchant: "Spotify",
    label: "Prélèvement Spotify",
    category: "Abonnements",
    ...patch,
  });
const monthly = () => [
  spotify("2026-07-15"),
  spotify("2026-08-15"),
  spotify("2026-09-15"),
];
const dates = (w: World, end: string, asOf: string) =>
  estimates(ledgerOf(w, asOf), end).map((e) => e.date);

it("détection : loyer à date dérivante (38 jours), cadence mensuelle, refus des séries instables, paiement fractionné le même jour, format figé des identifiants", () => {
  // keeps a rent paid by hand whose date drifts (one 38-day gap)
  {
    const rent = [
      "2026-05-07",
      "2026-06-05",
      "2026-07-13",
      "2026-08-10",
      "2026-09-08",
    ].map((d) =>
      tx(d, d, -119394, {
        merchant: "Loyer ORPI",
        label: "VIR INSTANTANE EMIS",
        category: "Logement",
      }),
    );
    expect(detectRecurrences(rent, "2026-10-05").map((r) => r.name)).toEqual([
      "Loyer ORPI",
    ]);
  }
  // detects a monthly cadence with signed amount and confidence
  {
    const [r] = detectRecurrences(monthly(), "2026-10-03");
    expect(r).toMatchObject({
      next: "2026-10-15",
      amount: -5000,
      count: 3,
      frequency: "monthly",
      confidence: 70,
    });
    expect(r.key).toBe(JSON.stringify(["A", "spotify", -1]));
  }
  // refuses irregular dates, transfers, two payments, mixed accounts or signs, stale or unstable series
  {
    const none = (rows: Transaction[], asOf = "2026-10-03") =>
      expect(detectRecurrences(rows, asOf)).toEqual([]);
    none([spotify("2026-07-02"), spotify("2026-08-15"), spotify("2026-09-22")]);
    none(monthly().map((t) => ({ ...t, internal: true })));
    none(monthly().slice(1));
    none([
      spotify("2026-07-15"),
      spotify("2026-08-15", 5000),
      spotify("2026-09-15", -5000, { account: "B" }),
    ]);
    none(monthly(), "2027-03-03");
    none([
      spotify("2026-07-15"),
      spotify("2026-08-15", -25000),
      spotify("2026-09-15"),
    ]);
  }
  // keeps a series with two payments on the same day as one occurrence
  {
    const split = [
      spotify("2026-07-15"),
      spotify("2026-08-15", -2500),
      { ...spotify("2026-08-15", -2500), id: "split" },
      spotify("2026-09-15"),
    ];
    expect(detectRecurrences(split, "2026-10-03")[0]).toMatchObject({
      amount: -5000,
      count: 3,
    });
  }
  // is replaced by the real payment, with the frozen id format
  {
    const [first] = estimates(
      ledgerOf({ transactions: monthly() }, "2026-10-03"),
      "2026-10-31",
    );
    expect(first.id).toBe(
      `estimate:${JSON.stringify(["A", "spotify", -1])}:2026-10-15`,
    );
    expect(
      dates(
        { transactions: [...monthly(), spotify("2026-10-15")] },
        "2026-10-31",
        "2026-10-16",
      ),
    ).toEqual([]);
  }
});

it("occurrences estimées : fins de mois, hebdomadaire, jamais de doublon avec une échéance, règles confirmées (remplacement, pause, fin, override, ancienne règle mensuelle)", () => {
  // clamps month ends and unrolls several future occurrences
  {
    const transactions = [
      spotify("2026-07-31"),
      spotify("2026-08-31"),
      spotify("2026-09-30"),
    ];
    expect(dates({ transactions }, "2026-12-31", "2026-10-03")).toEqual([
      "2026-10-31",
      "2026-11-30",
      "2026-12-31",
    ]);
  }
  // unrolls a weekly cadence
  {
    const transactions = [
      spotify("2026-09-17"),
      spotify("2026-09-24"),
      spotify("2026-10-01"),
    ];
    expect(dates({ transactions }, "2026-10-22", "2026-10-03")).toEqual([
      "2026-10-08",
      "2026-10-15",
      "2026-10-22",
    ]);
  }
  // never doubles a manual due and keeps a dismissal
  {
    const transactions = monthly();
    expect(
      dates(
        {
          transactions,
          dues: [due("d", "2026-10-15", -5000, { label: "Spotify" })],
        },
        "2026-10-31",
        "2026-10-03",
      ),
    ).toEqual([]);
    const key = detectRecurrences(transactions, "2026-10-03")[0].key;
    expect(
      dates(
        { transactions, prefs: { dismissedRecurrences: [key] } },
        "2026-10-31",
        "2026-10-03",
      ),
    ).toEqual([]);
  }
  // lets one manual weekly bill cover only its nearest occurrence
  {
    const transactions = ["2026-09-14", "2026-09-21", "2026-09-28"].map((d) =>
      spotify(d, -1000),
    );
    const bill = (date: string) => [
      due("d", date, -1000, { label: "Spotify" }),
    ];
    expect(
      dates(
        { transactions, dues: bill("2026-10-08") },
        "2026-10-12",
        "2026-10-03",
      ),
    ).toEqual(["2026-10-12"]);
    expect(
      dates(
        { transactions, dues: bill("2026-10-09") },
        "2026-10-12",
        "2026-10-03",
      ),
    ).toEqual(["2026-10-05"]);
  }
  // replaces the suggestion and changes only future occurrences
  {
    const detected = activeRecurrences(
      ledgerOf({ transactions: water() }, "2026-10-04"),
    )[0];
    const ledger = ledgerOf(
      {
        transactions: water(),
        prefs: {
          recurrenceRules: [
            rule({
              sourceKey: detected.key,
              frequency: "monthly",
              next: "2026-10-08",
            }),
          ],
        },
      },
      "2026-10-04",
    );
    expect(
      estimates(ledger, "2026-11-30").map((d) => [
        d.date,
        d.amount,
        d.confirmed,
        d.spread,
      ]),
    ).toEqual([
      ["2026-10-08", -1200, true, 0],
      ["2026-11-08", -1200, true, 0],
    ]);
    expect(activeRecurrences(ledger)).toHaveLength(1);
  }
  // scopes pause, end date and ignored occurrence
  {
    const run = (r: RecurrenceRule, ignored: string[] = []) =>
      estimates(
        ledgerOf(
          { prefs: { recurrenceRules: [r], ignoredOccurrences: ignored } },
          "2026-10-04",
        ),
        "2026-11-30",
      );
    const first = run(rule({ end: "2026-10-20" }));
    expect(first.map((d) => d.date)).toEqual([
      "2026-10-06",
      "2026-10-13",
      "2026-10-20",
    ]);
    expect(
      run(rule({ end: "2026-10-20" }), [first[0].id]).map((d) => d.date),
    ).toEqual(["2026-10-13", "2026-10-20"]);
    expect(run(rule({ paused: true }))).toEqual([]);
  }
  // does not let a moved override swallow the next occurrence, nor duplicate it when re-enabled
  {
    const original = estimates(
      ledgerOf({ prefs: { recurrenceRules: [rule()] } }, "2026-10-04"),
      "2026-10-20",
    )[0];
    const override = due("override", "2026-10-12", -1200, {
      label: "Water",
      originOccurrenceId: original.id,
      recurrenceKey: original.recurrenceKey,
    });
    for (const ignored of [[original.id], []]) {
      const ledger = ledgerOf(
        {
          dues: [override],
          prefs: { recurrenceRules: [rule()], ignoredOccurrences: ignored },
        },
        "2026-10-04",
      );
      expect(upcoming(ledger, "", "2026-10-20").map((d) => d.date)).toEqual([
        "2026-10-12",
        "2026-10-13",
        "2026-10-20",
      ]);
    }
  }
  // advances an old monthly rule without losing its month-end day
  {
    const old = rule({
      frequency: "monthly",
      next: "2020-01-31",
      amount: 100000,
    });
    expect(
      dates({ prefs: { recurrenceRules: [old] } }, "2026-03-31", "2026-02-01"),
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  }
});

const water = () =>
  ["07", "08", "09"].map((m, i) =>
    tx(String(i), `2026-${m}-06`, -1000, {
      merchant: "Water",
      label: "Water",
      category: "Bills",
    }),
  );
const rule = (patch: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  id: "r",
  name: "Water",
  account: "A",
  amount: -1200,
  category: "Bills",
  frequency: "weekly",
  next: "2026-10-06",
  ...patch,
});
