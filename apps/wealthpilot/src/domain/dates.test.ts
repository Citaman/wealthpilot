import { describe, expect, it } from "vitest";
import { parseDate } from "./dates";

describe("parseDate", () => {
  it("auto reads ISO and French day-first dates only", () => {
    expect(parseDate("2026-10-05")).toBe("2026-10-05");
    expect(parseDate("05/10/2026")).toBe("2026-10-05");
    expect(parseDate("05/10/26")).toBeNull();
    expect(parseDate("2026-13-01")).toBeNull();
  });
  it("an explicit order reads US, year-first and two-digit years", () => {
    expect(parseDate("10/05/2026", "mdy")).toBe("2026-10-05");
    expect(parseDate("2026/10/05", "ymd")).toBe("2026-10-05");
    expect(parseDate("5.10.26", "dmy")).toBe("2026-10-05");
    expect(parseDate("31/02/2026", "dmy")).toBeNull();
  });
});
