import Vuex from "vuex";
import CreateButton from "./CreateButton.vue";
import { shallowMount } from "@vue/test-utils";
import { state, actions, mutations, getters } from "../../../store";

describe("CreateButton.vue", () => {
  let cmp
  let store

  beforeEach(() => {
    store = new Vuex.Store({
      state,
      actions,
      mutations,
      getters
    });
    cmp = shallowMount(CreateButton, {
      global: {
        plugins:[store]
      }
    })
  });

  it("closeMenus: sets all properties", () => {
    cmp.vm.createMenuOpen = true
    cmp.vm.recordMenuOpen = true

    cmp.vm.closeMenus()

    expect(cmp.vm.createMenuOpen).toBe(false)
    expect(cmp.vm.recordMenuOpen).toBe(false)
  })
})
