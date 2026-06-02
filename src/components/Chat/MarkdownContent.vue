<template>
  <div class="markdown-content" v-html="rendered"></div>
</template>

<script setup>
import { computed } from 'vue'
import { marked } from 'marked'

const props = defineProps({
  source: { type: String, default: '' },
})

marked.setOptions({ breaks: true, gfm: true })

const rendered = computed(() => {
  if (!props.source) return ''
  try {
    return marked.parse(props.source, { async: false })
  } catch (e) {
    console.error('markdown render error', e)
    const escaped = String(props.source).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
    return `<pre>${escaped}</pre>`
  }
})
</script>

<style scoped lang="scss">
@use '../../styles/theme';
.markdown-content {
  font-size: 14px;
  line-height: 1.5;
  color: #1c1c1c;

  :deep(p) { margin: 0 0 8px; }
  :deep(p:last-child) { margin-bottom: 0; }
  :deep(h1), :deep(h2), :deep(h3), :deep(h4) {
    margin: 16px 0 8px;
    font-weight: 600;
  }
  :deep(h1) { font-size: 18px; }
  :deep(h2) { font-size: 16px; }
  :deep(h3) { font-size: 15px; }
  :deep(h4) { font-size: 14px; }
  :deep(ul), :deep(ol) { margin: 0 0 8px; padding-left: 24px; }
  :deep(li) { margin: 4px 0; }
  :deep(code) {
    background: rgba(0, 0, 0, 0.06);
    padding: 1px 6px;
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px;
  }
  :deep(pre) {
    background: rgba(0, 0, 0, 0.06);
    padding: 8px 12px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 0 0 8px;
  }
  :deep(pre code) { background: transparent; padding: 0; }
  :deep(a) { color: theme.$purple_3; text-decoration: underline; }
  :deep(table) {
    border-collapse: collapse;
    margin: 8px 0;
    font-size: 13px;
  }
  :deep(th), :deep(td) {
    border: 1px solid #dadada;
    padding: 4px 8px;
    text-align: left;
  }
  :deep(th) { background: #f6f6f6; font-weight: 600; }
  :deep(blockquote) {
    margin: 0 0 8px;
    padding: 4px 12px;
    border-left: 3px solid #dadada;
    color: #555;
  }
}
</style>
