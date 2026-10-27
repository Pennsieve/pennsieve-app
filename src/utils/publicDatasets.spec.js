import { describe, it, expect, vi } from "vitest";
import { searchPublicDatasets, browsePublicFiles, authorsLine } from "./publicDatasets";

const config = { discoverUrl: "https://api.pennsieve.net/discover" };

describe("public datasets", () => {
  it("searches, leaving out embargoed datasets", async () => {
    const sendXhr = vi.fn().mockResolvedValue({
      datasets: [
        { id: 1, name: "Open", version: 2, contributors: [{ firstName: "A", lastName: "B" }] },
        { id: 2, name: "Closed", version: 1, embargo: true },
      ],
    });
    const found = await searchPublicDatasets("eeg & sleep", { sendXhr, config });
    expect(sendXhr.mock.calls[0][0]).toBe("https://api.pennsieve.net/discover/search/datasets?limit=25&offset=0&query=eeg%20%26%20sleep");
    expect(found.map((d) => d.name)).toEqual(["Open"]);
    expect(found[0].authors).toBe("A B");
  });

  it("browses a folder with its path in the query, and the ids in the path encoded", async () => {
    const sendXhr = vi.fn().mockResolvedValue({ files: [{ name: "a.csv" }], totalCount: 1 });
    const page = await browsePublicFiles({ id: "1/../x", version: 2, path: "files/a b&c", limit: 10, offset: 20 }, { sendXhr, config });
    expect(sendXhr.mock.calls[0][0]).toBe(
      "https://api.pennsieve.net/discover/datasets/1%2F..%2Fx/versions/2/files/browse?limit=10&offset=20&path=files%2Fa+b%26c"
    );
    expect(page).toEqual({ files: [{ name: "a.csv" }], totalCount: 1 });
  });

  it("names two authors, then et al.", () => {
    const c = (n) => ({ firstName: n, lastName: "X" });
    expect(authorsLine([c("A"), c("B"), c("C")])).toBe("A X, B X, et al.");
    expect(authorsLine([])).toBe("");
  });
});
