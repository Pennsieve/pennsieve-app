import { beforeEach, describe, expect, it, vi } from "vitest";
import { shallowMount } from "@vue/test-utils";

const route = { name: "workflows", query: {} };
const replace = vi.fn();
const push = vi.fn();
vi.mock("vue-router", () => ({
  useRoute: () => route,
  useRouter: () => ({ replace, push }),
}));

import WorkflowsOverview from "./WorkflowsOverview.vue";

const mountAs = (name, query = {}, props = {}) => {
  route.name = name;
  route.query = query;
  return shallowMount(WorkflowsOverview, { props });
};

describe("WorkflowsOverview: Runs and Workflows sections", () => {
  beforeEach(() => {
    replace.mockClear();
    push.mockClear();
  });

  it("sends an older link to Workflows' Live on to Runs, keeping its other query", () => {
    mountAs("workflows", { view: "live", notebooks: "1" });
    expect(replace).toHaveBeenCalledWith({ name: "runs", query: { notebooks: "1" } });
  });

  it("does the same in My Analysis", () => {
    mountAs("my-workflows", { view: "live" });
    expect(replace).toHaveBeenCalledWith({ name: "my-runs", query: {} });
  });

  it("shows the Library on Workflows, the Builder with ?view=builder, Live on Runs", () => {
    expect(mountAs("workflows").vm.view).toBe("library");
    expect(mountAs("workflows", { view: "builder" }).vm.view).toBe("builder");
    expect(mountAs("runs", {}, { section: "runs" }).vm.view).toBe("live");
    expect(replace).not.toHaveBeenCalled();
  });
});
