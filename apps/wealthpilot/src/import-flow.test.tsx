import { webcrypto } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportPage } from "./ImportPage";
import { db } from "./store";
import {
  automaticMappingIssues,
  detectMapping,
  fileForImportAccount,
  parseCSV,
  previewImport,
} from "./importer";
import { defaultPreferences } from "./types";

class CSVWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminated = false;
  terminate() {
    this.terminated = true;
  }
  postMessage(text: string) {
    queueMicrotask(() => {
      if (!this.terminated)
        this.onmessage?.({ data: { ok: true, file: parseCSV(text) } });
    });
  }
}
beforeEach(async () => {
  vi.stubGlobal("Worker", CSVWorker);
  vi.stubGlobal("crypto", webcrypto);
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.preferences.put(defaultPreferences);
});
afterEach(() => vi.unstubAllGlobals());
const simple =
  "date;amount;libelle\n2026-10-02;-10;Épicerie\n2026-10-03;100;Salaire";
const sg =
  "00012345678;01/10/2026;04/10/2026;1;02/10/2026;1000.00 EUR\n\nDate de l'opération;Libellé;Détail de l'écriture;Montant de l'opération;Devise\n02/10/2026;CARTE;CARTE REF A;-10,00;EUR";
async function start(text = simple) {
  const user = userEvent.setup();
  const onImported = vi.fn();
  render(
    <ImportPage
      snapshot={await db.snapshot()}
      onImported={onImported}
      notify={vi.fn()}
    />,
  );
  const file = new File([text], "banque.csv", { type: "text/csv" });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new TextEncoder().encode(text).buffer,
  });
  await user.upload(screen.getByLabelText("Fichier CSV"), file);
  return { user, onImported };
}
async function select(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: string,
) {
  if (label === "Compte de destination") {
    await user.click(screen.getByRole("radio", { name: option }));
    return;
  }
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(screen.getByRole("option", { name: option }));
}
describe("Import simplifié — compte explicite, détection prudente, conservation des données", () => {
  it("reconnaît les formats usuels et SG, mais refuse de deviner des colonnes ambiguës", () => {
    expect(automaticMappingIssues(parseCSV(simple))).toEqual([]);
    expect(automaticMappingIssues(parseCSV(sg))).toEqual([]);
    expect(
      automaticMappingIssues(
        parseCSV(
          "date;bookingdate;amount;libelle\n2026-10-01;2026-10-02;10;Test",
        ),
      ).join(),
    ).toMatch(/Plusieurs/);
    expect(
      automaticMappingIssues(
        parseCSV("date;amount;debit;libelle\n2026-10-01;10;10;Test"),
      ).join(),
    ).toMatch(/source/);
    expect(
      automaticMappingIssues(parseCSV("quand;valeur;qui\n2026-10-01;10;Test")),
    ).toHaveLength(3);
  });
  it("un CSV reconnu saute le mapping et importe sur le compte existant choisi", async () => {
    await db.accounts.bulkPut([{ id: "Personnel" }, { id: "Commun" }]);
    const { user, onImported } = await start();
    await screen.findByRole("dialog", { name: "Sur quel compte importer ?" });
    expect(
      screen.queryByRole("heading", { name: "Vérifier les colonnes" }),
    ).toBeNull();
    await select(user, "Compte de destination", "Commun");
    await user.click(
      screen.getByRole("button", { name: "Voir les opérations" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Importer 2 opérations" }),
    );
    await waitFor(() => expect(onImported).toHaveBeenCalledWith("2026-10"));
    expect((await db.transactions.toArray()).map((t) => t.account)).toEqual([
      "Commun",
      "Commun",
    ]);
    expect(await db.accounts.count()).toBe(2);
  });
  it("un compte nouveau n’est créé qu’au commit; annuler la modale ne sauvegarde rien", async () => {
    const { user } = await start();
    await screen.findByRole("dialog");
    await user.type(screen.getByLabelText("Nom du nouveau compte"), "Commun");
    await user.click(
      screen.getByRole("button", { name: "Revenir au fichier" }),
    );
    expect(await db.accounts.count()).toBe(0);
    expect(await db.transactions.count()).toBe(0);
    await user.click(screen.getByRole("button", { name: "Choisir le compte" }));
    await user.click(
      screen.getByRole("button", { name: "Voir les opérations" }),
    );
    expect(await db.accounts.count()).toBe(0);
    await user.click(
      screen.getByRole("button", { name: "Importer 2 opérations" }),
    );
    await waitFor(async () => expect(await db.transactions.count()).toBe(2));
    expect(await db.accounts.get("Commun")).toMatchObject({ id: "Commun" });
  });
  it("garde la correction manuelle lorsque date et bookingdate sont concurrentes", async () => {
    await db.accounts.put({ id: "Commun" });
    const { user } = await start(
      "date;bookingdate;amount;libelle\n2026-10-01;2026-10-02;-10;Test",
    );
    await screen.findByRole("heading", { name: "Vérifier les colonnes" });
    expect(screen.queryByRole("dialog")).toBeNull();
    await select(user, "Date *", "bookingdate");
    await user.click(
      screen.getByRole("button", {
        name: "Confirmer les colonnes et choisir le compte",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Voir les opérations" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Importer 1 opérations" }),
    );
    await waitFor(async () => expect(await db.transactions.count()).toBe(1));
    expect((await db.transactions.toArray())[0].date).toBe("2026-10-02");
  });
  it("conserve séparément les comptes d’un export multicomptes", async () => {
    const { user } = await start(
      "date;account;amount;libelle\n2026-10-02;A;-10;Un\n2026-10-03;B;-20;Deux",
    );
    await screen.findByRole("dialog");
    expect(
      screen.queryByRole("radio", { name: /Un nouveau compte/ }),
    ).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Voir les opérations" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Importer 2 opérations" }),
    );
    await waitFor(async () => expect(await db.transactions.count()).toBe(2));
    expect(
      (await db.transactions.toArray()).map((t) => t.account).sort(),
    ).toEqual(["A", "B"]);
  });
  it("ne réimporte pas automatiquement un doublon et demande la revue explicite", async () => {
    await db.accounts.put({ id: "Commun" });
    const parsed = parseCSV(simple);
    const original = previewImport(
      parsed,
      detectMapping(parsed.fields),
      "Commun",
      [],
    )[0].transaction!;
    await db.transactions.put({
      ...original,
      id: "old",
      batchId: "old",
      note: "À conserver",
    });
    const { user } = await start();
    await screen.findByRole("dialog");
    await user.click(
      screen.getByRole("button", { name: "Voir les opérations" }),
    );
    expect(
      (screen.getByLabelText("Importer ligne 2") as HTMLInputElement).checked,
    ).toBe(false);
    expect(
      (
        screen.getByRole("button", {
          name: "Importer 1 opérations",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await user.click(screen.getByRole("checkbox", { name: /J’ai vérifié/ }));
    await user.click(
      screen.getByRole("button", { name: "Importer 1 opérations" }),
    );
    await waitFor(async () => expect(await db.transactions.count()).toBe(2));
    expect((await db.transactions.get("old"))?.note).toBe("À conserver");
  });
  it("SG conserve son identité bancaire et demande un choix explicite pour son solde", async () => {
    await db.accounts.bulkPut([
      { id: "Autre" },
      {
        id: "SG commun",
        bankAccountId: "00012345678",
        checkpoint: { date: "2026-10-01", amount: 50000 },
      },
    ]);
    const { user } = await start(sg);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("SG commun")).toBeTruthy();
    expect(within(dialog).queryByRole("combobox")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Voir les opérations" }),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Importer 1 opérations",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect((await db.accounts.get("SG commun"))?.checkpoint?.amount).toBe(
      50000,
    );
    await select(
      user,
      "Décision pour le solde SG commun",
      "Accepter cette observation bancaire",
    );
    await user.click(
      screen.getByRole("button", { name: "Importer 1 opérations" }),
    );
    await waitFor(async () => expect(await db.transactions.count()).toBe(1));
    expect((await db.transactions.toArray())[0].account).toBe("SG commun");
    expect((await db.accounts.get("SG commun"))?.checkpoint).toMatchObject({
      date: "2026-10-02",
      amount: 100000,
    });
  });
  it("le choix d’un compte unique réaffecte aussi son solde dérivé sans changer l’original", () => {
    const file = parseCSV(
      "date;account;amount;libelle;daily_balance\n2026-10-02;Ancien;-10;Test;100",
    );
    const next = fileForImportAccount(file, "Commun", false);
    expect(next.metadata?.accounts[0]).toMatchObject({
      account: "Commun",
      checkpoints: [{ date: "2026-10-02", amount: 10000, status: "derived" }],
    });
    expect(file.metadata?.accounts[0].account).toBe("Ancien");
    const multi = parseCSV(
      "date;account;amount;libelle;daily_balance\n2026-10-02;A;-10;Un;100\n2026-10-02;B;-20;Deux;200",
    );
    expect(() => fileForImportAccount(multi, "Commun", false)).toThrow(
      /plusieurs comptes/,
    );
  });
  it("ne transforme pas un daily_balance USD en ancrage EUR malgré des opérations exclues", () => {
    const file = parseCSV(
      "date;account;amount;libelle;currency;daily_balance\n2026-10-02;A;-10;Test;USD;100",
    );
    expect(file.errors.join()).toMatch(/devise/);
    expect(file.metadata?.accounts).toHaveLength(0);
  });
  it("ne laisse pas surgir la modale sur une page inactive après lecture asynchrone", async () => {
    const user = userEvent.setup();
    const snapshot = await db.snapshot();
    const props = { snapshot, onImported: vi.fn(), notify: vi.fn() };
    const view = render(<ImportPage {...props} active={false} />);
    const file = new File([simple], "test.csv", { type: "text/csv" });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new TextEncoder().encode(simple).buffer,
    });
    await user.upload(screen.getByLabelText("Fichier CSV"), file);
    await screen.findByRole("heading", { name: "Colonnes détectées" });
    expect(screen.queryByRole("dialog")).toBeNull();
    view.rerender(<ImportPage {...props} active />);
    expect(
      await screen.findByRole("dialog", { name: "Sur quel compte importer ?" }),
    ).toBeTruthy();
    expect(await db.transactions.count()).toBe(0);
  });
});
