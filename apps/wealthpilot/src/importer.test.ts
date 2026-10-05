import { describe, it, expect } from "vitest";
import { parseCSV, detectMapping, previewImport, exportCSV } from "./importer";
import type { Transaction } from "./types";
const preview = (text: string, existing: Transaction[] = []) => {
  const file = parseCSV(text);
  return previewImport(file, detectMapping(file.fields), "Courant", existing);
};
const persist = (rows: ReturnType<typeof preview>) =>
  rows
    .filter((r) => !r.error)
    .map((r, i) => ({ ...r.transaction!, id: `t${i}`, batchId: "synthetic" }));
describe("Parcours CSV — qualification, conservation et réimport", () => {
  it("qualifie un fichier hétérogène, conserve centimes et dates puis réimporte son export", () => {
    const valid = [
      ["28/02/2026", "1 234,56 €", 123456],
      ["2024-02-29", "-12.05", -1205],
      ["2026-10-02", "(45,20)", -4520],
      ["2026-10-02", "0", 0],
      ["2026-10-02", "1.234,56", 123456],
      ["2026-10-02", "1,234.56", 123456],
    ] as const;
    const invalid = [
      ["2026-10-02", ""],
      ["2026-10-02", "NaN"],
      ["2026-10-02", "12.345"],
      ["2026-10-02", "--10"],
      ["2026-10-02", "1e5"],
      ["2026-10-02", "abc"],
      ["2026-10-02", "99999999999999"],
      ["31/02/2026", "10"],
      ["2026-13-01", "10"],
      ["10/02/26", "10"],
    ];
    const csv =
      "date;amount;libelle\n" +
      [...valid, ...invalid]
        .map(([date, amount], i) => `${date};${amount};Ligne ${i}`)
        .join("\n");
    const rows = preview(csv);
    expect(
      rows.slice(0, valid.length).map((r) => r.transaction?.amount),
    ).toEqual(valid.map((r) => r[2]));
    expect(rows.slice(0, 2).map((r) => r.transaction?.date)).toEqual([
      "2026-02-28",
      "2024-02-29",
    ]);
    expect(rows.slice(valid.length).map((r) => !!r.error)).toEqual(
      invalid.map(() => true),
    );
    const stored = persist(rows),
      exported = exportCSV(stored),
      roundtrip = preview(exported);
    expect(roundtrip.map((r) => r.transaction?.amount)).toEqual(
      stored.map((t) => t.amount),
    );
    expect(roundtrip.map((r) => r.transaction?.date)).toEqual(
      stored.map((t) => t.date),
    );
    expect(
      preview(exported, stored).every((r) => r.duplicate && !r.error),
    ).toBe(true);
  });
  it("préserve le texte cité/multiligne, refuse les champs contradictoires et neutralise les formules exportées", () => {
    const rows = preview(
      'date,amount,direction,devise,libelle\n2026-10-02,42.30,expense,EUR,"Achat,\ncommerce"\n2026-10-02,10,autre,EUR,Erreur\n2026-10-02,10,expense,USD,Erreur',
    );
    expect(rows).toHaveLength(3);
    expect(rows[0].transaction).toMatchObject({
      amount: -4230,
      label: "Achat,\ncommerce",
    });
    expect(rows[1].error).toMatch(/Sens/);
    expect(rows[2].error).toMatch(/EUR/);
    expect(
      preview("date;debit;credit;libelle\n2026-10-02;10;20;Contradiction")[0]
        .error,
    ).toMatch(/simultanés/);
    expect(parseCSV("date;date\nx;y").errors.length).toBeGreaterThan(0);
    expect(parseCSV("date;amount;libelle\nx;y").errors.length).toBeGreaterThan(
      0,
    );
    const stored = persist(rows);
    stored[0].merchant = '=HYPERLINK("bad")';
    const exported = exportCSV(stored);
    expect(exported).toContain("'=HYPERLINK");
    expect(preview(exported)[0].transaction?.label).toBe("Achat,\ncommerce");
  });
  it("importe deux achats identiques puis un chevauchement et un autre compte sans perdre la multiplicité", () => {
    const row = "02/10/2026;Courant;42,30;expense;Épicerie;Courses;Courses;N",
      header =
        "date;account;amount;direction;merchant;libelle;category;is_internal\n";
    const initial = preview(header + row + "\n" + row);
    expect(initial.map((r) => r.duplicate)).toEqual([false, false]);
    expect(
      preview(header + row + "\n" + row, persist(initial.slice(0, 1))).map(
        (r) => r.duplicate,
      ),
    ).toEqual([true, false]);
    const complete = persist(initial);
    expect(
      preview(header + row + "\n" + row, complete).every((r) => r.duplicate),
    ).toBe(true);
    expect(
      preview(header + row.replace("Courant", "Commun"), complete)[0].duplicate,
    ).toBe(false);
  });
  it("prévisualise puis réimporte 50 000 occurrences sans supprimer de vrais achats", () => {
    const source = "date;amount;libelle\n" + "2026-10-02;-1;A\n".repeat(50000);
    expect(parseCSV(source).errors).toEqual([]);
    const rows = preview(source);
    expect(rows).toHaveLength(50000);
    expect(rows.every((r) => !r.error && !r.duplicate)).toBe(true);
    expect(
      preview(source, persist(rows)).every((r) => r.duplicate && !r.error),
    ).toBe(true);
  });
});
