// Isolated synthetic IndexedDB. Real pointer collision/escape and next-frame production samples.
import {
  chromium,
  webkit,
} from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const engine = process.env.QA_ENGINE === "webkit" ? "webkit" : "chromium";
const out = path.resolve(
  `../../tmp/mixed-interaction-qa${engine === "webkit" ? "-webkit" : ""}`,
);
await mkdir(out, { recursive: true });
const browser = await { chromium, webkit }[engine].launch({ headless: true });
const seedContext = await browser.newContext(),
  seed = await seedContext.newPage();
await seed.goto("http://127.0.0.1:5201");
await seed.evaluate(async () => {
  const { db } = await import("/src/store.ts"),
    { defaultPreferences } = await import("/src/types.ts"),
    { migrateBoard, makeInstance, initialLayout } = await import(
      "/src/layout.ts"
    );
  const kinds = [
    "balance",
    "available",
    "goals",
    "chart",
    "budgets",
    "dues",
    "transactions",
    "categories",
    "flows",
    "accounts",
    "weekly",
    "charges",
    "savings",
    "recurring",
    "comparison",
  ];
  const board = migrateBoard({ ...defaultPreferences, widgets: [] });
  const instances = Array.from({ length: 30 }, (_, n) => ({
    ...makeInstance(kinds[n % kinds.length], `qa-${n}`),
    size: n < 2 ? "small" : "medium",
  }));
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
  for (const layout of Object.values(board.views[0].layouts)) {
    Object.assign(layout[0], { x: 0, y: 0, w: 8 });
    Object.assign(layout[1], { x: 8, y: 0, w: 8 });
  }
  await db.accounts.bulkPut(
    ["Commun", "Alex", "Camille"].map((id) => ({
      id,
      checkpoint: { date: "2026-10-05", amount: 340000 },
    })),
  );
  const categories = [
    "Courses",
    "Restaurants",
    "Transport",
    "Logement",
    "Loisirs",
  ];
  await db.transactions.bulkPut(
    Array.from({ length: 1500 }, (_, n) => ({
      id: `t${n}`,
      batchId: "qa",
      date: `2026-${String(7 + Math.floor(n / 500)).padStart(2, "0")}-${String(1 + (n % 28)).padStart(2, "0")}`,
      amount: n % 100 === 0 ? 250000 : -100 - (n % 2100),
      account: ["Commun", "Alex", "Camille"][n % 3],
      label: n % 100 === 0 ? "Employeur" : `Commerce ${n % 30}`,
      merchant: n % 100 === 0 ? "Employeur" : `Commerce ${n % 30}`,
      category: n % 100 === 0 ? "Salaire" : categories[n % 5],
      internal: false,
      raw: {},
      fingerprint: `t${n}`,
    })),
  );
  await db.budgets.bulkPut(
    categories.map((category, n) => ({
      id: `b${n}`,
      category,
      month: "2026-10",
      amount: 30000,
    })),
  );
  await db.dues.bulkPut(
    categories.map((category, n) => ({
      id: `d${n}`,
      category,
      label: category,
      amount: -4000,
      date: `2026-10-${10 + n}`,
      account: "Commun",
    })),
  );
  await db.preferences.put({
    ...defaultPreferences,
    setupDone: true,
    board,
    goal: {
      name: "Maison",
      target: 4000000,
      saved: 1000000,
      monthly: 20000,
      color: "#277487",
      icon: "house",
    },
    extraGoals: [
      {
        name: "Voyage",
        target: 400000,
        saved: 200000,
        monthly: 10000,
        color: "#7f4d91",
        icon: "plane",
      },
    ],
  });
  localStorage.setItem("wealthpilot-next-month", "2026-10");
});
const storage = await seedContext.storageState({ indexedDB: true });
await seedContext.close();
storage.origins = storage.origins.map((origin) => ({
  ...origin,
  origin: "http://127.0.0.1:5203",
}));
const context = await browser.newContext({
  storageState: storage,
  viewport: { width: 1512, height: 982 },
  locale: "fr-FR",
  recordVideo: { dir: out },
});
const page = await context.newPage(),
  checks = [],
  errors = [],
  navigation = [],
  resizing = [],
  variants = [];
page.on("pageerror", (e) => errors.push(e.message));
function check(name, pass, detail) {
  checks.push({ name, pass, detail });
  console.log(pass ? "PASS" : "FAIL", name);
}
const frame = () =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
const tile = (id) => page.locator(`[data-instance="qa-${id}"]`);
const coords = (id) =>
  tile(id).evaluate((el) => ({
    transform: el.style.transform,
    width: el.style.width,
    height: el.style.height,
  }));
