// Read-only app audit: writes synthetic data only inside a fresh browser context.
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const out = path.resolve(
  process.env.AUDIT_OUTPUT || "../../tmp/layout-usability-baseline",
);
const auditWidth = Number(process.env.AUDIT_WIDTH || 1512);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true }),
  seed = await browser.newContext({
    viewport: { width: auditWidth, height: 982 },
  }),
  s = await seed.newPage();
await s.goto(process.env.SEED_URL || "http://127.0.0.1:5173");
await s.waitForLoadState("networkidle");
const families = await s.evaluate(async (palettes) => {
  const { db } = await import("/src/store.ts"),
    { defaultPreferences, widgetNames } = await import("/src/types.ts"),
    { makeInstance, initialLayout, migrateBoard } = await import(
      "/src/layout.ts"
    ),
    { sizesFor } = await import("/src/intelligence.ts");
  const ids = Object.keys(widgetNames),
    b = migrateBoard({ ...defaultPreferences, widgets: [] });
  b.views = ids.map((type) => {
    const instances = palettes
      ? ["paper", "ink", "yellow", "pink", "cyan"].map((tone) => ({
          ...makeInstance(type, type + "-" + tone),
          size: "medium",
          tone,
        }))
      : sizesFor(type).map((size) => ({
          ...makeInstance(type, type + "-" + size),
          size,
        }));
    return {
      id: type,
      name: widgetNames[type],
      instances,
      mobileOrder: instances.map((i) => i.id),
      layouts: Object.fromEntries(
        ["laptop", "desktop", "wide"].map((bp) => [
          bp,
          initialLayout(instances, bp),
        ]),
      ),
    };
  });
  b.activeView = ids[0];
  const cats = [
    "Courses",
    "Restauration",
    "Transport",
    "Santé",
    "Logement",
    "Enfants",
    "Loisirs",
    "Shopping",
  ];
  await db.accounts.bulkPut([
    { id: "Courant", checkpoint: { date: "2026-10-04", amount: 230000 } },
    { id: "Commun", checkpoint: { date: "2026-10-04", amount: 170000 } },
    { id: "Épargne", checkpoint: { date: "2026-10-04", amount: 980000 } },
  ]);
  await db.transactions.bulkPut(
    Array.from({ length: 180 }, (_, n) => ({
      id: "tx" + n,
      batchId: "fixture",
      fingerprint: "tx" + n,
      date: `2026-${String(7 + (n % 4)).padStart(2, "0")}-${String(1 + (n % 3)).padStart(2, "0")}`,
      amount: n % 20 === 0 ? 250000 : -(1000 + n * 27),
      merchant: [
        "Amazon",
        "McDonald’s",
        "Free",
        "Commerce du quartier au nom long",
      ][n % 4],
      label: "Opération exemple " + n,
      category: cats[n % cats.length],
      account: n % 2 ? "Courant" : "Commun",
      internal: false,
      raw: {},
    })),
  );
  await db.dues.bulkPut(
    Array.from({ length: 15 }, (_, n) => ({
      id: "due" + n,
      label: "Échéance familiale " + n,
      category: cats[n % cats.length],
      amount: -(2000 + n * 100),
      date: `2026-10-${String(5 + n).padStart(2, "0")}`,
      account: n % 2 ? "Courant" : "Commun",
    })),
  );
  await db.transactions.bulkPut(
    Array.from({ length: 4 }, (_, n) => [
      {
        id: `salary-${n}`,
        batchId: "fixture",
        fingerprint: `salary-${n}`,
        date: `2026-${String(n + 7).padStart(2, "0")}-02`,
        amount: 250000,
        merchant: "Employeur",
        label: "Salaire",
        category: "Revenus",
        account: "Courant",
        internal: false,
        raw: {},
      },
      {
        id: `mobile-${n}`,
        batchId: "fixture",
        fingerprint: `mobile-${n}`,
        date: `2026-${String(n + 7).padStart(2, "0")}-01`,
        amount: -4500,
        merchant: "Free",
        label: "Abonnement Free",
        category: "Télécommunications",
        account: "Courant",
        internal: false,
        raw: {},
      },
    ]).flat(),
  );
  await db.transactions.bulkPut([
    ...Array.from({ length: 3 }, (_, n) => ({
      id: `shopping-history-${n}`,
      batchId: "fixture",
      fingerprint: `shopping-history-${n}`,
      date: `2026-${String(n + 7).padStart(2, "0")}-15`,
      amount: -10000,
      merchant: "Boutique",
      label: "Shopping habituel",
      category: "Shopping",
      account: "Courant",
      internal: false,
      raw: {},
    })),
    {
      id: "unusual",
      batchId: "fixture",
      fingerprint: "unusual",
      date: "2026-10-03",
      amount: -90000,
      merchant: "Mobilier",
      label: "Achat exceptionnel",
      category: "Shopping",
      account: "Courant",
      internal: false,
      raw: {},
    },
    {
      id: "uncategorized",
      batchId: "fixture",
      fingerprint: "uncategorized",
      date: "2026-10-03",
      amount: -3499,
      merchant: "Petit commerce",
      label: "Carte locale",
      category: "À catégoriser",
      account: "Commun",
      internal: false,
      raw: {},
    },
  ]);
  await db.budgets.bulkPut(
    cats.map((category, n) => ({
      id: "b" + n,
      month: "2026-10",
      amount: 20000 + n * 1000,
      category,
    })),
  );
  const goals = Array.from({ length: 12 }, (_, n) => ({
    name:
      ["Maison familiale", "iPhone", "Voyage au Japon", "Sécurité du foyer"][
        n % 4
      ] +
      " " +
      (n + 1),
    target: 100000 + n * 10000,
    saved: 20000 + n * 1500,
    monthly: 5000,
    icon: "house",
    color: n % 2 ? "#187080" : "#9b446f",
    deadline: "2027-06-01",
  }));
  await db.preferences.put({
    ...defaultPreferences,
    board: b,
    setupDone: true,
    safety: 30000,
    goal: goals[0],
    extraGoals: goals.slice(1),
  });
  return ids;
}, !!process.env.AUDIT_PALETTES);
const storage = await seed.storageState({ indexedDB: true });
const registry = await s.evaluate(async () => {
  const { visualizationsFor, visualizationLabels } = await import(
    "/src/visualizationRegistry.ts"
  );
  const { widgetNames } = await import("/src/types.ts");
  return Object.fromEntries(
    Object.keys(widgetNames).map((id) => [
      id,
      visualizationsFor(id).map((variant) => ({
        id: variant,
        label: visualizationLabels[variant],
      })),
    ]),
  );
});
await seed.close();
const base = process.env.QA_URL || "http://127.0.0.1:5203";
storage.origins = storage.origins.map((o) => ({ ...o, origin: base }));
const context = await browser.newContext({
    storageState: storage,
    viewport: { width: auditWidth, height: 982 },
  }),
  page = await context.newPage(),
  report = [];
