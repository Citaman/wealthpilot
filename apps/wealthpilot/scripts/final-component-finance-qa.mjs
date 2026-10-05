// Four financial questions in the built app. Synthetic isolated profiles only.
// Vite is used only to construct schema-valid seed data; the acceptance page is production.
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const seedUrl = process.env.SEED_URL || "http://127.0.0.1:5201";
const base = process.env.AUDIT_URL || "http://127.0.0.1:5203";
const out = path.resolve("../../tmp/final-component-finance-qa");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const checks = [],
  errors = [];
const report = {
  fixtureDate: "2026-10-05",
  target: base,
  productionIndexSha256: createHash("sha256")
    .update(await readFile("dist/index.html"))
    .digest("hex"),
  checks,
  errors,
};
function check(question, pass, facts) {
  checks.push({ question, pass, facts });
  if (!pass) throw new Error(question);
}
try {
  const seedContext = await browser.newContext();
  const seed = await seedContext.newPage();
  await seed.clock.setFixedTime(new Date("2026-10-05T12:00:00Z"));
  await seed.goto(seedUrl);
  await seed.evaluate(async () => {
    const { db } = await import("/src/store.ts");
    const { defaultPreferences } = await import("/src/types.ts");
    const { makeInstance, migrateBoard, initialLayout } = await import(
      "/src/layout.ts"
    );
    const types = [
      "goals",
      "savings",
      "effort",
      "charges",
      "pace",
      "available",
    ];
    const instances = types.map((type) => ({
      ...makeInstance(type, "qa-" + type),
      size: "medium",
      source:
        type === "pace"
          ? { kind: "global" }
          : { kind: "account", account: "A" },
    }));
    const board = migrateBoard({ ...defaultPreferences, widgets: [] });
    board.views = [
      {
        id: "audit",
        name: "Questions financières",
        instances,
        mobileOrder: instances.map((i) => i.id),
        layouts: Object.fromEntries(
          ["laptop", "desktop", "wide"].map((bp) => [
            bp,
            initialLayout(instances, bp),
          ]),
        ),
      },
    ];
    board.activeView = "audit";
    await db.accounts.bulkPut([
      { id: "A", checkpoint: { date: "2026-10-05", amount: 200000 } },
      { id: "B", checkpoint: { date: "2026-10-05", amount: 300000 } },
    ]);
    const tx = (id, date, amount, merchant) => ({
      id,
      date,
      amount,
      merchant,
      label: merchant,
      category: "Courses",
      account: "A",
      internal: false,
      raw: {},
      fingerprint: id,
      batchId: "synthetic",
    });
    await db.transactions.bulkPut([
      tx("paid", "2026-10-02", -1000, "Dépense réalisée"),
      tx("future", "2026-10-20", -9000, "Sortie future connue"),
      tx("november", "2026-11-20", -30000, "Novembre prévu"),
    ]);
    await db.preferences.put({
      ...defaultPreferences,
      setupDone: true,
      board,
      goal: {
        name: "Projet A",
        account: "A",
        target: 100000,
        saved: 20000,
        monthly: 10000,
      },
      extraGoals: [
        {
          name: "Projet B",
          account: "B",
          target: 200000,
          saved: 90000,
          monthly: 40000,
        },
      ],
      recurrenceRules: [
        {
          id: "same-payment",
          name: "Sortie future connue",
          account: "A",
          amount: -9000,
          category: "Courses",
          frequency: "monthly",
          next: "2026-10-20",
        },
      ],
    });
    localStorage.setItem("wealthpilot-next-month", "2026-10");
  });
  const storage = await seedContext.storageState({ indexedDB: true });
  await seedContext.close();
  storage.origins = storage.origins.map((origin) => ({
    ...origin,
    origin: new URL(base).origin,
  }));
  const context = await browser.newContext({
    storageState: storage,
    viewport: { width: 1512, height: 982 },
    locale: "fr-FR",
    recordVideo: { dir: out, size: { width: 1512, height: 982 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00Z"));
  await page.goto(base + "/#dashboard");
  await page.locator('[data-instance="qa-goals"]').waitFor();
  const card = (type) => page.locator(`[data-instance="qa-${type}"]`);
  const text = async (type) =>
    (await card(type).innerText()).replace(/[\s\u202f\u00a0]+/g, " ");
  await page.getByRole("combobox", { name: "Compte affiché" }).click();
  await page.getByRole("option", { name: "B", exact: true }).click();
  const goal = await text("goals"),
    savings = await text("savings"),
    effort = await text("effort");
  check(
    "Les projets et efforts fixés au compte A restent-ils isolés malgré le filtre global B ?",
    [goal, savings, effort].every(
      (t) => t.includes("Projet A") && !t.includes("Projet B"),
    ) &&
      savings.includes("200 €") &&
      effort.includes("100 €"),
    { goal, savings, effort },
  );
  const charges = await text("charges");
  check(
    "La sortie importée future est-elle engagée une fois, sans dupliquer sa règle récurrente ?",
    charges.includes("90 €") &&
      !charges.includes("180 €") &&
      charges.includes("Importée à date future"),
    { charges },
  );
  const available = await text("available");
  check(
    "Le disponible est-il celui du foyer, sans prétendre affecter toutes ses réserves à A ou B ?",
    available.includes("3 810 €") && available.includes("Tout le foyer"),
    { available },
  );
  await page.screenshot({
    path: path.join(out, "scopes-and-commitments.png"),
    fullPage: true,
  });
  await page.getByRole("combobox", { name: "Mois affiché" }).click();
  await page
    .getByRole("option", { name: "novembre 2026", exact: true })
    .click();
  const pace = await text("pace");
  check(
    "Le rythme refuse-t-il de présenter un mois futur comme déjà observé ?",
    pace.includes("Pas encore observé") &&
      pace.includes("0 jours") &&
      !pace.includes("300 € / jour"),
    { pace },
  );
  await page.screenshot({
    path: path.join(out, "future-month.png"),
    fullPage: true,
  });
  await context.close();
} catch (error) {
  errors.push(error.message);
} finally {
  await browser.close();
  await writeFile(
    path.join(out, "results.json"),
    JSON.stringify(report, null, 2),
  );
}
console.log(JSON.stringify(report, null, 2));
if (checks.length !== 4 || errors.length || checks.some((c) => !c.pass))
  process.exitCode = 1;
