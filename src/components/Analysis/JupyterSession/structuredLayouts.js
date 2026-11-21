// A dataset view's structured layouts: folders of a view that hold its
// metadata in a declared structure (packages-service formats registry), not
// plain files. The Session files tree shows each as one row, a bundle, whose
// summary is read from the layout's own description files; "Show files"
// opens it as the plain folder.
//
// A view's crate (.pennsieve/view.json, staged in its input folder) says
// which it holds: views:models for the metadata records
// (pennsieve-records), views:layouts ([{ source, conformsTo, folder,
// files }], views-service #32) for the others, such as the knowledge graph.
// A view whose crate can't be read is matched by path instead
// (metadata/models/, metadata/kgx/).
//
// A new layout (Frictionless, say) is one entry of LAYOUTS: its registry id
// and uri, where it is, its label and icon, its summary and its code.
import { folderSnippets } from "./fileSnippets";

const STRUCTURES = "https://schemas.pennsieve.io/structures";

// Crate paths are relative, without "..": anything else is ignored.
const safePath = (p) => typeof p === "string" && p !== "" && !p.startsWith("/") && !p.split("/").includes("..");
const noSlash = (p) => String(p).replace(/\/+$/, "");
const parentOf = (p) => noSlash(p).replace(/\/[^/]*$/, "");
const strings = (list) => (Array.isArray(list) ? list.filter(safePath) : []);
const count = (n) => (Number.isFinite(n) && n >= 0 ? n : null);

