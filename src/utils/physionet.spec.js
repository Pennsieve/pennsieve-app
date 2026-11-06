import { describe, it, expect, vi } from "vitest";
import { physionetProjects, countPhysionet, compareVersions, physionetVersions, physionetUrl } from "./physionet";

const entry = (name, title, publisher = "PhysioNet", anonymous = true) => ({ name, title, publisher, anonymous, keywords: [] });

describe("PhysioNet", () => {
  const catalog = [
    entry("slpdb", "MIT-BIH Polysomnographic Database"),
    entry("afdb", "MIT-BIH Atrial Fibrillation Database"),
    entry("mimiciii", "MIMIC-III", "PhysioNet", false),
    entry("physionet", "PhysioNet", "MIT Laboratory for Computational Physiology"),
    entry("openneuro", "OpenNeuro", "OpenNeuro"),
  ];

  it("takes the catalog's open PhysioNet projects, by title", () => {
    expect(physionetProjects(catalog).map((d) => d.name)).toEqual(["afdb", "slpdb"]);
  });

  it("counts them", async () => {
    expect(await countPhysionet({ catalog: () => Promise.resolve(catalog) })).toBe(2);
  });

  it("orders versions by each number in turn", () => {
    expect(["1.0.0", "1.10.0", "1.2.0", "2"].sort(compareVersions)).toEqual(["1.0.0", "1.2.0", "1.10.0", "2"]);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
  });

  it("lists a project's versions, newest first, without other folders", async () => {
    const listFolder = vi.fn().mockResolvedValue({ folders: ["1.0.0", "1.1.0", "files", "1.0.1"], files: [{ name: "afdb-1.0.0.zip" }] });
    expect(await physionetVersions("afdb", { listFolder })).toEqual(["1.1.0", "1.0.1", "1.0.0"]);
    expect(listFolder).toHaveBeenCalledWith({ dataset: "afdb" });
  });

  it("links a project's page", () => {
    expect(physionetUrl("challenge-2012")).toBe("https://physionet.org/content/challenge-2012/");
  });
});
