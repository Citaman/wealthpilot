import { describe, expect, it } from "vitest";
import {
  decodeCSV,
  detectMapping,
  parseCSV,
  previewImport,
  metadataAccountId,
} from "./importer";
import type { Transaction } from "./types";

export const sgFixture = (
  balance = "1000.00",
  rows = "02/10/2026;CARTE;CARTE REF A;-10,00;EUR\n02/10/2026;CARTE;CARTE REF B;-10,00;EUR",
) =>
  `00012345678;01/09/2026;04/10/2026;${rows.split("\n").length};02/10/2026;${balance} EUR\n\nDate de l'opération;Libellé;Détail de l'écriture;Montant de l'opération;Devise\n${rows}`;
describe("SG source metadata and conservative identity", () => {
  it("separates source coverage, observation date, and full banking detail", () => {
    const file = parseCSV(sgFixture());
    expect(file.errors).toEqual([]);
    expect(file.metadata?.accounts[0]).toEqual({
      bankAccountId: "00012345678",
      currency: "EUR",
      coverageFrom: "2026-09-01",
      coverageThrough: "2026-10-04",
      checkpoints: [{ date: "2026-10-02", amount: 100000, status: "observed" }],
    });
    const rows = previewImport(file, detectMapping(file.fields), "Courant", []);
    expect(rows.map((r) => r.row)).toEqual([4, 5]);
    expect(rows.map((r) => r.transaction?.label)).toEqual([
      "CARTE REF A",
      "CARTE REF B",
    ]);
    expect(rows.map((r) => r.transaction?.amount)).toEqual([-1000, -1000]);
  });
  it("compares detailed identity against legacy imports, including multiplicity", () => {
    const file = parseCSV(sgFixture());
    const legacy = {
      ...previewImport(file, detectMapping(file.fields), "Courant", [])[0]
        .transaction!,
      label: "CARTE",
      raw: { detail: "CARTE REF A" },
      id: "old",
      batchId: "old",
    } as Transaction;
    expect(
      previewImport(file, detectMapping(file.fields), "Courant", [legacy]).map(
        (r) => r.duplicate,
      ),
    ).toEqual([true, false]);
    const repeated = parseCSV(
      sgFixture(
        "1000.00",
        "02/10/2026;CARTE;CARTE REF A;-10,00;EUR\n02/10/2026;CARTE;CARTE REF A;-10,00;EUR",
      ),
    );
    expect(
      previewImport(repeated, detectMapping(repeated.fields), "Courant", [
        legacy,
      ]).map((r) => r.duplicate),
    ).toEqual([true, false]);
  });
  it("rejects invalid SG declared counts, dates and currency", () => {
    expect(
      parseCSV(sgFixture().replace(";2;02/10", ";9;02/10")).errors.join(),
    ).toMatch(/nombre/);
    expect(
      parseCSV(
        sgFixture().replace(";02/10/2026;1000", ";31/02/2026;1000"),
      ).errors.join(),
    ).toMatch(/Préambule/);
    expect(
      parseCSV(sgFixture().replace("1000.00 EUR", "1000.00 USD")).errors.join(),
    ).toMatch(/EUR/);
  });
  it("decodes Windows1252 and never promotes daily_balance to observed", () => {
    expect(decodeCSV(Uint8Array.from([0x63, 0x61, 0x66, 0xe9]).buffer)).toBe(
      "café",
    );
    const file = parseCSV(
      "account,date,amount,libelle,daily_balance\nA,2026-10-02,-10,Test,100\nA,2026-10-02,-20,Test2,100",
    );
    expect(file.metadata?.accounts[0].checkpoints).toEqual([
      { date: "2026-10-02", amount: 10000, status: "derived" },
    ]);
    expect(
      metadataAccountId(
        { bankAccountId: "012", currency: "EUR", checkpoints: [] },
        "Other",
        [{ id: "Stable", bankAccountId: "012" }],
      ),
    ).toBe("Stable");
  });
});
