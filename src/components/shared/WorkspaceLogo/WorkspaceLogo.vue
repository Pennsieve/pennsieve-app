<template>
  <div
    v-if="!hideWhenMissing || logoUrl"
    class="workspace-logo"
    :class="{ 'is-natural': isNaturalFit }"
    :style="sizeStyle"
  >
    <img
      v-if="logoUrl && !hasFailed"
      class="workspace-logo-img"
      :src="logoUrl"
      :alt="`${workspaceName} logo`"
      loading="lazy"
      @error="hasFailed = true"
    />
    <div
      v-else-if="!hideWhenMissing"
      class="workspace-logo-initials"
      :class="{ 'is-plain': plainInitials }"
      :aria-label="workspaceName"
    >
      {{ initials }}
    </div>
  </div>
</template>

<script>
import { mapActions, mapGetters, mapState } from "vuex";
import { pathOr } from "ramda";

/**
 * Renders a workspace logo, falling back to the workspace initials when none
 * is set. Requests the smallest rendition that covers the slot rather than
 * always pulling the 512px master.
 */
export default {
  name: "WorkspaceLogo",

  props: {
    // Defaults to the active workspace.
    organization: {
      type: Object,
      default: null,
    },
    size: {
      type: Number,
      default: 40,
    },
    // "square" fits the logo inside a size x size box — right for nav rails,
    // avatars and lists, where a predictable footprint matters more than the
    // logo's shape.
    //
    // "natural" fixes the height at `size` and lets the width follow the
    // logo's own proportions, so a wordmark reads at full width instead of
    // being shrunk to fit a square. Use it where there is horizontal room.
    fit: {
      type: String,
      default: "square",
      validator: (value) => ["square", "natural"].includes(value),
    },
    // Caps the width in "natural" fit so an unusually wide mark cannot push
    // the surrounding layout around.
    maxWidth: {
      type: Number,
      default: 240,
    },
    // Forces the initials monogram even when a logo exists. For slots too
    // narrow to render a logo legibly — a wide wordmark in a 56px condensed
    // rail is a few pixels tall — where a monogram still says which workspace
    // you are in.
    initialsOnly: {
      type: Boolean,
      default: false,
    },
    // Drops the tinted chip behind the initials, leaving bare letters that
    // inherit currentColor. For placements that already sit on a solid
    // coloured surface, like the nav rail, where the chip is redundant.
    //
    // Not the default: the same monogram renders on the settings page over a
    // light background, where bare white letters would be invisible.
    plainInitials: {
      type: Boolean,
      default: false,
    },
    // Renders nothing when the workspace has no logo, instead of falling back
    // to an initials monogram. For surfaces that already name the workspace,
    // where a monogram just repeats it.
    hideWhenMissing: {
      type: Boolean,
      default: false,
    },
  },

  data() {
    return {
      hasFailed: false,
    };
  },

  computed: {
    ...mapState(["activeOrganization"]),
    ...mapGetters("workspaceLogoModule", ["logoUrlForSize"]),

    resolvedOrganization() {
      return this.organization || this.activeOrganization;
    },

    orgId() {
      return pathOr(null, ["organization", "id"], this.resolvedOrganization);
    },

    workspaceName() {
      return pathOr("", ["organization", "name"], this.resolvedOrganization);
    },

    logoUrl() {
      if (!this.orgId || this.initialsOnly) {
        return null;
      }
      // Retina displays need twice the CSS pixels to stay sharp. In natural
      // fit the rendered width can be several times the height, and the
      // rendition ladder bounds the *longer* side, so ask for a rendition
      // that covers the width rather than the height.
      const devicePixelRatio = window.devicePixelRatio || 1;
      const coveringDimension = this.isNaturalFit ? this.maxWidth : this.size;
      return this.logoUrlForSize(this.orgId, Math.ceil(coveringDimension * devicePixelRatio));
    },

    initials() {
      const words = this.workspaceName.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        return "?";
      }
      if (words.length === 1) {
        return words[0].slice(0, 2).toUpperCase();
      }
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    },

    isNaturalFit() {
      return this.fit === "natural";
    },

    sizeStyle() {
      const fontSize = `${Math.max(10, Math.round(this.size * 0.36))}px`;

      if (this.isNaturalFit) {
        // Height is fixed, width follows the image. min-width keeps the
        // initials fallback from collapsing when there is no logo.
        return {
          height: `${this.size}px`,
          minWidth: `${this.size}px`,
          maxWidth: `${this.maxWidth}px`,
          width: "auto",
          fontSize,
        };
      }

      return {
        width: `${this.size}px`,
        height: `${this.size}px`,
        fontSize,
      };
    },
  },

  watch: {
    orgId: {
      handler(orgId) {
        this.hasFailed = false;
        if (orgId) {
          this.fetchLogo({ orgId });
        }
      },
      immediate: true,
    },
  },

  methods: {
    ...mapActions("workspaceLogoModule", ["fetchLogo"]),
  },
};
</script>

<style scoped lang="scss">
@use "../../../styles/_theme.scss";

.workspace-logo {
  align-items: center;
  border-radius: 4px;
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  overflow: hidden;
}

/* Renditions keep the source's aspect ratio, so the slot decides the shape.
   contain rather than cover: a logo must never be cropped. */
.workspace-logo-img {
  height: 100%;
  object-fit: contain;
  width: 100%;
}

/* In natural fit the container's width is driven by its content, so the image
   cannot also be sized from the container — it would be circular. Height
   leads and width follows the image's own proportions.

   max-width caps it once the container hits its own maxWidth: without it a
   logo wider than that limit overflowed and was clipped by overflow: hidden,
   which is the one thing a logo must never be. object-fit then fits the image
   inside whatever box remains. */
.workspace-logo.is-natural .workspace-logo-img {
  height: 100%;
  max-width: 100%;
  object-fit: contain;
  width: auto;
}

.workspace-logo-initials {
  align-items: center;
  background: theme.$purple_1;
  border-radius: 4px;
  color: theme.$white;
  display: flex;
  font-weight: 600;
  height: 100%;
  justify-content: center;
  letter-spacing: 0.02em;
}

/* Bare letters on an already-solid surface. */
.workspace-logo-initials.is-plain {
  background: none;
  border-radius: 0;
  // Explicit white, not currentColor: the nav sets its own colour and the
  // monogram must stay legible against the solid rail regardless.
  color: theme.$white;
  line-height: 1;
  user-select: none;
  width: 100%;
}
</style>
