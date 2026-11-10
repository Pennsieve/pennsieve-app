import { describe, expect, it } from "vitest";
import { contrastOnWhite, readableOnWhite } from "./readableOnWhite";

describe("readableOnWhite", () => {
  it("keeps a colour that already reads on white", () => {
    expect(readableOnWhite("#011F5B")).toBe("#011f5b");
  });

  it("darkens a light colour until it reaches 4.5:1", () => {
    const shade = readableOnWhite("#7ea6c4");
    expect(shade).not.toBe("#7ea6c4");
    expect(contrastOnWhite(shade)).toBeGreaterThanOrEqual(4.5);
  });

  it("reads #rgb and ignores what it can't read", () => {
    expect(contrastOnWhite(readableOnWhite("#fc0"))).toBeGreaterThanOrEqual(4.5);
    expect(readableOnWhite("not a colour")).toBeNull();
    expect(readableOnWhite(undefined)).toBeNull();
  });

  it("reads the settings' rgba, as it shows on white", () => {
    const red = readableOnWhite("rgba(196, 30, 58, 1)");
    expect(red).toBe("#c41e3a");
    expect(contrastOnWhite(readableOnWhite("rgba(196, 30, 58, 0.4)"))).toBeGreaterThanOrEqual(4.5);
    expect(readableOnWhite("rgb(1, 2, 3)")).toBe("#010203");
    expect(readableOnWhite("#c41e3aff")).toBe("#c41e3a");
  });
});
