import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createStore } from "vuex";
import OrgBreadcrumb from "./OrgBreadcrumb.vue";
import { contrastOnWhite, readableOnWhite } from "@/utils/readableOnWhite";

// colorTheme as the API sends it: { secondary: primary }.
const mountWith = (colorTheme, props = {}) =>
  mount(OrgBreadcrumb, {
    props: { pageName: "Datasets", ...props },
    global: {
      plugins: [createStore({ state: { activeOrganization: { organization: { name: "Lab", colorTheme } } } })],
      stubs: { "router-link": { template: "<a><slot /></a>" } },
    },
  });

describe("OrgBreadcrumb", () => {
  it("is one row by default: the trail's parents, the last crumb the heading", () => {
    const w = mountWith(null, { crumbs: [{ name: "Files" }] });
    expect(w.find(".trail-title").exists()).toBe(true);
    expect(w.find("h1.page-title").text()).toBe("Files");
    expect(w.find(".title-trail").text()).toContain("Lab");
    expect(w.find(".title-trail").text()).toContain("Datasets");
  });

  it("colours the title with the workspace's primary, readable on white", () => {
    const primary = "rgba(126, 166, 196, 1)";
    const expected = readableOnWhite(primary);
    expect(contrastOnWhite(expected)).toBeGreaterThanOrEqual(4.5);
    const w = mountWith({ "#ffffff": primary });
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(expected.slice(i, i + 2), 16));
    expect(w.find("h1.page-title").attributes("style")).toMatch(new RegExp(`${expected}|rgb\\(${r}, ${g}, ${b}\\)`, "i"));
  });

  it("keeps the default title colour without a theme, and in My Workspace", () => {
    expect(mountWith(null).find("h1.page-title").element.style.color).toBe("");
    const mine = mountWith({ "#fff": "#c41e3a" }, { workspaceLabel: "My Workspace" });
    expect(mine.find("h1.page-title").element.style.color).toBe("");
  });
});
