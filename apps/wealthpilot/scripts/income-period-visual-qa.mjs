// Read-only product audit. Only fictional data in a fresh isolated browser profile.
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const out = path.resolve("../../tmp/income-period-visual-qa");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: "fr-FR",
});
const page = await context.newPage();
page.setDefaultTimeout(8000);
const checks = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const check = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  console.log(pass ? "PASS" : "FAIL", name);
};
const route = (label) =>
  page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("button", { name: label, exact: true })
    .click();
const select = async (label, option) => {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};
const settle = () => page.waitForTimeout(200);
const rows = () =>
  page
    .locator(".ledger-entry input[type=checkbox]")
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("aria-label")));
const month = () =>
  page.getByRole("combobox", { name: "Mois budgétaire affiché", exact: true });
try {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00Z"));
  await page.goto("http://127.0.0.1:5201");
  await page.evaluate(async () => {
    const { db } = await import("/src/store.ts"),
      { defaultPreferences } = await import("/src/types.ts"),
      { migrateBoard, makeInstance, initialLayout, validateBoardState } =
        await import("/src/layout.ts");
    const instances = ["balance", "transactions", "budgets"].map((type) => ({
      ...makeInstance(type, type),
      size: "large",
    }));
    const board = migrateBoard({ ...defaultPreferences, widgets: [] });
    board.views[0] = {
      ...board.views[0],
      instances,
      mobileOrder: instances.map((i) => i.id),
      layouts: Object.fromEntries(
        ["laptop", "desktop", "wide"].map((bp) => [
          bp,
          initialLayout(instances, bp),
        ]),
      ),
    };
    if (!validateBoardState(board))
      throw new Error("Invalid synthetic fixture");
    await db.accounts.bulkPut(
      ["Alex", "Camille"].map((id) => ({
        id,
        checkpoint: { date: "2026-08-01", amount: 100000 },
      })),
    );
    const data = [
      [
        "refund",
        "2026-08-26",
        "Remboursement magasin",
        2300,
        "Alex",
        "Remboursements",
        false,
      ],
      [
        "aug-b",
        "2026-08-27",
        "Employeur Camille",
        230000,
        "Camille",
        "Salaires",
        false,
      ],
      [
        "aug-a",
        "2026-08-29",
        "Employeur Alex",
        260000,
        "Alex",
        "Salaires",
        false,
      ],
      [
        "old-rent",
        "2026-09-01",
        "Loyer septembre",
        -85000,
        "Alex",
        "Logement",
        false,
      ],
      [
        "internal",
        "2026-09-10",
        "Virement interne",
        20000,
        "Camille",
        "Virements",
        true,
      ],
      [
        "before",
        "2026-09-24",
        "Avant salaire",
        -1000,
        "Alex",
        "Courses",
        false,
      ],
      [
        "sep-b",
        "2026-09-25",
        "Employeur Camille",
        231000,
        "Camille",
        "Salaires",
        false,
      ],
      [
        "sep-a",
        "2026-09-26",
        "Employeur Alex",
        263000,
        "Alex",
        "Salaires",
        false,
      ],
      [
        "food",
        "2026-09-30",
        "Courses du cycle",
        -10000,
        "Camille",
        "Courses",
        false,
      ],
      [
        "rent",
        "2026-10-01",
        "Loyer octobre",
        -85000,
        "Alex",
        "Logement",
        false,
      ],
      [
        "coffee",
        "2026-10-03",
        "Café du samedi",
        -800,
        "Alex",
        "Restaurants",
        false,
      ],
      [
        "future-pay",
        "2026-10-24",
        "Employeur Camille",
        231000,
        "Camille",
        "Salaires",
        false,
      ],
      [
        "future",
        "2026-10-15",
        "Futur non encaissé",
        -2000,
        "Alex",
        "Courses",
        false,
      ],
      [
        "future-nov",
        "2026-11-10",
        "Novembre futur",
        -2000,
        "Alex",
        "Courses",
        false,
      ],
    ];
    await db.transactions.bulkPut(
      data.map(([id, date, merchant, amount, account, category, internal]) => ({
        id,
        date,
        merchant,
        label: merchant,
        amount,
        account,
        category,
        internal,
        raw: {},
        fingerprint: id,
        batchId: "synthetic",
      })),
    );
    await db.budgets.put({
      id: "courses",
      month: "2026-10",
      category: "Courses",
      amount: 30000,
    });
    await db.preferences.put({ ...defaultPreferences, setupDone: true, board });
    localStorage.removeItem("wealthpilot-period");
    localStorage.setItem("wealthpilot-next-month", "2026-10");
  });
  await page.goto("http://127.0.0.1:5201/#dashboard");
  await page.reload();
  await month().waitFor();
  await settle();
  check(
    "Manual 31-day cycle control removed",
    (await page
      .getByRole("combobox", { name: "Début du cycle budgétaire", exact: true })
      .count()) === 0,
  );
  check(
    "Current automatic month has actual household first-income boundary",
    (await month().innerText()).includes("octobre") &&
      /25 sept/.test(await month().getAttribute("title")),
    await month().getAttribute("title"),
  );
  await month().click();
  const options = await page.getByRole("option").allTextContents();
  check(
    "No future budget month is offered from future imported operations",
    options.every((o) => !o.includes("novembre")),
    options,
  );
  await page.keyboard.press("Escape");
  await page
    .locator('[data-instance="transactions"]')
    .getByRole("button", { name: "Tout voir", exact: true })
    .click();
  await settle();
  const currentRows = await rows();
  check(
    "Dashboard drilldown keeps Sep25→today actual history, excludes future imports",
    currentRows.length === 5 &&
      currentRows.some((r) => r.endsWith("2026-09-25")) &&
      currentRows.every(
        (r) =>
          !r.includes("2026-09-24") &&
          !r.includes("2026-10-15") &&
          !r.includes("2026-10-24"),
      ),
    currentRows,
  );
  await select("Compte affiché", "Alex");
  await settle();
  const alex = await rows();
  check(
    "Account filter does not move the shared household month boundary",
    alex.length === 3 && /25 sept/.test(await month().getAttribute("title")),
    { rows: alex, title: await month().getAttribute("title") },
  );
  await select("Mois budgétaire affiché", "septembre 2026");
  await settle();
  const septemberAlex = await rows();
  check(
    "Previous month uses its different actual Aug27 boundary and ends Sep24",
    septemberAlex.length === 3 &&
      /27 août/.test(await month().getAttribute("title")) &&
      /24 sept/.test(await month().getAttribute("title")),
    { rows: septemberAlex, title: await month().getAttribute("title") },
  );
  const accountBefore = await page
    .getByRole("combobox", { name: "Compte affiché", exact: true })
    .innerText();
  await page.reload();
  await month().waitFor();
  await settle();
  check(
    "Selected month persists on reload",
    (await month().innerText()).includes("septembre"),
    await month().innerText(),
  );
  check(
    "Selected account persists on reload",
    (await page
      .getByRole("combobox", { name: "Compte affiché", exact: true })
      .innerText()) === accountBefore,
    {
      before: accountBefore,
      after: await page
        .getByRole("combobox", { name: "Compte affiché", exact: true })
        .innerText(),
      rows: await rows(),
    },
  );
  await select("Période affichée", "Mois en cours");
  await settle();
  await route("Dashboard");
  await page.screenshot({ path: path.join(out, "dashboard-1440.png") });
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await settle();
    const geometry = await page.evaluate(() => {
      const dock = document
        .querySelector(".wp-dock-bar")
        .getBoundingClientRect();
      const controls = [
        ...document.querySelectorAll(".dock-filters button[role=combobox]"),
      ]
        .filter((el) => el.checkVisibility())
        .map((el) => {
          const b = el.getBoundingClientRect();
          return {
            label: el.id,
            left: b.left,
            right: b.right,
            top: b.top,
            bottom: b.bottom,
          };
        });
      const overlaps = controls.flatMap((a, i) =>
        controls
          .slice(i + 1)
          .filter(
            (b) =>
              a.left < b.right - 1 &&
              a.right > b.left + 1 &&
              a.top < b.bottom - 1 &&
              a.bottom > b.top + 1,
          ),
      );
      return {
        scroll: document.documentElement.scrollWidth,
        viewport: innerWidth,
        dock: { left: dock.left, right: dock.right },
        controls,
        overlaps,
      };
    });
    check(
      `Dock ${width} fits without overlapped period controls`,
      geometry.scroll <= width + 1 &&
        geometry.dock.left >= -1 &&
        geometry.dock.right <= width + 1 &&
        geometry.overlaps.length === 0,
      geometry,
    );
    await month().click();
    const popup = await page.getByRole("listbox").boundingBox();
    check(
      `Month picker ${width} remains inside viewport`,
      popup.x >= 0 && popup.x + popup.width <= width + 1,
      popup,
    );
    const optionDescription = await page
      .getByRole("option", { name: "octobre 2026", exact: true })
      .evaluate((el) => {
        const id = el.getAttribute("aria-describedby");
        const description = id ? document.getElementById(id) : null;
        const r = description?.getBoundingClientRect();
        return {
          name: el.getAttribute("aria-label"),
          text: description?.textContent,
          visible: description?.checkVisibility(),
          rect: r
            ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
            : null,
        };
      });
    check(
      `Actual history and estimated next boundary visible and associated at ${width}`,
      optionDescription.name === "octobre 2026" &&
        optionDescription.visible &&
        /25 sept\. 2026 — 5 oct\. 2026/.test(optionDescription.text ?? "") &&
        /premier revenu du foyer/.test(optionDescription.text ?? "") &&
        /prochaine frontière estimée : 24 oct\. 2026/.test(
          optionDescription.text ?? "",
        ) &&
        optionDescription.rect.left >= 0 &&
        optionDescription.rect.right <= width + 1,
      optionDescription,
    );
    if (width === 390)
      await page.screenshot({ path: path.join(out, "month-picker-390.png") });
    await page.keyboard.press("Escape");
  }
  const discoverability = await month().evaluate((el) => {
    const describedBy = el.getAttribute("aria-describedby");
    return {
      title: el.title,
      describedBy,
      description: describedBy
        ?.split(" ")
        .map((id) => document.getElementById(id)?.textContent)
        .join(" "),
    };
  });
  check(
    "Real dates can be discovered without mouse-only hover",
    !!discoverability.describedBy &&
      discoverability.description === discoverability.title &&
      /25 sept\. 2026 — 5 oct\. 2026/.test(discoverability.description ?? ""),
    discoverability,
  );
  await page.evaluate(() => {
    localStorage.setItem("wealthpilot-next-month", "2099-12");
    localStorage.setItem("wealthpilot-period", "1");
  });
  await page.reload();
  await month().waitFor();
  check(
    "Stale future saved month is clamped to actual current month",
    (await month().innerText()).includes("octobre") &&
      !(await month().innerText()).includes("2099"),
    await month().innerText(),
  );
  check("No runtime errors", errors.length === 0, errors);
} catch (error) {
  check("Scenario completes", false, String(error));
} finally {
  await writeFile(
    path.join(out, "report.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
  await context.close();
  await browser.close();
}
if (checks.some((c) => !c.pass)) process.exitCode = 1;
