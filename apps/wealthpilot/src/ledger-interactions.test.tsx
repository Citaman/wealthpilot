import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useLiveQuery } from "dexie-react-hooks";
import { TransactionsPage } from "./TransactionsPage";
import { Select } from "./Select";
import { db } from "./store";
import { emptySnapshot, type Transaction } from "./types";
import { dateLabel } from "./domain";
import { useState } from "react";

const transaction = (
  id: string,
  patch: Partial<Transaction> = {},
): Transaction => ({
  id,
  batchId: "test",
  date: "2026-10-02",
  amount: -1500,
  account: "Commun",
  merchant: "Entreprise Test",
  label: "CB ENTREPRISE TEST",
  category: "Restauration",
  subcategory: "Fast food",
  note: "Original",
  internal: false,
  fingerprint: id,
  raw: { "Sous-catégorie": "Fast food" },
  ...patch,
});
const initial = [
  transaction("one", { internal: true, reviewed: true }),
  transaction("two", { date: "2026-10-01", note: "Autre note" }),
  transaction("three", {
    merchant: "Pharmacie",
    label: "PHARMACIE",
    category: "Santé",
    subcategory: "Pharmacie",
  }),
];
function LiveLedger() {
  const rows = useLiveQuery(() => db.transactions.toArray(), [], []);
  return (
    <TransactionsPage
      snapshot={{ ...structuredClone(emptySnapshot), transactions: rows }}
      from="2026-10"
      month="2026-10"
      account=""
      notify={vi.fn()}
    />
  );
}
const openFirst = async () =>
  fireEvent.click(
    await screen.findByRole("button", {
      name: `Détails de Entreprise Test du ${dateLabel("2026-10-02")}`,
    }),
  );
async function choose(name: string, option: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: option }));
}
beforeEach(async () => {
  await db.transactions.clear();
  await db.transactions.bulkPut(initial);
});

