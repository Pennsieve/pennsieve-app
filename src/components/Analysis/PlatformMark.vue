<script setup>
// A data platform's mark: the Pennsieve mark for Pennsieve Discover, a
// brain for OpenNeuro, SPARC's and Epilepsy.Science's own logos (portals
// Pennsieve runs), DANDI's (from its Apache-2.0 repository), and a neutral cloud and data store for the Registry of
// Open Data on AWS (not AWS's logo).
import IconPennsieveMark from "@/components/icons/IconPennsieveMark.vue";
import IconOpenData from "@/components/icons/IconOpenData.vue";
import IconBrain from "@/components/icons/IconBrain.vue";
import sparcLogo from "@/assets/images/logos/sparc-logo.svg";
import epilepsyScienceLogo from "@/assets/images/logos/epilepsy-science-logo.svg";
import dandiLogo from "@/assets/images/logos/dandi-logo.svg";

const LOGOS = { sparc: sparcLogo, epilepsyScience: epilepsyScienceLogo, dandi: dandiLogo };

defineProps({
  platform: { type: String, required: true }, // discover | openNeuro | sparc | epilepsyScience | openData | dandi
  size: { type: Number, default: 36 },
});
</script>

<template>
  <span
    class="pm"
    :class="`pm--${platform}`"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  >
    <!-- The mark is 100 x 114: a little taller than wide. -->
    <IconPennsieveMark
      v-if="platform === 'discover'"
      :width="Math.round(size * 0.42)"
      :height="Math.round(size * 0.48)"
      color="currentColor"
    />
    <IconBrain v-else-if="platform === 'openNeuro'" :width="Math.round(size * 0.6)" :height="Math.round(size * 0.6)" />
    <img v-else-if="LOGOS[platform]" class="pm__logo" :src="LOGOS[platform]" alt="" />
    <IconOpenData v-else :width="Math.round(size * 0.6)" :height="Math.round(size * 0.6)" />
  </span>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

.pm {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}
.pm--discover {
  background: theme.$purple_3;
  color: theme.$white;
}
.pm--openNeuro {
  background: theme.$status_purple;
  color: theme.$white;
}
/* The SPARC and DANDI wordmarks on white, inset; Epilepsy.Science's mark
   is square with its own background, so it fills the tile. */
.pm--sparc,
.pm--dandi {
  box-sizing: border-box;
  border: 1px solid theme.$gray_2;
  background: theme.$white;

  .pm__logo {
    width: 80%;
    height: 80%;
  }
}
.pm--epilepsyScience {
  overflow: hidden;
}
.pm__logo {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.pm--openData {
  background: theme.$teal_2;
  color: theme.$white;
}
</style>
