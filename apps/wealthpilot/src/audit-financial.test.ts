import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { selectDashboard } from "./domain";
import { estimatedDues } from "./intelligence";
import {
  fingerprint,
  parseCSV,
  previewImport,
  detectMapping,
} from "./importer";
import { InsightWidget } from "./InsightWidget";
import { validateBackup } from "./store";
import {
  emptySnapshot,
  type Snapshot,
  type Transaction,
  type WidgetId,
} from "./types";

function state(): Snapshot {
  const s = structuredClone(emptySnapshot);
  s.accounts = [
    { id: "Commun", checkpoint: { date: "2026-10-03", amount: 100000 } },
    { id: "Personnel", checkpoint: { date: "2026-10-03", amount: 100000 } },
  ];
  return s;
}
function transaction(patch: Partial<Transaction> = {}): Transaction {
  const t: Transaction = {
    id: "t",
    batchId: "b",
    account: "Commun",
    date: "2026-10-02",
    amount: -1000,
    merchant: "Service test",
    label: "Service test",
    category: "À catégoriser",
    internal: false,
    fingerprint: "",
    raw: {},
    ...patch,
  };
  t.fingerprint = fingerprint(t);
  return t;
}
function backup(s: Snapshot) {
  return { format: "wealthpilot-next", version: 1, data: s };
}
function linkedState() {
  const s = state();
  s.transactions = [transaction()];
  s.batches = [
    {
      id: "b",
      hash: "h",
      name: "test",
      createdAt: "2026-10-03T00:00:00Z",
      count: 1,
      minDate: "2026-10-02",
      maxDate: "2026-10-02",
    },
  ];
  s.dues = [
    {
      id: "d",
      account: "Commun",
      label: "Service test",
      date: "2026-10-02",
      amount: -1000,
      transactionId: "t",
    },
  ];
  return s;
}
function widget(s: Snapshot, id: WidgetId, account = "") {
  return render(
    createElement(InsightWidget, {
      id,
      snapshot: s,
      d: selectDashboard(s, "2026-10", account, "2026-10-03"),
      month: "2026-10",
      from: "2026-10",
      account,
      size: "medium",
      configure() {},
      transactions() {},
      goals() {},
      plan() {},
    }),
  );
}

