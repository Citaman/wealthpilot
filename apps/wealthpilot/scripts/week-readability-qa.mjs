// Isolated synthetic storage; never modifies the user's browser profile.
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const out = path.resolve("../../tmp/week-readability-qa");
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
function check(name, pass, detail) {
  checks.push({ name, pass, detail });
  if (!pass) throw new Error(name);
}
try {
  await page.clock.setFixedTime(new Date("2026-10-04T12:00:00Z"));
  await page.goto("http://127.0.0.1:5201");
  await page.getByRole("heading", { name: "Import de données." }).waitFor();
  await page.evaluate(async () => {
    const { db } = await import("/src/store.ts");
    const { defaultPreferences } = await import("/src/types.ts");
    const cats = [
      "Courses",
      "Restaurants",
      "Transport",
      "Loisirs",
      "Santé",
      "Shopping",
    ];
    await db.accounts.put({
      id: "Compte commun",
      checkpoint: { date: "2026-10-04", amount: 420000 },
      coverage: [
        {
          from: "2026-07-01",
          through: "2026-10-04",
          complete: true,
          batchId: "qa",
          sourceHash: "qa",
        },
      ],
    });
    await db.transactions.bulkPut(
      cats.map((category, i) => ({
        id: `t${i}`,
        batchId: "qa",
        date: "2026-10-02",
        amount: -1200,
        account: "Compte commun",
        label: category,
        merchant: category,
        category,
        internal: false,
        raw: {},
        fingerprint: `t${i}`,
      })),
    );
    await db.budgets.bulkPut(
      cats.map((category, i) => ({
        id: `b${i}`,
        month: "2026-10",
        category,
        amount: 40000,
      })),
    );
    await db.dues.bulkPut([
      {
        id: "d1",
        date: "2026-10-06",
        amount: -4500,
        label: "Abonnement transport",
        category: "Transport",
        account: "Compte commun",
      },
      {
        id: "d2",
        date: "2026-10-08",
        amount: -1999,
        label: "Internet",
        category: "Logement",
        account: "Compte commun",
      },
    ]);
    await db.preferences.put({
      ...defaultPreferences,
      setupDone: true,
      safety: 30000,
      weeklyPlans: [
        {
          start: "2026-10-05",
          account: "",
          reserve: 30000,
          reduction: 0,
          limits: Object.fromEntries(
            cats.map((c, i) => [c, [15000, 5500, 7000, 6000, 3000, 4000][i]]),
          ),
        },
      ],
    });
  });
  await page.goto("http://127.0.0.1:5201/#week");
  await page
    .getByRole("button", { name: "Tester un achat en Courses" })
    .waitFor();
  for (const width of [1512, 3840, 390]) {
    await page.setViewportSize({ width, height: width === 3840 ? 2160 : 982 });
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    const metrics = await page.locator(".week-page").evaluate((el) => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      nestedScroll: [...el.querySelectorAll("*")]
        .filter(
          (n) =>
            ["auto", "scroll"].includes(getComputedStyle(n).overflowY) &&
            n.scrollHeight > n.clientHeight + 2,
        )
        .map((n) => n.className),
      width: el.getBoundingClientRect().width,
    }));
    check(
      `no horizontal or nested scrolling at ${width}`,
      !metrics.overflow && !metrics.nestedScroll.length,
      metrics,
    );
    check(
      `no financial form in reading mode at ${width}`,
      (await page.getByRole("spinbutton").count()) === 0 &&
        (await page.getByRole("slider").count()) === 0,
    );
    await page.screenshot({
      path: path.join(out, `reading-${width}.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1512, height: 982 });
  await page
    .getByRole("button", { name: "Tester un achat en Courses" })
    .click();
  check(
    "contextual category and next week preserved",
    (
      await page.getByRole("combobox", { name: "Catégorie" }).textContent()
    ).includes("Courses") &&
      (await page.getByLabel("Date prévue").inputValue()) === "2026-10-05",
  );
  await page.getByLabel("Montant (€)").fill("25");
  await page.getByRole("button", { name: "Confirmer et simuler" }).click();
  await page.locator(".simulation-result").waitFor();
  await page.screenshot({
    path: path.join(out, "simulation-1512.png"),
    fullPage: true,
  });
  check(
    "simulation remains inline, no modal",
    (await page.getByRole("dialog").count()) === 0,
  );
  await page.getByRole("button", { name: "Fermer le simulateur" }).click();
  await page.getByRole("button", { name: "Ajuster ce plan" }).click();
  await page
    .getByRole("spinbutton", { name: "Objectif Courses (€)" })
    .fill("123");
  await page.getByRole("button", { name: "Cette semaine" }).click();
  check(
    "context change asks before losing a draft",
    await page
      .getByRole("button", { name: "Continuer à modifier" })
      .isVisible(),
  );
  await page.getByRole("button", { name: "Continuer à modifier" }).click();
  check(
    "draft amount survives continuation",
    (await page
      .getByRole("spinbutton", { name: "Objectif Courses (€)" })
      .inputValue()) === "123",
  );
  await page.screenshot({
    path: path.join(out, "editing-1512.png"),
    fullPage: true,
  });
  check("zero runtime errors", errors.length === 0, errors);
} catch (e) {
  checks.push({ name: "completed", pass: false, detail: String(e) });
  process.exitCode = 1;
  await page.screenshot({
    path: path.join(out, "failure.png"),
    fullPage: true,
  });
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
