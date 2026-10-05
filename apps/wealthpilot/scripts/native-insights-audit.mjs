// Synthetic, isolated product review. Does not touch a user's browser or data.
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const out = path.resolve(
  process.env.AUDIT_OUTPUT || "../../tmp/native-insights-review",
);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const seed = await browser.newContext();
const seedPage = await seed.newPage();
await seedPage.goto("http://127.0.0.1:5201");
await seedPage.evaluate(async () => {
  const { db } = await import("/src/store.ts");
  const { defaultPreferences } = await import("/src/types.ts");
  const { makeInstance, initialLayout, migrateBoard } = await import(
    "/src/layout.ts"
  );
  const { sizesFor } = await import("/src/intelligence.ts");
  const board = migrateBoard({ ...defaultPreferences, widgets: [] });
  const families = [
    "accounts",
    "goalDate",
    "safety",
    "weekly",
    "configuration",
    "library",
  ];
  const view = (id, instances) => ({
    id,
    name: id,
    instances,
    mobileOrder: instances.map((i) => i.id),
    layouts: Object.fromEntries(
      ["laptop", "desktop", "wide"].map((bp) => [
        bp,
        initialLayout(instances, bp),
      ]),
    ),
  });
  board.views = families.map((type) =>
    view(
      type,
      sizesFor(type).map((size) => ({
        ...makeInstance(type, `${type}-${size}`),
        size,
      })),
    ),
  );
  board.views.push(
    view("chart", [
      { ...makeInstance("chart", "chart-medium"), size: "medium" },
    ]),
  );
  board.views.push(
    view(
      "palettes",
      families
        .filter((type) => !["configuration", "library"].includes(type))
        .flatMap((type) =>
          ["paper", "ink", "yellow", "pink", "cyan"].map((tone) => ({
            ...makeInstance(type, `${type}-${tone}`),
            size: "medium",
            tone,
          })),
        ),
    ),
  );
  board.activeView = "accounts";
  await db.accounts.bulkPut([
    { id: "Courant", checkpoint: { date: "2026-10-05", amount: 800000 } },
    { id: "Commun", checkpoint: { date: "2026-10-05", amount: -15000 } },
    { id: "Épargne sans référence" },
  ]);
  await db.transactions.bulkPut(
    [
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
      "2026-10-05",
    ].flatMap((date, i) =>
      ["Courses", "Restauration", "Transport", "Santé", "Loisirs"].map(
        (category, j) => ({
          id: `t${i}-${j}`,
          batchId: "fixture",
          fingerprint: `t${i}-${j}`,
          date,
          amount: -(2000 + j * 300),
          merchant: "Démonstration",
          label: category,
          category,
          account: "Courant",
          internal: false,
          raw: {},
        }),
      ),
    ),
  );
  await db.dues.bulkPut([
    {
      id: "today",
      date: "2026-10-05",
      amount: -9000,
      label: "Assurance aujourd’hui non payée",
      account: "Courant",
      category: "Logement",
    },
    {
      id: "next",
      date: "2026-10-06",
      amount: -5000,
      label: "Internet demain",
      account: "Courant",
      category: "Télécommunications",
    },
  ]);
  await db.budgets.bulkPut(
    ["Courses", "Restauration", "Transport", "Santé", "Loisirs"].map(
      (category, i) => ({
        id: `b${i}`,
        category,
        amount: 50000,
        month: "2026-10",
      }),
    ),
  );
  await db.preferences.put({
    ...defaultPreferences,
    board,
    setupDone: true,
    safety: 50000,
    weekly: 100000,
    goal: {
      name: "Projet déjà financé",
      target: 100000,
      saved: 100000,
      monthly: 5000,
      deadline: "2026-01-01",
    },
    extraGoals: [
      {
        name: "Projet 11 ans",
        target: 132000,
        saved: 0,
        monthly: 1000,
        deadline: "2037-10-05",
      },
      {
        name: "Projet 20 ans",
        target: 240000,
        saved: 0,
        monthly: 1000,
        deadline: "2046-10-05",
      },
      {
        name: "Sans effort et échéance passée",
        target: 50000,
        saved: 0,
        monthly: 0,
        deadline: "2026-01-01",
      },
    ],
  });
});
const storage = await seed.storageState({ indexedDB: true });
const origin = process.env.QA_URL || "http://127.0.0.1:5201";
for (const item of storage.origins) item.origin = origin;
await seed.close();
const context = await browser.newContext({
  storageState: storage,
  viewport: { width: 1512, height: 982 },
});
const page = await context.newPage();
await page.clock.setFixedTime(new Date("2026-10-05T12:00:00Z"));
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(origin + "/#dashboard");
const productionAssets = await page
  .locator("script[src]")
  .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("src")));
