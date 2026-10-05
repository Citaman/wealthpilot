// Bounded palette check: three real dashboard cards, twelve full themes.
// Fresh browser storage only; no user CSV or browser session is accessed.
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const base = process.env.QA_URL || "http://127.0.0.1:5201";
const out = path.resolve(
  process.env.AUDIT_OUTPUT || "../../tmp/card-palettes-qa",
);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1512, height: 982 },
});
const page = await context.newPage();
const errors = [],
  results = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00Z"));
  await page.goto(base);
  const tones = await page.evaluate(async () => {
    const { db } = await import("/src/store.ts");
    const { defaultPreferences } = await import("/src/types.ts");
    const { makeInstance, migrateBoard, initialLayout } = await import(
      "/src/layout.ts"
    );
    const { cardPaletteIds } = await import("/src/cardPalettes.ts");
    const board = migrateBoard({ ...defaultPreferences, widgets: [] });
    board.views = cardPaletteIds.map((tone) => {
      const instances = ["available", "chart", "budgets"].map((type) => ({
        ...makeInstance(type, `${tone}-${type}`),
        tone,
        size: "medium",
      }));
      return {
        id: tone,
        name: tone,
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
    board.activeView = "paper";
    await db.accounts.put({
      id: "Courant",
      checkpoint: { date: "2026-10-05", amount: 600000 },
    });
    await db.transactions.bulkPut(
      Array.from({ length: 9 }, (_, i) => ({
        id: `p${i}`,
        batchId: "demo",
        fingerprint: `p${i}`,
        date: `2026-10-0${(i % 4) + 1}`,
        amount: -(1000 + i * 600),
        merchant: "Démonstration",
        label: "Démonstration",
        category: ["Courses", "Transport", "Santé"][i % 3],
        account: "Courant",
        internal: false,
        raw: {},
      })),
    );
    await db.budgets.bulkPut(
      ["Courses", "Transport", "Santé"].map((category, i) => ({
        id: `b${i}`,
        category,
        month: "2026-10",
        amount: 50000,
      })),
    );
    await db.dues.put({
      id: "d",
      date: "2026-10-09",
      amount: -20000,
      label: "Assurance",
      account: "Courant",
      category: "Maison",
    });
    await db.preferences.put({
      ...defaultPreferences,
      widgets: ["available", "chart", "budgets"],
      board,
      setupDone: true,
      safety: 100000,
      essentials: 30000,
      goal: null,
      extraGoals: [],
    });
    return cardPaletteIds;
  });

  async function measure() {
    return page.evaluate(() => {
      const canvas = new OffscreenCanvas(1, 1),
        ctx = canvas.getContext("2d");
      const rgba = (color) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data].map((v, i) =>
          i === 3 ? v / 255 : v,
        );
      };
      const blend = (a, b) =>
        a.slice(0, 3).map((v, i) => v * a[3] + b[i] * (1 - a[3]));
      const lum = (c) =>
        c
          .map((v) => v / 255)
          .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
          .reduce((total, v, i) => total + v * [0.2126, 0.7152, 0.0722][i], 0);
      const checked = [],
        failed = [];
      for (const el of document.querySelectorAll(".free-tile .card *")) {
        if (
          ![...el.childNodes].some(
            (node) => node.nodeType === 3 && node.textContent.trim(),
          )
        )
          continue;
        const cs = getComputedStyle(el),
          rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height || cs.visibility === "hidden") continue;
        const layers = [];
        for (let ancestor = el; ancestor; ancestor = ancestor.parentElement)
          layers.unshift(rgba(getComputedStyle(ancestor).backgroundColor));
        const bg = layers.reduce(
          (result, layer) => blend(layer, result),
          [255, 255, 255],
        );
        const fg = blend(
          rgba(el instanceof SVGElement ? cs.fill : cs.color),
          bg,
        );
        const ls = [lum(fg), lum(bg)].sort((a, b) => b - a),
          ratio = (ls[0] + 0.05) / (ls[1] + 0.05);
        const large =
          parseFloat(cs.fontSize) >= 24 ||
          (parseFloat(cs.fontSize) >= 18.66 && parseInt(cs.fontWeight) >= 700);
        const row = {
          instance: el.closest("[data-instance]").dataset.instance,
          text: el.textContent.trim().slice(0, 75),
          ratio: +ratio.toFixed(3),
          required: large ? 3 : 4.5,
          fg,
          bg,
        };
        checked.push(row);
        if (ratio < row.required) failed.push(row);
      }
      const marks = [
        ...document.querySelectorAll(
          ".free-tile .budget-progress > i:not(.budget-committed)",
        ),
      ].map((el) => {
        const fg = rgba(getComputedStyle(el).backgroundColor),
          bg = rgba(getComputedStyle(el.parentElement).backgroundColor);
        const ls = [lum(fg.slice(0, 3)), lum(bg.slice(0, 3))].sort(
          (a, b) => b - a,
        );
        const ratio = (ls[0] + 0.05) / (ls[1] + 0.05);
        const row = {
          instance: el.closest("[data-instance]").dataset.instance,
          text: "Marque de budget / piste",
          ratio: +ratio.toFixed(3),
          required: 3,
          fg,
          bg,
        };
        if (ratio < 3) failed.push(row);
        return row;
      });
      return { checked: checked.length, marks, failed };
    });
  }

  for (const tone of tones) {
    await page.evaluate(async (tone) => {
      const { db } = await import("/src/store.ts");
      const p = await db.preferences.get("main");
      p.board.activeView = tone;
      await db.preferences.put(p);
    }, tone);
    await page.goto(`${base}/#dashboard`);
    await page.reload();
    await page.locator(`[data-instance="${tone}-chart"]`).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(220);
    const normal = await measure();
    const pressed = page.locator(
      `[data-instance="${tone}-chart"] .component-views button[aria-pressed="true"]`,
    );
    await pressed.hover();
    await page.waitForTimeout(150);
    const hover = await measure();
    const button = await pressed.evaluate((el) => ({
      foreground: getComputedStyle(el).color,
      background: getComputedStyle(el).backgroundColor,
      label: el.textContent,
    }));
    const focusControl = page
      .locator(`[data-instance="${tone}-available"] button`)
      .last();
    await focusControl.focus();
    const focus = await focusControl.evaluate((el) => ({
      color: getComputedStyle(el).outlineColor,
      width: getComputedStyle(el).outlineWidth,
      style: getComputedStyle(el).outlineStyle,
    }));
    results.push({ tone, normal, hover, button, focus });
    if (
      ["paper", "ink", "coral", "plum", "midnight", "forest"].includes(tone)
    ) {
      await page.mouse.move(0, 0);
      await page.screenshot({
        path: path.join(out, `${tone}.png`),
        fullPage: true,
      });
    }
    console.log(
      tone,
      normal.failed.length + hover.failed.length === 0 ? "PASS" : "FAIL",
      normal.checked,
      JSON.stringify([...normal.failed, ...hover.failed].slice(0, 6)),
    );
  }
  const summary = {
    url: base,
    date: "2026-10-05",
    fixture: "Synthetic; three real cards x twelve palettes at 1512px",
    results,
    errors,
    failures: results.reduce(
      (n, result) =>
        n + result.normal.failed.length + result.hover.failed.length,
      0,
    ),
  };
  await writeFile(
    path.join(out, "results.json"),
    JSON.stringify(summary, null, 2),
  );
  if (summary.failures || errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
