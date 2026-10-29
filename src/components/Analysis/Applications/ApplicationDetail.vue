<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useStore } from "vuex";
import { useRoute, useRouter } from "vue-router";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { load as loadYaml } from "js-yaml";

import IconInfoSmall from "../../icons/IconInfoSmall.vue";
import MetricsDashboard from "../Metrics/MetricsDashboard.vue";
import { parseManifest, MANIFEST_SHAPES, PARAM_TYPE_OPTIONS, conformsToList } from "./applicationSchema";
import BfButton from "../../shared/bf-button/BfButton.vue";
import { fetchRepository, canUpdateManifest } from "./githubRepository";
import ReleaseDialog from "./ReleaseDialog.vue";
import ShareAppDialog from "./ShareAppDialog.vue";
import { accessEntries, accessSummary, makeNamer } from "./appSharing";
import { useWorkspaceMembers } from "./useWorkspaceMembers";
import { fetchReleaseStatus, releaseNudge } from "./release";
import AppArchiveToggle from "../../user/code/AppArchiveToggle.vue";
import { useGetToken } from "@/composables/useGetToken";
import { useAppUsage } from "@/composables/useAppUsage";
import { usageSidebar } from "./appUsage";
import { useSendXhr } from "@/mixins/request/request_composable";


const props = defineProps({
  uuid: {
    type: String,
    required: true,
  },
});

/*
  Local State
*/
const accordionActiveNames = ref(["information", "versions"]);
const detail = ref(null);
const detailLoading = ref(false);
const detailError = ref("");
const readmeHtml = ref("");

const versionsPageSize = 10;
const versionsPage = ref(1);

/*
  Store computed
*/
const store = useStore();
const route = useRoute();
// Shown in a workspace and in My Workspace (My Analysis), where there's no
// organization in the route and route names carry a "my-" prefix.
const isMyWorkspace = computed(() => !route.params.orgId);
const scopedRoute = (name, params = {}) => ({ name: isMyWorkspace.value ? `my-${name}` : name, params });
// An app's page leads back to the Apps tab.
const appsRoute = computed(() => scopedRoute("apps"));

const profile = computed(() => store.state.profile);
const orgMembers = computed(() => store.state.orgMembers || []);

/*
  Derived helpers
*/
const parseGitHubRepo = (sourceUrl) => {
  if (!sourceUrl) return null;
  const match = sourceUrl.match(/github\.com\/([^/]+)\/([^/\s.]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
};

const parseGitHubDisplay = (sourceUrl) => {
  const info = parseGitHubRepo(sourceUrl);
  return info ? `${info.owner}/${info.repo}` : null;
};

const repoName = computed(
  () => parseGitHubDisplay(detail.value?.sourceUrl) || "Unknown repo"
);

const githubRepoUrl = computed(() => {
  const info = parseGitHubRepo(detail.value?.sourceUrl);
  return info ? `https://github.com/${info.owner}/${info.repo}` : null;
});

const isAppOwner = computed(() => {
  const ownerId = detail.value?.ownerId;
  const id = profile.value?.id;
  const intId = profile.value?.intId;
  return !!ownerId && (ownerId === id || ownerId === intId);
});

// The manifest builder, opened for this app. Anyone signed in may open it:
// the owner as the page's main action, others to propose a file to the repo.
const builderForApp = computed(() => ({ ...scopedRoute("application-manifest-builder"), query: { app: props.uuid } }));
const builderLabel = computed(() => (hasManifest.value ? "Update app.yml" : "Create app.yml"));
// The owner, or anyone who can push to the repository (github-service's
// viewerCanPush), gets the main action and the owner's wording.
const repository = ref(null);
watch(
  () => detail.value?.sourceUrl,
  async (url) => {
    repository.value = null;
    const repo = parseGitHubRepo(url);
    if (repo) repository.value = await fetchRepository(store.state.config?.api2Url, repo);
  },
  { immediate: true }
);
const canUpdate = computed(() => canUpdateManifest(isAppOwner.value, repository.value));
const router = useRouter();
const openBuilder = () => router.push(builderForApp.value);

/*
  Release: anyone who can push publishes a release from here, as themselves.
  The app store adds the version from the release webhook; the page checks
  back until it's there. Releasing on GitHub keeps working too.
*/
const releaseOpen = ref(false);
const releaseRepo = computed(() => parseGitHubRepo(detail.value?.sourceUrl));
const canRelease = computed(() => !!releaseRepo.value && canUpdate.value);
// Versions already out: the repository's releases and the app store's.
const knownTags = computed(() => [
  ...(repository.value?.releases || []).map((r) => r.label),
  ...(detail.value?.versions || []).map((v) => v.version),
].filter(Boolean));
// Where the default branch stands against the latest release: Release is
// offered when there's something new, with a nudge saying how much.
const releaseStatus = ref(null);
const loadReleaseStatus = async () => {
  releaseStatus.value = null;
  if (!canRelease.value) return;
  const token = await useGetToken();
  releaseStatus.value = await fetchReleaseStatus(store.state.config?.api2Url, releaseRepo.value, token);
};
watch(canRelease, loadReleaseStatus, { immediate: true });
const nothingToRelease = computed(() => releaseStatus.value?.canRelease === false);
const nudge = computed(() => releaseNudge(releaseStatus.value));
let releaseWatch = null;
const stopReleaseWatch = () => {
  if (releaseWatch) clearTimeout(releaseWatch);
  releaseWatch = null;
};
const onReleased = ({ tag }) => {
  stopReleaseWatch();
  loadReleaseStatus();
  const bare = (s) => String(s || "").replace(/^v/, "");
  let tries = 0;
  // Every 20 s for up to 10 minutes, until the app store has the version.
  const check = async () => {
    tries += 1;
    await loadDetail(props.uuid);
    const there = (detail.value?.versions || []).some((v) => bare(v.version) === bare(tag));
    if (!there && tries < 30) releaseWatch = setTimeout(check, 20000);
    else releaseWatch = null;
  };
  releaseWatch = setTimeout(check, 20000);
};
onBeforeUnmount(stopReleaseWatch);

// Permissions only apply to private applications.
const isPublic = computed(() => detail.value?.visibility === "public" || detail.value?.isPrivate === false);

// Private GitHub repos return 401 from raw.githubusercontent.com, so their
// README's own images can't load in the browser; the README text comes with
// the app's details (app-deploy-service reads it at release) and is shown.
const isPrivateRepo = computed(
  () => detail.value?.visibility === "private" || detail.value?.isPrivate === true
);

// Anyone can open a public repo on GitHub. A private repo: its owner and
// anyone who can push to it (others must request permission from its owner).
const canViewOnGitHub = computed(() => !isPrivateRepo.value || canUpdate.value);

// Keep the local detail in sync when the archive toggle changes status.
const onArchiveChange = (status) => {
  if (detail.value) detail.value = { ...detail.value, status };
};

/*
  Who can use this app: visibility, and who a private app is shared with,
  summarized at the top of the side panel; the owner shares from the header
  (ShareAppDialog). Visibility and access change together, so the page reloads.
*/
const permissions = ref([]);
const shareOpen = ref(false);
// People shared with may come from any of the caller's workspaces: name them.
const { allMembers, load: loadAllMembers } = useWorkspaceMembers();
watch(permissions, (perms) => {
  if ((perms || []).some((p) => p?.entityType === "user" || p?.userId)) loadAllMembers();
});
const viewingOrgId = computed(() => store.state.activeOrganization?.organization?.id || null);

// What the app used across runs, by version (workflow-service metrics/usage).
const { usage: appUsage } = useAppUsage(computed(() => detail.value?.sourceUrl));
const appUsageSide = computed(() => usageSidebar(appUsage.value));
const accessList = computed(() =>
  accessEntries(
    permissions.value,
    makeNamer({
      profile: profile.value,
      members: [...(store.state.orgMembers || []), ...allMembers.value],
      teams: store.state.teams || [],
      organizations: store.state.organizations || [],
    }),
    viewingOrgId.value
  )
);
const accessLine = computed(() => accessSummary(accessList.value, detail.value?.ownerId));
// Chips: who else has access, the first few.
const accessChips = computed(() =>
  accessList.value.filter((e) => !(e.type === "user" && String(e.id) === String(detail.value?.ownerId)))
);

// Visibility may change via the permissions editor — reload to reflect it.
const reloadAfterPermissions = () => loadDetail(props.uuid);

const sortedVersions = computed(() => {
  const versions = detail.value?.versions || [];
  return [...versions].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime() || 0;
    const bTime = new Date(b.createdAt).getTime() || 0;
    return bTime - aTime;
  });
});

