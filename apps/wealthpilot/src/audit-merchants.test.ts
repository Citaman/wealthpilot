import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { render, fireEvent } from "@testing-library/react";
import { existsSync } from "node:fs";
import { brandFor } from "./merchants";
import { MerchantIcon } from "./MerchantIcon";
import { parseCSV, detectMapping, previewImport, exportCSV } from "./importer";
const confirmed = [
  ["Navigo", "idfm"],
  ["Sogessur", "sogessur"],
  ["Veolia", "veolia"],
  ["Kiabi Psc", "kiabi"],
  ["Chaussea", "chaussea"],
  ["RATP", "ratp"],
  ["Decathlon", "decathlon"],
  ["SG - frais bancaires", "societe-generale"],
  ["SG - cotisation carte", "societe-generale"],
  ["AG Société Générale", "societe-generale"],
  ["Mc Donald", "mcdonalds"],
  ["Mc Donald’S", "mcdonalds"],
  ["Free Box", "free-fr"],
  ["Carref Creteil", "carrefour"],
  ["MAIF Vie", "maif"],
  ["Primark Creteil", "primark"],
  ["CAF", "caf"],
  ["Loyer ORPI", "orpi"],
  ["Pathé Ivry", "pathe"],
  ["IVS France", "ivs"],
  ["JD Paris", "jdsports"],
  ["5 à Sec", "5asec"],
  ["H&M", "handm"],
  ["Leclerc", "edotleclerc"],
  ["CB AMZN MKTP FR", "amazon"],
  ["G20 PARIS", "g20"],
  ["AG SOCIETE GENERALE", "societe-generale"],
  ["FREE MOBILE", "free-fr"],
  ["BK PARIS", "burgerking"],
  ["Macdonalds", "mcdonalds"],
];
const rejected = [
  "Shein / Temu",
  "Sq *Levain",
  "Paul Martin",
  "Virement de Paul",
  "Normalisation budget",
  "SGS laboratoire",
  "Total des courses",
];
const imported = (names: string[]) => {
  const file = parseCSV(
    "date;amount;merchant;libelle;category\n" +
      names.map((name) => `2026-10-02;-10;${name};${name};Courses`).join("\n"),
  );
  expect(file.errors).toEqual([]);
  const rows = previewImport(
    file,
    detectMapping(file.fields),
    "Compte test",
    [],
  );
  expect(rows.every((r) => !r.error)).toBe(true);
  return rows.map((r, i) => ({
    ...r.transaction!,
    id: "row" + i,
    batchId: "public-fixture",
  }));
};
describe("Parcours des identités marchandes — données publiques uniquement", () => {
  it("importe les libellés bancaires, affiche leurs vrais assets locaux et conserve identité et centimes à l’export", () => {
    const rows = imported(confirmed.map(([name]) => name));
    const view = render(
      createElement(
        "div",
        null,
        ...rows.map((t) =>
          createElement(MerchantIcon, {
            key: t.id,
            name: t.merchant,
            category: t.category,
          }),
        ),
      ),
    );
    expect(rows.map((t) => brandFor(t.merchant)?.slug)).toEqual(
      confirmed.map(([, slug]) => slug),
    );
    const images = [...view.container.querySelectorAll("img")];
    expect(images).toHaveLength(confirmed.length);
    expect(
      images.every((img) => existsSync("public" + img.getAttribute("src"))),
    ).toBe(true);
    const file = parseCSV(exportCSV(rows));
    const replay = previewImport(
      file,
      detectMapping(file.fields),
      "Compte test",
      rows,
    );
    expect(replay.every((r) => r.duplicate && !r.error)).toBe(true);
    expect(replay.map((r) => r.transaction?.amount)).toEqual(
      rows.map((t) => t.amount),
    );
    // A real image failure must recover to a category icon, never a broken image.
    fireEvent.error(images[0]);
    expect(view.container.querySelectorAll("img")).toHaveLength(
      images.length - 1,
    );
    expect(view.container.querySelector(".merchant-yellow svg")).toBeTruthy();
  });
  it("laisse les identités ambiguës génériques et diversifie leurs icônes par sous-catégorie sans fausse marque", () => {
    const rows = imported(rejected);
    expect(rows.map((t) => brandFor(t.merchant))).toEqual(
      rejected.map(() => null),
    );
    const names = ["Amazonie voyages", "Freepik", "Orangeade locale"];
    expect(names.map((name) => brandFor(name)?.slug)).not.toEqual([
      "amazon",
      "free-fr",
      "orange",
    ]);
    for (const [i, name] of names.entries())
      expect(brandFor(name)?.slug).not.toBe(["amazon", "free-fr", "orange"][i]);
    const subcategories = [
      "Laboratoire",
      "Pharmacie",
      "Restaurant",
      "Courses",
      "Transport",
      "Musique",
      "Internet",
    ];
    const view = render(
      createElement(
        "div",
        null,
        ...rows.map((t, i) =>
          createElement(MerchantIcon, {
            key: t.id,
            name: t.merchant,
            category: "Autres",
            subcategory: subcategories[i],
          }),
        ),
      ),
    );
    expect(view.container.querySelectorAll("img")).toHaveLength(0);
    const icons = [...view.container.querySelectorAll(".merchant-icon")];
    expect(icons.map((icon) => icon.getAttribute("title"))).toEqual([
      "Laboratoire",
      "Pharmacie",
      "Restaurant",
      "Courses",
      "Transport",
      "Musique",
      "Internet",
    ]);
    expect(
      new Set(icons.map((icon) => icon.className)).size,
    ).toBeGreaterThanOrEqual(5);
    expect(icons.every((icon) => !!icon.querySelector("svg"))).toBe(true);
  });
});
