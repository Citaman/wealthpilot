import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const out = path.resolve("../../tmp/inline-editor-qa");
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
const check = (name, pass, detail) => checks.push({ name, pass, detail });
try {
  await page.clock.setFixedTime(new Date("2026-10-04T12:00:00Z"));
  await page.goto("http://127.0.0.1:5201");
  await page.getByRole("heading", { name: "Import de données." }).waitFor();
  await page.evaluate(async () => {
    const { db } = await import("/src/store.ts");
    const { defaultPreferences } = await import("/src/types.ts");
    await db.accounts.bulkPut([
      { id: "A", checkpoint: { date: "2026-10-04", amount: 300000 } },
      { id: "B", checkpoint: { date: "2026-10-04", amount: 100000 } },
    ]);
    await db.transactions.put({
      id: "t",
      batchId: "qa",
      fingerprint: "qa",
      date: "2026-10-02",
      account: "A",
      amount: -1000,
      category: "Courses",
      merchant: "Fixture",
      label: "Fixture",
      internal: false,
      raw: {},
    });
    await db.budgets.put({
      id: "b",
      month: "2026-10",
      category: "Courses",
      amount: 20000,
    });
    await db.preferences.put({
      ...defaultPreferences,
      setupDone: true,
      widgets: ["available", "goal", "budgets", "balance"],
      sizes: {
        available: "medium",
        goal: "medium",
        budgets: "medium",
        balance: "medium",
      },
      goal: { name: "Maison", target: 1000000, saved: 10000 },
    });
  });
  await page.goto("http://127.0.0.1:5201/#dashboard");
  await page.getByText("Maison", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Modifier l’objectif" }).waitFor();
  await page.getByRole("button", { name: "Modifier l’objectif" }).click();
  await page
    .getByRole("textbox", { name: "Nom du projet 1", exact: true })
    .fill("Brouillon persistant");
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  for (const width of [1512, 3840]) {
    await page.setViewportSize({ width, height: width === 3840 ? 2160 : 982 });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 350)));
    check(
      `goal draft retained at ${width}`,
      (await page
        .getByRole("textbox", { name: "Nom du projet 1", exact: true })
        .inputValue()) === "Brouillon persistant",
    );
    const geometry = await page.locator(".free-tile").evaluateAll((tiles) =>
      tiles.map((tile) => {
        const bounds = tile.getBoundingClientRect(),
          inner = tile
            .querySelector(".free-tile-content")
            .getBoundingClientRect();
        return {
          id: tile.dataset.instance,
          height: bounds.height,
          contentHeight: inner.height,
          clipped: inner.bottom > bounds.bottom + 2,
          nested: [...tile.querySelectorAll("*")]
            .filter(
              (el) =>
                el.checkVisibility() &&
                ["auto", "scroll"].includes(getComputedStyle(el).overflowY) &&
                el.scrollHeight > el.clientHeight + 2,
            )
            .map((el) => el.className),
        };
      }),
    );
    check(
      `editor fully contained without nested scroll at ${width}`,
      geometry.every((t) => !t.clipped && !t.nested.length),
      geometry,
    );
    await page.screenshot({
      path: path.join(out, `editor-${width}.png`),
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Organiser mon dashboard", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Personnaliser Mon objectif", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Personnaliser Mon objectif", exact: true })
    .click();
  check(
    "organizing and opening inspector retains finance editor draft",
    (await page
      .getByRole("textbox", { name: "Nom du projet 1", exact: true })
      .inputValue()) === "Brouillon persistant",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => new Promise((r) => setTimeout(r, 350)));
  const mobileDraft = page.getByRole("textbox", {
    name: "Nom du projet 1",
    exact: true,
  });
  check(
    "desktop to mobile retains unsaved financial draft",
    (await mobileDraft.count()) > 0 &&
      (await mobileDraft.inputValue()) === "Brouillon persistant",
  );
  await page.screenshot({
    path: path.join(out, "editor-390.png"),
    fullPage: true,
  });
  await page.getByRole("combobox", { name: "Page de l’application" }).click();
  await page.getByRole("option", { name: "Transactions", exact: true }).click();
  await page.evaluate(() => new Promise((r) => setTimeout(r, 200)));
  if (page.url().endsWith("#transactions")) {
    await page.getByRole("combobox", { name: "Page de l’application" }).click();
    await page.getByRole("option", { name: "Dashboard", exact: true }).click();
    await page.locator(".free-board-container:visible").waitFor();
    if (
      !(await page
        .getByRole("textbox", { name: "Nom du projet 1", exact: true })
        .count())
    )
      await page.getByRole("button", { name: "Modifier l’objectif" }).click();
    const returned = await page
      .getByRole("textbox", { name: "Nom du projet 1", exact: true })
      .inputValue();
    check(
      "navigation does not silently discard a financial draft",
      returned === "Brouillon persistant",
      { returned },
    );
  } else {
    check(
      "navigation does not silently discard a financial draft",
      (await page
        .getByRole("textbox", { name: "Nom du projet 1", exact: true })
        .inputValue()) === "Brouillon persistant",
      { route: page.url() },
    );
  }
  check("zero runtime errors", errors.length === 0, errors);
} catch (e) {
  await page.screenshot({
    path: path.join(out, "failure.png"),
    fullPage: true,
  });
  checks.push({ name: "completed all checks", pass: false, detail: String(e) });
} finally {
  await writeFile(
    path.join(out, "results.json"),
    JSON.stringify(
      { checks, errors, video: await page.video()?.path() },
      null,
      2,
    ),
  );
  await context.close();
  await browser.close();
}
console.log(JSON.stringify(checks, null, 2));
if (checks.some((c) => !c.pass)) process.exitCode = 1;
