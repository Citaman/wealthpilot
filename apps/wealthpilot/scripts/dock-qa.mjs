import {
  chromium,
  webkit,
} from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const engine = process.env.QA_ENGINE === "webkit" ? "webkit" : "chromium";
const out = path.resolve(
  `../../tmp/dock-qa${engine === "webkit" ? "-webkit" : ""}`,
);
await mkdir(out, { recursive: true });
const browser = await { chromium, webkit }[engine].launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1512, height: 982 },
  locale: "fr-FR",
  recordVideo: { dir: out, size: { width: 1512, height: 982 } },
});
const page = await context.newPage(),
  checks = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
function check(name, pass, detail) {
  checks.push({ name, pass, detail });
  if (!pass) throw new Error(name);
}
const nav = () =>
  page.getByRole("navigation", { name: "Navigation principale" });
const panel = () => page.getByRole("region", { name: "Toutes les pages" });
async function keyboardActivate(label) {
  const target = panel().getByRole("button", { name: label, exact: true });
  await page.waitForFunction(
    (el) => !el.disabled,
    await target.elementHandle(),
  );
  await target.focus();
  await target.press("Enter");
}
try {
  await page.goto("http://127.0.0.1:5201");
  await page.getByRole("heading", { name: "Import de données." }).waitFor();
  await page.evaluate(async () => {
    const { db } = await import("/src/store.ts");
    const { defaultPreferences } = await import("/src/types.ts");
    await db.accounts.put({
      id: "Commun",
      checkpoint: { date: "2026-10-05", amount: 420000 },
    });
    await db.transactions.put({
      id: "qa",
      batchId: "qa",
      date: "2026-10-01",
      amount: -2400,
      account: "Commun",
      label: "Courses",
      merchant: "Courses",
      category: "Courses",
      internal: false,
      raw: {},
      fingerprint: "qa",
    });
    await db.preferences.put({ ...defaultPreferences, setupDone: true });
  });
  await nav().getByRole("button", { name: "Dashboard", exact: true }).click();
  await page.locator(".free-board-container").waitFor();
  check(
    "Five defaults, Dashboard first, Plus visible",
    JSON.stringify(await nav().locator("button").allTextContents()) ===
      JSON.stringify([
        "Dashboard",
        "Ma semaine",
        "Transactions",
        "Import CSV",
        "Objectifs",
        "Plus",
      ]),
  );
  for (const width of [1512, 3840, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 982 });
    await nav().getByRole("button", { name: "Plus", exact: true }).click();
    check(
      `All sixteen pages, icon and no horizontal overflow at ${width}`,
      (await panel().locator(".wp-dock-catalog-item").count()) === 16 &&
        (await panel()
          .locator(".wp-dock-catalog-item > :first-child > svg:first-child")
          .count()) === 16 &&
        (await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        )),
    );
    const box = await panel().boundingBox();
    check(
      `Panel on screen ${width}`,
      box.x >= 0 && box.y >= 0 && box.x + box.width <= width,
    );
    await page.screenshot({
      path: path.join(out, `pages-${width}.png`),
      fullPage: false,
    });
    await page.keyboard.press("Escape");
    check(
      `Escape restores Plus focus ${width}`,
      await nav()
        .getByRole("button", { name: "Plus", exact: true })
        .evaluate((el) => el === document.activeElement),
    );
  }
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.keyboard.press("Enter");
  await panel().getByRole("button", { name: "Personnaliser" }).click();
  check(
    "Five maximum is enforced",
    await panel()
      .getByRole("button", { name: "Épingler Budgets", exact: true })
      .isDisabled(),
  );
  await keyboardActivate("Retirer Import CSV");
  await keyboardActivate("Épingler Budgets");
  await keyboardActivate("Déplacer Budgets avant");
  await page.waitForFunction(() =>
    document
      .querySelector(".wp-dock-order")
      ?.textContent.includes("4. Budgets"),
  );
  await page.screenshot({ path: path.join(out, "customize.png") });
  await page.reload();
  await nav().getByRole("button", { name: "Budgets", exact: true }).waitFor();
  check(
    "Keyboard pin/unpin/order survive reload",
    JSON.stringify(await nav().locator("button").allTextContents()) ===
      JSON.stringify([
        "Dashboard",
        "Ma semaine",
        "Transactions",
        "Budgets",
        "Objectifs",
        "Plus",
      ]),
  );
  const routes = {
    week: "Ma semaine",
    transactions: "Transactions",
    budgets: "Budgets",
    previsions: "Prévisions",
    goals: "Objectifs",
    accounts: "Comptes",
    analytics: "Analyse",
    foyer: "Foyer et partage",
    recurrents: "Récurrents",
    calendar: "Calendrier",
    categories: "Catégories et règles",
    library: "Bibliothèque",
    import: "Import CSV",
    data: "Données",
    dashboard: "Dashboard",
  };
  for (const [route, label] of Object.entries(routes)) {
    await nav().getByRole("button", { name: "Plus", exact: true }).click();
    await keyboardActivate(label);
    await page.waitForFunction(
      (expected) =>
        location.hash === `#${expected}` &&
        [...document.querySelectorAll("main")].some((el) =>
          el.checkVisibility(),
        ),
      route,
    );
    check(
      `Keyboard navigation ${route} opens the page without overlay`,
      new URL(page.url()).hash === `#${route}` && (await panel().count()) === 0,
    );
    await page.waitForFunction(
      (route) =>
        document.activeElement?.tagName === "H1" ||
        (route === "library" &&
          document.activeElement?.getAttribute("aria-label") ===
            "Chercher une carte"),
      route,
    );
    check(
      `Navigation ${route} focuses the visible heading or library search`,
      await page.evaluate(() => document.activeElement.checkVisibility()),
    );
  }
  check("No runtime errors", errors.length === 0, errors);
} finally {
  await writeFile(
    path.join(out, "results.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
  await context.close();
  await browser.close();
  console.log(JSON.stringify(checks, null, 2));
}
