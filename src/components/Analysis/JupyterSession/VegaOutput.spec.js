import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

// vega-embed whose embeds finish when the test says.
const pending = [];
vi.mock("vega-embed", () => ({
  default: vi.fn(
    (el) =>
      new Promise((resolve) => {
        const r = { el, finalize: vi.fn() };
        pending.push(() => {
          el.textContent = "chart";
          resolve(r);
          return r;
        });
      })
  ),
}));

const { default: VegaOutput } = await import("./VegaOutput.vue");
const embeds = (n) => vi.waitFor(() => expect(pending).toHaveLength(n));
const spec = (n) => ({ mark: "bar", data: { values: [{ n }] } });

afterEach(() => pending.splice(0));

describe("VegaOutput", () => {
  it("finalizes an embed that finishes after a newer render", async () => {
    const w = mount(VegaOutput, { props: { spec: spec(1) }, attachTo: document.body });
    await embeds(1);
    await w.setProps({ spec: spec(2) });
    await embeds(2);
    const newer = pending[1]();
    const older = pending[0]();
    await flushPromises();
    expect(older.finalize).toHaveBeenCalled();
    expect(newer.finalize).not.toHaveBeenCalled();
    // Only the newer chart is in the page.
    expect(w.findAll(".nb-vega__chart > div")).toHaveLength(1);
    expect(w.find(".nb-vega__chart > div").element).toBe(newer.el);
    w.unmount();
    expect(newer.finalize).toHaveBeenCalled();
  });

  it("finalizes an embed that finishes after unmount", async () => {
    const w = mount(VegaOutput, { props: { spec: spec(1) } });
    await embeds(1);
    w.unmount();
    const r = pending[0]();
    await flushPromises();
    expect(r.finalize).toHaveBeenCalled();
  });
});
