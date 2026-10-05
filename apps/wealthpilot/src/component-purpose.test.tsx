import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { InsightWidget } from "./InsightWidget";
import { emptySnapshot, type Snapshot, type WidgetId } from "./types";
import { selectDashboard } from "./domain";
import { widgetContracts } from "./widgetContracts";
import { AccountHealth, GoalHorizon, SafetyThreshold } from "./NativeInsights";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
  const s: Snapshot = structuredClone(emptySnapshot);
  s.accounts = [
    { id: "A", checkpoint: { date: "2026-10-05", amount: 200000 } },
    { id: "B" },
  ];
  s.preferences.extraGoals = [
    {
      name: "Projet A",
      account: "A",
      target: 100000,
      saved: 20000,
      monthly: 10000,
      deadline: "2026-12-01",
    },
    {
      name: "Projet B",
      account: "B",
      target: 100000,
      saved: 80000,
      monthly: 50000,
    },
  ];
  return s;
}
function card(
  s: Snapshot,
  id: WidgetId,
  transactions = vi.fn(),
  month = "2026-10",
) {
  return (
    <InsightWidget
      id={id}
      snapshot={s}
      d={selectDashboard(s, month, "A", "2026-10-05")}
      month={month}
      from={month}
      account="A"
      size="large"
      configure={vi.fn()}
      transactions={transactions}
      goals={vi.fn()}
      plan={vi.fn()}
    />
  );
}
describe("Une question et un périmètre réels par composant", () => {
  it("calcule le rythme depuis le début du cycle et borne les charges à son horizon, même pour un cycle court", () => {
    const s = fixture();
    s.preferences.cycleStartDay = 3;
    s.transactions = ["2026-09-27", "2026-10-02"].map((date, i) => ({
      id: `paid-${i}`,
      batchId: "fixture",
      fingerprint: `paid-${i}`,
      account: "A",
      date,
      amount: -10000,
      merchant: "Commerce",
      label: "Commerce",
      category: "Courses",
      internal: false,
      raw: {},
    }));
    s.transactions.push({
      ...s.transactions[0],
      id: "salary",
      merchant: "Salaire",
      label: "Salaire",
      amount: 200000,
      date: "2026-09-26",
    });
    s.dues = [
      {
        id: "inside",
        account: "A",
        label: "Dans ce cycle",
        date: "2026-10-25",
        amount: -1000,
      },
      {
        id: "outside",
        account: "A",
        label: "Cycle suivant",
        date: "2026-10-26",
        amount: -9000,
      },
    ];
    const pace = render(card(s, "pace"));
    expect(screen.getByText("10 jours")).toBeTruthy();
    expect(
      pace.container.querySelector(".insight-value")?.textContent,
    ).toContain("20");
    pace.unmount();
    const charges = render(card(s, "charges"));
    expect(
      charges.container.querySelector(".insight-value")?.textContent,
    ).toContain("10");
    expect(
      screen.getByText(/Échéances restantes jusqu’au 25 oct/),
    ).toBeTruthy();
    expect(screen.getByText("Dans ce cycle")).toBeTruthy();
    expect(screen.queryByText("Cycle suivant")).toBeNull();
    charges.unmount();
    s.dues.push({
      id: "large-later-charge",
      account: "A",
      label: "Charge hors historique",
      date: "2026-10-20",
      amount: -900000,
    });
    const historic = selectDashboard(
      s,
      "2026-10",
      "A",
      "2026-10-05",
      "2026-10",
      { from: "2026-09-26", to: "2026-10-01" },
    );
    render(
      <InsightWidget
        id="funding"
        snapshot={s}
        d={historic}
        month="2026-10"
        from="2026-10"
        account="A"
        size="large"
        configure={vi.fn()}
        transactions={vi.fn()}
        goals={vi.fn()}
        plan={vi.fn()}
      />,
    );
    expect(screen.queryByText(/à prévoir avant/)).toBeNull();
  });

  it("retire les présentations de projets sans modifier les données ni leurs contrats historiques", () => {
    const s = fixture();
    const before = JSON.stringify(s);
    for (const id of ["goals", "savings", "goalDate", "effort"] as const) {
      const view = render(card(s, id));
      expect(view.container.innerHTML).toBe("");
      view.unmount();
    }
    expect(JSON.stringify(s)).toBe(before);
    expect(Object.keys(widgetContracts)).toHaveLength(30);
    expect(
      new Set(Object.values(widgetContracts).map((c) => c.question)).size,
    ).toBe(30);
    expect(widgetContracts.safety.scope).toBe("household");
    expect(widgetContracts.weekly.period).toBe("live");
    expect(widgetContracts.accounts.period).toBe("cutoff");
  });
  it("distingue santé, référence inconnue, financement et seuil au lieu de dessiner quatre soldes", () => {
    const s = fixture();
    const health = render(
      <AccountHealth
        snapshot={s}
        account=""
        cutoff="2026-10-05"
        size="large"
      />,
    );
    expect(screen.getByText("Solde inconnu")).toBeTruthy();
    expect(
      screen.getByText("Aucun solde de référence enregistré."),
    ).toBeTruthy();
    health.unmount();
    const horizon = render(
      <GoalHorizon
        goals={s.preferences.extraGoals!}
        size="large"
        edit={vi.fn()}
      />,
    );
    expect(horizon.container.textContent).toContain(
      "effort insuffisant à ce rythme",
    );
    horizon.unmount();
    render(
      <SafetyThreshold
        minimum={300000}
        balance={200000}
        size="large"
        low={{ date: "2026-10-20", value: 100000 }}
      />,
    );
    expect(screen.getByText("Manque pour retrouver le minimum")).toBeTruthy();
    expect(screen.getByText(/Le minimum serait franchi/)).toBeTruthy();
  });
  it("ne décrit pas un mois futur comme observé et ouvre la vraie file de classement", () => {
    const s = fixture(),
      transactions = vi.fn();
    const pace = render(card(s, "pace", transactions, "2026-11"));
    expect(screen.getByText("Pas encore observé")).toBeTruthy();
    pace.unmount();
    const review = render(card(s, "uncategorized", transactions));
    fireEvent.click(
      screen.getByRole("button", { name: "Ouvrir les transactions" }),
    );
    expect(transactions).toHaveBeenCalledWith({ review: "uncategorized" });
    review.unmount();
    render(card(s, "recurring"));
    expect(
      screen
        .getByRole("link", { name: "Vérifier les récurrences" })
        .getAttribute("href"),
    ).toBe("#recurrents");
  });
});
