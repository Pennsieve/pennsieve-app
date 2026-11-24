import { beforeEach, describe, expect, it, vi } from "vitest";
import { shallowMount } from "@vue/test-utils";

const route = { name: "notebooks", query: {}, params: {} };
const replace = vi.fn();
const push = vi.fn();
vi.mock("vue-router", () => ({
  useRoute: () => route,
  useRouter: () => ({ replace, push }),
}));
vi.mock("@/utils/environmentsService", () => ({ environmentsServiceUrl: () => "https://environments.example" }));

import NotebooksOverview from "./NotebooksOverview.vue";
import { configureNotebooks } from "@/notebooks/host";

// A workspace's notebooks, with nothing in them.
configureNotebooks({
  endpoints: {},
  getToken: async () => "token",
  backend: {
    scope: () => ({ kind: "workspace", organizationId: "N:organization:o1" }),
    listRuns: async () => ({ runs: [], cursor: null }),
    listComputeNodes: async () => [],
    listTargetTypes: async () => [],
    listGpuTiers: async () => [],
    listNotebookDefinitions: async () => [],
    subscribeRunStatus: () => () => {},
  },
  locations: { run: () => ({}), notebook: () => ({}), listedRun: () => ({}) },
});

const mountAs = (name, query = {}, props = {}) => {
  route.name = name;
  route.query = query;
  return shallowMount(NotebooksOverview, { props, global: { directives: { loading: {} } } });
};

describe("NotebooksOverview: Notebooks and Environments sections", () => {
  beforeEach(() => {
    replace.mockClear();
    push.mockClear();
  });

  it("sends an older link to the Environments tab on to Environments", () => {
    mountAs("notebooks", { view: "environments", start: "wf-1" });
    expect(replace).toHaveBeenCalledWith({ name: "environments", query: { start: "wf-1" } });
  });

  it("does the same in My Analysis", () => {
    mountAs("my-notebooks", { view: "environments" });
    expect(replace).toHaveBeenCalledWith({ name: "my-environments", query: {} });
  });

  it("shows the sessions on Notebooks and the environments on Environments", () => {
    expect(mountAs("notebooks").vm.view).toBe("live");
    expect(mountAs("environments", {}, { section: "environments" }).vm.view).toBe("environments");
    expect(replace).not.toHaveBeenCalled();
  });
});
