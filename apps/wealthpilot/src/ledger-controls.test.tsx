import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLiveQuery } from "dexie-react-hooks";
import { TransactionsPage } from "./TransactionsPage";
import { emptySnapshot, type Snapshot, type Transaction } from "./types";
import { db } from "./store";
import { parseCSV } from "./importer";
import * as downloads from "./download";

const rows = (count: number): Transaction[] =>
  Array.from({ length: count }, (_, i) => ({
    id: "row-" + i,
    batchId: "test",
    date: "2026-10-02",
    amount: -100 - i,
    merchant: "Commerce " + String(i).padStart(5, "0"),
    label: "COMMERCE TEST " + i,
    account: "Commun",
    category: i % 2 ? "Santé" : "Courses",
    internal: false,
    fingerprint: "row-" + i,
    raw: {},
    note: "Note initiale",
  }));
const fixture = (count: number): Snapshot => ({
  ...structuredClone(emptySnapshot),
  transactions: rows(count),
});
const props = { from: "2026-10", month: "2026-10", account: "" };
const top = () =>
  screen.getByRole("navigation", {
    name: "Pagination des transactions — haut",
  });
const bottom = () =>
  screen.getByRole("navigation", { name: "Pagination des transactions — bas" });
async function chooseSize(value: number, place: "haut" | "bas" = "haut") {
  fireEvent.keyDown(
    screen.getByRole("combobox", { name: "Lignes par page — " + place }),
    { key: "Enter" },
  );
  fireEvent.click(await screen.findByRole("option", { name: String(value) }));
}
async function go(page: number, place: "haut" | "bas" = "haut") {
  const user = userEvent.setup();
  const input = screen.getByRole("spinbutton", {
    name: "Numéro de page — " + place,
  });
  await user.clear(input);
  await user.type(input, String(page) + "{Enter}");
}
beforeEach(async () => {
  localStorage.clear();
  await db.transactions.clear();
});
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("T1 — journal contrôlable, dense et paginé", () => {
  it("consulte une cible future à part sans élargir l’historique, et ferme cet encart au changement de périmètre", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
    const snapshot = fixture(0);
    snapshot.transactions = [
      { ...rows(1)[0], id: "paid", merchant: "Dépense passée", amount: -1000 },
      {
        ...rows(1)[0],
        id: "future",
        merchant: "Achat prévu",
        date: "2026-10-20",
        amount: -99999,
      },
      {
        ...rows(1)[0],
        id: "other",
        merchant: "Autre compte futur",
        date: "2026-10-20",
        account: "Autre",
        amount: -9999,
      },
    ];
    const notify = vi.fn();
    const download = vi
      .spyOn(downloads, "download")
      .mockImplementation(() => {});
    const navigationFilter = {
      category: "",
      transactionId: "future",
      revision: 1,
    };
    const common = {
      ...props,
      account: "Commun",
      snapshot,
      notify,
      range: { from: "2026-10-01", to: "2026-10-05" },
    };
    const view = render(
      <TransactionsPage {...common} navigationFilter={navigationFilter} />,
    );
    await screen.findByRole("heading", {
      name: "Opération future consultée depuis les prévisions",
    });
    expect(screen.getByRole("textbox", { name: "Nom affiché" })).toHaveProperty(
      "value",
      "Achat prévu",
    );
    expect(view.container.querySelectorAll(".ledger-entry")).toHaveLength(1);
    expect(
      view.container.querySelector(".ledger-summary strong")?.textContent,
    ).toBe("10 €");
    fireEvent.click(
      screen.getByRole("button", { name: "Exporter le résultat filtré" }),
    );
    const exported = parseCSV(String(download.mock.calls.at(-1)![1]));
    expect(exported.rows).toHaveLength(1);
    expect(JSON.stringify(exported.rows)).not.toContain("Achat prévu");
    fireEvent.change(
      screen.getByRole("textbox", { name: "Note personnelle" }),
      { target: { value: "Brouillon futur" } },
    );
    view.rerender(
      <TransactionsPage
        {...common}
        account="Autre"
        navigationFilter={navigationFilter}
      />,
    );
    expect(
      screen.queryByRole("region", {
        name: "Opération consultée hors période",
      }),
    ).toBeNull();
    view.rerender(
      <TransactionsPage {...common} navigationFilter={navigationFilter} />,
    );
    expect(
      screen.queryByRole("textbox", { name: "Note personnelle" }),
    ).toBeNull();
    view.rerender(
      <TransactionsPage
        {...common}
        navigationFilter={{ ...navigationFilter, revision: 2 }}
      />,
    );
    expect(
      await screen.findByRole("textbox", { name: "Note personnelle" }),
    ).toHaveProperty("value", "Brouillon futur");
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "passée" },
    });
    expect(
      screen.queryByRole("region", {
        name: "Opération consultée hors période",
      }),
    ).toBeNull();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    expect(
      screen.queryByRole("textbox", { name: "Note personnelle" }),
    ).toBeNull();
    view.rerender(
      <TransactionsPage
        {...common}
        navigationFilter={{ category: "", transactionId: "other", revision: 3 }}
      />,
    );
    expect(
      screen.queryByRole("region", {
        name: "Opération consultée hors période",
      }),
    ).toBeNull();
  });

  it("applique les bornes journalières inclusives et efface la sélection quand la plage change", async () => {
    const snapshot = fixture(0);
    snapshot.transactions = [
      "2026-09-30",
      "2026-10-01",
      "2026-10-05",
      "2026-10-06",
    ].map((date, i) => ({
      ...rows(1)[0],
      id: "range-" + i,
      fingerprint: "range-" + i,
      date,
      merchant: "Jour " + date,
    }));
    const notify = vi.fn();
    const view = render(
      <TransactionsPage
        {...props}
        snapshot={snapshot}
        range={{ from: "2026-10-01", to: "2026-10-05" }}
        notify={notify}
      />,
    );
    expect(
      screen.getAllByRole("button", { name: /^Détails de / }),
    ).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: /Détails de Jour 2026-10-01/ }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Détails de Jour 2026-10-05/ }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Détails de Jour 2026-10-06/ }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Sélectionner cette page" }),
    );
    view.rerender(
      <TransactionsPage
        {...props}
        snapshot={snapshot}
        range={{ from: "2026-09-30", to: "2026-10-01" }}
        notify={notify}
      />,
    );
    expect(
      screen.getAllByRole("button", { name: /^Détails de / }),
    ).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: /Détails de Jour 2026-09-30/ }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Exporter les sélectionnées" }),
    ).toBeNull();
    expect(notify).toHaveBeenLastCalledWith(
      expect.stringContaining("sélection a été effacée"),
    );
  });

  it("atteint la page 38 de 6000 lignes, synchronise haut/bas et garde l’ancrage au changement de taille", async () => {
    const { container } = render(
      <TransactionsPage {...props} snapshot={fixture(6000)} notify={vi.fn()} />,
    );
    await go(38);
    expect(within(top()).getByText("926–950 sur 6000")).toBeTruthy();
    expect(within(bottom()).getByText("Page 38 sur 240")).toBeTruthy();
    expect(container.querySelectorAll(".ledger-entry")).toHaveLength(25);
    expect(
      within(top())
        .getByRole("button", { name: "Page 38" })
        .getAttribute("aria-current"),
    ).toBe("page");
    await waitFor(() => expect(document.activeElement).toBe(top()));
    await chooseSize(150, "bas");
    expect(within(top()).getByText("901–1050 sur 6000")).toBeTruthy();
    expect(within(bottom()).getByText("Page 7 sur 40")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Détails de Commerce 00925 / }),
    ).toBeTruthy();
    expect(container.querySelectorAll(".ledger-entry")).toHaveLength(150);
  });

  it("sépare densité et nombre de lignes et conserve ces préférences au remontage", async () => {
    const snapshot = fixture(180);
    const view = render(
      <TransactionsPage {...props} snapshot={snapshot} notify={vi.fn()} />,
    );
    for (const size of [25, 50, 75, 100, 150]) {
      if (size !== 25) await chooseSize(size);
      expect(view.container.querySelectorAll(".ledger-entry")).toHaveLength(
        size,
      );
    }
    const user = userEvent.setup();
    for (const [name, value] of [
      ["Compacte", "compact"],
      ["Standard", "standard"],
      ["Confortable", "comfortable"],
    ]) {
      await user.click(screen.getByRole("button", { name }));
      expect(
        screen.getByRole("main").classList.contains("ledger-density-" + value),
      ).toBe(true);
      expect(view.container.querySelectorAll(".ledger-entry")).toHaveLength(
        150,
      );
    }
    view.unmount();
    render(
      <TransactionsPage {...props} snapshot={snapshot} notify={vi.fn()} />,
    );
    expect(
      screen
        .getByRole("button", { name: "Confortable" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("combobox", { name: "Lignes par page — haut" })
        .textContent,
    ).toContain("150");
  });

  it("gère première/dernière, pages hors bornes, dernière page partielle et résultat vide", async () => {
    const view = render(
      <TransactionsPage {...props} snapshot={fixture(151)} notify={vi.fn()} />,
    );
    const user = userEvent.setup();
    await user.click(
      within(top()).getByRole("button", { name: "Dernière page" }),
    );
    expect(within(bottom()).getByText("151–151 sur 151")).toBeTruthy();
    expect(view.container.querySelectorAll(".ledger-entry")).toHaveLength(1);
    await go(38);
    expect(within(top()).getByRole("alert").textContent).toContain("1 à 7");
    expect(within(bottom()).getByText("Page 7 sur 7")).toBeTruthy();
    await user.click(
      within(bottom()).getByRole("button", { name: "Première page" }),
    );
    expect(within(top()).getByText("1–25 sur 151")).toBeTruthy();
    view.rerender(
      <TransactionsPage {...props} snapshot={fixture(0)} notify={vi.fn()} />,
    );
    expect(within(top()).getByText("0–0 sur 0")).toBeTruthy();
    expect(within(bottom()).getByText("Aucune page")).toBeTruthy();
    expect(
      within(top()).getByRole("button", { name: "Dernière page" }),
    ).toHaveProperty("disabled", true);
    expect(within(top()).getByRole("spinbutton")).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("conserve brouillon, sélection et page lors des éditions, changements de densité et pagination", async () => {
    await db.transactions.bulkPut(rows(120));
    function Ledger() {
      const transactions = useLiveQuery(
        () => db.transactions.toArray(),
        [],
        [],
      );
      return (
        <TransactionsPage
          {...props}
          snapshot={{ ...structuredClone(emptySnapshot), transactions }}
          notify={vi.fn()}
        />
      );
    }
    render(<Ledger />);
    await screen.findByRole("button", { name: /Détails de Commerce 00000 / });
    await waitFor(() =>
      expect(within(top()).getByText("Page 1 sur 5")).toBeTruthy(),
    );
    await go(3);
    await waitFor(() =>
      expect(within(top()).getByText("Page 3 sur 5")).toBeTruthy(),
    );
    const name = within(screen.getByRole("table", { name: "Transactions" }))
      .getAllByRole("button", { name: /^Détails de / })[0]
      .getAttribute("aria-label")!;
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name }));
    await user.clear(screen.getByRole("textbox", { name: "Note personnelle" }));
    await user.type(
      screen.getByRole("textbox", { name: "Note personnelle" }),
      "Brouillon page trois",
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Sélectionner cette page" }),
    );
    await user.click(screen.getByRole("button", { name: "Compacte" }));
    expect(
      screen.getByRole("textbox", { name: "Note personnelle" }),
    ).toHaveProperty("value", "Brouillon page trois");
    await go(4);
    expect(screen.getByText(/25 sélectionnées sur 120/)).toBeTruthy();
    await go(3);
    expect(
      screen.getByRole("textbox", { name: "Note personnelle" }),
    ).toHaveProperty("value", "Brouillon page trois");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () =>
      expect(
        (await db.transactions.toArray()).some(
          (t) => t.note === "Brouillon page trois",
        ),
      ).toBe(true),
    );
    expect(within(top()).getByText("Page 3 sur 5")).toBeTruthy();
  });

  it("distingue sélection multi-pages et export filtré et avertit avant d’effacer une sélection par filtre", async () => {
    const notify = vi.fn();
    const download = vi
      .spyOn(downloads, "download")
      .mockImplementation(() => {});
    render(
      <TransactionsPage {...props} snapshot={fixture(80)} notify={notify} />,
    );
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("checkbox", { name: "Sélectionner cette page" }),
    );
    expect(
      screen.getByText(/Changer un filtre effacera cette sélection/),
    ).toBeTruthy();
    await go(2);
    await user.click(
      screen.getByRole("checkbox", { name: "Sélectionner cette page" }),
    );
    expect(screen.getByText(/50 sélectionnées sur 80/)).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Exporter les sélectionnées" }),
    );
    expect(parseCSV(String(download.mock.calls.at(-1)![1])).rows).toHaveLength(
      50,
    );
    await user.click(
      screen.getByRole("button", { name: "Exporter le résultat filtré" }),
    );
    expect(parseCSV(String(download.mock.calls.at(-1)![1])).rows).toHaveLength(
      80,
    );
    await user.click(screen.getByRole("button", { name: "Filtres" }));
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Catégorie" }), {
      key: "Enter",
    });
    fireEvent.click(await screen.findByRole("option", { name: "Courses" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Exporter les sélectionnées" }),
      ).toBeNull(),
    );
    expect(notify).toHaveBeenLastCalledWith(
      expect.stringContaining("sélection a été effacée"),
    );
    expect(within(top()).getByText("1–25 sur 40")).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Exporter le résultat filtré" }),
    );
    expect(parseCSV(String(download.mock.calls.at(-1)![1])).rows).toHaveLength(
      40,
    );
  });
});