const reports = [];
const inspectors = [];
for (const width of [1024, 1512, 3840]) {
  await page.setViewportSize({ width, height: 982 });
  for (const family of [
    "accounts",
    "goalDate",
    "safety",
    "weekly",
    "configuration",
    "library",
    ...(width === 1512 ? ["palettes"] : []),
  ]) {
    await page.evaluate(async (family) => {
      const r = indexedDB.open("WealthPilotNext_v1");
      const db = await new Promise(
        (resolve) => (r.onsuccess = () => resolve(r.result)),
      );
      await new Promise((resolve) => {
        const tx = db.transaction("preferences", "readwrite"),
          t = tx.objectStore("preferences"),
          q = t.get("main");
        q.onsuccess = () => {
          const p = q.result;
          p.board.activeView = family;
          t.put(p);
        };
        tx.oncomplete = resolve;
      });
      db.close();
      const open = indexedDB.open("WealthPilotNext_v1");
      const data = await new Promise(
        (resolve) => (open.onsuccess = () => resolve(open.result)),
      );
      await new Promise((resolve) => {
        const tx = data.transaction("accounts", "readwrite");
        tx.objectStore("accounts").put({
          id: "Épargne sans référence",
          ...(family === "weekly"
            ? { checkpoint: { date: "2026-10-05", amount: 0 } }
            : {}),
        });
        tx.oncomplete = resolve;
      });
      data.close();
    }, family);
    await page.reload();
    await page.locator("[data-instance]").first().waitFor();
    await page.waitForTimeout(500);
    const cards = await page.locator("[data-instance]").evaluateAll((cards) =>
      cards.map((card) => {
        const rect = card.getBoundingClientRect();
        const content = card.querySelector(".card");
        return {
          id: card.dataset.instance,
          width: rect.width,
          height: rect.height,
          text: content?.innerText,
          scroll: [...card.querySelectorAll("*")].filter(
            (e) =>
              e.checkVisibility() &&
              /auto|scroll/.test(getComputedStyle(e).overflowY) &&
              e.scrollHeight > e.clientHeight + 2,
          ).length,
          clipped: [
            ...card.querySelectorAll(
              ".card strong,.card p,.card small,.card a,.card button",
            ),
          ]
            .filter((e) => {
              const r = e.getBoundingClientRect();
              return (
                r.width > 0 &&
                (r.right > rect.right + 2 ||
                  r.left < rect.left - 2 ||
                  r.bottom > rect.bottom + 2)
              );
            })
            .map((e) => e.textContent),
          horizon: [...card.querySelectorAll(".horizon-track > span")].map(
            (e) => e.style.width,
          ),
        };
      }),
    );
    reports.push({ width, family, cards });
    await writeFile(
      path.join(out, "report.json"),
      JSON.stringify({ origin, errors, reports }, null, 2),
    );
    try {
      await page.locator(".free-board-shell").screenshot({
        path: path.join(out, `${family}-${width}.png`),
        timeout: 5000,
      });
    } catch (error) {
      const frames = [];
      for (let frame = 0; frame < 20; frame++) {
        frames.push(
          await page.locator("[data-instance]").evaluateAll((nodes) =>
            nodes.map((el) => ({
              id: el.dataset.instance,
              x: el.getBoundingClientRect().x,
              y: el.getBoundingClientRect().y,
              height: el.getBoundingClientRect().height,
            })),
          ),
        );
        await page.waitForTimeout(100);
      }
      await page.screenshot({
        path: path.join(out, `${family}-${width}-unstable.png`),
      });
      await writeFile(
        path.join(out, `${family}-${width}-stability.json`),
        JSON.stringify({ error: String(error), frames }, null, 2),
      );
    }
    if (width === 1512 && family !== "palettes") {
      await page
        .getByRole("button", { name: "Organiser mon dashboard", exact: true })
        .click();
      await page
        .getByRole("button", { name: /^Personnaliser/ })
        .first()
        .click();
      const panel = page.locator(".free-inspector");
      await panel.waitFor();
      const source = panel.getByRole("combobox", {
        name: "Source de cette carte",
      });
      const state = {
        family,
        source: await source.count(),
        period: await panel
          .getByRole("combobox", { name: "Période de cette carte" })
          .count(),
        text: await panel.innerText(),
      };
      if (state.source) {
        await source.click();
        await page
          .getByRole("option", { name: "Courant", exact: true })
          .click();
      }
      await panel.getByRole("button", { name: "Fermer les réglages" }).click();
      await page.getByRole("button", { name: "Terminer", exact: true }).click();
      await page.waitForTimeout(250);
      await page.reload();
      await page.locator("[data-instance]").first().waitFor();
      state.afterReload = await page
        .locator("[data-instance]")
        .first()
        .innerText();
      inspectors.push(state);
      await writeFile(
        path.join(out, "inspectors.json"),
        JSON.stringify(inspectors, null, 2),
      );
    }
  }
}
await page.evaluate(async () => {
  const request = indexedDB.open("WealthPilotNext_v1");
  const db = await new Promise(
    (resolve) => (request.onsuccess = () => resolve(request.result)),
  );
  await new Promise((resolve) => {
    const tx = db.transaction(["accounts", "preferences"], "readwrite"),
      accounts = tx.objectStore("accounts"),
      prefs = tx.objectStore("preferences"),
      req = prefs.get("main");
    for (const [id, amount] of [
      ["Courant", -20000],
      ["Commun", -15000],
      ["Épargne sans référence", 0],
    ])
      accounts.put({ id, checkpoint: { date: "2026-10-05", amount } });
    req.onsuccess = () => {
      const p = req.result;
      p.board.activeView = "safety";
      prefs.put(p);
    };
    tx.oncomplete = resolve;
  });
  db.close();
});
await page.setViewportSize({ width: 1512, height: 982 });
await page.reload();
await page.locator("[data-instance]").first().waitFor();
await page.waitForTimeout(350);
const negativeSafety = await page.locator("[data-instance]").allTextContents();
await page.screenshot({
  path: path.join(out, "safety-negative.png"),
  fullPage: true,
});
await page.evaluate(async () => {
  const request = indexedDB.open("WealthPilotNext_v1");
  const db = await new Promise(
    (resolve) => (request.onsuccess = () => resolve(request.result)),
  );
  await new Promise((resolve) => {
    const tx = db.transaction("preferences", "readwrite"),
      t = tx.objectStore("preferences"),
      q = t.get("main");
    q.onsuccess = () => {
      const p = q.result;
      p.board.activeView = "chart";
      t.put(p);
    };
    tx.oncomplete = resolve;
  });
  db.close();
});
await page.reload();
await page.getByRole("combobox", { name: "Mesure du graphique" }).click();
await page
  .getByRole("option", { name: "Flux nets cumulés", exact: true })
  .click();
await page.waitForTimeout(200);
const chartBefore = await page
  .getByRole("combobox", { name: "Mesure du graphique" })
  .textContent();
await page.reload();
await page.getByRole("combobox", { name: "Mesure du graphique" }).waitFor();
const chartAfter = await page
  .getByRole("combobox", { name: "Mesure du graphique" })
  .textContent();
await writeFile(
  path.join(out, "report.json"),
  JSON.stringify(
    {
      origin,
      productionAssets,
      errors,
      reports,
      negativeSafety,
      chartMetric: {
        before: chartBefore,
        after: chartAfter,
        persisted: chartBefore === chartAfter,
      },
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    origin,
    errors,
    cards: reports.reduce((n, r) => n + r.cards.length, 0),
    clipped: reports.flatMap((r) => r.cards).filter((c) => c.clipped.length),
    scrolling: reports.flatMap((r) => r.cards).filter((c) => c.scroll),
  }),
);
await browser.close();
