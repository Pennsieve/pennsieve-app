/*
  An App Store version's citation (app-deploy-service reads the repository's
  CITATION.cff at release, with app.yml's application.relations applied):
  how to cite the app, its authors, and the works it relates to.

  citation: {title, version, doi, dateReleased, authors[], preferredCitation|null,
             relatedWorks[{doi, relationType, title, authors[], year, journal, url, source}]}
*/
import { referenceTypeOptions } from "../../../utils/constants";

// A DataCite relation type as a person reads it ("IsDescribedBy" → "Described by").
export const relationLabel = (type) =>
  referenceTypeOptions.find((o) => o.value === type)?.label ||
  String(type || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^Is /, "")
    .replace(/^./, (c) => c.toUpperCase()) ||
  "Related";

// Accepts a bare DOI or one written as a link or with a "doi:" prefix.
export const bareDoi = (doi) =>
  String(doi || "")
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "");

export const doiUrl = (doi) => (bareDoi(doi) ? `https://doi.org/${bareDoi(doi)}` : "");

export const orcidUrl = (orcid) => {
  const id = String(orcid || "").trim().replace(/^https?:\/\/orcid\.org\//i, "");
  return id ? `https://orcid.org/${id}` : "";
};

// Where a work is found: its DOI, else its url (only http(s) links).
export const workLink = (work) => {
  if (bareDoi(work?.doi)) return doiUrl(work.doi);
  const url = String(work?.url || "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
};

// "Van Gassen, S." for a person, the name as written for an organisation.
export const shortAuthor = (author) => {
  if (!author) return "";
  const family = String(author.familyNames || "").trim();
  if (!family) return String(author.name || "").trim();
  const initials = String(author.givenNames || "")
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((n) => `${n[0].toUpperCase()}.`)
    .join(" ");
  return initials ? `${family}, ${initials}` : family;
};

// "A", "A & B", "A, B, & C" (APA style).
export const joinAuthors = (names) => {
  const list = (names || []).map((n) => String(n || "").trim()).filter(Boolean);
  if (list.length <= 1) return list[0] || "";
  if (list.length === 2) return `${list[0]} & ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, & ${list[list.length - 1]}`;
};

const yearOf = (date) => {
  const m = String(date || "").match(/^(\d{4})/);
  return m ? m[1] : "";
};

const sentence = (s) => {
  const t = String(s || "").trim();
  return !t || /[.?!]$/.test(t) ? t : `${t}.`;
};

// The software itself, cited as its CITATION.cff describes it:
// "Van Gassen, S., & Saeys, Y. (2026). FlowSOM (Version 1.2.0). https://doi.org/…"
export const softwareCitationText = (citation, fallbackVersion = "") => {
  if (!citation) return "";
  const authors = joinAuthors((citation.authors || []).map(shortAuthor));
  const year = yearOf(citation.dateReleased);
  const version = String(citation.version || fallbackVersion || "").replace(/^v(?=\d)/, "");
  const parts = [];
  if (authors) parts.push(year ? `${authors} (${year}).` : sentence(authors));
  else if (year) parts.push(`(${year}).`);
  const title = String(citation.title || "").trim();
  if (title) parts.push(version ? `${title} (Version ${version}).` : sentence(title));
  else if (version) parts.push(`Version ${version}.`);
  if (bareDoi(citation.doi)) parts.push(doiUrl(citation.doi));
  return parts.join(" ");
};

// A related work from what CITATION.cff says about it, for when the DOI
// lookup has nothing (or the work has no DOI).
export const workCitationText = (work) => {
  if (!work) return "";
  const parts = [];
  const authors = joinAuthors(work.authors || []);
  if (authors) parts.push(work.year ? `${authors} (${work.year}).` : sentence(authors));
  else if (work.year) parts.push(`(${work.year}).`);
  if (work.title) parts.push(sentence(work.title));
  if (work.journal) parts.push(sentence(work.journal));
  const link = workLink(work);
  if (link) parts.push(link);
  return parts.join(" ");
};

/*
  The related works by relation type, groups in the order their first work
  appears in CITATION.cff. The preferred citation is left out (it is shown
  as how to cite) unless asked for.
*/
export const groupRelatedWorks = (citation, { includePreferred = false } = {}) => {
  const groups = [];
  const byType = new Map();
  for (const work of citation?.relatedWorks || []) {
    if (!work || (!includePreferred && work.source === "preferred-citation")) continue;
    const type = work.relationType || "References";
    if (!byType.has(type)) {
      const group = { type, label: relationLabel(type), works: [] };
      byType.set(type, group);
      groups.push(group);
    }
    byType.get(type).works.push(work);
  }
  return groups;
};

// Whether a version has anything to show in References.
export const hasCitation = (version) => !!version?.citation;

/*
  Which version's references to show: the selected one when it has a
  citation, else the newest version (versions are newest first) with one.
*/
export const citationVersion = (versions, selectedUuid = "") => {
  const list = (versions || []).filter(hasCitation);
  return list.find((v) => v.uuid === selectedUuid) || list[0] || null;
};
