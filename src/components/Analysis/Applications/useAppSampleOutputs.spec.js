import { describe, it, expect, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { createStore } from "vuex";
import { useAppSampleOutputs } from "./useAppSampleOutputs";

const URL = "https://github.com/pennsieve-apps/st-niches";
const wf = (uuid, name, url) => ({
  uuid,
  name,
  dag: [{ id: "in", type: "data-source" }, { id: "s", type: "processor", sourceUrl: url, dependsOn: ["in"] }],
});

const run = async ({ workspace, publicList, examples, maxWorkflows, own = null, versions = {} }) => {
  const list = vi.fn(async (_, { visibility, cursor }) => {
    const pages = visibility === "public" ? publicList : workspace;
    const i = cursor ? Number(cursor) : 0;
    return { workflows: pages[i] || [], nextCursor: i + 1 < pages.length ? String(i + 1) : "" };
  });
  const fetchExample = vi.fn(async (_, uuid) => {
    if (examples[uuid] instanceof Error) throw examples[uuid];
    return examples[uuid] ?? null;
  });
  const store = createStore({
    modules: {
      analysisModule: {
        namespaced: true,
        actions: {
          listWorkflowDefinitions: list,
          fetchWorkflowExample: fetchExample,
          fetchAppExample: async () => own,
          fetchWorkflowVersion: async (_, { uuid, version }) => versions[`${uuid}@${version}`] || null,
        },
      },
    },
  });
  let result;
  const C = defineComponent({
    setup() {
      result = useAppSampleOutputs(ref(URL), { maxWorkflows });
      return () => h("div");
    },
  });
  mount(C, { global: { plugins: [store] } });
  await flushPromises();
  return { result, list, fetchExample };
};

describe("useAppSampleOutputs", () => {
  it("finds the workspace's and public workflows the app is in that have a sample", async () => {
    const { result, list, fetchExample } = await run({
      workspace: [[wf("a", "A", URL), wf("x", "X", "https://github.com/pennsieve-apps/other")], [wf("b", "B", URL)]],
      publicList: [[wf("a", "A", URL), wf("c", "C", URL)]],
      examples: { a: { version: 2 }, b: null, c: new Error("boom") },
    });
    expect(list).toHaveBeenCalledTimes(3); // two workspace pages, one public
    expect(fetchExample.mock.calls.map((c) => c[1]).sort()).toEqual(["a", "b", "c"]);
    expect(result.entries.value.map((e) => e.workflow.uuid)).toEqual(["a"]);
    expect(result.entries.value[0].example.version).toBe(2);
    expect(result.loading.value).toBe(false);
  });

  it("asks only so many workflows and counts the rest", async () => {
    const { result, fetchExample } = await run({
      workspace: [[wf("a", "A", URL), wf("b", "B", URL), wf("c", "C", URL)]],
      publicList: [],
      examples: {},
      maxWorkflows: 2,
    });
    expect(fetchExample).toHaveBeenCalledTimes(2);
    expect(result.more.value).toBe(1);
  });

  it("keeps an older version's report, noting that its apps were updated since", async () => {
    const current = { ...wf("n", "N", URL), dag: [{ id: "s", type: "processor", sourceUrl: URL, tag: "v0.2.0", dependsOn: [] }] };
    const { result } = await run({
      workspace: [[current]],
      publicList: [],
      examples: { n: { version: 1, fromVersion: 1 } },
      versions: { "n@1": { dag: [{ id: "s", type: "processor", sourceUrl: URL, tag: "v0.1.0", dependsOn: [] }] } },
    });
    expect(result.entries.value).toHaveLength(1);
    expect(result.entries.value[0].note).toBe("Apps updated since this report");
    expect(result.entries.value[0].noteDetail).toBe("st-niches v0.1.0 → v0.2.0");
  });
});
