// Real pointer/wheel regression tests in isolated storage, with mixed cards.
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const out = path.resolve("../../tmp/layout-regression-qa");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
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
  console.log(pass ? "PASS" : "FAIL", name, detail ?? "");
};
const tile = (id) => page.locator(`[data-instance="${id}"]`);
const box = (id) =>
  tile(id).evaluate((el) => {
    const r = el.getBoundingClientRect(),
      board = el.closest(".free-board-container").getBoundingClientRect();
    return {
      x: r.x,
      y: r.y + scrollY,
      boardY: r.y - board.y,
      w: r.width,
      h: r.height,
    };
  });
const settle = () => page.waitForTimeout(450);
try {
  await page.clock.setFixedTime(new Date("2026-10-04T12:00:00Z"));
  await page.goto("http://127.0.0.1:5201");
  await page.evaluate(async () => {
    const { db } = await import("/src/store.ts"),
      { defaultPreferences } = await import("/src/types.ts"),
      { migrateBoard, initialLayout, makeInstance } = await import(
        "/src/layout.ts"
      );
    const board = migrateBoard({ ...defaultPreferences, widgets: [] });
    const instances = [
      ["balance", "tiny"],
      ["available", "tiny"],
      ["goals", "medium"],
      ["chart", "xlarge"],
      ["budgets", "small"],
      ["dues", "medium"],
      ["transactions", "small"],
    ].map(([type, size]) => ({ ...makeInstance(type, type), size }));
    board.views[0] = {
      ...board.views[0],
      instances,
      mobileOrder: instances.map((i) => i.id),
      layouts: Object.fromEntries(
        ["laptop", "desktop", "wide"].map((bp) => [
          bp,
          initialLayout(instances, bp),
        ]),
      ),
    };
    await db.accounts.bulkPut(
      ["Camille", "Alex", "Commun"].map((id, n) => ({
        id,
        checkpoint: { date: "2026-10-04", amount: 250000 + n * 100000 },
      })),
    );
    const cats = [
      "Courses",
      "Restauration",
      "Transport",
      "Logement",
      "Shopping",
    ];
    const rows = [];
    for (let m = 7; m <= 9; m++)
      for (let n = 0; n < 40; n++)
        rows.push({
          id: `tx-${m}-${n}`,
          batchId: "test",
          fingerprint: `tx-${m}-${n}`,
          date: `2026-0${m}-${String(1 + (n % 28)).padStart(2, "0")}`,
          amount: n < 2 ? 250000 : -(1200 + n * 60),
          account: n % 2 ? "Camille" : "Alex",
          merchant: n < 2 ? "Employeur" : "Commerce familial",
          label: n < 2 ? "Paie" : "Achat familial",
          category: n < 2 ? "Salaire" : cats[n % 5],
          internal: false,
          raw: {},
        });
    await db.transactions.bulkPut(rows);
    await db.budgets.bulkPut(
      cats.map((category, n) => ({
        id: `b${n}`,
        category,
        month: "2026-10",
        amount: 25000 + n * 2000,
      })),
    );
    await db.dues.bulkPut(
      cats.map((category, n) => ({
        id: `d${n}`,
        category,
        label: category,
        account: "Commun",
        amount: -5000,
        date: `2026-10-${10 + n}`,
      })),
    );
    const goals = Array.from({ length: 8 }, (_, n) => ({
      name: ["Maison", "Voyage", "Équipement", "Réserve"][n % 4] + ` ${n + 1}`,
      target: 500000,
      saved: 100000 + n * 3000,
      monthly: 10000,
      icon: "house",
      color: "#277487",
    }));
    await db.preferences.put({
      ...defaultPreferences,
      setupDone: true,
      board,
      goal: goals[0],
      extraGoals: goals.slice(1),
    });
  });
  await page.goto("http://127.0.0.1:5201/#dashboard");
  await tile("balance").waitFor();
  await settle();
  check(
    "Dashboard first; week has an icon",
    (await page.locator(".wp-dock-bar button").first().innerText()) ===
      "Dashboard" &&
      (await page
        .locator(".wp-dock-bar button")
        .nth(1)
        .locator("svg")
        .count()) === 1,
  );
  for (const width of [1512, 3840, 1024]) {
    await page.setViewportSize({ width, height: 982 });
    await settle();
    const geometry = await page.locator("[data-instance]").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        const body = el.querySelector(".free-tile-content");
        const b = body.getBoundingClientRect();
        return {
          id: el.dataset.instance,
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
          content: b.height,
          scrolls: [...el.querySelectorAll("*")].filter(
            (n) =>
              /auto|scroll/.test(getComputedStyle(n).overflowY) &&
              n.scrollHeight > n.clientHeight + 2,
          ).length,
        };
      }),
    );
    check(
      `${width}: all card content fits; no nested vertical scroller`,
      geometry.every((g) => g.content <= g.h + 2 && g.scrolls === 0),
      geometry,
    );
    check(
      `${width}: no card overlaps`,
      !geometry.some((a, i) =>
        geometry.some(
          (b, j) =>
            i < j &&
            a.x < b.x + b.w - 1 &&
            a.x + a.w > b.x + 1 &&
            a.y < b.y + b.h - 1 &&
            a.y + a.h > b.y + 1,
        ),
      ),
    );
    await page.screenshot({
      path: path.join(out, `dashboard-${width}.png`),
      fullPage: true,
    });
    await tile("goals").scrollIntoViewIfNeeded();
    const r = await tile("goals").boundingBox();
    const before = await page.evaluate(() => scrollY);
    await page.mouse.move(r.x + r.width / 2, r.y + Math.min(100, r.height / 2));
    await page.mouse.wheel(0, 350);
    await settle();
    check(
      `${width}: wheel over goals scrolls the PAGE`,
      (await page.evaluate(() => scrollY)) > before,
    );
  }
  await page.setViewportSize({ width: 1512, height: 982 });
  await settle();
  const tiny = await box("balance");
  await page
    .getByRole("button", { name: "Organiser mon dashboard", exact: true })
    .click();
  await tile("balance")
    .getByRole("button", { name: /Personnaliser/ })
    .click();
  await page
    .getByRole("button", { name: "Moyen — Solde du foyer", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Fermer les réglages", exact: true })
    .click();
  await settle();
  const medium = await box("balance"),
    neighbor = await box("available");
  check(
    "Mini to Moyen changes physical width by two cells groups",
    medium.w > tiny.w * 1.9,
    { tiny, medium },
  );
  check(
    "Larger card pushes neighbor down, does not refuse",
    neighbor.y >= medium.y + medium.h - 1,
    { medium, neighbor },
  );
  const content = await tile("balance")
    .locator(".free-tile-content")
    .evaluate((el) => el.getBoundingClientRect().height);
  check(
    "Closing settings restores compact height; no inspector-sized residue",
    medium.h < 600 && content <= medium.h + 2,
    { height: medium.h, content },
  );
  // A single-column horizontal move into a deliberately free cell.
  const handle = tile("balance").getByRole("button", { name: /^Déplacer/ });
  await handle.scrollIntoViewIfNeeded();
  const r = await handle.boundingBox(),
    col = await page
      .locator(".free-board-container")
      .evaluate((el) => (el.clientWidth + 16) / 24),
    pre = await box("balance");
  await page.mouse.move(r.x + 30, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + 30 + col, r.y + r.height / 2 + 24, { steps: 12 });
  await page.screenshot({ path: path.join(out, "drag-during.png") });
  await page.mouse.up();
  await settle();
  const post = await box("balance");
  check(
    "Pointer drag really moves one column",
    Math.abs(post.x - pre.x - col) < 3,
    { pre, post, col },
  );
  await page.screenshot({ path: path.join(out, "drag-after.png") });
  await page.getByRole("button", { name: "Terminer", exact: true }).click();
  await settle();
  const saved = await box("balance");
  await page.reload();
  await tile("balance").waitFor();
  await settle();
  const reloaded = await box("balance");
  check(
    "Saved geometry and size survive reload",
    Math.abs(saved.x - reloaded.x) < 2 &&
      Math.abs(saved.boardY - reloaded.boardY) < 2 &&
      Math.abs(saved.w - reloaded.w) < 2 &&
      Math.abs(saved.h - reloaded.h) < 2,
    { saved, reloaded },
  );
  // A real native drag must reorder envelopes before release, then persist.
  const budget = tile("budgets");
  await page.evaluate(async () => {
    const { db } = await import("/src/store.ts");
    await db.preferences.update("main", { budgetLimit: 0 });
  });
  await budget.locator(".budget-entry").nth(4).waitFor();
  const budgetOrder = () =>
    budget.locator(".budget-label strong").allTextContents();
  const beforeBudget = await budgetOrder();
  await budget.scrollIntoViewIfNeeded();
  const lastBudget = budget.locator(".budget-entry").last();
  const firstBudget = budget.locator(".budget-entry").first();
  const startBudget = await lastBudget.boundingBox(),
    endBudget = await firstBudget.boundingBox();
  await page.mouse.move(
    startBudget.x + 12,
    startBudget.y + startBudget.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    startBudget.x + 20,
    startBudget.y + startBudget.height / 2 - 12,
    { steps: 4 },
  );
  await page.mouse.move(endBudget.x + 20, endBudget.y + 15, { steps: 15 });
  await page.waitForTimeout(80);
  const previewBudget = await budgetOrder();
  check(
    "Budget order previews last envelope at the top before release",
    previewBudget[0] === beforeBudget.at(-1),
    { beforeBudget, previewBudget },
  );
  await page.screenshot({ path: path.join(out, "budget-before-drop.png") });
  await page.mouse.up();
  await settle();
  await page.reload();
  await budget.waitFor();
  const persistedBudget = await budgetOrder();
  check(
    "Budget drag order persists after reload",
    persistedBudget[0] === beforeBudget.at(-1),
    { persistedBudget },
  );
  check("No browser errors", errors.length === 0, errors);
} finally {
  await context.close();
  await browser.close();
  await writeFile(
    path.join(out, "report.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
}
if (checks.some((c) => !c.pass) || errors.length) process.exitCode = 1;
