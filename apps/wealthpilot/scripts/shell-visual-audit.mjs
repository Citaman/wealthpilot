import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Isolated synthetic review: never connects to the user's browser or 5173.
const base = "http://127.0.0.1:5201";
const out = path.resolve(
  process.env.AUDIT_OUTPUT || "../../tmp/shell-visual-audit",
);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1512, height: 982 },
  locale: "fr-FR",
});
const page = await context.newPage();
const results = [],
  errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const dimensions = [
  [390, 844],
  [768, 900],
  [1024, 900],
  [1512, 982],
  [3840, 2160],
];
try {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00Z"));
  await page.goto(base);
  await page.evaluate(async () => {
    const { db } = await import("/src/store.ts");
    const { defaultPreferences } = await import("/src/types.ts");
    const { migrateBoard } = await import("/src/layout.ts");
    await db.accounts.bulkPut([
      {
        id: "Compte courant du foyer Société Générale",
        checkpoint: { date: "2026-10-05", amount: 540000 },
      },
      {
        id: "Compte personnel",
        checkpoint: { date: "2026-10-05", amount: 85000 },
      },
    ]);
    await db.transactions.bulkPut(
      Array.from({ length: 48 }, (_, i) => ({
        id: `s${i}`,
        batchId: "synthetic",
        fingerprint: `s${i}`,
        date: `2026-${i < 24 ? "09" : "10"}-${String((i % 4) + 1).padStart(2, "0")}`,
        amount: -(1500 + i * 40),
        account: "Compte courant du foyer Société Générale",
        merchant: ["Carrefour", "Amazon", "Free", "McDonald's"][i % 4],
        label: "Opération de démonstration",
        category: ["Courses", "Shopping", "Télécommunications", "Restauration"][
          i % 4
        ],
        internal: false,
        raw: {},
      })),
    );
    await db.budgets.bulkPut(
      ["Courses", "Shopping", "Restauration"].map((category, i) => ({
        id: `b${i}`,
        category,
        month: "2026-10",
        amount: 50000,
      })),
    );
    await db.dues.put({
      id: "d",
      date: "2026-10-07",
      amount: -10000,
      label: "Assurance",
      account: "Compte courant du foyer Société Générale",
      category: "Maison",
    });
    const p = {
      ...defaultPreferences,
      widgets: ["available", "chart", "budgets", "transactions"],
      goal: null,
      extraGoals: [],
      safety: 50000,
      setupDone: true,
    };
    p.board = migrateBoard(p);
    await db.preferences.put(p);
  });
  await page.goto(`${base}/#dashboard`);
  await page.reload();

  async function capture(name) {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(180);
    const metrics = await page.evaluate(() => {
      const box = (r) => ({
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.round(r.width),
        height: Math.round(r.height),
        right: Math.round(r.right),
        bottom: Math.round(r.bottom),
      });
      const visible = (el) =>
        !!(
          el.checkVisibility() &&
          el.getClientRects().length &&
          getComputedStyle(el).visibility !== "hidden"
        );
      const dock = document.querySelector(".wp-dock"),
        dr = dock.getBoundingClientRect();
      const controls = [...dock.querySelectorAll("button, summary, input")]
        .filter(visible)
        .map((el) => ({
          label: el.getAttribute("aria-label") || el.textContent.trim(),
          ...box(el.getBoundingClientRect()),
          color: getComputedStyle(el).color,
          background: getComputedStyle(el).backgroundColor,
        }));
      const offscreen = controls.filter(
        (el) =>
          el.x < 0 ||
          el.right > innerWidth ||
          el.y < 0 ||
          el.bottom > innerHeight,
      );
      const overlaps = [];
      for (let i = 0; i < controls.length; i++)
        for (let j = i + 1; j < controls.length; j++) {
          const a = controls[i],
            b = controls[j];
          if (
            Math.min(a.right, b.right) - Math.max(a.x, b.x) > 3 &&
            Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 3
          )
            overlaps.push([a.label, b.label]);
        }
      const main = [...document.querySelectorAll("main.page")].find(visible);
      const first =
        main &&
        [...main.children].find(
          (el) => visible(el) && !el.classList.contains("sr-only"),
        );
      return {
        viewport: { width: innerWidth, height: innerHeight },
        scrollWidth: document.documentElement.scrollWidth,
        dock: box(dr),
        controls,
        offscreen,
        overlaps,
        mainTop: main ? Math.round(main.getBoundingClientRect().top) : null,
        firstContentTop: first
          ? Math.round(first.getBoundingClientRect().top)
          : null,
        appPadding: getComputedStyle(document.querySelector(".app-shell"))
          .paddingBottom,
        logo: box(document.querySelector(".app-brand").getBoundingClientRect()),
        topHeaders: document.querySelectorAll(".topbar,.app-header").length,
      };
    });
    await page.screenshot({ path: path.join(out, `${name}.jpg`), quality: 80 });
    results.push({ name, ...metrics });
    console.log(
      name,
      metrics.scrollWidth > metrics.viewport.width ||
        metrics.offscreen.length ||
        metrics.overlaps.length
        ? "DEFECT"
        : "bounds OK",
      JSON.stringify({
        dock: metrics.dock,
        offscreen: metrics.offscreen,
        overlaps: metrics.overlaps,
      }),
    );
  }
  for (const [width, height] of process.env.TARGET_ONLY ? [] : dimensions) {
    await page.setViewportSize({ width, height });
    for (const route of ["dashboard", "week", "transactions", "import"]) {
      await page.goto(`${base}/#${route}`);
      await page
        .locator(`.dock-navigation button[aria-current="page"]`)
        .waitFor();
      await page.evaluate(() => window.scrollTo(0, 0));
      await capture(`${route}-${width}`);
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );
      await page.waitForTimeout(100);
      const bottom = await page.evaluate(() => {
        const visible = (el) =>
          el.getClientRects().length &&
          getComputedStyle(el).visibility !== "hidden";
        const main = [...document.querySelectorAll("main.page")].find(visible);
        const action =
          main &&
          [...main.querySelectorAll("button,input,a")].filter(visible).at(-1);
        const dock = document.querySelector(".wp-dock").getBoundingClientRect();
        if (!action) return null;
        const r = action.getBoundingClientRect();
        return {
          label:
            action.getAttribute("aria-label") ||
            action.textContent.trim().slice(0, 70),
          bottom: r.bottom,
          dockTop: dock.top,
          recoverable: r.bottom <= dock.top,
        };
      });
      results.at(-1).bottom = bottom;
    }
  }
  // Wider context and editing are the pressure cases, not just the default dock.
  for (const width of [390, 768, 1024, 1512]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 982 });
    await page.goto(`${base}/#dashboard`);
    await page
      .getByRole("combobox", { name: "Période affichée", exact: true })
      .click();
    await page
      .getByRole("option", { name: "Période personnalisée", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Compte affiché", exact: true })
      .click();
    await page
      .getByRole("option", {
        name: "Compte courant du foyer Société Générale",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Organiser mon dashboard", exact: true })
      .click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(`editing-custom-${width}`);
    const hoverChecks = [];
    for (const label of [
      "Dashboard",
      "Annuler",
      "Terminer",
      "Ajouter une carte",
    ]) {
      const button = page.getByRole("button", { name: label, exact: true });
      await button.hover();
      await page.waitForTimeout(140);
      hoverChecks.push(
        await button.evaluate((el) => {
          const color = getComputedStyle(el).color;
          let bg = getComputedStyle(el).backgroundColor,
            ancestor = el.parentElement;
          while (bg === "rgba(0, 0, 0, 0)" && ancestor) {
            bg = getComputedStyle(ancestor).backgroundColor;
            ancestor = ancestor.parentElement;
          }
          const lum = (rgb) =>
            rgb
              .match(/[\d.]+/g)
              .slice(0, 3)
              .map(Number)
              .map((v) => v / 255)
              .map((v) =>
                v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
              )
              .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
          const a = lum(color),
            b = lum(bg);
          return {
            label: el.textContent.trim(),
            color,
            bg,
            ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
          };
        }),
      );
      if (label === "Terminer")
        await page.screenshot({
          path: path.join(out, `hover-confirm-${width}.jpg`),
          quality: 85,
        });
    }
    results.at(-1).hoverChecks = hoverChecks;
    try {
      await page
        .getByRole("combobox", { name: "Début de période", exact: true })
        .click({ timeout: 1200 });
      await capture(`editing-custom-menu-${width}`);
      await page.keyboard.press("Escape");
    } catch (error) {
      results.at(-1).startPeriodClick = String(error);
    }
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    await page.goto(`${base}/#week`);
    await page.locator(".week-date-picker summary").click();
    await capture(`week-picker-${width}`);
    await page.keyboard.press("Escape");
  }
} catch (error) {
  errors.push(String(error));
  await page.screenshot({ path: path.join(out, "failure.jpg"), quality: 85 });
  throw error;
} finally {
  await writeFile(
    path.join(out, "results.json"),
    JSON.stringify({ results, errors }, null, 2),
  );
  await browser.close();
}