describe("Journal : corrections persistantes et édition accessible", () => {
  it("supprime le pointage manuel mais conserve le classement utile et les anciennes données", async () => {
    await db.transactions.update("three", { category: "À catégoriser" });
    render(<LiveLedger />);
    await openFirst();
    expect(screen.queryByRole("columnheader", { name: "Vérifiée" })).toBeNull();
    expect(screen.queryByText("À vérifier")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Marquer.*vérifi/ }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Sélectionner cette page" }),
    );
    expect(screen.queryByRole("button", { name: "Vérifier" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Filtres" }));
    expect(screen.queryByRole("combobox", { name: "Vérification" })).toBeNull();
    await choose("Catégorisation", "À catégoriser");
    expect(
      screen.getAllByRole("button", { name: /^Détails de / }),
    ).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: /Détails de Pharmacie/ }),
    ).toBeTruthy();
    expect((await db.transactions.get("one"))?.reviewed).toBe(true);
  });

  it("ignore un ancien lien de pointage sans masquer les transactions déjà vérifiées", () => {
    render(
      <TransactionsPage
        snapshot={{ ...structuredClone(emptySnapshot), transactions: initial }}
        from="2026-10"
        month="2026-10"
        account=""
        navigationFilter={{ category: "", review: "unreviewed", revision: 1 }}
        notify={vi.fn()}
      />,
    );
    expect(
      screen.getAllByRole("button", { name: /^Détails de / }),
    ).toHaveLength(3);
    expect(screen.queryByRole("combobox", { name: "Vérification" })).toBeNull();
  });

  it("classe une entité sans propager son statut interne ni sa note et annule exactement", async () => {
    render(<LiveLedger />);
    await openFirst();
    fireEvent.change(screen.getByRole("textbox", { name: "Nom affiché" }), {
      target: { value: "Nom familial" },
    });
    await choose("Catégorie", "Santé");
    expect(
      (
        screen.getByRole("textbox", {
          name: "Sous-catégorie",
        }) as HTMLInputElement
      ).value,
    ).toBe("");
    fireEvent.change(
      screen.getByRole("textbox", { name: "Note personnelle" }),
      { target: { value: "Nouvelle note" } },
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Appliquer le nom et le classement/,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer pour 2 opérations" }),
    );
    await waitFor(async () =>
      expect((await db.transactions.get("two"))?.merchantName).toBe(
        "Nom familial",
      ),
    );
    expect(await db.transactions.get("one")).toMatchObject({
      internal: true,
      reviewed: true,
      note: "Nouvelle note",
      category: "Santé",
      subcategory: "",
    });
    expect(await db.transactions.get("two")).toMatchObject({
      internal: false,
      note: "Autre note",
      category: "Santé",
      subcategory: "",
    });
    await waitFor(() =>
      expect(document.activeElement?.textContent).toContain("Nom familial"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Annuler la modification" }),
    );
    await waitFor(async () =>
      expect(await db.transactions.toArray()).toEqual(
        [...initial].sort((a, b) => a.id.localeCompare(b.id)),
      ),
    );
  });

  it("conserve un brouillon masqué par un filtre et le supprime seulement à Annuler", async () => {
    render(<LiveLedger />);
    await openFirst();
    fireEvent.change(
      screen.getByRole("textbox", { name: "Note personnelle" }),
      { target: { value: "Brouillon conservé" } },
    );
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "pharmacie" },
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("textbox", { name: "Note personnelle" }),
      ).toBeNull(),
    );
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    expect(
      await screen.findByRole("textbox", { name: "Note personnelle" }),
    ).toHaveProperty("value", "Brouillon conservé");
    fireEvent.click(screen.getByRole("button", { name: "Fermer les détails" }));
    await waitFor(() =>
      expect(document.activeElement?.textContent).toContain("Entreprise Test"),
    );
    await openFirst();
    expect(
      screen.getByRole("textbox", { name: "Note personnelle" }),
    ).toHaveProperty("value", "Brouillon conservé");
    fireEvent.click(screen.getByRole("button", { name: /^Annuler$/ }));
    await openFirst();
    expect(
      screen.getByRole("textbox", { name: "Note personnelle" }),
    ).toHaveProperty("value", "Original");
    expect((await db.transactions.get("one"))?.note).toBe("Original");
  });

  it("sélectionne la page hors des en-têtes et efface une sous-catégorie obsolète en lot", async () => {
    render(<LiveLedger />);
    await screen.findByRole("button", { name: /Pharmacie.*oct/ });
    const all = screen.getByRole("checkbox", {
      name: "Sélectionner cette page",
    });
    expect(all.closest('[role="row"]')).toBeNull();
    fireEvent.click(all);
    await choose("Catégorie des opérations sélectionnées", "Santé");
    fireEvent.click(screen.getByRole("button", { name: "Appliquer" }));
    await waitFor(async () =>
      expect((await db.transactions.get("one"))?.subcategory).toBe(""),
    );
    expect((await db.transactions.get("one"))?.internal).toBe(true);
    expect((await db.transactions.get("two"))?.internal).toBe(false);
  });

  it("explique les bornes invalides au lieu de masquer silencieusement les résultats", async () => {
    render(<LiveLedger />);
    await openFirst();
    fireEvent.click(screen.getByRole("button", { name: "Filtres" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Montant minimum (€)" }),
      { target: { value: "oops" } },
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "ne sont pas appliquées",
    );
    expect(
      screen
        .getByRole("textbox", { name: "Montant minimum (€)" })
        .getAttribute("aria-invalid"),
    ).toBe("true");
    fireEvent.change(
      screen.getByRole("textbox", { name: "Montant minimum (€)" }),
      { target: { value: "50" } },
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Montant maximum (€)" }),
      { target: { value: "10" } },
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "inférieur ou égal",
    );
  });

  it("ouvre un classement compact et préserve le brouillon des autres détails", async () => {
    render(<LiveLedger />);
    await openFirst();
    fireEvent.change(
      screen.getByRole("textbox", { name: "Note personnelle" }),
      { target: { value: "À garder" } },
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Catégoriser Entreprise Test" })[0],
    );
    expect(screen.queryByRole("textbox", { name: "Nom affiché" })).toBeNull();
    expect(
      screen.getByRole("form", { name: "Classer Entreprise Test" }),
    ).toBeTruthy();
    await choose("Catégorie", "Santé");
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le classement" }),
    );
    await waitFor(async () =>
      expect((await db.transactions.get("one"))?.category).toBe("Santé"),
    );
    expect((await db.transactions.get("one"))?.subcategory).toBe("");
    expect((await db.transactions.get("one"))?.note).toBe("Original");
    await openFirst();
    expect(
      screen.getByRole("textbox", { name: "Note personnelle" }),
    ).toHaveProperty("value", "À garder");
    expect(
      screen.getByRole("textbox", { name: "Sous-catégorie" }),
    ).toHaveProperty("value", "");
  });

  it("transmet les contraintes de formulaire et la description d’un sélecteur", async () => {
    function Form() {
      const [value, setValue] = useState("");
      return (
        <form aria-label="Test">
          <Select
            aria-label="Choix"
            name="choice"
            required
            aria-invalid="true"
            aria-describedby="help"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          >
            <option value="">Choisir</option>
            <option value="valid">Valide</option>
          </Select>
          <p id="help">Aide</p>
        </form>
      );
    }
    render(<Form />);
    const control = screen.getByRole("combobox", { name: "Choix" });
    expect(control.getAttribute("aria-describedby")).toBe("help");
    expect(control.getAttribute("aria-invalid")).toBe("true");
    const form = screen.getByRole("form", { name: "Test" }) as HTMLFormElement;
    expect(form.checkValidity()).toBe(false);
    await choose("Choix", "Valide");
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get("choice")).toBe("valid");
  });
});
