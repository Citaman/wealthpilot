import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const out = path.resolve("../../tmp/palette-keyboard-qa");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({
    viewport: { width: 1512, height: 982 },
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
      { defaultPreferences } = await import("/src/types.ts"),
      { migrateBoard, makeInstance, addInstance } = await import(
        "/src/layout.ts"
      );
    const b = migrateBoard({ ...defaultPreferences, widgets: [] });
    let v = b.views[0];
    for (const tone of ["paper", "ink", "yellow", "pink", "cyan"])
      for (const type of [
        "available",
        "balance",
        "categories",
        "goals",
        "chart",
        "dues",
      ]) {
        const i = makeInstance(type, `${tone}-${type}`);
        i.tone = tone;
        i.representation = ["balance", "goals", "categories"].includes(type)
          ? "rings"
          : "default";
        v = addInstance(v, i);
      }
    b.views[0] = v;
    await db.accounts.put({
      id: "A",
      checkpoint: { date: "2026-10-04", amount: 150000 },
    });
    await db.transactions.bulkPut(
      Array.from({ length: 9 }, (_, n) => ({
        id: `t${n}`,
        batchId: "test",
        fingerprint: `t${n}`,
        date: `2026-10-0${(n % 3) + 1}`,
        amount: -(1000 + n * 500),
        merchant: "Démo",
        label: "Démo",
        category: ["Courses", "Transport", "Santé"][n % 3],
        account: "A",
        internal: false,
        raw: {},
      })),
    );
    await db.dues.put({
      id: "d",
      date: "2026-10-06",
      amount: -5000,
      label: "Échéance",
      account: "A",
    });
    await db.preferences.put({
      ...defaultPreferences,
      board: b,
      setupDone: true,
      goal: {
        name: "Maison",
        saved: 30000,
        target: 100000,
        monthly: 2000,
        icon: "house",
        color: "#9b446f",
      },
      extraGoals: [
        {
          name: "Mobilité",
          saved: 10000,
          target: 40000,
          icon: "car",
          color: "#187080",
        },
      ],
    });
  });
  await page.goto("http://127.0.0.1:5201/#dashboard");
  await page.locator("[data-instance]").first().waitFor();
  await page.waitForTimeout(350);
  const contrast = await page.evaluate(() => {
    const cv = new OffscreenCanvas(1, 1),
      ctx = cv.getContext("2d");
    const rgba = (color) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data].map((v, i) =>
        i === 3 ? v / 255 : v,
      );
    };
    const blend = (fg, bg) =>
      fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]));
    const lum = (c) =>
      c
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => {
      const l = [lum(a), lum(b)].sort((a, b) => b - a);
      return (l[0] + 0.05) / (l[1] + 0.05);
    };
    const failures = [],
      tested = [];
    for (const el of document.querySelectorAll(".free-tile .card *")) {
      if (
        ![...el.childNodes].some(
          (n) => n.nodeType === 3 && n.textContent.trim(),
        )
      )
        continue;
      const cs = getComputedStyle(el),
        rect = el.getBoundingClientRect();
      if (
        !rect.width ||
        !rect.height ||
        cs.visibility === "hidden" ||
        cs.display === "none"
      )
        continue;
      let layers = [],
        ancestor = el;
      while (ancestor) {
        layers.unshift(rgba(getComputedStyle(ancestor).backgroundColor));
        ancestor = ancestor.parentElement;
      }
      let bg = [255, 255, 255];
      for (const layer of layers) bg = blend(layer, bg);
      const fg = blend(rgba(el instanceof SVGElement ? cs.fill : cs.color), bg),
        value = ratio(fg, bg),
        large =
          parseFloat(cs.fontSize) >= 24 ||
          (parseFloat(cs.fontSize) >= 18.66 && parseInt(cs.fontWeight) >= 700),
        minimum = large ? 3 : 4.5;
      const row = {
        widget: el.closest("[data-instance]").dataset.instance,
        text: el.textContent.trim().slice(0, 70),
        tag: el.tagName,
        ratio: +value.toFixed(2),
        minimum,
        fg,
        bg,
      };
      tested.push(row);
      if (value + 0.005 < minimum) failures.push(row);
    }
    return { tested: tested.length, failures };
  });
  await writeFile(
    path.join(out, "contrast.json"),
    JSON.stringify(contrast, null, 2),
  );
  check(
    "five palettes readable text WCAG AA",
    contrast.tested > 100 && contrast.failures.length === 0,
    { tested: contrast.tested, failures: contrast.failures.slice(0, 10) },
  );
  await page.screenshot({ path: path.join(out, "palette-paper.png") });
  await page.locator('[data-instance="ink-goals"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, "palette-ink.png") });
  // Smaller independent fixture for a fully keyboard-only edit path.
  await page.evaluate(async () => {
    const { db } = await import("/src/store.ts");
    const p = await db.preferences.get("main"),
      b = p.board,
      v = b.views[0];
    v.instances = v.instances.filter((i) => i.id === "paper-balance");
    v.mobileOrder = v.instances.map((i) => i.id);
    for (const key of ["laptop", "desktop", "wide"])
      v.layouts[key] = [
        {
          ...v.layouts[key].find((p) => p.i === "paper-balance"),
          x: 0,
          y: 0,
          w: 8,
          h: 42,
        },
      ];
    await db.preferences.put(p);
  });
  await page.reload();
  const organise = page.getByRole("button", {
    name: "Organiser mon dashboard",
    exact: true,
  });
  await organise.waitFor();
  async function tabTo(locator) {
    for (let n = 0; n < 300; n++) {
      if (await locator.evaluate((el) => el === document.activeElement)) return;
      await page.keyboard.press("Tab");
    }
    throw new Error(
      "Control unreachable through Tab: " +
        (await locator.getAttribute("aria-label")),
    );
  }
  await tabTo(organise);
  await page.keyboard.press("Enter");
  const handle = page.getByRole("button", {
    name: "Déplacer Solde du foyer",
    exact: true,
  });
  await tabTo(handle);
  const before = await page.locator("[data-instance]").getAttribute("style");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  check(
    "keyboard move and resize preserve focused handle",
    (await handle.evaluate((el) => el === document.activeElement)) &&
      before !== (await page.locator("[data-instance]").getAttribute("style")),
  );
  const customize = page.getByRole("button", {
    name: "Personnaliser Solde du foyer",
    exact: true,
  });
  await tabTo(customize);
  await page.keyboard.press("Enter");
  const line = page.getByRole("spinbutton", {
    name: "Ligne de la carte",
    exact: true,
  });
  await tabTo(line);
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("20");
  await page.keyboard.press("Tab");
  check(
    "coordinate input reachable without pointer",
    (await line.inputValue()) === "20",
  );
  const done = page.getByRole("button", { name: "Terminer", exact: true });
  await tabTo(done);
  await page.keyboard.press("Enter");
  await organise.waitFor();
  check(
    "finish returns focus to organiser",
    await organise.evaluate((el) => el === document.activeElement),
  );
  await page.reload();
  await organise.waitFor();
  const saved = await page.evaluate(async () => {
    const { db } = await import("/src/store.ts");
    return (await db.preferences.get("main")).board.views[0].layouts.laptop[0];
  });
  check(
    "keyboard geometry survives reload",
    saved.x === 1 && saved.w === 9 && saved.y === 20,
    saved,
  );
  await tabTo(organise);
  await page.keyboard.press("Enter");
  await tabTo(
    page.getByRole("button", { name: "Retirer Solde du foyer", exact: true }),
  );
  await page.keyboard.press("Enter");
  const add = page.getByRole("button", {
    name: "Ajouter une carte",
    exact: true,
  });
  await page.waitForFunction(
    () =>
      document.activeElement?.tagName === "BUTTON" &&
      document.activeElement.textContent?.trim() === "Ajouter une carte",
  );
  check(
    "removing last card restores useful keyboard focus",
    await add.evaluate((el) => el === document.activeElement),
  );
  await page.keyboard.press("Enter");
  const search = page.getByRole("searchbox", { name: "Chercher une carte" });
  await tabTo(search);
  await page.keyboard.type("Solde");
  const addBalance = page.getByRole("button", {
    name: "Ajouter Solde du foyer",
    exact: true,
  });
  await tabTo(addBalance);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(50);
  check(
    "adding card focuses its configuration",
    await page
      .getByRole("button", {
        name: "Personnaliser Solde du foyer",
        exact: true,
      })
      .evaluate((el) => el === document.activeElement),
  );
  await tabTo(page.getByRole("button", { name: "Annuler", exact: true }));
  await page.keyboard.press("Enter");
  await organise.waitFor();
  await page.waitForFunction(
    () =>
      document.activeElement?.tagName === "BUTTON" &&
      document.activeElement.textContent?.trim() === "Organiser mon dashboard",
  );
  check(
    "cancel returns keyboard focus without deleting saved card",
    (await organise.evaluate((el) => el === document.activeElement)) &&
      (await page.locator('[data-instance="paper-balance"]').count()) === 1,
  );
  await page.screenshot({ path: path.join(out, "keyboard-final.png") });
  check("no runtime errors", errors.length === 0, errors);
} catch (e) {
  check("flow complete", false, e.stack);
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
if (checks.some((c) => !c.pass)) process.exitCode = 1;
