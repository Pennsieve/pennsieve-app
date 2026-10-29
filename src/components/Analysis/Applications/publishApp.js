// Publish an app: the wizard's pure parts (PublishAppDialog.vue is the
// page). The dialog describes the app, GitHub creates the repository from
// Pennsieve's template (its own page, prefilled), the Pennsieve GitHub App
// is installed on it, the app.yml goes in by pull request, and a release
// publishes it. What can be told from the services is told (the repository
// is known once the app is installed on it); the rest the author ticks.
import { createApplicationSchema, createPort, serializeManifestYaml } from "./applicationSchema";

export const TEMPLATE_OWNER = "pennsieve-apps";
export const TEMPLATE_REPO = "processor-template-python";

export const COMPUTE_CHOICES = Object.freeze([
  { value: "lambda", label: "Also as a Lambda function", hint: "Starts in seconds. For steps that finish within 15 minutes and 10 GB." },
  { value: "gpu", label: "Also on a GPU", hint: "For steps that need one." },
]);

export const STEPS = Object.freeze(["describe", "create", "install", "manifest", "release"]);

// A fresh draft.
export const newDraft = () => ({
  name: "",
  description: "",
  tags: "",
  lambda: false,
  gpu: false,
  cpu: "1024",
  memory: "2048",
  inputs: "data",
  outputs: "results",
  owner: "",
  repo: "",
  // What the author has done, beyond what the services can tell.
  created: false,
  manifest: false,
  releaseTag: "v0.1.0",
  releaseUrl: "",
});

// slugify is a repository name from the app's name: lower case, words
// joined by dashes, nothing GitHub refuses.
export const slugify = (name) =>
  String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 100);

const names = (text) =>
  String(text || "")
    .split(/[,\s]+/)
    .map((n) => n.trim())
    .filter(Boolean);

// appYmlFor is the draft's app.yml.
export const appYmlFor = (draft) => {
  const computeTypes = ["standard"];
  if (draft.lambda) computeTypes.push("lambda");
  if (draft.gpu) computeTypes.push("gpu");
  const schema = createApplicationSchema({
    resources: { cpu: Number(draft.cpu) || null, memory: Number(draft.memory) || null },
    runtime: { computeTypes, interactive: false, sessionType: "", kernel: "" },
    inputs: names(draft.inputs).map((name) => createPort({ name })),
    outputs: names(draft.outputs).map((name) => createPort({ name })),
    tags: names(draft.tags),
  });
  return serializeManifestYaml(schema, {
    name: draft.name,
    description: draft.description,
    applicationType: "processor",
  });
};

// templateUrl is GitHub's own page for creating a repository from the
// template, prefilled.
export const templateUrl = (draft) => {
  const params = new URLSearchParams({
    template_owner: TEMPLATE_OWNER,
    template_name: TEMPLATE_REPO,
    name: draft.repo || slugify(draft.name),
    description: String(draft.description || "").slice(0, 350),
    visibility: "public",
  });
  if (draft.owner) params.set("owner", draft.owner);
  return `https://github.com/new?${params}`;
};

// installUrl is where the Pennsieve GitHub App is installed on a repository.
export const installUrl = (githubAppUrl) => `${String(githubAppUrl || "").replace(/\/$/, "")}/installations/new`;

export const repoUrl = (draft) => (draft.owner && draft.repo ? `https://github.com/${draft.owner}/${draft.repo}` : "");

// stepsFor is each step's state: done, or the current one, or ahead.
// installed is what the repository endpoint said (the app is installed on
// a repository it knows); released, the release the dialog made or found.
export const stepsFor = (draft, { installed = false, released = false } = {}) => {
  const described = Boolean(String(draft.name || "").trim());
  const done = {
    describe: described,
    create: installed || draft.created,
    install: installed,
    manifest: installed && draft.manifest,
    release: released,
  };
  let current = "";
  const steps = STEPS.map((key) => {
    const isDone = done[key];
    const isCurrent = !isDone && !current && (key === "describe" || done[STEPS[STEPS.indexOf(key) - 1]]);
    if (isCurrent) current = key;
    return { key, done: isDone, current: isCurrent };
  });
  return steps;
};

const DRAFT_KEY = "pennsieve.publishApp.draft";

export const loadDraft = (storage = globalThis.localStorage) => {
  try {
    const raw = storage?.getItem(DRAFT_KEY);
    return raw ? { ...newDraft(), ...JSON.parse(raw) } : newDraft();
  } catch {
    return newDraft();
  }
};

export const saveDraft = (draft, storage = globalThis.localStorage) => {
  try {
    storage?.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Nothing kept in this browser; the dialog still works.
  }
};

export const clearDraft = (storage = globalThis.localStorage) => {
  try {
    storage?.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
};
