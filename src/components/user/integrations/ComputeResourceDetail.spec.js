import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createStore } from "vuex";

const push = vi.fn();
vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { accountId: "acct-1" } }),
  useRouter: () => ({ push }),
}));

const state = { accounts: [], computeNodes: [], storageNodes: [] };
const disconnectComputeAccount = vi.fn();
vi.mock("@/stores/computeResourcesStore", () => ({
  useComputeResourcesStore: () => ({
    get computeAccounts() { return state.accounts; },
    fetchComputeAccounts: vi.fn().mockResolvedValue(),
    fetchScopedComputeNodes: vi.fn().mockResolvedValue(),
    getScopedComputeNodes: () => state.computeNodes,
    disconnectComputeAccount,
  }),
}));
vi.mock("@/stores/storageResourcesStore", () => ({
  useStorageResourcesStore: () => ({
    fetchScopedStorageNodes: vi.fn().mockResolvedValue(),
    getScopedStorageNodes: () => state.storageNodes,
  }),
}));

import ComputeResourceDetail from "./ComputeResourceDetail.vue";

const stubs = {
  "bf-stage": { template: "<div><slot /></div>" },
  "el-dialog": { template: "<div v-if=\"modelValue\" class=\"dialog\"><slot /><slot name=\"footer\" /></div>", props: ["modelValue"] },
  "bf-button": { template: "<button @click=\"$emit('click')\"><slot /></button>", emits: ["click"] },
  "el-select": true, "el-option": true, "el-input": true, "el-checkbox": true, "el-switch": true, "el-tooltip": true,
};
const directives = { loading: {} };
const store = createStore({ state: { profile: {}, orgMembers: [], organizations: [] } });

const owned = { uuid: "acct-1", accountId: "123456789012", accountType: "AWS", roleName: "Pennsieve-Compute-dev-1a", connection: "cloudformation" };

async function openDialog() {
  const wrapper = mount(ComputeResourceDetail, { global: { plugins: [store], stubs, directives } });
  await flushPromises();
  await wrapper.findAll("button").find((b) => b.text() === "Disconnect").trigger("click");
  return wrapper;
}

describe("ComputeResourceDetail: disconnect", () => {
  beforeEach(() => {
    disconnectComputeAccount.mockReset();
    push.mockReset();
    state.accounts = [owned];
    state.computeNodes = [];
    state.storageNodes = [];
  });

  it("is offered only to the owner (who sees the role)", async () => {
    state.accounts = [{ ...owned, roleName: "" }];
    const wrapper = mount(ComputeResourceDetail, { global: { plugins: [store], stubs, directives } });
    await flushPromises();
    expect(wrapper.text()).not.toContain("Danger Zone");
  });

  it("lists the nodes to delete first, without a Disconnect button", async () => {
    state.computeNodes = [{ uuid: "n1", name: "Node one", account: { accountId: "123456789012", uuid: "acct-1" } }];
    const wrapper = await openDialog();
    const dialog = wrapper.find(".dialog");
    expect(dialog.text()).toContain("Node one");
    expect(dialog.findAll("button").map((b) => b.text())).not.toContain("Disconnect");
  });

  it("disconnects, then links to the stack to delete", async () => {
    disconnectComputeAccount.mockResolvedValue({ uuid: "acct-1", roleName: "Pennsieve-Compute-dev-1a" });
    const wrapper = await openDialog();
    await wrapper.find(".dialog").findAll("button").find((b) => b.text() === "Disconnect").trigger("click");
    await flushPromises();
    expect(disconnectComputeAccount).toHaveBeenCalledWith("acct-1");
    const html = wrapper.find(".dialog").html();
    expect(html).toContain("Delete the stack");
    expect(html).toContain("filteringText=Pennsieve-Compute-dev-1a");
    await wrapper.find(".dialog").findAll("button").find((b) => b.text() === "Done").trigger("click");
    expect(push).toHaveBeenCalledWith({ name: "user-compute-resource" });
  });

  it("disconnects an account Pennsieve can't reach, nodes and all, and says what may be left", async () => {
    state.computeNodes = [{ uuid: "n1", name: "Node one", account: { accountId: "123456789012", uuid: "acct-1" } }];
    disconnectComputeAccount.mockResolvedValue({ uuid: "acct-1", roleName: "Pennsieve-Compute-dev-1a", resourcesMayRemain: true });
    const wrapper = await openDialog();
    await wrapper.find(".dialog").findAll("button").find((b) => b.text().includes("can't reach this account")).trigger("click");
    await flushPromises();
    expect(disconnectComputeAccount).toHaveBeenCalledWith("acct-1");
    const dialog = wrapper.find(".dialog");
    expect(dialog.text()).toContain("may still exist and cost money");
    expect(dialog.html()).toContain("disconnect-without-pennsieve.md");
    expect(dialog.text()).toContain("Delete the stack");
  });

  it("shows why, in the dialog, when Pennsieve can still reach the account", async () => {
    state.computeNodes = [{ uuid: "n1", name: "Node one", account: { accountId: "123456789012", uuid: "acct-1" } }];
    disconnectComputeAccount.mockRejectedValue({ status: 409, body: { error: "account has 1 active compute nodes and 0 active storage nodes" } });
    const wrapper = await openDialog();
    await wrapper.find(".dialog").findAll("button").find((b) => b.text().includes("can't reach this account")).trigger("click");
    await flushPromises();
    expect(wrapper.find(".dialog").text()).toContain("account has 1 active compute nodes");
    expect(push).not.toHaveBeenCalled();
  });
});
