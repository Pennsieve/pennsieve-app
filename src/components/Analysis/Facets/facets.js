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
export function tagDisplay(tag) {
  const d = domainOfTag(tag);
  if (d) return { text: d.label, color: domainColors(d).accent, domain: true };
  const f = fieldOfTag(tag);
  return { text: f ? f.label : tag, color: null, domain: false };
}
