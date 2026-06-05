// @/composables/useJupyterSession.js
//
// Drives an interactive Jupyter workflow step from the browser:
//   1. poll workflow-service GET /runs/{id}/session/connect for the kernel URL
//      + a short-lived signed token (minted by the broker, verified by the
//      per-node auth-proxy sidecar),
//   2. open a kernel via @jupyterlab/services through that sidecar,
//   3. execute code / stream outputs,
//   4. close (sidecar -> kernel /api/shutdown -> the workflow resumes).
//
// In-memory kernel state is intentionally ephemeral; the .ipynb and files live
// on EFS, so "resume" = reopen + re-run.

import { ref } from 'vue'
import * as siteConfig from '@/site-config/site.json'
import { useGetToken } from '@/composables/useGetToken'
import { KernelManager, ServerConnection } from '@jupyterlab/services'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const toWs = (u) => u.replace(/^http/i, 'ws')
const trimSlash = (u) => u.replace(/\/+$/, '')

export function useJupyterSession() {
  const status = ref('idle') // idle | connecting | ready | error | closed
  const kernelStatus = ref('unknown')
  const error = ref(null)
  const outputs = ref([]) // outputs from the most recent execute()

  let kernelManager = null
  let kernel = null
  let kernelBaseUrl = null

  // Poll the broker endpoint. 200 => ready (returns connection info);
  // 202 => kernel still coming up, retry; anything else => error.
  async function fetchConnection(runId, { intervalMs = 2000, maxAttempts = 90 } = {}) {
    const token = await useGetToken()
    const url = `${siteConfig.api2Url}/compute/workflows/runs/${encodeURIComponent(runId)}/session/connect`
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (resp.status === 200) return resp.json()
      if (resp.status === 202) {
        await sleep(intervalMs)
        continue
      }
      if (resp.status === 403) throw new Error('You do not have access to this session.')
      if (resp.status === 404) throw new Error('No interactive session for this run.')
      throw new Error(`session connect failed (${resp.status})`)
    }
    throw new Error('Timed out waiting for the kernel to start.')
  }

  async function connect(runId) {
    status.value = 'connecting'
    error.value = null
    try {
      const conn = await fetchConnection(runId) // { executionRunId, kernelUrl, token, expiresAt }
      kernelBaseUrl = trimSlash(conn.kernelUrl)

      // @jupyterlab/services sends the token as `Authorization: token <t>` on
      // HTTP and `?token=<t>` on the kernel WebSocket; the sidecar accepts both.
      const settings = ServerConnection.makeSettings({
        baseUrl: kernelBaseUrl,
        wsUrl: toWs(kernelBaseUrl),
        token: conn.token,
      })

      kernelManager = new KernelManager({ serverSettings: settings })
      await kernelManager.ready

      // Reuse a running kernel if the server already has one; else start python3.
      const running = Array.from(kernelManager.running())
      kernel = running.length
        ? kernelManager.connectTo({ model: running[0] })
        : await kernelManager.startNew({ name: 'python3' })

      kernel.statusChanged.connect((_, s) => {
        kernelStatus.value = s
      })
      kernelStatus.value = kernel.status
      status.value = 'ready'
    } catch (e) {
      error.value = e?.message || String(e)
      status.value = 'error'
    }
  }

  // Execute code, accumulating outputs into `outputs`. Resolves when the kernel
  // reports the request is done.
  async function execute(code) {
    if (!kernel) throw new Error('No active kernel.')
    outputs.value = []
    const future = kernel.requestExecute({ code, stop_on_error: true })
    future.onIOPub = (msg) => {
      const t = msg.header.msg_type
      const c = msg.content
      if (t === 'stream') {
        outputs.value = [...outputs.value, { type: 'stream', name: c.name, text: c.text }]
      } else if (t === 'execute_result' || t === 'display_data') {
        outputs.value = [...outputs.value, { type: 'data', data: c.data }]
      } else if (t === 'error') {
        outputs.value = [...outputs.value, { type: 'error', ename: c.ename, evalue: c.evalue, traceback: c.traceback }]
      }
    }
    await future.done
  }

  // End the session: ask the sidecar to close (it shuts the kernel server down,
  // which makes the container return the task token so the workflow resumes).
  async function close() {
    try {
      if (kernelBaseUrl) {
        const token = await useGetToken()
        await fetch(`${kernelBaseUrl}/pennsieve/close`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {})
      }
    } finally {
      try { kernel?.dispose?.() } catch (_) {}
      try { kernelManager?.dispose?.() } catch (_) {}
      kernel = null
      kernelManager = null
      kernelStatus.value = 'dead'
      status.value = 'closed'
    }
  }

  return { status, kernelStatus, error, outputs, connect, execute, close }
}
