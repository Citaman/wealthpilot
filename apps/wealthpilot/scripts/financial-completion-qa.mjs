// Private import stays in an ephemeral isolated profile with NO screenshot/video.
// Only aggregate checks are written. Synthetic cross-tab QA is a separate profile.
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const file = process.env.WEALTHPILOT_PRIVATE_CSV;
if (!file)
  throw new Error(
    "WEALTHPILOT_PRIVATE_CSV required; never embed private contents.",
  );
const out = path.resolve("../../tmp/financial-completion-qa");
await mkdir(out, { recursive: true });
const checks = [],
  errors = [];
function check(name, pass, detail) {
  checks.push({ name, pass, detail });
  if (!pass) throw new Error("Failed acceptance check");
}
const browser = await chromium.launch({ headless: true });
const privateContext = await browser.newContext({
  viewport: { width: 1512, height: 982 },
  locale: "fr-FR",
  serviceWorkers: "block",
});
await privateContext.route("**/*", (route) => {
  const url = new URL(route.request().url());
  return url.hostname === "127.0.0.1" ||
    ["data:", "blob:"].includes(url.protocol)
    ? route.continue()
    : route.abort();
});
try {
  const bytes = await readFile(file),
    before = createHash("sha256").update(bytes).digest("hex");
  const page = await privateContext.newPage();
  page.on("pageerror", () =>
    errors.push(
      "Private browser runtime error (details intentionally withheld)",
    ),
  );
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00Z"));
  await page.goto("http://127.0.0.1:5201");
  await page.getByRole("heading", { name: "Import de données." }).waitFor();
  await page.getByLabel("Fichier CSV", { exact: true }).setInputFiles(file);
  await page
    .getByRole("button", { name: "Vérifier les opérations", exact: true })
    .click();
  const decisions = page.getByRole("combobox", {
    name: /Décision pour le solde/,
  });
  check(
    "Private CSV exposes three explicit reconstructed-anchor decisions",
    (await decisions.count()) === 3,
  );
  for (let i = 0; i < (await decisions.count()); i++) {
    await decisions.nth(i).click();
    await page
      .getByRole("option", {
        name: "Utiliser comme ancrage reconstruit (à vérifier)",
        exact: true,
      })
      .click();
  }
  await page
    .getByRole("button", { name: "Importer 1508 opérations", exact: true })
    .click();
  await page.waitForFunction(async () => {
    const { db } = await import("/src/store.ts");
    return (await db.transactions.count()) === 1508;
  });
  const control = await page.evaluate(async (source) => {
    const { db } = await import("/src/store.ts");
    const { parseCSV, detectMapping, previewImport } = await import(
      "/src/importer.ts"
    );
    const s = await db.snapshot(),
      parsed = parseCSV(source),
      expected = previewImport(parsed, detectMapping(parsed.fields), "", []);
    const totals = (rows) => rows.reduce((sum, t) => sum + t.amount, 0);
    const rowsKey = (rows) =>
      JSON.stringify(
        rows
          .map((t) => [t.account, t.date, t.amount, t.label])
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      );
    return {
      rows: s.transactions.length,
      accounts: s.accounts.length,
      batches: s.batches.length,
      allDerived: s.accounts.every((a) => a.checkpoint?.status === "derived"),
      totalsConserved:
        totals(s.transactions) === totals(expected.map((c) => c.transaction)),
      rowsConserved:
        rowsKey(s.transactions) === rowsKey(expected.map((c) => c.transaction)),
      datesConserved:
        s.transactions
          .map((t) => t.date)
          .sort()
          .join("|") ===
        expected
          .map((c) => c.transaction.date)
          .sort()
          .join("|"),
      completeFalse: s.accounts.every(
        (a) => !a.coverage?.some((c) => c.complete),
      ),
    };
  }, bytes.toString("utf8"));
  check(
    "Private import preserves every row, account, date and signed centime",
    control.rows === 1508 &&
      control.accounts === 3 &&
      control.batches === 1 &&
      control.rowsConserved &&
      control.totalsConserved &&
      control.datesConserved,
    control,
  );
  check(
    "Reconstructed CSV balances are not promoted to observed or complete coverage",
    control.allDerived && control.completeFalse,
  );
  await page
    .getByRole("button", {
      name: "Enregistrer mon plan et voir le dashboard",
      exact: true,
    })
    .click();
  await page
    .locator(".chart-card")
    .first()
    .getByRole("heading", { name: "Évolution du solde" })
    .waitFor();
  check(
    "Private import completes planning and shows actual dashboard",
    page.url().endsWith("#dashboard") &&
      (await page.locator(".chart-card .chart-wrap svg").count()) > 0,
  );
  await page.reload();
  await page
    .locator(".chart-card")
    .first()
    .getByRole("heading", { name: "Évolution du solde" })
    .waitFor();
  check(
    "Private import survives browser reload without data loss",
    await page.evaluate(async () => {
      const { db } = await import("/src/store.ts");
      return (
        (await db.transactions.count()) === 1508 &&
        (await db.preferences.get("main")).setupDone === true
      );
    }),
  );
  await page.goto("http://127.0.0.1:5201/#import");
  await page.getByLabel("Fichier CSV", { exact: true }).setInputFiles(file);
  await page
    .getByRole("button", { name: "Vérifier les opérations", exact: true })
    .click();
  await page
    .getByText(/Ce fichier exact figure déjà dans les imports/)
    .waitFor();
  check(
    "Exact private CSV reimport is blocked and cannot double balances",
    (await page
      .getByRole("button", { name: /Importer \d+ opérations/ })
      .isDisabled()) &&
      (await page.evaluate(async () => {
        const { db } = await import("/src/store.ts");
        return (
          (await db.transactions.count()) === 1508 &&
          (await db.batches.count()) === 1
        );
      })),
  );
  check(
    "Original private source remains byte-identical",
    before ===
      createHash("sha256")
        .update(await readFile(file))
        .digest("hex"),
  );
} catch (error) {
  errors.push(
    "Private workflow stopped: " + error.name + " (content withheld)",
  );
}
await privateContext.close();
const context = await browser.newContext({
  viewport: { width: 1512, height: 982 },
  locale: "fr-FR",
  recordVideo: { dir: out, size: { width: 1512, height: 982 } },
});
try {
  const a = await context.newPage(),
    b = await context.newPage();
  for (const page of [a, b]) {
    page.on("pageerror", (e) => errors.push("Synthetic runtime: " + e.message));
    await page.clock.setFixedTime(new Date("2026-10-05T12:00:00Z"));
  }
  await a.goto("http://127.0.0.1:5201");
  await a.evaluate(async () => {
    const { db } = await import("/src/store.ts"),
      { defaultPreferences } = await import("/src/types.ts");
    await db.accounts.put({
      id: "Compte synthétique",
      checkpoint: { date: "2026-10-05", amount: 200000 },
    });
    await db.transactions.put({
      id: "fixture",
      fingerprint: "fixture",
      batchId: "fixture",
      date: "2026-10-02",
      amount: -1000,
      merchant: "Exemple",
      label: "Exemple",
      account: "Compte synthétique",
      category: "Courses",
      internal: false,
      raw: {},
    });
    await db.preferences.put({
      ...defaultPreferences,
      setupDone: true,
      widgets: ["goal", "chart"],
      sizes: { goal: "medium", chart: "medium" },
      goal: { name: "Projet initial", target: 100000, saved: 10000 },
    });
  });
  await Promise.all([
    a.goto("http://127.0.0.1:5201/#dashboard"),
    b.goto("http://127.0.0.1:5201/#dashboard"),
  ]);
  for (const page of [a, b])
    await page
      .getByRole("button", { name: "Modifier l’objectif", exact: true })
      .click();
  await a
    .getByLabel("Nom du projet 1", { exact: true })
    .fill("Projet sauvegardé A");
  await b
    .getByLabel("Nom du projet 1", { exact: true })
    .fill("Brouillon non écrasé B");
  await a
    .getByRole("button", { name: "Enregistrer les objectifs", exact: true })
    .click();
  await a.waitForFunction(async () => {
    const { db } = await import("/src/store.ts");
    return (
      (await db.preferences.get("main")).goal.name === "Projet sauvegardé A"
    );
  });
  await b
    .getByRole("button", { name: "Enregistrer les objectifs", exact: true })
    .click();
  await b
    .getByRole("alert")
    .filter({ hasText: /objectifs ont changé ailleurs/ })
    .waitFor();
  check(
    "Two real tabs reject stale edits of the same financial field",
    await b.evaluate(async () => {
      const { db } = await import("/src/store.ts");
      return (
        (await db.preferences.get("main")).goal.name === "Projet sauvegardé A"
      );
    }),
  );
  check(
    "Rejected tab keeps its unsaved draft visible",
    (await b.getByLabel("Nom du projet 1", { exact: true }).inputValue()) ===
      "Brouillon non écrasé B",
  );
  await b.screenshot({
    path: path.join(out, "synthetic-conflict.png"),
    fullPage: true,
  });
  await b.getByRole("button", { name: "Fermer", exact: true }).click();
  await a
    .getByRole("button", { name: "Modifier l’objectif", exact: true })
    .click();
  await a
    .getByLabel("Nom du projet 1", { exact: true })
    .fill("Projet sauvegardé C");
  await b
    .locator(".chart-card")
    .getByRole("button", { name: "Surface", exact: true })
    .click();
  await b.waitForFunction(async () => {
    const { db } = await import("/src/store.ts");
    const p = await db.preferences.get("main");
    return (
      p.board?.views.some((v) =>
        v.instances.some(
          (i) => i.type === "chart" && i.representation === "area",
        ),
      ) || p.widgetViews?.chart === "area"
    );
  });
  await a
    .getByRole("button", { name: "Enregistrer les objectifs", exact: true })
    .click();
  await a.waitForFunction(async () => {
    const { db } = await import("/src/store.ts");
    return (
      (await db.preferences.get("main")).goal.name === "Projet sauvegardé C"
    );
  });
  const both = await a.evaluate(async () => {
    const { db } = await import("/src/store.ts");
    const p = await db.preferences.get("main");
    return (
      p.goal.name === "Projet sauvegardé C" &&
      (p.board?.views.some((v) =>
        v.instances.some(
          (i) => i.type === "chart" && i.representation === "area",
        ),
      ) ||
        p.widgetViews?.chart === "area")
    );
  });
  check(
    "Two real tabs save unrelated cards without overwriting either change",
    both,
  );
  await b.reload();
  await b
    .locator(".chart-card")
    .getByRole("button", { name: "Surface", exact: true })
    .waitFor();
  check(
    "Merged cross-tab settings survive reload",
    (await b
      .locator(".chart-card")
      .getByRole("button", { name: "Surface", exact: true })
      .getAttribute("aria-pressed")) === "true" &&
      (await b.getByText("Projet sauvegardé C", { exact: true }).count()) > 0,
  );
  await b.screenshot({
    path: path.join(out, "synthetic-merged.png"),
    fullPage: true,
  });
} catch (error) {
  errors.push("Synthetic workflow stopped: " + error.message);
}
await context.close();
await browser.close();
await writeFile(
  path.join(out, "results.json"),
  JSON.stringify(
    {
      checks,
      errors,
      privacy:
        "No private screenshots, video, labels, account identifiers, totals or source payload were saved; external network blocked during private import.",
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ checks, errors }, null, 2));
if (errors.length || checks.some((c) => !c.pass)) process.exitCode = 1;
