// Called by GRID_PERF=1 node scripts/grid-qa.mjs. Synthetic IndexedDB only.
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import {
  TraceMap,
  originalPositionFor,
} from "../../../node_modules/@jridgewell/trace-mapping/dist/trace-mapping.mjs";

export async function runGridPerformance(browser, storage) {
  const base = process.env.GRID_PERF_URL || "http://127.0.0.1:5203",
    out = path.resolve("../../tmp/grid-performance-qa");
  await mkdir(out, { recursive: true });
  storage.origins = storage.origins.map((origin) => ({
    ...origin,
    origin: base,
  }));
  const context = await browser.newContext({
      storageState: storage,
      viewport: { width: 1512, height: 982 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date("2026-10-04T12:00:00Z"));
  await page.goto(base + "/#dashboard");
  await page.locator('[data-instance="fixture-0"]').waitFor();
  if ((await page.locator("[data-instance]").count()) !== 30)
    throw new Error("Invalid fixture: 30 instances required");
  await page
    .getByRole("button", { name: "Organiser mon dashboard", exact: true })
    .click();
  const handle = page
    .locator('[data-instance="fixture-0"]')
    .getByRole("button", { name: /^Déplacer/ });
  await handle.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const col = await page
    .locator(".free-board-container")
    .evaluate((el) => (el.clientWidth + 16) / 24);
  await page.evaluate(() => {
    window.__gridLongTasks = [];
    window.__gridObserver = new PerformanceObserver((list) =>
      window.__gridLongTasks.push(
        ...list
          .getEntries()
          .map((e) => ({ start: e.startTime, duration: e.duration })),
      ),
    );
    window.__gridObserver.observe({ type: "longtask", buffered: false });
  });
  const cdp = await context.newCDPSession(page);
  async function beginGesture() {
    const b = await handle.boundingBox();
    const x = b.x + 30,
      y = b.y + b.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    return { x, y };
  }
  async function endGesture() {
    await page.mouse.up();
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
  }
  const samples = [];
  for (let i = 0; i < 5; i++) {
    const { x, y } = await beginGesture();
    await page.mouse.move(x + (i % 2 ? -col : col), y, { steps: 12 });
    await endGesture();
  }
  await cdp.send("Tracing.start", {
    categories:
      "devtools.timeline,disabled-by-default-devtools.timeline,v8,blink.user_timing",
    transferMode: "ReturnAsStream",
  });
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
  await cdp.send("Profiler.start");
  for (let i = 0; i < 30; i++) {
    const { x, y } = await beginGesture();
    await page.evaluate(() => {
      window.__gridLongTasks = [];
      window.__gridFrames = [];
      window.__gridRunning = true;
      window.__gridStart = performance.now();
      function tick(t) {
        window.__gridFrames.push(t);
        if (window.__gridRunning) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
    await page.mouse.move(x + (i % 2 ? col : -col), y, { steps: 12 });
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(resolve)),
    );
    const sample = await page.evaluate(() => {
      window.__gridRunning = false;
      window.__gridLongTasks.push(
        ...window.__gridObserver
          .takeRecords()
          .map((e) => ({ start: e.startTime, duration: e.duration })),
      );
      const times = window.__gridFrames;
      return {
        elapsed: performance.now() - window.__gridStart,
        frames: times.slice(1).map((t, i) => t - times[i]),
        longTasks: window.__gridLongTasks,
      };
    });
    await endGesture();
    samples.push(sample);
  }
  const { profile } = await cdp.send("Profiler.stop");
  await writeFile(
    path.join(out, "gesture.cpuprofile"),
    JSON.stringify(profile),
  );
  const complete = new Promise((resolve) =>
    cdp.once("Tracing.tracingComplete", resolve),
  );
  await cdp.send("Tracing.end");
  const { stream } = await complete;
  let trace = "";
  for (;;) {
    const part = await cdp.send("IO.read", { handle: stream });
    trace += part.base64Encoded
      ? Buffer.from(part.data, "base64").toString()
      : part.data;
    if (part.eof) break;
  }
  await cdp.send("IO.close", { handle: stream });
  await writeFile(path.join(out, "gesture-trace.json"), trace);
  // Separate instrumented replay: exact function-entry counts, not inferred from CPU sampling.
  await cdp.send("Profiler.startPreciseCoverage", {
    callCount: true,
    detailed: true,
  });
  const mappedCalls = [],
    maps = new Map();
  const targets = [
    "selectDashboard",
    "forecastCash",
    "weeklyPlan",
    "balanceAt",
    "detectRecurrences",
    "activeRecurrences",
    "estimatedDues",
    "withEstimates",
    "spendingHistory",
    "suggestBudgets",
  ];
  let expectedFunctions = new Set(),
    registry = [];
  // Reload while instrumentation is already active: registry contains zero-count functions too.
  await page.reload();
  await page.locator('[data-instance="fixture-0"]').waitFor();
  await page
    .getByRole("button", { name: "Organiser mon dashboard", exact: true })
    .click();
  await handle.scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  const baseline = await cdp.send("Profiler.takePreciseCoverage");
  await writeFile(
    path.join(out, "coverage-registry.json"),
    JSON.stringify(baseline),
  );
  for (const script of baseline.result) {
    if (
      !script.url.startsWith(base + "/assets/") ||
      !script.url.endsWith(".js")
    )
      continue;
    let info = maps.get(script.url);
    if (info === undefined) {
      try {
        const file = path.join("dist", new URL(script.url).pathname);
        const content = await readFile(file, "utf8"),
          raw = JSON.parse(await readFile(file + ".map", "utf8"));
        info = { content, map: new TraceMap(raw) };
      } catch {
        info = null;
      }
      maps.set(script.url, info);
    }
    if (!info) continue;
    for (const fn of script.functions) {
      const prefix = info.content.slice(0, fn.ranges[0].startOffset),
        lines = prefix.split("\n");
      const origin = originalPositionFor(info.map, {
        line: lines.length,
        column: lines.at(-1).length,
      });
      if (
        !origin.source ||
        !/(domain|forecasting|intelligence)\.ts$/.test(origin.source)
      )
        continue;
      const sourceIndex = info.map.sources.indexOf(origin.source),
        source = info.map.sourcesContent?.[sourceIndex] || "";
      for (const name of targets) {
        const at = source.indexOf("export function " + name + "(");
        if (at < 0) continue;
        const start = source.slice(0, at).split("\n").length;
        // The first mapping for a function is its declaration, not an arbitrary inner range.
        if (origin.line >= start && origin.line <= start + 2) {
          expectedFunctions.add(name);
          registry.push({
            name,
            url: script.url,
            offset: fn.ranges[0].startOffset,
            source: origin.source,
            line: origin.line,
          });
        }
      }
    }
  }
  for (let i = 0; i < 5; i++) {
    const { x, y } = await beginGesture();
    await cdp.send("Profiler.takePreciseCoverage");
    await page.mouse.move(x + (i % 2 ? -col : col), y, { steps: 12 });
    const coverage = await cdp.send("Profiler.takePreciseCoverage");
    if (i === 0)
      await writeFile(
        path.join(out, "coverage-replay.json"),
        JSON.stringify(coverage),
      );
    for (const fn of registry) {
      const script = coverage.result.find((s) => s.url === fn.url),
        entry = script?.functions.find(
          (f) => f.ranges[0].startOffset === fn.offset,
        );
      mappedCalls.push({
        ...fn,
        replay: i,
        count: entry?.ranges[0].count ?? 0,
      });
    }
    await endGesture();
  }
  await cdp.send("Profiler.stopPreciseCoverage");
  await page.screenshot({ path: path.join(out, "after-35-gestures.png") });
  const allFrames = samples.flatMap((s) => s.frames).sort((a, b) => a - b),
    longTasks = samples.flatMap((s) => s.longTasks);
  const durations = samples.map((s) => s.elapsed).sort((a, b) => a - b),
    zeroFinance =
      mappedCalls.length > 0 &&
      targets.every((name) => expectedFunctions.has(name)) &&
      mappedCalls.every((c) => c.count === 0);
  const report = {
    at: new Date().toISOString(),
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    cpu: os.cpus()[0].model,
    browser: browser.version(),
    viewport: "1512×982 CSSpx",
    seed: 20261004,
    build: createHash("sha256")
      .update(await readFile("dist/index.html"))
      .digest("hex"),
    protocol:
      "Production 30 mounted card instances, 5 warmups then 30 horizontal pointer gestures of 12 events. No screenshots/video during measurement. Separate5 exact-coverage replays map function entry counts using production sourcemaps. Elapsed gesture includes event dispatch pacing, not response latency; frame intervals and main-thread long tasks are the responsiveness metrics.",
    warmups: 5,
    repetitions: 30,
    medianGesture: durations[14],
    p95Gesture: durations[28],
    worstGesture: durations[29],
    p95FrameInterval: allFrames[Math.ceil(allFrames.length * 0.95) - 1],
    worstFrameInterval: allFrames.at(-1),
    longTasks,
    financeFunctionsMapped: [...expectedFunctions],
    financeCalls: mappedCalls,
    zeroFinanceDuringMoves: zeroFinance,
    samples,
    errors,
    pass:
      longTasks.every((t) => t.duration <= 50) &&
      zeroFinance &&
      errors.length === 0,
  };
  await writeFile(
    path.join(out, "results.json"),
    JSON.stringify(report, null, 2),
  );
  await context.close();
  console.log(
    JSON.stringify({ ...report, samples: undefined, financeCalls: undefined }),
  );
  if (!report.pass) process.exitCode = 1;
}