// The newest version's license: read by app-deploy-service from the
// repository's LICENSE file at that release (an SPDX id), not from app.yml.
const latestLicense = computed(() => sortedVersions.value.find((v) => v.license)?.license || "");

// How the newest version's app.yml doesn't follow the schema, as
// app-deploy-service found at registration (in warn mode it registers anyway):
// "path: reason" strings, shown as field and reason.
const manifestProblems = computed(() =>
  (sortedVersions.value[0]?.manifestProblems || []).map((line) => {
    const i = String(line).indexOf(": ");
    return i > 0 ? { path: line.slice(0, i), message: line.slice(i + 2) } : { path: "Root", message: String(line) };
  })
);

const versionsPageCount = computed(() =>
  Math.max(1, Math.ceil(sortedVersions.value.length / versionsPageSize))
);

const paginatedVersions = computed(() => {
  const start = (versionsPage.value - 1) * versionsPageSize;
  return sortedVersions.value.slice(start, start + versionsPageSize);
});

/*
  User name resolution
*/
const getUserName = (userId) => {
  if (!userId) return "Unknown";
  if (profile.value && (profile.value.id === userId || profile.value.intId === userId)) {
    return `${profile.value.firstName} ${profile.value.lastName}`.trim() || "You";
  }
  const member = orgMembers.value.find((m) => m.id === userId || m.intId === userId);
  if (member) {
    return `${member.firstName} ${member.lastName}`.trim() || "Unknown User";
  }
  // Not someone this page knows (another workspace, or outside one): say so
  // rather than show an id.
  return "Another Pennsieve user";
};
// A parameter's type as the builder names it: Text, Number, Whole number,
// True / False, or Choice (a value from a list).
const paramTypeLabel = (type) => PARAM_TYPE_OPTIONS.find((o) => o.value === type)?.label || type;

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
};

const formatDateTime = (dateString) => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return dateString;
  }
};

/*
  Status helpers
*/
const statusBadgeClass = (status) => {
  if (!status) return "badge-gray";
  const s = status.toLowerCase();
  if (["deployed", "active", "running"].includes(s)) return "badge-green";
  if (["registering", "deploying", "re-deploying", "pending"].includes(s))
    return "badge-blue";
  if (s.startsWith("error") || s === "stopped") return "badge-red";
  return "badge-gray";
};

const statusLabel = (status) => {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};

/*
  README rendering from assets
*/
const getReadmeContent = (assets) => {
  if (!assets) return "";
  const key = Object.keys(assets).find((k) => /^readme(\.md)?$/i.test(k));
  return key ? assets[key] : "";
};

const rawContentBase = (sourceUrl) => {
  const info = parseGitHubRepo(sourceUrl);
  if (!info) return null;
  return `https://raw.githubusercontent.com/${info.owner}/${info.repo}/HEAD/`;
};

const resolveAssetUrl = (src, sourceUrl) => {
  if (!src) return src;
  // GitHub blob URLs → raw URLs (so the image renders inline)
  const blobMatch = src.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/
  );
  if (blobMatch) {
    return `https://raw.githubusercontent.com/${blobMatch[1]}/${blobMatch[2]}/${blobMatch[3]}`;
  }
  // Already absolute (http/https/data/blob) — leave alone
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  // Relative — resolve against repo raw content
  const base = rawContentBase(sourceUrl);
  if (!base) return src;
  return base + src.replace(/^\.?\//, "");
};

const renderReadme = (markdown) => {
  if (!markdown) {
    readmeHtml.value = "";
    return;
  }
  const rawHtml = marked.parse(markdown);
  const doc = new DOMParser().parseFromString(rawHtml, "text/html");
  const sourceUrl = detail.value?.sourceUrl;
  const repo = parseGitHubRepo(sourceUrl);
  const ownRaw = repo ? `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/`.toLowerCase() : "";
  doc.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (!src) return;
    const resolved = resolveAssetUrl(src, sourceUrl);
    // A private repo's own images need GitHub sign-in: a note, not a broken image.
    if (isPrivateRepo.value && ownRaw && resolved.toLowerCase().startsWith(ownRaw)) {
      const note = doc.createElement("span");
      note.className = "readme-image-private";
      note.textContent = `Image not shown (private repository)${img.getAttribute("alt") ? `: ${img.getAttribute("alt")}` : ""}`;
      img.replaceWith(note);
      return;
    }
    img.setAttribute("src", resolved);
  });
  readmeHtml.value = DOMPurify.sanitize(doc.body.innerHTML);
};

/*
  app.yml manifest
  ----------------
  The detail endpoint returns recognized repository files in `assets`, keyed by
  filename — `README.md` and, when the author has committed one, `app.yml`. The
  manifest is optional: most applications don't have one, so every branch here
  has to tolerate its absence.

  Parsing goes through applicationSchema's parseManifest(), which reads the
  nested layout only, as the backend does; a file in the earlier flat layout
  is reported (manifestParsed.earlier), not read.
*/
const getManifestContent = (assets) => {
  if (!assets) return "";
  const key = Object.keys(assets).find((k) => /^app\.ya?ml$/i.test(k));
  return key ? assets[key] : "";
};

const manifestRaw = computed(() => getManifestContent(detail.value?.assets));

const hasManifest = computed(() => !!manifestRaw.value.trim());

/*
  Parse once. We load the YAML here rather than handing the raw text straight to
  parseManifest() so that a file which is valid YAML but not a mapping (a bare
  string, a list) is reported as malformed instead of quietly parsing to an
  empty manifest.
*/
const manifestParsed = computed(() => {
  const empty = { ok: false, meta: null, schema: null, error: "" };
  if (!hasManifest.value) return empty;
  try {
    const doc = loadYaml(manifestRaw.value);
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
      return { ...empty, error: "Manifest is empty or not a YAML mapping" };
    }
    const { meta, schema } = parseManifest(doc);
    // The earlier flat layout: nothing in it is read (the platform doesn't
    // either), so it isn't "read successfully".
    if (meta.shape === MANIFEST_SHAPES.FLAT) return { ...empty, earlier: true };
    return { ok: true, meta, schema, error: "" };
  } catch (err) {
    return {
      ...empty,
      error: err?.reason || err?.message || "Could not parse YAML",
    };
  }
});

