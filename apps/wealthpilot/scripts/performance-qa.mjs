// Production-only, isolated synthetic IndexedDB. Five warmups, thirty measurements.
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
const base = process.env.QA_URL || "http://127.0.0.1:5203";
const out = path.resolve("../../tmp/performance-qa");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = {
  at: new Date().toISOString(),
  platform: `${os.platform()} ${os.release()} ${os.arch()}`,
  cpu: os.cpus()[0].model,
  browser: browser.version(),
  viewport: "1512×982 CSS px",
  build: createHash("sha256")
    .update(await readFile("dist/index.html"))
    .digest("hex"),
  seed: 20261004,
  protocol:
    "Production, fresh browser context per volume, warm cache, 5 warmups then 30 inputs. Input event to committed deferred query plus two animation frames. p95=rank29/30. No network/user data.",
  runs: [],
};
for (const count of [1500, 10000, 50000]) {
  const context = await browser.newContext({
    viewport: { width: 1512, height: 982 },
  });
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    console.error("Browser error", error.message),
  );
  page.on("console", (message) => {
    if (message.type() === "error") console.error(message.text());
  });
  await page.goto(base);
  await page.getByRole("heading", { name: "Import de données." }).waitFor();
  await page.evaluate(async (count) => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open("WealthPilotNext_v1");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction(
        ["transactions", "accounts", "preferences"],
        "readwrite",
      );
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      for (let i = 0; i < count; i++)
        tx.objectStore("transactions").put({
          id: `qa-${i}`,
          batchId: "qa",
          date: `2026-09-${String(1 + (i % 28)).padStart(2, "0")}`,
          amount: -(100 + (i % 10000)),
          account: ["A", "B", "Commun"][i % 3],
          merchant: ["McDonald's", "Amazon", "Free Mobile", "Kiabi"][i % 4],
          category: ["Restauration", "Shopping", "Télécom", "Vêtements"][i % 4],
          label: `CARTE ACHAT ${i}`,
          fingerprint: `qa-${i}`,
          internal: false,
          raw: {},
        });
      for (const id of ["A", "B", "Commun"])
        tx.objectStore("accounts").put({
          id,
          checkpoint: {
            date: "2026-10-04",
            amount: 500000,
            status: "observed",
          },
        });
      tx.objectStore("preferences").put({
        id: "main",
        setupDone: true,
        safety: 0,
        essentials: 0,
        weekly: null,
        goal: null,
        widgets: [],
        budgetView: "list",
      });
    });
    db.close();
    localStorage.setItem("wealthpilot-period", "all");
  }, count);
  await page.goto(base + "/#transactions");
  await page.evaluate(() => localStorage.setItem("wealthpilot-period", "all"));
  await page.reload();
  await page.screenshot({
    path: path.join(out, `loaded-${count}.png`),
    fullPage: true,
  });
  const input = page.getByRole("searchbox", {
    name: "Rechercher une opération",
  });
  await input.waitFor();
  const initialRows = await page.locator(".ledger-row").count();
  if (!initialRows)
    throw new Error("No visible fixture rows: invalid performance benchmark");
  const times = [];
  for (let i = 0; i < 35; i++) {
    const query = ["mcdo", "amazon", "free", "kiabi", "introuvable"][i % 5];
    const ms = await page.evaluate(async (query) => {
      const input = document.querySelector(
        'input[aria-label="Rechercher une opération"]',
      );
      const section = document.querySelector(".ledger-surface");
      const start = performance.now();
      const done = new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () =>
            reject(
              new Error(
                `Render timeout: ${query} / ${section.dataset.searchQuery} / ${section.getAttribute("aria-busy")}`,
              ),
            ),
          5000,
        );
        const observer = new MutationObserver(() => {
          if (
            section.dataset.searchQuery === query &&
            section.getAttribute("aria-busy") === "false"
          ) {
            clearTimeout(timeout);
            observer.disconnect();
            requestAnimationFrame(() =>
              requestAnimationFrame(() => resolve(performance.now() - start)),
            );
          }
        });
        observer.observe(section, {
          attributes: true,
          subtree: true,
          childList: true,
        });
      });
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set.call(input, query);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return done;
    }, query);
    if (i >= 5) times.push(ms);
  }
  const sorted = times.toSorted((a, b) => a - b);
  report.runs.push({
    count,
    warmups: 5,
    repetitions: 30,
    median: sorted[14],
    p95: sorted[28],
    worst: sorted[29],
    pass: sorted[28] <= 200,
    times,
  });
  console.log(JSON.stringify(report.runs.at(-1)));
  if (count === 1500) {
    report.productionPages = [];
    for (const [route, title] of Object.entries({
      budgets: "Chaque euro, sa place.",
      previsions: "La suite, sans surprise.",
      accounts: "Les comptes, au clair.",
      goals: "Les projets qui comptent.",
      analytics: "Comprendre mes dépenses.",
      foyer: "À chacun sa part.",
      recurrents: "Récurrents.",
      calendar: "Calendrier.",
      categories: "Catégories & règles.",
    })) {
      await page.evaluate((route) => {
        location.hash = route;
      }, route);
      await page.getByRole("heading", { name: title, exact: true }).waitFor();
      report.productionPages.push({ route, opened: true });
    }
  }
  await context.close();
}
await browser.close();
await writeFile(
  path.join(out, "results.json"),
  JSON.stringify(report, null, 2),
);
console.log(`Report: ${path.join(out, "results.json")}`);
if (report.runs.some((r) => !r.pass)) process.exitCode = 1;
