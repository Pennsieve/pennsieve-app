import altairDefault from "./__fixtures__/altair-default.html?raw";
import altairOlli from "./__fixtures__/altair-olli.html?raw";
import altairStandard from "./__fixtures__/altair-standard.html?raw";
import altairUniversal from "./__fixtures__/altair-universal.html?raw";
import { describe, it, expect } from "vitest";
import { altairSpec } from "./altairHtml";

// Wall time of fn() in ms.
const timed = (fn) => {
  const t = performance.now();
  fn();
  return performance.now() - t;
};

describe("altairSpec", () => {
  // Altair 6.3's HTML, by template; the title holds "})({" and ", {" to
  // test the boundaries.
  const fixtures = { default: altairDefault, universal: altairUniversal, standard: altairStandard, olli: altairOlli };
  const fixture = (t) => fixtures[t];

  it.each(["default", "universal", "standard", "olli"])("reads the chart's spec from Altair's %s HTML", (t) => {
    const got = altairSpec(fixture(t));
    expect(got.mode).toBe("vega-lite");
    expect(got.spec.mark.type || got.spec.mark).toBe("bar");
    expect(got.spec.title).toBe("x })({ y, {z}");
    expect(Object.values(got.spec.datasets)[0]).toEqual([{ a: "A", b: 3 }, { a: "B", b: 7 }, { a: "C", b: 2 }]);
  });

  it("gives up quickly on crafted HTML", () => {
    // Altair's markers, then many call and boundary candidates whose halves
    // never both parse.
    const crafted =
      '<script src="https://cdn.jsdelivr.net/npm/vega-embed@6"></script><script>vegaEmbed(' +
      '})({"a": 1, {'.repeat(2000) + '"x": [' + ', {"y": 1}'.repeat(2000) + "});</script>";
    expect(timed(() => expect(altairSpec(crafted)).toBeNull())).toBeLessThan(200);
    const huge = '<script>vegaEmbed("vega-embed@");})({' + ", {".repeat(500000) + "});</script>";
    expect(timed(() => expect(altairSpec(huge)).toBeNull())).toBeLessThan(500);
  });

  it("is null for other HTML, or Altair's HTML cut short", () => {
    expect(altairSpec("<div>hi</div><script>x()</script>")).toBeNull();
    expect(altairSpec(undefined)).toBeNull();
    expect(altairSpec(fixture("universal").replace(/\}\);\s*<\/script>\s*$/, "</script>"))).toBeNull();
  });
});

