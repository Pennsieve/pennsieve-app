import { describe, expect, it, vi } from "vitest";
import BfDatasetList from "./BfDatasetList.vue";

const { computed, methods } = BfDatasetList;
const get = (c) => (typeof c === "function" ? c : c.get);

// The filter panel's state as the component sees it: the search params, the
// statuses and collections, and the filters read from them.
function ctx(params = {}, extra = {}) {
  const c = {
    ANY: "any",
    ROLE_OPTIONS: BfDatasetList.data.call({}).ROLE_OPTIONS,
    datasetSearchParams: { query: "", status: "", withRole: "", collectionId: "", ...params },
    orgDatasetStatuses: [{ name: "IN_REVIEW", displayName: "In review", color: "#f00" }],
    collections: [{ id: 7, name: "Atlas" }],
    datasets: [],
    isLoadingDatasets: false,
    isLoadingDatasetsError: false,
    updateDatasetSearchFilters: vi.fn(),
    ...extra,
  };
  for (const key of ["statusOptions", "collectionOptions", "statusFilter", "roleFilter", "collectionFilter"]) {
    Object.defineProperty(c, key, { get: () => get(computed[key]).call(c) });
  }
  Object.defineProperty(c, "filterChips", { get: () => get(computed.filterChips).call(c) });
  c.setFilters = (changes) => methods.setFilters.call(c, changes);
  return c;
}

describe("BfDatasetList filters", () => {
  it("reads Any for an unset filter and chips the set ones", () => {
    const c = ctx({ status: "IN_REVIEW", withRole: "manager", collectionId: 7 });
    expect(ctx().filterChips).toEqual([]);
    expect(c.filterChips.map((ch) => ch.label)).toEqual(["In review", "Your role: Manager", "Atlas"]);
  });

  it("sets one filter keeping the others, Any as the search's empty value", () => {
    const c = ctx({ status: "IN_REVIEW", withRole: "manager" });
    c.setFilters({ withRole: "any", collectionId: "7" });
    expect(c.updateDatasetSearchFilters).toHaveBeenCalledWith({ status: "IN_REVIEW", withRole: "", collectionId: "7" });
  });

  it("says no results (not an empty workspace) when a filter or search finds nothing", () => {
    const filtered = ctx({ status: "IN_REVIEW" });
    expect(get(computed.isNoResultsFound).call(filtered)).toBe(true);
    expect(get(computed.isEmptyOrg).call(filtered)).toBe(false);

    const searched = ctx({ query: "eeg" });
    expect(get(computed.isNoResultsFound).call(searched)).toBe(true);
    expect(get(computed.isEmptyOrg).call(searched)).toBe(false);

    const empty = ctx();
    expect(get(computed.isEmptyOrg).call(empty)).toBe(true);
    expect(get(computed.isNoResultsFound).call(empty)).toBe(false);
  });
});
