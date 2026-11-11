import { describe, expect, it } from "vitest";
import { RUN_DISK_OPTIONS, diskHourCost, diskStepIds, keptDiskNote, keptDiskSteps, lambdaDiskNote, runDiskHint, runDiskOf, takesRunDisk } from "./runDisk";

const batch = { id: "b", type: "processor" };
const notebook = { id: "nb", type: "processor", runtimeConfig: { interactive: true } };
const lambda = { id: "l", type: "processor", computeType: "lambda" };
const gpu = { id: "g", type: "processor", computeType: "gpu" };
const input = { id: "in", type: "data-source" };
const output = { id: "out", type: "data-target", computeType: "standard" };
const dag = [batch, notebook, lambda, gpu, input, output];

describe("takesRunDisk", () => {
  it("applies to a batch step on Fargate, by default or by the run's choice", () => {
    expect(takesRunDisk(batch)).toBe(true);
    expect(takesRunDisk(batch, { executionTarget: "standard" })).toBe(true);
    expect(takesRunDisk(lambda, { executionTarget: "standard" })).toBe(true);
  });
  it("not to a notebook, a Lambda or GPU step, an input or an output", () => {
    expect(takesRunDisk(notebook)).toBe(false);
    expect(takesRunDisk(batch, { interactive: true })).toBe(false);
    expect(takesRunDisk(lambda)).toBe(false);
    expect(takesRunDisk(batch, { executionTarget: "lambda" })).toBe(false);
    expect(takesRunDisk(gpu)).toBe(false);
    expect(takesRunDisk(input)).toBe(false);
    expect(takesRunDisk(output)).toBe(false);
    expect(takesRunDisk(null)).toBe(false);
  });
});

describe("diskStepIds", () => {
  it("lists the steps the run's disk applies to, as configured", () => {
    expect(diskStepIds(dag)).toEqual(["b"]);
    expect(diskStepIds(dag, { b: { executionTarget: "lambda" }, l: { executionTarget: "standard" } })).toEqual(["l"]);
    expect(diskStepIds([])).toEqual([]);
  });
});

describe("diskHourCost", () => {
  it("prices a disk an hour", () => {
    expect(diskHourCost(50)).toBe("under 1¢");
    expect(diskHourCost(300)).toBe("about 3¢");
    expect(diskHourCost(1000)).toBe("about 11¢");
    expect(diskHourCost(2000)).toBe("about 22¢");
    expect(diskHourCost(16384)).toBe("about $1.82");
  });
});

describe("keptDiskSteps", () => {
  it("counts the steps that keep their own disk, by why", () => {
    expect(keptDiskSteps(dag)).toEqual({ lambda: 1, gpu: 1, notebook: 1 });
    expect(keptDiskSteps(dag, { l: { executionTarget: "standard" }, b: { interactive: true } })).toEqual({ lambda: 0, gpu: 1, notebook: 2 });
    expect(keptDiskSteps([batch])).toEqual({ lambda: 0, gpu: 0, notebook: 0 });
  });
});

describe("runDiskHint", () => {
  it("says what a step gets anyway, when to choose more, and the cost once chosen", () => {
    expect(runDiskHint("", 1)).toBe("Each step gets about three times its inputs in disk. Choose more when the step on Fargate writes or unpacks more than that.");
    expect(runDiskHint("", 3)).toContain("when the 3 steps on Fargate write or unpack more than that.");
    expect(runDiskHint(300, 3)).toMatch(/more than that\. about 3¢ an hour per step\.$/);
  });
  it("keeps to the Fargate steps; the others get their own notes", () => {
    expect(runDiskHint(300, 2)).not.toMatch(/Lambda|GPU|notebook/);
  });
  it("offers sizes from 50 GB to 2 TB", () => {
    expect(RUN_DISK_OPTIONS[0]).toBe(50);
    expect(RUN_DISK_OPTIONS[RUN_DISK_OPTIONS.length - 1]).toBe(2000);
  });
});

describe("lambdaDiskNote", () => {
  it("says a Lambda step keeps its 10 GB and how to give it more", () => {
    expect(lambdaDiskNote(0)).toBe("");
    expect(lambdaDiskNote(1)).toBe("1 step on Lambda keeps Lambda's 10 GB whatever is chosen here: to give it more, run it on Fargate in its step settings.");
    expect(lambdaDiskNote(2)).toMatch(/^2 steps on Lambda keep Lambda's 10 GB whatever is chosen here: to give one more,/);
  });
});

describe("keptDiskNote", () => {
  it("names the GPU steps and notebooks, only those the run has", () => {
    expect(keptDiskNote({})).toBe("");
    expect(keptDiskNote({ gpu: 1 })).toBe("1 GPU step uses its instance's disk.");
    expect(keptDiskNote({ notebook: 2 })).toBe("2 notebooks have the disk chosen when it starts.");
    expect(keptDiskNote({ gpu: 2, notebook: 1 })).toBe("2 GPU steps use their instance's disk. 1 notebook has the disk chosen when it starts.");
  });
});

describe("runDiskOf", () => {
  it("is the disk every batch step asked for", () => {
    const configs = [{ nodeId: "a", diskGiB: 300 }, { nodeId: "b", diskGiB: 300 }, { nodeId: "nb", diskGiB: 128 }];
    expect(runDiskOf(configs, ["a", "b"])).toBe(300);
  });
  it("is nothing when the steps differ, one has none, or there are none", () => {
    expect(runDiskOf([{ nodeId: "a", diskGiB: 300 }, { nodeId: "b", diskGiB: 500 }], ["a", "b"])).toBe("");
    expect(runDiskOf([{ nodeId: "a", diskGiB: 300 }], ["a", "b"])).toBe("");
    expect(runDiskOf([{ nodeId: "a" }], ["a"])).toBe("");
    expect(runDiskOf([], [])).toBe("");
    expect(runDiskOf(undefined, ["a"])).toBe("");
  });
});
