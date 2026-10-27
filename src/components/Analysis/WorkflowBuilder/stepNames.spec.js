import { describe, it, expect } from "vitest";
import { stepNames } from "./stepNames";

describe("step names", () => {
  it("numbers steps that share a name, top to bottom", () => {
    const nodes = [{ id: "s", n: "signals" }, { id: "a", n: "Test Ports Processor" }, { id: "t1", n: "Pennsieve Dataset" }, { id: "b", n: "Test Ports Processor" }, { id: "t2", n: "Pennsieve Dataset" }, { id: "d", n: "Download" }];
    const names = stepNames(nodes, (x) => x.n);
    expect([...names.values()]).toEqual([
      "signals",
      "Test Ports Processor (1)",
      "Pennsieve Dataset (1)",
      "Test Ports Processor (2)",
      "Pennsieve Dataset (2)",
      "Download",
    ]);
  });

  it("names a step without one", () => {
    expect(stepNames([{ id: "x" }], () => "").get("x")).toBe("Step");
  });
});
