import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createStore } from "vuex";

vi.mock("@/composables/useGetToken", () => ({ useGetToken: () => Promise.resolve("t") }));
vi.mock("@/mixins/request/request_composable", () => ({
  useSendXhr: () => Promise.reject(new Error("offline")),
}));

import AppReferences from "./AppReferences.vue";

const store = createStore({ state: { config: { apiUrl: "https://api.example" } } });
const mountWith = (versions) =>
  mount(AppReferences, {
    props: { versions },
    global: { plugins: [store], stubs: { "el-select": true, "el-option": true } },
  });

const citation = {
  title: "processor-flowsom",
  version: "1.2.0",
  doi: "10.5281/zenodo.1234567",
  dateReleased: "2026-10-01",
  authors: [{ name: "Sofie Van Gassen", givenNames: "Sofie", familyNames: "Van Gassen", orcid: "0000-0002-1825-0097" }],
  preferredCitation: null,
  relatedWorks: [
    { doi: "10.1038/nbt.4314", relationType: "References", title: "UMAP", source: "references" },
    { doi: "", relationType: "IsDerivedFrom", title: "FlowSOM R", url: "https://github.com/SofieVG/FlowSOM", source: "references" },
  ],
};

describe("AppReferences", () => {
  it("renders nothing without a citation", () => {
    expect(mountWith([{ uuid: "a", version: "v1" }]).html()).toBe("<!--v-if-->");
  });

  it("shows how to cite the software, its authors and related works by type", () => {
    const html = mountWith([{ uuid: "a", version: "v1.2.0", citation }]).text();
    expect(html).toContain("How to cite");
    expect(html).toContain("Van Gassen, S. (2026). processor-flowsom (Version 1.2.0). https://doi.org/10.5281/zenodo.1234567");
    expect(html).toContain("ORCID 0000-0002-1825-0097");
    expect(html).toContain("References");
    expect(html).toContain("Derived from");
    expect(html).toContain("https://github.com/SofieVG/FlowSOM");
  });

  it("links DOIs and ORCIDs", () => {
    const w = mountWith([{ uuid: "a", version: "v1.2.0", citation }]);
    const hrefs = w.findAll("a").map((a) => a.attributes("href"));
    expect(hrefs).toContain("https://orcid.org/0000-0002-1825-0097");
    expect(hrefs).toContain("https://doi.org/10.1038/nbt.4314");
    expect(hrefs).toContain("https://github.com/SofieVG/FlowSOM");
  });
});
