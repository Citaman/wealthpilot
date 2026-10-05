// WealthPilot v2 end-to-end walk-through. Run against a dev server:
//   npx vite --host 127.0.0.1 --port 5250 --strictPort &
//   node scripts/e2e.mjs [section…]      (sections: shell dashboard week plan transactions import visual)
// Prints PASS/FAIL per step and exits 1 when a step failed.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const app = process.env.APP ?? resolve(here, "..");
const repo = resolve(app, "../..");
const { chromium } = await import(
  process.env.PLAYWRIGHT ?? resolve(repo, "node_modules/playwright/index.mjs")
);
const BASE = process.env.BASE ?? "http://127.0.0.1:5250";
const SHOTS = process.env.SHOTS ?? resolve(repo, "tmp/v2-qa");
const only = process.argv.slice(2);
const TMP = mkdtempSync(resolve(tmpdir(), "wealthpilot-e2e-"));

const results = [];
let section = "";
let currentPage = null;
const consoleErrors = [];

async function step(name, fn) {
  const label = `${section} · ${name}`;
  try {
    await fn();
    results.push({ label, ok: true });
    console.log(`PASS ${label}`);
  } catch (error) {
    const message = String(error?.message ?? error).split("\n")[0];
    results.push({ label, ok: false, message });
    if (process.env.DEBUG && currentPage)
      await currentPage
        .screenshot({ path: resolve(TMP, `fail-${results.length}.png`) })
        .catch(() => {});
    console.log(`FAIL ${label} — ${message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch();

async function open(path = "/?demo#/", options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport ?? { width: 1512, height: 1000 },
    acceptDownloads: true,
    ...options.context,
  });
  if (options.permissions)
    await context.grantPermissions(options.permissions, { origin: BASE });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  currentPage = page;
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(`${section}: ${m.text()}`);
  });
  page.on("pageerror", (e) => consoleErrors.push(`${section}: ${e.message}`));
  await page.goto(BASE + path);
  await page.waitForSelector(".page:not([hidden])", { timeout: 15000 });
  await page.waitForTimeout(600);
  return { context, page };
}

const snapshot = (page) =>
  page.evaluate(async () => {
    const { readSnapshot } = await import("/src/data/db.ts");
    return readSnapshot();
  });

const activePage = (page) => page.locator(".page:not([hidden])");
const card = (page, title) =>
  page.locator(".board-cell").filter({
    has: page.locator(".ui-card-title, .ui-card-eyebrow", { hasText: title }),
  });
const toast = (page, text) =>
  page.locator(".toast-host .ui-toast").filter({ hasText: text }).last();

async function undo(page, text) {
  const t = toast(page, text);
  await t.waitFor({ timeout: 4000 });
  await t.getByRole("button", { name: "Annuler" }).click();
  await page.waitForTimeout(400);
}

async function clearToasts(page) {
  for (const close of await page.locator(".toast-host .ui-toast-close").all())
    await close.click().catch(() => {});
}

const uncategorized = (t) =>
  !t.category ||
  t.category.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase() ===
    "a categoriser";
const rules = async (page) =>
  ((await snapshot(page)).preferences.recurrenceRules ?? []).length;
async function focusKept(page, what) {
  await page.waitForTimeout(150);
  const tag = await page.evaluate(() => document.activeElement?.tagName);
  assert(tag && tag !== "BODY", `focus fell to body after ${what}`);
}
const hash = (page) => page.evaluate(() => location.hash);
const go = async (page, h) => {
  await page.evaluate((x) => (location.hash = x), h);
  await page.waitForTimeout(500);
};

async function waitFor(fn, message, timeout = 4000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(message);
}

/* ------------------------------------------------------------------ shell */

async function shell() {
  section = "shell";
  const { context, page } = await open();
  const dock = page.locator("nav.dock");

  await step("5 dock links with aria-current", async () => {
    const links = dock.locator(".dock-link");
    assert((await links.count()) === 5, `${await links.count()} links`);
    for (const [i, name] of [
      "Dashboard",
      "Ma semaine",
      "Notre plan",
      "Transactions",
      "Import CSV",
    ].entries()) {
      await links.nth(i).click();
      await page.waitForTimeout(300);
      assert(
        (await links.nth(i).getAttribute("aria-current")) === "page",
        `${name} not current`,
      );
      assert(
        (await activePage(page).locator("h1").textContent()) === name,
        `h1 for ${name}`,
      );
    }
  });

  await step("Alt+1..5 shortcuts", async () => {
    const expected = [
      "#/",
      "#/semaine",
      "#/plan",
      "#/transactions",
      "#/import",
    ];
    for (let i = 5; i >= 1; i--) {
      await page.locator("body").press(`Alt+Digit${i}`);
      await page.waitForTimeout(250);
      assert(
        (await hash(page)) === expected[i - 1],
        `Alt+${i} → ${await hash(page)}`,
      );
    }
  });

  await step("account picker opens upward and selects", async () => {
    const trigger = dock.locator(`button[aria-label="Compte"]`);
    await trigger.click();
    const listbox = page.locator(".ui-picker-content");
    await listbox.waitFor();
    const t = await trigger.boundingBox();
    const l = await listbox.boundingBox();
    assert(l.y + l.height <= t.y + 1, "menu not above trigger");
    await page.getByRole("option", { name: /Commun/ }).click();
    await page.waitForTimeout(300);
    assert((await trigger.textContent()).includes("Commun"), "not Commun");
  });

  await step("period picker opens upward, rolling choice", async () => {
    const trigger = dock.locator(`button[aria-label="Période"]`);
    await trigger.click();
    const listbox = page.locator(".ui-picker-content");
    await listbox.waitFor();
    const t = await trigger.boundingBox();
    const l = await listbox.boundingBox();
    assert(l.y + l.height <= t.y + 1, "menu not above trigger");
    assert(
      await page.locator(".dock-period-note").isVisible(),
      "footer note missing",
    );
    await page
      .getByRole("option", { name: "3 derniers mois" })
      .click()
      .catch(async () => {
        await page.getByRole("option", { name: /3 mois/ }).click();
      });
    await page.waitForTimeout(300);
    assert(!(await trigger.textContent()).includes("Octobre"), "still Octobre");
  });

  await step("month arrows step and disable at newest", async () => {
    const trigger = dock.locator(`button[aria-label="Période"]`);
    await trigger.click();
    await page.getByRole("option").first().click();
    await page.waitForTimeout(300);
    const next = dock.getByRole("button", { name: "Mois suivant" });
    assert(
      (await next.getAttribute("aria-disabled")) === "true",
      "next enabled on newest",
    );
    const before = await trigger.textContent();
    await dock.getByRole("button", { name: "Mois précédent" }).click();
    await page.waitForTimeout(300);
    const after = await trigger.textContent();
    assert(before !== after, "previous month did not change label");
    await next.click();
    await page.waitForTimeout(300);
    assert((await trigger.textContent()) === before, "next did not return");
    await dock.getByRole("button", { name: "Mois précédent" }).click();
    await page.waitForTimeout(300);
  });

  await step("context persists after reload", async () => {
    const label = await dock
      .locator(`button[aria-label="Période"]`)
      .textContent();
    await page.reload();
    await page.waitForSelector(".page:not([hidden])");
    await page.waitForTimeout(800);
    assert(
      (
        await dock.locator(`button[aria-label="Compte"]`).textContent()
      ).includes("Commun"),
      "account lost",
    );
    assert(
      (await dock.locator(`button[aria-label="Période"]`).textContent()) ===
        label,
      "period lost",
    );
    // Back to the defaults for the next sections.
    await dock.locator(`button[aria-label="Compte"]`).click();
    await page.getByRole("option", { name: /Foyer/ }).click();
    await dock.locator(`button[aria-label="Période"]`).click();
    await page.getByRole("option").first().click();
    await page.waitForTimeout(300);
  });

  await step(
    "back button from a drilldown restores dashboard scroll",
    async () => {
      await go(page, "#/");
      await page.evaluate(() => scrollTo(0, 900));
      await page.waitForTimeout(200);
      const y = await page.evaluate(() => scrollY);
      const link = activePage(page).locator(".env-name").first();
      await link.scrollIntoViewIfNeeded();
      const y2 = await page.evaluate(() => scrollY);
      await link.click();
      await page.waitForTimeout(500);
      assert(
        (await hash(page)).startsWith("#/transactions?cat="),
        `hash ${await hash(page)}`,
      );
      await page.goBack();
      await page.waitForTimeout(600);
      assert((await hash(page)) === "#/", "not back on dashboard");
      const back = await page.evaluate(() => scrollY);
      assert(Math.abs(back - y2) < 40, `scroll ${back} vs ${y2} (start ${y})`);
    },
  );

  await step(
    "changing the period keeps scroll and open disclosures",
    async () => {
      await go(page, "#/");
      const avail = card(page, "Libre jusqu");
      await avail.getByRole("button", { name: "Voir le calcul" }).click();
      await page.evaluate(() => scrollTo(0, 300));
      await page.waitForTimeout(200);
      await dock.locator(`button[aria-label="Mois précédent"]`).click();
      await page.waitForTimeout(400);
      assert(
        Math.abs((await page.evaluate(() => scrollY)) - 300) < 5,
        `scroll ${await page.evaluate(() => scrollY)}`,
      );
      assert(
        (await avail
          .getByRole("button", { name: "Voir le calcul" })
          .getAttribute("aria-expanded")) === "true",
        "disclosure closed",
      );
      await dock.locator(`button[aria-label="Mois suivant"]`).click();
    },
  );

  await step("another tab's write updates this view (live query)", async () => {
    const other = await context.newPage();
    await other.goto(BASE + "/#/");
    await other.waitForSelector(".page:not([hidden])");
    await other.evaluate(async () => {
      const { setSafety } = await import("/src/data/commands.ts");
      await setSafety(123400);
    });
    await page.waitForTimeout(800);
    const reserve = await card(page, "Libre jusqu").textContent();
    assert(reserve.replace(/\s/g, "").includes("1234"), "not refreshed");
    await other.evaluate(async () => {
      const { setSafety } = await import("/src/data/commands.ts");
      await setSafety(60000);
    });
    await other.close();
  });

  await step("legacy hash #week redirects", async () => {
    await page.evaluate(() => (location.hash = "#week"));
    await page.waitForTimeout(400);
    assert((await hash(page)) === "#/semaine", await hash(page));
  });

  await context.close();
}

/* -------------------------------------------------------------- dashboard */

const cardTitles = (page) =>
  page
    .locator(".board-cell")
    .evaluateAll((cells) =>
      cells.map(
        (c) =>
          c.querySelector(".board-editbar-name")?.textContent ??
          c.querySelector(".ui-card-title, .ui-card-eyebrow")?.textContent,
      ),
    );

async function pointerDrag(page, from, to, steps = 18) {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  const x0 = a.x + a.width / 2;
  const y0 = a.y + a.height / 2;
  const x1 = b.x + b.width * 0.25;
  const y1 = b.y + b.height * 0.25;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      x0 + ((x1 - x0) * i) / steps,
      y0 + ((y1 - y0) * i) / steps,
    );
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(250);
  await page.mouse.up();
  await page.waitForTimeout(400);
}

async function dashboard() {
  section = "dashboard";
  const { context, page } = await open();
  const dock = page.locator("nav.dock");
  const initial = await cardTitles(page);

  await step("default layout has 9 cards in contract order", async () => {
    assert(initial.length === 9, `${initial.length} cards: ${initial}`);
    assert(initial[0] === "Solde", initial.join(","));
  });

  await step("Organiser shows edit bars and swaps dock commands", async () => {
    await dock.getByRole("button", { name: "Organiser" }).click();
    await page.waitForTimeout(300);
    assert((await page.locator(".board-editbar").count()) === 9, "edit bars");
    for (const name of ["Ajouter", "Annuler", "Terminer"])
      assert(await dock.getByRole("button", { name }).isVisible(), name);
    assert(
      (await page.locator(".board-card[inert]").count()) === 9,
      "cards not inert",
    );
  });

  await step("pointer drag moves Comptes before Solde", async () => {
    const handle = card(page, "Comptes").locator(".board-handle");
    const target = page.locator(".board-cell").first();
    await page.evaluate(() => scrollTo(0, 0));
    // Grab, then let auto-scroll bring the first card into view.
    const a = await handle.boundingBox();
    await handle.scrollIntoViewIfNeeded();
    await pointerDrag(page, handle, target, 40);
    const order = await cardTitles(page);
    assert(
      order[0] === "Comptes",
      `order ${order.join(",")} (handle at ${Math.round(a.y)})`,
    );
    assert(
      (await page.evaluate(() => document.activeElement?.className)).includes(
        "board-handle",
      ),
      "focus not on handle after drop",
    );
  });

  await step(
    "keyboard drag (Space, →, Space) moves the card back",
    async () => {
      const handle = card(page, "Comptes").locator(".board-handle");
      await handle.focus();
      await page.keyboard.press("Space");
      for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Space");
      await page.waitForTimeout(300);
      const order = await cardTitles(page);
      assert(order.at(-1) === "Comptes", order.join(","));
    },
  );

  await step("width segment changes the card span", async () => {
    const cell = card(page, "Solde");
    const before = await cell.evaluate((c) =>
      c.style.getPropertyValue("--span"),
    );
    await cell.getByRole("radio", { name: "Pleine largeur" }).click();
    await page.waitForTimeout(300);
    const after = await cell.evaluate((c) =>
      c.style.getPropertyValue("--span"),
    );
    assert(after === "12" && before !== after, `span ${before} → ${after}`);
  });

  await step("palette popover applies Rose", async () => {
    const cell = card(page, "Solde");
    await cell.locator(".board-swatch-trigger").click();
    await page.locator(".board-palette-option", { hasText: "Rose" }).click();
    await page.waitForTimeout(200);
    assert(
      await cell.locator(".ui-card.palette-pink").count(),
      "palette-pink not applied",
    );
  });

  await step("remove a card then Annuler in the toast", async () => {
    await card(page, "Opérations")
      .getByRole("button", { name: "Retirer Opérations" })
      .click();
    await page.waitForTimeout(300);
    assert((await page.locator(".board-cell").count()) === 8, "not removed");
    await undo(page, "Carte retirée");
    assert((await page.locator(".board-cell").count()) === 9, "not restored");
  });

  await step("Ajouter sheet adds « Puis-je dépenser ? »", async () => {
    await dock.getByRole("button", { name: "Ajouter" }).click();
    const sheet = page.getByRole("dialog", { name: "Ajouter une carte" });
    await sheet.waitFor();
    await sheet.getByPlaceholder("Rechercher").fill("dépenser");
    const item = sheet
      .locator(".add-item")
      .filter({ hasText: "Puis-je dépenser" });
    assert(
      (await sheet.locator(".add-item").count()) === 1,
      "search did not filter",
    );
    await item.getByRole("button", { name: "Ajouter" }).click();
    await page.waitForTimeout(800);
    assert(!(await sheet.isVisible()), "sheet still open");
    assert((await page.locator(".board-cell").count()) === 10, "not added");
  });

  await step("Terminer saves the layout (toast + DB)", async () => {
    await dock.getByRole("button", { name: "Terminer" }).click();
    await toast(page, "Disposition enregistrée").waitFor();
    const db = await snapshot(page);
    const cards = db.preferences.dashboard.cards;
    assert(cards.length === 10, `${cards.length} saved`);
    const balance = cards.find((c) => c.type === "balance");
    assert(
      balance.width === 12 && balance.palette === "pink",
      JSON.stringify(balance),
    );
    assert(
      cards.some((c) => c.type === "simulate"),
      "simulate missing",
    );
  });

  await step("layout persists after reload", async () => {
    await page.reload();
    await page.waitForSelector(".board-cell");
    await page.waitForTimeout(600);
    assert((await page.locator(".board-cell").count()) === 10, "count");
    assert(
      await card(page, "Solde").locator(".palette-pink").count(),
      "palette",
    );
  });

  await step("Organiser then Annuler drops the draft", async () => {
    await dock.getByRole("button", { name: "Organiser" }).click();
    await card(page, "Puis-je dépenser")
      .getByRole("button", { name: /Retirer/ })
      .first()
      .click();
    await dock.getByRole("button", { name: "Annuler" }).click();
    await page.waitForTimeout(300);
    assert((await page.locator(".board-cell").count()) === 10, "draft kept");
    assert(!(await page.locator(".board-editbar").count()), "still editing");
  });

  await clearToasts(page);
  const balance = card(page, "Solde");

  await step("Solde Réel/Prévision toggle is saved per card", async () => {
    await balance.getByRole("radio", { name: "Réel" }).click();
    await page.waitForTimeout(400);
    let db = await snapshot(page);
    let opt = db.preferences.dashboard.cards.find(
      (c) => c.type === "balance",
    ).options;
    assert(opt?.forecast === false, JSON.stringify(opt));
    await balance.getByRole("radio", { name: "+ Prévision" }).click();
    await page.waitForTimeout(400);
    db = await snapshot(page);
    opt = db.preferences.dashboard.cards.find(
      (c) => c.type === "balance",
    ).options;
    assert(opt?.forecast === true, JSON.stringify(opt));
  });

  await step(
    "click a past day on the balance chart → transactions of that day",
    async () => {
      const chart = balance.getByRole("slider");
      const box = await chart.boundingBox();
      await page.mouse.move(box.x + box.width * 0.08, box.y + box.height / 2);
      await page.waitForTimeout(150);
      await page.mouse.click(box.x + box.width * 0.08, box.y + box.height / 2);
      await page.waitForTimeout(500);
      const h = await hash(page);
      assert(/^#\/transactions\?from=\d{4}-\d\d-\d\d&to=/.test(h), h);
      const params = new URLSearchParams(h.split("?")[1]);
      assert(params.get("from") === params.get("to"), `range ${params}`);
      await page.goBack();
      await page.waitForTimeout(500);
    },
  );

  await step("chart keyboard: ← then Entrée drills into that day", async () => {
    const chart = balance.getByRole("slider");
    await chart.focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    assert(
      (await hash(page)).startsWith("#/transactions?from="),
      await hash(page),
    );
    await page.goBack();
    await page.waitForTimeout(500);
  });

  const avail = card(page, "Libre jusqu");
  await step(
    "Disponible « Voir le calcul » + edit réserve + undo",
    async () => {
      await avail.getByRole("button", { name: "Voir le calcul" }).click();
      await page.waitForTimeout(300);
      assert(
        await avail.locator(".ui-waterfall").isVisible(),
        "waterfall hidden",
      );
      await avail
        .getByRole("button", { name: "Réserve de sécurité : modifier" })
        .click();
      const input = avail.getByRole("textbox", { name: "Réserve de sécurité" });
      await input.fill("750");
      await input.press("Enter");
      await page.waitForTimeout(400);
      let db = await snapshot(page);
      assert(
        db.preferences.safety === 75000,
        `safety ${db.preferences.safety}`,
      );
      await undo(page, "Réserve de sécurité modifiée");
      db = await snapshot(page);
      assert(
        db.preferences.safety === 60000,
        `safety after undo ${db.preferences.safety}`,
      );
    },
  );

  await step(
    "Disponible: invalid reserve keeps value with an error",
    async () => {
      await avail
        .getByRole("button", { name: "Réserve de sécurité : modifier" })
        .click();
      const input = avail.getByRole("textbox", { name: "Réserve de sécurité" });
      await input.fill("abc");
      await input.press("Enter");
      assert(await avail.getByRole("alert").isVisible(), "no error message");
      await input.press("Escape");
      const db = await snapshot(page);
      assert(db.preferences.safety === 60000, "changed");
    },
  );

  await step("Disponible: charges list expands", async () => {
    const toggle = avail.locator(".available-toggle");
    await toggle.click();
    assert(
      (await avail.locator(".available-charges li").count()) > 0,
      "no charges",
    );
    await toggle.click();
  });

  const env = card(page, "Enveloppes");
  await step("Enveloppes: edit an allocation + undo", async () => {
    const before = (await snapshot(page)).budgets.find(
      (b) => b.category === "Food",
    );
    await env.getByRole("button", { name: "Alloué Food : modifier" }).click();
    const input = env.getByRole("textbox", { name: "Alloué Food" });
    await input.fill("812");
    await input.press("Enter");
    await page.waitForTimeout(400);
    const db = await snapshot(page);
    const food = db.budgets.filter((b) => b.category === "Food");
    assert(
      food.some((b) => b.amount === 81200),
      JSON.stringify(food),
    );
    await undo(page, "Enveloppe Food");
    const back = (await snapshot(page)).budgets.filter(
      (b) => b.category === "Food",
    );
    assert(!back.some((b) => b.amount === 81200), JSON.stringify(back));
  });

  await step(
    "Enveloppes: add envelope from the menu (opens in edit)",
    async () => {
      const count = (await snapshot(page)).budgets.length;
      await env.getByRole("button", { name: "Enveloppe", exact: true }).click();
      const menu = page.locator("[role=menu]").last();
      await menu.waitFor();
      const item = menu.getByRole("menuitem").first();
      const name = (await item.locator(".ui-menu-label").textContent()).trim();
      await item.click();
      await page.waitForTimeout(500);
      const db = await snapshot(page);
      assert(
        db.budgets.length === count + 1,
        `${db.budgets.length} vs ${count}`,
      );
      assert(
        await env.getByRole("textbox", { name: `Alloué ${name}` }).isVisible(),
        "new envelope not in edit",
      );
      await page.keyboard.press("Escape");
      await undo(page, `Enveloppe ${name} créée`);
      assert((await snapshot(page)).budgets.length === count, "undo failed");
    },
  );

  await step(
    "Enveloppes: reorder with Alt+↓ and with the pointer",
    async () => {
      const names = () => env.locator(".env-name").allTextContents();
      const before = await names();
      await env.locator(".env-name").first().focus();
      await page.keyboard.press("Alt+ArrowDown");
      await page.waitForTimeout(500);
      const after = await names();
      assert(after[1] === before[0], `${before} → ${after}`);
      let db = await snapshot(page);
      assert(
        db.preferences.budgetOrder.indexOf(before[0]) >
          db.preferences.budgetOrder.indexOf(before[1]),
        "order not saved",
      );
      const rows = env.locator(".env-row");
      await rows.nth(1).hover();
      await pointerDrag(
        page,
        rows.nth(1).locator(".env-handle"),
        rows.nth(0),
        20,
      );
      const final = await names();
      assert(final[0] === before[0], `pointer: ${final}`);
    },
  );

  const upcoming = card(page, "À venir");
  await step("À venir: ignore an occurrence + undo", async () => {
    const first = upcoming
      .locator(".agenda-rows > li")
      .filter({ hasText: "Estimé" })
      .first();
    const label = (
      await first
        .getByRole("button", { name: /^Actions pour / })
        .getAttribute("aria-label")
    ).replace("Actions pour ", "");
    await first.getByRole("button", { name: /^Actions pour / }).click();
    await page
      .getByRole("menuitem", { name: "Ignorer cette occurrence" })
      .click();
    await page.waitForTimeout(400);
    assert(
      !(await upcoming
        .getByRole("button", { name: `Actions pour ${label}` })
        .count()),
      `${label} still listed`,
    );
    await focusKept(page, "ignoring an occurrence");
    await undo(page, "Occurrence ignorée");
    assert(
      await upcoming
        .getByRole("button", { name: `Actions pour ${label}` })
        .count(),
      `${label} not back`,
    );
  });

  await step("À venir: edit an amount inline", async () => {
    const first = upcoming
      .locator(".agenda-rows > li")
      .filter({ hasText: "Estimé" })
      .first();
    const trigger = first.getByRole("button", { name: /^Actions pour / });
    const label = (await trigger.getAttribute("aria-label")).replace(
      "Actions pour ",
      "",
    );
    await trigger.click();
    await page.getByRole("menuitem", { name: "Modifier le montant" }).click();
    const input = upcoming.getByRole("textbox", {
      name: `Montant de ${label}`,
    });
    await input.waitFor();
    await input.fill("71,5");
    await input.press("Enter");
    await page.waitForTimeout(500);
    const db = await snapshot(page);
    assert(
      db.dues.some((d) => d.amount === -7150),
      JSON.stringify(db.dues.map((d) => d.amount)),
    );
    assert(await upcoming.getByText("−71,50").count(), "amount not shown");
    await undo(page, "Montant modifié");
  });

  await step("À venir: + Échéance creates a due", async () => {
    await upcoming.getByRole("button", { name: "Échéance" }).click();
    const form = upcoming.getByRole("form", { name: "Nouvelle échéance" });
    await form.getByLabel("Libellé").fill("Vétérinaire");
    await form.getByRole("textbox", { name: "Montant" }).fill("65");
    const d = await page.evaluate(() => {
      const t = new Date();
      t.setDate(t.getDate() + 2);
      return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    });
    await form.getByLabel("Date").fill(d);
    await form.getByRole("button", { name: "Ajouter" }).click();
    await page.waitForTimeout(500);
    const db = await snapshot(page);
    const due = db.dues.find((x) => x.label === "Vétérinaire");
    assert(due && due.amount === -6500 && due.date === d, JSON.stringify(due));
    assert(await upcoming.getByText("Vétérinaire").count(), "not listed");
  });

  await step(
    "Où part l'argent: subcategory chip drills to cat › sub",
    async () => {
      const spending = card(page, "Où part");
      await spending
        .locator(".rank-sub", { hasText: "Groceries" })
        .first()
        .click();
      await page.waitForTimeout(400);
      const h = decodeURIComponent(await hash(page));
      assert(
        h.includes("cat=Food › Groceries") ||
          h.includes("cat=Food+›+Groceries"),
        h,
      );
      await page.goBack();
      await page.waitForTimeout(400);
    },
  );

  await step(
    "Où part l'argent: « Autres » chip drills to operations without subcategory",
    async () => {
      const spending = card(page, "Où part");
      const chip = spending.locator(".rank-sub", { hasText: "Autres" }).first();
      const amount = (await chip.locator(".ui-money").textContent()).replace(
        /\D/g,
        "",
      );
      await chip.click();
      await page.waitForTimeout(500);
      const tx = activePage(page);
      const rows = tx.locator("tbody tr[data-row]");
      const cats = await rows.locator("td:nth-child(4)").allTextContents();
      assert(
        cats.length && cats.every((c) => !c.includes("›")),
        cats.slice(0, 3).join("|"),
      );
      const sortie = (await tx.locator(".tx-summary").textContent()).replace(
        /\s/g,
        "",
      );
      await page.goBack();
      await page.waitForTimeout(400);
      const spent = Math.round(
        Number(
          sortie
            .match(/Sorties−([\d,.]+)/)[1]
            .replace(/\./g, "")
            .replace(",", "."),
        ),
      );
      assert(String(spent) === amount, `summary ${sortie} vs chip ${amount}`);
    },
  );

  await step("À traiter: categorize via a suggestion chip + undo", async () => {
    const inbox = card(page, "À traiter");
    const group = inbox.getByRole("group", { name: /^Catégorie de / }).first();
    const name = (await group.getAttribute("aria-label")).replace(
      "Catégorie de ",
      "",
    );
    const before = (await snapshot(page)).transactions.filter(
      uncategorized,
    ).length;
    await group.locator(".inbox-chip").first().click();
    await page.waitForTimeout(500);
    const after = (await snapshot(page)).transactions.filter(
      uncategorized,
    ).length;
    assert(after === before - 1, `${before} → ${after}`);
    await undo(page, name);
    assert(
      (await snapshot(page)).transactions.filter(uncategorized).length ===
        before,
      "undo",
    );
  });

  const accounts = card(page, "Comptes");
  await step("Comptes: rename inline + undo", async () => {
    await accounts
      .getByRole("button", { name: "Nom du compte Alex : modifier" })
      .click();
    const input = accounts.getByRole("textbox", { name: "Nom du compte Alex" });
    await input.fill("Alex perso");
    await input.press("Enter");
    await page.waitForTimeout(400);
    assert(await accounts.getByText("Alex perso").count(), "not renamed");
    assert(
      JSON.stringify((await snapshot(page)).preferences).includes("Alex perso"),
      "not in DB",
    );
    await undo(page, "Compte renommé");
    assert(!(await accounts.getByText("Alex perso").count()), "undo");
  });

  await step(
    "Comptes: saisir le solde observé creates a checkpoint",
    async () => {
      await accounts.getByRole("button", { name: "Actions pour Sam" }).click();
      await page
        .getByRole("menuitem", { name: "Saisir le solde observé" })
        .click();
      const input = accounts.getByRole("textbox", {
        name: "Solde observé de Sam",
      });
      await input.waitFor();
      await input.fill("450");
      await input.press("Enter");
      await page.waitForTimeout(200);
      assert(await accounts.getByText("écart").count(), "gap not shown");
      await accounts.getByRole("button", { name: "Enregistrer" }).click();
      await page.waitForTimeout(500);
      const sam = (await snapshot(page)).accounts.find((a) => a.id === "Sam");
      const all = [sam.checkpoint, ...(sam.checkpoints ?? [])].filter(Boolean);
      assert(
        all.some((c) => c.amount === 45000),
        JSON.stringify(all),
      );
      await undo(page, "Solde Sam enregistré");
    },
  );

  await step(
    "Opérations: click a row → Transactions with that row open",
    async () => {
      const recent = card(page, "Opérations");
      await recent
        .locator("button")
        .filter({ hasText: "Assurance MAIF" })
        .first()
        .click();
      await page.waitForTimeout(600);
      assert(
        (await hash(page)).startsWith("#/transactions?tx="),
        await hash(page),
      );
      assert(
        await activePage(page)
          .getByRole("region", { name: /^Détail de / })
          .isVisible(),
        "row not open",
      );
      await page.goBack();
      await page.waitForTimeout(500);
    },
  );

  await step("Cette semaine card click → Ma semaine", async () => {
    await card(page, "Cette semaine")
      .locator(".ui-card")
      .click({ position: { x: 30, y: 30 } });
    await page.waitForTimeout(500);
    assert((await hash(page)).startsWith("#/semaine"), await hash(page));
    await page.goBack();
    await page.waitForTimeout(500);
  });

  await step("À traiter: confirm a recurrence + undo", async () => {
    const inbox = card(page, "À traiter");
    const before = await rules(page);
    await inbox.getByRole("button", { name: "Confirmer" }).first().click();
    await page.waitForTimeout(500);
    assert((await rules(page)) === before + 1, "rule not saved");
    await undo(page, "Récurrence confirmée");
    assert((await rules(page)) === before, "undo");
  });

  await step("Puis-je dépenser ? card gives a live verdict", async () => {
    const sim = card(page, "Puis-je dépenser");
    await sim.getByLabel("Montant").fill("15");
    await page.waitForTimeout(300);
    assert(await sim.locator(".purchase-verdict").isVisible(), "no verdict");
    await sim.getByRole("button", { name: "Effacer" }).click();
  });

  await step(
    "Entrées et sorties: added card, keyboard month → transactions",
    async () => {
      await dock.getByRole("button", { name: "Organiser" }).click();
      await dock.getByRole("button", { name: "Ajouter" }).click();
      const sheet = page.getByRole("dialog", { name: "Ajouter une carte" });
      await sheet.getByPlaceholder("Rechercher").fill("sorties");
      await sheet
        .locator(".add-item")
        .filter({
          has: page.getByRole("heading", { name: "Entrées et sorties" }),
        })
        .getByRole("button", { name: "Ajouter" })
        .click();
      await page.waitForTimeout(600);
      await dock.getByRole("button", { name: "Terminer" }).click();
      await page.waitForTimeout(500);
      const flows = card(page, "Entrées et sorties");
      const chart = flows.getByRole("slider");
      await chart.focus();
      await page.keyboard.press("End");
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);
      const h = await hash(page);
      assert(/^#\/transactions\?from=\d{4}-\d\d-\d\d&to=/.test(h), h);
      await page.goBack();
      await page.waitForTimeout(500);
    },
  );

  await step(
    "Où part l'argent: category name drills with the period",
    async () => {
      await card(page, "Où part").locator(".rank-name").first().click();
      await page.waitForTimeout(400);
      const h = decodeURIComponent(await hash(page));
      assert(/cat=Housing/.test(h) && /from=/.test(h), h);
      await page.goBack();
      await page.waitForTimeout(400);
    },
  );

  await step(
    "organize: Escape cancels a keyboard drag; menu « Descendre »",
    async () => {
      await dock.getByRole("button", { name: "Organiser" }).click();
      const before = await cardTitles(page);
      const handle = page
        .locator(".board-cell")
        .first()
        .locator(".board-handle");
      await handle.focus();
      await page.keyboard.press("Space");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      assert(
        JSON.stringify(await cardTitles(page)) === JSON.stringify(before),
        "Escape did not restore",
      );
      await page
        .locator(".board-cell")
        .first()
        .getByRole("button", { name: /^Actions de / })
        .click();
      await page.getByRole("menuitem", { name: "Descendre" }).click();
      await page.waitForTimeout(300);
      const after = await cardTitles(page);
      assert(after[1] === before[0], after.join(","));
      await dock.getByRole("button", { name: "Annuler" }).click();
    },
  );

  await step("organize draft survives a page change", async () => {
    await dock.getByRole("button", { name: "Organiser" }).click();
    await card(page, "Comptes")
      .getByRole("button", { name: "Retirer Comptes" })
      .click();
    await go(page, "#/transactions");
    await go(page, "#/");
    assert(
      await dock.getByRole("button", { name: "Terminer" }).isVisible(),
      "left organize mode",
    );
    assert(!(await card(page, "Comptes").count()), "draft lost");
    await dock.getByRole("button", { name: "Annuler" }).click();
    await clearToasts(page);
  });

  await step(
    "Rétablir la disposition par défaut (inline confirmation)",
    async () => {
      await dock.getByRole("button", { name: "Organiser" }).click();
      await dock.getByRole("button", { name: "Ajouter" }).click();
      const sheet = page.getByRole("dialog", { name: "Ajouter une carte" });
      await sheet
        .getByRole("button", { name: /Rétablir la disposition/ })
        .click();
      await sheet
        .getByRole("group", { name: "Confirmation" })
        .getByRole("button", { name: "Oui" })
        .click();
      await page.waitForTimeout(400);
      assert(
        (await page.locator(".board-cell").count()) === 9,
        `${await page.locator(".board-cell").count()} cards`,
      );
      await dock.getByRole("button", { name: "Annuler" }).click();
    },
  );

  await context.close();
}

/* ------------------------------------------------------------------- week */

async function pick(page, trigger, option) {
  await trigger.click();
  await page.locator(".ui-picker-content").waitFor();
  await page
    .locator(".ui-picker-content [role=option]")
    .filter({ hasText: option })
    .first()
    .click();
  await page.waitForTimeout(250);
}

async function week() {
  section = "week";
  const { context, page } = await open("/?demo#/semaine");
  const dock = page.locator("nav.dock");
  const label = dock.locator(".week-dock-label");
  const current = await label.textContent();

  await step("week arrows and « Cette semaine »", async () => {
    assert(
      !(await dock.getByRole("button", { name: "Cette semaine" }).count()),
      "shown on current week",
    );
    await dock.getByRole("button", { name: "Semaine précédente" }).click();
    await page.waitForTimeout(300);
    assert((await label.textContent()) !== current, "label unchanged");
    assert(await page.locator('.week[data-tense="past"]').count(), "not past");
    await dock.getByRole("button", { name: "Cette semaine" }).click();
    await page.waitForTimeout(300);
    assert((await label.textContent()) === current, "not back");
    for (let i = 0; i < 6; i++) {
      const next = dock.getByRole("button", { name: "Semaine suivante" });
      if ((await next.getAttribute("aria-disabled")) === "true") break;
      await next.click();
    }
    const next = dock.getByRole("button", { name: "Semaine suivante" });
    assert(
      (await next.getAttribute("aria-disabled")) === "true",
      "future not bounded",
    );
    assert(await next.getAttribute("title"), "disabled without reason");
    await dock.getByRole("button", { name: "Cette semaine" }).click();
    await page.waitForTimeout(300);
  });

  await step("day select opens the panel, Escape closes", async () => {
    const strip = page.getByRole("group", { name: "Jours de la semaine" });
    const day = strip.getByRole("button").nth(3);
    await day.click();
    await page.waitForTimeout(250);
    assert((await day.getAttribute("aria-pressed")) === "true", "not pressed");
    const panel = page.locator(".week-day-panel");
    assert(await panel.isVisible(), "panel hidden");
    assert(
      await panel.getByRole("link", { name: /Voir dans Transactions/ }).count(),
      "link",
    );
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(150);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    assert(!(await panel.count()), "panel still open");
  });

  await step("edit a weekly limit + undo", async () => {
    const env = page.locator(".week-env").first();
    const name = (await env.locator(".week-env-name").textContent()).trim();
    await env
      .getByRole("button", { name: `Limite ${name} : modifier` })
      .click();
    const input = env.getByRole("textbox", { name: `Limite ${name}` });
    await input.fill("150");
    await input.press("Enter");
    await page.waitForTimeout(400);
    let db = await snapshot(page);
    const plan = (db.preferences.weeklyPlans ?? []).find(
      (w) => w.limits[name] === 15000,
    );
    assert(plan, JSON.stringify(db.preferences.weeklyPlans));
    await undo(page, `Limite ${name}`);
    db = await snapshot(page);
    assert(
      !(db.preferences.weeklyPlans ?? []).some((w) => w.limits[name] === 15000),
      "undo",
    );
  });

  await step("reset a limit to the proposal", async () => {
    const env = page.locator(".week-env").first();
    const name = (await env.locator(".week-env-name").textContent()).trim();
    await env
      .getByRole("button", { name: `Limite ${name} : modifier` })
      .click();
    await env.getByRole("textbox", { name: `Limite ${name}` }).fill("90");
    await env.getByRole("textbox", { name: `Limite ${name}` }).press("Enter");
    await page.waitForTimeout(400);
    const proposed = env.locator(".week-env-proposed");
    await proposed.click();
    await page.waitForTimeout(400);
    const db = await snapshot(page);
    assert(
      !(db.preferences.weeklyPlans ?? []).some((w) => name in w.limits),
      JSON.stringify(db.preferences.weeklyPlans),
    );
    assert(!(await proposed.count()), "proposal link still shown");
  });

  await step("purchase tester: in-envelope verdict", async () => {
    const tester = page.locator(".purchase").first();
    const env = (
      await page.locator(".week-env .week-env-name").first().textContent()
    ).trim();
    await pick(page, tester.locator('button[aria-label="Catégorie"]'), env);
    await tester.getByLabel("Montant").fill("20");
    await page.waitForTimeout(300);
    const v = tester.locator(".purchase-verdict");
    assert(
      (await v.getAttribute("data-verdict")) === "ok",
      `${await v.getAttribute("data-verdict")}: ${await v.textContent()}`,
    );
    assert((await v.textContent()).startsWith("Oui"), await v.textContent());
  });

  await step("purchase tester: outside-envelope verdict", async () => {
    const tester = page.locator(".purchase").first();
    await pick(
      page,
      tester.locator('button[aria-label="Catégorie"]'),
      "Housing",
    );
    await page.waitForTimeout(300);
    const v = tester.locator(".purchase-verdict");
    assert(
      (await v.getAttribute("data-verdict")) === "outside",
      `${await v.getAttribute("data-verdict")}: ${await v.textContent()}`,
    );
  });

  await step("purchase tester: risk verdict", async () => {
    const tester = page.locator(".purchase").first();
    await tester.getByLabel("Montant").fill("4000");
    await page.waitForTimeout(300);
    const v = tester.locator(".purchase-verdict");
    assert(
      (await v.getAttribute("data-verdict")) === "risk",
      `${await v.getAttribute("data-verdict")}: ${await v.textContent()}`,
    );
    assert((await v.textContent()).startsWith("Non"), await v.textContent());
    await tester.getByRole("button", { name: "Effacer" }).click();
    assert(
      (await tester.getByLabel("Montant").inputValue()) === "",
      "not cleared",
    );
  });

  await step("draft survives a page change", async () => {
    const tester = page.locator(".purchase").first();
    await tester.getByLabel("Montant").fill("12");
    await go(page, "#/");
    await go(page, "#/semaine");
    assert(
      (await tester.getByLabel("Montant").inputValue()) === "12",
      "draft lost",
    );
  });

  await step("Réserve edit + undo", async () => {
    await page
      .getByRole("button", { name: "Réserve de sécurité du foyer : modifier" })
      .click();
    const input = page.getByRole("textbox", {
      name: "Réserve de sécurité du foyer",
    });
    await input.fill("650");
    await input.press("Enter");
    await page.waitForTimeout(400);
    assert((await snapshot(page)).preferences.safety === 65000, "not saved");
    await undo(page, "Réserve");
    assert((await snapshot(page)).preferences.safety === 60000, "undo");
    assert(
      await page.evaluate(() => document.activeElement !== document.body),
      "focus lost to body",
    );
  });

  await step("charges of the week have the ⋯ menu", async () => {
    const side = page.locator(".week-col").last();
    const trigger = side
      .getByRole("button", { name: /^Actions pour / })
      .first();
    await trigger.click();
    assert(await page.locator("[role=menu]").count(), "menu missing");
    await page.keyboard.press("Escape");
  });

  await context.close();
}

/* ------------------------------------------------------------------- plan */

const planPrefs = async (page) => (await snapshot(page)).preferences.plan ?? {};

async function plan() {
  section = "plan";
  const { context, page } = await open("/?demo#/plan", {
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const months = page.locator(".plan-months");

  await step("effort slider (keyboard) saves and moves the hero", async () => {
    const slider = page.locator(".plan-effort input[type=range]");
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(500);
    assert(
      (await planPrefs(page)).effort === 1000,
      JSON.stringify(await planPrefs(page)),
    );
    assert(
      (await page.locator(".plan-effort strong").textContent()).includes("10"),
      "label",
    );
    assert(
      await page.locator(".plan-month .plan-muted").first().isVisible(),
      "« sans effort » comparison missing",
    );
  });

  await step("4 views: calendrier, courbe, barres, tableau", async () => {
    for (const [name, selector, view] of [
      ["Courbe", ".plan-months [role=slider]", "line"],
      ["Barres", ".plan-months svg", "bars"],
      ["Tableau", ".plan-months table", "table"],
      ["Calendrier", ".plan-calendar", "calendar"],
    ]) {
      await months.getByRole("radio", { name }).click();
      await page.waitForTimeout(300);
      assert(
        await page.locator(selector).first().isVisible(),
        `${name} not shown`,
      );
      assert((await planPrefs(page)).view === view, `${name} not saved`);
    }
  });

  await step("choose an objective from a month tile", async () => {
    const tile = page.locator(".plan-month:not([aria-disabled])").nth(2);
    await tile.click();
    await page.waitForTimeout(400);
    assert((await tile.getAttribute("aria-pressed")) === "true", "not pressed");
    const p = await planPrefs(page);
    assert(p.target, JSON.stringify(p));
    assert(
      (
        await months.locator('button[aria-label="Objectif"]').textContent()
      ).includes("Objectif"),
      "picker label",
    );
    await toast(page, "Objectif fin").waitFor();
  });

  await step("choose an objective from the picker", async () => {
    const before = (await planPrefs(page)).target;
    await pick(page, months.locator('button[aria-label="Objectif"]'), "Fin");
    await page.waitForTimeout(300);
    const after = (await planPrefs(page)).target;
    assert(after && after !== before, `${before} → ${after}`);
  });

  const fixed = page.locator(".plan-fixed");
  await step("stop a charge + undo", async () => {
    const stop = fixed.getByRole("button", { name: "Arrêter Netflix" });
    await stop.click();
    await page.waitForTimeout(400);
    assert(!(await stop.count()), "still listed");
    await focusKept(page, "stopping a charge");
    assert(
      (await snapshot(page)).preferences.dismissedRecurrences.length,
      "not saved",
    );
    await undo(page, "Netflix arrêtée");
    assert(
      await fixed.getByRole("button", { name: "Arrêter Netflix" }).count(),
      "not back",
    );
  });

  await step("add a manual charge, set « Jusqu'à », remove", async () => {
    await fixed.getByRole("button", { name: "Charge" }).click();
    await fixed.getByLabel("Libellé de la charge").fill("Impôt");
    await fixed.getByLabel("Montant par mois").fill("120");
    await fixed.getByRole("button", { name: "Ajouter" }).click();
    await page.waitForTimeout(400);
    assert(await fixed.getByText("ajoutée à la main").count(), "not listed");
    let extra = (await planPrefs(page)).extra ?? [];
    assert(
      extra.some((e) => e.name === "Impôt" && e.monthly === 12000),
      JSON.stringify(extra),
    );
    await pick(
      page,
      fixed.locator('button[aria-label="Fin de Impôt"]'),
      "Jusqu",
    );
    await page.waitForTimeout(300);
    extra = (await planPrefs(page)).extra ?? [];
    assert(extra.find((e) => e.name === "Impôt").end, JSON.stringify(extra));
    await fixed.getByRole("button", { name: "Retirer Impôt" }).click();
    await page.waitForTimeout(400);
    assert(!((await planPrefs(page)).extra ?? []).length, "not removed");
  });

  await step("add charge: invalid amount shows an error", async () => {
    await fixed.getByRole("button", { name: "Charge" }).click();
    await fixed.getByLabel("Libellé de la charge").fill("Test");
    await fixed.getByLabel("Montant par mois").fill("abc");
    await fixed.getByRole("button", { name: "Ajouter" }).click();
    await page.waitForTimeout(200);
    assert(await fixed.getByRole("alert").count(), "no error shown");
    await fixed.getByLabel("Montant par mois").press("Escape");
  });

  const split = page.locator(".plan-split");
  await step("salary reference edit + clear", async () => {
    await split
      .getByRole("button", { name: "Salaire de référence de Alex : modifier" })
      .click();
    const input = split.getByRole("textbox", {
      name: "Salaire de référence de Alex",
    });
    await input.fill("3000");
    await input.press("Enter");
    await page.waitForTimeout(400);
    assert(
      (await planPrefs(page)).incomes?.Alex === 300000,
      JSON.stringify(await planPrefs(page)),
    );
    assert(await split.getByText("saisi", { exact: true }).count(), "badge");
    await split
      .getByRole("button", { name: "Salaire de référence de Alex : modifier" })
      .click();
    await input.fill("");
    await input.press("Enter");
    await page.waitForTimeout(400);
    assert((await planPrefs(page)).incomes?.Alex === undefined, "not cleared");
  });

  await step("key: 50/50, Réglage + slider, back to Revenus", async () => {
    await split.getByRole("radio", { name: "50 / 50" }).click();
    await page.waitForTimeout(300);
    assert((await planPrefs(page)).share === 0.5, "half");
    assert(
      (await split.locator(".plan-key-bar").textContent()).includes("50 %"),
      "bar",
    );
    await split.getByRole("radio", { name: "Réglage" }).click();
    await page.waitForTimeout(300);
    const range = split.getByRole("slider", { name: "Part de Alex" });
    await range.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(400);
    assert(
      (await planPrefs(page)).share === 0.52,
      `share ${(await planPrefs(page)).share}`,
    );
    assert(
      (await split.locator(".plan-key-bar").textContent()).includes("52 %"),
      "bar 52",
    );
    await split.getByRole("radio", { name: "Revenus" }).click();
    await page.waitForTimeout(300);
    assert((await planPrefs(page)).share === undefined, "income");
  });

  await step("per-group répartition change", async () => {
    const trigger = split
      .locator('button[aria-label^="Répartition de"]')
      .first();
    const label = await trigger.getAttribute("aria-label");
    await pick(page, trigger, "50 / 50");
    await page.waitForTimeout(300);
    const modes = (await planPrefs(page)).modes ?? {};
    assert(
      Object.values(modes).includes("half"),
      `${label}: ${JSON.stringify(modes)}`,
    );
    assert(
      (
        await split.locator(`button[aria-label="${label}"]`).textContent()
      ).includes("50 / 50"),
      "label",
    );
  });

  await step("demandé edit", async () => {
    const button = split.getByRole("button", {
      name: /^Montant demandé à .* : modifier$/,
    });
    await button.click();
    const input = split.getByRole("textbox", { name: /^Montant demandé à / });
    await input.fill("400");
    await input.press("Enter");
    await page.waitForTimeout(400);
    const caps = (await planPrefs(page)).caps ?? {};
    assert(Object.values(caps).includes(40000), JSON.stringify(caps));
    assert(
      await split.locator(".plan-settle-bar [data-part=asked]").count(),
      "bar",
    );
  });

  const alex = page
    .locator(".plan-people .ui-card")
    .filter({ hasText: "Semaine de Alex" });
  await step("weekly limit edit", async () => {
    const button = alex
      .getByRole("button", { name: /^Limite .* pour Alex : modifier$/ })
      .first();
    const label = (await button.getAttribute("aria-label")).replace(
      " : modifier",
      "",
    );
    await button.click();
    const input = alex.getByRole("textbox", { name: label });
    await input.fill("25");
    await input.press("Enter");
    await page.waitForTimeout(400);
    // Category rows (default): the amount is spread over its subcategories.
    const category = label.replace(/^Limite (.*) pour Alex$/, "$1");
    const a = (await planPrefs(page)).allowances?.Alex ?? {};
    const parts = Object.entries(a)
      .filter(([k]) => k.split(" · ")[0] === category)
      .map(([, v]) => v);
    assert(
      parts.reduce((n, v) => n + v, 0) === 2500 &&
        parts.every((v) => v % 100 === 0),
      `${category}: ${JSON.stringify(a)}`,
    );
  });

  await step("weekly limit: negative amount refused", async () => {
    const button = alex
      .getByRole("button", { name: /^Limite .* pour Alex : modifier$/ })
      .first();
    const label = (await button.getAttribute("aria-label")).replace(
      " : modifier",
      "",
    );
    await button.click();
    const input = alex.getByRole("textbox", { name: label });
    await input.fill("-5");
    await input.press("Enter");
    await page.waitForTimeout(200);
    assert(await alex.getByRole("alert").count(), "accepted a negative limit");
    await input.press("Escape");
  });

  await step("remove a line redistributes its money", async () => {
    const limits = async () =>
      (await alex.locator(".plan-list .ui-editable").allTextContents()).map(
        (t) => Number(t.replace(/[^\d,]/g, "").replace(",", ".")),
      );
    const before = await limits();
    const total = before.reduce((a, b) => a + b, 0);
    const remove = alex
      .getByRole("button", { name: /^Retirer .* de la semaine de Alex$/ })
      .first();
    await remove.click();
    await page.waitForTimeout(500);
    await focusKept(page, "removing a line");
    const after = await limits();
    assert(after.length === before.length - 1, `${before} → ${after}`);
    const sum = after.reduce((a, b) => a + b, 0);
    assert(
      Math.abs(sum - total) <= 1,
      `total ${total} → ${sum} (${before} → ${after})`,
    );
    assert(((await planPrefs(page)).hidden?.Alex ?? []).length >= 1, "hidden");
  });

  await step("add a line from the menu", async () => {
    const count = await alex.locator(".plan-list li").count();
    await alex.getByRole("button", { name: "Ligne" }).click();
    const item = page.locator("[role=menu] [role=menuitem]").first();
    await item.waitFor();
    await item.click();
    await page.waitForTimeout(400);
    assert(
      (await alex.locator(".plan-list li").count()) === count + 1,
      "not added",
    );
    assert(((await planPrefs(page)).added?.Alex ?? []).length >= 1, "added");
  });

  await step(
    "détail par sous-catégorie: toggle, same settle-up, persisted",
    async () => {
      const settle = async () =>
        (await split.locator(".plan-settle").innerText()).replace(/\s+/g, " ");
      const before = await settle();
      const names = async () =>
        split
          .locator("tbody .cat-label, .plan-split-list .cat-label")
          .allInnerTexts();
      assert(!(await names()).some((n) => n.includes("›")), "category rows");
      await split.getByRole("radio", { name: "Sous-catégories" }).click();
      await page.waitForTimeout(400);
      assert((await planPrefs(page)).detail === true, "not saved");
      assert(
        (await names()).some((n) => n.includes("›")),
        "no subcategory rows",
      );
      assert(
        (await alex.locator(".plan-list .cat-label").allInnerTexts()).some(
          (n) => n.includes("›"),
        ),
        "weekly rows not detailed",
      );
      assert((await settle()) === before, `${before} ≠ ${await settle()}`);
      await page
        .locator(".plan-week-head")
        .getByRole("radio", { name: "Catégories", exact: true })
        .click();
      await page.waitForTimeout(400);
      assert((await planPrefs(page)).detail === false, "not back");
      assert(!(await names()).some((n) => n.includes("›")), "still detailed");
    },
  );

  await step("Copier writes the week message to the clipboard", async () => {
    await alex.getByRole("button", { name: "Copier" }).click();
    await toast(page, "Message copié").waitFor();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    assert(text.startsWith("Cette semaine pour Alex"), text);
    assert(text.includes("Total"), text);
  });

  await context.close();
}

/* ----------------------------------------------------------- transactions */

async function transactions() {
  section = "transactions";
  const { context, page } = await open("/?demo#/transactions");
  const dock = page.locator("nav.dock");
  const tx = activePage(page);
  const rows = tx.locator("tbody tr[data-row]");
  const count = async () =>
    Number(
      (await tx.locator(".tx-summary, .tx-head").first().textContent())
        .match(/(\d[\d \s]*)\s*opérations?/)[1]
        .replace(/\D/g, ""),
    );

  // Whole history so pagination exists.
  await pick(page, dock.locator('button[aria-label="Période"]'), "Tout l");
  const total = await count();

  await step("search filters with debounce, × clears", async () => {
    const box = tx
      .getByRole("searchbox", { name: "Rechercher une opération" })
      .or(tx.getByLabel("Rechercher une opération"));
    await page.keyboard.press("/");
    assert(
      await box.evaluate((el) => el === document.activeElement),
      "/ did not focus search",
    );
    await page.keyboard.type("mcdo");
    await page.waitForTimeout(400);
    const n = await count();
    assert(n > 0 && n < total, `mcdo → ${n}/${total}`);
    const names = await rows
      .locator(".tx-merchant, td:nth-child(3)")
      .allTextContents();
    assert(
      names.every((t) => /mcdonald/i.test(t)),
      names.slice(0, 3).join("|"),
    );
    await tx.getByRole("button", { name: "Effacer la recherche" }).click();
    await page.waitForTimeout(300);
    assert((await count()) === total, "not cleared");
  });

  await step("type tabs: Dépenses / Revenus / Virements / Tout", async () => {
    const amounts = async () =>
      (await rows.locator("td:last-child").allTextContents()).map((t) =>
        t.trim(),
      );
    await tx.getByRole("radio", { name: "Revenus" }).click();
    await page.waitForTimeout(300);
    assert(
      (await amounts()).every((a) => a.startsWith("+")),
      "non-income in Revenus",
    );
    await tx.getByRole("radio", { name: "Dépenses" }).click();
    await page.waitForTimeout(300);
    assert(
      (await amounts()).every((a) => a.startsWith("−")),
      "non-expense in Dépenses",
    );
    await tx.getByRole("radio", { name: "Virements" }).click();
    await page.waitForTimeout(300);
    const text = await rows.allTextContents();
    assert(
      text.length && text.every((t) => /virement/i.test(t)),
      "non-transfer rows",
    );
    await tx.getByRole("radio", { name: "Tout" }).click();
    await page.waitForTimeout(300);
  });

  await step(
    "filters: subcategory + amount + chips removal + Tout effacer",
    async () => {
      await tx.getByRole("button", { name: /^Filtres/ }).click();
      const pop = page.locator(".tx-filters");
      await pop.waitFor();
      await pop.getByLabel("Filtrer les catégories").fill("groc");
      await pop
        .locator("label.tx-check", { hasText: "Groceries" })
        .first()
        .click();
      await pop.getByLabel("Min (€)").fill("50");
      await pop.getByLabel("Min (€)").press("Enter");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      const chips = tx.getByRole("list", { name: "Filtres actifs" });
      assert(await chips.getByText("Food › Groceries").count(), "sub chip");
      assert(await chips.getByText(/≥ 50/).count(), "min chip");
      const cats = await rows.locator("td:nth-child(4)").allTextContents();
      assert(
        cats.length && cats.every((c) => c.includes("Groceries")),
        cats.slice(0, 3).join("|"),
      );
      const n = await count();
      await chips.getByRole("button", { name: /Retirer le filtre ≥/ }).click();
      await page.waitForTimeout(300);
      assert((await count()) > n, "min chip removal");
      await tx.getByRole("button", { name: /^Filtres/ }).click();
      await page
        .locator(".tx-filters label.tx-check", { hasText: "Avec note" })
        .click();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      await chips.getByRole("button", { name: "Tout effacer" }).click();
      await page.waitForTimeout(300);
      assert((await count()) === total, "Tout effacer");
    },
  );

  await step("sort: menu and header click", async () => {
    await tx.getByRole("button", { name: /^Trier/ }).click();
    await page.getByRole("menuitem", { name: "Montant ↑" }).click();
    await page.waitForTimeout(300);
    const first = (
      await rows.first().locator("td:last-child").textContent()
    ).replace(/[^\d,−-]/g, "");
    assert(first.startsWith("−"), `Montant ↑ first ${first}`);
    await tx.locator("thead").getByRole("button", { name: /Date/ }).click();
    await page.waitForTimeout(300);
    const label = await tx
      .getByRole("button", { name: /^Trier/ })
      .getAttribute("aria-label");
    assert(/Date/.test(label), label);
  });

  await step("density persists after reload", async () => {
    const group = tx.getByRole("radiogroup", { name: "Densité" });
    await group.getByRole("radio").first().click();
    await page.waitForTimeout(200);
    const h1 = await rows
      .first()
      .evaluate((r) => r.getBoundingClientRect().height);
    await group.getByRole("radio").last().click();
    await page.waitForTimeout(200);
    const h3 = await rows
      .first()
      .evaluate((r) => r.getBoundingClientRect().height);
    assert(h3 > h1 + 10, `heights ${h1} ${h3}`);
    await page.reload();
    await page.waitForSelector("tbody tr[data-row]");
    await page.waitForTimeout(500);
    const checked = await tx
      .getByRole("radiogroup", { name: "Densité" })
      .getByRole("radio")
      .last()
      .getAttribute("aria-checked");
    assert(checked === "true", "density lost");
    await tx
      .getByRole("radiogroup", { name: "Densité" })
      .getByRole("radio")
      .nth(1)
      .click();
  });

  await step("page size + pagination top/bottom + Aller à", async () => {
    const top = tx.getByRole("navigation", { name: "Pagination (haut)" });
    const bottom = tx.getByRole("navigation", { name: "Pagination (bas)" });
    await pick(
      page,
      bottom.locator('button[aria-label="Lignes par page"]'),
      "25 lignes",
    );
    assert(await top.isVisible(), "no top pager");
    await bottom.getByRole("button", { name: "Page 2", exact: true }).click();
    await page.waitForTimeout(300);
    assert(
      (await top
        .getByRole("button", { name: "Page 2", exact: true })
        .getAttribute("aria-current")) === "page",
      "top not synced",
    );
    assert(
      (await page.evaluate(() => document.activeElement?.dataset?.row)) !==
        undefined,
      "focus not on first row",
    );
    await top.getByRole("button", { name: "Page suivante" }).click();
    await page.waitForTimeout(300);
    assert(
      (await bottom
        .getByRole("button", { name: "Page 3", exact: true })
        .getAttribute("aria-current")) === "page",
      "next",
    );
    const jump = bottom
      .getByRole("textbox", { name: /Aller à la page/ })
      .or(bottom.getByLabel(/Aller à la page/));
    await jump.fill("999");
    await jump.press("Enter");
    await page.waitForTimeout(300);
    const pages = Math.ceil(total / 25);
    assert(
      (await bottom
        .getByRole("button", { name: `Page ${pages}`, exact: true })
        .getAttribute("aria-current")) === "page",
      "Aller à not clamped",
    );
    const range = await top.textContent();
    assert(
      range.includes(`sur ${total}`) ||
        range.replace(/\s/g, "").includes(`sur${total}`),
      range,
    );
    await top.getByRole("button", { name: "Page 1", exact: true }).click();
    await page.waitForTimeout(300);
  });

  await step(
    "row keyboard nav, open detail, Escape returns focus",
    async () => {
      await rows.first().focus();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      const id = await page.evaluate(
        () => document.activeElement?.dataset?.row,
      );
      assert(
        id && id === (await rows.nth(2).getAttribute("data-row")),
        "arrow nav",
      );
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      const detail = tx.getByRole("region", { name: /^Détail de / });
      assert(await detail.isVisible(), "detail not open");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      assert(!(await detail.count()), "detail not closed");
      assert(
        (await page.evaluate(() => document.activeElement?.dataset?.row)) ===
          id,
        "focus not back on row",
      );
      await page.keyboard.press("Space");
      assert(
        (await rows.nth(2).getAttribute("aria-selected")) === "true",
        "space did not select",
      );
      await page.keyboard.press("Space");
    },
  );

  await step("detail: merchant rename, note, internal switch", async () => {
    await rows.first().click();
    const detail = tx.getByRole("region", { name: /^Détail de / });
    await detail.waitFor();
    const id = await rows.first().getAttribute("data-row");
    await detail.getByRole("button", { name: "Marchand : modifier" }).click();
    await detail.getByRole("textbox", { name: "Marchand" }).fill("EDF Énergie");
    await detail.getByRole("textbox", { name: "Marchand" }).press("Enter");
    await page.waitForTimeout(400);
    let t = (await snapshot(page)).transactions.find((x) => x.id === id);
    assert(t.merchantName === "EDF Énergie", JSON.stringify(t.merchantName));
    await undo(page, "Marchand renommé");
    const note = detail.getByLabel("Note");
    await note.fill("facture annuelle");
    await note.blur();
    await page.waitForTimeout(400);
    t = (await snapshot(page)).transactions.find((x) => x.id === id);
    assert(t.note === "facture annuelle", JSON.stringify(t.note));
    await detail.getByRole("switch").click();
    await page.waitForTimeout(400);
    t = (await snapshot(page)).transactions.find((x) => x.id === id);
    assert(t.internal === true, "switch");
    await undo(page, "virement interne");
    t = (await snapshot(page)).transactions.find((x) => x.id === id);
    assert(!t.internal, "switch undo");
    await page.keyboard.press("Escape");
    await clearToasts(page);
  });

  await step(
    "category menu: change category+subcategory, undo, apply to others",
    async () => {
      await tx.getByLabel("Rechercher une opération").fill("Monoprix");
      await page.waitForTimeout(400);
      const row = rows.first();
      const id = await row.getAttribute("data-row");
      await row.getByRole("button", { name: /^Catégorie : / }).click();
      const search = page.getByRole("combobox", {
        name: "Rechercher ou créer une catégorie",
      });
      await search.fill("Fast Food");
      await page.waitForTimeout(150);
      await search.press("Enter");
      await page.waitForTimeout(500);
      let t = (await snapshot(page)).transactions.find((x) => x.id === id);
      assert(
        t.category === "Food" && t.subcategory === "Fast Food",
        `${t.category} › ${t.subcategory}`,
      );
      await undo(page, "Catégorie changée");
      t = (await snapshot(page)).transactions.find((x) => x.id === id);
      assert(t.subcategory === "Groceries", `undo → ${t.subcategory}`);
      // Again, then « Appliquer aux N autres ».
      await rows
        .first()
        .getByRole("button", { name: /^Catégorie : / })
        .click();
      await search.fill("Fast Food");
      await page.waitForTimeout(150);
      await search.press("Enter");
      await page.waitForTimeout(500);
      const prompt = page.locator(".tx-similar");
      const apply = prompt.getByRole("button", {
        name: /^Appliquer aux \d+ autre/,
      });
      await apply.waitFor();
      const n = Number((await apply.textContent()).match(/\d+/)[0]);
      await apply.click();
      await page.waitForTimeout(600);
      const mono = (await snapshot(page)).transactions.filter(
        (x) => x.merchant === "Monoprix",
      );
      const fast = mono.filter((x) => x.subcategory === "Fast Food").length;
      assert(fast >= n + 1, `${fast} Fast Food of ${mono.length}, n=${n}`);
      await undo(page, "Monoprix");
      await undo(page, "Catégorie changée").catch(() => {});
      const after = (await snapshot(page)).transactions.filter(
        (x) => x.merchant === "Monoprix" && x.subcategory === "Fast Food",
      ).length;
      assert(after <= 1, `undo apply-all left ${after}`);
      await tx.getByRole("button", { name: "Effacer la recherche" }).click();
      await clearToasts(page);
    },
  );

  await step("bulk select + categorize + confirm dialog + undo", async () => {
    await tx.getByLabel("Rechercher une opération").fill("Decathlon");
    await page.waitForTimeout(400);
    const ids = await rows.evaluateAll((r) => r.map((x) => x.dataset.row));
    assert(ids.length >= 2, `${ids.length} rows`);
    await tx.locator("thead input[type=checkbox]").check();
    const bar = tx.getByRole("region", { name: "Sélection" });
    assert(
      (await bar.textContent()).includes(`${ids.length} sélectionnées`),
      await bar.textContent(),
    );
    await bar.getByRole("button", { name: "Catégoriser…" }).click();
    const search = page.getByRole("combobox", {
      name: "Rechercher ou créer une catégorie",
    });
    await search.fill("Entertainment");
    await page.waitForTimeout(150);
    await search.press("Enter");
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    assert(
      (await dialog.textContent()).includes(
        `Catégoriser ${ids.length} opérations`,
      ),
      await dialog.textContent(),
    );
    await dialog.getByRole("button", { name: "Catégoriser" }).click();
    await page.waitForTimeout(600);
    const db = await snapshot(page);
    assert(
      ids.every(
        (id) =>
          db.transactions.find((t) => t.id === id).category === "Entertainment",
      ),
      "not applied",
    );
    assert(!(await bar.count()), "selection not cleared");
    await undo(page, "catégorisées");
    const back = await snapshot(page);
    assert(
      ids.every(
        (id) =>
          back.transactions.find((t) => t.id === id).category === "Shopping",
      ),
      "undo",
    );
    await tx.getByRole("button", { name: "Effacer la recherche" }).click();
  });

  await step(
    "selection persists across pages; « Sélectionner les N »",
    async () => {
      await rows.first().locator("input[type=checkbox]").check();
      const top = tx.getByRole("navigation", { name: "Pagination (haut)" });
      await top.getByRole("button", { name: "Page 2", exact: true }).click();
      await page.waitForTimeout(300);
      const bar = tx.getByRole("region", { name: "Sélection" });
      assert(
        (await bar.textContent()).includes("1 sélectionnée"),
        await bar.textContent(),
      );
      await bar.getByRole("button", { name: /Sélectionner les/ }).click();
      assert(
        (await bar.textContent()).includes(`${total}`),
        await bar.textContent(),
      );
      await bar.getByRole("button", { name: "Vider la sélection" }).click();
      await top.getByRole("button", { name: "Page 1", exact: true }).click();
    },
  );

  await step(
    "open row stays open across a sort change; selection « hors du filtre »",
    async () => {
      await tx.getByLabel("Rechercher une opération").fill("EDF");
      await page.waitForTimeout(400);
      const id = await rows.first().getAttribute("data-row");
      await rows.first().click();
      await tx.getByRole("button", { name: /^Trier/ }).click();
      await page.getByRole("menuitem", { name: "Montant ↓" }).click();
      await page.waitForTimeout(300);
      const detail = tx.getByRole("region", { name: /^Détail de / });
      assert(await detail.count(), "detail closed by sort");
      await tx.getByRole("button", { name: /^Trier/ }).click();
      await page.getByRole("menuitem", { name: "Date ↓" }).click();
      await page.waitForTimeout(300);
      await page.keyboard.press("Escape");
      await tx.locator(`tr[data-row="${id}"] input[type=checkbox]`).check();
      await tx.getByRole("button", { name: "Effacer la recherche" }).click();
      await tx.getByLabel("Rechercher une opération").fill("Spotify");
      await page.waitForTimeout(400);
      const bar = tx.getByRole("region", { name: "Sélection" });
      const text = await bar.textContent();
      const hidden = !(await rows.evaluateAll(
        (r, i) => r.some((x) => x.dataset.row === i),
        id,
      ));
      assert(!hidden || text.includes("hors du filtre"), text);
      await bar.getByRole("button", { name: "Vider la sélection" }).click();
      await tx.getByRole("button", { name: "Effacer la recherche" }).click();
    },
  );

  await step("export CSV downloads a ;-separated UTF-8 BOM file", async () => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      (async () => {
        await dock.getByRole("button", { name: "Exporter en CSV" }).click();
        await page.getByRole("menuitem", { name: /^Résultat filtré/ }).click();
      })(),
    ]);
    const path = await download.path();
    const buf = readFileSync(path);
    assert(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf, "no BOM");
    const lines = buf.toString("utf8").trim().split(/\r?\n/);
    assert(lines[0].includes(";"), lines[0]);
    assert(lines.length === total + 1, `${lines.length - 1} rows vs ${total}`);
    assert(
      /\.csv$/.test(download.suggestedFilename()),
      download.suggestedFilename(),
    );
  });

  await step("drilldown ?cat=Food › Groceries", async () => {
    await go(
      page,
      "#/transactions?cat=" + encodeURIComponent("Food › Groceries"),
    );
    const cats = await rows.locator("td:nth-child(4)").allTextContents();
    assert(
      cats.length && cats.every((c) => c.includes("Groceries")),
      cats.slice(0, 3).join("|"),
    );
    assert(
      await tx
        .getByRole("list", { name: "Filtres actifs" })
        .getByText("Food › Groceries")
        .count(),
      "chip",
    );
  });

  await step(
    "drilldown ?tx= opens the row, out-of-period is pinned",
    async () => {
      const db = await snapshot(page);
      const old = db.transactions
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))[0];
      await pick(
        page,
        dock.locator('button[aria-label="Période"]'),
        "30 derniers jours",
      );
      await go(page, "#/transactions?tx=" + old.id);
      await page.waitForTimeout(400);
      assert(
        await tx.getByRole("region", { name: /^Détail de / }).isVisible(),
        "detail not open",
      );
      assert(
        await tx
          .getByRole("button", { name: "Retirer l’opération épinglée" })
          .count(),
        "not pinned",
      );
      await tx
        .getByRole("button", { name: "Retirer l’opération épinglée" })
        .click();
      await page.waitForTimeout(300);
      assert(
        !(await tx
          .getByRole("button", { name: "Retirer l’opération épinglée" })
          .count()),
        "unpin",
      );
    },
  );

  await step("drilldown ?filter=uncategorized", async () => {
    await pick(page, dock.locator('button[aria-label="Période"]'), "Tout l");
    await go(page, "#/transactions?filter=uncategorized");
    const n = (await snapshot(page)).transactions.filter(uncategorized).length;
    assert((await rows.count()) === n, `${await rows.count()} rows vs ${n}`);
    assert(
      await tx
        .getByRole("list", { name: "Filtres actifs" })
        .getByText("Sans catégorie")
        .count(),
      "chip",
    );
  });

  await step(
    "zero result shows « Effacer les filtres » without pager",
    async () => {
      await tx.getByLabel("Rechercher une opération").fill("zzzzzz");
      await page.waitForTimeout(400);
      assert(
        await tx.getByText("Aucune opération ne correspond").isVisible(),
        "empty",
      );
      assert(
        !(await tx.getByRole("navigation", { name: /Pagination/ }).count()),
        "ghost pager",
      );
      await tx.getByRole("button", { name: "Effacer les filtres" }).click();
    },
  );

  await context.close();
}

/* ----------------------------------------------------------------- import */

const fixture = resolve(app, "fixtures/demo.csv");
const fixtureRows =
  readFileSync(fixture, "utf8").trim().split(/\r?\n/).length - 1;

async function chooseFile(page, path) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    activePage(page)
      .getByRole("button", { name: /^Choisir (un|un autre) fichier$/ })
      .click(),
  ]);
  await chooser.setFiles(path);
}

async function importFixture(page, newName) {
  await chooseFile(page, fixture);
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  if (newName) {
    const name = dialog.getByLabel("Nom du nouveau compte").first();
    if (await name.count()) await name.fill(newName);
  }
  await dialog.getByRole("button", { name: "Continuer" }).click();
  await page.waitForTimeout(500);
}

async function importPage() {
  section = "import";
  const { context, page } = await open("/#/");
  const dock = page.locator("nav.dock");
  const imp = activePage(page);

  await step("empty database starts on Import", async () => {
    await waitFor(
      async () => (await hash(page)) === "#/import",
      `hash ${await hash(page)}`,
    );
    assert(
      await imp.getByText("Déposer un relevé CSV").isVisible(),
      "dropzone",
    );
    assert(
      await imp.getByText(/CSV · 20 Mo · 50 000 lignes max/).isVisible(),
      "limits",
    );
  });

  await step(
    "other pages show an empty state with an Import action",
    async () => {
      for (const h of ["#/", "#/semaine", "#/transactions"]) {
        await go(page, h);
        assert(
          await activePage(page)
            .getByText("Aucune opération")
            .first()
            .isVisible(),
          `${h} empty`,
        );
      }
      await go(page, "#/import");
    },
  );

  await step("file chooser → account dialog → new account", async () => {
    await chooseFile(page, fixture);
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    assert(
      /compte/.test(await dialog.textContent()),
      await dialog.textContent(),
    );
    const name = dialog.getByLabel("Nom du nouveau compte");
    assert(
      (await name.count()) === 2,
      "one new-account field per detected account",
    );
    await name.first().fill("Joint QA");
    await dialog.getByRole("button", { name: "Continuer" }).click();
    await page.waitForTimeout(500);
    assert(!(await dialog.count()), "dialog still open");
    assert(
      !(await snapshot(page)).accounts.length,
      "account created before commit",
    );
  });

  await step("preview counts and explicit commit button", async () => {
    const counts = imp.getByRole("radiogroup", { name: "Lignes affichées" });
    assert(
      (await counts.textContent()).includes(`${fixtureRows} nouvelles`),
      await counts.textContent(),
    );
    const commit = imp.getByRole("button", {
      name: /^Importer \d+ opérations? dans/,
    });
    assert(
      (await commit.textContent()).includes(`${fixtureRows} opérations dans`) &&
        (await commit.textContent()).includes("Joint QA"),
      await commit.textContent(),
    );
  });

  await step(
    "commit writes account + batch + operations atomically",
    async () => {
      await imp
        .getByRole("button", { name: /^Importer \d+ opérations? dans/ })
        .click();
      await page.waitForTimeout(800);
      assert(await imp.getByText("Import terminé").isVisible(), "no result");
      assert(
        (await imp.locator(".result-count").textContent()) ===
          String(fixtureRows),
        "count",
      );
      const db = await snapshot(page);
      assert(
        db.transactions.length === fixtureRows,
        `${db.transactions.length} tx`,
      );
      assert(
        db.batches.length === 1 && db.accounts.length === 2,
        "batch/accounts",
      );
      await toast(page, "importées").waitFor();
    },
  );

  await step("Voir les opérations → transactions of the batch", async () => {
    await imp.getByRole("button", { name: "Voir les opérations" }).click();
    await page.waitForTimeout(500);
    assert(
      (await hash(page)).startsWith("#/transactions?batch="),
      await hash(page),
    );
    assert(
      await activePage(page)
        .getByRole("list", { name: "Filtres actifs" })
        .getByText(/^Lot /)
        .count(),
      "batch chip",
    );
    await go(page, "#/import");
  });

  await step("undo from history removes the batch", async () => {
    await clearToasts(page);
    await imp.getByRole("button", { name: /^Actions du lot / }).click();
    await page.getByRole("menuitem", { name: "Annuler l'import" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    assert(
      (await dialog.textContent()).includes(String(fixtureRows)),
      await dialog.textContent(),
    );
    await dialog.getByRole("button", { name: "Supprimer le lot" }).click();
    await page.waitForTimeout(600);
    const db = await snapshot(page);
    assert(
      !db.transactions.length && !db.batches.length,
      `${db.transactions.length} tx left`,
    );
  });

  await step("re-import, then same file again → « Déjà importé »", async () => {
    await imp
      .getByRole("button", { name: /Importer un autre fichier/ })
      .click()
      .catch(() => {});
    await importFixture(page, "Joint QA");
    await imp
      .getByRole("button", { name: /^Importer \d+ opérations? dans/ })
      .click();
    await page.waitForTimeout(800);
    assert(
      (await snapshot(page)).transactions.length === fixtureRows,
      "second import",
    );
    await imp
      .getByRole("button", { name: "Importer un autre fichier" })
      .click();
    await chooseFile(page, fixture);
    await page.waitForTimeout(600);
    const notice = imp.getByText(/Déjà importé le/);
    assert(await notice.isVisible(), "no « déjà importé » notice");
    assert(!(await page.getByRole("dialog").count()), "went to the next step");
  });

  let backup;
  await step("backup export downloads versioned JSON", async () => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      (async () => {
        await dock.getByRole("button", { name: "Sauvegarde" }).click();
        await page
          .getByRole("menuitem", { name: "Exporter une sauvegarde" })
          .click();
      })(),
    ]);
    assert(
      /^wealthpilot-sauvegarde-\d{4}-\d\d-\d\d\.json$/.test(
        download.suggestedFilename(),
      ),
      download.suggestedFilename(),
    );
    backup = resolve(TMP, download.suggestedFilename());
    await download.saveAs(backup);
    const json = JSON.parse(readFileSync(backup, "utf8"));
    const txs = json.transactions ?? json.data?.transactions;
    assert(
      Array.isArray(txs) && txs.length === fixtureRows,
      `${txs?.length} tx in backup`,
    );
  });

  await step(
    "restore round trip (inventory dialog, safety download)",
    async () => {
      // Change the data, then restore the backup over it.
      await page.evaluate(async () => {
        const { db } = await import("/src/data/db.ts");
        const first = await db.transactions.toCollection().first();
        await db.transactions.delete(first.id);
      });
      await page.waitForTimeout(400);
      assert(
        (await snapshot(page)).transactions.length === fixtureRows - 1,
        "setup",
      );
      await dock.getByRole("button", { name: "Sauvegarde" }).click();
      const [chooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        page.getByRole("menuitem", { name: "Restaurer…" }).click(),
      ]);
      await chooser.setFiles(backup);
      const dialog = page.getByRole("dialog", {
        name: /Remplacer mes données/,
      });
      await dialog.waitFor();
      const text = await dialog.textContent();
      assert(
        text.includes(String(fixtureRows)) &&
          text.includes(String(fixtureRows - 1)),
        text,
      );
      const [safety] = await Promise.all([
        page.waitForEvent("download"),
        dialog.getByRole("button", { name: "Remplacer mes données" }).click(),
      ]);
      assert(
        /sauvegarde/.test(safety.suggestedFilename()),
        safety.suggestedFilename(),
      );
      await page.waitForTimeout(800);
      assert(
        (await snapshot(page)).transactions.length === fixtureRows,
        "not restored",
      );
    },
  );

  await step(
    "restore: invalid file shows an error, nothing changes",
    async () => {
      const bad = resolve(TMP, "bad-backup.json");
      writeFileSync(bad, '{"hello":1}');
      await dock.getByRole("button", { name: "Sauvegarde" }).click();
      const [chooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        page.getByRole("menuitem", { name: "Restaurer…" }).click(),
      ]);
      await chooser.setFiles(bad);
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      assert(
        (await dialog.textContent()).includes("Aucune donnée modifiée"),
        await dialog.textContent(),
      );
      await page.keyboard.press("Escape");
      assert(
        (await snapshot(page)).transactions.length === fixtureRows,
        "changed",
      );
    },
  );

  await step("refused file type keeps the zone unchanged", async () => {
    const txt = resolve(TMP, "notes.txt");
    writeFileSync(txt, "hello");
    await imp
      .getByRole("button", { name: "Importer un autre fichier" })
      .click()
      .catch(() => {});
    await chooseFile(page, txt);
    await page.waitForTimeout(400);
    assert(await imp.getByRole("alert").count(), "no refusal message");
    assert(!(await page.getByRole("dialog").count()), "dialog opened");
  });

  await context.close();
}

/* ----------------------------------------------------------------- visual */

/** Layout and accessibility audit of the shown page; returns a list of problems. */
const audit = (page) =>
  page.evaluate(() => {
    const problems = [];
    const root = document.querySelector(".page:not([hidden])");
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      const s = getComputedStyle(el);
      return (
        s.visibility !== "hidden" &&
        s.display !== "none" &&
        !el.closest(
          "[hidden], [aria-hidden=true], .sr-only, .ui-disclosure-panel:not([data-open]) *",
        )
      );
    };
    const describe = (el) =>
      `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}«${(el.textContent ?? "").trim().slice(0, 30)}»`;

    if (document.documentElement.scrollWidth > innerWidth + 1)
      problems.push(
        `page scrolls sideways by ${document.documentElement.scrollWidth - innerWidth}px`,
      );

    // Horizontal scrollers inside cards hide amounts on narrow screens.
    for (const el of root.querySelectorAll(".ui-card *")) {
      const s = getComputedStyle(el);
      if (
        /(auto|scroll)/.test(s.overflowX) &&
        el.scrollWidth > el.clientWidth + 2 &&
        visible(el)
      )
        problems.push(
          `sideways scroller ${describe(el)} (${el.scrollWidth} > ${el.clientWidth})`,
        );
    }

    // Content cut by the card edge (cards clip their overflow).
    for (const card of root.querySelectorAll(".ui-card")) {
      const box = card.getBoundingClientRect();
      for (const el of card.querySelectorAll(
        "button, a, input, .ui-money, h2, h3, p, td, th, label",
      )) {
        if (
          !visible(el) ||
          el.closest("[style*=overflow], .plan-table-wrap, .tx-scroll")
        )
          continue;
        const r = el.getBoundingClientRect();
        if (r.right > box.right + 1 || r.left < box.left - 1) {
          problems.push(`cut by card edge: ${describe(el)}`);
          break;
        }
      }
    }

    // Letter avatars: logos must be brand images or category icons.
    for (const logo of root.querySelectorAll(".ui-logo"))
      if (/^[A-Za-zÀ-ÿ]{1,2}$/.test((logo.textContent ?? "").trim()))
        problems.push(`letter avatar ${describe(logo)}`);
    for (const img of root.querySelectorAll(".ui-logo img"))
      if (img.complete && !img.naturalWidth && visible(img))
        problems.push(`broken logo ${img.src}`);

    // Unlabeled controls.
    const name = (el) => {
      const label = el.getAttribute("aria-label");
      if (label?.trim()) return label;
      const by = el.getAttribute("aria-labelledby");
      if (by)
        return by
          .split(" ")
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ")
          .trim();
      if (el.labels?.length)
        return [...el.labels]
          .map((l) => l.textContent)
          .join(" ")
          .trim();
      if (el.title?.trim()) return el.title;
      if (
        el.tagName === "INPUT" ||
        el.tagName === "SELECT" ||
        el.tagName === "TEXTAREA"
      )
        return "";
      return (el.textContent ?? "").trim();
    };
    const controls = [
      ...root.querySelectorAll(
        "button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=slider], [role=radio], [role=switch], [role=combobox], [role=checkbox]",
      ),
      ...document.querySelectorAll("nav.dock button, nav.dock a"),
    ];
    for (const el of controls)
      if (visible(el) && !name(el))
        problems.push(`unlabeled ${describe(el)} ${el.outerHTML.slice(0, 80)}`);

    // Overlapping text: text boxes of different elements that intersect.
    const boxes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim()) continue;
      const el = node.parentElement;
      if (!visible(el) || el.closest("svg, .ui-float, [inert], .sr-only"))
        continue;
      // Clip to every ancestor that hides its overflow (ellipsis, visually hidden text).
      let clip = {
        left: -Infinity,
        top: -Infinity,
        right: Infinity,
        bottom: Infinity,
      };
      for (let p = el; p && p !== root; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (
          s.overflowX !== "visible" ||
          s.overflowY !== "visible" ||
          s.clipPath !== "none"
        ) {
          const b = p.getBoundingClientRect();
          clip = {
            left: Math.max(clip.left, b.left),
            top: Math.max(clip.top, b.top),
            right: Math.min(clip.right, b.right),
            bottom: Math.min(clip.bottom, b.bottom),
          };
        }
      }
      // Glyph boxes of tight display type exceed the line box: use the line box.
      const lh = parseFloat(getComputedStyle(el).lineHeight);
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const t of range.getClientRects()) {
        const extra = lh && t.height > lh ? (t.height - lh) / 2 : 0;
        const r = {
          left: Math.max(t.left, clip.left),
          top: Math.max(t.top + extra, clip.top),
          right: Math.min(t.right, clip.right),
          bottom: Math.min(t.bottom - extra, clip.bottom),
        };
        r.width = r.right - r.left;
        r.height = r.bottom - r.top;
        if (r.width > 2 && r.height > 2) boxes.push({ el, r });
      }
    }
    let overlaps = 0;
    const samples = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i],
          b = boxes[j];
        if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el))
          continue;
        const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        // Display type has tight line boxes: only a real overlap of the glyph lines counts.
        if (x > 3 && y > Math.max(4, 0.3 * Math.min(a.r.height, b.r.height))) {
          overlaps++;
          if (samples.length < 3)
            samples.push(`${describe(a.el)} × ${describe(b.el)}`);
        }
      }
    if (overlaps)
      problems.push(
        `${overlaps} overlapping text boxes: ${samples.join(" ; ")}`,
      );
    return problems;
  });

const finals = new Set([
  "dashboard-1512",
  "dashboard-390",
  "week-1512",
  "plan-390",
  "transactions-2560",
  "import-1512",
]);

async function visual() {
  section = "visual";
  mkdirSync(resolve(SHOTS, "all"), { recursive: true });
  for (const width of [390, 1512, 2560]) {
    const { context, page } = await open("/?demo#/", {
      viewport: { width, height: width < 720 ? 844 : 1000 },
    });
    for (const [name, h] of [
      ["dashboard", "#/"],
      ["week", "#/semaine"],
      ["plan", "#/plan"],
      ["transactions", "#/transactions"],
      ["import", "#/import"],
    ]) {
      await go(page, h);
      // Scroll through once so lazy logos load before the audit.
      await page.evaluate(async () => {
        for (
          let y = 0;
          y < document.documentElement.scrollHeight;
          y += innerHeight
        ) {
          scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        scrollTo(0, 0);
      });
      await page.waitForTimeout(500);
      await step(`${name} @${width}: layout + a11y audit`, async () => {
        const problems = await audit(page);
        const key = `${name}-${width}`;
        await page.screenshot({
          path: resolve(
            SHOTS,
            finals.has(key) ? `${key}.png` : `all/${key}.png`,
          ),
          fullPage: true,
        });
        assert(!problems.length, problems.slice(0, 4).join(" | "));
      });
    }
    await context.close();
  }
}

const sections = {
  shell,
  dashboard,
  week,
  plan,
  transactions,
  import: importPage,
  visual,
};
for (const [name, run] of Object.entries(sections))
  if (!only.length || only.includes(name)) await run();

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed`,
);
if (process.env.DEBUG) console.log(`Debug files in ${TMP}`);
if (consoleErrors.length)
  console.log(`Console errors:\n  ${[...new Set(consoleErrors)].join("\n  ")}`);
process.exit(failed.length || consoleErrors.length ? 1 : 0);
