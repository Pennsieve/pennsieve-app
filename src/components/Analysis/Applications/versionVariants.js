/*
  A version's variants on the app's page (app variants, docs/app-variants.md
  in workflow-service, section 6): each one's build status in the versions
  list, what each is and runs with (the Variants section), and how a new
  release's builds are getting on. Pure. A version without variants (or with
  one) has none of this; its own status is its build's.
*/
import { variantsOf } from "../WorkflowBuilder/appManifestInfo";
import { variantSetParams } from "../WorkflowBuilder/appVariants";
import { computeLabel } from "./appCards";

// The variants a version's row lists, with their build status; [] for one
// without variants.
export function versionVariants(app, tag) {
  const list = variantsOf(app, tag);
  return list.length > 1 ? list : [];
}

const resources = (rt) => {
  const parts = [];
  const types = (rt?.computeTypes || []).map(computeLabel).filter(Boolean);
  if (types.length) parts.push(types.join(", "));
  const cpu = Number(rt?.cpu);
  if (cpu > 0) parts.push(`${+(cpu / 1024).toFixed(2)} vCPU`);
  const mem = Number(rt?.memory);
  if (mem > 0) parts.push(mem >= 1024 ? `${+(mem / 1024).toFixed(1)} GB` : `${mem} MB`);
  return parts.join(" · ");
};
const duration = (sec) => {
  const s = Number(sec);
  if (!(s > 0)) return "";
  if (s % 3600 === 0) return `${s / 3600} h`;
  if (s % 60 === 0) return `${s / 60} min`;
  return `${s} s`;
};

// The Variants section: each variant of a version, what it is and what it
// runs with, and the parameters the variants set differently (their
// defaults): [{ id, name, description, default, gpu, status,
// failureReason, runsOn, timeout, params: [{ name, label, value }] }].
export function variantDetails(app, tag) {
  const list = versionVariants(app, tag);
  const names = variantSetParams(app, tag);
  return list.map((v) => {
    const rt = v.manifest?.runtime || {};
    return {
      id: v.id,
      name: v.name,
      description: v.description,
      default: v.default,
      gpu: v.gpu,
      status: v.status,
      failureReason: v.failureReason,
      runsOn: resources(rt),
      timeout: duration(rt.timeoutSeconds),
      params: names.map((name) => {
        const p = (v.manifest?.parameters || []).find((x) => x.name === name) || {};
        return { name, label: p.label || name, value: p.defaultValue == null ? "unset" : String(p.defaultValue) };
      }),
    };
  });
}

const BUILDING = ["", "registering", "building", "deploying", "pending"];
const settled = (status) => !BUILDING.includes(String(status || "").toLowerCase());

/*
  A release's progress, once the app store has the version: each build, with
  its status ({ id, name, status, failureReason }: one per variant, else the
  version's one), whether the version has variants, and whether all have
  finished (deployed, error or disabled). Null until the version is listed.
*/
export function releaseProgress(app, tag) {
  const bare = (s) => String(s || "").replace(/^v/, "");
  const version = (app?.versions || []).find((v) => bare(v.version) === bare(tag));
  if (!version) return null;
  const variants = versionVariants(app, version.version);
  const rows = variants.length
    ? variants.map((v) => ({ id: v.id, name: v.name, status: v.status, failureReason: v.failureReason, default: v.default }))
    : [{ id: "", name: version.version, status: version.status || "", failureReason: "", default: true }];
  return { tag: version.version, variants: variants.length > 0, rows, done: rows.every((r) => settled(r.status)) };
}

// Before publishing: a tag with "--" can't be released for an app with
// variants (its images are tagged <tag>--<variant>). Judged from the newest
// version's app.yml, since the target's isn't read here; "" when fine.
export function variantTagWarning(tag, hasVariants) {
  if (!hasVariants || !String(tag || "").includes("--")) return "";
  return "This app has variants, so its versions can't contain \"--\": the app store would refuse the release.";
}

// The variant a view keeps for a version: the one it had, when the version
// has it, else the version's default; "" for a version without variants.
export function keepVariant(app, tag, variant) {
  const list = versionVariants(app, tag);
  if (!list.length) return "";
  return (list.find((v) => v.id === variant) || list.find((v) => v.default) || list[0]).id;
}

const num = (v) => (v == null || v === "" || Number(v) === 0 ? null : Number(v));
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const PARAM_FIELDS = ["defaultValue", "validValues", "label", "description", "required"];

/*
  What the app.yml tab shows for one of a version's variants: its resolved
  manifest's runtime and parameters, each value marked (differs) where it
  isn't the default variant's (DynaSD gpu: compute types, memory 14336,
  MODEL default oncet). Null for a version without variants (the tab shows
  app.yml as before).
  { variant, isDefault, runtime: { computeTypes, cpu, memory, timeoutSeconds },
    differs: { computeTypes, cpu, memory, timeoutSeconds },
    parameters: [{ name, type, label, description, required, defaultValue,
    validValues, differs: { defaultValue, validValues, label, description,
    required } }] }
*/
export function variantManifestView(app, tag, variant) {
  const list = versionVariants(app, tag);
  if (!list.length) return null;
  const chosen = list.find((v) => v.id === variant) || list.find((v) => v.default) || list[0];
  const base = list.find((v) => v.default) || list[0];
  const rt = chosen.manifest?.runtime || {};
  const baseRt = base.manifest?.runtime || {};
  const runtime = {
    computeTypes: rt.computeTypes || [],
    cpu: num(rt.cpu),
    memory: num(rt.memory),
    timeoutSeconds: num(rt.timeoutSeconds),
  };
  const baseRuntime = {
    computeTypes: baseRt.computeTypes || [],
    cpu: num(baseRt.cpu),
    memory: num(baseRt.memory),
    timeoutSeconds: num(baseRt.timeoutSeconds),
  };
  const differs = Object.fromEntries(Object.keys(runtime).map((k) => [k, !same(runtime[k], baseRuntime[k])]));
  const baseParams = base.manifest?.parameters || [];
  const parameters = (chosen.manifest?.parameters || [])
    .filter((p) => p?.name)
    .map((p) => {
      const b = baseParams.find((x) => x.name === p.name) || {};
      const norm = (x) => ({ ...x, validValues: Array.isArray(x.validValues) ? x.validValues : [], required: !!x.required });
      const pn = norm(p);
      const bn = norm(b);
      return {
        name: pn.name,
        type: pn.type || "string",
        label: pn.label || "",
        description: pn.description || "",
        required: pn.required,
        defaultValue: pn.defaultValue,
        validValues: pn.validValues,
        differs: Object.fromEntries(PARAM_FIELDS.map((f) => [f, !same(pn[f], bn[f])])),
      };
    });
  return { variant: chosen, isDefault: chosen.id === base.id, runtime, differs, parameters };
}
