<script setup>
// Native interactive Jupyter session for a workflow run. Connects to the live
// kernel via @jupyterlab/services (through the per-node auth-proxy sidecar) and
// provides a minimal execute/output surface. Richer notebook UX (multi-cell,
// .ipynb load/save, full mime rendering) is iterative on top of this.
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useJupyterSession } from '@/composables/useJupyterSession'

const props = defineProps({
  runId: { type: String, required: true },
})

const { status, kernelStatus, error, outputs, connect, execute, close } = useJupyterSession()

const code = ref('print("hello from your Pennsieve kernel")')
const running = ref(false)

onMounted(() => connect(props.runId))
onBeforeUnmount(() => close())

async function runCell() {
  if (status.value !== 'ready' || running.value) return
  running.value = true
  try {
    await execute(code.value)
  } finally {
    running.value = false
  }
}

async function endSession() {
  await close()
}

function pngSrc(data) {
  const b64 = data['image/png']
  return `data:image/png;base64,${b64}`
}
</script>

<template>
  <div class="jupyter-session">
    <header class="js-header">
      <span class="js-status" :class="`js-status--${status}`">{{ status }}</span>
      <span v-if="status === 'ready'" class="js-kernel">kernel: {{ kernelStatus }}</span>
      <span class="js-spacer" />
      <button
        class="js-btn"
        :disabled="status === 'closed'"
        @click="endSession"
      >
        Close session
      </button>
    </header>

    <p v-if="status === 'connecting'" class="js-msg">Starting your kernel… this can take a moment.</p>
    <p v-if="status === 'error'" class="js-msg js-msg--error">{{ error }}</p>
    <p v-if="status === 'closed'" class="js-msg">Session closed. The workflow will continue.</p>

    <template v-if="status === 'ready'">
      <div class="js-cell">
        <textarea v-model="code" class="js-code" spellcheck="false" rows="6" />
        <button class="js-btn js-run" :disabled="running" @click="runCell">
          {{ running ? 'Running…' : 'Run' }}
        </button>
      </div>

      <div class="js-outputs">
        <div v-for="(o, i) in outputs" :key="i" class="js-output">
          <pre v-if="o.type === 'stream'" :class="{ 'js-stderr': o.name === 'stderr' }">{{ o.text }}</pre>
          <template v-else-if="o.type === 'data'">
            <img v-if="o.data['image/png']" :src="pngSrc(o.data)" alt="kernel output" />
            <pre v-else-if="o.data['text/plain']">{{ o.data['text/plain'] }}</pre>
          </template>
          <pre v-else-if="o.type === 'error'" class="js-stderr">{{ o.ename }}: {{ o.evalue }}
{{ (o.traceback || []).join('\n') }}</pre>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.jupyter-session { display: flex; flex-direction: column; gap: 12px; padding: 12px; }
.js-header { display: flex; align-items: center; gap: 12px; }
.js-spacer { flex: 1; }
.js-status { text-transform: uppercase; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 4px; background: #eee; }
.js-status--ready { background: #e3f7e8; color: #1a7f37; }
.js-status--error { background: #fde8e8; color: #b42318; }
.js-status--connecting { background: #fff4e5; color: #9a6700; }
.js-kernel { font-size: 12px; color: #666; }
.js-cell { display: flex; flex-direction: column; gap: 6px; }
.js-code { width: 100%; font-family: ui-monospace, Menlo, monospace; font-size: 13px; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
.js-btn { align-self: flex-start; padding: 6px 14px; border: 1px solid #bbb; border-radius: 4px; background: #fff; cursor: pointer; }
.js-btn:disabled { opacity: 0.5; cursor: default; }
.js-run { background: #295eff; color: #fff; border-color: #295eff; }
.js-outputs { display: flex; flex-direction: column; gap: 8px; }
.js-output pre { margin: 0; padding: 8px; background: #f6f8fa; border-radius: 4px; overflow-x: auto; font-size: 13px; }
.js-stderr { background: #fde8e8 !important; color: #b42318; }
.js-msg { color: #555; }
.js-msg--error { color: #b42318; }
</style>
