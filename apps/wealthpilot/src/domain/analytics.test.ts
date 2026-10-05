import { describe, expect, it } from "vitest";
import { monthlyFlows, spendingByCategory, unusualExpenses } from "./analytics";
import {
  CATEGORY_COLORS,
  categoryColor,
  isUncategorized,
  suggestCategories,
} from "./categories";
import { inbox } from "./inbox";
import {
  filterTransactions,
  summarize,
  type TransactionFilters,
} from "./search";
import { anchored, ledgerOf, tx, type World } from "./test-fixtures";

const scope = (account: string, from: string, to: string, asOf: string) => ({
  account,
  range: { from, to },
  asOf,
});

describe("monthly flows", () => {
  it("sums external income and spending per income-anchored month, transfers neutral, future excluded", () => {
    const ledger = ledgerOf(
      {
        transactions: [
          tx("Avant cycle", "2026-09-25", -5000),
          tx("Salaire Anthony", "2026-09-26", 250000),
          tx("Salaire Yaren", "2026-09-27", 180000, { account: "Y" }),
          tx("Loyer", "2026-10-01", -90000, { category: "Logement" }),
          tx("Courses", "2026-10-03", -10000),
          tx("Virement A", "2026-10-04", -1000, { internal: true }),
          tx("Virement Y", "2026-10-04", 1000, {
            account: "Y",
            internal: true,
          }),
          tx("CAF", "2026-10-05", 20000, { account: "Y" }),
          tx("Futur", "2026-10-26", 250000),
        ],
      },
      "2026-10-05",
    );
    expect(monthlyFlows(ledger, "", 2)).toEqual([
      {
        month: "2026-09",
        range: { from: "2026-09-01", to: "2026-09-25", partial: true },
        income: 0,
        spending: 5000,
        net: -5000,
        complete: true,
      },
      {
        month: "2026-10",
        range: { from: "2026-09-26", to: "2026-10-25", estimatedEnd: true },
        income: 450000,
        spending: 100000,
        net: 350000,
        complete: false,
      },
    ]);
    expect(monthlyFlows(ledger, "Y", 1)[0].income).toBe(200000);
  });

  it("compares budget months of one account only, without income, transfers or future data", () => {
    const ledger = ledgerOf(
      {
        transactions: [
          tx("old", "2026-08-20", -20000),
          tx("previous-last", "2026-09-25", -8000),
          tx("cycle-first", "2026-09-26", -16000),
          tx("today", "2026-10-05", -20000),
          tx("future", "2026-10-06", -18000),
          tx("next-cycle", "2026-10-26", -90000),
          tx("other-account", "2026-09-26", -200000, { account: "B" }),
          tx("salary", "2026-09-26", 200000),
          tx("transfer", "2026-09-26", -50000, { internal: true }),
        ],
      },
      "2026-10-05",
    );
    expect(
      monthlyFlows(ledger, "A", 3).map((f) => [f.month, f.spending]),
    ).toEqual([
      ["2026-08", 20000],
      ["2026-09", 8000],
      ["2026-10", 36000],
    ]);
    const october = scope("A", "2026-09-26", "2026-10-25", "2026-10-05");
    expect(unusualExpenses(ledger, october).map((t) => t.id)).toEqual([
      "today",
      "cycle-first",
    ]);
    expect(
      unusualExpenses(
        ledger,
        scope("A", "2026-09-29", "2026-10-05", "2026-10-05"),
      ).map((t) => t.id),
    ).toEqual(["today"]);
    expect(spendingByCategory(ledger, october)).toEqual([
      {
        category: "Courses",
        amount: 36000,
        share: 1,
        usual: 14000,
        deltaPct: 157,
      },
    ]);
  });
});

describe("usual spending reference", () => {
  const w: World = {
    transactions: [
      tx("A-before", "2026-07-01", -20000),
      tx("B-before", "2026-07-01", -300000, { account: "B" }),
      tx("A-selected", "2026-08-03", -20000),
      tx("A-later", "2026-09-01", -900000),
      tx("A-future", "2026-10-20", -999999),
    ],
  };
  const ledger = ledgerOf(w, "2026-10-05");
  const august = (account: string) =>
    scope(account, "2026-08-01", "2026-08-31", "2026-10-05");

  it("uses the same account's earlier months, never other accounts, later or future months", () => {
    expect(unusualExpenses(ledger, august("A")).map((t) => t.id)).toEqual([
      "A-selected",
    ]);
    expect(spendingByCategory(ledger, august("A"))[0]).toMatchObject({
      usual: 20000,
      deltaPct: 0,
    });
    expect(unusualExpenses(ledger, august(""))).toEqual([]);
    expect(
      unusualExpenses(
        ledger,
        scope("A", "2026-11-01", "2026-11-30", "2026-10-05"),
      ),
    ).toEqual([]);
    const july = scope("A", "2026-07-01", "2026-07-31", "2026-10-05");
    expect(spendingByCategory(ledger, july)[0]).toMatchObject({
      usual: null,
      deltaPct: null,
    });
    expect(unusualExpenses(ledger, july)).toEqual([]);
  });

  it("keeps a past month's figures when today moves on", () => {
    const later = ledgerOf(w, "2026-11-05");
    expect(spendingByCategory(later, august("A"))).toEqual(
      spendingByCategory(ledger, august("A")),
    );
  });
});

