// Pure helpers for the session's Environment panel (EnvironmentPanel.vue).
import { ENVIRONMENT_LANGUAGES, fitsKernel, kernelLanguage, newestReady } from "@/utils/environmentsService";

// A package spec's name: "numpy==2.1.0" -> "numpy".
export const packageName = (spec) => String(spec).split(/[=<>!~\[; ]/)[0];

// "numpy, pandas, scipy +12".
export function packageSummary(packages, shown = 3) {
  const names = (packages || []).map(packageName);
  if (!names.length) return "";
  const rest = names.length - shown;
  return names.slice(0, shown).join(", ") + (rest > 0 ? ` +${rest}` : "");
}

// The choices for a kernel, one per environment of its language: its newest
// ready version (versions: id -> all its versions, when the latest isn't
// ready), and why it can't be picked, if it can't. Ready ones first, then by
// name.
export function environmentChoices(environments, kernelName, versions = {}) {
  const language = kernelLanguage(kernelName);
  const label = ENVIRONMENT_LANGUAGES[language].label;
  return environments
    .filter((e) => (e.language || "python") === language)
    .map((e) => {
      const version = e.latest?.status === "ready" ? e.latest : newestReady(versions[e.id]);
      let disabled = "";
      if (!version) disabled = e.latest?.status === "building" ? "Building…" : "No ready version";
      else if (!fitsKernel(version, kernelName)) disabled = `${label} ${version.runtime?.version}`;
      return {
        id: e.id,
        name: e.name,
        official: !!e.official,
        version: version?.version || 0,
        packages: version?.packages || [],
        disabled,
      };
    })
    .sort((a, b) => !!a.disabled - !!b.disabled || a.name.localeCompare(b.name));
}

// Whether a choice matches the search: its name or any package's name.
export function matchesQuery(choice, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return true;
  return choice.name.toLowerCase().includes(q) || choice.packages.some((p) => packageName(p).toLowerCase().includes(q));
}

function fmtMB(bytes) {
  return `${Math.max(1, Math.round((bytes || 0) / 1e6))} MB`;
}

// A switch in progress, in words, or "" when there's none.
export function switchLabel(sw) {
  if (!sw) return "";
  switch (sw.state) {
    case "resolving":
      return sw.environmentId ? "Preparing the environment…" : "Switching back…";
    case "downloading":
      return sw.sizeBytes ? `Downloading… ${fmtMB(sw.bytes)} of ${fmtMB(sw.sizeBytes)}` : "Downloading…";
    case "restarting":
      return "Restarting the kernel…";
    default:
      return "";
  }
}

export const switchBusy = (sw) => !!sw && sw.state !== "done" && sw.state !== "failed";

// The frameworks an environment brings that a GPU kernel's image already
// has as CUDA builds: torch, tensorflow, jax (and their usual variants), by
// name, in the environment's order. On a GPU session an environment's own
// copy comes first on sys.path and can quietly replace the CUDA build with
// a CPU one.
const GPU_FRAMEWORKS = {
  torch: "torch",
  tensorflow: "tensorflow",
  "tensorflow-cpu": "tensorflow",
  "tensorflow-gpu": "tensorflow",
  "tf-nightly": "tensorflow",
  jax: "jax",
  jaxlib: "jax",
};
export function gpuFrameworks(packages) {
  const found = [];
  for (const spec of packages || []) {
    const name = GPU_FRAMEWORKS[packageName(spec).trim().toLowerCase().replace(/_/g, "-")];
    if (name && !found.includes(name)) found.push(name);
  }
  return found;
}

// The warning for an environment on a GPU session, or "".
export function gpuEnvironmentWarning(packages) {
  const f = gpuFrameworks(packages);
  if (!f.length) return "";
  const names = f.length === 1 ? f[0] : `${f.slice(0, -1).join(", ")} and ${f[f.length - 1]}`;
  return `This environment brings its own ${names}. On a GPU notebook it can replace the image's CUDA build, so your code may run on the CPU. Leave ${f.length === 1 ? "it" : "them"} out of the environment to use the GPU.`;
}

// Asking the kernel which packages it can import: silent code (no cell, no
// history) that prints one line, PACKAGES_MARK then JSON [[name, version]],
// and leaves nothing behind in the user's namespace.
export const PACKAGES_MARK = "__PENNSIEVE_PACKAGES__";
export const PYTHON_PACKAGES_CODE = `def __pennsieve_packages():
    import importlib.metadata as md, json
    seen = {}
    for d in md.distributions():
        name = d.metadata.get("Name")
        if name and name.lower() not in seen:
            seen[name.lower()] = [name, d.version]
    print("${PACKAGES_MARK}" + json.dumps(list(seen.values())))
__pennsieve_packages()
del __pennsieve_packages`;
export const R_PACKAGES_CODE = `local({
  p <- installed.packages()[, c("Package", "Version"), drop = FALSE]
  p <- p[!duplicated(p[, "Package"]), , drop = FALSE]
  cat("${PACKAGES_MARK}[", paste0('["', p[, "Package"], '","', p[, "Version"], '"]', collapse = ","), "]\\n", sep = "")
})`;

// The packages from what the kernel printed: [{ name, version }], by name;
// null when it printed no list.
export function parsePackages(out) {
  const line = String(out || "")
    .split("\n")
    .find((l) => l.startsWith(PACKAGES_MARK));
  if (!line) return null;
  try {
    return JSON.parse(line.slice(PACKAGES_MARK.length))
      .map(([name, version]) => ({ name, version }))
      .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  } catch {
    return null;
  }
}

// Which of them the environment asked for (its specs, by name), to mark.
export function fromEnvironment(packages, specs) {
  const asked = new Set((specs || []).map((s) => packageName(s).toLowerCase().replace(/_/g, "-")));
  return (packages || []).map((p) => ({ ...p, fromEnvironment: asked.has(p.name.toLowerCase().replace(/_/g, "-")) }));
}

// Pinned, one per line: to build the same environment elsewhere.
export const requirementsText = (packages) => (packages || []).map((p) => `${p.name}==${p.version}`).join("\n") + "\n";
