// Dedicated synthetic browser context. No private CSV or user profile.
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const out = path.resolve("../../tmp/chart-explanation-qa");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
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
try {
  await page.clock.setFixedTime(new Date("2026-10-04T12:00:00Z"));
  await page.goto("http://127.0.0.1:5201");
  await page.getByRole("heading", { name: "Import de données." }).waitFor();
  await page.evaluate(async () => {
    const { db } = await import("/src/store.ts"),
      { defaultPreferences } = await import("/src/types.ts");
    const rows = [];
    for (const m of ["06", "07", "08", "09"]) {
      for (const [day, amount, account, merchant] of [
        ["26", m === "08" ? 300000 : 200000, "Compte A", "Atelier Alpha"],
        ["28", 180000, "Compte B", "Studio Lune"],
        ["05", 40000, "Compte B", "Caisse allocations"],
        ["08", -90000, "Compte A", "Loyer"],
        ["12", -50000, "Compte B", "Équipement"],
        ["16", -1200, "Compte B", "Courses"],
      ]) {
        const id = merchant + m;
        rows.push({
          id,
          batchId: "qa",
          fingerprint: id,
          date: `2026-${m}-${day}`,
          amount,
          account,
          merchant,
          label: merchant,
          category: "À catégoriser",
          internal: false,
          raw: {},
        });
      }
    }
    await db.transactions.bulkPut(rows);
    await db.accounts.bulkPut(
      ["Compte A", "Compte B"].map((id) => ({
        id,
        checkpoint: { date: "2026-10-04", amount: 300000, status: "observed" },
        coverage: [
          {
            from: "2026-06-01",
            through: "2026-10-04",
            complete: true,
            batchId: "qa",
            sourceHash: "qa",
          },
        ],
      })),
    );
    await db.preferences.put({
      ...defaultPreferences,
      setupDone: true,
      widgets: ["chart"],
      sizes: { chart: "xlarge" },
      safety: 30000,
    });
    window.__chartQA = "same document";
  });
  await page.goto("http://127.0.0.1:5201/#dashboard");
  const chart = page.locator(".chart-card").first();
  await chart
    .getByRole("navigation", { name: "Repères de l’évolution du solde" })
    .waitFor();
  const rail = chart.getByRole("navigation", {
    name: "Repères de l’évolution du solde",
  });
  const financial = await page.evaluate(async () => {
    const { db } = await import("/src/store.ts");
    const { financialView } = await import("/src/financialView.ts");
    const snapshot = await db.snapshot();
    const calculate = (s, account = "") =>
      financialView(s, "2026-10", account, "2026-10", "2026-10-04");
    const household = calculate(snapshot),
      a = calculate(snapshot, "Compte A"),
      b = calculate(snapshot, "Compte B");
    const singleton = {
      ...snapshot,
      transactions: [
        ...snapshot.transactions,
        {
          ...snapshot.transactions[0],
          id: "single",
          fingerprint: "single",
          date: "2026-09-29",
          account: "Compte B",
          merchant: "Nouvel employeur",
          label: "Nouvel employeur",
          amount: 150000,
        },
      ],
    };
    const transferred = {
      ...snapshot,
      transactions: [
        ...snapshot.transactions,
        ...[-1, 1].map((sign) => ({
          ...snapshot.transactions[0],
          id: "internal" + sign,
          fingerprint: "internal" + sign,
          date: "2026-10-15",
          account: sign < 0 ? "Compte A" : "Compte B",
          merchant: "Virement interne",
          label: "Virement interne",
          amount: sign * 20000,
          internal: true,
        })),
      ],
    };
    return {
      cash: household.dashboard.balance,
      final: household.dashboard.points.at(-1).value,
      a: a.dashboard.points.at(-1).value,
      b: b.dashboard.points.at(-1).value,
      incomes: household.projected.dues
        .filter((d) => d.estimated && d.amount > 0)
        .map((d) => d.amount)
        .sort((a, b) => a - b),
      singletonInvented: calculate(singleton).projected.dues.some(
        (d) => d.label === "Nouvel employeur",
      ),
      transferHousehold: calculate(transferred).dashboard.points.at(-1).value,
      transferA: calculate(transferred, "Compte A").dashboard.points.at(-1)
        .value,
      transferB: calculate(transferred, "Compte B").dashboard.points.at(-1)
        .value,
    };
  });
  check(
    "Exact cash and three signed recurring incomes in browser",
    financial.cash === 600000 &&
      financial.final === 878800 &&
      JSON.stringify(financial.incomes) === "[40000,180000,200000]",
    financial,
  );
  check(
    "Household ending equals independent account endings",
    financial.a === 410000 &&
      financial.b === 468800 &&
      financial.a + financial.b === financial.final,
  );
  check(
    "New single payment never invents salary recurrence",
    !financial.singletonInvented,
  );
  check(
    "Internal future transfer neutral for household, effective per account",
    financial.transferHousehold === financial.final &&
      financial.transferA === financial.a - 20000 &&
      financial.transferB === financial.b + 20000,
  );
  for (const name of [
    "Atelier Alpha",
    "Studio Lune",
    "Caisse allocations",
    "Loyer",
    "Équipement",
  ])
    check(
      "Forecast includes " + name,
      (await rail.getByRole("button", { name: new RegExp(name) }).count()) > 0,
    );
  await rail
    .getByRole("button", { name: /Caisse allocations/ })
    .first()
    .click();
  check(
    "Aid selection opens inline explanation",
    (await chart
      .getByRole("region", { name: /Mouvements du/ })
      .getByText("Caisse allocations", { exact: true })
      .count()) === 1,
  );
  check(
    "No document reload after selection",
    await page.evaluate(() => window.__chartQA === "same document"),
  );
  await chart.screenshot({ path: path.join(out, "chart-1512-aid.png") });
  await page.getByRole("combobox", { name: "Période affichée" }).click();
  await page.getByRole("option", { name: "Trois mois", exact: true }).click();
  await chart
    .getByRole("navigation")
    .getByRole("button", { name: /Caisse allocations/ })
    .last()
    .waitFor();
  const metrics = await chart.evaluate((el) => ({
    width: el.clientWidth,
    railHeight: el.querySelector(".chart-event-rail").clientHeight,
    repères: el.querySelectorAll(".chart-event-rail button").length,
    labels: el.querySelectorAll("svg text").length,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  check(
    "Three-month repères stay one bounded row",
    metrics.railHeight < 170 && !metrics.overflow,
    metrics,
  );
  await chart.screenshot({
    path: path.join(out, "chart-1512-three-months.png"),
  });
  await page.getByRole("combobox", { name: "Compte affiché" }).click();
  await page.getByRole("option", { name: "Compte B", exact: true }).click();
  await page.waitForFunction(
    () =>
      !document
        .querySelector(".chart-card .chart-event-rail")
        ?.textContent.includes("Atelier Alpha"),
  );
  check(
    "Account B filters Alpha income and A rent",
    !(await rail.innerText()).includes("Atelier Alpha") &&
      !(await rail.innerText()).includes("Loyer"),
  );
  check(
    "Account B retains salary and aid",
    (await rail.innerText()).includes("Studio Lune") &&
      (await rail.innerText()).includes("Caisse allocations"),
  );
  await chart.getByRole("group", { name: /Explorer les journées/ }).focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  check(
    "Keyboard explores every day",
    (await chart.locator(".chart-caption").innerText()).includes("2 août"),
  );
  await chart.screenshot({ path: path.join(out, "chart-1512-account-b.png") });
  await page.setViewportSize({ width: 3840, height: 2160 });
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await chart.screenshot({ path: path.join(out, "chart-3840-account-b.png") });
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.evaluate(async () => {
    const { db } = await import("/src/store.ts");
    const { migrateBoard, resizeInstance } = await import("/src/layout.ts");
    const prefs = await db.preferences.get("main");
    const board = prefs.board ?? migrateBoard(prefs);
    const view = board.views[0];
    board.views[0] = resizeInstance(view, view.instances[0].id, "medium");
    await db.preferences.put({ ...prefs, board });
  });
  await page.waitForFunction(
    () => document.querySelector(".chart-card").clientWidth < 900,
  );
  await rail.getByRole("button").first().focus();
  const count = await rail.getByRole("button").count();
  for (let i = 1; i < count; i++) await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  const medium = await rail.evaluate((el) => {
    const button = document.activeElement,
      r = el.getBoundingClientRect(),
      b = button.getBoundingClientRect();
    return {
      width: el.clientWidth,
      scrollLeft: el.scrollLeft,
      focusedLast: button === el.lastElementChild,
      visible: b.left >= r.left - 1 && b.right <= r.right + 1,
      overflowX: getComputedStyle(el).overflowX,
    };
  });
  check(
    "Medium chart last marker reachable by Tab and visibly scrolled into rail",
    medium.focusedLast && medium.visible && medium.scrollLeft > 0,
    medium,
  );
  await chart.screenshot({
    path: path.join(out, "chart-1512-medium-last-marker.png"),
  });
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await chart
    .locator(".chart-summary small")
    .filter({ hasText: /Solde au 5 oct/ })
    .waitFor();
  check(
    "Same open dashboard refreshes its financial cutoff after midnight/focus",
    await chart
      .locator(".chart-summary")
      .innerText()
      .then((t) => /Solde au 5 oct/.test(t)),
  );
  await page.getByRole("combobox", { name: "Compte affiché" }).click();
  await page
    .getByRole("option", { name: "Tous les comptes", exact: true })
    .click();
  await page.evaluate(async () => {
    const { db } = await import("/src/store.ts");
    const account = await db.accounts.get("Compte B");
    await db.accounts.put({
      ...account,
      checkpoint: { ...account.checkpoint, amount: 310000 },
    });
    const prefs = await db.preferences.get("main");
    await db.preferences.put({ ...prefs, safety: 50000 });
  });
  await page.waitForFunction(() =>
    /6\s*100/.test(
      document.querySelector(".chart-card .chart-summary")?.textContent ?? "",
    ),
  );
  await page.waitForFunction(() =>
    /Réserve 500/.test(
      document.querySelector(".chart-card .chart-wrap svg")?.textContent ?? "",
    ),
  );
  check(
    "Real IndexedDB anchor and reserve edits invalidate the displayed cache without reload",
    await page.evaluate(() => window.__chartQA === "same document"),
  );
  await page.reload();
  await chart.getByRole("heading", { name: "Évolution du solde" }).waitFor();
  check(
    "Financial edits survive actual browser reload",
    await page.evaluate(async () => {
      const { db } = await import("/src/store.ts");
      return (
        (await db.accounts.get("Compte B")).checkpoint.amount === 310000 &&
        (await db.preferences.get("main")).safety === 50000
      );
    }),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await chart.evaluate((el) =>
    [...el.querySelectorAll("button,svg,path")].every((node) => {
      const style = getComputedStyle(node);
      return (
        style.transitionDuration.split(",").every((v) => parseFloat(v) === 0) &&
        style.animationName === "none"
      );
    }),
  );
  check(
    "Reduced motion actually disables transitions and animation in the rendered chart",
    reduced,
  );
  check("No browser exceptions", errors.length === 0, errors);
} catch (e) {
  errors.push(e.message);
  await page.screenshot({
    path: path.join(out, "failure.png"),
    fullPage: true,
  });
}
await context.close();
await browser.close();
await writeFile(
  path.join(out, "results.json"),
  JSON.stringify({ checks, errors }, null, 2),
);
console.log(JSON.stringify({ checks, errors }, null, 2));
if (errors.length || checks.some((c) => !c.pass)) process.exitCode = 1;
