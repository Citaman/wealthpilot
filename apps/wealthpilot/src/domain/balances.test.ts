import { describe, expect, it } from "vitest";
import {
  accountStatus,
  balanceAt,
  balanceSeries,
  checkpointForDate,
  coverageStatus,
  householdBalance,
} from "./balances";
import { anchored, ledgerOf, tx } from "./test-fixtures";
import type { Account } from "./types";

const range = (from: string, to: string) => ({ from, to });

describe("anchored balances", () => {
  it("reconstructs both directions from an anchor and stays unknown without one", () => {
    const rows = [
      tx("debit", "2026-10-02", -2000),
      tx("credit", "2026-10-03", 500),
    ];
    expect(balanceAt({ id: "A" }, rows, "2026-10-02")).toBeNull();
    const account = anchored("A", "2026-10-02", 10000);
    expect(
      ["2026-10-01", "2026-10-02", "2026-10-03"].map((d) =>
        balanceAt(account, rows, d),
      ),
    ).toEqual([12000, 10000, 10500]);
  });

  it("refuses an incomplete household but answers for the anchored account", () => {
    const ledger = ledgerOf(
      {
        accounts: [anchored("A", "2026-10-02", 10000), { id: "B" }],
        transactions: [tx("c", "2026-10-03", 500)],
      },
      "2026-10-03",
    );
    expect(householdBalance(ledger, "", "2026-10-03")).toBeNull();
    expect(householdBalance(ledger, "A", "2026-10-03")).toBe(10500);
  });

  it("merges anchors: observations beat derived ones, the legacy anchor wins date ties, rejected ones are ignored", () => {
    const account: Account = {
      id: "A",
      checkpoint: { date: "2026-10-01", amount: 300 },
      checkpoints: [
        { date: "2026-10-01", amount: 100 },
        { date: "2026-10-05", amount: 999, accepted: false },
        { date: "2026-10-08", amount: 700, status: "derived" },
      ],
    };
    expect(checkpointForDate(account, "2026-10-06")?.amount).toBe(300);
    expect(checkpointForDate(account, "2026-09-01")?.amount).toBe(300);
    expect(
      checkpointForDate(
        {
          id: "B",
          checkpoints: [{ date: "2026-10-08", amount: 7, status: "derived" }],
        },
        "2026-10-09",
      )?.amount,
    ).toBe(7);
  });

  it("calls a day covered only when complete statements join it to the anchor", () => {
    const account: Account = {
      ...anchored("A", "2026-10-10", 0),
      coverage: [
        {
          from: "2026-09-01",
          through: "2026-09-10",
          sourceHash: "1",
          batchId: "1",
          complete: true,
        },
        {
          from: "2026-09-20",
          through: "2026-10-10",
          sourceHash: "2",
          batchId: "2",
          complete: true,
        },
      ],
    };
    expect(coverageStatus(account, "2026-10-10")).toBe("observed");
    expect(coverageStatus(account, "2026-09-25")).toBe("covered");
    expect(coverageStatus(account, "2026-09-05")).toBe("incomplete");
    expect(coverageStatus({ id: "B" }, "2026-09-05")).toBe("unknown");
  });
});

describe("balance series", () => {
  const ledger = ledgerOf(
    {
      accounts: [
        anchored("A", "2026-10-05", 200000),
        anchored("Y", "2026-10-05", 100000),
      ],
      transactions: [
        tx("Loyer", "2026-10-01", -90000),
        tx("Courses", "2026-10-03", -10000),
        tx("Virement A", "2026-10-04", -1000, { internal: true }),
        tx("Virement Y", "2026-10-04", 1000, { account: "Y", internal: true }),
        tx("CAF", "2026-10-05", 20000, { account: "Y" }),
        tx("Futur", "2026-10-26", 250000),
      ],
    },
    "2026-10-05",
  );

  it("gives the same closing balance for a date whatever the window, and stops at asOf", () => {
    const scope = (from: string) => ({
      account: "",
      range: range(from, "2026-10-25"),
      asOf: ledger.asOf,
    });
    const short = balanceSeries(ledger, scope("2026-10-01")).points;
    const wide = balanceSeries(ledger, scope("2026-08-01")).points;
    expect(short.at(-1)).toMatchObject({
      date: "2026-10-05",
      value: 300000,
      observed: true,
    });
    expect(short.find((p) => p.date === "2026-10-03")?.value).toBe(280000);
    expect(wide.find((p) => p.date === "2026-10-03")?.value).toBe(280000);
    expect(short.find((p) => p.date === "2026-10-04")).toMatchObject({
      count: 2,
      net: 0,
    });
    expect(short[0].gap).toBe(true);
  });

  it("aggregates long windows to closing balances, never sums, keeping the first anchor", () => {
    const series = balanceSeries(ledger, {
      account: "A",
      range: range("2026-01-01", "2026-10-05"),
      asOf: ledger.asOf,
    });
    expect(series.granularity).toBe("week");
    expect(series.points[0].date).toBe("2026-01-01");
    expect(series.points.at(-1)).toMatchObject({
      date: "2026-10-05",
      value: 200000,
    });
    expect(series.perAccount[0].values).toHaveLength(series.points.length);
    const week = series.points.find((p) => p.date === "2026-10-04")!;
    expect(week).toMatchObject({ value: 200000, count: 3, net: -101000 });
  });
});

describe("account status", () => {
  it("reports today's balance, anchor age, freshness and the last import", () => {
    const ledger = ledgerOf(
      {
        accounts: [
          anchored("A", "2026-09-20", 1000),
          anchored("B", "2026-10-01", 0),
          { id: "C" },
        ],
        transactions: [tx("t", "2026-09-25", -100, { batchId: "b2" })],
        batches: [
          {
            id: "b2",
            name: "f",
            hash: "h",
            createdAt: "2026-10-03T10:00:00Z",
            count: 1,
            minDate: "2026-09-25",
            maxDate: "2026-09-25",
          },
        ],
        prefs: { accountAliases: { A: "Commun" } },
      },
      "2026-10-05",
    );
    const [a, b, c] = accountStatus(ledger);
    expect(a).toMatchObject({
      name: "Commun",
      balance: 900,
      ageDays: 15,
      freshness: "stale",
      lastImport: "2026-10-03T10:00:00Z",
    });
    expect(b).toMatchObject({ freshness: "ok", ageDays: 4, lastImport: null });
    expect(c).toMatchObject({
      balance: null,
      freshness: "unknown",
      checkpoint: null,
    });
  });
});