const runtimeErrors = [];
page.on("pageerror", (error) => runtimeErrors.push(error.message));
await page.clock.setFixedTime(new Date("2026-10-04T12:00:00Z"));
await page.goto(base + "/#dashboard");
const productionAssets = await page
  .locator("script[src]")
  .evaluateAll((scripts) =>
    scripts.map((script) => script.getAttribute("src")),
  );
await page.locator("[data-instance]").first().waitFor();
for (const family of families.filter(
  (family) => !process.env.AUDIT_FAMILY || family === process.env.AUDIT_FAMILY,
)) {
  await page.evaluate(async (family) => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open("WealthPilotNext_v1");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("preferences", "readwrite"),
        table = tx.objectStore("preferences"),
        r = table.get("main");
      r.onsuccess = () => {
        const p = r.result;
        p.board.activeView = family;
        table.put(p);
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, family);
  await page.reload();
  await page.locator(`[data-widget="${family}"]`).first().waitFor();
  await page.waitForTimeout(350);
  const measurements = await page
    .locator("[data-instance]")
    .evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect(),
          sc = el.querySelector(".free-tile-scroll, .free-tile-body"),
          content = el.querySelector(".card");
        const internalScrollers = [...el.querySelectorAll("*")]
          .filter((node) => {
            if (!node.checkVisibility()) return false;
            const style = getComputedStyle(node);
            return (
              /auto|scroll/.test(style.overflowY) &&
              (node.scrollHeight > node.clientHeight + 2 ||
                /contain|none/.test(style.overscrollBehaviorY))
            );
          })
          .map((node) => ({
            element: node.className,
            scrollHeight: node.scrollHeight,
            clientHeight: node.clientHeight,
          }));
        return {
          id: el.dataset.instance,
          width: r.width,
          height: r.height,
          scrollHeight: sc?.scrollHeight,
          clientHeight: sc?.clientHeight,
          overflow: sc ? getComputedStyle(sc).overflowY : null,
          overscroll: sc ? getComputedStyle(sc).overscrollBehavior : null,
          hasInternalScroll: internalScrollers.length > 0,
          internalScrollers,
          text: content?.textContent,
          clippedElements: [
            ...(content?.querySelectorAll(
              "h2,p,small,strong,button,input,svg",
            ) ?? []),
          ]
            .filter((node) => {
              const rect = node.getBoundingClientRect();
              return (
                rect.width > 0 &&
                rect.height > 0 &&
                (rect.bottom > r.bottom + 2 ||
                  rect.right > r.right + 2 ||
                  rect.left < r.left - 2)
              );
            })
            .map((node) => ({
              tag: node.tagName,
              text: node.textContent?.trim().slice(0, 65),
            })),
          buttons: [...el.querySelectorAll("button")].map(
            (b) => b.getAttribute("aria-label") || b.textContent?.trim(),
          ),
        };
      }),
    );
  try {
    await page
      .locator(".free-board-shell")
      .screenshot({ path: path.join(out, `${family}-all-sizes.png`) });
  } catch (error) {
    const frames = [];
    for (let index = 0; index < 20; index++) {
      frames.push(
        await page.locator("[data-instance]").evaluateAll((els) =>
          els.map((el) => ({
            id: el.dataset.instance,
            tile: el.getBoundingClientRect().toJSON(),
            content: el
              .querySelector(".free-tile-content")
              ?.getBoundingClientRect()
              .toJSON(),
          })),
        ),
      );
      await page.waitForTimeout(100);
    }
    await writeFile(
      path.join(out, `${family}-unstable-frames.json`),
      JSON.stringify(frames, null, 2),
    );
    await page.screenshot({
      path: path.join(out, `${family}-unstable.png`),
      fullPage: true,
    });
    throw error;
  }
  const familyReport = {
    family,
    measurements,
    variants: [],
    persistedAfterReload: null,
  };
  report.push(familyReport);
  if (
    process.env.AUDIT_VARIANTS ||
    ["balance", "goals", "budgets"].includes(family)
  ) {
    for (const label of process.env.AUDIT_VARIANTS
      ? registry[family].map((v) => v.label)
      : ["Anneaux", "Tuiles"]) {
      const controls = page.getByRole("button", {
        name:
          family === "budgets"
            ? `Budgets en ${{ Lignes: "liste", Anneaux: "anneaux", Colonnes: "marges", Tuiles: "enveloppes" }[label]}`
            : family === "chart"
              ? {
                  Courbe: "Trajectoire",
                  Aire: "Surface",
                  Colonnes: "Soldes quotidiens",
                }[label]
              : new RegExp(`^${label}`),
      });
      if (!(await controls.count())) continue;
      for (const button of await controls.all()) {
        if (await button.isEnabled()) {
          if (process.env.AUDIT_KEYBOARD) {
            await button.focus();
            await page.keyboard.press("Enter");
          } else await button.click();
        }
      }
      await page.waitForTimeout(350);
      const hoverContrast = [];
      if (process.env.AUDIT_PALETTES)
        for (const button of await controls.all()) {
          if (!(await button.isEnabled())) continue;
          await button.hover();
          await page.waitForTimeout(150);
          hoverContrast.push(
            await button.evaluate((element) => {
              const style = getComputedStyle(element);
              const lum = (color) =>
                (color.match(/[\d.]+/g) ?? [])
                  .slice(0, 3)
                  .map(Number)
                  .map((v) => v / 255)
                  .map((v) =>
                    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
                  )
                  .reduce(
                    (sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i],
                    0,
                  );
              const fg = lum(style.color),
                bg = lum(style.backgroundColor);
              return {
                instance: element.closest("[data-instance]").dataset.instance,
                fg: style.color,
                bg: style.backgroundColor,
                ratio: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05),
                pressed: element.getAttribute("aria-pressed"),
              };
            }),
          );
        }
      familyReport.variants.push({
        label,
        hoverContrast,
        activation: process.env.AUDIT_KEYBOARD
          ? "keyboard-enter"
          : "pointer-click",
        saveErrors: await page
          .getByText("Cette vue n’a pas pu être sauvegardée.", { exact: true })
          .count(),
        pressed: await controls.evaluateAll((buttons) =>
          buttons.map((button) => button.getAttribute("aria-pressed")),
        ),
        dimensions: await page.locator("[data-instance]").evaluateAll((els) =>
          els.map((el) => ({
            id: el.dataset.instance,
            height: el.getBoundingClientRect().height,
            clipped: [
              ...el.querySelectorAll(
                ".card h2,.card p,.card small,.card strong,.card button,.card input,.card svg",
              ),
            ]
              .filter((node) => {
                const r = el.getBoundingClientRect(),
                  c = node.getBoundingClientRect();
                return (
                  c.width > 0 &&
                  c.height > 0 &&
                  (c.bottom > r.bottom + 2 ||
                    c.right > r.right + 2 ||
                    c.left < r.left - 2)
                );
              })
              .map((node) => node.textContent?.slice(0, 70)),
            charts: [
              ...el.querySelectorAll(
                ".budget-content > svg,svg.concentric-chart",
              ),
            ].map((svg) => ({
              width: svg.getBoundingClientRect().width,
              height: svg.getBoundingClientRect().height,
            })),
          })),
        ),
      });
      await page.locator(".free-board-shell").screenshot({
        path: path.join(out, `${family}-${label.toLowerCase()}.png`),
      });
    }
    if (familyReport.variants.length) {
      const selected = () =>
        page
          .locator('[data-instance] button[aria-pressed="true"]')
          .evaluateAll((buttons) =>
            buttons.map(
              (button) =>
                button.getAttribute("aria-label") || button.textContent,
            ),
          );
      const beforeReload = await selected();
      await page.reload();
      await page.locator(`[data-widget="${family}"]`).first().waitFor();
      await page.waitForTimeout(350);
      familyReport.persistedAfterReload =
        JSON.stringify(beforeReload) === JSON.stringify(await selected());
    }
  }
}
// Real wheel over a crowded card: compare page progress versus intercepted inner scroll.
await page.evaluate(async () => {
  const db = await new Promise((resolve) => {
    const r = indexedDB.open("WealthPilotNext_v1");
    r.onsuccess = () => resolve(r.result);
  });
  await new Promise((resolve) => {
    const tx = db.transaction("preferences", "readwrite"),
      t = tx.objectStore("preferences"),
      r = t.get("main");
    r.onsuccess = () => {
      const p = r.result;
      p.board.activeView = "goals";
      t.put(p);
    };
    tx.oncomplete = resolve;
  });
  db.close();
});
await page.reload();
const medium = page.locator(
  process.env.AUDIT_PALETTES
    ? '[data-instance="goals-paper"]'
    : '[data-instance="goals-medium"]',
);
await medium.waitFor();
await medium.scrollIntoViewIfNeeded();
const box = await medium.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
const before = await medium.evaluate((el) => ({
  page: scrollY,
  inner: el.querySelector(".free-tile-scroll")?.scrollTop,
}));
await page.mouse.wheel(0, 400);
await page.waitForTimeout(150);
const after = await medium.evaluate((el) => ({
  page: scrollY,
  inner: el.querySelector(".free-tile-scroll")?.scrollTop,
}));
await page.screenshot({ path: path.join(out, "wheel-interception.png") });
await writeFile(
  path.join(out, "report.json"),
  JSON.stringify(
    {
      viewport: auditWidth,
      productionAssets,
      runtimeErrors,
      families: report,
      wheel: { before, after },
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    families: report.length,
    cards: report.flatMap((r) => r.measurements).length,
    scrollable: report
      .flatMap((r) => r.measurements)
      .filter((c) => c.hasInternalScroll).length,
    wheel: { before, after },
  }),
);
await context.close();
await browser.close();
