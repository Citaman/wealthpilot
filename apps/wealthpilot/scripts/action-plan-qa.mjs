// Isolated browser context and synthetic fixtures only; never touches the user's browser DB.
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const out = path.resolve("../../tmp/action-plan-qa");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1512, height: 982 },
  locale: "fr-FR",
  recordVideo: { dir: out, size: { width: 1512, height: 982 } },
});
const page = await context.newPage();
await page.clock.setFixedTime(new Date("2026-10-04T12:00:00Z"));
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
const check = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  if (!pass) console.error(name, detail);
};
try {
  await page.goto("http://127.0.0.1:5201");
  await page.getByRole("heading", { name: "Import de données." }).waitFor();
  check("empty storage routes to import", page.url().endsWith("#import"));
  const sg =
    "00012345678;01/09/2026;04/10/2026;2;02/10/2026;1000.00 EUR\n\nDate de l'opération;Libellé;Détail de l'écriture;Montant de l'opération;Devise\n02/10/2026;CARTE;CARTE REF A;-10,00;EUR\n02/10/2026;CARTE;CARTE REF B;-10,00;EUR";
  await page.getByLabel("Fichier CSV", { exact: true }).setInputFiles({
    name: "sg-synthetic.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(sg),
  });
  await page
    .getByRole("button", { name: "Vérifier les opérations", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Décision pour le solde Compte courant" })
    .click();
  await page
    .getByRole("option", { name: "Accepter cette observation bancaire" })
    .click();
  await page
    .getByRole("button", { name: "Importer 2 opérations", exact: true })
    .click();
  await page.waitForFunction(async () => {
    const { db } = await import("/src/store.ts");
    return (await db.transactions.count()) === 2;
  });
  const imported = await page.evaluate(async () => {
    const { db } = await import("/src/store.ts");
    return db.snapshot();
  });
  check(
    "SG import: distinct same-value purchases and dated observation",
    imported.transactions.length === 2 &&
      imported.accounts[0].checkpoint.amount === 100000 &&
      imported.accounts[0].checkpoint.date === "2026-10-02",
  );
  await page.goto("http://127.0.0.1:5201/#import");
  await page.getByLabel("Fichier CSV", { exact: true }).setInputFiles({
    name: "sg-conflict.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(sg.replace("1000.00 EUR", "1100.00 EUR")),
  });
  await page
    .getByRole("button", { name: "Vérifier les opérations", exact: true })
    .click();
  check(
    "checkpoint conflict preview shows both balances",
    (await page.getByText(/Actuellement.*1.*000/).count()) > 0,
  );
  await page
    .getByRole("combobox", { name: "Décision pour le solde Compte courant" })
    .click();
  await page
    .getByRole("option", { name: "Conserver mon ancrage actuel" })
    .click();
  await page
    .getByRole("checkbox", { name: /J’ai vérifié les doublons/ })
    .check();
  await page
    .getByRole("button", { name: "Importer 0 opérations", exact: true })
    .click();
  await page.waitForFunction(async () => {
    const { db } = await import("/src/store.ts");
    return (await db.batches.count()) === 2;
  });
  check(
    "metadata-only overlap retains observation and rows",
    await page.evaluate(async () => {
      const { db } = await import("/src/store.ts");
      return (
        (await db.transactions.count()) === 2 &&
        (await db.accounts.toArray())[0].checkpoint.amount === 100000
      );
    }),
  );
  await page.evaluate(async () => {
    const { db } = await import("/src/store.ts");
    await db.transaction("rw", db.tables, async () => {
      for (const table of db.tables) await table.clear();
    });
  });
  await page.evaluate(async () => {
    const { db } = await import("/src/store.ts");
    const { defaultPreferences } = await import("/src/types.ts");
    const categories = [
      "Courses",
      "Restauration rapide",
      "Carburant",
      "Shopping",
    ];
    const rows = Array.from({ length: 6000 }, (_, i) => ({
      id: `fixture-${i}`,
      batchId: "fixture",
      date: `2026-${String(4 + Math.floor(i / 1000)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`,
      amount: -(100 + (i % 2000)),
      account: ["A", "B", "Commun"][i % 3],
      merchant: ["McDonald's", "Amazon", "Free", "Kiabi"][i % 4],
      category: categories[i % 4],
      label: `Achat ${i}`,
      fingerprint: `fixture-${i}`,
      internal: false,
      raw: {},
    }));
    for (let m = 4; m <= 9; m++)
      rows.push({
        ...rows[0],
        id: `salary-${m}`,
        date: `2026-${String(m).padStart(2, "0")}-26`,
        amount: 250000,
        account: "A",
        merchant: "Salaire Société Exemple",
        category: "Salaire",
        label: "Paie",
        fingerprint: `salary-${m}`,
      });
    await db.transactions.bulkPut(rows);
    await db.accounts.bulkPut(
      ["A", "B", "Commun"].map((id, i) => ({
        id,
        checkpoint: {
          date: "2026-10-02",
          amount: 400000 + i * 100000,
          status: "observed",
        },
        coverage: [
          {
            from: "2026-04-01",
            through: "2026-10-02",
            complete: true,
            batchId: "fixture",
            sourceHash: "fixture",
          },
        ],
      })),
    );
    await db.preferences.put({
      ...defaultPreferences,
      setupDone: true,
      safety: 30000,
      widgets: [
        "chart",
        "available",
        "balance",
        "budgets",
        "weekly",
        "goal",
        "transactions",
      ],
      goal: {
        name: "Voyage en famille",
        target: 250000,
        saved: 40000,
        color: "#9b446f",
      },
      weeklyPlans: [
        {
          start: "2026-10-05",
          account: "",
          reduction: 10,
          reserve: 30000,
          limits: {
            Courses: 15000,
            "Restauration rapide": 5000,
            Carburant: 7000,
            Shopping: 3000,
          },
        },
      ],
    });
    await db.budgets.bulkPut(
      categories.map((category, i) => ({
        id: `budget-${i}`,
        month: "2026-10",
        category,
        amount: 30000,
      })),
    );
  });
  await page.goto("http://127.0.0.1:5201/#dashboard");
  await page
    .getByRole("button", { name: /Organiser/ })
    .first()
    .waitFor();
  await page.screenshot({
    path: path.join(out, "dashboard-1512.png"),
    fullPage: true,
  });
  for (const width of [390, 768, 2560, 3840]) {
    await page.setViewportSize({ width, height: width < 1000 ? 900 : 1400 });
    await page.waitForTimeout(350);
    const collisions = await page
      .locator("[data-instance]")
      .evaluateAll((els) => {
        const r = els.map((e) => ({
          id: e.dataset.instance,
          rect: e.getBoundingClientRect(),
        }));
        return r.flatMap((a, i) =>
          r
            .slice(i + 1)
            .filter(
              (b) =>
                a.rect.left < b.rect.right - 1 &&
                a.rect.right > b.rect.left + 1 &&
                a.rect.top < b.rect.bottom - 1 &&
                a.rect.bottom > b.rect.top + 1,
            )
            .map((b) => [a.id, b.id]),
        );
      });
    check(`no overlapping cards ${width}`, collisions.length === 0, collisions);
    await page.screenshot({
      path: path.join(out, `dashboard-${width}.png`),
      fullPage: true,
    });
    check(
      `no page overflow ${width}`,
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
  }
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.getByRole("button", { name: "Ma semaine", exact: true }).click();
  await page.getByRole("button", { name: "Prochaine", exact: true }).click();
  check(
    "next week dated 5–11 October",
    (await page.getByText(/5 oct. 2026 — 11 oct. 2026/).count()) > 0,
  );
  await page.screenshot({ path: path.join(out, "week.png"), fullPage: true });
  await page.getByRole("button", { name: "Transactions", exact: true }).click();
  await page.screenshot({
    path: path.join(out, "transactions.png"),
    fullPage: true,
  });
  check(
    "two pagination controls",
    (await page.getByRole("navigation", { name: /Pagination/ }).count()) === 2,
  );
  for (const [route, title] of Object.entries({
    budgets: "Chaque euro, sa place.",
    previsions: "La suite, sans surprise.",
    accounts: "Les comptes, au clair.",
    goals: "Les projets qui comptent.",
    analytics: "Comprendre mes dépenses.",
    foyer: "À chacun sa part.",
    recurrents: "Récurrents.",
    calendar: "Calendrier.",
    categories: "Catégories & règles.",
  })) {
    await page.evaluate((route) => {
      location.hash = route;
    }, route);
    await page.getByRole("heading", { name: title, exact: true }).waitFor();
    for (const width of [390, 1512, 3840]) {
      await page.setViewportSize({ width, height: 982 });
      await page.waitForTimeout(350);
      await page.screenshot({
        path: path.join(out, `${route}-${width}.png`),
        fullPage: true,
      });
      check(
        `${route} fits ${width}`,
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
    }
  }
  check("no unhandled runtime errors", errors.length === 0, errors);
} catch (e) {
  checks.push({ name: "browser flow", pass: false, detail: e.stack });
  await page
    .screenshot({ path: path.join(out, "failure.png"), fullPage: true })
    .catch(() => {});
}
await context.close();
await browser.close();
await writeFile(
  path.join(out, "results.json"),
  JSON.stringify({ checks, errors }, null, 2),
);
console.log(JSON.stringify({ output: out, checks, errors }, null, 2));
if (checks.some((c) => !c.pass)) process.exitCode = 1;