describe("inbox and categories", () => {
  it("lists uncategorized operations, recurrences to confirm, stale balances and future imports", () => {
    const spotify = (date: string) =>
      tx(date, date, -1000, { merchant: "Spotify", category: "Abonnements" });
    const ledger = ledgerOf(
      {
        accounts: [anchored("A", "2026-09-20", 0)],
        transactions: [
          spotify("2026-07-15"),
          spotify("2026-08-15"),
          spotify("2026-09-15"),
          tx("u1", "2026-10-01", -100, { category: "À catégoriser" }),
          tx("u2", "2026-10-01", -100, { category: "" }),
          tx("other", "2026-10-01", -100, { category: "Autres" }),
          tx("later", "2026-10-09", -100),
        ],
      },
      "2026-10-03",
    );
    expect(inbox(ledger, "").map((i) => i.kind)).toEqual([
      "uncategorized",
      "recurrence",
      "balance",
      "future",
    ]);
    expect(inbox(ledger, "")[0]).toEqual({
      kind: "uncategorized",
      ids: ["u1", "u2"],
    });
    expect(inbox(ledger, "B")).toEqual([]);
  });

  it("treats only empty and « À catégoriser » as uncategorized, with stable colours", () => {
    expect(["", "a catégoriser", "À CATÉGORISER"].every(isUncategorized)).toBe(
      true,
    );
    expect(["Autre", "Autres"].some(isUncategorized)).toBe(false);
    expect(categoryColor("Courses", [])).toBe(categoryColor("Courses", []));
    expect(CATEGORY_COLORS).toContain(categoryColor("Courses", []));
    expect(
      categoryColor("Courses", [
        { id: "c", name: "Courses", color: "#123456" },
      ]),
    ).toBe("#123456");
  });

  it("suggests the merchant's usual categories first", () => {
    const ledger = ledgerOf(
      {
        transactions: [
          tx("c1", "2026-10-01", -100, {
            merchant: "Carrefour",
            category: "Courses",
          }),
          tx("r1", "2026-10-01", -100, {
            merchant: "Resto",
            category: "Restaurants",
          }),
          tx("r2", "2026-10-01", -100, {
            merchant: "Resto",
            category: "Restaurants",
          }),
        ],
      },
      "2026-10-03",
    );
    const fresh = tx("new", "2026-10-02", -100, {
      merchant: "CARREFOUR",
      category: "",
    });
    expect(suggestCategories(ledger, fresh)).toEqual([
      "Courses",
      "Restaurants",
    ]);
  });
});

describe("transaction search", () => {
  const ledger = ledgerOf(
    {
      transactions: [
        tx("m", "2026-10-01", -1200, {
          merchant: "McDonald's Paris",
          category: "Restaurants",
        }),
        tx("e", "2026-10-02", -4500, {
          merchant: "Électricité EDF",
          category: "Énergie",
          note: "acompte",
        }),
        tx("s", "2026-10-03", 250000, { merchant: "Salaire" }),
        tx("v", "2026-10-03", -50000, {
          merchant: "Virement épargne",
          internal: true,
        }),
        tx("f", "2026-10-09", -3000, { merchant: "Futur" }),
      ],
    },
    "2026-10-05",
  );
  const all: TransactionFilters = {
    account: "",
    range: { from: "2026-10-01", to: "2026-10-31" },
    kind: "all",
    categories: [],
    min: null,
    max: null,
    uncategorized: false,
    withNote: false,
    query: "",
    sort: "date-desc",
  };
  const ids = (f: Partial<TransactionFilters>) =>
    filterTransactions(ledger, { ...all, ...f }).map((t) => t.id);

  it("finds abbreviations and accents, and combines filters", () => {
    expect(ids({ query: "mcdo" })).toEqual(["m"]);
    expect(ids({ query: "electricite" })).toEqual(["e"]);
    expect(ids({ kind: "expense" })).toEqual(["f", "e", "m"]);
    expect(ids({ kind: "transfer" })).toEqual(["v"]);
    expect(ids({ withNote: true })).toEqual(["e"]);
    expect(ids({ min: 4000, max: 60000, sort: "amount-desc" })).toEqual([
      "v",
      "e",
    ]);
  });

  it("summarizes without transfers nor future operations", () => {
    expect(summarize(filterTransactions(ledger, all), "2026-10-05")).toEqual({
      count: 5,
      income: 250000,
      spending: 5700,
      net: 244300,
    });
  });
});
