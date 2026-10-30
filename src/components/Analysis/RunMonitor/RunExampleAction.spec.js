import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createStore } from "vuex";
import RunExampleAction from "./RunExampleAction.vue";

// el-dialog and el-checkbox as plain markup, so the dialog's states can be read.
const stubs = {
  "el-dialog": {
    props: ["modelValue", "title"],
    template: '<div v-if="modelValue" class="dialog-stub"><slot /><slot name="footer" /></div>',
  },
  "el-checkbox": {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template:
      '<label class="checkbox-stub"><input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" /><slot /></label>',
  },
};

const limits = { workflow: { used: 1, limit: 3 }, user: { used: 2, limit: 10 }, workspace: { used: 5, limit: 20 } };
const run = { uuid: "run-1", status: "SUCCEEDED", workflowUuid: "wf-1", workflowVersion: 4 };

let handlers;
const makeStore = () =>
  createStore({
    state: { profile: { id: "N:user:me" } },
    modules: {
      analysisModule: {
        namespaced: true,
        actions: {
          fetchWorkflowDefinition: (_, uuid) => handlers.definition(uuid),
          fetchRunExample: (_, runId) => handlers.status(runId),
          setRunExample: (_, args) => handlers.set(args),
          fetchWorkflowVersionExample: (_, args) => handlers.versionExample(args),
        },
      },
    },
  });

const mountIt = async (props = { run }) => {
  const wrapper = mount(RunExampleAction, { props, global: { plugins: [makeStore()], stubs } });
  await flushPromises();
  return wrapper;
};
const button = (wrapper, text) => wrapper.findAll("button").find((b) => b.text().includes(text));

beforeEach(() => {
  vi.useFakeTimers();
  handlers = {
    definition: vi.fn(async () => ({ uuid: "wf-1", createdBy: "N:user:other", permissions: { canEdit: true } })),
    status: vi.fn(async () => ({ job: null, limits })),
    set: vi.fn(async () => ({ job: { status: "QUEUED" }, example: null })),
    versionExample: vi.fn(async () => null),
  };
});
afterEach(() => vi.useRealTimers());

describe("RunExampleAction", () => {
  it("is offered to an editor of the workflow of a succeeded run", async () => {
    const wrapper = await mountIt();
    expect(button(wrapper, "Set as example")).toBeTruthy();
  });

  it("isn't shown to someone who can't edit the workflow", async () => {
    handlers.definition.mockResolvedValue({ uuid: "wf-1", permissions: { canEdit: false } });
    const wrapper = await mountIt();
    expect(wrapper.html()).not.toContain("Set as example");
    expect(handlers.status).not.toHaveBeenCalled();
  });

  it("isn't shown for a run that didn't succeed", async () => {
    const wrapper = await mountIt({ run: { ...run, status: "FAILED" } });
    expect(wrapper.html()).not.toContain("Set as example");
    expect(handlers.definition).not.toHaveBeenCalled();
  });

  it("isn't shown where the feature isn't served", async () => {
    handlers.status.mockResolvedValue(null);
    const wrapper = await mountIt();
    expect(wrapper.html()).not.toContain("Set as example");
  });

  it("says what's made, what it replaces and what's left today", async () => {
    const wrapper = await mountIt();
    await button(wrapper, "Set as example").trigger("click");
    await flushPromises();
    const dialog = wrapper.find(".dialog-stub");
    expect(dialog.text()).toContain("PDF summary of this run");
    expect(dialog.text()).toContain("written by AI");
    expect(dialog.text()).toContain("copied from the run's outputs");
    expect(dialog.text()).toContain("version 4");
    expect(dialog.text()).toContain("this workflow: 2 of 3");
    expect(dialog.text()).toContain("you: 8 of 10");
    expect(dialog.text()).toContain("this workspace: 15 of 20");
    expect(dialog.find(".checkbox-stub").exists()).toBe(false);
  });

  it("offers Regenerate when the run already has a PDF", async () => {
    handlers.status.mockResolvedValue({ job: { status: "READY" }, limits });
    const wrapper = await mountIt();
    await button(wrapper, "Set as example").trigger("click");
    await flushPromises();
    expect(wrapper.find(".checkbox-stub").text()).toContain("Regenerate");
    await wrapper.find(".checkbox-stub input").setValue(true);
    await button(wrapper.find(".dialog-stub"), "Set as example").trigger("click");
    await flushPromises();
    expect(handlers.set).toHaveBeenCalledWith({ runId: "run-1", refresh: true });
  });

  it("can't be confirmed with a limit used up", async () => {
    handlers.status.mockResolvedValue({ job: null, limits: { ...limits, user: { used: 10, limit: 10 } } });
    const wrapper = await mountIt();
    await button(wrapper, "Set as example").trigger("click");
    await flushPromises();
    const dialog = wrapper.find(".dialog-stub");
    expect(dialog.text()).toContain("You've made all the examples you can today");
    expect(button(dialog, "Set as example").attributes("disabled")).toBeDefined();
  });

  it("shows a refusal in the dialog (429 names the limit)", async () => {
    handlers.set.mockRejectedValue(Object.assign(new Error("x"), { status: 429, body: { limit: "workspace" } }));
    const wrapper = await mountIt();
    await button(wrapper, "Set as example").trigger("click");
    await flushPromises();
    await button(wrapper.find(".dialog-stub"), "Set as example").trigger("click");
    await flushPromises();
    expect(wrapper.find(".dialog-stub").text()).toContain("This workspace has made all the examples it can today");
  });

  it("shows the job and checks it every 5 s until it's ready", async () => {
    const wrapper = await mountIt();
    await button(wrapper, "Set as example").trigger("click");
    await flushPromises();
    await button(wrapper.find(".dialog-stub"), "Set as example").trigger("click");
    await flushPromises();
    expect(wrapper.find(".dialog-stub").exists()).toBe(false);
    expect(wrapper.find(".run-example__status").text()).toContain("queued");

    handlers.status.mockResolvedValueOnce({ job: { status: "GENERATING" }, limits });
    handlers.status.mockResolvedValueOnce({ job: { status: "READY" }, limits });
    const before = handlers.status.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    await flushPromises();
    expect(wrapper.find(".run-example__status").text()).toContain("Generating");
    await vi.advanceTimersByTimeAsync(5000);
    await flushPromises();
    expect(wrapper.find(".run-example__status").text()).toContain("ready");
    expect(button(wrapper, "View example PDF")).toBeTruthy();
    await vi.advanceTimersByTimeAsync(15000);
    expect(handlers.status.mock.calls.length).toBe(before + 2);
  });

  it("stops checking when the page is left", async () => {
    handlers.status.mockResolvedValue({ job: { status: "GENERATING" }, limits });
    const wrapper = await mountIt();
    const calls = handlers.status.mock.calls.length;
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(20000);
    expect(handlers.status.mock.calls.length).toBe(calls);
  });
});
