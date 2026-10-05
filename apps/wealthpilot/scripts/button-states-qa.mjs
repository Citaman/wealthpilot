// Isolated, fictional household: real button states and interactions, no user data.
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const base = "http://127.0.0.1:5201";
const out = path.resolve("../../tmp/button-states-qa");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1512, height: 982 },
  locale: "fr-FR",
});
const page = await context.newPage();
page.setDefaultTimeout(6000);
const checks = [],
  samples = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const check = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  if (!pass) console.error(name, detail);
};
const nav = page.getByRole("navigation", { name: "Navigation principale" });
const visit = (name) => nav.getByRole("button", { name, exact: true }).click();
async function state(button, label) {
  const result = await button.evaluate((el) => {
    const s = getComputedStyle(el),
      r = el.getBoundingClientRect();
    const rgb = (text) => text.match(/[\d.]+/g).map(Number);
    const lum = (color) =>
      rgb(color)
        .slice(0, 3)
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((v, x, i) => v + x * [0.2126, 0.7152, 0.0722][i], 0);
    let background = s.backgroundColor,
      parent = el.parentElement;
    while (
      (background === "rgba(0, 0, 0, 0)" || background === "transparent") &&
      parent
    ) {
      background = getComputedStyle(parent).backgroundColor;
      parent = parent.parentElement;
    }
    const a = lum(s.color),
      b = lum(background);
    return {
      text: el.textContent.trim() || el.getAttribute("aria-label"),
      color: s.color,
      background,
      contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      width: r.width,
      height: r.height,
      radius: s.borderRadius,
      disabled: el.disabled,
      pressed: el.getAttribute("aria-pressed"),
      outline: s.outlineStyle,
      outlineWidth: s.outlineWidth,
      overflow: el.scrollWidth > el.clientWidth + 2,
    };
  });
  samples.push({ label, ...result });
  return result;
}
async function inspect(selector, label) {
  const buttons = page.locator(selector);
  for (let i = 0; i < (await buttons.count()); i++) {
    const button = buttons.nth(i);
    if (!(await button.isVisible())) continue;
    await page.mouse.move(0, 0);
    const normal = await state(button, `${label}-${i}-normal`);
    check(`${label}-${i} fits its label`, !normal.overflow, normal);
    if (normal.disabled) continue;
    check(`${label}-${i} normal contrast`, normal.contrast >= 4.5, normal);
    await button.hover();
    await page.waitForTimeout(150); // sample the settled 120ms color transition, not a layout delay
    const hover = await state(button, `${label}-${i}-hover`);
    check(`${label}-${i} hover contrast`, hover.contrast >= 4.5, hover);
    check(
      `${label}-${i} no hover layout jump`,
      Math.abs(hover.width - normal.width) < 1 &&
        Math.abs(hover.height - normal.height) < 1,
    );
    await button.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    const focused = await state(button, `${label}-${i}-focus`);
    check(
      `${label}-${i} visible keyboard focus`,
      focused.outline !== "none" && parseFloat(focused.outlineWidth) >= 2,
      focused,
    );
  }
}
try {
  await page.clock.setFixedTime(new Date("2026-10-05T10:00:00Z"));
  await page.goto(base);
  await page.evaluate(async () => {
    const { db } = await import("/src/store.ts"),
      { defaultPreferences } = await import("/src/types.ts"),
      { migrateBoard, makeInstance, initialLayout } = await import(
        "/src/layout.ts"
      );
    const instances = ["budgets", "available", "chart"].map((type, i) => ({
      ...makeInstance(type, type),
      size: "medium",
      tone: ["paper", "ink", "pink"][i],
    }));
    const board = migrateBoard({ ...defaultPreferences, widgets: [] });
    board.views[0] = {
      ...board.views[0],
      instances,
      mobileOrder: instances.map((x) => x.id),
      layouts: Object.fromEntries(
        ["laptop", "desktop", "wide"].map((bp) => [
          bp,
          initialLayout(instances, bp),
        ]),
      ),
    };
    await db.accounts.put({
      id: "Foyer fictif",
      checkpoint: { date: "2026-10-05", amount: 420000 },
    });
    await db.transactions.bulkPut(
      Array.from({ length: 38 }, (_, i) => ({
        id: `t${i}`,
        date: `2026-10-0${(i % 4) + 1}`,
        amount: -1200,
        merchant: `Commerce ${i}`,
        label: `Commerce ${i}`,
        account: "Foyer fictif",
        category: ["Courses", "Transport", "Santé"][i % 3],
        internal: false,
        batchId: "fictif",
        fingerprint: `t${i}`,
        raw: {},
      })),
    );
    await db.budgets.bulkPut(
      ["Courses", "Transport", "Santé"].map((category, i) => ({
        id: `b${i}`,
        month: "2026-10",
        category,
        amount: 40000,
      })),
    );
    await db.preferences.put({
      ...defaultPreferences,
      board,
      setupDone: true,
      goal: null,
      extraGoals: [],
      safety: 50000,
      essentials: 0,
    });
    localStorage.setItem("wealthpilot-next-month", "2026-10");
  });
  await page.goto(base + "/#dashboard");
  await page.locator(".budget-display").waitFor();
  for (const label of ["3", "Tout"]) {
    await page
      .locator(".budget-display")
      .getByRole("button", { name: label, exact: true })
      .click();
    await page.waitForFunction((name) => {
      const buttons = [
        ...document.querySelectorAll(
          '.budget-display button[aria-pressed="true"]',
        ),
      ];
      return buttons.length === 1 && buttons[0].textContent === name;
    }, label);
    check(`Budget ${label} is the only selected choice`, true);
  }
  await inspect(
    ".budget-display button, .component-views button, .available-bottom button, .wp-dock button",
    "dashboard",
  );
  await page.getByRole("button", { name: "Organiser mon dashboard" }).click();
  await inspect(".dock-edit-actions button", "dashboard-edit");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await visit("Ma semaine");
  for (const width of [390, 768, 1024, 1512, 3840]) {
    await page.setViewportSize({ width, height: width === 3840 ? 2160 : 982 });
    const group = page.getByRole("group", { name: "Choisir la semaine" });
    for (const label of ["Cette semaine", "Prochaine"]) {
      await group.getByRole("button", { name: label, exact: true }).click();
      check(
        `week ${label} selected at ${width}`,
        (await group.locator('button[aria-pressed="true"]').count()) === 1 &&
          (await group
            .getByRole("button", { name: label, exact: true })
            .getAttribute("aria-pressed")) === "true",
      );
      await inspect(
        ".week-navigation .segmented button",
        `week-${label}-${width}`,
      );
    }
    const boxes = await group.getByRole("button").evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      }),
    );
    check(
      `week equal sizes and gap ${width}`,
      Math.abs(boxes[0].w - boxes[1].w) < 1 &&
        boxes[1].x - boxes[0].x - boxes[0].w >= 3,
      boxes,
    );
    check(
      `no page overflow ${width}`,
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.mouse.click(5, 5);
    await page
      .locator(".wp-dock")
      .screenshot({ path: path.join(out, `week-dock-${width}.png`) });
  }
  await page.setViewportSize({ width: 1512, height: 982 });
  await inspect(".week-page .button, .week-page .text-button", "week-actions");
  await visit("Transactions");
  await page.locator(".ledger-pagination").first().waitFor();
  await inspect(
    ".ledger-tabs button, .ledger-density-control button, .ledger-pagination button, .ledger-search button, .wp-dock button",
    "transactions",
  );
  await page.screenshot({ path: path.join(out, "transactions.png") });
  await visit("Import CSV");
  await inspect(".import-page button, .wp-dock button", "import");
  await page.screenshot({ path: path.join(out, "import.png") });
  check("no browser exception", errors.length === 0, errors);
} finally {
  await writeFile(
    path.join(out, "report.json"),
    JSON.stringify({ checks, samples, errors }, null, 2),
  );
  await browser.close();
  console.log(
    JSON.stringify({
      passed: checks.filter((x) => x.pass).length,
      failed: checks.filter((x) => !x.pass),
      errors,
    }),
  );
  if (checks.some((x) => !x.pass) || errors.length) process.exitCode = 1;
}
