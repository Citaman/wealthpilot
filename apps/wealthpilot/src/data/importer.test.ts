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

describe("CSV — qualification, conservation et réimport", () => {
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
  });

  it("préserve le texte cité/multiligne, refuse les champs contradictoires et neutralise les formules", () => {
    const { rows } = preview(
      'date,amount,direction,devise,libelle\n2026-10-02,42.30,expense,EUR,"Achat,\ncommerce"\n2026-10-02,10,autre,EUR,Erreur\n2026-10-02,10,expense,USD,Erreur',
    );
    expect(rows).toHaveLength(3);
    expect(rows[0].tx).toMatchObject({
      amount: -4230,
      label: "Achat,\ncommerce",
    });
    expect(rows[1].reason).toMatch(/Sens/);
    expect(rows[2].reason).toMatch(/EUR/);
    expect(
      preview("date;debit;credit;libelle\n2026-10-02;10;20;Contradiction")
        .rows[0].reason,
    ).toMatch(/simultanés/);
    expect(parsedFile("date;date\nx;y").errors.length).toBeGreaterThan(0);
    expect(
      parsedFile("date;amount;libelle\nx;y").errors.length,
    ).toBeGreaterThan(0);
    const stored = persist(rows);
    stored[0].merchant = '=HYPERLINK("bad")';
    const exported = exportTransactionsCsv(stored);
    expect(exported).toContain("'=HYPERLINK");
    expect(preview(exported, [], {}).rows[0].tx?.label).toBe(
      "Achat,\ncommerce",
    );
  });

  it("garde la multiplicité : deux achats identiques, chevauchement, autre compte", () => {
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
  });

  it("prévisualise puis réimporte 50 000 occurrences sans supprimer de vrais achats", () => {
    const source = "date;amount;libelle\n" + "2026-10-02;-1;A\n".repeat(50000);
    const first = preview(source);
    expect(first.errors).toEqual([]);
    expect(first.counts.new).toBe(50000);
    expect(preview(source, persist(first.rows)).counts.duplicate).toBe(50000);
  });
});

describe("Relevés SG, métadonnées et identité", () => {
  it("sépare couverture, date d’observation et détail bancaire complet", () => {
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
  });

  it("compare l’identité détaillée aux anciens imports, multiplicité comprise", () => {
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
  });

  it("refuse les nombres, dates et devises SG invalides", () => {
    expect(
      parsedFile(sgFixture().replace(";2;02/10", ";9;02/10")).errors.join(),
    ).toMatch(/nombre/);
    expect(
      parsedFile(
        sgFixture().replace(";02/10/2026;1000", ";31/02/2026;1000"),
      ).errors.join(),
    ).toMatch(/Préambule/);
    expect(
      parsedFile(
        sgFixture().replace("1000.00 EUR", "1000.00 USD"),
      ).errors.join(),
    ).toMatch(/EUR/);
  });

  it("décode Windows-1252 dans le lecteur et hache les octets", async () => {
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
  });

  it("ne promeut jamais daily_balance en solde observé", () => {
    const result = preview(
      "account,date,amount,libelle,daily_balance\nA,2026-10-02,-10,Test,100\nA,2026-10-02,-20,Test2,100",
      [],
      { A: "Commun" },
    );
    expect(result.metadata.accounts).toEqual([
      {
        account: "Commun",
        currency: "EUR",
        checkpoints: [{ date: "2026-10-02", amount: 10000, status: "derived" }],
      },
    ]);
    expect(result.checkpoints[0]).toMatchObject({
      account: "Commun",
      status: "derived",
    });
    expect(result.rows.every((r) => r.tx?.account === "Commun")).toBe(true);
    expect(
      preview(
        "account,date,amount,libelle,daily_balance\nA,2026-10-02,-10,T,100\nA,2026-10-02,-20,U,90",
        [],
        {},
      ).errors,
    ).toContain(
      "Soldes journaliers contradictoires pour le même compte et jour.",
    );
    expect(
      metadataAccountId({ bankAccountId: "012", account: "Other" }, "Other", [
        { id: "Stable", bankAccountId: "012" },
      ]),
    ).toBe("Stable");
  });
});

describe("Analyse et choix des comptes", () => {
  const multi =
    "date;account;amount;libelle\n2026-10-02;Perso;-1;A\n2026-10-02;Joint;-2;B";

  it("détecte comptes, lot déjà importé et compte reconnu par son numéro", () => {
    const file = parsedFile(multi, "multi.csv");
    const batch = {
      id: "b",
      name: "multi.csv",
      hash: "multi.csv",
      createdAt: "",
      count: 2,
      minDate: "",
      maxDate: "",
    };
    const analysis = analyzeFile(file, { accounts: [], batches: [batch] });
    expect(analysis).toMatchObject({
      profile: "generic",
      mappingIssues: [],
      detectedAccounts: ["Perso", "Joint"],
      alreadyImported: batch,
      choice: { Perso: "Perso", Joint: "Joint" },
    });
    const sg = analyzeFile(parsedFile(sgFixture()), {
      accounts: [{ id: "Courant", bankAccountId: "00012345678" }],
      batches: [],
    });
    expect(sg.identifiedAccount?.id).toBe("Courant");
    expect(sg.choice).toEqual({ "": "Courant" });
    expect(
      automaticMappingIssues(
        parsedFile("date;libelle;label;amount\n2026-10-02;a;b;1"),
      )[0],
    ).toMatch(/Plusieurs colonnes/);
  });

  it("refuse de mélanger deux comptes, une casse différente ou un autre numéro bancaire", () => {
    const file = parsedFile(multi);
    const mapping = detectMapping(file.fields);
    expect(
      accountChoiceIssues(
        file,
        mapping,
        { Perso: "Commun", Joint: "Commun" },
        [],
      ),
    ).toEqual([
      "Conservez les comptes distincts de ce fichier pour ne pas mélanger leurs opérations.",
    ]);
    expect(
      accountChoiceIssues(file, mapping, {}, [{ id: "perso" }])[0],
    ).toMatch(/autre casse/);
    const sg = parsedFile(sgFixture());
    const accounts = [
      { id: "Courant", bankAccountId: "00012345678" },
      { id: "Autre" },
    ];
    expect(
      accountChoiceIssues(
        sg,
        detectMapping(sg.fields),
        { "": "Autre" },
        accounts,
      )[0],
    ).toMatch(/reconnu par son numéro/);
    expect(
      accountChoiceIssues(
        sg,
        detectMapping(sg.fields),
        { "": "Courant" },
        accounts,
      ),
    ).toEqual([]);
  });
});
