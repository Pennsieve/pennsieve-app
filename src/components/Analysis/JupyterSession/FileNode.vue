<script>
// Recursive file-tree row. Declared with an explicit name so it can reference
// itself in its own template (Vue resolves self-recursive components by name).
export default { name: "FileNode" };
</script>

<script setup>
defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  iconOf: { type: Function, required: true },
  fmtSize: { type: Function, required: true },
  fmtTime: { type: Function, required: true },
});

const emit = defineEmits(["toggle", "copy", "download", "insert", "open"]);

const isNotebook = (node) =>
  node.type === "notebook" || /\.ipynb$/i.test(node.name || "");
</script>

<template>
  <li class="fn">
    <div
      class="fn__row"
      :style="{ paddingLeft: depth * 14 + 8 + 'px' }"
      :title="`${node.path}${node.size != null ? ' · ' + fmtSize(node.size) : ''}${node.last_modified ? ' · ' + fmtTime(node.last_modified) : ''}`"
      @click="node.type === 'directory' ? emit('toggle', node) : emit('insert', node.path)"
    >
      <span class="fn__caret">
        <template v-if="node.type === 'directory'">{{ node.open ? "▾" : "▸" }}</template>
      </span>
      <span class="fn__icon">{{ iconOf(node) }}</span>
      <span class="fn__name">{{ node.name }}</span>
      <span
        v-if="depth === 0 && node.type === 'directory' && node.name === 'output'"
        class="fn__tag fn__tag--out"
        title="Save files here to pass them to the next workflow step (OUTPUT_DIR)"
        >→ next step</span
      >
      <span
        v-else-if="depth === 0 && node.type === 'directory' && node.name === 'input'"
        class="fn__tag fn__tag--in"
        title="Files staged from previous workflow steps (INPUT_DIR)"
        >← previous step</span
      >
      <span v-if="node.type !== 'directory' && node.size != null" class="fn__size">
        {{ fmtSize(node.size) }}
      </span>

      <span class="fn__actions" @click.stop>
        <button
          v-if="isNotebook(node)"
          class="fn__act fn__act--open"
          title="Open in notebook editor"
          @click="emit('open', node.path)"
        >
          ↪
        </button>
        <button class="fn__act" title="Insert path into a cell" @click="emit('insert', node.path)">↩</button>
        <button class="fn__act" title="Copy path" @click="emit('copy', node)">⧉</button>
        <button
          v-if="node.type !== 'directory'"
          class="fn__act"
          title="Download"
          @click="emit('download', node)"
        >
          ⬇
        </button>
      </span>
    </div>

    <span v-if="node.loading" class="fn__loading" :style="{ paddingLeft: (depth + 1) * 14 + 22 + 'px' }">
      loading…
    </span>

    <ul v-if="node.open && node.children && node.children.length" class="fn__children">
      <FileNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        :icon-of="iconOf"
        :fmt-size="fmtSize"
        :fmt-time="fmtTime"
        @toggle="emit('toggle', $event)"
        @copy="emit('copy', $event)"
        @download="emit('download', $event)"
        @insert="emit('insert', $event)"
        @open="emit('open', $event)"
      />
    </ul>
    <span
      v-else-if="node.open && node.children && !node.children.length"
      class="fn__empty"
      :style="{ paddingLeft: (depth + 1) * 14 + 22 + 'px' }"
    >
      (empty)
    </span>
  </li>
</template>

<style scoped>
.fn { list-style: none; }
.fn__children { list-style: none; margin: 0; padding: 0; }
.fn__row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px 3px 0;
  cursor: pointer;
  white-space: nowrap;
  border-radius: 4px;
}
.fn__row:hover { background: #e6e9ef; } /* purple_tint */
.fn__caret { width: 12px; color: #999; font-size: 10px; flex: 0 0 12px; } /* gray_4 */
.fn__icon { flex: 0 0 auto; }
.fn__name {
  overflow: hidden;
  text-overflow: ellipsis;
  color: #333333; /* gray_6 */
}
.fn__size { color: #999; font-size: 11px; margin-left: 6px; } /* gray_4 */
/* Flat, subtle folder hints — no pill, just small color-coded micro-text that
   only fully shows on hover of the row (kept faint otherwise). */
.fn__tag {
  margin-left: 8px;
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
  opacity: 0.7;
}
.fn__tag--in {
  color: #6b87b3; /* muted navy */
}
.fn__tag--out {
  color: #14a758; /* green_2 */
}
.fn__row:hover .fn__tag {
  opacity: 1;
}
.fn__actions {
  margin-left: auto;
  display: none;
  gap: 1px;
  padding-left: 6px;
}
.fn__row:hover .fn__actions { display: flex; }
.fn__act {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 12px;
  color: #4d4d4d; /* gray_5 */
  padding: 1px 5px;
  border-radius: 4px;
}
.fn__act:hover { background: #e6e9ef; color: #011f5b; } /* purple_tint / purple_3 */
.fn__act--open { color: #011f5b; font-weight: 700; } /* purple_3 — primary file action */
.fn__loading,
.fn__empty {
  display: block;
  color: #aaa;
  font-size: 11px;
  font-style: italic;
  padding-top: 2px;
  padding-bottom: 2px;
}
</style>
