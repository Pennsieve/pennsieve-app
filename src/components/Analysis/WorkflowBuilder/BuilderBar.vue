<script setup>
// The builder's one bar: the workflow's name and description, edited in
// place; whether it's ready to save, with what to fix; Save; and a menu with
// Start over. Teleported into the Workflows tab's toolbar when the builder is
// shown there, so the canvas starts right below one bar.
import { computed, nextTick, ref } from "vue";
import { MoreFilled } from "@element-plus/icons-vue";
import BfButton from "../../shared/bf-button/BfButton.vue";
import { readinessLabel } from "./builderReadiness";

const props = defineProps({
  name: { type: String, default: "" },
  description: { type: String, default: "" },
  // builderReadiness() result
  readiness: { type: Object, required: true },
  saving: { type: Boolean, default: false },
  saveLabel: { type: String, default: "Save" },
});
// select(item): show what an item is about (its node); start-over
const emit = defineEmits(["update:name", "update:description", "save", "start-over", "select"]);

const nameRef = ref(null);
const showList = ref(false);
const label = computed(() => readinessLabel(props.readiness));
const state = computed(() =>
  props.readiness.blocking.length ? "block" : props.readiness.warnings.length ? "warn" : "ready"
);
const saveTitle = computed(() =>
  props.readiness.blocking.length ? `Before saving: ${props.readiness.blocking.map((i) => i.text).join("; ")}` : ""
);

function onItem(item) {
  showList.value = false;
  if (item.id === "name") {
    nextTick(() => nameRef.value?.focus());
    return;
  }
  emit("select", item);
}

defineExpose({ focusName: () => nameRef.value?.focus() });
</script>

<template>
  <div class="bb">
    <div class="bb-titles">
      <input
        ref="nameRef"
        class="bb-name"
        :value="name"
        placeholder="Untitled workflow"
        aria-label="Workflow name"
        maxlength="120"
        @input="emit('update:name', $event.target.value)"
      />
      <input
        class="bb-desc"
        :value="description"
        placeholder="Add a description"
        aria-label="Workflow description"
        @input="emit('update:description', $event.target.value)"
      />
    </div>

    <el-popover v-model:visible="showList" placement="bottom-end" :width="340" trigger="click">
      <template #reference>
        <button type="button" class="bb-ready" :class="`is-${state}`" :aria-expanded="showList">
          <span class="bb-dot" />
          {{ label }}
          <span v-if="readiness.items.length" class="bb-caret">▾</span>
        </button>
      </template>
      <ul v-if="readiness.items.length" class="bb-list">
        <li v-for="item in readiness.items" :key="item.id">
          <button type="button" class="bb-item" :class="`is-${item.level}`" @click="onItem(item)">
            <span class="bb-item-dot" />
            {{ item.text }}
          </button>
        </li>
      </ul>
      <p v-else class="bb-empty">Nothing to fix. Save when you're ready.</p>
    </el-popover>

    <el-tooltip :content="saveTitle" :disabled="!saveTitle" placement="bottom">
      <span>
        <bf-button :disabled="!readiness.ready || saving" :processing="saving" @click="emit('save')">
          {{ saveLabel }}
        </bf-button>
      </span>
    </el-tooltip>

    <el-dropdown trigger="click" @command="(c) => c === 'start-over' && emit('start-over')">
      <button type="button" class="bb-more" aria-label="More">
        <el-icon><MoreFilled /></el-icon>
      </button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="start-over">Start over…</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.bb {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}
.bb-titles {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.bb-name,
.bb-desc {
  width: 100%;
  max-width: 520px;
  padding: 1px 4px;
  margin-left: -4px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: none;
  font: inherit;
  color: theme.$gray_6;
  outline: none;

  &:hover {
    border-color: theme.$gray_2;
  }
  &:focus {
    border-color: theme.$purple_1;
    background: theme.$white;
  }
  &::placeholder {
    color: theme.$gray_4;
  }
}
.bb-name {
  font-size: 15px;
  font-weight: 600;
}
.bb-desc {
  font-size: 12px;
  color: theme.$gray_5;
}
.bb-ready {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 4px 10px;
  border: 1px solid theme.$gray_2;
  border-radius: 12px;
  background: theme.$white;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  color: theme.$gray_6;
  cursor: pointer;

  &:hover {
    border-color: theme.$purple_1;
  }
}
.bb-dot,
.bb-item-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: theme.$status_green;
}
.bb-ready.is-block .bb-dot,
.bb-item.is-block .bb-item-dot {
  background: theme.$status_red;
}
.bb-ready.is-warn .bb-dot,
.bb-item.is-warn .bb-item-dot {
  background: #f59e0b;
}
.bb-caret {
  font-size: 10px;
  color: theme.$gray_4;
}
.bb-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.bb-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 6px 4px;
  border: none;
  border-radius: 3px;
  background: none;
  font: inherit;
  font-size: 13px;
  color: theme.$gray_6;
  text-align: left;
  cursor: pointer;

  .bb-item-dot {
    margin-top: 5px;
  }
  &:hover {
    background: theme.$gray_1;
  }
}
.bb-empty {
  margin: 0;
  font-size: 13px;
  color: theme.$gray_5;
}
.bb-more {
  display: flex;
  align-items: center;
  padding: 6px;
  border: none;
  border-radius: 3px;
  background: none;
  color: theme.$gray_5;
  cursor: pointer;

  &:hover {
    background: theme.$gray_0;
    color: theme.$purple_3;
  }
}
</style>
