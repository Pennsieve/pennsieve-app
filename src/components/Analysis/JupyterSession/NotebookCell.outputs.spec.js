import altairDefault from "./__fixtures__/altair-default.html?raw";
import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { nextTick, reactive } from "vue";
import NotebookCell from "./NotebookCell.vue";
import { pushOutput, updateDisplay } from "./outputHelpers";

const embed = vi.fn(async () => ({ finalize: vi.fn() }));
vi.mock("vega-embed", () => ({ default: (...a) => embed(...a) }));

const stubs = { CodeMirrorEditor: true, AssistBar: true, PlotlyOutput: true, MathOutput: true };
const codeCell = (outputs) => reactive({ id: "c1", cell_type: "code", source: "x", outputs, execution_count: 1 });
const mountCell = (cell) => mount(NotebookCell, { props: { cell }, global: { stubs } });

// What Altair 5 sends for alt.Chart(df).mark_bar().encode(x="a", y="b").
const ALTAIR = {
  "application/vnd.vegalite.v5+json": {
    $schema: "https://vega.github.io/schema/vega-lite/v5.20.1.json",
    config: { view: { continuousWidth: 300, continuousHeight: 300 } },
    data: { name: "data-1" },
    datasets: { "data-1": [{ a: "A", b: 28 }, { a: "B", b: 55 }] },
    mark: { type: "bar" },
    encoding: { x: { field: "a", type: "nominal" }, y: { field: "b", type: "quantitative" } },
  },
  "text/plain": ["alt.Chart(...)"],
};

// Bokeh's file_html(plot, INLINE)-style output: markup plus an inline script.
const BOKEH = {
  "text/html":
    '<div id="p1001" data-root-id="p1001"></div>' +
    '<script type="text/javascript">(function(){ window.Bokeh && Bokeh.embed.embed_items([]); })();</script>',
  "text/plain": ["figure(id='p1001')"],
};

describe("notebook outputs", () => {
  it("render an Altair chart with vega-embed", async () => {
    embed.mockClear();
    const w = mountCell(codeCell([{ output_type: "display_data", data: ALTAIR, metadata: {} }]));
    await flushPromises();
    expect(w.find(".nb-unsupported").exists()).toBe(false);
    expect(embed).toHaveBeenCalledTimes(1);
    const [, spec, opts] = embed.mock.calls[0];
    expect(spec.mark).toEqual({ type: "bar" });
    expect(opts.mode).toBe("vega-lite");
    expect(opts.actions.editor).toBe(false);
  });

  it("ignore the chart's own embed options (Altair's usermeta), which would override ours", async () => {
    embed.mockClear();
    const spec = { ...ALTAIR["application/vnd.vegalite.v5+json"], usermeta: { embedOptions: { actions: true, editorUrl: "https://evil.example/" }, note: "kept" } };
    const w = mountCell(codeCell([{ output_type: "display_data", data: { "application/vnd.vegalite.v5+json": spec }, metadata: {} }]));
    await flushPromises();
    const [, given] = embed.mock.calls[0];
    expect(given.usermeta).toEqual({ note: "kept" });
    // The output itself (saved with the notebook) is unchanged.
    expect(spec.usermeta.embedOptions.actions).toBe(true);
    w.unmount();
  });

  it("draw Altair's HTML output (its default) with vega-embed, not in a frame", async () => {
    embed.mockClear();
    const html = altairDefault;
    const w = mountCell(codeCell([{ output_type: "execute_result", data: { "text/html": html, "text/plain": "alt.Chart(...)" }, metadata: {}, execution_count: 1 }]));
    await flushPromises();
    expect(embed).toHaveBeenCalledTimes(1);
    expect(embed.mock.calls[0][2].actions.editor).toBe(false);
    expect(w.find("iframe").exists()).toBe(false);
    w.unmount();
  });

  it("render a Vega spec in vega mode", async () => {
    embed.mockClear();
    mountCell(codeCell([{ output_type: "display_data", data: { "application/vnd.vega.v5+json": { marks: [] } }, metadata: {} }]));
    await flushPromises();
    expect(embed.mock.calls[0][2].mode).toBe("vega");
  });

  it("show a readable message when a chart can't render", async () => {
    embed.mockImplementationOnce(async () => {
      throw new Error("Invalid specification");
    });
    const w = mountCell(codeCell([{ output_type: "display_data", data: ALTAIR, metadata: {} }]));
    await flushPromises();
    expect(w.find(".nb-vega__error").text()).toContain("Invalid specification");
  });

  it("run HTML with scripts in a frame that only allows scripts", () => {
    const w = mountCell(codeCell([{ output_type: "display_data", data: BOKEH, metadata: {} }]));
    const frame = w.find("iframe");
    expect(frame.exists()).toBe(true);
    expect(frame.attributes("sandbox")).toBe("allow-scripts");
    expect(frame.attributes("srcdoc")).toContain("Bokeh.embed.embed_items");
    expect(w.find(".nb-html").exists()).toBe(false);
    expect(w.find(".nb-frame__note").exists()).toBe(false);
  });

  it("note when a framed output loads code from another host", () => {
    const html = '<script src="https://cdn.bokeh.org/bokeh/release/bokeh-3.4.0.min.js"></script><div></div>';
    const w = mountCell(codeCell([{ output_type: "display_data", data: { "text/html": html }, metadata: {} }]));
    expect(w.find(".nb-frame__note").text()).toContain("cdn.bokeh.org");
  });

  it("keep static HTML in the page", () => {
    // Sanitized with DOMPurify as before (not checked here: under happy-dom,
    // DOMPurify doesn't behave as in a browser).
    const html = '<table class="dataframe"><tbody><tr><td onclick="steal()">1</td></tr></tbody></table>';
    const w = mountCell(codeCell([{ output_type: "execute_result", data: { "text/html": html }, metadata: {}, execution_count: 1 }]));
    expect(w.find("iframe").exists()).toBe(false);
    expect(w.find(".nb-html").exists()).toBe(true);
  });

  it("update a display in place", async () => {
    const cell = codeCell([]);
    const w = mountCell(cell);
    pushOutput(cell, { output_type: "display_data", data: { "text/plain": "0%" }, metadata: {}, _displayId: "bar" });
    pushOutput(cell, { output_type: "stream", name: "stdout", text: "working\n" });
    await nextTick();
    updateDisplay([cell], "bar", { data: { "text/plain": "100%" }, metadata: {} });
    updateDisplay([cell], "unknown", { data: { "text/plain": "ignored" }, metadata: {} });
    await nextTick();
    expect(w.findAll(".nb-output").map((o) => o.text())).toEqual(["100%", "working"]);
  });

  it("still explain widgets and PDFs", () => {
    const w = mountCell(
      codeCell([
        { output_type: "display_data", data: { "application/vnd.jupyter.widget-view+json": { model_id: "m" } }, metadata: {} },
        { output_type: "display_data", data: { "application/pdf": "JVBERi0=" }, metadata: {} },
      ])
    );
    const notes = w.findAll(".nb-unsupported").map((n) => n.text());
    expect(notes[0]).toContain("ipywidgets");
    expect(notes[1]).toContain("PDF");
  });
});