const manifestMeta = computed(() => manifestParsed.value.meta);
const manifestSchema = computed(() => manifestParsed.value.schema);

/** Compact figures for the sidebar card. */
const manifestSummary = computed(() => {
  const s = manifestSchema.value;
  const m = manifestMeta.value;
  if (!s || !m) return null;
  const { cpu, memory } = s.resources || {};
  return {
    type: m.applicationType || null,
    version: m.version || null,
    compute:
      cpu != null || memory != null
        ? [cpu != null ? `${cpu} CPU` : null, memory != null ? `${memory} MB` : null]
            .filter(Boolean)
            .join(" · ")
        : null,
    parameters: (s.parameters || []).length,
    inputs: (s.inputs || []).length,
    outputs: (s.outputs || []).length,
  };
});

/** Human-readable port descriptor: media types if present, else the dataType. */
const portTypeLabel = (port) => {
  const structures = conformsToList(port?.conformsTo);
  if (structures.length) {
    const holds = port?.mediaTypes?.length ? `, holding ${port.mediaTypes.join(", ")}` : "";
    return `${structures.join(" › ")} folder${holds}`;
  }
  if (port?.mediaTypes?.length) {
    const types = port.mediaTypes.join(", ");
    return port.container === "directory" ? `${types} (as a folder)` : types;
  }
  return port?.dataType || "any";
};

const computeTypeLabels = computed(() => {
  const types = manifestSchema.value?.runtime?.computeTypes || [];
  return types.map((t) => (t === "gpu" ? "GPU" : t.charAt(0).toUpperCase() + t.slice(1)));
});

const formatDefaultValue = (value) => {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
};

const manifestTooltip = computed(() => {
  if (manifestParsed.value.ok) {
    return (
      "app.yml is the manifest committed to the root of this repository. It " +
      "declares the application's runtime, compute resources, run parameters, " +
      "and input/output ports. Pennsieve read it from the repository and is " +
      "using it to configure this application."
    );
  }
  if (manifestParsed.value.earlier) {
    return (
      "This repository's app.yml uses an earlier layout that Pennsieve no longer " +
      "reads, so the application runs on defaults. Update it in the manifest builder."
    );
  }
  if (hasManifest.value) {
    return (
      "This repository has an app.yml, but Pennsieve could not parse it, so the " +
      "application falls back to defaults. Fix the YAML and commit it, or " +
      "regenerate the file with the manifest builder."
    );
  }
  return (
    "app.yml is an optional manifest file committed to the root of your " +
    "repository. It declares the application's runtime, compute resources, run " +
    "parameters, and input/output ports so Pennsieve can configure runs without " +
    "manual setup. Without one, this application falls back to defaults. " +
    "Generate a manifest with the builder, then commit it to your repository."
  );
});

/*
  Main-panel tabs. The manifest tab only exists when there is something to show;
  if the active tab disappears (navigating to an app without a manifest) fall
  back to the README.
*/
const activeTab = ref("readme");
const showRawManifest = ref(false);

// The app.yml tab is always there: without a file it offers to create one.


// Members and teams power friendly-name resolution for the owner badge.
// They are not always preloaded when navigating directly to this page;
// fall back to fetching them here.
const ensureOrgData = async () => {
  // Only the workspace being viewed; outside one there are no members to load.
  const orgId = store.state.activeOrganization?.organization?.id;
  if (!orgId) return;
  const needsMembers = !store.state.orgMembers?.length;
  const needsTeams = !store.state.teams?.length;
  if (!needsMembers && !needsTeams) return;
  try {
    const token = await useGetToken();
    const base = `${store.state.config.apiUrl}/organizations/${orgId}`;
    await Promise.all([
      needsMembers
        ? useSendXhr(`${base}/members?api_key=${token}`).then((r) =>
            store.dispatch("updateOrgMembers", r)
          )
        : Promise.resolve(),
      needsTeams
        ? useSendXhr(`${base}/teams?api_key=${token}`).then((r) =>
            store.dispatch("updateTeams", r)
          )
        : Promise.resolve(),
    ]);
  } catch (err) {
    console.warn("Failed to load org data for application detail:", err);
  }
};

/*
  Fetch application detail
*/
const loadDetail = async (uuid) => {
  detail.value = null;
  readmeHtml.value = "";
  detailError.value = "";
  versionsPage.value = 1;
  if (!uuid) return;
  detailLoading.value = true;
  try {
    const [detailResult, permissionsResult] = await Promise.allSettled([
      store.dispatch("analysisModule/fetchApplication", uuid),
      store.dispatch("analysisModule/fetchApplicationPermissions", uuid),
      ensureOrgData(),
    ]);

    const perms = permissionsResult?.status === "fulfilled" ? permissionsResult.value : null;
    permissions.value = Array.isArray(perms) ? perms : perms?.access || perms?.permissions || [];
    if (detailResult.status === "fulfilled") {
      detail.value = detailResult.value;
      // The README comes with the details, also for private repos; only
      // their own images are left out (renderReadme).
      renderReadme(getReadmeContent(detailResult.value?.assets));
    } else {
      console.error(detailResult.reason);
      detailError.value = "Failed to load application";
    }
  } finally {
    detailLoading.value = false;
  }
};

watch(
  () => props.uuid,
  (uuid) => loadDetail(uuid),
  { immediate: true }
);
</script>

