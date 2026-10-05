// Isolated browser storage, deterministic synthetic fixtures, real recorded pointer gestures.
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const out = path.resolve("../../tmp/grid-qa");
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
const check = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  console.log(name, pass ? "PASS" : "FAIL", detail ?? "");
};
const shot = async (name) =>
  page.screenshot({ path: path.join(out, `${name}.png`) });
const coords = async (id) =>
  page.locator(`[data-instance="${id}"]`).evaluate((el) => ({
    transform: el.style.transform,
    width: el.style.width,
    height: el.style.height,
  }));
const tile = (id) => page.locator(`[data-instance="${id}"]`);
async function drag(id, dx, dy, name, escape = false) {
  const handle = tile(id).getByRole("button", { name: /^Déplacer/ });
  await handle.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const box = await handle.boundingBox(),
    x = box.x + 30,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 6 });
  await shot(`${name}-during`);
  if (escape) await page.keyboard.press("Escape");
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  await shot(`${name}-after`);
}
try {
  await page.clock.setFixedTime(new Date("2026-10-04T12:00:00Z"));
  await page.goto("http://127.0.0.1:5201");
  await page.evaluate(async () => {
    const { db } = await import("/src/store.ts"),
      { defaultPreferences } = await import("/src/types.ts"),
      { migrateBoard, makeInstance, addInstance } = await import(
        "/src/layout.ts"
      );
    const board = migrateBoard({ ...defaultPreferences, widgets: [] });
    let view = board.views[0];
    for (let n = 0; n < 30; n++) {
      const i = makeInstance("balance", `fixture-${n}`);
      i.source = { kind: "account", account: n % 2 ? "B" : "A" };
      view = addInstance(view, i);
    }
    for (const key of ["laptop", "desktop", "wide"]) {
      view.layouts[key][0] = {
        ...view.layouts[key][0],
        x: 0,
        y: 0,
        w: 8,
        h: 30,
      };
      view.layouts[key][1] = {
        ...view.layouts[key][1],
        x: 12,
        y: 0,
        w: 12,
        h: 30,
      };
    }
    board.views[0] = view;
    await db.accounts.bulkPut([
      { id: "A", checkpoint: { date: "2026-10-04", amount: 123400 } },
      { id: "B", checkpoint: { date: "2026-10-04", amount: 567800 } },
    ]);
    await db.transactions.put({
      id: "fixture",
      batchId: "fixture",
      date: "2026-10-04",
      amount: -1000,
      account: "A",
      merchant: "Démo",
      category: "Courses",
      label: "Démo",
      fingerprint: "fixture",
      internal: false,
      raw: {},
    });
    await db.preferences.put({
      ...defaultPreferences,
      setupDone: true,
      widgets: ["balance"],
      board,
    });
  });
  if (process.env.GRID_PERF === "1") {
    const storage = await context.storageState({ indexedDB: true });
    await context.close();
    const { runGridPerformance } = await import("./grid-performance-qa.mjs");
    await runGridPerformance(browser, storage);
    await browser.close();
    process.exit(process.exitCode || 0);
  }
  await page.goto("http://127.0.0.1:5201/#dashboard");
  await tile("fixture-0").waitFor();
  check(
    "30 rendered independent instances",
    (await page.locator("[data-instance]").count()) === 30,
  );
  check(
    "independent sources A/B",
    /1\s?234/.test(await tile("fixture-0").innerText()) &&
      /5\s?678/.test(await tile("fixture-1").innerText()),
  );
  await page
    .getByRole("button", { name: "Organiser mon dashboard", exact: true })
    .click();
  await shot("01-before");
  const neighbor = await coords("fixture-1"),
    initial = await coords("fixture-0");
  const containerWidth = await page
      .locator(".free-board-container")
      .evaluate((el) => el.clientWidth),
    col = (containerWidth + 16) / 24;
  await drag("fixture-0", col, 12, "02-move");
  check(
    "one-cell movement changes coordinates",
    JSON.stringify(await coords("fixture-0")) !== JSON.stringify(initial),
  );
  check(
    "neighbor unchanged after movement",
    JSON.stringify(await coords("fixture-1")) === JSON.stringify(neighbor),
  );
  const beforeCollision = await coords("fixture-0");
  await drag("fixture-0", col * 12, 0, "03-collision");
  check(
    "occupied target accepts drop and moves its neighbor",
    JSON.stringify(await coords("fixture-0")) !==
      JSON.stringify(beforeCollision) &&
      JSON.stringify(await coords("fixture-1")) !== JSON.stringify(neighbor),
    { before: beforeCollision, after: await coords("fixture-0") },
  );
  const resize = tile("fixture-0").locator(".react-resizable-handle-se");
  await resize.scrollIntoViewIfNeeded();
  const rb = await resize.boundingBox();
  await page.mouse.move(rb.x + 12, rb.y + 12);
  await page.mouse.down();
  await page.mouse.move(rb.x + 12 + col * 4, rb.y + 36, { steps: 8 });
  await shot("04-resize-during");
  await page.mouse.up();
  await page.waitForTimeout(200);
  await shot("04-resize-after");
  check(
    "resize selects a larger physical content tier",
    parseFloat((await coords("fixture-0")).width) >
      parseFloat(beforeCollision.width),
  );
  const beforeEscape = await coords("fixture-0");
  await drag("fixture-0", 0, 84, "05-escape", true);
  check(
    "Escape restores actual rendered coordinates without reloading",
    JSON.stringify(await coords("fixture-0")) === JSON.stringify(beforeEscape),
    { before: beforeEscape, after: await coords("fixture-0") },
  );
  await tile("fixture-0")
    .getByRole("button", { name: /Personnaliser/ })
    .click();
  await page
    .getByRole("spinbutton", { name: "Ligne de la carte" })
    .fill("1400");
  await page.getByRole("combobox", { name: "Source de cette carte" }).click();
  await page.getByRole("option", { name: "B", exact: true }).click();
  await page.getByRole("button", { name: "Terminer", exact: true }).click();
  await page.waitForFunction(async () => {
    const { db } = await import("/src/store.ts");
    return (await db.preferences.get("main")).board.revision > 0;
  });
  await page.reload();
  await tile("fixture-0").waitFor();
  await tile("fixture-0").scrollIntoViewIfNeeded();
  check(
    "saved coordinate survives reload",
    (await coords("fixture-0")).transform.includes("16800px"),
  );
  check(
    "saved source B changes computed value",
    /5\s?678/.test(await tile("fixture-0").innerText()),
  );
  const laptop = await coords("fixture-0");
  for (const width of [3840, 390, 1512]) {
    await page.setViewportSize({ width, height: 982 });
    await page.waitForTimeout(200);
    await tile("fixture-0").scrollIntoViewIfNeeded();
    await shot(`06-responsive-${width}`);
    check(
      `no overflow at ${width}`,
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
  }
  check(
    "desktop-mobile-desktop preserves laptop coordinates",
    JSON.stringify(await coords("fixture-0")) === JSON.stringify(laptop),
  );
  await page
    .getByRole("button", { name: "Organiser mon dashboard", exact: true })
    .click();
  await tile("fixture-0")
    .getByRole("button", { name: /Personnaliser/ })
    .click();
  await page
    .getByRole("spinbutton", { name: "Ligne de la carte" })
    .fill("1500");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await tile("fixture-0").scrollIntoViewIfNeeded();
  check(
    "cancel session restores saved positions",
    JSON.stringify(await coords("fixture-0")) === JSON.stringify(laptop),
  );
  check("no runtime errors", errors.length === 0, errors);
} catch (error) {
  check("flow completed", false, error.stack);
  await shot("failure").catch(() => {});
}
await context.close();
const video = await page.video().path();
await browser.close();
await writeFile(
  path.join(out, "results.json"),
  JSON.stringify({ checks, errors, video }, null, 2),
);
console.log("Evidence:", out);
if (checks.some((c) => !c.pass)) process.exitCode = 1;
