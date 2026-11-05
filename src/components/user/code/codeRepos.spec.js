import { describe, it, expect } from "vitest";
import {
  agoLabel,
  destinationFacets,
  filterRepos,
  releaseLabel,
  repoActiveFilters,
  repoApp,
  repoDestinations,
  repoFullName,
  repoStatus,
  sortRepos,
} from "./codeRepos";

// As GET /repositories lists them.
const repos = [
  {
    full_name: "lab/zeta",
    url: "https://github.com/lab/zeta",
    publishing_to_appstore: true,
    latest_release: { label: "v1.0.0", release_date: "2026-11-01T00:00:00Z" },
  },
  { full_name: "lab/alpha", description: "Spike sorting", private: true },
  {
    full_name: "lab/beta",
    publishing_to_discover: true,
    latest_release: { label: "v0.2.0", release_date: "2026-11-04T00:00:00Z" },
  },
];
const hasApp = (r) => r.full_name === "lab/zeta";

describe("a repository", () => {
  it("is named owner/name, from its URL when it has no full name", () => {
    expect(repoFullName({ url: "https://github.com/lab/x.git" })).toBe("lab/x");
    expect(repoFullName({ full_name: "lab/y" })).toBe("lab/y");
  });

  it("finds its app by source URL", () => {
    const apps = [{ uuid: "a", sourceUrl: "https://github.com/Lab/Zeta.git/" }];
    expect(repoApp(repos[0], apps)?.uuid).toBe("a");
    expect(repoApp(repos[1], apps)).toBe(null);
  });

  it("goes to its destinations, or to none", () => {
    expect(repoDestinations({ publishing_to_appstore: true, publishing_to_discover: true })).toEqual(["appstore", "discover"]);
    expect(repoDestinations({})).toEqual(["none"]);
  });
});

describe("the filters", () => {
  it("count where releases go", () => {
    expect(destinationFacets(repos).map((o) => [o.key, o.count])).toEqual([["appstore", 1], ["discover", 1], ["none", 1]]);
  });

  it("narrow by search, destination, app and visibility", () => {
    const names = (opts) => filterRepos(repos, opts, hasApp).map((r) => r.full_name);
    expect(names({ query: "spike" })).toEqual(["lab/alpha"]);
    expect(names({ destination: ["none"] })).toEqual(["lab/alpha"]);
    expect(names({ destination: ["appstore", "discover"] })).toEqual(["lab/zeta", "lab/beta"]);
    expect(names({ app: "with" })).toEqual(["lab/zeta"]);
    expect(names({ app: "without", visibility: "public" })).toEqual(["lab/beta"]);
    expect(names({ visibility: "private" })).toEqual(["lab/alpha"]);
  });

  it("show as chips", () => {
    expect(repoActiveFilters({ destination: ["none"], app: "with", visibility: "private" }).map((c) => c.label)).toEqual([
      "Not set up",
      "Has an app",
      "Private",
    ]);
    expect(repoActiveFilters({ destination: [], app: "all", visibility: "all" })).toEqual([]);
  });
});

describe("the sort", () => {
  it("puts apps first, or sorts by name or latest release", () => {
    const names = (s) => sortRepos(repos, s, hasApp).map((r) => r.full_name);
    expect(names("apps")).toEqual(["lab/zeta", "lab/alpha", "lab/beta"]);
    expect(names("name")).toEqual(["lab/alpha", "lab/beta", "lab/zeta"]);
    expect(names("released")).toEqual(["lab/beta", "lab/zeta", "lab/alpha"]);
  });
});

describe("a card", () => {
  it("says where releases go", () => {
    expect(repoStatus({})).toMatchObject({ state: "off", text: "Not set up" });
    expect(repoStatus({ publishing_to_discover: true })).toMatchObject({ state: "ok", text: "Releases go to Discover" });
    expect(repoStatus({ publishing_to_appstore: true, publishing_to_discover: true }, { hasApp: true }).text).toBe(
      "Releases go to App Store and Discover"
    );
  });

  it("waits on a first release for the App Store", () => {
    expect(repoStatus({ publishing_to_appstore: true }).state).toBe("pending");
    expect(repoStatus({ publishing_to_appstore: true, latest_release: { label: "v1" } }).state).toBe("ok");
  });

  it("names its latest release and when", () => {
    const now = Date.parse("2026-11-05T00:00:00Z");
    expect(releaseLabel(repos[2], now)).toBe("v0.2.0 · yesterday");
    expect(releaseLabel(repos[1], now)).toBe("No release yet");
    expect(agoLabel("2026-11-02T00:00:00Z", now)).toBe("3 days ago");
    expect(agoLabel("2026-08-01T00:00:00Z", now)).toBe("3 months ago");
    expect(agoLabel("", now)).toBe("");
  });
});
