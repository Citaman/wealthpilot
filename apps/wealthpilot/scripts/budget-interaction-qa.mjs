// Independent B1 evidence. An isolated Chromium context uses synthetic data only.
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const out = path.resolve("../../tmp/budget-interaction-qa");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1512, height: 1100 },
  locale: "fr-FR",
  recordVideo: { dir: out, size: { width: 1512, height: 1100 } },
});
const page = await context.newPage();
const checks = [],
  errors = [];
const check = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  if (!pass) throw new Error(name);
};
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.clock.setFixedTime(new Date("2026-10-04T12:00:00Z"));
  await page.goto("http://127.0.0.1:5201");
  await page.getByRole("heading", { name: "Import de données." }).waitFor();
  await page.evaluate(async () => {
    const { db } = await import("/src/store.ts");
    const { defaultPreferences } = await import("/src/types.ts");
    const cats = [
      "Courses",
      "Transport",
      "Santé",
      "Restaurants",
      "Loisirs",
      "Maison",
    ];
    await db.accounts.put({
      id: "A",
      checkpoint: { date: "2026-10-03", amount: 500000 },
    });
    await db.transactions.put({
      id: "t1",
      batchId: "synthetic",
      fingerprint: "t1",
      account: "A",
      date: "2026-10-02",
      label: "Épicerie test",
      merchant: "Épicerie test",
      category: "Courses",
      amount: -2500,
      internal: false,
      raw: {},
    });
    await db.budgets.bulkPut(
      cats.map((category, i) => ({
        id: `b${i}`,
        category,
        amount: 20000 + i * 1000,
        month: "2026-10",
      })),
    );
    await db.preferences.put({
      ...defaultPreferences,
      setupDone: true,
      widgets: ["budgets"],
      sizes: { budgets: "xlarge" },
      budgetOrder: cats,
      budgetLimit: 0,
      budgetView: "list",
    });
  });
  await page.goto("http://127.0.0.1:5201/#dashboard");
  await page.getByRole("heading", { name: "Vos budgets" }).waitFor();
  await page.waitForFunction(
    () => document.querySelectorAll(".budget-entry").length === 6,
  );
  const order = () =>
    page.locator(".budget-entry .budget-label strong").allTextContents();
  check(
    "six real budget rows rendered",
    (await order()).length === 6,
    await order(),
  );
  await page.screenshot({ path: path.join(out, "before.png"), fullPage: true });
  const source = page.locator(".budget-entry").filter({
    has: page.getByRole("button", { name: "Déplacer Maison", exact: true }),
  });
  const target = page.locator(".budget-entry").filter({
    has: page.getByRole("button", { name: "Déplacer Courses", exact: true }),
  });
  await source.dragTo(target);
  await page.waitForFunction(
    () =>
      document.querySelector(".budget-label strong")?.textContent === "Maison",
  );
  check(
    "native pointer drag last → first",
    (await order()).join("|") ===
      "Maison|Courses|Transport|Santé|Restaurants|Loisirs",
    await order(),
  );
  await page.screenshot({
    path: path.join(out, "after-native-drag.png"),
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("heading", { name: "Vos budgets" }).waitFor();
  check(
    "drag order survives reload",
    (await order())[0] === "Maison",
    await order(),
  );
  await page
    .getByRole("button", { name: "Déplacer Loisirs", exact: true })
    .click();
  check(
    "destination choice visibly announced",
    await page
      .getByRole("status")
      .filter({ hasText: "Déplacement de Loisirs" })
      .isVisible(),
  );
  await page.screenshot({
    path: path.join(out, "choosing-destination.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", {
      name: "Placer Loisirs à la place de Maison",
      exact: true,
    })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector(".budget-label strong")?.textContent === "Loisirs",
  );
  check(
    "two clicks last → first without dragging",
    (await order()).join("|") ===
      "Loisirs|Maison|Courses|Transport|Santé|Restaurants",
    await order(),
  );
  await page.reload();
  await page.getByRole("heading", { name: "Vos budgets" }).waitFor();
  check(
    "two-click placement survives reload",
    (await order())[0] === "Loisirs",
    await order(),
  );
  await page
    .getByRole("button", { name: "Déplacer Restaurants", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", {
      name: "Placer Restaurants à la place de Loisirs",
      exact: true,
    })
    .focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () =>
      document.querySelector(".budget-label strong")?.textContent ===
      "Restaurants",
  );
  check(
    "keyboard uses same destination action",
    (await order())[0] === "Restaurants",
  );
  await page.screenshot({
    path: path.join(out, "after-keyboard.png"),
    fullPage: true,
  });
  check("zero browser runtime errors", errors.length === 0, errors);
} catch (error) {
  checks.push({
    name: "completed all cases",
    pass: false,
    detail: String(error),
  });
  await page.screenshot({
    path: path.join(out, "failure.png"),
    fullPage: true,
  });
  process.exitCode = 1;
} finally {
  await writeFile(
    path.join(out, "results.json"),
    JSON.stringify(
      { isolated: true, checks, errors, video: await page.video()?.path() },
      null,
      2,
    ),
  );
  await context.close();
  await browser.close();
}
console.log(JSON.stringify(checks, null, 2));
