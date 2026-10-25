// Pure helpers for the session's Environment panel (EnvironmentPanel.vue).
import { fitsKernel, newestReady } from "@/utils/environmentsService";

// A package spec's name: "numpy==2.1.0" -> "numpy".
export const packageName = (spec) => String(spec).split(/[=<>!~\[; ]/)[0];

// "numpy, pandas, scipy +12".
export function packageSummary(packages, shown = 3) {
  const names = (packages || []).map(packageName);
  if (!names.length) return "";
  const rest = names.length - shown;
  return names.slice(0, shown).join(", ") + (rest > 0 ? ` +${rest}` : "");
}

// The choices for a kernel, one per environment: its newest ready version
// (versions: id -> all its versions, when the latest isn't ready), and why
// it can't be picked, if it can't. Ready ones first, then by name.
export function environmentChoices(environments, kernelName, versions = {}) {
  return environments
    .filter((e) => e.language === "python")
    .map((e) => {
      const version = e.latest?.status === "ready" ? e.latest : newestReady(versions[e.id]);
      let disabled = "";
      if (!version) disabled = e.latest?.status === "building" ? "Building…" : "No ready version";
      else if (!fitsKernel(version, kernelName)) disabled = `Python ${version.runtime?.version}`;
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
