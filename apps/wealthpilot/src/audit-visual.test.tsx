import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DataViz } from "./DataViz";
import { Dashboard } from "./Dashboard";
import { emptySnapshot } from "./types";
import { ImportPage } from "./ImportPage";

describe("Audit indépendant — lisibilité et identité visuelle", () => {
  it("expose l'historique import comme zone horizontale accessible avec explication mobile", () => {
    const s = structuredClone(emptySnapshot);
    s.batches = [
      {
        id: "b",
        name: "demo.csv",
        hash: "b",
        createdAt: "2026-10-03T12:00:00Z",
        count: 1,
        minDate: "2026-10-01",
        maxDate: "2026-10-01",
      },
    ];
    render(<ImportPage snapshot={s} notify={vi.fn()} onImported={vi.fn()} />);
    const region = screen.getByRole("region", {
      name: "Historique des lots importés",
    });
    expect(region.tabIndex).toBe(0);
    expect(
      document.getElementById(region.getAttribute("aria-describedby")!)
        ?.textContent,
    ).toMatch(/horizontalement.*actions/);
  });
  it.each(["Configurer le disponible", "Voir le calcul"])(
    "rend le focus au contrôle %s après fermeture de sa carte éditée",
    async (name) => {
      const s = structuredClone(emptySnapshot);
      s.preferences.widgets = ["available"];
      render(
        <Dashboard
          snapshot={s}
          month="2026-10"
          account=""
          importPage={vi.fn()}
          notify={vi.fn()}
        />,
      );
      const button = screen.getByRole("button", { name });
      button.focus();
      fireEvent.click(button);
      fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole("button", { name }),
        ),
      );
    },
  );
  it("montre les engagements dans le restant du budget, sans les faire passer pour payés", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-03T12:00:00Z"));
    try {
      const s = structuredClone(emptySnapshot);
      s.accounts = [
        { id: "Courant", checkpoint: { date: "2026-10-03", amount: 100000 } },
      ];
      s.preferences.widgets = ["budgets"];
      s.budgets = [
        { id: "budget", category: "Courses", month: "2026-10", amount: 10000 },
      ];
      s.dues = [
        {
          id: "due",
          label: "Livraison",
          category: "Courses",
          amount: -2000,
          date: "2026-10-10",
          account: "Courant",
        },
      ];
      s.transactions = [
        {
          id: "tx",
          batchId: "b",
          fingerprint: "tx",
          date: "2026-10-02",
          amount: -1000,
          label: "Courses",
          merchant: "Démo",
          account: "Courant",
          category: "Courses",
          internal: false,
          raw: {},
        },
      ];
      render(
        <Dashboard
          snapshot={s}
          month="2026-10"
          account=""
          importPage={vi.fn()}
          notify={vi.fn()}
        />,
      );
      expect(
        screen.getByText(/20.*engagés.*70.*restants après engagements/),
      ).toBeTruthy();
      expect(screen.getByText(/10.*dépensés.*100.*alloués/)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
  it("explique une recherche vide dans le catalogue au lieu de laisser un trou", () => {
    render(
      <Dashboard
        snapshot={structuredClone(emptySnapshot)}
        month="2026-10"
        account=""
        importPage={vi.fn()}
        notify={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Organiser mon dashboard" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une carte" }));
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Chercher une carte" }),
      { target: { value: "aucunwidgetcorrespondant" } },
    );
    expect(
      screen.getByText(/Aucune carte ne correspond/).getAttribute("role"),
    ).toBe("status");
  });
  it("conserve la couleur d’une catégorie après un changement de classement", () => {
    const items = [
      { name: "Courses", value: 50000 },
      { name: "Transport", value: 10000 },
    ];
    const view = render(
      <DataViz items={items} limit={5} widget="categories" />,
    );
    const color = () =>
      (
        screen.getByText("Courses").closest(".viz-item") as HTMLElement
      ).style.getPropertyValue("--item-color");
    const before = color();
    view.rerender(
      <DataViz items={[...items].reverse()} limit={5} widget="categories" />,
    );
    expect(color()).toBe(before);
  });

  it("utilise la même couleur pour une catégorie dans les quatre vues budget et en analyse", async () => {
    const s = structuredClone(emptySnapshot);
    s.accounts = [
      { id: "Courant", checkpoint: { date: "2026-10-03", amount: 100000 } },
    ];
    s.preferences.widgets = ["budgets", "categories"];
    // Compare saved category identity on the same surface. Different card
    // palettes adapt luminance to remain legible without changing the hue.
    s.preferences.tones = { budgets: "paper", categories: "paper" };
    s.budgets = ["Courses", "Transport"].map((category, i) => ({
      id: String(i),
      category,
      month: "2026-10",
      amount: 50000,
    }));
    s.transactions = ["Courses", "Transport"].map((category, i) => ({
      id: String(i),
      batchId: "b",
      fingerprint: String(i),
      date: "2026-10-02",
      amount: -(i + 1) * 1000,
      merchant: "Démo",
      label: category,
      account: "Courant",
      category,
      internal: false,
      raw: {},
    }));
    const view = render(
      <Dashboard
        snapshot={s}
        month="2026-10"
        account=""
        importPage={vi.fn()}
        notify={vi.fn()}
      />,
    );
    const budget = [...view.container.querySelectorAll(".budget-row")].find(
      (e) => e.textContent?.includes("Courses"),
    )!;
    const analytic = [...view.container.querySelectorAll(".viz-item")].find(
      (e) => e.textContent?.includes("Courses"),
    )! as HTMLElement;
    const resolved = document.createElement("span");
    resolved.style.background = analytic.style.getPropertyValue("--item-color");
    expect(
      (budget.querySelector(".category-dot") as HTMLElement).style.background,
    ).toBe(resolved.style.background);
    for (const [label, selector] of [
      [
        "Budgets en anneaux",
        ".budget-content svg circle[stroke]:not([stroke='var(--track)'])",
      ],
      ["Budgets en marges", ".column-viz svg rect"],
      ["Budgets en enveloppes", ".budget-envelope"],
    ]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      await waitFor(() =>
        expect(view.container.querySelector(selector)).toBeTruthy(),
      );
      const mark = view.container.querySelector(selector) as HTMLElement;
      const raw =
        mark.getAttribute(
          mark.tagName.toLowerCase() === "circle" ? "stroke" : "fill",
        ) ?? mark.style.getPropertyValue("--envelope-color");
      const normalized = document.createElement("span");
      normalized.style.background = raw;
      expect(normalized.style.background).toBe(resolved.style.background);
    }
  });

  it("transmet la catégorie choisie à la navigation vers les transactions", () => {
    const s = structuredClone(emptySnapshot);
    s.preferences.widgets = ["budgets"];
    s.budgets = [
      { id: "budget", category: "Courses", month: "2026-10", amount: 10000 },
    ];
    const navigate = vi.fn();
    render(
      <Dashboard
        snapshot={s}
        month="2026-10"
        account=""
        importPage={vi.fn()}
        notify={vi.fn()}
        transactionsPage={navigate}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Courses.*dépensés/ }));
    expect(navigate).toHaveBeenCalledWith("Courses", {
      category: "Courses",
      account: "",
      from: "2026-10",
      month: "2026-10",
      range: { from: "2026-10-01", to: "2026-10-05" },
    });
  });

  // Rendering dimensions / motion are verified in the real-browser matrices:
  // scripts/layout-usability-baseline.mjs and scripts/chart-explanation-qa.mjs.
});