<template>
  <div class="applications-page">
    <!-- Header -->
    <div class="builder-header">
      <span class="header-title">
        <router-link :to="appsRoute" class="header-back-link">Apps</router-link>
        <template v-if="detail">
          <span class="header-breadcrumb-sep">/</span>
          <span class="header-detail-name">{{ repoName }}</span>
        </template>
      </span>
      <!-- The page's main action: publish a release (the app store follows) -->
      <div v-if="detail && (canRelease || isAppOwner)" class="header-actions">
        <bf-button v-if="isAppOwner" class="compact flex secondary" @click="shareOpen = true">Share</bf-button>
        <template v-if="canRelease">
        <span v-if="nudge" class="release-nudge">{{ nudge }}</span>
        <el-tooltip
          :disabled="!nothingToRelease"
          :content="`Nothing new since ${releaseStatus?.latestTag}: the ${releaseStatus?.target} branch is at that release.`"
          placement="bottom"
        >
          <span>
            <bf-button class="compact flex" :disabled="nothingToRelease" @click="releaseOpen = true">Release a version</bf-button>
          </span>
        </el-tooltip>
        </template>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="detailLoading" class="app-loading">
      Loading...
    </div>

    <!-- Error / Not Found -->
    <div v-else-if="detailError || !detail" class="app-not-found">
      <p>{{ detailError || "Application not found." }}</p>
      <router-link :to="appsRoute" class="back-link">
        &larr; Back to Apps
      </router-link>
    </div>

    <!-- Detail Content -->
    <div v-else class="builder-content">
      <!-- Left: Main Panel -->
      <div class="main-panel">
        <!-- Metrics -->
        <div class="metrics-section">
          <MetricsDashboard
            v-if="detail.sourceUrl"
            filter-column="sourceUrl"
            :filter-value="detail.sourceUrl"
          />
          <div v-else class="metrics-placeholder">
            <span>No source URL available for metrics</span>
          </div>
        </div>

        <!-- README Section -->
        <div class="readme-section">
          <div class="readme-header">
            <div class="detail-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                class="detail-tab"
                :class="{ 'detail-tab-active': activeTab === 'readme' }"
                :aria-selected="activeTab === 'readme'"
                @click="activeTab = 'readme'"
              >
                README
              </button>
              <button
                type="button"
                role="tab"
                class="detail-tab"
                :class="{ 'detail-tab-active': activeTab === 'manifest' }"
                :aria-selected="activeTab === 'manifest'"
                @click="activeTab = 'manifest'"
              >
                app.yml
              </button>
            </div>
            <div class="readme-header-actions">
              <bf-button v-if="activeTab === 'manifest' && canUpdate" class="compact flex" @click="openBuilder">{{ builderLabel }}</bf-button>
              <button v-else-if="activeTab === 'manifest'" type="button" class="app-yml-btn" @click="openBuilder">{{ builderLabel }}</button>
            <el-tooltip
              v-if="githubRepoUrl"
              :content="canViewOnGitHub ? '' : 'This repo is private. Request permission from repo owner to view on Github.'"
              placement="top"
              :disabled="canViewOnGitHub"
            >
              <span class="github-link-wrap">
                <a
                  v-if="canViewOnGitHub"
                  :href="githubRepoUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="readme-github-link"
                >
                  View on GitHub
                </a>
                <span
                  v-else
                  class="readme-github-link disabled"
                  aria-disabled="true"
                >
                  View on GitHub
                </span>
              </span>
            </el-tooltip>
            </div>
          </div>
          <!-- README tab -->
          <template v-if="activeTab === 'readme'">
            <div v-if="readmeHtml" class="readme-content" v-html="readmeHtml" />
            <div v-else class="readme-empty">
              No README available
            </div>
          </template>

          <!-- app.yml tab -->
          <template v-else>
            <div v-if="!hasManifest" class="readme-empty app-yml-empty">
              <p>
                This app has no app.yml yet. It tells Pennsieve the app's inputs,
                outputs, parameters and resources.
              </p>
              <bf-button v-if="canUpdate" class="compact flex" @click="openBuilder">{{ builderLabel }}</bf-button>
              <button v-else type="button" class="app-yml-btn" @click="openBuilder">{{ builderLabel }}</button>
            </div>
            <div v-else-if="manifestParsed.earlier" class="manifest-detail">
              <section class="manifest-block app-yml-earlier">
                <p>
                  This app.yml uses an earlier layout that Pennsieve no longer reads, so the
                  app runs on defaults.
                  {{ canUpdate ? "Update it in the builder." : "Its owner can update it in the builder." }}
                </p>
                <bf-button v-if="canUpdate" class="compact flex" @click="openBuilder">{{ builderLabel }}</bf-button>
                <button v-else type="button" class="app-yml-btn" @click="openBuilder">{{ builderLabel }}</button>
              </section>
              <section v-if="manifestProblems.length" class="manifest-block manifest-problems">
                <div class="validation-list">
                  <div v-for="(p, i) in manifestProblems" :key="i" class="validation-item">
                    <div class="field-name">{{ p.path }}</div>
                    <div class="error-message">{{ p.message }}</div>
                  </div>
                </div>
              </section>
              <section class="manifest-block">
                <h4 class="manifest-block-title">app.yml</h4>
                <pre class="manifest-raw"><code>{{ manifestRaw }}</code></pre>
              </section>
            </div>
            <div v-else-if="!manifestParsed.ok" class="readme-empty">
              <p>This app.yml could not be read.</p>
              <p class="manifest-error-detail">{{ manifestParsed.error }}</p>
            </div>
            <div v-else class="manifest-detail">
              <!-- The newest version's schema problems, if registration found any -->
              <section v-if="manifestProblems.length" class="manifest-block manifest-problems">
                <h4 class="manifest-block-title">
                  This version's app.yml has {{ manifestProblems.length }}
                  {{ manifestProblems.length === 1 ? "problem" : "problems" }}
                </h4>
                <div class="validation-list">
                  <div v-for="(p, i) in manifestProblems" :key="i" class="validation-item">
                    <div class="field-name">{{ p.path }}</div>
                    <div class="error-message">{{ p.message }}</div>
                  </div>
                </div>
                <router-link
                  :to="{ ...scopedRoute('application-manifest-builder'), query: { check: 1 } }"
                  class="manifest-cta-secondary"
                >
                  Check an app.yml in the manifest builder
                </router-link>
              </section>

              <!-- Overview -->
              <section class="manifest-block">
                <h4 class="manifest-block-title">Overview</h4>
                <div class="manifest-grid">
                  <div v-if="manifestMeta.name" class="manifest-field">
                    <span class="manifest-field-label">Name</span>
                    <span class="manifest-field-value">{{ manifestMeta.name }}</span>
                  </div>
                  <div v-if="manifestMeta.version" class="manifest-field">
                    <span class="manifest-field-label">Version</span>
                    <span class="manifest-field-value">{{ manifestMeta.version }}</span>
                  </div>
                  <div class="manifest-field">
                    <span class="manifest-field-label">Type</span>
                    <span class="manifest-field-value">{{ manifestMeta.applicationType }}</span>
                  </div>
                  <div v-if="manifestMeta.schemaVersion" class="manifest-field">
                    <span class="manifest-field-label">Schema version</span>
                    <span class="manifest-field-value">{{ manifestMeta.schemaVersion }}</span>
                  </div>
                </div>
                <p v-if="manifestMeta.description" class="manifest-description">
                  {{ manifestMeta.description }}
                </p>
                <div v-if="manifestSchema.tags.length" class="manifest-chips">
                  <span
                    v-for="tag in manifestSchema.tags"
                    :key="tag"
                    class="manifest-chip"
                  >
                    {{ tag }}
                  </span>
                </div>
              </section>

              <!-- Runtime -->
              <section class="manifest-block">
                <h4 class="manifest-block-title">Runtime</h4>
                <div class="manifest-grid">
                  <div class="manifest-field">
                    <span class="manifest-field-label">Compute types</span>
                    <span class="manifest-field-value">
                      {{ computeTypeLabels.join(", ") || "—" }}
                    </span>
                  </div>
                  <div v-if="manifestSchema.resources.cpu != null" class="manifest-field">
                    <span class="manifest-field-label">CPU</span>
                    <span class="manifest-field-value">{{ manifestSchema.resources.cpu }}</span>
                  </div>
                  <div v-if="manifestSchema.resources.memory != null" class="manifest-field">
                    <span class="manifest-field-label">Memory</span>
                    <span class="manifest-field-value">
                      {{ manifestSchema.resources.memory }} MB
                    </span>
                  </div>
                  <div v-if="manifestMeta.timeoutSeconds != null" class="manifest-field">
                    <span class="manifest-field-label">Timeout</span>
                    <span class="manifest-field-value">
                      {{ manifestMeta.timeoutSeconds }}s
                    </span>
                  </div>
                </div>
              </section>

              <!-- Maintainers -->
              <section v-if="manifestMeta.maintainers.length" class="manifest-block">
                <h4 class="manifest-block-title">Maintainers</h4>
                <ul class="manifest-list">
                  <li
                    v-for="(person, i) in manifestMeta.maintainers"
                    :key="`${person.name}-${i}`"
                    class="manifest-list-item"
                  >
                    <span class="manifest-field-value">{{ person.name }}</span>
                    <a
                      v-if="person.email"
                      :href="`mailto:${person.email}`"
                      class="manifest-link"
                    >
                      {{ person.email }}
                    </a>
                    <a
                      v-if="person.orcid"
                      :href="`https://orcid.org/${person.orcid}`"
                      target="_blank"
                      rel="noopener"
                      class="manifest-link"
                    >
                      ORCID {{ person.orcid }}
                    </a>
                  </li>
                </ul>
              </section>

              <!-- License: the repository's, not app.yml's -->
              <section v-if="latestLicense" class="manifest-block">
                <h4 class="manifest-block-title">License</h4>
                <span class="manifest-field-value">{{ latestLicense }}</span>
                <span class="manifest-license-note">From the repository's LICENSE file.</span>
              </section>

              <!-- Parameters -->
              <section v-if="manifestSchema.parameters.length" class="manifest-block">
                <h4 class="manifest-block-title">
                  Parameters ({{ manifestSchema.parameters.length }})
                </h4>
                <div class="manifest-table-scroll">
                  <table class="manifest-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Default</th>
                        <th>Valid values</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="param in manifestSchema.parameters" :key="param.name">
                        <td class="manifest-mono">{{ param.name }}</td>
                        <td>{{ paramTypeLabel(param.type) }}</td>
                        <td class="manifest-mono">
                          {{ formatDefaultValue(param.defaultValue) }}
                        </td>
                        <td class="manifest-mono">
                          {{ param.validValues.length ? param.validValues.join(", ") : "—" }}
                        </td>
                        <td>{{ param.description || "—" }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <!-- Inputs / Outputs -->
              <section
                v-if="manifestSchema.inputs.length || manifestSchema.outputs.length"
                class="manifest-block"
              >
                <h4 class="manifest-block-title">Inputs &amp; outputs</h4>
                <div class="manifest-ports">
                  <div class="manifest-port-column">
                    <span class="manifest-port-heading">
                      Inputs ({{ manifestSchema.inputs.length }})
                    </span>
                    <div v-if="!manifestSchema.inputs.length" class="manifest-port-empty">
                      None declared
                    </div>
                    <div
                      v-for="port in manifestSchema.inputs"
                      :key="`in-${port.name}`"
                      class="manifest-port"
                    >
                      <div class="manifest-port-name">
                        <span class="manifest-mono">{{ port.name }}</span>
                        <span v-if="port.required" class="manifest-required">required</span>
                      </div>
                      <div class="manifest-port-meta">
                        {{ portTypeLabel(port) }}
                        <template v-if="port.cardinality">
                          &middot; {{ port.cardinality }}
                        </template>
                      </div>
                      <div v-if="port.description" class="manifest-port-desc">
                        {{ port.description }}
                      </div>
                    </div>
                  </div>

                  <div class="manifest-port-column">
                    <span class="manifest-port-heading">
                      Outputs ({{ manifestSchema.outputs.length }})
                    </span>
                    <div v-if="!manifestSchema.outputs.length" class="manifest-port-empty">
                      None declared
                    </div>
                    <div
                      v-for="port in manifestSchema.outputs"
                      :key="`out-${port.name}`"
                      class="manifest-port"
                    >
                      <div class="manifest-port-name">
                        <span class="manifest-mono">{{ port.name }}</span>
                      </div>
                      <div class="manifest-port-meta">
                        {{ portTypeLabel(port) }}
                        <template v-if="port.cardinality">
                          &middot; {{ port.cardinality }}
                        </template>
                      </div>
                      <div v-if="port.description" class="manifest-port-desc">
                        {{ port.description }}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <!-- Raw file -->
              <section class="manifest-block">
                <h4 class="manifest-block-title manifest-raw-title">
                  <button
                    type="button"
                    class="manifest-raw-toggle"
                    :aria-expanded="showRawManifest"
                    @click="showRawManifest = !showRawManifest"
                  >
                    Raw app.yml
                    <span class="manifest-raw-toggle-action">{{ showRawManifest ? "Hide" : "Show" }}</span>
                  </button>
                </h4>
                <pre v-if="showRawManifest" class="manifest-raw"><code>{{ manifestRaw }}</code></pre>
              </section>
            </div>
          </template>
        </div>
      </div>

      <!-- Right: Sidebar -->
      <div class="applications-sidebar">
        <!-- Who can use this app: the first thing in the side panel -->
        <div class="sidebar-access">
          <h4 class="sidebar-access-title">Who can use this app</h4>
          <p class="access-visibility">
            <strong>{{ isPublic ? "Public" : "Private" }}</strong>
            <template v-if="detail.ownerId"> · owned by {{ getUserName(detail.ownerId) }}</template>
          </p>
          <p class="access-line">
            <template v-if="isPublic">Anyone on Pennsieve can find it and use it in workflows.</template>
            <template v-else>{{ accessLine || "Only its owner, so far." }}</template>
          </p>
          <div v-if="!isPublic && accessChips.length" class="access-chips">
            <span v-for="e in accessChips.slice(0, 4)" :key="`${e.type}:${e.id}`" class="access-chip" :title="e.type">{{ e.name }}</span>
            <span v-if="accessChips.length > 4" class="access-chip access-chip--more">+{{ accessChips.length - 4 }}</span>
          </div>
          <a v-if="isAppOwner" href="#" class="access-manage" @click.prevent="shareOpen = true">Manage access ›</a>
          <p v-else-if="!isPublic" class="access-ask">To get access, ask {{ getUserName(detail.ownerId) }}.</p>
        </div>

        <el-collapse v-model="accordionActiveNames" class="sidebar-accordion">
          <el-collapse-item title="Information" name="information">
            <div class="info-card">
              <div class="info-row">
                <span class="info-label">Repository</span>
                <span class="info-value">{{ repoName }}</span>
              </div>
              <div v-if="detail.sourceType" class="info-row">
                <span class="info-label">Source</span>
                <span class="info-value">{{ detail.sourceType }}</span>
              </div>
              <div v-if="detail.createdAt" class="info-row">
                <span class="info-label">Created</span>
                <span class="info-value">{{ formatDate(detail.createdAt) }}</span>
              </div>
              <div v-if="detail.ownerId" class="info-row">
                <span class="info-label">Owner</span>
                <span class="info-value info-value--name" :title="detail.ownerId">{{ getUserName(detail.ownerId) }}</span>
              </div>
              <div v-if="detail.sourceUrl" class="info-row">
                <span class="info-label">URL</span>
                <a
                  :href="detail.sourceUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="info-value info-url"
                >
                  {{ detail.sourceUrl }}
                </a>
              </div>
            </div>

            <!-- app.yml manifest -->
            <div class="manifest-card">
              <div class="manifest-header">
                <span class="info-label manifest-title">Manifest</span>
                <el-tooltip
                  :content="manifestTooltip"
                  placement="left"
                  effect="dark"
                  popper-class="manifest-tooltip"
                >
                  <span class="manifest-info-icon">
                    <IconInfoSmall :width="16" :height="16" color="#9ca3af" />
                  </span>
                </el-tooltip>
              </div>

              <!-- Present and parsed -->
              <template v-if="manifestParsed.ok">
                <div class="manifest-status manifest-status-ok">
                  <span class="manifest-dot" />
                  <span class="manifest-filename">app.yml</span>
                  <span class="manifest-status-text">Read successfully</span>
                </div>
                <div v-if="manifestSummary" class="manifest-summary">
                  <div v-if="manifestSummary.type" class="manifest-summary-row">
                    <span class="manifest-summary-label">Type</span>
                    <span class="manifest-summary-value">{{ manifestSummary.type }}</span>
                  </div>
                  <div v-if="manifestSummary.version" class="manifest-summary-row">
                    <span class="manifest-summary-label">Version</span>
                    <span class="manifest-summary-value">{{ manifestSummary.version }}</span>
                  </div>
                  <div v-if="manifestSummary.compute" class="manifest-summary-row">
                    <span class="manifest-summary-label">Resources</span>
                    <span class="manifest-summary-value">{{ manifestSummary.compute }}</span>
                  </div>
                  <!-- What the app used across runs (workflow-service metrics/usage): the
                       version run last, against the resources above. A caption sets
                       these apart: measured, not declared. -->
                  <div v-if="appUsageSide" class="manifest-summary-measured">{{ appUsageSide.caption }}</div>
                  <div v-if="appUsageSide" class="manifest-summary-row manifest-summary-row-measured" :title="appUsageSide.title">
                    <span class="manifest-summary-label">Peak memory</span>
                    <span class="manifest-summary-value">{{ appUsageSide.memory }}</span>
                  </div>
                  <div v-if="appUsageSide && appUsageSide.cpu" class="manifest-summary-row manifest-summary-row-measured" :title="appUsageSide.title">
                    <span class="manifest-summary-label">Peak CPU</span>
                    <span class="manifest-summary-value">{{ appUsageSide.cpu }}</span>
                  </div>
                  <p v-if="appUsageSide && appUsageSide.hint" class="manifest-summary-hint">{{ appUsageSide.hint }}</p>
                  <div class="manifest-summary-row">
                    <span class="manifest-summary-label">Parameters</span>
                    <span class="manifest-summary-value">{{ manifestSummary.parameters }}</span>
                  </div>
                  <div class="manifest-summary-row">
                    <span class="manifest-summary-label">Inputs / Outputs</span>
                    <span class="manifest-summary-value">
                      {{ manifestSummary.inputs }} / {{ manifestSummary.outputs }}
                    </span>
                  </div>
                </div>
                <router-link :to="builderForApp" class="manifest-builder-link">Update in builder ›</router-link>
              </template>

              <!-- In the earlier layout: not read -->
              <template v-else-if="manifestParsed.earlier">
                <div class="manifest-status manifest-status-error">
                  <span class="manifest-dot" />
                  <span class="manifest-filename">app.yml</span>
                  <span class="manifest-status-text">Earlier layout, not read</span>
                </div>
                <router-link :to="builderForApp" class="manifest-builder-link">Update in builder ›</router-link>
              </template>

              <!-- Present but malformed -->
              <template v-else-if="hasManifest">
                <div class="manifest-status manifest-status-error">
                  <span class="manifest-dot" />
                  <span class="manifest-filename">app.yml</span>
                  <span class="manifest-status-text">Could not be read</span>
                </div>
                <p class="manifest-error-detail">{{ manifestParsed.error }}</p>
              </template>

              <!-- Absent -->
              <template v-else>
                <div class="manifest-status manifest-status-none">
                  <span class="manifest-dot" />
                  <span class="manifest-status-text">No app.yml in this repository</span>
                </div>
                <p class="manifest-empty-copy">
                  This application runs on defaults. Add an
                  <code>app.yml</code> to declare its runtime, resources,
                  parameters, and inputs/outputs.
                </p>
                <router-link :to="builderForApp" class="manifest-builder-link">Create in builder ›</router-link>
                <router-link
                  :to="scopedRoute('application-manifest-guide')"
                  class="manifest-cta-secondary"
                >
                  Read the manifest guide
                </router-link>
              </template>
            </div>

            <!-- Read only here; archiving is in the danger zone -->
            <div class="info-actions archive-actions">
              <span class="info-label">Status</span>
              <span class="status-tag" :class="{ 'status-tag--archived': detail.status === 'archived' }">
                {{ detail.status === "archived" ? "Archived" : "Active" }}
              </span>
            </div>

          </el-collapse-item>

          <el-collapse-item
            :title="`Versions (${sortedVersions.length})`"
            name="versions"
          >
            <div v-if="sortedVersions.length === 0" class="empty-versions">
              No versions yet
            </div>
            <div
              v-for="version in paginatedVersions"
              :key="version.uuid"
              class="version-card"
            >
              <div class="version-header">
                <span class="version-tag">{{ version.version }}</span>
                <span
                  class="status-badge"
                  :class="statusBadgeClass(version.status)"
                >
                  {{ statusLabel(version.status) }}
                </span>
              </div>
              <div class="version-meta">
                <span>Released {{ formatDate(version.createdAt) }}</span>
              </div>
              <!-- Deployments hidden for now -->
              <!--
              <div
                v-if="(version.deployments || []).length > 0"
                class="deployments-list"
              >
                <div class="deployments-label">Deployments</div>
                <div
                  v-for="deployment in version.deployments"
                  :key="deployment.deploymentId"
                  class="deployment-row"
                >
                  <span
                    class="status-badge status-badge-sm"
                    :class="statusBadgeClass(deployment.lastStatus)"
                  >
                    {{ statusLabel(deployment.lastStatus) }}
                  </span>
                  <span class="deployment-time">
                    {{ formatDateTime(deployment.initiatedAt) }}
                  </span>
                </div>
              </div>
              -->
            </div>
            <el-pagination
              v-if="versionsPageCount > 1"
              class="versions-pagination"
              :page-size="versionsPageSize"
              :pager-count="5"
              :current-page="versionsPage"
              layout="prev, pager, next"
              :total="sortedVersions.length"
              small
              @current-change="versionsPage = $event"
            />
          </el-collapse-item>
        </el-collapse>

        <!-- Archiving: the owner only, out of the way of everyday settings -->
        <div v-if="isAppOwner" class="sidebar-danger">
          <h4 class="sidebar-danger-title">Danger zone</h4>
          <app-archive-toggle
            variant="button"
            :uuid="detail.uuid"
            :owner-id="detail.ownerId"
            :status="detail.status"
            @change="onArchiveChange"
          />
        </div>
      </div>
    </div>
    <ShareAppDialog
      v-if="detail && isAppOwner"
      v-model="shareOpen"
      :uuid="detail.uuid"
      :app-name="repoName"
      :is-public="isPublic"
      :owner-id="detail.ownerId"
      :organization-id="viewingOrgId"
      :entries="accessList"
      @saved="reloadAfterPermissions"
    />
    <ReleaseDialog
      v-if="canRelease"
      v-model="releaseOpen"
      :api2-url="store.state.config?.api2Url || ''"
      :repo="releaseRepo"
      :known-tags="knownTags"
      :status="releaseStatus"
      :default-branch="releaseStatus?.target || ''"
      @released="onReleased"
    />
  </div>
</template>

<style lang="scss" scoped>
@use "../../../styles/theme";

.applications-page {
  height: calc(100vh - 112px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.builder-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 24px;
  background-color: theme.$white;
  border-bottom: 1px solid theme.$gray_3;
  min-height: 48px;

  .header-title {
    font-weight: 400;
    font-size: 13px;
    color: theme.$gray_4;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-back-link {
    color: theme.$purple_3;
    cursor: pointer;
    font-weight: 500;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  .header-breadcrumb-sep {
    color: theme.$gray_4;
    font-weight: 400;
  }

  .header-detail-name {
    font-weight: 600;
    font-size: 14px;
    color: theme.$black;
  }

  .header-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  // "3 new commits since v1.3.6": a release is due.
  .release-nudge {
    font-size: 12px;
    color: theme.$orange_2;
  }
}

.app-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: theme.$gray_4;
  font-size: 14px;
}

.app-not-found {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: theme.$gray_4;
  font-size: 14px;
  gap: 12px;
}

.builder-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.main-panel {
  flex: 1;
  background-color: theme.$gray_1;
  overflow-y: auto;
  padding: 16px;
}

.applications-sidebar {
  width: 350px;
  background-color: theme.$white;
  border-left: 1px solid theme.$gray_3;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Metrics placeholder */
.metrics-section {
  margin-bottom: 16px;
}

.metrics-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  border: 2px dashed theme.$gray_3;
  border-radius: 4px;
  color: theme.$gray_4;
  font-size: 14px;
}

/* README section */
.readme-section {
  background: theme.$white;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  min-height: 200px;
}

.readme-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid theme.$gray_3;
}
.readme-header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
/* Create/Update app.yml for someone who isn't the owner: an outline button. */
.app-yml-btn {
  padding: 6px 12px;
  border: 1px solid theme.$gray_3;
  border-radius: 3px;
  background: theme.$white;
  font: inherit;
  font-size: 13px;
  color: theme.$gray_6;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_3;
  }
}
.app-yml-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.app-yml-earlier {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-left: 3px solid theme.$orange_1;

  p {
    margin: 0;
  }
}

.readme-title {
  font-weight: 600;
  font-size: 14px;
  color: theme.$black;
}

.readme-github-link {
  font-size: 13px;
  color: theme.$purple_3;
  text-decoration: none;
  font-weight: 500;

  &:hover:not(.disabled) {
    text-decoration: underline;
  }

  &.disabled {
    color: theme.$gray_4;
    cursor: not-allowed;
    user-select: none;
  }
}

.github-link-wrap {
  display: inline-flex;
}

.readme-empty {
  padding: 32px;
  text-align: center;
  color: theme.$gray_4;
  font-size: 14px;
}

// A private repository's own image, which needs GitHub sign-in to load.
.readme-content :deep(.readme-image-private) {
  display: inline-block;
  padding: 2px 6px;
  border: 1px dashed theme.$gray_3;
  border-radius: 3px;
  font-size: 12px;
  color: theme.$gray_4;
}
.readme-private {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;

  p {
    margin: 0;
  }
}

.readme-content {
  padding: 16px 24px;
  font-size: 14px;
  line-height: 1.6;
  color: theme.$black;

  :deep(h1) {
    font-size: 24px;
    font-weight: 600;
    margin: 24px 0 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid theme.$gray_3;
  }

  :deep(h2) {
    font-size: 20px;
    font-weight: 600;
    margin: 20px 0 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid theme.$gray_2;
  }

  :deep(h3) {
    font-size: 16px;
    font-weight: 600;
    margin: 16px 0 8px;
  }

  :deep(p) {
    margin: 0 0 12px;
  }

  :deep(code) {
    background: theme.$gray_1;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 13px;
    font-family: monospace;
  }

  :deep(pre) {
    background: theme.$gray_1;
    border: 1px solid theme.$gray_3;
    border-radius: 4px;
    padding: 12px 16px;
    overflow-x: auto;
    margin: 0 0 12px;

    code {
      background: none;
      padding: 0;
    }
  }

  :deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 12px;

    th,
    td {
      border: 1px solid theme.$gray_3;
      padding: 6px 12px;
      text-align: left;
      font-size: 13px;
    }

    th {
      background: theme.$gray_1;
      font-weight: 600;
    }
  }

  :deep(blockquote) {
    border-left: 4px solid theme.$gray_3;
    margin: 0 0 12px;
    padding: 4px 16px;
    color: theme.$gray_5;
  }

  :deep(a) {
    color: theme.$purple_3;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  :deep(img) {
    max-width: 100%;
    height: auto;
  }

  :deep(ul),
  :deep(ol) {
    margin: 0 0 12px;
    padding-left: 24px;
  }

  :deep(li) {
    margin-bottom: 4px;
  }

  :deep(hr) {
    border: none;
    border-top: 1px solid theme.$gray_3;
    margin: 16px 0;
  }
}

/* Sidebar accordion */
.sidebar-accordion {
  border-top: none;
}

/* Info panel */
.info-card {
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  padding: 12px;
  margin-bottom: 12px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 6px 0;

  &:not(:last-child) {
    border-bottom: 1px solid theme.$gray_2;
  }
}

.info-label {
  font-size: 12px;
  font-weight: 600;
  color: theme.$gray_5;
  flex-shrink: 0;
  min-width: 80px;
}

.info-value {
  font-size: 12px;
  color: theme.$black;
  text-align: right;
  word-break: break-word;
  text-transform: capitalize;
}

.info-url {
  font-family: monospace;
  font-size: 11px;
  text-transform: none;
  color: theme.$purple_3;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

/* Main-panel tabs */
.detail-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
}

.detail-tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 4px 8px;
  font-size: 13px;
  font-weight: 600;
  color: theme.$gray_5;
  cursor: pointer;

  &:hover {
    color: theme.$purple_3;
  }
}

