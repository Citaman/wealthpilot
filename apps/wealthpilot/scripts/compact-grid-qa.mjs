// Real gestures in an isolated context, synthetic data only. No production writes.
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const out = path.resolve("../../tmp/compact-grid-qa");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1512, height: 1100 },
  locale: "fr-FR",
  recordVideo: { dir: out },
});
const page = await context.newPage(),
  checks = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const check = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  console.log(pass ? "PASS" : "FAIL", name);
};
const frame = () =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
const settle = async () => {
  await frame();
  await page.waitForTimeout(220);
};
const tile = (id) => page.locator(`[data-instance="${id}"]`);
const geometry = () =>
  page.locator(".free-tile[data-instance]").evaluateAll((nodes) =>
    nodes.map((el) => {
      const r = el.getBoundingClientRect(),
        inner = el.querySelector(".free-tile-content").getBoundingClientRect();
      return {
        id: el.dataset.instance,
        x: r.x + scrollX,
        y: r.y + scrollY,
        w: r.width,
        h: r.height,
        transform: el.style.transform,
        fits: inner.bottom <= r.bottom + 2,
      };
    }),
  );
const noOverlap = (boxes) =>
  boxes.every((a, i) =>
    boxes
      .slice(i + 1)
      .every(
        (b) =>
          !(
            a.x < b.x + b.w - 2 &&
            a.x + a.w > b.x + 2 &&
            a.y < b.y + b.h - 2 &&
            a.y + a.h > b.y + 2
          ),
      ),
  );
const capture = (name) =>
  page.screenshot({ path: path.join(out, `${name}.png`) });
