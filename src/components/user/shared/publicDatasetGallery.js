// The public datasets page as the Workflows Library and Apps galleries:
// its sorts, filter sections, chips and card text. Pure, so it's easy to
// test. Datasets are utils/publicDatasets' (toPublicDataset).
import { formatBytes } from "@/components/Analysis/RunMonitor/dataTargets";
import { matchesAny } from "@/components/Analysis/Facets/facets";

// Discover sorts (search/datasets orderBy); Best match only with a search.
// Discover's search fails sorting by name (a 500), so names are sorted
// here, on a list in its date order.
export const PUBLIC_SORTS = [
  { value: "relevance", label: "Best match", orderBy: "relevance", orderDirection: "desc" },
  { value: "newest", label: "Newest", orderBy: "date", orderDirection: "desc" },
  { value: "name", label: "Name A–Z", orderBy: "date", orderDirection: "desc", byName: true },
  { value: "size", label: "Largest", orderBy: "size", orderDirection: "desc" },
];
export const sortOrder = (value) => PUBLIC_SORTS.find((s) => s.value === value) || PUBLIC_SORTS[1];
export const sortChoices = (query) => PUBLIC_SORTS.filter((s) => s.value !== "relevance" || !!query?.trim());
// The list in the sort's order (Discover's, else by name).
export const sortDatasets = (datasets = [], value) =>
  sortOrder(value).byName
    ? [...datasets].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base", numeric: true }))
    : datasets;

// The filter sections: each dataset's keys in it (a tag's in lower case:
// "EEG" and "eeg" are one).
const tagKey = (t) => String(t).trim().toLowerCase();
const KEYS = {
  organization: (d) => (d.organizationName ? [d.organizationName] : []),
  tag: (d) => [...new Set((d.tags || []).map(tagKey).filter(Boolean))],
  license: (d) => (d.license ? [d.license] : []),
};
export const FILTER_SECTIONS = [
  // Discover's organization: the workspace that published it.
  { key: "organization", title: "Workspace", noun: "Workspace" },
  { key: "tag", title: "Tags", noun: "Tag" },
  { key: "license", title: "License", noun: "License" },
];
export const emptyFilters = () => ({ organization: [], tag: [], license: [] });

// A section's options among the datasets ([{ key, label, count }]), the
// most common first; at most `limit` (the tags: there are many), keeping
// the chosen ones.
export function facetOptions(datasets = [], section, { limit = Infinity, selected = [] } = {}) {
  const counts = new Map();
  const labels = new Map();
  for (const d of datasets) {
    for (const k of KEYS[section](d)) {
      counts.set(k, (counts.get(k) || 0) + 1);
      if (!labels.has(k)) labels.set(k, section === "tag" ? (d.tags || []).find((t) => tagKey(t) === k) : k);
    }
  }
  const all = [...counts]
    .map(([key, count]) => ({ key, label: labels.get(key), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const shown = all.slice(0, limit);
  for (const k of selected) {
    if (!shown.some((o) => o.key === k)) shown.push(all.find((o) => o.key === k) || { key: k, label: k, count: 0 });
  }
  return shown;
}

// The datasets that pass every section (any of a section's choices).
export const filterDatasets = (datasets = [], filters = emptyFilters()) =>
  datasets.filter((d) => FILTER_SECTIONS.every(({ key }) => matchesAny(KEYS[key](d), filters[key])));

// The filters set, as FacetLayout's removable chips.
export const filterChips = (filters = emptyFilters(), datasets = []) =>
  FILTER_SECTIONS.flatMap(({ key, noun }) =>
    (filters[key] || []).map((value) => ({
      key,
      value,
      label: `${noun}: ${key === "tag" ? facetOptions(datasets, "tag", { selected: [value], limit: 0 })[0].label : value}`,
    }))
  );

// A card's foot: its files, size and when this version was published.
export function cardFacts(d, now = new Date()) {
  const files = d.fileCount || 0;
  const when = d.publishedAt ? new Date(d.publishedAt) : null;
  const date =
    when && !isNaN(when)
      ? when.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          ...(when.getFullYear() !== now.getFullYear() && { year: "numeric" }),
        })
      : "";
  return [`${files.toLocaleString("en-US")} file${files === 1 ? "" : "s"}`, formatBytes(d.size), date].filter(Boolean).join(" · ");
}

// The card's second line: who published it and who made it.
export const cardByline = (d) => [d.organizationName, d.authors].filter(Boolean).join(" · ");
