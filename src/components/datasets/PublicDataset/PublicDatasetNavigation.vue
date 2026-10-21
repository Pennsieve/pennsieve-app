<template>
  <div class="bf-navigation secondary" :class="[secondaryNavCondensed ? 'condensed' : '']">
    <div class="source-strip" :class="`source-strip--${sourceType}`">
      <span class="source-strip-label">
        {{ sourceMeta.label }} · Read-only
      </span>
    </div>

    <button
      type="button"
      class="collapse-handle"
      :aria-label="secondaryNavCondensed ? 'Expand secondary navigation' : 'Collapse secondary navigation'"
      :aria-expanded="!secondaryNavCondensed"
      @click="toggleMenu"
    >
      <IconArrowLeft
        class="collapse-chevron"
        :class="{ 'is-flipped': secondaryNavCondensed }"
        :width="6"
        :height="10"
        color="currentColor"
      />
    </button>

    <div class="menu-wrap">
      <div class="heading-wrap">
        <template v-if="secondaryNavCondensed">
          <div
            class="dot condensed-status"
            :class="`condensed-status--${sourceType}`"
            :title="`${sourceMeta.label} · Read-only`"
          />
        </template>
        <template v-else>
          <router-link :to="{ name: 'public-datasets' }" class="back-link">
            <IconArrowLeft :width="16" :height="16" color="currentColor" />
            <span>Public Datasets</span>
          </router-link>
        </template>
      </div>

      <hr v-if="!secondaryNavCondensed" />

      <bf-navigation-item
        :link="{ name: 'public-dataset-overview', params: { datasetId } }"
        label="Overview"
        :secondary="true"
        :condensed="secondaryNavCondensed"
      >
        <template #icon>
          <IconOverview color="currentColor" :height="20" :width="20" />
        </template>
      </bf-navigation-item>

      <bf-navigation-item
        :link="{ name: 'public-dataset-files', params: { datasetId } }"
        label="Files"
        :secondary="true"
        :condensed="secondaryNavCondensed"
      >
        <template #icon>
          <IconFiles color="currentColor" :height="20" :width="20" />
        </template>
      </bf-navigation-item>

      <bf-navigation-item
        :link="{ name: 'public-dataset-metadata', params: { datasetId } }"
        label="Metadata"
        :secondary="true"
        :condensed="secondaryNavCondensed"
      >
        <template #icon>
          <IconGraph color="currentColor" :height="20" :width="20" />
        </template>
      </bf-navigation-item>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters, mapActions } from "vuex";
import BfNavigationItem from "@/components/bf-navigation/bf-navigation-item/BfNavigationItem.vue";
import IconOverview from "@/components/icons/IconOverview.vue";
import IconFiles from "@/components/icons/IconFiles.vue";
import IconGraph from "@/components/icons/IconGraph.vue";
import IconArrowLeft from "@/components/icons/IconArrowLeft.vue";
import { useReadOnlyDatasetStore } from "@/stores/readOnlyDatasetStore.js";

const SOURCE_META = {
  discover: { label: "Public Dataset" },
  view: { label: "Shared View" },
};

export default {
  name: "PublicDatasetNavigation",

  components: {
    BfNavigationItem,
    IconOverview,
    IconFiles,
    IconGraph,
    IconArrowLeft,
  },

  setup() {
    const store = useReadOnlyDatasetStore();
    return { store };
  },

  computed: {
    ...mapState(["secondaryNavCondensed"]),
    ...mapGetters(["primaryNavOpen"]),

    datasetId() {
      return this.$route.params.datasetId;
    },
    sourceType() {
      return this.store.current?.sourceType || "discover";
    },
    sourceMeta() {
      return SOURCE_META[this.sourceType] || SOURCE_META.discover;
    },
  },

  mounted() {
    this.toggleSecondaryNav(true);
  },

  beforeUnmount() {
    // Restore the primary rail on the way out. Collapsing this one sets
    // primaryNavOpen false, and App.vue renders the primary behind
    // v-if="primaryNavOpen" - so leaving it false meant navigating away from a
    // collapsed rail landed on a page with no navigation at all.
    this.toggleSecondaryNav(false);
    this.togglePrimaryNav(true);
  },

  methods: {
    ...mapActions(["toggleSecondaryNav", "togglePrimaryNav", "condenseSecondaryNav"]),

    toggleMenu() {
      this.togglePrimaryNav(!this.primaryNavOpen);
      this.condenseSecondaryNav(!this.secondaryNavCondensed);
    },
  },
};
</script>

<style scoped lang="scss">
@use "../../../styles/theme";
@use "../../../styles/navigation";

.bf-navigation {
  background: theme.$gray_1;
  box-shadow: -1px 0 0 rgba(64, 69, 84, 0.2) inset;
  padding-right: 1px;
  z-index: 99;

  // When condensed, BfNavigationItem forces white icons (the standard nav's
  // condensed rail is dark) — so match that with a dark background. Widen the
  // rail by the strip width (18px) on top of the standard 56px so the icons
  // sit beside the source strip rather than under it.
  &.condensed {
    box-shadow: none;
    padding-right: 0;
    background: theme.$purple_3;
    width: 74px;
  }
}

.menu-wrap {
  margin-top: 0 !important;
  // Offset content by the source-strip width in both states so nothing
  // sits under the strip (condensed rail is widened to compensate).
  padding-left: 18px;
}

.source-strip {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 18px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 1px 0 4px rgba(64, 69, 84, 0.2);
  z-index: 1;

  // Gentle sheen: a soft highlight that sweeps down, then rests.
  &::after {
    content: "";
    position: absolute;
    left: 0;
    top: -35%;
    width: 100%;
    height: 35%;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.3) 50%,
      rgba(255, 255, 255, 0) 100%
    );
    animation: source-strip-sheen 7s ease-in-out infinite;
  }
}

.source-strip--discover {
  background: linear-gradient(180deg, theme.$purple_2 0%, theme.$teal_1 100%);
}

.source-strip--view {
  background: linear-gradient(180deg, theme.$purple_3 0%, theme.$purple_1 100%);
}

.source-strip-label {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  color: theme.$white;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  white-space: nowrap;
}

// Sweep through in the first third of the cycle, then hold off-screen.
@keyframes source-strip-sheen {
  0% {
    top: -35%;
  }
  30%,
  100% {
    top: 135%;
  }
}

hr {
  background-color: theme.$gray_2;
  height: 1px;
  border: 0;
  margin: 0 24px;
}

.heading-wrap {
  box-sizing: border-box;
  padding: 21px 24px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  white-space: nowrap;
  font-size: 14px;

  .condensed & {
    // Cancels the -6px navigation.scss puts on .menu-wrap when condensed.
    // That offset aligns icons in the standard 56px rail; this one is 74px
    // with an 18px source strip, so inheriting it left the marker 6px off
    // centre of the area beside the strip.
    margin-left: 6px;
    padding: 16px 0;
    justify-content: center;
  }
}

// Marks the context in the condensed rail, where the back link cannot fit.
// Coloured per source, matching the strip down the edge, since a public
// dataset has no workspace theme to draw from.
.dot.condensed-status {
  border-radius: 50%;
  display: inline-block;
  height: 14px;
  width: 14px;
}

.condensed-status--discover {
  background: theme.$teal_1;
}

.condensed-status--view {
  background: theme.$purple_1;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: theme.$purple_2;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.btn-expand-collapse {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
</style>
