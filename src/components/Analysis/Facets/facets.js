// The galleries' filter panels and cards (Workflows Library, Apps): their
// options and tags as the panel shows them. Pure, so it's easy to test.
import { domainColors, domainOfTag, fieldOfTag } from "../Applications/appDomains";

// A Domain section's options, from domainOptions / domainCounts
// ([{ domain, count }]): each with its colour's dot.
export const domainFacetOptions = (list = []) =>
  list.map(({ domain, count }) => ({
    key: domain.key,
    label: domain.label,
    count,
    color: domainColors(domain).accent,
    title: domain.subject ? `About ${domain.label.toLowerCase()}` : `For ${domain.label.toLowerCase()}`,
  }));

// A Field section's options, from fieldOptions / fieldCounts ([{ field, count }]).
export const fieldFacetOptions = (list = []) => list.map(({ field, count }) => ({ key: field.key, label: field.label, count }));

// A card's tag as the panel lists it: a domain's by its name, after a dot in
// its colour; a field's by its name; any other as written.
// Its key says what it names (two spellings of one domain share one).
export function tagDisplay(tag) {
  const d = domainOfTag(tag);
  if (d) return { key: `domain:${d.key}`, text: d.label, color: domainColors(d).accent, domain: true };
  const f = fieldOfTag(tag);
  if (f) return { key: `field:${f.key}`, text: f.label, color: null, domain: false };
  return { key: `tag:${String(tag).trim().toLowerCase()}`, text: tag, color: null, domain: false };
}

// A card's tags as shown, each once: tags naming the same domain or field
// ("cytometry", "Cytometry", "flow-cytometry"), or the same word in another
// case, show as one, the first.
export function displayTags(tags = []) {
  const seen = new Set();
  const out = [];
  for (const tag of tags) {
    const t = { tag, ...tagDisplay(tag) };
    if (seen.has(t.key)) continue;
    seen.add(t.key);
    out.push(t);
  }
  return out;
}

// A tag as the Tags section groups it: case and punctuation aside, as the
// domains match ("Spike-sorting", "spike sorting" are one).
export const tagKey = (tag) => String(tag ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// The tags that name no domain or field (those have their own sections),
// each once, as first written: [{ key, label }].
export function freeTags(tags = []) {
  const seen = new Set();
  const out = [];
  for (const tag of tags || []) {
    const key = tagKey(tag);
    if (!key || seen.has(key) || domainOfTag(tag) || fieldOfTag(tag)) continue;
    seen.add(key);
    out.push({ key, label: String(tag).trim() });
  }
  return out;
}

// The Tags section's options, from each item's tags: every free tag on at
// least `minCount` items (one on a single item is search's to find), with
// how many, most common first; its label the spelling most of them use.
export function tagFacetOptions(tagLists = [], minCount = 2) {
  const byKey = new Map();
  for (const tags of tagLists) {
    for (const { key, label } of freeTags(tags)) {
      const o = byKey.get(key) || { key, count: 0, spellings: new Map() };
      o.count += 1;
      o.spellings.set(label, (o.spellings.get(label) || 0) + 1);
      byKey.set(key, o);
    }
  }
  return [...byKey.values()]
    .filter((o) => o.count >= minCount)
    .map(({ key, count, spellings }) => ({ key, label: [...spellings].sort((a, b) => b[1] - a[1])[0][0], count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

// A multi-select section's chosen keys, as a list: none for "any", null or
// nothing; a single key (the old one-at-a-time value) as one.
export const selectedKeys = (value) => (value == null || value === "any" ? [] : [].concat(value));

// The chosen keys with one ticked or unticked.
export const toggleKey = (keys = [], key) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]);

// Whether an item with these keys passes a section's choice: any of them
// (OR within a section; sections combine with AND). Nothing chosen: all.
export const matchesAny = (itemKeys = [], chosen) => {
  const want = selectedKeys(chosen);
  return !want.length || itemKeys.some((k) => want.includes(k));
};

// A section's options as shown folded: the first `limit`, and any chosen
// past them (a choice is never hidden); unfolded, all. hidden: how many
// the "Show n more" link adds.
export function foldedOptions(options = [], selected = [], limit = Infinity, open = false) {
  if (open || options.length <= limit) return { shown: options, hidden: 0 };
  const shown = options.filter((o, i) => i < limit || selected.includes(o.key));
  return { shown, hidden: options.length - shown.length };
}
