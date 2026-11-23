// Renders with the real vega-embed, vega and vega-lite.
import { describe, it, expect } from "vitest";
import embed from "vega-embed";
import { expressionInterpreter } from "vega-interpreter";
import { vegaEmbedOptions } from "./vegaEmbedOptions";

// Code compiled with Function would fail while this is set: expressions must
// go through the interpreter.
async function withoutFunction(fn) {
  const original = globalThis.Function;
  globalThis.Function = function () {
    throw new Error("Function constructor used");
  };
  try {
    return await fn();
  } finally {
    globalThis.Function = original;
  }
}

const render = (spec, mode) =>
  withoutFunction(async () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const r = await embed(el, spec, vegaEmbedOptions(mode, expressionInterpreter));
    const svg = await r.view.toSVG();
    r.finalize();
    return svg;
  });

describe("vega-embed options", () => {
  it("don't send cookies with data URLs and use the interpreter", () => {
    const o = vegaEmbedOptions("vega", expressionInterpreter);
    expect(o.loader).toEqual({ http: { credentials: "omit" } });
    expect(o.ast).toBe(true);
    expect(o.expr).toBe(expressionInterpreter);
    expect(o.actions.editor).toBe(false);
  });

  it("render an Altair chart with a calculated field and filter", async () => {
    const svg = await render(
      {
        $schema: "https://vega.github.io/schema/vega-lite/v5.20.1.json",
        data: { name: "d" },
        datasets: { d: [{ a: "A", b: 28 }, { a: "B", b: 55 }, { a: "C", b: 43 }] },
        transform: [{ calculate: "datum.b * 2", as: "b2" }, { filter: "datum.b2 > 60" }],
        mark: { type: "bar" },
        encoding: { x: { field: "a", type: "nominal" }, y: { field: "b2", type: "quantitative" } },
        title: "doubled",
      },
      "vega-lite"
    );
    expect(svg).toContain("doubled");
    expect(svg).toContain(">B<");
    expect(svg).not.toContain(">A<"); // filtered out by the expression
  });

  it("render a Vega spec with a signal expression", async () => {
    const svg = await render(
      {
        $schema: "https://vega.github.io/schema/vega/v6.json",
        width: 100,
        height: 40,
        signals: [{ name: "n", value: 21 }, { name: "label", update: "'answer ' + (n * 2)" }],
        marks: [{ type: "text", encode: { update: { text: { signal: "label" }, x: { value: 5 }, y: { value: 20 } } } }],
      },
      "vega"
    );
    expect(svg).toContain("answer 42");
  });
});
