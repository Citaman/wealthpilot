import { describe, expect, it } from "vitest";
import { getImportQuality } from "../import-quality";

describe("getImportQuality", () => {
  it("distinguishes an imported file from a reconciled bank statement", () => {
    expect(getImportQuality({ isReconciled: true }, 0)).toBe("reconciled");
    expect(getImportQuality({ isReconciled: true }, 1)).toBe("needs-review");
    expect(getImportQuality({ isReconciled: false }, 0)).toBe("needs-review");
    expect(getImportQuality(null, 0)).toBe("imported");
  });
});
