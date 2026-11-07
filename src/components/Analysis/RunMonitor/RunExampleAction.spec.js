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
          fetchAppExample: (_, sourceUrl) => handlers.appExample(sourceUrl),
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
    appExample: vi.fn(async () => null),
  };
});
afterEach(() => vi.useRealTimers());

describe("RunExampleAction", () => {
  it("is offered to an editor of the workflow of a succeeded run", async () => {
    const wrapper = await mountIt();
    expect(button(wrapper, "Use as workflow sample output")).toBeTruthy();
  });

  it("isn't shown to someone who can't edit the workflow", async () => {
    handlers.definition.mockResolvedValue({ uuid: "wf-1", permissions: { canEdit: false } });
    const wrapper = await mountIt();
    expect(wrapper.html()).not.toContain("Use as workflow sample output");
    expect(handlers.status).not.toHaveBeenCalled();
  });

  it("isn't shown for a run that didn't succeed", async () => {
    const wrapper = await mountIt({ run: { ...run, status: "FAILED" } });
    expect(wrapper.html()).not.toContain("Use as workflow sample output");
    expect(handlers.definition).not.toHaveBeenCalled();
  });

  it("isn't shown where the feature isn't served", async () => {
    handlers.status.mockResolvedValue(null);
    const wrapper = await mountIt();
    expect(wrapper.html()).not.toContain("Use as workflow sample output");
  });

  it("says what's made, what it replaces and what's left today", async () => {
    const wrapper = await mountIt();
    await button(wrapper, "Use as workflow sample output").trigger("click");
    await flushPromises();
    const dialog = wrapper.find(".dialog-stub");
    expect(dialog.text()).toContain("PDF summary of this run's outputs");
    expect(dialog.text()).toContain("as its sample output");
    expect(dialog.text()).toContain("written by AI");
    expect(dialog.text()).toContain("copied from the outputs the run saved");
    expect(dialog.text()).toContain("Version 4 has no sample output yet");
    // the tightest limit only (this workflow: 2 left of 3)
    expect(dialog.text()).toContain("2 more sample outputs can be generated for this workflow today.");
    expect(dialog.text()).not.toContain("Left today");
    expect(dialog.find(".checkbox-stub").exists()).toBe(false);
  });

  it("names the example it replaces, or that this run already is the example", async () => {
    handlers.versionExample.mockResolvedValue({ runId: "run-other", runName: "Earlier run", version: 4 });
    let wrapper = await mountIt();
    await button(wrapper, "Use as workflow sample output").trigger("click");
    await flushPromises();
    expect(wrapper.find(".dialog-stub").text()).toContain("replaces the current sample output of version 4");
    expect(wrapper.find(".dialog-stub").text()).toContain("from run Earlier run");

  });

  it("shows a run that is the sample output as such, with View PDF and Regenerate", async () => {
    handlers.status.mockResolvedValue({ job: { status: "READY" }, limits });
    handlers.versionExample.mockResolvedValue({ runId: "run-1", runName: "This run", version: 4, pdfUrl: "https://cdn/x.pdf" });
    const wrapper = await mountIt();
    const badge = button(wrapper, "Workflow sample output (version 4)");
    expect(badge).toBeTruthy();
    expect(badge.attributes("disabled")).toBeDefined();
    expect(button(wrapper, "Use as workflow sample output")).toBeFalsy();
    expect(button(wrapper, "View PDF")).toBeTruthy();
    await button(wrapper, "Regenerate").trigger("click");
    await flushPromises();
    expect(wrapper.find(".dialog-stub").text()).toContain("This run is already the sample output of version 4");
    expect(wrapper.find(".checkbox-stub input").element.checked).toBe(true);
  });

  it("offers Regenerate when the run already has a PDF", async () => {
    handlers.status.mockResolvedValue({ job: { status: "READY" }, limits });
    const wrapper = await mountIt();
    await button(wrapper, "Use as workflow sample output").trigger("click");
    await flushPromises();
    expect(wrapper.find(".checkbox-stub").text()).toContain("Regenerate");
    await wrapper.find(".checkbox-stub input").setValue(true);
    await button(wrapper.find(".dialog-stub"), "Use as workflow sample output").trigger("click");
    await flushPromises();
    expect(handlers.set).toHaveBeenCalledWith({ runId: "run-1", refresh: true });
  });

  it("can't be confirmed with a limit used up", async () => {
    handlers.status.mockResolvedValue({ job: null, limits: { ...limits, user: { used: 10, limit: 10 } } });
    const wrapper = await mountIt();
    await button(wrapper, "Use as workflow sample output").trigger("click");
    await flushPromises();
    const dialog = wrapper.find(".dialog-stub");
    expect(dialog.text()).toContain("You've generated all the sample outputs you can today");
    expect(button(dialog, "Use as workflow sample output").attributes("disabled")).toBeDefined();
  });

  it("shows a refusal in the dialog (429 names the limit)", async () => {
    handlers.set.mockRejectedValue(Object.assign(new Error("x"), { status: 429, body: { limit: "workspace" } }));
    const wrapper = await mountIt();
    await button(wrapper, "Use as workflow sample output").trigger("click");
    await flushPromises();
    await button(wrapper.find(".dialog-stub"), "Use as workflow sample output").trigger("click");
    await flushPromises();
    expect(wrapper.find(".dialog-stub").text()).toContain("This workspace has generated all the sample outputs it can today");
  });

  it("shows the job and checks it every 5 s until it's ready", async () => {
    const wrapper = await mountIt();
    await button(wrapper, "Use as workflow sample output").trigger("click");
    await flushPromises();
    await button(wrapper.find(".dialog-stub"), "Use as workflow sample output").trigger("click");
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
    expect(button(wrapper, "View sample output PDF")).toBeTruthy();
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

describe("RunExampleAction on an app run", () => {
  const appRun = {
    uuid: "run-app",
    status: "SUCCEEDED",
    workflowUuid: "",
    app: { sourceUrl: "https://github.com/pennsieve-apps/st-niches", name: "st-niches", tag: "v0.1.0" },
  };

  it("is offered to the app's owner (the status call allows it), worded for the app", async () => {
    const wrapper = await mountIt({ run: appRun });
    expect(handlers.definition).not.toHaveBeenCalled();
    expect(handlers.status).toHaveBeenCalledWith("run-app");
    expect(handlers.appExample).toHaveBeenCalledWith("https://github.com/pennsieve-apps/st-niches");
    const btn = button(wrapper, "Use as app sample output");
    expect(btn).toBeTruthy();
    await btn.trigger("click");
    await flushPromises();
    const text = wrapper.find(".dialog-stub").text().replace(/\s+/g, " ");
    expect(text).toContain("PDF summary of this run's inputs and results");
    expect(text).toContain("kept 3 days");
    expect(text).toContain("The app has no sample output yet");
    expect(text).toContain("for this app today");
  });

  it("isn't shown to anyone else", async () => {
    handlers.status = vi.fn(async () => {
      const err = new Error("only the app's owner can set its sample output");
      err.status = 403;
      throw err;
    });
    const wrapper = await mountIt({ run: appRun });
    expect(button(wrapper, "Use as app sample output")).toBeFalsy();
  });

  it("shows a run that is the app's sample output as such", async () => {
    handlers.appExample = vi.fn(async () => ({ runId: "run-app", app: appRun.app, pdfUrl: "https://cdn/x.pdf" }));
    const wrapper = await mountIt({ run: appRun, placement: "header" });
    expect(wrapper.text()).toContain("App sample output");
    expect(button(wrapper, "Use as app sample output")).toBeFalsy();
  });
});
