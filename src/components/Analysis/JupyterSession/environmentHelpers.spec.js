import { describe, it, expect } from "vitest";
import { environmentChoices, matchesQuery, packageName, packageSummary, switchBusy, switchLabel } from "./environmentHelpers";

const py = (version, status = "ready", packages = ["numpy==2.1.0"], runtime = { language: "python", version: "3.12" }) => ({
  version, status, packages, runtime,
});

describe("packageSummary", () => {
  it("names the first packages and counts the rest", () => {
    expect(packageName("scikit-learn>=1.4")).toBe("scikit-learn");
    expect(packageSummary(["numpy==2.1", "pandas==2.2", "scipy==1.14", "mne==1.8", "h5py==3.12"])).toBe("numpy, pandas, scipy +2");
    expect(packageSummary(["numpy==2.1"])).toBe("numpy");
    expect(packageSummary([])).toBe("");
  });
});

describe("environmentChoices", () => {
  const envs = [
    { id: "b", name: "zeta", language: "python", latest: py(2) },
    { id: "a", name: "alpha", language: "python", latest: py(3, "building") },
    { id: "c", name: "old-python", language: "python", latest: py(1, "ready", [], { language: "python", version: "3.11" }) },
    { id: "d", name: "never", language: "python", latest: py(1, "failed") },
    { id: "r", name: "r-env", language: "r", latest: py(1) },
  ];

  it("offers each environment's newest ready version for the kernel", () => {
    const choices = environmentChoices(envs, "Python 3.12.3", { a: [py(3, "building"), py(2, "ready", ["mne==1.8"])] });
    expect(choices.map((c) => [c.name, c.version, c.disabled])).toEqual([
      ["alpha", 2, ""],
      ["zeta", 2, ""],
      ["never", 0, "No ready version"],
      ["old-python", 1, "Python 3.11"],
    ]);
  });

  it("says a first version is still building", () => {
    const choices = environmentChoices([envs[1]], "Python 3.12.3");
    expect(choices[0].disabled).toBe("Building…");
  });
});

describe("matchesQuery", () => {
  const choice = { name: "neuro", packages: ["mne==1.8", "numpy==2.1"] };
  it("matches the name or a package", () => {
    expect(matchesQuery(choice, "")).toBe(true);
    expect(matchesQuery(choice, "NEU")).toBe(true);
    expect(matchesQuery(choice, "mne")).toBe(true);
    expect(matchesQuery(choice, "1.8")).toBe(false);
    expect(matchesQuery(choice, "pandas")).toBe(false);
  });
});

describe("switchLabel", () => {
  it("describes each stage", () => {
    expect(switchLabel(null)).toBe("");
    expect(switchLabel({ state: "resolving", environmentId: "e" })).toBe("Preparing the environment…");
    expect(switchLabel({ state: "resolving", environmentId: "" })).toBe("Switching back…");
    expect(switchLabel({ state: "downloading", bytes: 12e6, sizeBytes: 90e6 })).toBe("Downloading… 12 MB of 90 MB");
    expect(switchLabel({ state: "restarting" })).toBe("Restarting the kernel…");
    expect(switchLabel({ state: "done" })).toBe("");
    expect(switchBusy({ state: "downloading" })).toBe(true);
    expect(switchBusy({ state: "failed" })).toBe(false);
    expect(switchBusy(null)).toBe(false);
  });
});