.detail-tab-active {
  color: theme.$purple_3;
  border-bottom-color: theme.$purple_3;
}

/* app.yml tab body */
.manifest-detail {
  padding: 16px;
  overflow-y: auto;
}

.manifest-block {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
}

.manifest-block-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: theme.$black;
}

.manifest-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 8px 16px;
}

.manifest-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.manifest-field-label {
  font-size: 11px;
  font-weight: 600;
  color: theme.$gray_5;
}

.manifest-field-value {
  font-size: 13px;
  color: theme.$black;
  word-break: break-word;
}

.manifest-description {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: theme.$gray_5;
}

.manifest-summary-measured {
  margin: 8px 0 2px;
  padding-top: 8px;
  border-top: 1px dashed theme.$gray_3;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: theme.$gray_4;
}

.manifest-summary-row-measured .manifest-summary-value {
  color: theme.$teal_2;
  font-variant-numeric: tabular-nums;
}

.manifest-summary-hint {
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.4;
  color: theme.$gray_5;
}

.manifest-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.manifest-chip {
  font-size: 11px;
  padding: 2px 8px;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  color: theme.$gray_5;
}

.manifest-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.manifest-list-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 3px 0;
}

.manifest-link {
  font-size: 12px;
  color: theme.$purple_3;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.manifest-table-scroll {
  overflow-x: auto;
}

.manifest-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  th,
  td {
    text-align: left;
    padding: 6px 10px;
    border-bottom: 1px solid theme.$gray_2;
    vertical-align: top;
  }

  th {
    font-size: 11px;
    font-weight: 600;
    color: theme.$gray_5;
    white-space: nowrap;
    background: theme.$gray_1;
  }
}

