import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { EditorDialog } from "./Editors";
import { ImportPage } from "./ImportPage";
import { TransactionsPage } from "./TransactionsPage";
import { GoalsEditor } from "./Planning";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./store";
import { emptySnapshot, type Snapshot, type Transaction } from "./types";
import { dateLabel } from "./domain";
import * as downloads from "./download";

const transaction: Transaction = {
  id: "audit-t",
  batchId: "audit-b",
  date: "2026-10-02",
  amount: -1590,
  merchant: "Épicerie Test",
  label: "CB EPICERIE TEST",
  account: "Commun",
  category: "Courses",
  internal: false,
  note: "Note initiale",
  fingerprint: "audit-t",
  raw: {},
};
const batch = {
  id: "audit-b",
  hash: "audit-hash",
  name: "audit.csv",
  count: 1,
  minDate: "2026-10-02",
  maxDate: "2026-10-02",
  createdAt: "2026-10-03T10:00:00.000Z",
};
async function seed() {
  await db.transactions.put(transaction);
  await db.batches.put(batch);
  await db.accounts.put({
    id: "Commun",
    checkpoint: { date: "2026-10-03", amount: 300000 },
  });
  await db.preferences.put({
    ...structuredClone(emptySnapshot.preferences),
    setupDone: true,
    widgets: ["chart", "available"],
  });
  return db.snapshot();
}
beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  localStorage.clear();
  localStorage.setItem("wealthpilot-next-month", "2026-10");
  localStorage.setItem("wealthpilot-period", "all");
  location.hash = "#dashboard";
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("Audit indépendant : parcours complets et commandes concurrentes", () => {
  it("présente un sélecteur JSON français avec le nom du fichier choisi", async () => {
    const snapshot = await seed();
    render(
      <EditorDialog
        inline
        kind="data"
        snapshot={snapshot}
        month="2026-10"
        category=""
        onClose={vi.fn()}
        notify={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("Sauvegarde JSON") as HTMLInputElement;
    expect(input.classList.contains("sr-only")).toBe(true);
    expect(input.tabIndex).toBe(-1);
    const picker = vi.spyOn(input, "click").mockImplementation(() => {});
    await userEvent
      .setup()
      .click(
        screen.getByRole("button", { name: "Choisir une sauvegarde JSON" }),
      );
    expect(picker).toHaveBeenCalledOnce();
    picker.mockRestore();
    const file = new File(["backup"], "famille-octobre.json", {
      type: "application/json",
    });
    Object.defineProperty(file, "text", {
      value: async () =>
        JSON.stringify({
          format: "wealthpilot-next",
          version: 1,
          data: structuredClone(emptySnapshot),
        }),
    });
    fireEvent.change(input, { target: { files: [file] } });
    expect(
      await screen.findByText("Fichier sélectionné : famille-octobre.json"),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Choisir une autre sauvegarde JSON" }),
    ).toBeTruthy();
    await screen.findByRole("button", { name: "Confirmer le remplacement" });
  });

  it("place le focus sur le titre d’un éditeur intégré pour annoncer son ouverture", async () => {
    const snapshot = await seed();
    render(
      <EditorDialog
        inline
        kind="plan"
        snapshot={snapshot}
        month="2026-10"
        category=""
        onClose={vi.fn()}
        notify={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: "Votre disponible" }),
      ),
    );
    await userEvent.setup().tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Fermer" }),
    );
  });

  it("ouvre une enveloppe dans le journal filtré sans élargir la période du dashboard", async () => {
    await seed();
    localStorage.setItem("wealthpilot-period", "1");
    await db.preferences.update("main", { widgets: ["budgets"] });
    await db.budgets.put({
      id: "courses-oct",
      month: "2026-10",
      category: "Courses",
      amount: 40000,
    });
    await db.transactions.put({
      ...transaction,
      id: "audit-sante",
      merchant: "Pharmacie Test",
      category: "Santé",
      fingerprint: "audit-sante",
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: /^Courses/ }));
    await screen.findByRole("searchbox");
    expect(
      screen.getByRole("combobox", { name: "Catégorie" }).textContent,
    ).toContain("Courses");
    expect(
      screen.getByRole("combobox", { name: "Période affichée" }).textContent,
    ).toContain("Un mois");
    expect(
      screen.queryByRole("button", { name: /Détails de Pharmacie Test/ }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: /Détails de Épicerie Test/ }),
    ).toBeTruthy();
  });

  it("exige une sauvegarde courante et sa confirmation avant une restauration destructive", async () => {
    const snapshot = await seed();
    const download = vi
      .spyOn(downloads, "download")
      .mockImplementation(() => {});
    render(
      <EditorDialog
        inline
        kind="data"
        snapshot={snapshot}
        month="2026-10"
        category=""
        onClose={vi.fn()}
        notify={vi.fn()}
      />,
    );
    const file = new File(["backup"], "restauration.json", {
      type: "application/json",
    });
    Object.defineProperty(file, "text", {
      value: async () =>
        JSON.stringify({
          format: "wealthpilot-next",
          version: 1,
          data: structuredClone(emptySnapshot),
        }),
    });
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText("Sauvegarde JSON"), file);
    const confirm = await screen.findByRole("button", {
      name: "Confirmer le remplacement",
    });
    expect(confirm).toHaveProperty("disabled", true);
    await db.transactions.update(transaction.id, {
      note: "Dernière correction à sauvegarder",
    });
    await user.click(
      screen.getByRole("button", {
        name: "Télécharger la sauvegarde actuelle",
      }),
    );
    await waitFor(() => expect(download).toHaveBeenCalledOnce());
    expect(String(download.mock.calls[0][1])).toContain(
      "Dernière correction à sauvegarder",
    );
    expect(confirm).toHaveProperty("disabled", true);
    await user.click(
      screen.getByRole("checkbox", { name: /J’ai conservé la sauvegarde/ }),
    );
    expect(confirm).toHaveProperty("disabled", false);
    await user.click(confirm);
    await waitFor(async () => expect(await db.transactions.count()).toBe(0));
  });

  it("refuse atomiquement d’annuler un champ changé entre-temps par un autre onglet", async () => {
    await seed();
    const notify = vi.fn();
    function Ledger() {
      const snapshot = useLiveQuery(() => db.snapshot());
      return snapshot ? (
        <TransactionsPage
          snapshot={snapshot}
          from="2026-10"
          month="2026-10"
          account=""
          notify={notify}
        />
      ) : null;
    }
    const user = userEvent.setup();
    render(<Ledger />);
    await user.click(
      await screen.findByRole("button", { name: /^Détails de Épicerie Test/ }),
    );
    await user.clear(screen.getByRole("textbox", { name: "Note personnelle" }));
    await user.type(
      screen.getByRole("textbox", { name: "Note personnelle" }),
      "Note locale",
    );
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () =>
      expect((await db.transactions.get(transaction.id))?.note).toBe(
        "Note locale",
      ),
    );
    await db.transactions.update(transaction.id, {
      note: "Réouverte ailleurs",
    });
    await user.click(
      screen.getByRole("button", { name: "Annuler la modification" }),
    );
    await waitFor(() =>
      expect(notify).toHaveBeenLastCalledWith(
        expect.stringContaining("modifiée depuis"),
      ),
    );
    expect(await db.transactions.get(transaction.id)).toMatchObject({
      note: "Réouverte ailleurs",
    });
  });

  it("ajoute une échéance sur le compte par défaut sans créer de compte vide", async () => {
    const snapshot = await seed();
    render(
      <EditorDialog
        inline
        kind="dues"
        snapshot={snapshot}
        month="2026-10"
        category=""
        onClose={vi.fn()}
        notify={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "Libellé" }),
      "Loyer test",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Montant signé (€)" }),
      "-950",
    );
    await user.click(
      screen.getByRole("button", { name: "Ajouter l’échéance" }),
    );
    await waitFor(async () => expect(await db.dues.count()).toBe(1));
    expect((await db.dues.toArray())[0].account).toBe("Commun");
  });

  it("permet de saisir un montant d’objectif décimal au clavier sans perdre le séparateur", async () => {
    const snapshot = await seed();
    snapshot.preferences.goal = {
      name: "Projet test",
      target: 200000,
      saved: 5000,
    };
    await db.preferences.put(snapshot.preferences);
    render(
      <GoalsEditor snapshot={snapshot} onClose={vi.fn()} notify={vi.fn()} />,
    );
    const user = userEvent.setup();
    const input = screen.getByRole("spinbutton", {
      name: "Déjà réservé (€) — projet 1",
    });
    await user.clear(input);
    await user.type(input, "125.50");
    expect(input).toHaveProperty("value", "125.5");
    await user.click(
      screen.getByRole("button", { name: "Enregistrer les objectifs" }),
    );
    await waitFor(async () =>
      expect((await db.preferences.get("main"))?.goal?.saved).toBe(12550),
    );
  });
  it("conserve recherche et brouillon du journal après un aller-retour au dashboard", async () => {
    await seed();
    const user = userEvent.setup();
    render(<App />);
    const nav = await screen.findByRole("navigation", {
      name: "Navigation principale",
    });
    await user.click(within(nav).getByRole("button", { name: "Transactions" }));
    await user.type(screen.getByRole("searchbox"), "épicerie");
    await user.click(
      screen.getByRole("button", {
        name: `Détails de Épicerie Test du ${dateLabel(transaction.date)}`,
      }),
    );
    await user.clear(screen.getByRole("textbox", { name: "Note personnelle" }));
    await user.type(
      screen.getByRole("textbox", { name: "Note personnelle" }),
      "Brouillon non enregistré",
    );
    await user.click(within(nav).getByRole("button", { name: "Dashboard" }));
    await user.click(within(nav).getByRole("button", { name: "Transactions" }));
    expect(screen.getByRole("searchbox")).toHaveProperty("value", "épicerie");
    expect(
      screen.getByRole("textbox", { name: "Note personnelle" }),
    ).toHaveProperty("value", "Brouillon non enregistré");
    expect((await db.transactions.get(transaction.id))?.note).toBe(
      "Note initiale",
    );
  });

  it("sauver le disponible n’écrase pas une préférence modifiée dans un autre onglet", async () => {
    const snapshot = await seed();
    render(
      <EditorDialog
        inline
        kind="plan"
        snapshot={snapshot}
        month="2026-10"
        category=""
        onClose={vi.fn()}
        notify={vi.fn()}
      />,
    );
    await db.preferences.update("main", {
      budgetLimit: 6,
      widgetViews: { goals: "rings" },
    });
    const user = userEvent.setup();
    await user.clear(
      screen.getByRole("textbox", { name: "Réserve de sécurité (€)" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Réserve de sécurité (€)" }),
      "800",
    );
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () =>
      expect((await db.preferences.get("main"))?.safety).toBe(80000),
    );
    expect((await db.preferences.get("main"))?.budgetLimit).toBe(6);
    expect((await db.preferences.get("main"))?.widgetViews?.goals).toBe(
      "rings",
    );
  });

  it("la dernière sauvegarde choisie gagne, même si le précédent fichier finit de lire après", async () => {
    const snapshot = await seed();
    render(
      <EditorDialog
        inline
        kind="data"
        snapshot={snapshot}
        month="2026-10"
        category=""
        onClose={vi.fn()}
        notify={vi.fn()}
      />,
    );
    let finishFirst!: (value: string) => void;
    const first = new File(["a"], "ancienne.json", {
      type: "application/json",
    });
    const second = new File(["b"], "nouvelle.json", {
      type: "application/json",
    });
    const serialize = (data: Snapshot) =>
      JSON.stringify({ format: "wealthpilot-next", version: 1, data });
    Object.defineProperty(first, "text", {
      value: () =>
        new Promise<string>((resolve) => {
          finishFirst = resolve;
        }),
    });
    Object.defineProperty(second, "text", {
      value: async () =>
        serialize({
          ...structuredClone(emptySnapshot),
          accounts: [{ id: "A" }, { id: "B" }],
        }),
    });
    const input = screen.getByLabelText("Sauvegarde JSON");
    fireEvent.change(input, { target: { files: [first] } });
    fireEvent.change(input, { target: { files: [second] } });
    await screen.findByText(/Fichier validé : 0 opérations, 2 comptes/);
    await act(async () =>
      finishFirst(
        serialize({
          ...structuredClone(emptySnapshot),
          accounts: [{ id: "Ancien" }],
        }),
      ),
    );
    expect(
      screen.getByText(/Fichier validé : 0 opérations, 2 comptes/),
    ).toBeTruthy();
  });

  it("une annulation d’import échouée expose son erreur dans la confirmation active", async () => {
    const snapshot = await seed();
    vi.spyOn(db, "undoBatch").mockRejectedValueOnce(
      new Error("Stockage indisponible, réessayez."),
    );
    const user = userEvent.setup();
    render(
      <ImportPage snapshot={snapshot} onImported={vi.fn()} notify={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: "Annuler ce lot" }));
    await user.click(
      screen.getByRole("button", { name: "Confirmer l’annulation" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Stockage indisponible",
      ),
    );
    expect(await db.transactions.count()).toBe(1);
  });

  it("annuler un nom corrigé ne détruit pas une note ajoutée ultérieurement ailleurs", async () => {
    await seed();
    function Ledger() {
      const snapshot = useLiveQuery(() => db.snapshot());
      return snapshot ? (
        <TransactionsPage
          snapshot={snapshot}
          from="2026-10"
          month="2026-10"
          account=""
          notify={vi.fn()}
        />
      ) : null;
    }
    const user = userEvent.setup();
    render(<Ledger />);
    await user.click(
      await screen.findByRole("button", { name: /^Détails de Épicerie Test/ }),
    );
    await user.clear(screen.getByRole("textbox", { name: "Nom affiché" }));
    await user.type(
      screen.getByRole("textbox", { name: "Nom affiché" }),
      "Épicerie du quartier",
    );
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () =>
      expect((await db.transactions.get(transaction.id))?.merchantName).toBe(
        "Épicerie du quartier",
      ),
    );
    await db.transactions.update(transaction.id, {
      note: "Ajout ultérieur depuis autre onglet",
    });
    await user.click(
      screen.getByRole("button", { name: "Annuler la modification" }),
    );
    await waitFor(async () =>
      expect(
        (await db.transactions.get(transaction.id))?.merchantName,
      ).toBeUndefined(),
    );
    expect((await db.transactions.get(transaction.id))?.note).toBe(
      "Ajout ultérieur depuis autre onglet",
    );
  });

  it("un JSON invalide n’expose pas une restauration et laisse le ledger intact", async () => {
    const snapshot = await seed();
    render(
      <EditorDialog
        inline
        kind="data"
        snapshot={snapshot}
        month="2026-10"
        category=""
        onClose={vi.fn()}
        notify={vi.fn()}
      />,
    );
    const file = new File(["bad"], "bad.json");
    Object.defineProperty(file, "text", { value: async () => "{ broken" });
    await userEvent
      .setup()
      .upload(screen.getByLabelText("Sauvegarde JSON"), file);
    await screen.findByRole("alert");
    expect(
      screen.queryByRole("button", { name: "Confirmer le remplacement" }),
    ).toBeNull();
    expect(await db.transactions.get(transaction.id)).toEqual(transaction);
  });
});
