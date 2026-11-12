import { describe, it, expect } from "vitest";
import { load } from "js-yaml";
import { reviewHelp, reviewSnippet, reviewSteps, portPattern, REVIEW_SOURCES } from "./reviewGuide";

const skipped = { fixtures: { status: "skipped", error: { code: "no_review_block", message: "no review block" } } };

const app = {
  inputs: [
    { name: "spatial", mediaTypes: ["application/x-hdf5; profile=anndata"] },
    { name: "metadata", mediaTypes: ["text/csv"] },
  ],
  parameters: [{ name: "N_NEIGHBORS", defaultValue: 10 }, { name: "SEED" }],
};

describe("review guide", () => {
  it("is offered to the owner of a release skipped for no review block only", () => {
    expect(reviewHelp(skipped, { owner: true })).toBe(true);
    expect(reviewHelp(skipped, { owner: false })).toBe(false);
    expect(reviewHelp({ fixtures: { status: "skipped", error: { code: "private_repository" } } }, { owner: true })).toBe(false);
    expect(reviewHelp({ fixtures: { status: "ready" } }, { owner: true })).toBe(false);
    expect(reviewHelp({}, { owner: true })).toBe(false);
    expect(reviewHelp(null, { owner: true })).toBe(false);
  });

  it("writes a valid review block for each source, from the app's ports", () => {
    expect(REVIEW_SOURCES.map((s) => s.id)).toEqual(["generate", "files", "dataset"]);

    const gen = load(reviewSnippet("generate", app)).review;
    expect(gen.version).toBe(1);
    expect(gen.generate.command).toBe('python tests/make_fixture.py "$REVIEW_INPUT_DIR"');
    expect(gen.inputs).toBeUndefined();

    const files = load(reviewSnippet("files", app)).review;
    expect(files.inputs).toEqual({ spatial: { files: ["tests/data/*.h5ad"] }, metadata: { files: ["tests/data/*.csv"] } });

    const text = reviewSnippet("dataset", app);
    expect(text).toContain("spatial:\n      dataset: { doi: <10.5281/zenodo.NNNNNNN>, files: [\"*.h5ad\"] }");
    expect(load(text.replace(/<[^>]+>/g, "10.5281/zenodo.1")).review.inputs.metadata.dataset.files).toEqual(["*.csv"]);
  });

  it("lists the parameters, commented out, with their defaults", () => {
    const text = reviewSnippet("generate", app);
    expect(text).toContain("  # parameters:\n  #   N_NEIGHBORS: <value>  # default: 10\n  #   SEED: <value>\n");
    expect(load(text).review.parameters).toBeUndefined();
    expect(reviewSnippet("generate", { inputs: app.inputs })).not.toContain("parameters");
  });

  it("falls back to a generator when the app declares no input ports", () => {
    expect(load(reviewSnippet("files", { inputs: [] })).review.generate.command).toContain("$REVIEW_INPUT_DIR");
  });

  it("guesses a file pattern from a port's media type", () => {
    expect(portPattern({ mediaTypes: ["application/x-hdf5; profile=nwb"] })).toBe("*.nwb");
    expect(portPattern({ mediaTypes: ["application/vnd.isac.fcs"] })).toBe("*.fcs");
    expect(portPattern({ mediaTypes: ["image/x-nifti"] })).toBe("*.nii.gz");
    expect(portPattern({})).toBe("*");
  });

  it("says what to do, ending with a release", () => {
    for (const s of REVIEW_SOURCES) {
      const steps = reviewSteps(s.id);
      expect(steps).toHaveLength(3);
      expect(steps[2]).toMatch(/cut a new release/);
    }
  });
});