const p95 = (values) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
try {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00Z"));
  await page.goto("http://127.0.0.1:5203/#dashboard");
  await tile(0).waitFor();
  await frame();
  check(
    "Thirty mixed cards with1500 rows",
    (await page.locator("[data-instance]").count()) === 30,
  );
  // Warm both real pages; timing begins inside the click task, excludes protocol transport.
  for (let n = 0; n < 25; n++) {
    const sample = await page.evaluate(async (n) => {
      const label = n % 2 ? "Dashboard" : "Transactions";
      const button = [...document.querySelectorAll(".wp-dock-bar button")].find(
        (el) => el.textContent === label,
      );
      const start = performance.now();
      button.click();
      for (let i = 0; i < 120; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        const target = document.querySelector(
          label === "Dashboard" ? ".free-board-container" : ".ledger-surface",
        );
        if (target?.checkVisibility())
          return { page: label, ms: performance.now() - start, frame: i + 1 };
      }
      return { page: label, ms: performance.now() - start, frame: 120 };
    }, n);
    if (n >= 5) navigation.push(sample);
  }
  check(
    "Warm navigation p95 under200ms",
    p95(navigation.map((s) => s.ms)) < 200,
    { p95: p95(navigation.map((s) => s.ms)), samples: navigation },
  );
  await page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("button", { name: "Dashboard", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Organiser mon dashboard", exact: true })
    .click();
  const before = [await coords(0), await coords(1)];
  const handle = tile(0).getByRole("button", { name: /^Déplacer/ });
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox(),
    column = await page
      .locator(".free-board-container")
      .evaluate((el) => (el.clientWidth + 16) / 24);
  await page.mouse.move(box.x + 25, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 25 + column * 8, box.y + box.height / 2, {
    steps: 15,
  });
  await frame();
  const during = [await coords(0), await coords(1)];
  check(
    "Collision moves neighbor BEFORE pointerup",
    during[1].transform !== before[1].transform,
    { before, during },
  );
  await page.screenshot({
    path: path.join(out, "collision-before-release.png"),
  });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await frame();
  const after = [await coords(0), await coords(1)];
  check(
    "Escape restores both positions",
    JSON.stringify(after) === JSON.stringify(before),
    { before, after },
  );
  await tile(0)
    .getByRole("button", { name: /^Personnaliser/ })
    .click();
  for (let n = 0; n < 25; n++) {
    const sample = await page.evaluate(async (n) => {
      const label = n % 2 ? "Petit — Solde du foyer" : "Moyen — Solde du foyer";
      const button = document.querySelector(`button[aria-label="${label}"]`),
        start = performance.now();
      button.click();
      await new Promise((r) => requestAnimationFrame(r));
      const tile = document.querySelector('[data-instance="qa-0"]'),
        body = tile.querySelector(".free-tile-content");
      const a = tile.getBoundingClientRect(),
        b = body.getBoundingClientRect();
      const overlaps = [...document.querySelectorAll("[data-instance]")]
        .filter((other) => {
          if (other === tile) return false;
          const c = other.getBoundingClientRect();
          return (
            a.left < c.right - 1 &&
            a.right > c.left + 1 &&
            a.top < c.bottom - 1 &&
            a.bottom > c.top + 1
          );
        })
        .map((other) => other.dataset.instance);
      return {
        label,
        ms: performance.now() - start,
        width: a.width,
        height: a.height,
        contentBottom: b.bottom,
        bottom: a.bottom,
        fits: b.bottom <= a.bottom + 2,
        overlaps,
      };
    }, n);
    if (n >= 5) resizing.push(sample);
  }
  check(
    "Twenty size toggles fit on FIRST animation frame",
    resizing.every((s) => s.fits),
    resizing,
  );
  check(
    "Size p95 under100ms",
    p95(resizing.map((s) => s.ms)) < 100,
    p95(resizing.map((s) => s.ms)),
  );
  check(
    "No neighbor overlap on first size frame",
    resizing.every((s) => !s.overlaps.length),
    resizing.filter((s) => s.overlaps.length),
  );
  check(
    "Sizes physically differ on first frame",
    new Set(resizing.map((s) => s.width)).size === 2,
    resizing.map((s) => s.width),
  );
  await page.screenshot({ path: path.join(out, "next-frame-size.png") });
  await page
    .getByRole("button", { name: "Fermer les réglages", exact: true })
    .click();
  for (let n = 0; n < 25; n++) {
    const sample = await page.evaluate(async (n) => {
      const label =
        ["Anneaux", "Répartition", "Tuiles", "Lignes"][n % 4] + " — balance";
      const tile = document.querySelector('[data-instance="qa-0"]'),
        button = tile.querySelector(`button[aria-label="${label}"]`);
      const start = performance.now();
      button.click();
      await new Promise((r) => requestAnimationFrame(r));
      const body = tile.querySelector(".free-tile-content"),
        a = tile.getBoundingClientRect(),
        b = body.getBoundingClientRect();
      return {
        label,
        ms: performance.now() - start,
        pressed: button.getAttribute("aria-pressed"),
        height: a.height,
        contentBottom: b.bottom,
        bottom: a.bottom,
        fits: b.bottom <= a.bottom + 2,
      };
    }, n);
    if (n >= 5) variants.push(sample);
  }
  check(
    "Twenty visualization toggles fit on FIRST animation frame",
    variants.every((s) => s.fits && s.pressed === "true"),
    variants,
  );
  check(
    "Visualization p95 under100ms",
    p95(variants.map((s) => s.ms)) < 100,
    p95(variants.map((s) => s.ms)),
  );
  check("No runtime errors", errors.length === 0, errors);
} finally {
  await writeFile(
    path.join(out, "results.json"),
    JSON.stringify({ checks, errors, navigation, resizing, variants }, null, 2),
  );
  await context.close();
  await browser.close();
}
if (checks.some((c) => !c.pass)) process.exitCode = 1;