.manifest-mono {
  font-family: monospace;
  font-size: 11px;
}

.manifest-ports {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.manifest-port-column {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.manifest-port-heading {
  font-size: 11px;
  font-weight: 600;
  color: theme.$gray_5;
}

.manifest-port {
  border: 1px solid theme.$gray_2;
  background: theme.$gray_1;
  padding: 8px 10px;
}

.manifest-port-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.manifest-required {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  color: theme.$purple_3;
}

.manifest-port-meta {
  margin-top: 2px;
  font-size: 11px;
  color: theme.$gray_5;
  word-break: break-word;
}

.manifest-port-desc {
  margin-top: 4px;
  font-size: 12px;
  color: theme.$gray_5;
}

.manifest-port-empty {
  font-size: 12px;
  color: theme.$gray_4;
}

/* The whole title is the control: "Show" sits next to "Raw app.yml"
   rather than flush right, where it was easy to miss and easy to click
   the heading instead. */
.manifest-raw-title {
  display: flex;
}

.manifest-raw-toggle {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: theme.$black;
  cursor: pointer;

  &:hover .manifest-raw-toggle-action,
  &:focus-visible .manifest-raw-toggle-action {
    text-decoration: underline;
  }
}

.manifest-raw-toggle-action {
  font-size: 12px;
  font-weight: 400;
  color: theme.$purple_3;
}

.manifest-raw {
  margin: 8px 0 0;
  padding: 12px;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  overflow-x: auto;
  font-family: monospace;
  font-size: 11px;
  line-height: 1.5;
  white-space: pre;
}

/* app.yml manifest card */
.manifest-card {
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  padding: 12px;
  margin-bottom: 12px;
}

.manifest-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.manifest-title {
  min-width: 0;
}

.manifest-info-icon {
  display: inline-flex;
  align-items: center;
  cursor: help;
}

.manifest-status {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
}

.manifest-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.manifest-status-ok .manifest-dot {
  background: #29b355;
}

.manifest-status-error .manifest-dot {
  background: #e94b4b;
}

.manifest-status-none .manifest-dot {
  background: theme.$gray_4;
}

.manifest-filename {
  font-family: monospace;
  font-size: 11px;
  color: theme.$black;
}

.manifest-status-text {
  color: theme.$gray_5;
}

.manifest-summary {
  margin-top: 8px;
  border-top: 1px solid theme.$gray_2;
  padding-top: 6px;
}

.manifest-summary-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 3px 0;
}

.manifest-summary-label {
  font-size: 11px;
  color: theme.$gray_5;
  flex-shrink: 0;
}

/* Names aren't capitalised word by word (info-value's text-transform). */
.info-value--name {
  text-transform: none;
}
.manifest-builder-link {
  display: inline-block;
  margin-top: 12px;
  font-size: 12px;
  color: theme.$purple_3;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.manifest-summary-value {
  font-size: 11px;
  color: theme.$black;
  text-align: right;
  word-break: break-word;
  text-transform: capitalize;
}

.manifest-error-detail {
  margin: 6px 0 0;
  font-size: 11px;
  font-family: monospace;
  color: #b3261e;
  word-break: break-word;
}

.manifest-empty-copy {
  margin: 6px 0 10px;
  font-size: 11px;
  line-height: 1.5;
  color: theme.$gray_5;

  code {
    font-family: monospace;
    font-size: 10px;
    background: theme.$gray_2;
    padding: 1px 4px;
  }
}

.manifest-cta {
  display: inline-block;
  margin-top: 8px;
  font-size: 12px;
  color: theme.$purple_3;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.manifest-cta-primary {
  display: block;
  margin-top: 0;
  padding: 6px 12px;
  background: theme.$purple_3;
  color: theme.$white;
  text-align: center;
  font-weight: 500;

  &:hover {
    background: theme.$purple_2;
    text-decoration: none;
  }
}

.manifest-cta-secondary {
  display: block;
  margin-top: 8px;
  font-size: 11px;
  text-align: center;
  color: theme.$gray_5;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.info-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.archive-actions {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}

.sidebar-access {
  background: theme.$white;
  border: 1px solid theme.$gray_3;
  padding: 14px 16px;
  margin-bottom: 12px;
  p {
    margin: 0 0 6px;
    font-size: 13px;
    line-height: 1.45;
    color: theme.$gray_5;
  }
}
.sidebar-access-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: theme.$gray_6;
}
.access-visibility strong {
  color: theme.$gray_6;
}
.access-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 2px 0 8px;
}
.access-chip {
  padding: 1px 7px;
  border-radius: 3px;
  background: theme.$gray_1;
  font-size: 12px;
  color: theme.$gray_5;
  &--more {
    color: theme.$gray_4;
  }
}
.access-manage {
  font-size: 13px;
  font-weight: 500;
  color: theme.$purple_3;
}
p.access-ask {
  margin: 0;
  font-size: 12px;
  color: theme.$gray_4;
}
.sidebar-danger {
  background: theme.$white;
  border: 1px solid theme.$gray_3;
  padding: 16px;
  margin-top: 12px;
}
.sidebar-danger-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: theme.$gray_6;
}
.status-tag {
  padding: 1px 8px;
  border-radius: 3px;
  background: theme.$green_tint;
  color: theme.$green_2;
  font-size: 12px;
  font-weight: 600;
  &--archived {
    background: theme.$gray_1;
    color: theme.$gray_5;
  }
}
.sidebar-permissions {
  background: theme.$white;
  border: 1px solid theme.$gray_3;
  padding: 16px;
  margin-top: 12px;
}

.text-link-btn {
  background: none;
  border: none;
  color: theme.$purple_3;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 0;
  text-align: left;

  &:hover {
    text-decoration: underline;
  }

  &.archive-btn {
    color: theme.$status_red;
  }
}

/* Status badge */
.status-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &.status-badge-sm {
    font-size: 9px;
    padding: 1px 6px;
  }

  &.badge-gray { background: theme.$gray_2; color: theme.$gray_5; }
  &.badge-blue { background: #dbeafe; color: #1d4ed8; }
  &.badge-green { background: rgba(23, 187, 98, 0.12); color: #17BB62; }
  &.badge-red { background: #fee2e2; color: #b91c1c; }
}

/* Versions */
.empty-versions {
  padding: 12px;
  color: theme.$gray_4;
  font-size: 12px;
  text-align: center;
}

.version-card {
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  padding: 10px 12px;
  margin-bottom: 10px;
}

.version-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.version-tag {
  font-family: monospace;
  font-size: 13px;
  font-weight: 600;
  color: theme.$black;
}

.version-meta {
  font-size: 11px;
  color: theme.$gray_4;
  margin-bottom: 8px;
}

.deployments-list {
  border-top: 1px solid theme.$gray_2;
  padding-top: 8px;
  margin-top: 4px;
}

.deployments-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: theme.$gray_4;
  margin-bottom: 6px;
}

.deployment-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  font-size: 11px;
}

.deployment-time {
  color: theme.$gray_5;
}

.versions-pagination {
  display: flex;
  justify-content: center;
  margin-top: 12px;
  --el-pagination-hover-color: #{theme.$purple_3};
}

/* A version's app.yml problems, as the metadata record generator lists them. */
.manifest-problems {
  padding: 12px 14px;
  border: 1px solid theme.$gray_2;
  background: theme.$gray_1;
}
.validation-list {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
}
.validation-item {
  padding: 8px 0;
  border-bottom: 1px solid theme.$gray_2;

  &:last-child {
    border-bottom: none;
  }
  .field-name {
    margin-bottom: 2px;
    font-size: 13px;
    font-weight: 500;
    color: theme.$gray_6;
  }
  .error-message {
    font-size: 12px;
    line-height: 1.4;
    color: theme.$gray_5;
  }
}
.manifest-license-note {
  margin-left: 8px;
  font-size: 12px;
  color: theme.$gray_4;
}
</style>

<!--
  The manifest tooltip is teleported outside this component, so its width has to
  be set from an unscoped block.
-->
<style lang="scss">
.manifest-tooltip.el-popper {
  max-width: 320px;
  line-height: 1.5;
}
</style>
