// The options VegaOutput passes to vega-embed, apart so tests can render with
// them. Expressions in a spec (signals, filters, calculate) run in Vega's AST
// interpreter instead of being compiled with Function in the app's origin,
// and data a spec loads by URL is fetched without cookies.
export function vegaEmbedOptions(mode, expressionInterpreter) {
  return {
    mode,
    ast: true,
    expr: expressionInterpreter,
    loader: { http: { credentials: "omit" } },
    // Only the PNG/SVG export: no "open in Vega Editor" (it posts the data
    // to another site) or source views.
    actions: { export: true, source: false, compiled: false, editor: false },
    renderer: "svg",
  };
}
