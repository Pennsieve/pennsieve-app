import { describe, expect, it } from "vitest";
import { galleryRedirect } from "./galleryRedirect";

describe("galleryRedirect", () => {
  const org = { orgId: "N:organization:1" };

  it("sends the Gallery (its Workflows view) to the Workflows tab's Library", () => {
    expect(galleryRedirect()({ params: org, query: {} })).toEqual({
      name: "workflows", params: org, query: { view: "library" },
    });
    expect(galleryRedirect()({ params: org, query: { view: "workflows", q: "spikes" } })).toEqual({
      name: "workflows", params: org, query: { q: "spikes", view: "library" },
    });
  });

  it("sends its Apps view to the Apps tab", () => {
    expect(galleryRedirect()({ params: org, query: { view: "apps", q: "nwb" } })).toEqual({
      name: "apps", params: org, query: { q: "nwb" },
    });
  });

  it("keeps My Workspace's route names", () => {
    expect(galleryRedirect("my-")({ params: {}, query: {} }).name).toBe("my-workflows");
    expect(galleryRedirect("my-")({ params: {}, query: { view: "apps" } }).name).toBe("my-apps");
  });
});
