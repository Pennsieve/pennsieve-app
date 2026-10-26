import { describe, it, expect } from "vitest";
import { formatCost } from "./runHelpers";

describe("formatCost", () => {
  it("says a tiny cost is under a hundredth of a cent, not $0.0000", () => {
    expect(formatCost(0.000004)).toBe("< $0.0001");
    expect(formatCost(0.0003)).toBe("$0.0003");
    expect(formatCost(1.234)).toBe("$1.23");
    expect(formatCost(0)).toBe("$0.00");
  });
});