describe("Independent financial audit — full product contracts", () => {
  it("counts the importer's unclassified default in the review widget", () => {
    const f = parseCSV("date;amount;libelle\n2026-10-02;-10;Petit commerce");
    const candidate = previewImport(
      f,
      detectMapping(f.fields),
      "Commun",
      [],
    )[0];
    const s = state();
    s.transactions = [{ ...candidate.transaction!, id: "t", batchId: "b" }];
    const { container } = widget(s, "uncategorized");
    expect(container.querySelector(".insight-value")?.textContent).toBe("1");
  });

  it("does not report a household weekly allowance as a single-account allowance", () => {
    const s = state();
    s.preferences.weekly = 40000;
    s.transactions = [transaction({ amount: -30000, account: "Personnel" })];
    const { container } = widget(s, "weekly", "Commun");
    expect(container.querySelector(".insight-value")?.textContent).toBe(
      "À confirmer",
    );
    expect(screen.getByText(/Tous les comptes/)).toBeTruthy();
  });

  it("reserves are not expenses and do not change projected bank cash", () => {
    const s = state();
    const baseline = selectDashboard(s, "2026-10", "", "2026-10-03");
    s.preferences.safety = 20000;
    s.preferences.goal = { name: "Projet", saved: 30000, target: 100000 };
    const d = selectDashboard(s, "2026-10", "", "2026-10-03");
    expect(d.points).toEqual(baseline.points);
    expect(d.available).toBe(baseline.available! - 50000);
  });

  it("projects a manually provided essential spending provision, as it does budget provisions", () => {
    const s = state();
    s.preferences.essentials = 30000;
    const d = selectDashboard(s, "2026-10", "", "2026-10-03");
    expect(d.available).toBe(170000);
    expect(d.points.at(-1)?.value).toBe(170000);
    expect(d.points.find((p) => p.date === "2026-10-03")?.value).toBe(200000);
  });

  it("does not reserve an unpaid same-category bill twice through its budget", () => {
    const s = state();
    s.budgets = [
      { id: "budget", month: "2026-10", category: "Logement", amount: 90000 },
    ];
    s.dues = [
      {
        id: "d",
        account: "Commun",
        date: "2026-10-10",
        label: "Loyer",
        amount: -90000,
        category: "Logement",
      },
    ];
    const d = selectDashboard(s, "2026-10", "", "2026-10-03");
    expect(d.obligations).toBe(90000);
    expect(d.remainingEnvelopes).toBe(0);
    expect(d.available).toBe(110000);
  });

  it("rejects restoration of a due linked to a different account", () => {
    const s = linkedState();
    s.dues[0].account = "Personnel";
    expect(() => validateBackup(backup(s))).toThrow();
  });
  it("rejects restoration of an expense due linked to income", () => {
    const s = linkedState();
    s.dues[0].amount = 1000;
    expect(() => validateBackup(backup(s))).toThrow();
  });
  it("rejects restoration when one payment is used to pay two dues", () => {
    const s = linkedState();
    s.dues.push({ ...s.dues[0], id: "d2" });
    expect(() => validateBackup(backup(s))).toThrow();
  });
  it("accepts valid same-account same-sign reconciliation", () => {
    const s = linkedState();
    expect(validateBackup(backup(s))).toEqual(s);
    expect(selectDashboard(s, "2026-10", "", "2026-10-03").obligations).toBe(0);
  });
  it("rejects invalid budget calendar months", () => {
    const s = state();
    s.budgets = [
      { id: "b", category: "Courses", amount: 1000, month: "2026-13" },
    ];
    expect(() => validateBackup(backup(s))).toThrow();
  });

  it("a manual weekly bill covers only one estimated occurrence, not two", () => {
    const s = state();
    s.transactions = ["2026-09-14", "2026-09-21", "2026-09-28"].map((date, i) =>
      transaction({ id: String(i), date }),
    );
    s.dues = [
      {
        id: "d",
        account: "Commun",
        label: "Service test",
        date: "2026-10-08",
        amount: -1000,
      },
    ];
    // Expected weekly dates are Oct 5 and Oct 12. Oct 8 is within ±4 days of both.
    const due = estimatedDues(s, "2026-10-12", "2026-10-03");
    expect(due).toHaveLength(1);
    expect(due[0].date).toBe("2026-10-12");
  });

  it("matches a shifted weekly bill to the nearest occurrence, not simply the first one", () => {
    const s = state();
    s.transactions = ["2026-09-14", "2026-09-21", "2026-09-28"].map((date, i) =>
      transaction({ id: String(i), date }),
    );
    s.dues = [
      {
        id: "d",
        account: "Commun",
        label: "Service test",
        date: "2026-10-09",
        amount: -1000,
      },
    ];
    expect(
      estimatedDues(s, "2026-10-12", "2026-10-03").map((d) => d.date),
    ).toEqual(["2026-10-05"]);
  });

  it("does not deduct household spending provisions from every individual account forecast", () => {
    const s = state();
    s.preferences.essentials = 30000;
    s.preferences.weekly = 20000;
    const d = selectDashboard(s, "2026-10", "Commun", "2026-10-03");
    expect(d.points.at(-1)?.value).toBe(100000);
    expect(d.available).toBeNull();
    expect(d.weekly).toBeNull();
  });

  it("reports budget spending, committed and remaining independently", () => {
    const s = state();
    s.budgets = [
      { id: "b", category: "Courses", amount: 50000, month: "2026-10" },
    ];
    s.transactions = [transaction({ category: "Courses", amount: -10000 })];
    s.dues = [
      {
        id: "d",
        account: "Commun",
        date: "2026-10-10",
        label: "Courses",
        amount: -20000,
        category: "Courses",
      },
    ];
    expect(
      selectDashboard(s, "2026-10", "", "2026-10-03").budgets[0],
    ).toMatchObject({ spent: 10000, committed: 20000, remaining: 20000 });
  });

  it("labels the current comparison month partial and does not promise historical coverage", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-03T12:00:00Z"));
    try {
      widget(state(), "comparison");
      expect(
        screen.getByText(/Mois budgétaire en cours — partiel/),
      ).toBeTruthy();
      expect(
        screen.getAllByText(
          /Mois budgétaire passé — couverture des relevés à vérifier/,
        ),
      ).toHaveLength(2);
      expect(screen.getByText(/sans extrapolation/)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("account funding considers the order of expected income and charges", () => {
    const s = state();
    s.dues = [
      {
        id: "income",
        account: "Commun",
        label: "Salaire",
        amount: 50000,
        date: "2026-10-04",
      },
      {
        id: "rent",
        account: "Commun",
        label: "Loyer",
        amount: -120000,
        date: "2026-10-06",
      },
    ];
    const { container } = widget(s, "funding");
    expect(container.textContent).not.toContain("200 € à prévoir");
    expect(container.querySelector("dd")?.textContent).toMatch(/couvertes/);
  });

  it("account funding still warns when the income arrives after the charge", () => {
    const s = state();
    s.dues = [
      {
        id: "income",
        account: "Commun",
        label: "Salaire",
        amount: 50000,
        date: "2026-10-08",
      },
      {
        id: "rent",
        account: "Commun",
        label: "Loyer",
        amount: -120000,
        date: "2026-10-06",
      },
    ];
    const { container } = widget(s, "funding");
    expect(container.querySelector("dd")?.textContent).toContain(
      "200 € à prévoir",
    );
    expect(container.querySelector("dd")?.textContent).toContain("6 oct.");
  });
});
