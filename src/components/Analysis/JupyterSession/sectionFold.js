// Whether a section of the notebook's sidebar (Environment, Inputs, Session
// files) is folded, remembered in this browser as the workflow builder
// remembers its panels. Storage can be unavailable (a private window,
// blocked site data): then each section starts open and isn't kept.
import { ref, watch } from "vue";

const key = (name) => `pennsieve.notebook.section.${name}.folded`;

export function readFold(name, storage = globalThis.localStorage) {
  try {
    return storage?.getItem(key(name)) === "true";
  } catch {
    return false;
  }
}

export function writeFold(name, folded, storage = globalThis.localStorage) {
  try {
    storage?.setItem(key(name), folded ? "true" : "false");
  } catch {
    // not kept
  }
}

// A ref for the section's fold, kept as it changes.
export function useRememberedFold(name, storage = globalThis.localStorage) {
  const folded = ref(readFold(name, storage));
  watch(folded, (v) => writeFold(name, v, storage));
  return folded;
}
