import { describe, expect, it } from "vitest";
import { isThemeMode } from "../theme-context";

describe("validation du thème persisté", () => {
  it.each(["light", "dark", "system"])("accepte %s", (mode) => {
    expect(isThemeMode(mode)).toBe(true);
  });

  it.each([null, "auto", "sepia", 1])("refuse %j", (mode) => {
    expect(isThemeMode(mode)).toBe(false);
  });
});
