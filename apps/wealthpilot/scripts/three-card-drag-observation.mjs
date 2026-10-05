// One qualitative drag reproduction; no score and no application changes.
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const url = process.env.QA_URL || "http://127.0.0.1:5203";
const out = path.resolve("../../tmp/three-card-drag-observation");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true }),
  seedContext = await browser.newContext(),
  seed = await seedContext.newPage();
await seed.goto("http://127.0.0.1:5201");
await seed.evaluate(async () => {
  const { db } = await import("/src/store.ts"),
    { defaultPreferences } = await import("/src/types.ts"),
    { migrateBoard, makeInstance, initialLayout } = await import(
      "/src/layout.ts"
    );
  const instances = ["balance", "flows", "categories"].map((type, n) => ({
    ...makeInstance(type, `card-${n}`),
    size: "small",
  }));
  const board = migrateBoard({ ...defaultPreferences, widgets: [] });
  board.views[0] = {
    ...board.views[0],
    instances,
    mobileOrder: instances.map((i) => i.id),
    layouts: Object.fromEntries(
      ["laptop", "desktop", "wide"].map((bp) => [
        bp,
        initialLayout(instances, bp).map((p, n) => ({
          ...p,
          x: n === 1 ? 16 : 0,
          y: n === 2 ? 30 : 0,
          w: 8,
        })),
      ]),
    ),
  };
  await db.accounts.put({
    id: "Commun",
    checkpoint: { date: "2026-10-05", amount: 200000 },
  });
  await db.transactions.bulkPut(
    [
      [-1000, "Courses"],
      [-4000, "Transport"],
      [200000, "Salaire"],
    ].map(([amount, category], n) => ({
      id: String(n),
      account: "Commun",
      date: "2026-10-02",
      amount,
      category,
      merchant: category,
      label: category,
      raw: {},
      internal: false,
      fingerprint: String(n),
      batchId: "synthetic",
    })),
  );
  await db.preferences.put({ ...defaultPreferences, setupDone: true, board });
  localStorage.setItem("wealthpilot-next-month", "2026-10");
});
const storage = await seedContext.storageState({ indexedDB: true });
await seedContext.close();
storage.origins = storage.origins.map((origin) => ({ ...origin, origin: url }));
const context = await browser.newContext({
    storageState: storage,
    viewport: { width: 1512, height: 982 },
    recordVideo: { dir: out },
    locale: "fr-FR",
  }),
  page = await context.newPage(),
  frames = [];
const tile = (n) => page.locator(`[data-instance="card-${n}"]`);
async function capture(name, pointer) {
  const geometry = await page.evaluate(() => ({
    scrollY,
    viewport: [innerWidth, innerHeight],
    cards: [...document.querySelectorAll("[data-instance]")].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        id: el.dataset.instance,
        x: r.x,
        y: r.y,
        documentY: r.y + scrollY,
        width: r.width,
        height: r.height,
        transform: el.style.transform,
      };
    }),
    placeholder: [...document.querySelectorAll(".react-grid-placeholder")].map(
      (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      },
    ),
  }));
  frames.push({ name, pointer, ...geometry });
  await page.screenshot({ path: path.join(out, name + ".png") });
}
const settle = () =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
async function start(n) {
  const handle = tile(n).locator(".drag-handle");
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox(),
    card = await tile(n).boundingBox();
  const pointer = { x: box.x + 12, y: box.y + box.height / 2 };
  await page.mouse.move(pointer.x, pointer.y);
  await page.mouse.down();
  return { pointer, offset: { x: pointer.x - card.x, y: pointer.y - card.y } };
}
try {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00Z"));
  await page.goto(url + "/#dashboard");
  await page
    .getByRole("button", { name: "Organiser mon dashboard", exact: true })
    .click();
  await capture("01-before");
  let gesture = await start(2);
  let grid = await page.locator(".free-board-container").boundingBox(),
    column = (grid.width + 16) / 24;
  const destination = {
    x: grid.x + column * 8 + gesture.offset.x,
    y: grid.y + gesture.offset.y,
  };
  await page.mouse.move(destination.x, destination.y, { steps: 18 });
  await settle();
  await capture("02-free-space-before-release", destination);
  await page.mouse.up();
  await settle();
  await capture("03-free-space-released", destination);
  gesture = await start(2);
  const first = await tile(0).boundingBox();
  const occupied = {
    x: first.x + gesture.offset.x,
    y: first.y + gesture.offset.y,
  };
  await page.mouse.move(occupied.x, occupied.y, { steps: 18 });
  await settle();
  await capture("04-occupied-before-release", occupied);
  await page.mouse.up();
  await settle();
  await capture("05-occupied-released", occupied);
  await page.evaluate(() => window.scrollTo(0, 250));
  gesture = await start(0);
  const held = { x: gesture.pointer.x + 30, y: gesture.pointer.y };
  await page.mouse.move(held.x, held.y, { steps: 5 });
  await settle();
  await capture("06-scroll-start", held);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(150);
  await capture("07-scroll-held-no-pointermove", held);
  await page.mouse.move(held.x + 1, held.y);
  await settle();
  await capture("08-scroll-after-pointermove", { x: held.x + 1, y: held.y });
  await page.mouse.up();
  await settle();
  await capture("09-scroll-release");
} finally {
  await writeFile(
    path.join(out, "observations.json"),
    JSON.stringify(frames, null, 2),
  );
  await context.close();
  await browser.close();
  console.log(frames.map((frame) => frame.name));
}
