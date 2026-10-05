import { describe, expect, it } from "vitest";
import type { Transaction } from "../domain/types";
import { exportTransactionsCsv } from "./backup";
import {
  analyzeFile,
  automaticMappingIssues,
  detectMapping,
  metadataAccountId,
  type AccountChoice,
} from "./importer/mapping";
import { decodeCSV, readCsv } from "./importer/parse";
import {
  accountChoiceIssues,
  buildPreview,
  type PreviewRow,
} from "./importer/preview";
import { parsedFile, sgFixture } from "./test-utils";

const preview = (
  text: string,
  existing: Transaction[] = [],
  choice: AccountChoice = { "": "Courant" },
) => {
  const file = parsedFile(text);
  return buildPreview(file, detectMapping(file.fields), choice, {
    transactions: existing,
    accounts: [],
  });
};
const persist = (rows: PreviewRow[]): Transaction[] =>
  rows
    .filter((r) => r.tx)
    .map((r, i) => ({ ...r.tx!, id: `t${i}`, batchId: "synthetic" }));
const duplicates = (rows: PreviewRow[]) =>
  rows.map((r) => r.status === "duplicate");

it("import CSV : relevé SG avec préambule et Windows-1252, multiplicité des achats identiques, identité détaillée, réimport de l’export", async () => {
  // qualifie un fichier hétérogène, conserve centimes et dates puis réimporte son export
  {
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
    const { rows, counts } = preview(csv);
    expect(rows.slice(0, valid.length).map((r) => r.tx?.amount)).toEqual(
      valid.map((r) => r[2]),
    );
    expect(rows.slice(0, 2).map((r) => r.tx?.date)).toEqual([
      "2026-02-28",
      "2024-02-29",
    ]);
    expect(
      rows.slice(valid.length).every((r) => r.status === "invalid" && r.reason),
    ).toBe(true);
    expect(counts).toEqual({
      new: valid.length,
      duplicate: 0,
      invalid: invalid.length,
    });
    const stored = persist(rows);
    const roundtrip = preview(exportTransactionsCsv(stored), [], {});
    expect(roundtrip.rows.map((r) => r.tx?.amount)).toEqual(
      stored.map((t) => t.amount),
    );
    expect(roundtrip.rows.map((r) => r.tx?.date)).toEqual(
      stored.map((t) => t.date),
    );
    expect(
      preview(exportTransactionsCsv(stored), stored, {}).rows.every(
        (r) => r.status === "duplicate",
      ),
    ).toBe(true);
  }
  // garde la multiplicité : deux achats identiques, chevauchement, autre compte
  {
    const row = "02/10/2026;Courant;42,30;expense;Épicerie;Courses;Courses;N";
    const csv =
      "date;account;amount;direction;merchant;libelle;category;is_internal\n" +
      row +
      "\n" +
      row;
    const initial = preview(csv, [], {}).rows;
    expect(duplicates(initial)).toEqual([false, false]);
    expect(
      duplicates(preview(csv, persist(initial.slice(0, 1)), {}).rows),
    ).toEqual([true, false]);
    const complete = persist(initial);
    const again = preview(csv, complete, {}).rows;
    expect(duplicates(again)).toEqual([true, true]);
    expect(new Set(again.map((r) => r.existingId)).size).toBe(2);
    expect(
      preview(csv.replaceAll("Courant", "Commun"), complete, {}).rows[0].status,
    ).toBe("new");
  }
  // sépare couverture, date d’observation et détail bancaire complet
  {
    const file = parsedFile(sgFixture());
    expect(file.errors).toEqual([]);
    expect(file.profile).toBe("sg");
    expect(file.metadata?.accounts[0]).toEqual({
      bankAccountId: "00012345678",
      currency: "EUR",
      coverageFrom: "2026-09-01",
      coverageThrough: "2026-10-04",
      checkpoints: [{ date: "2026-10-02", amount: 100000, status: "observed" }],
    });
    expect(automaticMappingIssues(file)).toEqual([]);
    const result = buildPreview(
      file,
      detectMapping(file.fields),
      { "": "Courant" },
      { transactions: [], accounts: [] },
    );
    expect(result.rows.map((r) => r.index)).toEqual([4, 5]);
    expect(result.rows.map((r) => r.tx?.label)).toEqual([
      "CARTE REF A",
      "CARTE REF B",
    ]);
    expect(result.rows.map((r) => r.tx?.amount)).toEqual([-1000, -1000]);
    expect(result.checkpoints).toEqual([
      {
        account: "Courant",
        date: "2026-10-02",
        amount: 100000,
        status: "observed",
        coverageFrom: "2026-09-01",
        coverageThrough: "2026-10-04",
      },
    ]);
    expect(result.newAccounts).toEqual(["Courant"]);
  }
  // compare l’identité détaillée aux anciens imports, multiplicité comprise
  {
    const file = parsedFile(sgFixture());
    const mapping = detectMapping(file.fields);
    const first = buildPreview(
      file,
      mapping,
      { "": "Courant" },
      { transactions: [], accounts: [] },
    );
    const legacy = {
      ...first.rows[0].tx!,
      label: "CARTE",
      raw: { detail: "CARTE REF A" },
      id: "old",
      batchId: "old",
    } as Transaction;
    const tables = { transactions: [legacy], accounts: [] };
    expect(
      duplicates(buildPreview(file, mapping, { "": "Courant" }, tables).rows),
    ).toEqual([true, false]);
    const repeated = parsedFile(
      sgFixture(
        "1000.00",
        "02/10/2026;CARTE;CARTE REF A;-10,00;EUR\n02/10/2026;CARTE;CARTE REF A;-10,00;EUR",
      ),
    );
    expect(
      duplicates(
        buildPreview(repeated, mapping, { "": "Courant" }, tables).rows,
      ),
    ).toEqual([true, false]);
  }
  // décode Windows-1252 dans le lecteur et hache les octets
  {
    expect(decodeCSV(Uint8Array.from([0x63, 0x61, 0x66, 0xe9]).buffer)).toEqual(
      {
        text: "café",
        encoding: "windows-1252",
      },
    );
    const bytes = new TextEncoder().encode(
      "date;amount;libelle\n2026-10-02;-1;Café",
    );
    const file = await readCsv(bytes.buffer as ArrayBuffer);
    expect(file).toMatchObject({
      encoding: "utf-8",
      delimiter: ";",
      profile: "generic",
    });
    expect(file.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(file.rows[0].libelle).toBe("Café");
  }
});

const multi =
  "date;account;amount;libelle\n2026-10-02;Perso;-1;A\n2026-10-02;Joint;-2;B";
