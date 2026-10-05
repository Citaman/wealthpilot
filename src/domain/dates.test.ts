import { expect, it } from "vitest";
import { parseDate } from "./dates";
import { formatEuro } from "./money";

it("dates et montants : parseDate (ISO, jour d’abord, ordres explicites) et formatEuro", () => {
  // auto reads ISO and French day-first dates only
  expect(parseDate("2026-10-05")).toBe("2026-10-05");
  expect(parseDate("05/10/2026")).toBe("2026-10-05");
  expect(parseDate("05/10/26")).toBeNull();
  expect(parseDate("2026-13-01")).toBeNull();
  // an explicit order reads US, year-first and two-digit years
  expect(parseDate("10/05/2026", "mdy")).toBe("2026-10-05");
  expect(parseDate("2026/10/05", "ymd")).toBe("2026-10-05");
  expect(parseDate("5.10.26", "dmy")).toBe("2026-10-05");
  expect(parseDate("31/02/2026", "dmy")).toBeNull();

  // thin spaces, true minus sign, cents only when useful
  const f = (...a: Parameters<typeof formatEuro>) =>
    formatEuro(...a).replace(/\s/g, " ");
  expect(f(123450)).toBe("1 234,50 €");
  expect(f(-5000)).toBe("−50 €");
  expect(f(150, { cents: "always" })).toBe("1,50 €");
  expect(f(5000, { signed: true })).toBe("+50 €");
  expect(f(12345, { cents: "never" })).toBe("123 €");
});
