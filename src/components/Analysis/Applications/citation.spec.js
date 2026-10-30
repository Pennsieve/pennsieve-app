import { describe, it, expect } from "vitest";
import {
  relationLabel,
  bareDoi,
  doiUrl,
  orcidUrl,
  workLink,
  shortAuthor,
  joinAuthors,
  softwareCitationText,
  workCitationText,
  groupRelatedWorks,
  citationVersion,
} from "./citation";

const preferred = {
  doi: "10.1002/cyto.a.22625",
  relationType: "IsDescribedBy",
  title: "FlowSOM: Using self-organizing maps for visualization and interpretation of cytometry data",
  authors: ["Van Gassen, S.", "Saeys, Y."],
  year: 2015,
  journal: "Cytometry Part A",
  source: "preferred-citation",
};

const citation = {
  title: "processor-flowsom",
  version: "1.2.0",
  doi: "10.5281/zenodo.1234567",
  dateReleased: "2026-10-01",
  authors: [
    { name: "Sofie Van Gassen", givenNames: "Sofie", familyNames: "Van Gassen", orcid: "0000-0002-1825-0097" },
    { name: "Yvan Saeys", givenNames: "Yvan", familyNames: "Saeys" },
    { name: "Pennsieve Team" },
  ],
  preferredCitation: preferred,
  relatedWorks: [
    preferred,
    { doi: "10.1038/nbt.4314", relationType: "References", title: "UMAP", authors: ["Becht, E."], year: 2019, source: "references" },
    { doi: "", relationType: "IsDerivedFrom", title: "FlowSOM R package", url: "https://github.com/SofieVG/FlowSOM", source: "references" },
    { doi: "10.1/x", relationType: "References", title: "Other", source: "references" },
  ],
};

describe("relationLabel", () => {
  it("uses the dataset reference labels", () => {
    expect(relationLabel("IsDescribedBy")).toBe("Described by");
    expect(relationLabel("References")).toBe("References");
    expect(relationLabel("IsDerivedFrom")).toBe("Derived from");
    expect(relationLabel("IsSupplementTo")).toBe("Is Supplement to");
  });
  it("spells out a type it doesn't know", () => {
    expect(relationLabel("IsCitedBy")).toBe("Cited By");
    expect(relationLabel("")).toBe("Related");
  });
});

describe("links", () => {
  it("normalises DOIs and links them to doi.org", () => {
    expect(bareDoi("https://doi.org/10.1038/nbt.4314")).toBe("10.1038/nbt.4314");
    expect(bareDoi("doi: 10.1038/nbt.4314")).toBe("10.1038/nbt.4314");
    expect(doiUrl("10.1038/nbt.4314")).toBe("https://doi.org/10.1038/nbt.4314");
    expect(doiUrl("")).toBe("");
  });
  it("links an ORCID iD", () => {
    expect(orcidUrl("0000-0002-1825-0097")).toBe("https://orcid.org/0000-0002-1825-0097");
    expect(orcidUrl("https://orcid.org/0000-0002-1825-0097")).toBe("https://orcid.org/0000-0002-1825-0097");
    expect(orcidUrl(undefined)).toBe("");
  });
  it("links a work by DOI, else by an http(s) url only", () => {
    expect(workLink(citation.relatedWorks[1])).toBe("https://doi.org/10.1038/nbt.4314");
    expect(workLink(citation.relatedWorks[2])).toBe("https://github.com/SofieVG/FlowSOM");
    expect(workLink({ url: "javascript:alert(1)" })).toBe("");
    expect(workLink({})).toBe("");
  });
});

describe("authors", () => {
  it("shortens people to family name and initials, keeps organisations whole", () => {
    expect(shortAuthor(citation.authors[0])).toBe("Van Gassen, S.");
    expect(shortAuthor({ name: "J-P Doe", givenNames: "Jean-Pierre", familyNames: "Doe" })).toBe("Doe, J. P.");
    expect(shortAuthor({ name: "Pennsieve Team" })).toBe("Pennsieve Team");
  });
  it("joins APA style", () => {
    expect(joinAuthors([])).toBe("");
    expect(joinAuthors(["A"])).toBe("A");
    expect(joinAuthors(["A", "B"])).toBe("A & B");
    expect(joinAuthors(["A", "B", "C"])).toBe("A, B, & C");
  });
});

describe("softwareCitationText", () => {
  it("cites the software with authors, year, title, version and DOI", () => {
    expect(softwareCitationText(citation)).toBe(
      "Van Gassen, S., Saeys, Y., & Pennsieve Team (2026). processor-flowsom (Version 1.2.0). https://doi.org/10.5281/zenodo.1234567"
    );
  });
  it("falls back to the App Store version and leaves out what is missing", () => {
    expect(softwareCitationText({ title: "app", authors: [] }, "v0.3.1")).toBe("app (Version 0.3.1).");
    expect(softwareCitationText(null)).toBe("");
  });
});

describe("workCitationText", () => {
  it("formats a work from CITATION.cff", () => {
    expect(workCitationText(preferred)).toBe(
      "Van Gassen, S. & Saeys, Y. (2015). FlowSOM: Using self-organizing maps for visualization and interpretation of cytometry data. Cytometry Part A. https://doi.org/10.1002/cyto.a.22625"
    );
  });
  it("uses the url for a work without a DOI", () => {
    expect(workCitationText(citation.relatedWorks[2])).toBe("FlowSOM R package. https://github.com/SofieVG/FlowSOM");
  });
});

describe("groupRelatedWorks", () => {
  it("groups by relation type in file order, without the preferred citation", () => {
    const groups = groupRelatedWorks(citation);
    expect(groups.map((g) => g.label)).toEqual(["References", "Derived from"]);
    expect(groups[0].works.map((w) => w.title)).toEqual(["UMAP", "Other"]);
  });
  it("can include the preferred citation", () => {
    expect(groupRelatedWorks(citation, { includePreferred: true })[0].label).toBe("Described by");
  });
  it("is empty without a citation", () => {
    expect(groupRelatedWorks(undefined)).toEqual([]);
  });
});

describe("citationVersion", () => {
  const versions = [
    { uuid: "c", version: "v3" },
    { uuid: "b", version: "v2", citation },
    { uuid: "a", version: "v1", citation },
  ];
  it("picks the newest version with a citation", () => {
    expect(citationVersion(versions).uuid).toBe("b");
  });
  it("honours a selected version that has one", () => {
    expect(citationVersion(versions, "a").uuid).toBe("a");
    expect(citationVersion(versions, "c").uuid).toBe("b");
  });
  it("is null when no version has a citation", () => {
    expect(citationVersion([{ uuid: "x" }])).toBeNull();
  });
});
