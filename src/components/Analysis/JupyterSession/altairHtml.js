// Altair's HTML output (its default renderer, in any front end): a script
// that loads vega from a CDN and embeds the chart, its spec written as JSON in
// the script. The spec, so the notebook draws the chart itself (no CDN, its
// own export menu), as { spec, mode }, or null for any other HTML. Altair's
// templates end with })({spec}, {embed options}); ("universal", "olli") or
// set var spec = {...}; var embedOpt = {...}; ("standard").
const parseObject = (text) => {
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
};
// How many "})({" calls and ", {" boundaries in each are tried, and the
// longest the embed options can be (Altair's are well under 1 KB).
const MAX_CANDIDATES = 3;
const MAX_OPTIONS_LENGTH = 64 * 1024;
const vegaMode = (opts) => (opts?.mode === "vega" ? "vega" : "vega-lite");
export function altairSpec(html) {
  if (typeof html !== "string" || !html.includes("vegaEmbed") || !html.includes("vega-embed@")) return null;
  const end = html.lastIndexOf("</script>");
  if (end < 0) return null;
  const script = html.slice(0, end).trimEnd();
  // standard: var spec = {...}; var embedOpt = {...};
  const specAt = script.indexOf("var spec = ");
  const optAt = script.indexOf("var embedOpt = ");
  if (specAt >= 0 && optAt > specAt) {
    const spec = parseObject(script.slice(specAt + 11, optAt).trim().replace(/;$/, ""));
    const optEnd = script.indexOf(";\n", optAt);
    const opts = optEnd > 0 ? parseObject(script.slice(optAt + 15, optEnd)) : null;
    return spec ? { spec, mode: vegaMode(opts) } : null;
  }
  // universal, olli: })({spec}, {embed options});
  if (!script.endsWith(");") || !script.endsWith("});")) return null;
  // The call, and in it the boundary between the two: the options are last
  // and small. Either text can also occur in the spec's strings, so a few
  // candidates are tried, from the end, until both halves are objects. Capped,
  // so crafted HTML can't make it parse the text over and over.
  let call = script.lastIndexOf("})({");
  for (let calls = 0; call >= 0 && calls < MAX_CANDIDATES; calls++) {
    const args = script.slice(call + 3, -2);
    let cut = args.lastIndexOf(", {");
    for (let cuts = 0; cut > 0 && cuts < MAX_CANDIDATES; cuts++) {
      // The options are a short object: a long tail isn't them.
      const tail = args.length - cut;
      const opts = tail <= MAX_OPTIONS_LENGTH ? parseObject(args.slice(cut + 2)) : null;
      if (opts) {
        const spec = parseObject(args.slice(0, cut));
        if (spec) return { spec, mode: vegaMode(opts) };
        break;
      }
      if (tail > MAX_OPTIONS_LENGTH) break;
      cut = args.lastIndexOf(", {", cut - 1);
    }
    call = script.lastIndexOf("})({", call - 1);
  }
  return null;
}
