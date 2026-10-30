/*
  A step's app variant, for people (docs/app-variants.md in workflow-service,
  section 6): its name on the card, the parameters variants set (DynaSD's
  "Detector": lindda on CPU, oncet on GPU) and what a switch between variants
  changes. Pure; built on appManifestInfo's variantsOf / versionManifest /
  stepVariant. A version without variants (or with one) gives nothing here,
  so its steps look as they always have.
*/
import { stepVariant, variantsOf, versionManifest } from "./appManifestInfo";
import { diffLines, manifestDiff } from "./manifestDiff";

const COMPUTE_TYPES = ["standard", "lambda", "gpu"];

// The variants a step can switch between: its version's, when it has two or
// more; [] otherwise.
export function switchableVariants(app, tag) {
  const list = variantsOf(app, tag);
  return list.length > 1 ? list : [];
}

// The variant a step runs, as variantsOf lists it: its own, else the
// version's default; null when the version has fewer than two variants.
export function effectiveVariant(app, tag, variant) {
  const list = switchableVariants(app, tag);
  if (!list.length) return null;
  return list.find((v) => v.id === variant) || list.find((v) => v.default) || list[0];
}

// The variant's name for a card's title ("GPU (ONCET)"), or "".
export const variantName = (app, tag, variant) => effectiveVariant(app, tag, variant)?.name || "";

// A card's title: "<app> · <variant>" when the version has variants.
export function titleWithVariant(title, app, tag, variant) {
  const name = variantName(app, tag, variant);
  return name && title ? `${title} · ${name}` : title;
}

const paramOf = (manifest, name) => (manifest?.parameters || []).find((p) => p.name === name);
const choiceKey = (p) => JSON.stringify([p?.defaultValue ?? null, p?.validValues ?? null]);

// The parameters the version's variants set differently (their default or
// their choices), in app.yml order: what has to be visible, since the
// variants give different results by default. [] without variants.
export function variantSetParams(app, tag) {
  const list = switchableVariants(app, tag).filter((v) => v.manifest);
  if (list.length < 2) return [];
  const names = [];
  for (const v of list) {
    for (const p of v.manifest.parameters || []) if (p.name && !names.includes(p.name)) names.push(p.name);
  }
  return names.filter((name) => new Set(list.map((v) => choiceKey(paramOf(v.manifest, name)))).size > 1);
}

// The step's values of those parameters: [{ name, label, value, edited }],
// the value being the step's own (defaultParams) or else its variant's
// default.
export function modelLine(app, tag, variant, params = {}) {
  const names = variantSetParams(app, tag);
  if (!names.length) return [];
  const manifest = versionManifest(app, tag, effectiveVariant(app, tag, variant)?.id);
  return names.map((name) => {
    const p = paramOf(manifest, name) || {};
    const own = params?.[name];
    const edited = own !== undefined && own !== null && own !== "";
    const value = edited ? own : p.defaultValue;
    return { name, label: p.label || name, value: value == null ? "" : String(value), edited };
  });
}

// "Detector: oncet", one line, or "".
export const modelLineText = (items) =>
  (items || [])
    .filter((i) => i.value !== "")
    .map((i) => `${i.label}: ${i.value}`)
    .join(" · ");

// What each variant defaults a parameter to, the step's variant first: "The
// GPU (ONCET) variant defaults this to oncet; the CPU variant to lindda."
export function variantParamNote(app, tag, variant, name) {
  const list = switchableVariants(app, tag);
  if (!list.length) return "";
  const current = effectiveVariant(app, tag, variant);
  const ordered = [current, ...list.filter((v) => v.id !== current.id)];
  const value = (v) => {
    const d = paramOf(v.manifest, name)?.defaultValue;
    return d == null || d === "" ? "leaves it unset" : `defaults this to ${d}`;
  };
  const [first, ...rest] = ordered;
  const lead = `The ${first.name} variant ${value(first)}`;
  const others = rest.map((v) => `the ${v.name} variant ${value(v).replace(/^defaults this to /, "to ")}`);
  return `${[lead, ...others].join("; ")}.`;
}

// A resource after a switch: the new variant's when the step kept the old
// one's (or had none), else the step's own, raised to the new variant's.
const resource = (current, before, after) => {
  if (!after) return current || "";
  if (!current || Number(current) === Number(before)) return String(after);
  return String(Math.max(Number(current), Number(after)));
};

/*
  What switching a step to another variant of its version changes:
  - variant: what the step keeps ("" for the default, which isn't written);
  - computeType: kept when the new variant runs there, else its first type;
  - cpu, memory: the new variant's where the step had the old one's, else
    raised to the new variant's (as workflow-service floors them);
  - kept: parameters the step set itself whose value isn't the new
    variant's default ({ name, label, value, variantDefault }), to say so;
  - portLines: how the inputs and outputs differ (they shouldn't: the
    schema keeps them identical), as for a version change.
  Parameters the step didn't set follow the variant by themselves: their
  defaults come from its manifest.
*/
export function switchVariant(data, app, next) {
  const tag = data?.tag;
  const from = versionManifest(app, tag, data?.variant);
  const target = effectiveVariant(app, tag, next);
  const to = versionManifest(app, tag, target?.id);
  const types = (to?.runtime?.computeTypes || []).filter((t) => COMPUTE_TYPES.includes(t));
  let computeType = data?.computeType || "standard";
  if (types.length && !types.includes(computeType)) computeType = types[0];
  const kept = Object.entries(data?.defaultParams || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([name, value]) => {
      const p = paramOf(to, name);
      return p ? { name, label: p.label || name, value: String(value), variantDefault: p.defaultValue == null ? "" : String(p.defaultValue) } : null;
    })
    .filter((k) => k && k.value !== k.variantDefault);
  const d = manifestDiff(from, to);
  const portLines = d
    ? diffLines({ ...d, parameters: { added: [], removed: [], changed: [] }, runtime: [] })
    : [];
  return {
    variant: stepVariant(app, tag, target?.id || ""),
    computeType,
    cpu: resource(data?.cpu, from?.runtime?.cpu, to?.runtime?.cpu),
    memory: resource(data?.memory, from?.runtime?.memory, to?.runtime?.memory),
    kept,
    portLines,
    manifest: to,
  };
}

// What a version change says when the new version lacks the step's
// variant: "v0.2.2 has no GPU variant; using the default", else "".
export function variantFallback(app, fromTag, toTag, variant) {
  if (!variant) return "";
  if (variantsOf(app, toTag).some((v) => v.id === variant)) return "";
  const name = variantsOf(app, fromTag).find((v) => v.id === variant)?.name || variant;
  return `${toTag} has no ${name} variant; using the default`;
}

// Why a variant can't be picked here, or "": a GPU variant where no
// compute node has GPUs.
export const variantUnavailable = (v, { gpus = true } = {}) =>
  v?.gpu && !gpus ? "No compute node here has GPUs" : "";

// Whether any of the compute nodes has GPUs; true while none are known (the
// list isn't loaded), so nothing is disabled on a guess.
export const nodesHaveGpus = (nodes) => !nodes?.length || nodes.some((n) => (n.maxGpuInstances || 0) > 0);
