<script setup>
// A data platform's mark: the Pennsieve mark for Pennsieve Discover, and a
// neutral cloud and data store for the Registry of Open Data on AWS (not
// AWS's logo).
import IconPennsieveMark from "@/components/icons/IconPennsieveMark.vue";
import IconOpenData from "@/components/icons/IconOpenData.vue";
import IconBrain from "@/components/icons/IconBrain.vue";

defineProps({
  platform: { type: String, required: true }, // discover | openNeuro | openData
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
.pm--openData {
  background: theme.$teal_2;
  color: theme.$white;
}
</style>
