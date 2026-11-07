<script setup>
// A data platform's mark (its module's mark, platforms/): its logo or an
// icon, on a tile of its tone: brand (Pennsieve purple), teal, light (a
// logo on white, inset), dark (a logo made for a dark ground) or fill (a
// square logo with its own background).
import { computed } from "vue";
import { PLATFORMS } from "./platforms";

const props = defineProps({
  platform: { type: String, required: true },
  size: { type: Number, default: 36 },
});
const mark = computed(() => PLATFORMS[props.platform]?.mark || {});
</script>

<template>
  <span
    class="pm"
    :class="`pm--${mark.tone || 'light'}`"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  >
    <img v-if="mark.logo" class="pm__logo" :src="mark.logo" alt="" />
    <component :is="mark.icon" v-else-if="mark.icon" v-bind="mark.iconProps ? mark.iconProps(size) : {}" />
  </span>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

.pm {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border-radius: 8px;
}
.pm--brand {
  background: theme.$purple_3;
  color: theme.$white;
}
.pm--teal {
  background: theme.$teal_2;
  color: theme.$white;
}
.pm--light,
.pm--dark {
  .pm__logo {
    width: 80%;
    height: 80%;
  }
}
.pm--light {
  border: 1px solid theme.$gray_2;
  background: theme.$white;
}
.pm--dark {
  background: #000;
  .pm__logo {
    width: 64%;
    height: 64%;
  }
}
.pm--fill {
  overflow: hidden;
}
.pm__logo {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
