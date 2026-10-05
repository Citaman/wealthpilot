// Independent user journeys. Synthetic data in isolated storage, never user5173.
import {
  chromium,
  webkit,
} from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const url = process.env.QA_URL || "http://127.0.0.1:5201";
const engine = process.env.QA_ENGINE === "webkit" ? "webkit" : "chromium";
const out = path.resolve(
  `../../tmp/component-contract-audit${url.endsWith("5203") ? "-production" : ""}${engine === "webkit" ? "-webkit" : ""}`,
);
await mkdir(out, { recursive: true });
const browser = await { chromium, webkit }[engine].launch({ headless: true });
let context = await browser.newContext({
    viewport: { width: 1512, height: 982 },
    locale: "fr-FR",
    recordVideo: { dir: out },
  }),
  page = await context.newPage();
const findings = [];
const navigationLog = [];
function recordNavigation() {
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame())
      navigationLog.push({ url: frame.url(), at: Date.now() });
  });
  page.on("console", (message) => {
    if (message.text().includes("vite"))
      navigationLog.push({ console: message.text(), at: Date.now() });
  });
}
recordNavigation();
let databaseName;
async function readPreferences() {
  return page.evaluate(
    (name) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result,
            read = database
              .transaction("preferences")
              .objectStore("preferences")
              .get("main");
          read.onsuccess = () => {
            resolve(read.result);
            database.close();
          };
          read.onerror = () => reject(read.error);
        };
      }),
    databaseName,
  );
}
async function evidence(name, detail) {
  findings.push({ name, detail });
  await page.screenshot({
    path: path.join(out, name + ".png"),
    fullPage: false,
  });
}
try {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00Z"));
  await page.goto("http://127.0.0.1:5201");
  databaseName = await page.evaluate(async () => {
    const { db } = await import("/src/store.ts"),
      { defaultPreferences } = await import("/src/types.ts"),
      { migrateBoard, makeInstance, initialLayout } = await import(
        "/src/layout.ts"
      );
    const types = [
      "transactions",
      "budgets",
      "goals",
      "savings",
      "weekly",
      "dues",
      "recurring",
      "uncategorized",
      "unusual",
    ];
    const instances = types.map((type) => ({
      ...makeInstance(type, type),
      size: "medium",
      source: { kind: "account", account: "A" },
      period: { kind: "months", months: 3 },
    }));
    const board = migrateBoard({ ...defaultPreferences, widgets: [] });
    board.views[0] = {
      ...board.views[0],
      instances,
      mobileOrder: types,
      layouts: Object.fromEntries(
        ["laptop", "desktop", "wide"].map((bp) => [
          bp,
          initialLayout(instances, bp),
        ]),
      ),
    };
    await db.accounts.bulkPut(
      ["A", "B"].map((id) => ({
        id,
        checkpoint: { date: "2026-10-05", amount: 300000 },
      })),
    );
    await db.transactions.bulkPut(
      [
        ["a-aug", "A", "2026-08-14", "A août", -3000],
        ["a-oct", "A", "2026-10-02", "A octobre", -5000],
        ["b-oct", "B", "2026-10-03", "B confidentiel", -7000],
      ].map(([id, account, date, merchant, amount]) => ({
        id,
        account,
        date,
        merchant,
        amount,
        label: merchant,
        category: "Courses",
        raw: {},
        internal: false,
        fingerprint: id,
        batchId: "qa",
      })),
    );
    await db.budgets.put({
      id: "ba",
      month: "2026-10",
      account: "A",
      category: "Courses",
      amount: 40000,
    });
    await db.dues.bulkPut([
      {
        id: "da",
        account: "A",
        date: "2026-10-12",
        label: "Assurance A",
        amount: -1000,
      },
      {
        id: "db",
        account: "B",
        date: "2026-10-13",
        label: "Énergie B",
        amount: -2000,
      },
    ]);
    await db.preferences.put({
      ...defaultPreferences,
      setupDone: true,
      board,
      goal: {
        name: "Projet A",
        account: "A",
        target: 100000,
        saved: 10000,
        monthly: 1000,
      },
      extraGoals: [
        {
          name: "Projet B",
          account: "B",
          target: 200000,
          saved: 20000,
          monthly: 2000,
        },
      ],
    });
    localStorage.setItem("wealthpilot-next-month", "2026-10");
    localStorage.setItem("wealthpilot-period", "1");
    return db.name;
  });
  if (!url.endsWith("5201")) {
    const storage = await context.storageState({ indexedDB: true });
    await context.close();
    storage.origins = storage.origins.map((origin) => ({
      ...origin,
      origin: url,
    }));
    context = await browser.newContext({
      storageState: storage,
      viewport: { width: 1512, height: 982 },
      locale: "fr-FR",
      recordVideo: { dir: out },
    });
    page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-05T12:00:00Z"));
    recordNavigation();
  }
  await page.goto(url + "/#dashboard");
  const card = (id) => page.locator(`[data-instance="${id}"]`);
  await card("transactions").waitFor();
  const sourceBefore = await card("transactions").innerText();
  await card("transactions")
    .getByRole("button", { name: /A août/ })
    .click();
  await page.locator(".ledger-surface").waitFor();
  await page.locator(".ledger-entry.expanded").waitFor();
  await evidence("01-transaction-drilldown", {
    sourceBefore,
    after: await page.locator(".ledger-surface").innerText(),
    expanded: await page.locator(".ledger-entry.expanded").count(),
    pass:
      (await page
        .locator(".ledger-entry.expanded")
        .innerText()
        .then((t) => t.includes("A août"))) &&
      !(await page
        .locator(".ledger-surface")
        .innerText()
        .then((t) => t.includes("B confidentiel"))),
  });
  await page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("button", { name: "Dashboard", exact: true })
    .click();
  await card("goals").scrollIntoViewIfNeeded();
  await evidence("02-goal-source", {
    goals: await card("goals").innerText(),
    savings: await card("savings").innerText(),
    pass:
      !(await card("goals").innerText()).includes("Projet B") &&
      !(await card("savings").innerText()).includes("Projet B"),
  });
  await card("dues")
    .getByRole("button", { name: /Assurance A/ })
    .click();
  await page.getByLabel("Libellé de l’échéance").waitFor();
  await evidence("03-due-target", {
    route: new URL(page.url()).hash,
    value: await page.getByLabel("Libellé de l’échéance").inputValue(),
    pass:
      (await page.getByLabel("Libellé de l’échéance").inputValue()) ===
      "Assurance A",
  });
  await page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("button", { name: "Dashboard", exact: true })
    .click();
  await card("uncategorized")
    .getByRole("button", { name: "Ouvrir les transactions" })
    .click();
  await page.locator(".ledger-surface").waitFor();
  await evidence("04-uncategorized-target", {
    content: await page.locator(".ledger-surface").innerText(),
    pass: (await page.locator(".ledger-entry").count()) === 0,
  });
  await page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("button", { name: "Dashboard", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Organiser mon dashboard", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ajouter une carte", exact: true })
    .click();
  await page
    .getByRole("searchbox", { name: "Chercher une carte" })
    .fill("Revenus");
  await page
    .getByRole("button", { name: "Ajouter Revenus et dépenses", exact: true })
    .click();
  const added = page.locator('[data-widget="flows"]');
  async function choose(label, option) {
    await page.getByRole("combobox", { name: label, exact: true }).click();
    await page.getByRole("option", { name: option, exact: true }).click();
  }
  await choose("Source de cette carte", "B");
  await choose("Période de cette carte", "3 mois");
  await page
    .getByRole("button", { name: "Grand — Revenus et dépenses", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Fermer les réglages", exact: true })
    .click();
  await added
    .getByRole("button", { name: "Colonnes — flows", exact: true })
    .click();
  await page.getByRole("button", { name: "Terminer", exact: true }).click();
  await page
    .getByRole("button", { name: "Terminer", exact: true })
    .waitFor({ state: "hidden" });
  await page.reload();
  await page.locator('[data-widget="flows"]').waitFor();
  const saved = (await readPreferences()).board.views
    .flatMap((v) => v.instances)
    .find((i) => i.type === "flows");
  await added.scrollIntoViewIfNeeded();
  await evidence("05-catalog-config-persistence", {
    saved,
    content: await added.innerText(),
    pass:
      saved.source.account === "B" &&
      saved.period.months === 3 &&
      saved.size === "large" &&
      saved.representation === "columns" &&
      (await added.innerText()).includes("70"),
  });
} catch (error) {
  await evidence("error", {
    message: String(error),
    content: await page.locator("body").innerText(),
    preferences: await readPreferences(),
  });
  throw error;
} finally {
  await writeFile(
    path.join(out, "findings.json"),
    JSON.stringify(findings, null, 2),
  );
  await writeFile(
    path.join(out, "navigation.json"),
    JSON.stringify(navigationLog, null, 2),
  );
  await context.close();
  await browser.close();
  console.log(findings.map((f) => f.name));
}
