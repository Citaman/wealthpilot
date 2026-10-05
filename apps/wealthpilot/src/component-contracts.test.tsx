import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { Dashboard } from "./Dashboard";
import { TransactionsPage } from "./TransactionsPage";
import { CalendarPage } from "./CalendarPage";
import { Planning, GoalsEditor } from "./Planning";
import { makeInstance } from "./layout";
import { emptySnapshot, type Transaction } from "./types";
import { db } from "./store";
const tx = (
  id: string,
  date = "2026-10-02",
  category = "Courses",
): Transaction => ({
  id,
  date,
  account: "A",
  amount: -1000,
  label: id,
  merchant: id,
  category,
  batchId: "b",
  fingerprint: id,
  internal: false,
  raw: {},
});
function fixture() {
  const s = structuredClone(emptySnapshot);
  s.accounts = [
    { id: "A", checkpoint: { date: "2026-10-05", amount: 100000 } },
    { id: "B", checkpoint: { date: "2026-10-05", amount: 200000 } },
  ];
  s.transactions = [
    tx("Août", "2026-08-04"),
    tx("Octobre"),
    { ...tx("Autre compte"), account: "B" },
  ];
  s.dues = [
    {
      id: "dueA",
      label: "Assurance A",
      date: "2026-10-12",
      amount: -1000,
      account: "A",
    },
  ];
  return s;
}
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
  await Promise.all(db.tables.map((t) => t.clear()));
});
afterEach(() => vi.useRealTimers());
describe("Contrats contextuels — vraies actions des composants", () => {
  it("le calendrier distingue une opération importée future d’un paiement réalisé", () => {
    const s = fixture();
    s.transactions.push(tx("Future", "2026-10-20"));
    render(
      <CalendarPage
        snapshot={s}
        month="2026-10"
        account="A"
        notify={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "20 oct. 2026, 1 opérations importées à venir, 0 échéances",
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Opérations importées à venir" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Opérations réalisées" }),
    ).toBeNull();
  });
  it("le projet du compte ouvre le bon éditeur sans exposer le projet vedette d’un autre compte", () => {
    const s = fixture();
    s.preferences.goal = {
      name: "Vedette B",
      target: 200000,
      saved: 10000,
      account: "B",
    };
    s.preferences.extraGoals = [
      { name: "Projet A", target: 100000, saved: 5000, account: "A" },
    ];
    render(
      <GoalsEditor
        snapshot={s}
        account="A"
        notify={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(
      (
        screen.getByRole("textbox", {
          name: "Nom du projet 2",
        }) as HTMLInputElement
      ).value,
    ).toBe("Projet A");
    expect(
      screen.queryByRole("button", { name: /Vedette B.*réservés/ }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un projet" }));
    expect(
      screen.getByRole("combobox", { name: "Compte — projet 3" }).textContent,
    ).toBe("A");
  });
  it("une ligne transmet transaction, compte et trois mois locaux, pas le contexte global", () => {
    const navigate = vi.fn(),
      s = fixture();
    render(
      <Dashboard
        snapshot={s}
        month="2026-10"
        from="2026-10"
        account="B"
        notify={vi.fn()}
        importPage={vi.fn()}
        transactionsPage={navigate}
        card={{
          ...makeInstance("transactions"),
          size: "medium",
          source: { kind: "account", account: "A" },
          period: { kind: "months", months: 3 },
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Août/ }));
    expect(navigate).toHaveBeenCalledWith("", {
      transactionId: "Août",
      account: "A",
      from: "2026-08",
      month: "2026-10",
      range: { from: "2026-08-01", to: "2026-10-05" },
    });
  });
  it("un budget transmet sa catégorie et la portée locale", () => {
    const navigate = vi.fn(),
      s = fixture();
    s.budgets = [
      {
        id: "b",
        account: "A",
        month: "2026-10",
        category: "Courses",
        amount: 5000,
      },
    ];
    render(
      <Dashboard
        snapshot={s}
        month="2026-10"
        from="2026-10"
        account="B"
        notify={vi.fn()}
        importPage={vi.fn()}
        transactionsPage={navigate}
        card={{
          ...makeInstance("budgets"),
          size: "medium",
          source: { kind: "account", account: "A" },
          period: { kind: "months", months: 3 },
        }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /^Courses.*restants après engagements/,
      }),
    );
    expect(navigate).toHaveBeenCalledWith("Courses", {
      category: "Courses",
      account: "A",
      from: "2026-08",
      month: "2026-10",
      range: { from: "2026-08-01", to: "2026-10-05" },
    });
  });
  it("une échéance ouvre l’objet choisi, pas un formulaire d’ajout", () => {
    const navigate = vi.fn(),
      s = fixture();
    render(
      <Dashboard
        snapshot={s}
        month="2026-10"
        account=""
        notify={vi.fn()}
        importPage={vi.fn()}
        duePage={navigate}
        card={{
          ...makeInstance("dues"),
          source: { kind: "account", account: "A" },
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Assurance A/ }));
    expect(navigate).toHaveBeenCalledWith(
      { account: "A", month: "2026-10" },
      expect.objectContaining({ id: "dueA" }),
    );
  });
  it("une opération importée future apparaît parmi les engagements et ouvre sa transaction, jamais un faux éditeur d’échéance", () => {
    const transactions = vi.fn(),
      calendar = vi.fn(),
      s = fixture();
    s.transactions.push(tx("future-import", "2026-10-20"));
    render(
      <Dashboard
        snapshot={s}
        month="2026-10"
        account="B"
        notify={vi.fn()}
        importPage={vi.fn()}
        transactionsPage={transactions}
        duePage={calendar}
        card={{
          ...makeInstance("dues"),
          source: { kind: "account", account: "A" },
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /future-import/ }));
    expect(transactions).toHaveBeenCalledWith("", {
      transactionId: "future-import",
      account: "A",
      from: "2026-10",
      month: "2026-10",
      range: { from: "2026-10-01", to: "2026-10-05" },
    });
    expect(calendar).not.toHaveBeenCalled();
  });
  it("une transaction ciblée sur page2 ouvre son détail et conserve la liste contextuelle", async () => {
    const s = fixture();
    s.transactions = Array.from({ length: 40 }, (_, n) =>
      tx(
        `Ligne ${n}`,
        `2026-10-${String(28 - Math.floor(n / 2)).padStart(2, "0")}`,
      ),
    );
    render(
      <TransactionsPage
        snapshot={s}
        from="2026-10"
        month="2026-10"
        account="A"
        notify={vi.fn()}
        navigationFilter={{
          category: "",
          transactionId: "Ligne 39",
          revision: 1,
        }}
      />,
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: /Détails de Ligne 39/ })
          .getAttribute("aria-expanded"),
      ).toBe("true"),
    );
    expect(screen.getAllByText(/Page 2 sur 2/).length).toBe(2);
  });
  it("la file À catégoriser exclut les lignes classées ; la file atypique conserve ses IDs", async () => {
    const s = fixture();
    s.transactions.push(tx("À traiter", "2026-10-03", "À catégoriser"));
    const view = render(
      <TransactionsPage
        snapshot={s}
        from="2026-08"
        month="2026-10"
        account="A"
        notify={vi.fn()}
        navigationFilter={{
          category: "",
          review: "uncategorized",
          revision: 1,
        }}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Détails de À traiter/ }),
      ).toBeTruthy(),
    );
    expect(
      screen.queryByRole("button", { name: /Détails de Octobre/ }),
    ).toBeNull();
    view.rerender(
      <TransactionsPage
        snapshot={s}
        from="2026-08"
        month="2026-10"
        account="A"
        notify={vi.fn()}
        navigationFilter={{
          category: "",
          transactionIds: ["Octobre"],
          revision: 2,
        }}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Détails de Octobre/ }),
      ).toBeTruthy(),
    );
    expect(
      screen.queryByRole("button", { name: /Détails de À traiter/ }),
    ).toBeNull();
  });
  it("le calendrier préremplit la bonne échéance et refuse une sauvegarde concurrente après refresh", async () => {
    const s = fixture();
    await db.accounts.bulkPut(s.accounts);
    await db.dues.bulkPut(s.dues);
    const notify = vi.fn();
    const props = {
      account: "A",
      month: "2026-10",
      notify,
      navigationTarget: { id: "dueA", date: "2026-10-12", revision: 1 },
    };
    const view = render(<CalendarPage {...props} snapshot={s} />);
    expect(
      (screen.getByLabelText("Libellé de l’échéance") as HTMLInputElement)
        .value,
    ).toBe("Assurance A");
    fireEvent.change(screen.getByLabelText("Libellé de l’échéance"), {
      target: { value: "Mon brouillon" },
    });
    const newer = structuredClone(s);
    newer.dues[0].label = "Autre onglet";
    await db.dues.put(newer.dues[0]);
    view.rerender(<CalendarPage {...props} snapshot={newer} />);
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    await waitFor(() =>
      expect(
        screen.getByText("Cette échéance a changé ailleurs. Rouvrez-la."),
      ).toBeTruthy(),
    );
    expect((await db.dues.get("dueA"))?.label).toBe("Autre onglet");
  });
  it("deux ajustements concurrents de la même occurrence estimée ne créent pas deux charges", async () => {
    const s = fixture();
    s.dues[0] = { ...s.dues[0], estimated: true };
    await db.accounts.bulkPut(s.accounts);
    await db.preferences.put(s.preferences);
    render(
      <CalendarPage
        snapshot={s}
        account="A"
        month="2026-10"
        notify={vi.fn()}
        navigationTarget={{ id: "dueA", date: "2026-10-12", revision: 1 }}
      />,
    );
    await db.dues.put({
      id: "other-tab-adjustment",
      originOccurrenceId: "dueA",
      label: "Déjà ajustée ailleurs",
      date: "2026-10-12",
      account: "A",
      amount: -1234,
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer l’échéance" }),
    );
    await waitFor(() =>
      expect(
        !screen.queryByLabelText("Libellé de l’échéance") ||
          !!screen.queryByText(
            "Cette occurrence a déjà été ajustée ailleurs. Rouvrez le calendrier.",
          ),
      ).toBe(true),
    );
    expect(await db.dues.count()).toBe(1);
    expect(
      screen.getByText(
        "Cette occurrence a déjà été ajustée ailleurs. Rouvrez le calendrier.",
      ),
    ).toBeTruthy();
  });
  it("ignorer une récurrence ne remplace pas un dock ou une réserve sauvegardés ailleurs", async () => {
    const s = fixture();
    s.transactions = [
      tx("r1", "2026-07-04"),
      tx("r2", "2026-08-04"),
      tx("r3", "2026-09-04"),
    ].map((t) => ({ ...t, merchant: "Assurance", label: "Assurance" }));
    await db.preferences.put({
      ...s.preferences,
      safety: 98765,
      dockPages: ["week", "dashboard"],
    });
    render(<Planning snapshot={s} month="2026-10" notify={vi.fn()} />);
    fireEvent.click(screen.getByText(/Récurrences détectées :/));
    fireEvent.click(screen.getByRole("button", { name: "Ignorer" }));
    await waitFor(async () =>
      expect(
        (await db.preferences.get("main"))?.dismissedRecurrences?.length,
      ).toBe(1),
    );
    expect(await db.preferences.get("main")).toMatchObject({
      safety: 98765,
      dockPages: ["week", "dashboard"],
    });
  });
});