/* ------------------------------------------------------ knowledge graph --- */
// graph.json, the KGX layout's description (metadata-service's export):
// what the graph is of, when it was made, how much of it is Biolink, and
// its counts by category and predicate. Only what the panel shows is kept,
// each value checked for its type: the file is data, never markup.
export function kgxSummary(graph) {
  if (!graph || typeof graph !== "object" || Array.isArray(graph)) return null;
  const str = (v) => (typeof v === "string" ? v : "");
  const counts = graph.counts && typeof graph.counts === "object" ? graph.counts : {};
  const byCount = (m) =>
    Object.entries(m && typeof m === "object" ? m : {})
      .filter(([, n]) => count(n) != null)
      .map(([name, n]) => ({ name, count: n }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const source = graph.source && typeof graph.source === "object" ? graph.source : {};
  return {
    nodes: count(counts.nodes),
    edges: count(counts.edges),
    droppedEdges: count(counts.dropped_edges),
    categories: byCount(counts.nodes_by_category),
    predicates: byCount(counts.edges_by_predicate),
    biolink: ["none", "partial", "full"].includes(graph.biolink) ? graph.biolink : "",
    generatedAt: str(graph.generated_at),
    layoutVersion: str(graph.layout_version),
    source: {
      datasetNodeId: str(source.dataset_node_id),
      datasetId: count(source.dataset_id),
      viewId: str(source.view_id),
      viewVersion: str(source.view_version),
    },
  };
}

// graph.json as text (null when it isn't on the session's disk).
export function parseKgxGraph(text) {
  if (text == null) return null;
  try {
    return kgxSummary(JSON.parse(text));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------ metadata records --- */
// The models and versions a records layout holds, from the crate's
// views:models (or the paths of its files): [{ name, versions: [{ version,
// records }] }], by name and version. Record counts aren't in the crate,
// and counting records.jsonl lines means reading every file, so the
// panel shows each records file's size instead.
export function recordsModels(models) {
  const byName = new Map();
  for (const m of models || []) {
    if (!m || typeof m.name !== "string" || !Number.isInteger(m.version)) continue;
    if (!byName.has(m.name)) byName.set(m.name, []);
    byName.get(m.name).push({ version: m.version, records: safePath(m.records) ? m.records : "" });
  }
  return [...byName.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, versions]) => ({ name, versions: versions.sort((a, b) => a.version - b.version) }));
}

/* ------------------------------------------------------------ registry --- */
export const LAYOUTS = [
  {
    id: "pennsieve-records",
    conformsTo: `${STRUCTURES}/pennsieve-records`,
    spec: `${STRUCTURES}/pennsieve-records/v1.0`,
    specLabel: "Pennsieve metadata records v1.0",
    // The models' folder: metadata/ itself also holds the knowledge graph.
    folder: "metadata/models",
    label: "Metadata records",
    icon: "records",
    title: "The dataset's metadata records: each model's schema and records, and how records link",
    // The code reads metadata/, the models' folder's parent.
    codePath: (path) => parentOf(path),
    snippets: (path, kernelName) => folderSnippets(parentOf(path), "metadata/", kernelName),
  },
  {
    id: "kgx",
    conformsTo: `${STRUCTURES}/kgx`,
    spec: `${STRUCTURES}/kgx/v1.0`,
    specLabel: "KGX tables v1.0",
    folder: "metadata/kgx",
    label: "Knowledge graph (KGX)",
    icon: "graph",
    title: "The dataset's metadata records as a knowledge graph: records are nodes, their links and coded values edges",
    codePath: (path) => noSlash(path),
    snippets: (path, kernelName) => folderSnippets(noSlash(path), "metadata/kgx/", kernelName),
    // Its summary is graph.json, beside the graph's tables.
    summaryFile: "graph.json",
  },
];

export const layoutById = (id) => LAYOUTS.find((l) => l.id === id) || null;
const layoutByUri = (uri) => LAYOUTS.find((l) => l.conformsTo === uri || l.id === uri) || null;

// The crate's root entity, or null.
export function crateRoot(crate) {
  const graph = crate && Array.isArray(crate["@graph"]) ? crate["@graph"] : null;
  return graph?.find((e) => e && e["@id"] === "./") || null;
}

// The structured layouts a view holds: [{ id, folder, files, models }],
// files its crate paths. From its crate when there is one (null when it
// couldn't be read), else from the paths of its entries.
export function layoutsOf(crate, entries = []) {
  const root = crateRoot(crate);
  return root ? declaredLayouts(root) : layoutsByPath(entries);
}

function declaredLayouts(root) {
  const out = [];
  const models = Array.isArray(root["views:models"]) ? root["views:models"] : [];
  if (models.length) {
    const tables = (key) => (Array.isArray(root[key]) ? root[key].map((f) => f?.path) : []);
    out.push({
      id: "pennsieve-records",
      folder: layoutById("pennsieve-records").folder,
      files: strings([...models.flatMap((m) => [m?.schema, m?.records]), ...tables("views:relationships"), ...tables("views:files")]),
      models: recordsModels(models),
    });
  }
  for (const l of Array.isArray(root["views:layouts"]) ? root["views:layouts"] : []) {
    const known = layoutByUri(l?.conformsTo);
    const files = strings(l?.files);
    if (!known || known.id === "pennsieve-records" || !safePath(l.folder) || !files.length) continue;
    const folder = noSlash(l.folder);
    const same = out.find((o) => o.id === known.id && o.folder === folder);
    if (same) same.files = [...new Set([...same.files, ...files])];
    else out.push({ id: known.id, folder, files });
  }
  return out;
}

// A view without a crate (or one the session can't read): its layouts by
// where the export puts them.
const MODEL_FILE = /^metadata\/models\/([a-z0-9_]+)\/versions\/(\d+)\/(schema\.json|records\.jsonl)$/;
function layoutsByPath(entries) {
  const paths = (entries || []).map((e) => e?.cratePath).filter(safePath);
  const out = [];
  const modelFiles = paths.filter((p) => p.startsWith("metadata/models/"));
  if (modelFiles.length) {
    const models = [];
    for (const p of modelFiles) {
      const m = p.match(MODEL_FILE);
      if (m && m[3] === "records.jsonl") models.push({ name: m[1], version: Number(m[2]), records: p });
    }
    const tables = paths.filter((p) => p === "metadata/relationships.csv" || p === "metadata/files.csv");
    out.push({ id: "pennsieve-records", folder: "metadata/models", files: [...modelFiles, ...tables], models: recordsModels(models) });
  }
  for (const known of LAYOUTS) {
    if (known.id === "pennsieve-records") continue;
    const files = paths.filter((p) => p.startsWith(`${known.folder}/`));
    if (files.length) out.push({ id: known.id, folder: known.folder, files });
  }
  return out;
}

// The layout whose folder is rel, a folder's path in its view ("a/b/"),
// with its registry entry: { ...layout, entry }, or null.
export function layoutAt(layouts, rel) {
  const folder = noSlash(rel || "");
  const found = (layouts || []).find((l) => l.folder === folder);
  return found ? { ...found, entry: layoutById(found.id) } : null;
}
