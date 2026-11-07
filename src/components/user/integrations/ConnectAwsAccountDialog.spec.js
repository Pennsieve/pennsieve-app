import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";

const requestRoleSetup = vi.fn();
vi.mock("@/stores/computeResourcesStore", () => ({
  useComputeResourcesStore: () => ({ requestRoleSetup }),
}));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import ConnectAwsAccountDialog from "./ConnectAwsAccountDialog.vue";

const stubs = {
  "el-dialog": { template: "<div><slot /><slot name=\"footer\" /></div>" },
  "el-input": true,
  "bf-button": { template: "<button @click=\"$emit('click')\"><slot /></button>", emits: ["click"] },
};

const rejoin = { uuid: "acct-1", accountId: "225366564863", roleName: "Pennsieve-Compute-prod-x", connection: "legacy" };

describe("ConnectAwsAccountDialog, upgrading", () => {
  beforeEach(() => {
    requestRoleSetup.mockReset();
    requestRoleSetup.mockResolvedValue({ roleName: "r", externalId: "pn-x", cloudFormation: { quickCreateUrl: "https://x" } });
    vi.stubGlobal("open", vi.fn());
  });

  // As UserComputeResources opens it: the account and the dialog in one go.
  it("asks for the role setup in the account being upgraded", async () => {
    const wrapper = mount(ConnectAwsAccountDialog, { props: { modelValue: false, account: null }, global: { stubs } });
    await wrapper.setProps({ account: rejoin, modelValue: true });
    await nextTick();
    await wrapper.findAll("button").find((b) => b.text().includes("Open AWS console")).trigger("click");
    await flushPromises();
    expect(requestRoleSetup).toHaveBeenCalledWith("225366564863");
  });

  // The account set after the dialog is already open (a second upgrade, or
  // props arriving in another order) still gives the account's ID.
  it("uses the account even when it arrives after the dialog opened", async () => {
    const wrapper = mount(ConnectAwsAccountDialog, { props: { modelValue: true, account: null }, global: { stubs } });
    await wrapper.setProps({ account: rejoin });
    await nextTick();
    await wrapper.findAll("button").find((b) => b.text().includes("Open AWS console")).trigger("click");
    await flushPromises();
    expect(requestRoleSetup).toHaveBeenCalledWith("225366564863");
  });

  // Without the account's ID, no console opens that couldn't fill in the
  // template's AccountId.
  it("doesn't ask for a role setup without the account's ID", async () => {
    const wrapper = mount(ConnectAwsAccountDialog, { props: { modelValue: false, account: null }, global: { stubs } });
    await wrapper.setProps({ account: { ...rejoin, accountId: "" }, modelValue: true });
    await nextTick();
    await wrapper.findAll("button").find((b) => b.text().includes("Open AWS console")).trigger("click");
    await flushPromises();
    expect(requestRoleSetup).not.toHaveBeenCalled();
  });
});
