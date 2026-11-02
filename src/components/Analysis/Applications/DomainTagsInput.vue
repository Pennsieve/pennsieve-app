<template>
  <div class="domain-tags-input">
    <!-- Preferred tags first (a domain's own, colouring an app's card), then
         the aliases that colour it the same way, then the research fields
         (a filter, no colour). -->
    <el-select
      :model-value="modelValue"
      multiple
      filterable
      allow-create
      default-first-option
      :reserve-keyword="false"
      :filter-method="(q) => (tagQuery = q)"
      :placeholder="placeholder"
      class="full"
      popper-class="tag-options"
      @update:model-value="setTags"
      @visible-change="(open) => open || (tagQuery = '')"
    >
      <template #tag>
        <el-tag
          v-for="t in modelValue"
          :key="t"
          closable
          disable-transitions
          class="domain-tag-chip"
          :style="tagChipStyle(t)"
          @close="removeTag(t)"
        >{{ t }}</el-tag>
      </template>
      <el-option-group v-if="preferredOptions.length" label="Preferred">
        <el-option v-for="o in preferredOptions" :key="o.tag" :label="o.tag" :value="o.tag">
          <span class="tag-option">
            <span class="tag-dot" :style="{ background: domainColors(o.domain).accent }" />
            <svg class="tag-icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="o.domain.icon" /></svg>
            <span class="tag-name">{{ o.tag }}</span>
            <span class="tag-meta">{{ o.domain.label }}</span>
          </span>
        </el-option>
      </el-option-group>
      <el-option-group v-if="aliasOptions.length" label="Also recognised">
        <el-option v-for="o in aliasOptions" :key="o.tag" :label="o.tag" :value="o.tag">
          <span class="tag-option tag-option--alias">
            <span class="tag-name">{{ o.tag }}</span>
            <span class="tag-meta">→ {{ o.domain.label }}</span>
          </span>
        </el-option>
      </el-option-group>
      <el-option-group v-if="fieldOptions.length" label="Research field">
        <el-option v-for="o in fieldOptions" :key="o.tag" :label="o.tag" :value="o.tag">
          <span class="tag-option tag-option--field">
            <span class="tag-name">{{ o.tag }}</span>
            <span class="tag-meta">{{ o.field.label }}</span>
          </span>
        </el-option>
      </el-option-group>
    </el-select>
    <slot />
    <!-- A domain's nudge first, then (where the tags colour a card) a grey
         card's note, then a field's nudge: the colour matters more than the
         filter. -->
    <p v-if="tagNudge?.domain" class="tag-note">
      Also add <strong>{{ tagNudge.tag }}</strong>, the preferred tag for {{ tagNudge.label }}?
      <button type="button" class="tag-note-action" @click="setTags([...modelValue, tagNudge.tag])">Add</button>
    </p>
    <p v-else-if="colours && !hasDomainTag(modelValue)" class="tag-note">
      No domain tag, so the card is grey. Pick one from Preferred.
    </p>
    <p v-else-if="tagNudge" class="tag-note">
      Also add <strong>{{ tagNudge.tag }}</strong>, the tag for {{ tagNudge.label }}?
      <button type="button" class="tag-note-action" @click="setTags([...modelValue, tagNudge.tag])">Add</button>
    </p>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { canonicalTag, preferredTagGroups, tagOptionMatches, tagDomainNudge, hasDomainTag, domainOfTag, domainColors } from "./appDomains";

/**
 * Tags saying what something is for (appDomains.js): the app.yml builder's
 * and a workflow's. The suggestions are the domains', their aliases and the
 * research fields'; anything else can be typed. The default slot goes
 * between the field and its notes (errors).
 */
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  placeholder: { type: String, default: "Pick a preferred tag, or type your own" },
  // Whether the tags colour a card (an app's): then a note says when none
  // does.
  colours: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue"]);

// A typed tag lands on the suggestion it spells ("EEG" -> "eeg"), so the
// same thing gets one tag everywhere.
function setTags(tags) {
  emit("update:modelValue", [...new Set((tags || []).map(canonicalTag).filter(Boolean))]);
}
const removeTag = (tag) => setTags(props.modelValue.filter((t) => t !== tag));

// The tag options, filtered by what's typed; preferred tags also match their
// domain's aliases, so "spike" offers spike-sorting first.
const tagQuery = ref("");
const tagGroups = preferredTagGroups();
const preferredOptions = computed(() => tagGroups.preferred.filter((o) => tagOptionMatches(o, tagQuery.value, { preferred: true })));
const aliasOptions = computed(() => tagGroups.aliases.filter((o) => tagOptionMatches(o, tagQuery.value)));
const fieldOptions = computed(() => tagGroups.fields.filter((o) => tagOptionMatches(o, tagQuery.value, { preferred: true })));
const tagNudge = computed(() => tagDomainNudge(props.modelValue || []));
// A chip in its domain's colours, as on the Apps tab; neutral without one.
const tagChipStyle = (tag) => {
  const d = domainOfTag(tag);
  if (!d) return {};
  const c = domainColors(d);
  return { "--el-tag-bg-color": c.bg, "--el-tag-border-color": c.line, "--el-tag-text-color": c.ink };
};
</script>

<style scoped lang="scss">
@use "../../../styles/theme";

.full {
  width: 100%;
}
.domain-tag-chip {
  margin: 2px 4px 2px 0;
  border-radius: 3px;
  font-size: 12px;
}
.tag-note {
  margin: 6px 0 0;
  font-size: 12px;
  color: theme.$gray_5;
}
.tag-note-action {
  margin-left: 4px;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: theme.$purple_3;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}
</style>

<style lang="scss">
@use "../../../styles/theme";

/* The tag dropdown is teleported, so its option styles can't be scoped. */
.tag-options {
  .tag-option {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }
  .tag-dot {
    width: 8px;
    height: 8px;
    flex-shrink: 0;
    border-radius: 50%;
  }
  .tag-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    fill: none;
    stroke: theme.$gray_5;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .tag-name {
    color: theme.$gray_6;
  }
  .tag-meta {
    margin-left: auto;
    padding-left: 12px;
    font-size: 12px;
    color: theme.$gray_4;
  }
  .tag-option--alias .tag-name {
    color: theme.$gray_5;
  }
}
</style>
