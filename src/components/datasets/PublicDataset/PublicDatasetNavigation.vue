<template>
  <div class="bf-navigation secondary" :class="[secondaryNavCondensed ? 'condensed' : '']">
    <div class="source-strip" :class="`source-strip--${sourceType}`">
      <span class="source-strip-label">
        {{ sourceMeta.label }} · Read-only
      </span>
    </div>

    <div class="menu-wrap">
      <div class="heading-wrap">
        <template v-if="!secondaryNavCondensed">
          <router-link :to="{ name: 'public-datasets' }" class="back-link">
            <IconArrowLeft :width="16" :height="16" color="currentColor" />
            <span>Public Datasets</span>
          </router-link>
          <button
            class="btn-expand-collapse"
            name="Collapse Secondary Menu"
            @click="toggleMenu"
          >
            <IconNavCollapse color="#71747C" />
          </button>
        </template>
        <template v-else>
          <button
            class="btn-expand-collapse"
            name="Expand Secondary Menu"
            @click="toggleMenu"
          >
            <IconNavExpand color="#fff" :height="32" :width="32" />
          </button>
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
import IconNavCollapse from "@/components/icons/IconNavCollapse.vue";
import IconNavExpand from "@/components/icons/IconNavExpand.vue";
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
    IconNavCollapse,
    IconNavExpand,
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
    this.toggleSecondaryNav(false);
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
    padding: 16px 0;
    justify-content: center;
  }
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
