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
