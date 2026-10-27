// A session file's path as code for the kernel. The file browser lists the
// notebook workspace, where input/ and output/ are links to the run's
// INPUT_DIR and OUTPUT_DIR; the kernel runs elsewhere (beside the notebook),
// so a workspace-relative "input/a.csv" doesn't resolve. Paths under them are
// written through the variables instead: in Python the session's startup
// defines INPUT_DIR and OUTPUT_DIR as Paths; in R they're environment
// variables.
const ROOTS = { input: "INPUT_DIR", output: "OUTPUT_DIR" };

const quote = (s) => JSON.stringify(s);

export function sessionPathCode(path, kernelName = "") {
  const p = String(path).replace(/^\/+/, "");
  const [top, ...rest] = p.split("/");
  const variable = ROOTS[top];
  const r = kernelName.toLowerCase().startsWith("r ") || kernelName.toLowerCase() === "r";
  if (!variable) return quote(p);
  const sub = rest.join("/");
  if (r) return sub ? `file.path(Sys.getenv("${variable}"), ${quote(sub)})` : `Sys.getenv("${variable}")`;
  return sub ? `${variable} / ${quote(sub)}` : variable;
}
