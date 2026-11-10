import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import ContentIntro from "./ContentIntro.vue";

describe("ContentIntro", () => {
  it("shows the text, inline content and the actions slot", () => {
    const w = mount(ContentIntro, {
      props: { text: "What's listed." },
      slots: { default: "<a href='#'>Docs</a>", actions: "<button>+ New</button>" },
    });
    expect(w.find(".intro-text").text()).toContain("What's listed.");
    expect(w.find(".intro-text a").exists()).toBe(true);
    expect(w.find(".content-actions button").text()).toBe("+ New");
  });

  it("gives the actions row an id only when asked (Analysis's teleport target)", () => {
    expect(mount(ContentIntro).find(".content-actions").attributes("id")).toBeUndefined();
    const w = mount(ContentIntro, { props: { actionsId: "analysis-content-actions" } });
    expect(w.find("#analysis-content-actions").exists()).toBe(true);
  });
});
