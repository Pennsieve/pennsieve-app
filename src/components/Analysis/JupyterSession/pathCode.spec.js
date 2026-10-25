import { describe, it, expect } from "vitest";
import { sessionPathCode } from "./pathCode";

describe("sessionPathCode", () => {
  it("writes input and output paths through their variables in Python", () => {
    expect(sessionPathCode("input/ro-crate-metadata.json", "Python 3.12.3")).toBe('INPUT_DIR / "ro-crate-metadata.json"');
    expect(sessionPathCode("output/figs/a.png", "Python 3.12.3")).toBe('OUTPUT_DIR / "figs/a.png"');
    expect(sessionPathCode("input", "Python 3.12.3")).toBe("INPUT_DIR");
    expect(sessionPathCode("input/a.csv")).toBe('INPUT_DIR / "a.csv"');
  });

  it("uses the environment variables in R", () => {
    expect(sessionPathCode("input/a.csv", "R 4.4.1")).toBe('file.path(Sys.getenv("INPUT_DIR"), "a.csv")');
    expect(sessionPathCode("output", "R 4.4.1")).toBe('Sys.getenv("OUTPUT_DIR")');
  });

  it("quotes other paths as they are", () => {
    expect(sessionPathCode("notes.txt", "Python 3.12.3")).toBe('"notes.txt"');
    expect(sessionPathCode("inputs/a.csv", "Python 3.12.3")).toBe('"inputs/a.csv"');
    expect(sessionPathCode('input/say "hi".txt', "Python 3.12.3")).toBe('INPUT_DIR / "say \\"hi\\".txt"');
  });
});
