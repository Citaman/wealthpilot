// Fictional household only, fresh profile, no access to user's localhost:5173.
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const out = path.resolve("../../tmp/cycle-integration-qa");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1512, height: 982 },
  locale: "fr-FR",
  recordVideo: { dir: out },
});
const page = await context.newPage();
page.setDefaultTimeout(7000);
const checks = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const check = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  console.log(JSON.stringify(checks.at(-1)));
};
const select = async (label, name) => {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name, exact: true }).click();
};
const route = (label) =>
  page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("button", { name: label, exact: true })
    .click();
const table = () => page.getByRole("table", { name: "Valeurs du graphique" });
try {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00Z"));
  await page.goto("http://127.0.0.1:5201");
  await page.evaluate(async () => {
    const { db } = await import("/src/store.ts"),
      { defaultPreferences } = await import("/src/types.ts"),
      { migrateBoard, makeInstance, initialLayout } = await import(
        "/src/layout.ts"
      );
    const types = ["chart", "transactions", "flows"];
    const instances = types.map((type) => ({
      ...makeInstance(type, type),
      size: "large",
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
    await db.preferences.put({
      ...defaultPreferences,
      setupDone: true,
      cycleStartDay: 1,
      board,
    });
    await db.accounts.put({
      id: "Commun",
      checkpoint: { date: "2026-08-20", amount: 10000 },
    });
    await db.transactions.bulkPut(
      [
        ["old-pay", "2026-08-26", "Salaire août", 250000, "Revenus"],
        ["old-rent", "2026-09-01", "Loyer septembre", -80000, "Logement"],
        ["excluded", "2026-09-25", "Ancien cycle", -1500, "Courses"],
        ["pay", "2026-09-26", "Salaire septembre", 250000, "Revenus"],
        ["rent", "2026-10-01", "Loyer octobre", -80000, "Logement"],
        ["food", "2026-10-04", "Courses octobre", -10000, "Courses"],
        ["future", "2026-10-10", "Opération future octobre", -5000, "Courses"],
        [
          "november",
          "2026-11-10",
          "Opération future novembre",
          -1000,
          "Courses",
        ],
      ].map(([id, date, merchant, amount, category]) => ({
        id,
        account: "Commun",
        date,
        merchant,
        label: merchant,
        amount,
        category,
        internal: false,
        raw: {},
        fingerprint: id,
        batchId: "synthetic",
      })),
    );
    localStorage.removeItem("wealthpilot-period");
    localStorage.setItem("wealthpilot-next-month", "2026-10");
  });
  await page.goto("http://127.0.0.1:5201/#dashboard");
  await page
    .getByRole("combobox", { name: "Mois budgétaire affiché" })
    .waitFor();
  check(
    "Default is current cycle, not historical/all-time preset",
    (
      await page.getByRole("combobox", { name: "Période affichée" }).innerText()
    ).includes("Mois en cours"),
  );
  check(
    "No manual payday control remains",
    (await page
      .getByRole("combobox", { name: "Début du cycle budgétaire" })
      .count()) === 0,
  );
  await page.getByText("Salaire septembre", { exact: true }).first().waitFor();
  const tx = page.locator('[data-widget="transactions"]');
  const dashboardText = await tx.innerText();
  check(
    "Dashboard groups Sep26 salary and Oct1 rent in same current cycle",
    dashboardText.includes("Salaire septembre") &&
      dashboardText.includes("Loyer octobre") &&
      !dashboardText.includes("Ancien cycle") &&
      !dashboardText.includes("Opération future"),
    dashboardText,
  );
  await page
    .getByRole("button", { name: "Afficher les valeurs du graphique" })
    .click();
  await table().waitFor();
  const dailyRows = await table().locator("tbody tr").allTextContents();
  check(
    "Default graph has no forecast rows",
    dailyRows.length > 1 && !dailyRows.some((t) => t.includes("Prévision")),
    { rows: dailyRows.length, first: dailyRows[0], last: dailyRows.at(-1) },
  );
  const granularity = page.getByRole("group", {
    name: "Granularité du graphique",
  });
  await granularity
    .getByRole("button", { name: "Semaine", exact: true })
    .click();
  const weeklyRows = await table().locator("tbody tr").allTextContents();
  await granularity.getByRole("button", { name: "Mois", exact: true }).click();
  const monthlyRows = await table().locator("tbody tr").allTextContents();
  check(
    "Granularity changes actual rendered point count",
    weeklyRows.length < dailyRows.length &&
      monthlyRows.length <= weeklyRows.length,
    {
      day: dailyRows.length,
      week: weeklyRows.length,
      month: monthlyRows.length,
    },
  );
  await page
    .getByRole("button", { name: "Avec prévision", exact: true })
    .click();
  check(
    "Forecast must be explicitly enabled",
    (await table().innerText()).includes("Prévision partielle"),
  );
  await page.getByRole("button", { name: "Historique", exact: true }).click();
  check(
    "Turning forecast off removes all forecast rows",
    !(await table().innerText()).includes("Prévision partielle"),
  );
  await route("Transactions");
  const currentRows = await page.locator(".ledger-entry").allTextContents();
  check(
    "Transactions follows same cycle and excludes future imports",
    currentRows.length === 3 &&
      currentRows.some((t) => t.includes("Salaire septembre")) &&
      currentRows.some((t) => t.includes("Loyer octobre")) &&
      !currentRows.some((t) => /future|Ancien cycle/.test(t)),
    currentRows,
  );
  await page.getByRole("combobox", { name: "Mois budgétaire affiché" }).click();
  const options = await page.getByRole("option").allTextContents();
  check(
    "Historical period picker never offers future November cycle",
    options.every((text) => !text.includes("nov.")),
    options,
  );
  await page.keyboard.press("Escape");
  await select("Période affichée", "30 derniers jours");
  const thirtyRows = await page.locator(".ledger-entry").allTextContents();
  check(
    "30d preset uses exact rolling dates",
    thirtyRows.length === 4 &&
      thirtyRows.some((t) => t.includes("Ancien cycle")) &&
      !thirtyRows.some((t) => t.includes("Loyer septembre")),
    thirtyRows,
  );
  await select("Période affichée", "Tout l’historique");
  const allRows = await page.locator(".ledger-entry").allTextContents();
  check(
    "All history excludes future-dated imported operations",
    allRows.length === 6 && !allRows.some((t) => t.includes("future")),
    allRows,
  );
  for (const preset of ["Trois mois", "Six mois", "Un an"]) {
    await select("Période affichée", preset);
    const rows = await page.locator(".ledger-entry").allTextContents();
    check(
      `${preset} changes actual transaction range`,
      rows.length === 6 && !rows.some((t) => t.includes("future")),
      rows.length,
    );
  }
  await select("Période affichée", "Un mois");
  await select("Mois budgétaire affiché", "septembre 2026");
  const previousRows = await page.locator(".ledger-entry").allTextContents();
  check(
    "Previous cycle excludes following Sep26 paycheck",
    previousRows.length === 3 &&
      previousRows.some((t) => t.includes("Salaire août")) &&
      !previousRows.some((t) => t.includes("Salaire septembre")),
    previousRows,
  );
  await select("Période affichée", "Mois en cours");
  await page.reload();
  await page
    .getByRole("combobox", { name: "Mois budgétaire affiché" })
    .waitFor();
  check(
    "Automatic period persists after reload",
    (
      await page
        .getByRole("combobox", { name: "Mois budgétaire affiché" })
        .innerText()
    ).includes("octobre") &&
      (await page.locator(".ledger-entry").allTextContents()).length === 3,
  );
  await page.evaluate(() => {
    localStorage.setItem("wealthpilot-next-month", "2099-12");
    localStorage.setItem("wealthpilot-period", "1");
  });
  await page.reload();
  await page
    .getByRole("combobox", { name: "Mois budgétaire affiché" })
    .waitFor();
  check(
    "Stale future selection cannot reopen future historical periods",
    !(
      await page
        .getByRole("combobox", { name: "Mois budgétaire affiché" })
        .innerText()
    ).includes("2099") &&
      (await page.locator(".ledger-entry").allTextContents()).length === 3,
  );
  await select("Période affichée", "Période personnalisée");
  await select("Début de période", "septembre 2026");
  check(
    "Custom range includes both explicitly selected cycles",
    (await page.locator(".ledger-entry").allTextContents()).length === 6,
  );
  for (const [width, height] of [
    [390, 844],
    [820, 1180],
    [1512, 982],
    [3840, 2160],
  ]) {
    await page.setViewportSize({ width, height });
    for (const label of ["Dashboard", "Transactions"]) {
      await route(label);
      const geometry = await page.evaluate(() => {
        const dock = document.querySelector(".wp-dock").getBoundingClientRect();
        return {
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
          dock: {
            left: dock.left,
            right: dock.right,
            top: dock.top,
            bottom: dock.bottom,
          },
          controls: [...document.querySelectorAll(".wp-dock button")].map(
            (el) => ({
              label: el.textContent,
              right: el.getBoundingClientRect().right,
              left: el.getBoundingClientRect().left,
            }),
          ),
        };
      });
      check(
        `${label} custom cycle filters fit ${width}px`,
        geometry.scroll <= width + 1 &&
          geometry.dock.left >= -1 &&
          geometry.dock.right <= width + 1 &&
          geometry.controls.every((c) => c.left >= -1 && c.right <= width + 1),
        geometry,
      );
      if (geometry.scroll > width + 1) {
        const overflow = await page.evaluate(() =>
          [...document.querySelectorAll("main:not([hidden]) *")]
            .filter(
              (el) =>
                !el.closest("[hidden]") &&
                el.getBoundingClientRect().right > innerWidth + 1,
            )
            .slice(0, 18)
            .map((el) => ({
              tag: el.tagName,
              class: typeof el.className === "string" ? el.className : "svg",
              width: el.getBoundingClientRect().width,
              right: el.getBoundingClientRect().right,
              scroll: el.scrollWidth,
              client: el.clientWidth,
              text: el.textContent?.slice(0, 70),
            })),
        );
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        const stable = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          width: innerWidth,
        }));
        check(
          `${label} overflow after two animation frames ${width}px`,
          stable.scroll <= width + 1,
          { before: geometry.scroll, stable, overflow },
        );
      }
      await page.screenshot({
        path: path.join(out, `${label.toLowerCase()}-${width}.png`),
        animations: "disabled",
      });
    }
  }
  const resizeTrials = [];
  for (let trial = 0; trial < 6; trial++) {
    await page.setViewportSize({ width: 1512, height: 982 });
    await route("Dashboard");
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await route("Transactions");
    await page.setViewportSize({ width: 390, height: 844 });
    await route("Dashboard");
    resizeTrials.push(
      await page.evaluate(async () => {
        const frames = [];
        for (let frame = 0; frame < 5; frame++) {
          frames.push({
            frame,
            scroll: document.documentElement.scrollWidth,
            overflow: [...document.querySelectorAll("main *")]
              .filter(
                (el) =>
                  !el.closest("[hidden]") &&
                  el.getBoundingClientRect().right > innerWidth + 1,
              )
              .slice(0, 7)
              .map((el) => ({
                tag: el.tagName,
                class: typeof el.className === "string" ? el.className : "svg",
                right: el.getBoundingClientRect().right,
                width: el.getBoundingClientRect().width,
              })),
          });
          await new Promise(requestAnimationFrame);
        }
        return frames;
      }),
    );
  }
  check(
    "Hidden dashboard resized desktop to mobile has no first-frame horizontal overflow",
    resizeTrials.every((frames) => frames.every((f) => f.scroll <= 391)),
    resizeTrials,
  );
} catch (error) {
  checks.push({
    name: "Journey interrupted",
    pass: false,
    detail: String(error.stack),
  });
  await page
    .screenshot({ path: path.join(out, "failure.png") })
    .catch(() => {});
} finally {
  check("No uncaught runtime errors", errors.length === 0, errors);
  await writeFile(
    path.join(out, "report.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
  await context.close();
  await browser.close();
}
