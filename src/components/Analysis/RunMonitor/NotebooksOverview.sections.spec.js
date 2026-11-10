import { beforeEach, describe, expect, it, vi } from "vitest";
import { shallowMount } from "@vue/test-utils";

const route = { name: "notebooks", query: {}, params: {} };
const replace = vi.fn();
const push = vi.fn();
vi.mock("vue-router", () => ({
  useRoute: () => route,
  useRouter: () => ({ replace, push }),
}));
// Any getter reads as an empty list; the dispatches resolve.
vi.mock("vuex", async (importOriginal) => ({
  ...(await importOriginal()),
  useStore: () => ({
    dispatch: vi.fn().mockResolvedValue(),
    getters: new Proxy({}, { get: () => [] }),
    state: { activeOrganization: {}, config: {} },
  }),
}));
vi.mock("@/stores/computeResourcesStore", () => ({
  // Any action resolves; any list reads empty.
  useComputeResourcesStore: () =>
    new Proxy({}, { get: (_, key) => (String(key).startsWith("fetch") ? () => Promise.resolve() : () => []) }),
}));
vi.mock("@/realtime/channels", () => ({ runScopeChannel: () => null }));
vi.mock("@/utils/environmentsService", () => ({ environmentsServiceUrl: () => "https://environments.example" }));

import NotebooksOverview from "./NotebooksOverview.vue";

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
