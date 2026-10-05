// Synthetic, isolated storage. This never opens the user's localhost:5173 data.
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const url = process.env.QA_URL || "http://127.0.0.1:5203";
const out = path.resolve("../../tmp/four-page-navigation-qa");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const seedContext = await browser.newContext(),
  seed = await seedContext.newPage();
await seed.goto("http://127.0.0.1:5201");
const original = await seed.evaluate(async () => {
  const { db } = await import("/src/store.ts"),
    { defaultPreferences } = await import("/src/types.ts");
  await db.accounts.put({
    id: "Test",
    checkpoint: { date: "2026-10-05", amount: 100000 },
  });
  await db.transactions.put({
    id: "synthetic",
    account: "Test",
    date: "2026-10-02",
    amount: -1000,
    merchant: "Commerce test",
    label: "Commerce test",
    category: "Courses",
    raw: {},
    internal: false,
    fingerprint: "synthetic",
    batchId: "test",
  });
  await db.preferences.put({
    ...defaultPreferences,
    setupDone: true,
    dockPages: ["goals", "data", "references"],
    goal: {
      name: "Archive intacte",
      saved: 12000,
      target: 90000,
      account: "Test",
    },
  });
  localStorage.setItem("wealthpilot-next-month", "2026-10");
  return { name: db.name, preferences: await db.preferences.get("main") };
});
const state = await seedContext.storageState({ indexedDB: true });
await seedContext.close();
state.origins = state.origins.map((origin) => ({ ...origin, origin: url }));
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1512, height: 982 },
  locale: "fr-FR",
  recordVideo: { dir: out },
});
const page = await context.newPage(),
  checks = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const check = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  if (!pass) throw new Error(name);
};
try {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00Z"));
  await page.goto(url + "/#dashboard");
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  await nav.waitFor();
  check(
    "exactly four ordered destinations",
    JSON.stringify(await nav.getByRole("button").allTextContents()) ===
      JSON.stringify(["Dashboard", "Ma semaine", "Transactions", "Import CSV"]),
  );
  check(
    "no all-pages panel or upper route menu",
    (await page.getByRole("button", { name: "Plus", exact: true }).count()) ===
      0 &&
      (await page
        .getByRole("combobox", { name: "Page de l’application" })
        .count()) === 0,
  );
  const routes = [
    ["Dashboard", "dashboard"],
    ["Ma semaine", "week"],
    ["Transactions", "transactions"],
    ["Import CSV", "import"],
  ];
  for (const [label, route] of routes) {
    await nav.getByRole("button", { name: label, exact: true }).click();
    await page.waitForURL("**/#" + route);
    await nav
      .locator('button[aria-current="page"]')
      .filter({ hasText: label })
      .waitFor();
    const activeStyle = await nav
      .getByRole("button", { name: label, exact: true })
      .evaluate((el) => ({
        background: getComputedStyle(el).backgroundColor,
        color: getComputedStyle(el).color,
      }));
    check(
      "active dock item visibly highlighted " + route,
      activeStyle.background !== "rgba(0, 0, 0, 0)" &&
        activeStyle.color !== activeStyle.background,
      activeStyle,
    );
    check(
      "route " + route,
      (await nav
        .getByRole("button", { name: label, exact: true })
        .getAttribute("aria-current")) === "page",
    );
    await page.screenshot({ path: path.join(out, route + "-1512.png") });
  }
  await page
    .getByRole("button", { name: "Sauvegarder ou restaurer mes données" })
    .click();
  await page.getByRole("heading", { name: "Données et sauvegarde" }).waitFor();
  check(
    "backup accessible inside import",
    new URL(page.url()).hash === "#import",
  );
  for (const route of [
    "goals",
    "budgets",
    "accounts",
    "calendar",
    "recurrents",
    "categories",
    "previsions",
    "analytics",
    "foyer",
    "library",
    "data",
    "references",
  ]) {
    await page.goto(url + "/#" + route);
    await page
      .getByRole("heading", { name: "Cette page n’est plus proposée." })
      .waitFor();
    check(
      "legacy route blocked explicitly: " + route,
      new URL(page.url()).hash === "#" + route,
    );
  }
  await page.getByRole("button", { name: "Ouvrir le dashboard" }).click();
  await nav.getByRole("button", { name: "Dashboard", exact: true }).focus();
  await page.keyboard.press("Tab");
  check(
    "keyboard tab follows four-page order",
    await nav
      .getByRole("button", { name: "Ma semaine", exact: true })
      .evaluate((el) => el === document.activeElement),
  );
  await page.keyboard.press("Enter");
  await page.waitForURL("**/#week");
  check(
    "keyboard activation",
    (await nav
      .getByRole("button", { name: "Ma semaine", exact: true })
      .getAttribute("aria-current")) === "page",
  );
  for (const width of [3840, 390]) {
    await page.setViewportSize({ width, height: width === 3840 ? 2160 : 844 });
    await page.screenshot({ path: path.join(out, "dock-" + width + ".png") });
    const bounds = await nav.boundingBox();
    check(
      "dock inside viewport " + width,
      bounds.x >= 0 && bounds.x + bounds.width <= width,
    );
  }
  const saved = await page.evaluate(
    (name) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open(name);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const database = open.result,
            query = database
              .transaction("preferences")
              .objectStore("preferences")
              .get("main");
          query.onsuccess = () => {
            resolve(query.result);
            database.close();
          };
          query.onerror = () => reject(query.error);
        };
      }),
    original.name,
  );
  check(
    "historical preferences and goals are unchanged",
    JSON.stringify(saved) === JSON.stringify(original.preferences),
  );
  check("no browser runtime errors", errors.length === 0, errors);
} catch (error) {
  await page.screenshot({ path: path.join(out, "error.png") });
  checks.push({
    name: "diagnostic",
    detail: await page
      .locator(".wp-dock")
      .evaluate((el) => ({
        html: el.outerHTML,
        buttons: [...el.querySelectorAll("button")].map((b) => ({
          text: b.textContent,
          current: b.getAttribute("aria-current"),
          background: getComputedStyle(b).backgroundColor,
          color: getComputedStyle(b).color,
        })),
      })),
  });
  throw error;
} finally {
  await writeFile(
    path.join(out, "report.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
  await context.close();
  await browser.close();
  console.log(
    JSON.stringify(
      checks.map(({ name, pass }) => ({ name, pass })),
      null,
      2,
    ),
  );
}
