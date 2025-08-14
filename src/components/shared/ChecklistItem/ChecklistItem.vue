<template>
  <div class="dataset-discover-checklist-item">
    <div class="icon-link-wrap">
      <IconDoneCheckCircle v-if="isComplete" class="mr-8 checked" :height="20" :width="20" />
      <IconInfo v-else class="mr-8" :height="20" :width="20" />

      <div class="link-wrap mr-8">
        <router-link v-if="cta" :to="route" @click.native="$emit('click-link', $event)">
          {{ cta }}
        </router-link>
        <template v-if="enableLink">
          <a :href="externalLinkUrl" target="_blank">
            <strong>
              {{ externalLinkText }}
            </strong>
          </a>
        </template>
        <template v-else>
          <strong>
            {{ externalLinkText }}
          </strong>
        </template>

        &nbsp; &mdash;
      </div>
    </div>

    <div class="description">
      <slot />
    </div>
  </div>
</template>

<script>
import IconInfo from "../../icons/IconInfo.vue";
import IconDoneCheckCircle from "../../icons/IconDoneCheckCircle.vue";
export default {
  name: "ChecklistItem",
  components: { IconDoneCheckCircle, IconInfo },
  props: {
    isComplete: {
      type: Boolean,
      default: false,
    },
    icon: {
      type: String,
      default: "",
    },
    cta: {
      type: String,
      default: "",
    },
    route: {
      type: Object,
      default: () => {
        return {};
      },
    },
    externalLinkUrl: {
      type: String,
      default: "",
    },
    externalLinkText: {
      type: String,
      default: "",
    },
    enableLink: {
      type: Boolean,
      default: true,
    }
  },
};
</script>

<style lang="scss" scoped>
@import "./src/assets/_variables.scss";

.checked {
  color: $green_2;
}

.dataset-discover-checklist-item {
  align-items: center;
  border-top: 1px solid $gray_2;
  display: flex;
  padding: 10px 16px;
  &:first-child {
    border: none;
  }
  a {
    font-weight: 500;
  }
}
.icon-link-wrap {
  align-items: center;
  display: flex;
}

.description {
  flex: 1;
}
</style>