try {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00Z"));
  await page.goto("http://127.0.0.1:5201/#dashboard");
  await page.evaluate(async () => {
    const { db } = await import("/src/store.ts"),
      { defaultPreferences } = await import("/src/types.ts"),
      { migrateBoard, makeInstance, initialLayout, validateBoardState } =
        await import("/src/layout.ts");
    const instances = [
      { ...makeInstance("balance", "balance"), size: "medium" },
      { ...makeInstance("budgets", "budget"), size: "medium" },
      { ...makeInstance("chart", "chart"), size: "medium" },
      { ...makeInstance("transactions", "transactions"), size: "medium" },
      { ...makeInstance("sources", "source"), size: "small" },
    ];
    const board = migrateBoard({ ...defaultPreferences, widgets: [] });
    const layouts = Object.fromEntries(
      ["laptop", "desktop", "wide"].map((bp) => {
        const layout = initialLayout(instances, bp);
        layout.forEach((p, n) =>
          Object.assign(p, {
            x: (n % 2) * 12,
            w: 12,
            y: Math.floor(n / 2) * 210,
            h: 200,
          }),
        );
        return [bp, layout];
      }),
    );
    board.views[0] = {
      ...board.views[0],
      instances,
      layouts,
      mobileOrder: instances.map((i) => i.id),
    };
    if (!validateBoardState(board))
      throw new Error(
        "Synthetic board fixture must satisfy production validation",
      );
    await db.accounts.put({
      id: "Commun",
      checkpoint: { date: "2026-10-05", amount: 345000 },
    });
    await db.transactions.bulkPut(
      Array.from({ length: 20 }, (_, n) => ({
        id: `t${n}`,
        batchId: "qa",
        date: `2026-10-${String(1 + (n % 4)).padStart(2, "0")}`,
        amount: n === 0 ? 250000 : -1000 - n * 20,
        account: "Commun",
        label: `Commerce ${n}`,
        merchant: `Commerce ${n}`,
        category: n % 2 ? "Courses" : "Restaurants",
        internal: false,
        raw: {},
        fingerprint: `t${n}`,
      })),
    );
    await db.budgets.bulkPut(
      ["Courses", "Restaurants"].map((category, n) => ({
        id: `b${n}`,
        category,
        month: "2026-10",
        amount: 40000,
      })),
    );
    await db.preferences.put({
      ...defaultPreferences,
      setupDone: true,
      goal: null,
      extraGoals: [],
      board,
    });
    localStorage.setItem("wealthpilot-next-month", "2026-10");
  });
  await page.goto("http://127.0.0.1:5201/#dashboard");
  await page.reload();
  await tile("chart").waitFor();
  await settle();
  const initial = await geometry();
  check(
    "Legacy stretched heights and blank rows compact on open",
    initial.every((b) => b.h < 1000) &&
      initial.find((b) => b.id === "chart").y < 1000,
    initial,
  );
  check(
    "Initial cards fit without overlap",
    initial.every((b) => b.fits) && noOverlap(initial),
    initial,
  );
  await capture("01-initial");

  const markerBefore = await geometry();
  const marker = tile("chart").locator(".chart-event-toggle").first();
  await marker.click();
  await settle();
  const markerExpanded = await geometry();
  await tile("chart").screenshot({
    path: path.join(out, "12-marker-expanded.png"),
  });
  await marker.click();
  await settle();
  const markerCollapsed = await geometry();
  check(
    "Movement detail opens within its row and releases the following card on collapse",
    markerExpanded.find((b) => b.id === "source").y >
      markerBefore.find((b) => b.id === "source").y &&
      Math.abs(
        markerCollapsed.find((b) => b.id === "source").y -
          markerBefore.find((b) => b.id === "source").y,
      ) < 2 &&
      (await marker.evaluate((el) => el === document.activeElement)),
    { markerBefore, markerExpanded, markerCollapsed },
  );

  const chartBefore = await geometry();
  await tile("chart")
    .getByRole("button", {
      name: "Afficher les valeurs du graphique",
      exact: true,
    })
    .click();
  await settle();
  const chartExpanded = await geometry();
  await capture("02-chart-expanded");
  await tile("chart")
    .getByRole("button", {
      name: "Masquer les valeurs du graphique",
      exact: true,
    })
    .click();
  await settle();
  const chartCollapsed = await geometry();
  check(
    "Graph table expands then restores natural height and following card",
    chartExpanded.find((b) => b.id === "chart").h >
      chartBefore.find((b) => b.id === "chart").h &&
      Math.abs(
        chartCollapsed.find((b) => b.id === "chart").h -
          chartBefore.find((b) => b.id === "chart").h,
      ) < 2 &&
      chartExpanded.find((b) => b.id === "source").y >
        chartBefore.find((b) => b.id === "source").y &&
      Math.abs(
        chartCollapsed.find((b) => b.id === "source").y -
          chartBefore.find((b) => b.id === "source").y,
      ) < 2,
    { chartBefore, chartExpanded, chartCollapsed },
  );
  check(
    "Collapsing the chart preserves keyboard focus",
    await tile("chart")
      .getByRole("button", {
        name: "Afficher les valeurs du graphique",
        exact: true,
      })
      .evaluate((el) => el === document.activeElement),
  );
  await tile("chart").hover();
  const wheelBefore = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 180);
  await settle();
  check(
    "Wheel over a card scrolls the page, not an inner viewport",
    (await page.evaluate((before) => scrollY > before, wheelBefore)) &&
      (await tile("chart").evaluate((el) => el.scrollTop === 0)),
  );

  await page
    .getByRole("button", { name: "Organiser mon dashboard", exact: true })
    .click();
  await settle();
  const editing = await geometry();
  await tile("balance")
    .getByRole("button", { name: /^Personnaliser/ })
    .click();
  await settle();
  await page
    .getByRole("button", { name: "Très grand — Solde du foyer", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Fermer les réglages", exact: true })
    .click();
  await settle();
  const enlarged = await geometry();
  await capture("03-enlarged");
  await tile("balance")
    .getByRole("button", { name: /^Personnaliser/ })
    .click();
  await page
    .getByRole("button", { name: "Mini — Solde du foyer", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Fermer les réglages", exact: true })
    .click();
  await settle();
  const reduced = await geometry();
  await capture("04-reduced");
  check(
    "Enlarge moves neighbours; reducing lifts them back",
    enlarged.find((b) => b.id === "chart").y >
      editing.find((b) => b.id === "chart").y &&
      reduced.find((b) => b.id === "chart").y <
        enlarged.find((b) => b.id === "chart").y,
    { editing, enlarged, reduced },
  );
  check(
    "Closing editor returns focus and no clipping",
    (await tile("balance")
      .getByRole("button", { name: /^Personnaliser/ })
      .evaluate((el) => el === document.activeElement)) &&
      reduced.every((b) => b.fits) &&
      noOverlap(reduced),
    reduced,
  );

  // Put the first tile back at a realistic half-width before moving it onto its neighbour.
  await tile("balance")
    .getByRole("button", { name: /^Personnaliser/ })
    .click();
  await page
    .getByRole("button", { name: "Moyen — Solde du foyer", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Fermer les réglages", exact: true })
    .click();
  await settle();
  const handle = tile("balance").getByRole("button", { name: /^Déplacer/ });
  await handle.scrollIntoViewIfNeeded();
  const beforeDrag = await geometry(),
    h = await handle.boundingBox(),
    col = await page
      .locator(".free-board-container")
      .evaluate((el) => (el.clientWidth + 16) / 24);
  await page.mouse.move(h.x + 25, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + 25 + col * 12, h.y + h.height / 2, { steps: 15 });
  await settle();
  const duringDrag = await geometry();
  const placeholder = await page
    .locator(".react-grid-placeholder")
    .evaluate((el) => {
      const r = el.getBoundingClientRect(),
        s = getComputedStyle(el);
      return {
        x: r.x + scrollX,
        y: r.y + scrollY,
        w: r.width,
        h: r.height,
        background: s.backgroundColor,
        border: s.borderStyle,
        opacity: s.opacity,
      };
    });
  check(
    "Collision preview moves the neighbour before release",
    duringDrag.find((b) => b.id === "budget").y >
      beforeDrag.find((b) => b.id === "budget").y,
    { beforeDrag, duringDrag },
  );
  check(
    "Preview is a transparent dashed outline",
    placeholder.background === "rgba(0, 0, 0, 0)" &&
      placeholder.border === "dashed",
    placeholder,
  );
  await capture("05-drag-before-release");
  await page.mouse.up();
  await settle();
  const afterDrag = await geometry();
  check(
    "Dropped card exactly matches compact preview",
    ["x", "y", "w", "h"].every(
      (k) =>
        Math.abs(
          afterDrag.find((b) => b.id === "balance")[k] - placeholder[k],
        ) <= 2,
    ) && noOverlap(afterDrag),
    { placeholder, afterDrag },
  );
  await capture("06-after-drop");

  const resize = tile("balance").getByRole("button", {
    name: "Changer la taille de contenu par la largeur",
    exact: true,
  });
  check(
    "No misleading south or diagonal height handle",
    (await page
      .locator(".react-resizable-handle-s,.react-resizable-handle-se")
      .count()) === 0,
  );
  await resize.scrollIntoViewIfNeeded();
  const r = await resize.boundingBox(),
    beforeResize = await geometry();
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2 - col * 4, r.y + r.height / 2, {
    steps: 15,
  });
  await settle();
  const duringResize = await geometry();
  await capture("07-resize-before-release");
  check(
    "Real east resize previews the width before release",
    duringResize.find((b) => b.id === "balance").w <
      beforeResize.find((b) => b.id === "balance").w,
    { beforeResize, duringResize },
  );
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await settle();
  check(
    "Escape restores compact geometry exactly",
    JSON.stringify(await geometry()) === JSON.stringify(beforeResize),
    { beforeResize, after: await geometry() },
  );
  const commitHandle = await resize.boundingBox();
  await page.mouse.move(
    commitHandle.x + commitHandle.width / 2,
    commitHandle.y + commitHandle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    commitHandle.x + commitHandle.width / 2 - col * 4,
    commitHandle.y + commitHandle.height / 2,
    { steps: 15 },
  );
  await page.mouse.up();
  await settle();
  const resized = await geometry();
  check(
    "East resize commits a smaller content tier with height fitted to content",
    (await tile("balance").evaluate((el) =>
      el.classList.contains("widget-size-small"),
    )) &&
      resized.find((b) => b.id === "balance").w <
        beforeResize.find((b) => b.id === "balance").w &&
      Math.abs(
        resized.find((b) => b.id === "budget").y -
          resized.find((b) => b.id === "balance").y -
          resized.find((b) => b.id === "balance").h -
          24,
      ) < 2 &&
      resized.every((b) => b.fits) &&
      noOverlap(resized),
    { beforeResize, resized },
  );
  await capture("13-east-resize-committed");

  await tile("balance")
    .getByRole("button", { name: /^Déplacer/ })
    .focus();
  const keyboardBefore = await geometry();
  await page.keyboard.press("ArrowLeft");
  await settle();
  const keyboardMoved = await geometry();
  check(
    "Keyboard snaps one column with focus retained",
    Math.abs(
      keyboardBefore.find((b) => b.id === "balance").x -
        keyboardMoved.find((b) => b.id === "balance").x -
        col,
    ) < 2 &&
      (await tile("balance")
        .getByRole("button", { name: /^Déplacer/ })
        .evaluate((el) => el === document.activeElement)) &&
      noOverlap(keyboardMoved),
    { keyboardBefore, keyboardMoved },
  );
  await page.keyboard.press("ArrowRight");
  await settle();
  const verticalBefore = await geometry();
  await page.keyboard.press("ArrowDown");
  await settle();
  const verticalMoved = await geometry();
  check(
    "Keyboard Down crosses the neighbouring card in a compact grid",
    verticalMoved.find((b) => b.id === "balance").y >
      verticalBefore.find((b) => b.id === "balance").y &&
      verticalMoved.find((b) => b.id === "budget").y <
        verticalBefore.find((b) => b.id === "budget").y &&
      noOverlap(verticalMoved),
    { verticalBefore, verticalMoved },
  );
  await page.keyboard.press("ArrowUp");
  await settle();
  check(
    "Keyboard Up restores the preceding slot and keeps focus",
    JSON.stringify(await geometry()) === JSON.stringify(verticalBefore) &&
      (await tile("balance")
        .getByRole("button", { name: /^Déplacer/ })
        .evaluate((el) => el === document.activeElement)),
  );

  const beforeSave = await geometry();
  await capture("09-before-save");
  await page.getByRole("button", { name: "Terminer", exact: true }).click();
  await settle();
  await capture("10-after-save");
  const savedBeforeReload = await page.evaluate(async () => {
    const { db } = await import("/src/store.ts");
    return (await db.preferences.get("main"))?.board;
  });
  check(
    "Save succeeds and leaves edit mode",
    !(await page
      .getByRole("button", { name: "Terminer", exact: true })
      .isVisible()) && savedBeforeReload.revision === 1,
    {
      savedBeforeReload,
      alerts: await page.getByRole("alert").allTextContents(),
      statuses: await page.getByRole("status").allTextContents(),
    },
  );
  await page.reload();
  await tile("chart").waitFor();
  await settle();
  const saved = await page.evaluate(async () => {
    const { db } = await import("/src/store.ts");
    const prefs = await db.preferences.get("main");
    return {
      board: prefs?.board,
      accounts: await db.accounts.count(),
      transactions: await db.transactions.count(),
    };
  });
  check(
    "Compact layout persists without losing financial data",
    saved.accounts === 1 &&
      saved.transactions === 20 &&
      saved.board?.views[0].instances.length === 5 &&
      saved.board.views[0].instances.find((i) => i.id === "balance").size ===
        "small" &&
      saved.board.views[0].layouts.laptop.find((p) => p.i === "balance").x ===
        12,
    saved,
  );
  for (const width of [768, 1024, 3840, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    await settle();
    const boxes = await geometry();
    check(
      `No overlap or horizontal overflow at ${width}`,
      noOverlap(boxes) &&
        boxes.every((b) => b.fits) &&
        (await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        )),
      boxes,
    );
    await capture(`08-width-${width}`);
  }
  const reentry = [];
  for (let n = 0; n < 6; n++) {
    await page.setViewportSize({ width: 1512, height: 1100 });
    await settle();
    await page
      .getByRole("navigation", { name: "Navigation principale" })
      .getByRole("button", { name: "Transactions", exact: true })
      .click();
    await page.setViewportSize({ width: 390, height: 1100 });
    reentry.push(
      await page.evaluate(async () => {
        const button = [
          ...document.querySelectorAll(".wp-dock-bar button"),
        ].find((el) => el.textContent === "Dashboard");
        button.click();
        const frames = [];
        for (let i = 0; i < 3; i++) {
          await new Promise((r) => requestAnimationFrame(r));
          frames.push({
            frame: i,
            width: document.documentElement.scrollWidth,
            viewport: innerWidth,
          });
        }
        return frames;
      }),
    );
  }
  check(
    "Cached desktop dashboard returns at mobile width on first animation frame",
    reentry.flat().every((f) => f.width <= f.viewport + 1),
    reentry,
  );
  await capture("11-mobile-reentry");
  check("No runtime errors", errors.length === 0, errors);
} catch (error) {
  check("Scenario completes", false, String(error));
  await capture("failure");
} finally {
  await writeFile(
    path.join(out, "results.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
  await context.close();
  await browser.close();
}
if (checks.some((c) => !c.pass)) process.exitCode = 1;
