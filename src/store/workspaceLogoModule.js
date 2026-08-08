import { useGetToken } from "@/composables/useGetToken";
import { useHandleXhrError } from "@/mixins/request/request_composable";

/**
 * Workspace logo state.
 *
 * Logo urls are content-addressed and immutable, so they are cached per
 * workspace id for the life of the session. A replacement returns new urls and
 * overwrites the entry, which is why nothing here needs cache-busting.
 */
const initialState = () => ({
  // { [organizationId]: { url, urls, width, height, updatedAt } | null }
  logosByOrgId: {},
  isUploading: false,
});

export const state = initialState();

export const mutations = {
  CLEAR_STATE(state) {
    const _initialState = initialState();
    Object.keys(_initialState).forEach((key) => (state[key] = _initialState[key]));
  },

  // A null logo is a meaningful, cacheable answer: this workspace has none.
  SET_LOGO(state, { orgId, logo }) {
    state.logosByOrgId = { ...state.logosByOrgId, [orgId]: logo };
  },

  SET_IS_UPLOADING(state, isUploading) {
    state.isUploading = isUploading;
  },
};

export const actions = {
  async fetchLogo({ commit, state, rootState }, { orgId, force = false } = {}) {
    const organizationId = orgId || rootState.activeOrganization?.organization?.id;
    if (!organizationId) {
      return null;
    }
    if (!force && organizationId in state.logosByOrgId) {
      return state.logosByOrgId[organizationId];
    }

    try {
      const token = await useGetToken();
      // organization_id is required, not optional: it is an identity source
      // for the authorizer, which resolves the claim against that workspace
      // and rejects non-members. Omitting it makes API Gateway reject the
      // request before the service is reached.
      const response = await fetch(
        `${rootState.config.api2Url}/workspaces/logo?organization_id=${encodeURIComponent(
          organizationId
        )}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.status === 404) {
        commit("SET_LOGO", { orgId: organizationId, logo: null });
        return null;
      }
      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const logo = await response.json();
      commit("SET_LOGO", { orgId: organizationId, logo });
      return logo;
    } catch (err) {
      // A missing logo must never block rendering the workspace chrome, so
      // this resolves to "no logo" rather than surfacing an error.
      commit("SET_LOGO", { orgId: organizationId, logo: null });
      return null;
    }
  },

  /**
   * Upload a new logo. `blob` is the raw image; the endpoint takes bytes
   * directly rather than a multipart form.
   */
  async uploadLogo({ commit, rootState }, { blob, contentType = "image/png" }) {
    const organizationId = rootState.activeOrganization?.organization?.id;
    commit("SET_IS_UPLOADING", true);

    try {
      const token = await useGetToken();
      // organization_id names the target explicitly. Without it the service
      // resolved the workspace from the session claim, which can lag the
      // workspace the UI is showing - so an upload could land on a different
      // workspace than the one being edited, and be cached under this one.
      const response = await fetch(
        `${rootState.config.api2Url}/workspaces/logo?organization_id=${encodeURIComponent(
          organizationId
        )}`,
        {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": contentType,
        },
        body: blob,
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || response.statusText);
      }

      const logo = await response.json();
      commit("SET_LOGO", { orgId: organizationId, logo });
      return logo;
    } finally {
      commit("SET_IS_UPLOADING", false);
    }
  },

  async deleteLogo({ commit, rootState }) {
    const organizationId = rootState.activeOrganization?.organization?.id;

    try {
      const token = await useGetToken();
      // Named explicitly, for the same reason as upload: deleting from the
      // session claim's workspace could remove the wrong workspace's logo.
      const response = await fetch(
        `${rootState.config.api2Url}/workspaces/logo?organization_id=${encodeURIComponent(
          organizationId
        )}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok && response.status !== 404) {
        throw new Error(response.statusText);
      }

      commit("SET_LOGO", { orgId: organizationId, logo: null });
    } catch (err) {
      useHandleXhrError(err);
      throw err;
    }
  },
};

export const getters = {
  /**
   * Url of the logo rendition closest to (and not smaller than) the requested
   * size, so a 64px slot does not download the 512px master.
   */
  logoUrlForSize: (state) => (orgId, size = 512) => {
    const logo = state.logosByOrgId[orgId];
    if (!logo || !logo.urls) {
      return null;
    }

    const available = Object.keys(logo.urls)
      .map(Number)
      .sort((a, b) => a - b);
    const match = available.find((s) => s >= size);

    return logo.urls[String(match ?? available[available.length - 1])] || logo.url;
  },

  activeWorkspaceLogo: (state, _getters, rootState) => {
    const orgId = rootState.activeOrganization?.organization?.id;
    return orgId ? state.logosByOrgId[orgId] : null;
  },
};

const workspaceLogoModule = {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
};

export default workspaceLogoModule;
