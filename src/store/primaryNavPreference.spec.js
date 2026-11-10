import { beforeEach, describe, expect, it } from "vitest";
import { mutations } from "./index";

describe("primary nav preference", () => {
  beforeEach(() => localStorage.clear());

  it("remembers the user's choice, in this browser, and applies it", () => {
    const state = { primaryNavCondensed: false, primaryNavPreferCondensed: false };
    mutations.SET_PRIMARY_NAV_PREFERENCE(state, true);
    expect(state).toEqual({ primaryNavCondensed: true, primaryNavPreferCondensed: true });
    expect(localStorage.getItem("pennsieve.primaryNav.condensed")).toBe("1");

    mutations.SET_PRIMARY_NAV_PREFERENCE(state, false);
    expect(localStorage.getItem("pennsieve.primaryNav.condensed")).toBe("0");
  });

  it("a page's own collapse (a notebook session, search) leaves the choice alone", () => {
    const state = { primaryNavCondensed: false, primaryNavPreferCondensed: false };
    mutations.CONDENSE_PRIMARY_NAV(state, true);
    expect(state.primaryNavPreferCondensed).toBe(false);
  });
});
