import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const out = path.resolve("../../tmp/pages-visual-qa");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
    viewport: { width: 1512, height: 982 },
    locale: "fr-FR",
  }),
  page = await context.newPage(),
  checks = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const check = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  console.log(name, pass ? "PASS" : "FAIL", detail ?? "");
};
try {
  await page.clock.setFixedTime(new Date("2026-10-04T12:00:00Z"));
  await page.goto("http://127.0.0.1:5201");
  await page.evaluate(async () => {
    const { db } = await import("/src/store.ts"),
      { defaultPreferences } = await import("/src/types.ts");
    const rows = Array.from({ length: 1100 }, (_, i) => ({
      id: `t${i}`,
      batchId: "test",
      fingerprint: `t${i}`,
      date: `2026-10-${String((i % 4) + 1).padStart(2, "0")}`,
      amount: -1000 - i,
      merchant: i % 2 ? "McDonald’s" : "Amazon",
      label: `Achat ${i}`,
      category: i % 2 ? "Courses" : "Shopping",
      account: "A",
      internal: false,
      raw: {},
    }));
    await db.transactions.bulkPut(rows);
    await db.accounts.bulkPut([
      { id: "A", checkpoint: { date: "2026-10-04", amount: 900000 } },
      { id: "B", checkpoint: { date: "2026-10-04", amount: 200000 } },
    ]);
    const goals = Array.from({ length: 101 }, (_, i) => ({
      name: `Projet ${i + 1} pour la famille`,
      saved: 1000,
      target: 100000,
      monthly: 1000,
      color: "#9b446f",
      icon: "house",
    }));
    await db.preferences.put({
      ...defaultPreferences,
      setupDone: true,
      goal: goals[0],
      extraGoals: goals.slice(1),
    });
    await db.budgets.bulkPut([
      { id: "a", month: "2026-10", category: "Courses", amount: 30000 },
      { id: "b", month: "2026-10", category: "Shopping", amount: 15000 },
    ]);
  });
  await page.goto("http://127.0.0.1:5201/#week");
  await page
    .getByRole("button", { name: "Cette semaine", exact: true })
    .click();
  await page.getByRole("button", { name: "Prochaine", exact: true }).click();
  await page
    .getByRole("button", { name: "Tester un achat", exact: true })
    .click();
  check(
    "simulator follows selected future week by default",
    (await page.getByLabel("Date prévue", { exact: true }).inputValue()) ===
      "2026-10-05",
    {
      actual: await page
        .getByLabel("Date prévue", { exact: true })
        .inputValue(),
      selected: "2026-10-05",
    },
  );
  await page.getByRole("button", { name: "Ajuster ce plan" }).click();
  await page
    .getByLabel("Réserve affectée à ce périmètre (€)", { exact: true })
    .fill("321");
  await page
    .getByRole("button", { name: "Cette semaine", exact: true })
    .click();
  check(
    "unsaved weekly draft is protected before context changes",
    (await page
      .getByLabel("Réserve affectée à ce périmètre (€)", { exact: true })
      .count()) > 0 &&
      (await page
        .getByRole("button", { name: "Continuer à modifier", exact: true })
        .count()) === 1,
  );
  await page
    .getByRole("button", { name: "Continuer à modifier", exact: true })
    .click();
  check(
    "continuing keeps entered reserve",
    (await page
      .getByLabel("Réserve affectée à ce périmètre (€)", { exact: true })
      .inputValue()) === "321",
  );
  await page.goto("http://127.0.0.1:5201/#transactions");
  await page
    .getByRole("table", { name: "Transactions", exact: true })
    .waitFor();
  const standard = await page
    .locator(".ledger-row")
    .nth(1)
    .evaluate((el) => el.getBoundingClientRect().height)
    .catch(() => null);
  await page.getByRole("button", { name: "Compacte", exact: true }).click();
  const compact = await page
    .locator(".ledger-row")
    .nth(1)
    .evaluate((el) => el.getBoundingClientRect().height)
    .catch(() => null);
  check(
    "density affects measured row height",
    standard !== null && compact < standard,
    { standard, compact },
  );
  const top = page.getByRole("navigation", {
    name: "Pagination des transactions — haut",
  });
  await top.getByRole("spinbutton").fill("38");
  await top.getByRole("button", { name: "OK", exact: true }).click();
  check(
    "direct page 38 synchronized top and bottom",
    (await page.getByText("Page 38 sur 44", { exact: true }).count()) === 2,
  );
  await page.screenshot({ path: path.join(out, "journal-page38.png") });
  await page.goto("http://127.0.0.1:5201/#goals");
  await page
    .getByRole("heading", { name: "Les projets qui comptent." })
    .waitFor();
  check(
    "101 projects one active editor",
    (await page.locator(".project-list button").count()) === 101 &&
      (await page.locator("fieldset.project-editor").count()) === 1,
  );
  await page.getByText("Icône et couleur", { exact: true }).click();
  await page.getByLabel("Rechercher une icône", { exact: true }).fill("maison");
  check(
    "icon search narrows results",
    (await page.getByRole("button", { name: /^Icône / }).count()) > 0 &&
      (await page.getByRole("button", { name: /^Icône / }).count()) < 60,
  );
  await page.screenshot({ path: path.join(out, "goals-1512.png") });
  for (const width of [390, 3840]) {
    await page.setViewportSize({ width, height: 982 });
    await page.screenshot({ path: path.join(out, `goals-${width}.png`) });
    check(
      `goals no overflow ${width}`,
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
  }
  await page.setViewportSize({ width: 390, height: 982 });
  await page.goto("http://127.0.0.1:5201/#import");
  await page.screenshot({ path: path.join(out, "import-390.png") });
  check(
    "import no overflow 390",
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Tab");
  check(
    "keyboard focus is visible and on a control",
    await page.evaluate(() => {
      const el = document.activeElement;
      return (
        el !== document.body &&
        ["BUTTON", "INPUT", "A"].includes(el.tagName) &&
        getComputedStyle(el).outlineStyle !== "none"
      );
    }),
  );
  await page.setViewportSize({ width: 756, height: 491 });
  await page.evaluate(() => (document.documentElement.style.zoom = "2"));
  await page.screenshot({ path: path.join(out, "import-200zoom.png") });
  check(
    "import reflows at CSS 200 percent zoom",
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await page.evaluate(() => (document.documentElement.style.zoom = ""));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("http://127.0.0.1:5201/#dashboard");
  await page.locator(".free-tile").first().waitFor();
  await page.waitForTimeout(200);
  const motion = await page
    .locator(".free-tile")
    .first()
    .evaluate((el) => ({
      duration: getComputedStyle(el).transitionDuration,
      media: matchMedia("(prefers-reduced-motion:reduce)").matches,
    }));
  check(
    "reduced motion disables grid transition",
    motion.duration === "0s",
    motion,
  );
  await page.goto("http://127.0.0.1:5201/#foyer");
  await page
    .getByRole("button", { name: "Proposer un partage égalitaire" })
    .click();
  await page.getByRole("button", { name: "Enregistrer cette règle" }).click();
  await page.waitForFunction(async () => {
    const { db } = await import("/src/store.ts");
    return (
      (await db.preferences.get("main")).householdPlan?.members[0].share === 50
    );
  });
  await page.getByLabel("Part de A (%)", { exact: true }).fill("60");
  await page.getByLabel("Part de B (%)", { exact: true }).fill("40");
  await page.getByRole("button", { name: "Enregistrer cette règle" }).click();
  await page.waitForFunction(async () => {
    const { db } = await import("/src/store.ts");
    return (
      (await db.preferences.get("main")).householdPlan?.members[0].share === 60
    );
  });
  check(
    "household second save is accepted without false conflict",
    (await page.getByText("Le partage a changé.", { exact: false }).count()) ===
      0,
  );
  await page.screenshot({ path: path.join(out, "household-two-saves.png") });
  await page.evaluate(async () => {
    const { db } = await import("/src/store.ts");
    await db.dues.clear();
    await db.dues.put({
      id: "overdue-income",
      label: "Revenu passé non rapproché",
      amount: 1000000,
      date: "2026-10-01",
      account: "A",
    });
  });
  await page.goto("http://127.0.0.1:5201/#previsions");
  await page
    .getByLabel("Retard des revenus attendus (jours)", { exact: true })
    .waitFor();
  const scenarioSection = page.locator("section.card").filter({
    has: page.getByRole("heading", {
      name: "Et si les choses changent ?",
      exact: true,
    }),
  });
  const previousPaths = await scenarioSection
    .locator("path")
    .evaluateAll((els) => els.map((el) => el.getAttribute("d")));
  await page
    .getByLabel("Retard des revenus attendus (jours)", { exact: true })
    .fill("7");
  await page.waitForTimeout(150);
  const changedPaths = await scenarioSection
    .locator("path")
    .evaluateAll((els) => els.map((el) => el.getAttribute("d")));
  check(
    "delaying future income does not resurrect past unmatched income",
    JSON.stringify(previousPaths) === JSON.stringify(changedPaths) &&
      previousPaths.length > 0,
  );
  await page.screenshot({ path: path.join(out, "forecast-overdue.png") });
  check("no runtime errors", errors.length === 0, errors);
} catch (error) {
  check("flow completed", false, error.stack);
  await page
    .screenshot({ path: path.join(out, "failure.png") })
    .catch(() => {});
}
await context.close();
await browser.close();
await writeFile(
  path.join(out, "results.json"),
  JSON.stringify({ checks, errors }, null, 2),
);
console.log(out);
if (checks.some((c) => !c.pass)) process.exitCode = 1;
