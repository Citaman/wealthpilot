// Real worker + Radix dialogs in isolated fictional browser storage, never 5173.
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const out = path.resolve("../../tmp/import-flow-qa");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const checks = [],
  errors = [];
const check = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  console.log(JSON.stringify(checks.at(-1)));
  if (!pass) throw new Error(name);
};
const simple =
  "date;amount;libelle\n2026-10-02;-10;Épicerie\n2026-10-03;100;Salaire";
const sg =
  "00012345678;01/10/2026;04/10/2026;1;02/10/2026;1000.00 EUR\n\nDate de l'opération;Libellé;Détail de l'écriture;Montant de l'opération;Devise\n02/10/2026;CARTE;CARTE REF A;-10,00;EUR";
for (const scenario of ["existing", "sg", "ambiguous", "new"]) {
  const context = await browser.newContext({
    viewport: { width: 1512, height: 982 },
    locale: "fr-FR",
    recordVideo: { dir: out },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on("pageerror", (error) =>
    errors.push({ scenario, error: error.message }),
  );
  const snap = () =>
    page.evaluate(async () => (await import("/src/store.ts")).db.snapshot());
  const upload = (text) =>
    page
      .getByLabel("Fichier CSV")
      .setInputFiles({
        name: `${scenario}.csv`,
        mimeType: "text/csv",
        buffer: Buffer.from(text),
      });
  const select = async (label, option) => {
    if (label === "Compte de destination") {
      await page.getByRole("radio", { name: option, exact: true }).check();
      return;
    }
    await page.getByRole("combobox", { name: label, exact: true }).click();
    await page.getByRole("option", { name: option, exact: true }).click();
  };
  try {
    await page.goto("http://127.0.0.1:5201/#import");
    await page.evaluate(async (scenario) => {
      const { db } = await import("/src/store.ts");
      if (scenario === "sg")
        await db.accounts.bulkPut([
          { id: "Autre" },
          {
            id: "SG commun",
            bankAccountId: "00012345678",
            checkpoint: { date: "2026-10-01", amount: 50000 },
          },
        ]);
      else if (scenario !== "new")
        await db.accounts.bulkPut([{ id: "Personnel" }, { id: "Commun" }]);
    }, scenario);
    await upload(
      scenario === "sg"
        ? sg
        : scenario === "ambiguous"
          ? "date;bookingdate;amount;libelle\n2026-10-01;2026-10-02;-10;Test"
          : simple,
    );
    if (scenario === "ambiguous") {
      await page
        .getByRole("heading", { name: "Vérifier les colonnes" })
        .waitFor();
      check(
        "Ambiguous columns never skip explicit mapping",
        (await page.getByRole("dialog").count()) === 0,
      );
      await select("Date *", "bookingdate");
      await page
        .getByRole("button", {
          name: "Confirmer les colonnes et choisir le compte",
        })
        .click();
    }
    const dialog = page.getByRole("dialog", {
      name: "Sur quel compte importer ?",
    });
    await dialog.waitFor();
    check(
      `${scenario}: explicit account choice before any data write`,
      (await snap()).transactions.length === 0,
    );
    await page.screenshot({
      path: path.join(out, `${scenario}-account-1512.png`),
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const box = await dialog.boundingBox();
    check(
      `${scenario}: account modal fits mobile viewport`,
      box &&
        box.x >= 0 &&
        box.x + box.width <= 390 &&
        box.y >= 0 &&
        box.y + box.height <= 844,
      box,
    );
    await page.screenshot({
      path: path.join(out, `${scenario}-account-390.png`),
      animations: "disabled",
    });
    await page.setViewportSize({ width: 1512, height: 982 });
    if (scenario === "existing") {
      await dialog.getByRole("radio", { name: "Commun", exact: true }).focus();
      await page.keyboard.press("ArrowRight");
      check(
        "Account choices support keyboard arrows within modal",
        await dialog
          .getByRole("radio", { name: "Personnel", exact: true })
          .isChecked(),
      );
      await select("Compte de destination", "Commun");
    } else if (scenario === "sg") {
      check(
        "SG bank identity targets existing linked account",
        (await dialog.innerText()).includes("SG commun") &&
          (await dialog.getByRole("combobox").count()) === 0,
      );
    } else if (scenario === "new") {
      await page.getByLabel("Nom du nouveau compte").fill("Épargne test");
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      check(
        "Cancel account modal leaves no new account or transaction",
        (await snap()).accounts.length === 0 &&
          (await snap()).transactions.length === 0,
      );
      await page
        .getByRole("button", { name: "Choisir le compte", exact: true })
        .click();
    }
    await dialog.getByRole("button", { name: "Voir les opérations" }).click();
    const count = scenario === "sg" || scenario === "ambiguous" ? 1 : 2;
    const commit = page.getByRole("button", {
      name: `Importer ${count} opérations`,
      exact: true,
    });
    await commit.waitFor();
    if (scenario === "sg") {
      check(
        "SG checkpoint requires explicit confirmation",
        !(await commit.isEnabled()),
      );
      await select(
        "Décision pour le solde SG commun",
        "Accepter cette observation bancaire",
      );
    }
    await page
      .getByRole("heading", { name: "Aperçu des opérations" })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, `${scenario}-preview.png`) });
    await commit.click();
    await page.waitForFunction(
      async (count) =>
        (await (await import("/src/store.ts")).db.transactions.count()) ===
        count,
      count,
    );
    const saved = await snap();
    if (scenario === "existing") {
      check(
        "Existing destination used for every real persisted transaction",
        saved.transactions.every((t) => t.account === "Commun") &&
          saved.accounts.length === 2,
      );
      await page
        .getByRole("navigation", { name: "Navigation principale" })
        .getByRole("button", { name: "Import CSV", exact: true })
        .click();
      await upload(simple + "\n");
      await dialog.waitFor();
      await select("Compte de destination", "Commun");
      await dialog.getByRole("button", { name: "Voir les opérations" }).click();
      check(
        "Overlapping CSV deduplicates all rows without overwriting originals",
        !(await page
          .getByRole("checkbox", { name: "Importer ligne 2", exact: true })
          .isChecked()) &&
          !(await page
            .getByRole("button", { name: "Importer 0 opérations" })
            .isEnabled()) &&
          (await snap()).transactions.length === 2,
      );
    } else if (scenario === "sg") {
      check(
        "SG balance and source coverage retained",
        saved.accounts.find((a) => a.id === "SG commun")?.checkpoint.amount ===
          100000 &&
          saved.batches[0].metadata.accounts[0].coverageThrough ===
            "2026-10-04" &&
          saved.transactions[0].account === "SG commun",
      );
    } else if (scenario === "ambiguous") {
      check(
        "Corrected date column is the actual imported date",
        saved.transactions[0].date === "2026-10-02",
      );
    } else {
      check(
        "New account created only with successful transaction batch",
        saved.accounts.length === 1 &&
          saved.accounts[0].id === "Épargne test" &&
          saved.transactions.every((t) => t.account === "Épargne test"),
      );
    }
  } catch (error) {
    checks.push({
      name: scenario + ": interrupted",
      pass: false,
      detail: String(error.stack),
    });
    await page
      .screenshot({ path: path.join(out, `${scenario}-failure.png`) })
      .catch(() => {});
  } finally {
    await context.close();
  }
}
checks.push({
  name: "No uncaught runtime errors",
  pass: errors.length === 0,
  detail: errors,
});
await writeFile(
  path.join(out, "report.json"),
  JSON.stringify({ checks, errors }, null, 2),
);
await browser.close();
console.log(
  JSON.stringify({
    passed: checks.filter((c) => c.pass).length,
    total: checks.length,
  }),
);
