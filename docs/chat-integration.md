# Chat Integration Spec

**Audience**: a Claude agent (or human) implementing the chat UI in `pennsieve-app`. The chat backend exists and is fully deployed in dev. This document is the complete spec for the frontend integration — protocol, state management, UX patterns, error handling, and Vue 3 + Pinia–specific recommendations.

The agent reading this should NOT need to look at backend code to build the frontend correctly. Everything you need is here.

---

## 1. What you're building

A chat UI inside the Pennsieve workspace that lets users have grounded conversations about their data with an AI assistant. The assistant has read-only tools — it can look up workspace and dataset metadata, list collaborators, search the public Discover catalog, search documentation, and answer quantitative questions about structured-metadata records. Tool calls happen automatically; users see real-time "I'm looking up X" status badges as the assistant works.

### Headline UI surface: a dataset **Insights** page

For v1, the primary chat home is a **dedicated dataset-level page** accessed via the dataset's secondary nav, labeled **Insights**. It's a two-column dashboard-plus-chat layout (see §18) where the chat panel is the primary visual anchor and the left column shows metrics + activity tiles that double as conversation entry points.

The previously-considered slide-in drawer on the dataset Overview page is **out** — the description content and the chat were fighting for vertical space and neither got enough room. Splitting them gives Overview its descriptive identity back and gives chat room to breathe.

### Two entry contexts (still)

- **Dataset mode** — Insights page on a specific dataset's secondary nav; chat is anchored to that dataset. Headline use case.
- **Workspace mode** — workspace-level Insights / chat entry (location TBD by product); chat is about the org as a whole. Lower priority for v1.

The backend is a WebSocket-fronted service (`compute-node-chat`) in the Pennsieve platform AWS account. Your code talks to it over WSS. No REST.

---

## 2. Connection

### 2.1 URL

```
wss://chat.pennsieve.{env}/dev?token=<jwt>&orgId=<orgNode>&computeNodeId=<uuid>[&datasetId=<datasetNode>][&sessionId=<clientUuid>]
```

| Env | Domain |
|---|---|
| dev | `chat.pennsieve.net/dev` |
| prod | `chat.pennsieve.io/prod` |

> Until [compute-node-chat#9](https://github.com/Pennsieve/compute-node-chat/pull/9) (private-zone DNS alias) lands, on-VPN dev resolution can fail. Fallback is the execute-api hostname (printed by the chat-service terraform output). Once #9 ships, the canonical domain works everywhere.

### 2.2 Query parameters

| Param | Required | Source | Notes |
|---|---|---|---|
| `token` | yes | Cognito access token (whatever the rest of the app uses) | Bearer JWT. ~1h lifetime. Refresh if it expires mid-session. |
| `orgId` | yes | Active workspace's node ID | Format: `N:organization:<uuid>`. From the user's currently selected workspace. |
| `computeNodeId` | yes | Compute node UUID for chat dispatch | Format: bare UUID, no prefix. Each workspace has one or more compute nodes; chat uses the user's default. See §11 for how to resolve this. |
| `datasetId` | **only in dataset mode** | Dataset node ID | Format: `N:dataset:<uuid>`. Present when opening chat from a dataset page; **omit** when opening from the workspace home. |
| `sessionId` | optional | Client-generated UUID for the conversation | Used for cost-attribution grouping across turns. If absent, server falls back to the connection ID. Generate one per "new conversation" the user starts; reuse it across reconnects of the same conversation. |

### 2.3 Auth

The WebSocket authorizer validates the JWT, looks up the user's access to `orgId` (always) and `datasetId` (if present), and checks compute-node access via the account-service. Failures return 401/403 on the handshake.

Possible authorizer rejections you should handle:
- `missing_token` — no token in URL
- `invalid_token` — JWT expired or malformed → refresh token and retry
- `claims_failed` — user lacks access to the org or dataset → show a "you don't have access" message
- `compute_node_access_denied` — user can't use this compute node → show a "no compute node available" message; suggest contacting workspace admin

### 2.4 Lifecycle

| Phase | What happens |
|---|---|
| `$connect` (handshake) | Authorizer runs. On success, server persists a `ChatConnection` row in DynamoDB capturing the resolved user/org/dataset/computeNode + JWT. Connection accepted. |
| chat frames | You send `{action: "chat", messages: [...]}` frames. Server dispatches asynchronously and emits `tool_progress` + `message` frames back. |
| idle | API Gateway WebSocket closes idle connections after **10 minutes**. Reconnect when the user types again, or send a periodic ping. |
| `$disconnect` | Either side closes. Server cleans up the ChatConnection row. |

### 2.5 Reconnection

The server has zero conversation state. **All conversation history lives in the client.** On reconnect:
1. Open a fresh WebSocket with the same query params (refresh JWT if needed)
2. Keep the same `sessionId` so cost attribution stays consistent
3. Continue sending chat frames; include the full prior history

Treat reconnects as transparent UX — show a small "reconnecting…" indicator at most.

---

## 3. Wire protocol

All frames are JSON. The WebSocket is single-channel; frames travel in both directions on the same connection. Each frame's `type` field discriminates.

### 3.1 Outbound (client → server)

One action exists today: `chat`.

```json
{
  "action": "chat",
  "messages": [
    {"role": "user",      "content": "Tell me about this workspace"},
    {"role": "assistant", "content": "<the assistant's prior reply, verbatim>"},
    {"role": "user",      "content": "Now list the admins"}
  ]
}
```

**Rules**:
- `messages` is the **full conversation history**, not just the new turn. Server is stateless.
- Roles alternate `user` / `assistant` / `user` / `assistant` / …
- `content` is a string for normal turns. (Internally the assistant emits content *blocks* when calling tools; you don't have to render those blocks — just preserve the final text reply you receive in the `message` frame and pass it back as `content` on the next turn.)
- One frame per turn; don't batch multiple user turns.

### 3.2 Inbound (server → client)

Four frame types. Discriminate on `type`.

#### 3.2.1 `tool_progress` — fired as each tool call runs

```json
{"type": "tool_progress", "name": "summarize_workspace", "status": "running"}
{"type": "tool_progress", "name": "summarize_workspace", "status": "done"}
{"type": "tool_progress", "name": "preview_file",        "status": "error", "message": "package N:package:... did not return a presigned download URL"}
```

| Field | Notes |
|---|---|
| `name` | Tool name (see §9 catalog) |
| `status` | `"running"` \| `"done"` \| `"error"` |
| `message` | Present only on errors; safe to show to the user but typically you'd just show a generic "tool failed" toast |

**UX**: render these as inline status badges in the assistant's "thinking" area. Multiple tools can be active in parallel (rare today but possible — model can call tools in parallel within one turn). You'll typically receive `running` → `done` for each tool, in the order the model invoked them.

#### 3.2.2 `message` — the assistant's final reply for a turn

```json
{
  "type": "message",
  "role": "assistant",
  "content": "Here's a snapshot of the **Pennsieve Test** workspace...",
  "usage": {
    "inputTokens": 19679,
    "outputTokens": 1003,
    "estimatedCostUsd": 0
  },
  "referencedDatasets": [
    "N:dataset:531372bf-7c0d-4c5f-a529-4803e0df26e4",
    "N:dataset:a073d799-ed01-46cf-aaa9-820be6383b17"
  ]
}
```

| Field | Notes |
|---|---|
| `content` | Markdown text. **Render as markdown** (the assistant uses headings, lists, tables, bold). Use a sanitized markdown renderer; the content is model-generated, never `v-html` it raw. |
| `usage` | Always present. Use for an optional "this turn cost X tokens" debug panel; not critical for v1 UX. |
| `referencedDatasets` | Optional. Deduped, ordered list of dataset node IDs (`N:dataset:<uuid>`) the assistant **acted on** during this turn — every value passed as a `dataset_id` argument to any tool call. Absent or empty when no dataset-scoped tools were invoked. **Per-turn**, not cumulative — frontend unions across turns if it wants the full conversation-wide set. |

This frame is the "turn complete" signal — clear the in-flight tool indicators when it arrives, append the content to the conversation, and re-enable the input.

**Using `referencedDatasets`**: render "currently discussing" pills in the chat sub-header. Resolve each `N:dataset:<uuid>` to a friendly name from the workspace's dataset list (already cached client-side for the dashboard tiles, or fetchable via `list_datasets` if not). Clicking a pill opens the dataset's Overview page in a new tab.

The backend definition of "referenced" is narrow on purpose: only datasets the model actually ran a tool against. It excludes datasets merely mentioned in prose, and datasets returned in a `list_datasets` result without drill-in. This matches user intent — these are the datasets the conversation has done real work on.

#### 3.2.3 `blocked` — guardrail intervention

```json
{
  "type": "blocked",
  "reason": "guardrail",
  "message": "I can't help with that request. Please rephrase your question in terms of your Pennsieve datasets or workspace content."
}
```

Bedrock's content guardrail flagged the input or output (hate / violence / sexual / prompt-attack). Render the `message` field as the assistant's reply (it's pre-composed, user-friendly text). Treat as a normal turn-end — clear tool indicators, append to conversation.

#### 3.2.4 `error` — protocol / infrastructure error

```json
{"type": "error", "code": "BAD_REQUEST", "message": "request body is not valid JSON"}
```

| Code | Meaning | UX |
|---|---|---|
| `BAD_REQUEST` | Malformed frame | Bug in your code — log it, show a generic "something went wrong" |
| `EMPTY_REQUEST` | Empty messages array | Bug in your code |
| `NO_CONNECTION` | ChatConnection row missing — happens if server lost state | Reconnect from scratch, then resend |
| `MISCONFIGURED` | Backend env var missing | Backend issue — log, show generic error |
| `AWS_CONFIG` / `DYNAMODB` | Backend AWS failure | Transient; retry once with backoff |
| `UNKNOWN_COMPUTE_NODE` / `UNAVAILABLE` | Compute node misconfigured | Show "compute node unavailable; contact admin" |
| `UPSTREAM_FAILURE` | LLM gateway / governor / Bedrock blew up | Show "the assistant is having trouble right now"; offer retry |
| `UPSTREAM_<n>` | HTTP <n> from upstream | Same as above |
| `INTERNAL` | Anything else | Log, generic error |

Errors do NOT close the connection — the user can retry on the same socket.

---

## 4. Conversation state

The server is stateless. Your client owns the canonical conversation. Pattern:

```ts
type Message = { role: 'user' | 'assistant', content: string }

interface Conversation {
  sessionId: string             // UUID generated when conversation starts
  messages: Message[]           // grows as user/assistant alternate
  mode: 'workspace' | 'dataset' // anchors which params go on the WS URL
  orgId: string
  datasetId?: string            // present iff mode === 'dataset'
}
```

**Sending a new user turn**:
1. Append `{role: 'user', content: <input>}` to `messages`
2. Send `{action: 'chat', messages: <the full array>}` over the WS
3. Mark the conversation as "awaiting reply" (disable input, show pending indicator)
4. As `tool_progress` events arrive, render them as inline status under the user's last bubble
5. When `message` arrives, append `{role: 'assistant', content: <reply>}` to `messages`, clear indicators, re-enable input

**A new conversation** = new `sessionId` + empty `messages`. The user starting a new chat from the UI ("New conversation" button) resets both.

**Persistence**: out of scope for this spec. v1 can keep conversations in-memory (Vuex store, cleared on page reload). v2 might persist to LocalStorage or eventually to a server-side history table. Make the conversation store easy to swap implementations behind.

---

## 5. Tool UX

The assistant has 10 tools (see §9). When it uses one, you get `tool_progress` events. The pattern users should see is a "live activity" inline with the assistant's thinking, not a chat bubble per tool.

**Friendly tool labels** — translate tool names into user-facing language:

| Tool | UI label |
|---|---|
| `summarize_workspace` | "Pulling workspace overview…" |
| `list_datasets` | "Listing your datasets…" |
| `list_workspace_members` | "Looking up workspace members…" |
| `summarize_dataset` | "Reading dataset metadata…" |
| `review_files` | "Listing files…" |
| `preview_file` | "Previewing file…" |
| `list_dataset_collaborators` | "Looking up collaborators…" |
| `search_discover_datasets` | "Searching Pennsieve Discover…" |
| `get_discover_dataset` | "Loading published dataset details…" |
| `lookup_citation` | "Resolving citation…" |

(Maintain this map in a small constant file. New tools will land — defaulting to "Running `${name}`…" is fine for unknown tool names so the UI doesn't break when the backend ships a tool the frontend doesn't know yet.)

**Visual treatment** — a small spinner + label that turns into a checkmark on `done` (and fades out after the final `message` arrives). On `error`, a muted warning icon; the assistant's final reply will usually acknowledge the failure in its text.

**Don't render tool *output* directly to users.** The model interprets tool results and weaves them into its reply. Showing raw JSON would be noisy and confusing.

---

## 6. Error handling

- **WebSocket connection errors** (failed handshake, network drop):
  - 1006 (abnormal close) + immediately: usually DNS / VPN / network. Show "couldn't connect" with retry.
  - 401/403 on handshake: token expired or access revoked. Refresh token; if it still fails, surface the access error.
  - Mid-conversation disconnect: reconnect transparently, preserve conversation history, allow the user to continue typing.

- **In-band `error` frames** (see §3.2.4): map to per-code UX. Don't close the WS — the user can retry on the same socket.

- **`blocked` frames** (§3.2.3): treat as a normal assistant turn. The user can rephrase and try again.

- **Stale connection / no response**: if you sent a chat frame and got no `message` within ~5 minutes (the worker's wall-clock budget), assume the worker crashed silently. Show a "no response received — try again" and reset the in-flight state.

---

## 7. Modes

The mode is decided at connection time by whether `datasetId` is included in the URL. The user can't switch mode mid-conversation without reconnecting.

**Dataset-mode UX**:
- Chat is anchored to one dataset
- System prompt tells the model the dataset_id; it uses it automatically when calling dataset-scoped tools
- Suggested starter prompts: "Summarize this dataset", "Show me the README", "Who has access to this?"

**Workspace-mode UX**:
- No specific dataset
- System prompt directs the model to `summarize_workspace` / `list_datasets`
- Suggested starter prompts: "Tell me about this workspace", "What datasets do I have?", "Who's in this workspace?"
- If the user asks about a specific dataset, the model can call `list_datasets` to find the node_id and then drill in — pennsieve-api gates per-request access, so this is safe.

For v1, surface mode as part of the UI ("Chatting about workspace: Pennsieve Test" header vs "Chatting about: <dataset name>"). When the user opens chat from a dataset page, default to dataset mode; from the workspace home, workspace mode.

---

## 8. Suggested implementation in Vue 3 / Pinia / Vite

This is the app stack — Vue 3.5 with Composition API, Pinia for state, Vue Router 4, Vite for dev server / build. Both `<script setup>` SFCs and the existing `composables/` pattern are used throughout. Vuex modules in `src/store/` exist for legacy reasons; **new code should use Pinia in `src/stores/`**, matching the naming convention there (`*Store.js`).

### 8.1 Module layout

```
src/
  components/
    Insights/
      DatasetInsightsPage.vue     # full-page route; the headline surface (see §18)
      InsightsMetricsTile.vue     # one metric tile (count + label, clickable)
      InsightsModelsList.vue      # models breakdown — table of models + record counts
      InsightsActivityList.vue    # recent activity feed
    Chat/
      ChatPanel.vue               # embeddable chat (used inside DatasetInsightsPage)
      ChatMessageList.vue         # scrollable conversation
      ChatMessage.vue             # one bubble (user or assistant)
      ChatToolProgress.vue        # inline activity badges
      ChatInput.vue               # textarea + send button
      ChatSuggestedPrompts.vue    # chip row above the input
      ChatModeHeader.vue          # "Workspace: X" / "Dataset: Y"
      toolLabels.js               # tool name → user label map (small const)
  composables/
    useChatSocket.js              # WebSocket lifecycle wrapper
    useDatasetInsights.js         # fan-out fetcher: hits the MCP tools once
                                  # at page load to populate the metrics tiles
                                  # (see §18.4 for which tools)
  stores/
    chatStore.js                  # Pinia store: conversation + connection state
    datasetInsightsStore.js       # Pinia store: metrics + models + activity for
                                  # the current dataset (cached per dataset_id)
```

### 8.2 Pinia store responsibilities

Use Pinia's setup-store syntax (matches existing stores like `collectionStore.js`):

```js
// src/stores/chatStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useChatStore = defineStore('chat', () => {
  // ── state ──
  const open = ref(false)
  const mode = ref(null)                  // 'workspace' | 'dataset'
  const sessionId = ref(null)
  const orgId = ref(null)
  const datasetId = ref(null)
  const computeNodeId = ref(null)
  const messages = ref([])                // { role, content }
  const pending = ref(false)              // assistant is working
  const activeTools = ref([])             // { name, status, message? }
  const connectionState = ref('idle')     // 'idle'|'connecting'|'open'|'reconnecting'|'error'
  const lastError = ref(null)

  // ── derived ──
  const canSend = computed(() => connectionState.value === 'open' && !pending.value)

  // ── actions ──
  function openChat({ mode: m, orgId: o, datasetId: d, computeNodeId: c }) { /* ... */ }
  function sendUserMessage(content) { /* append + send WS frame */ }
  function handleIncomingFrame(frame) { /* dispatch on frame.type */ }
  function closeChat() { /* ... */ }
  function resetConversation() { /* new sessionId, empty messages */ }

  return {
    open, mode, sessionId, orgId, datasetId, computeNodeId,
    messages, pending, activeTools, connectionState, lastError, canSend,
    openChat, sendUserMessage, handleIncomingFrame, closeChat, resetConversation,
  }
})
```

The **WebSocket instance itself does NOT belong in the store** — Pinia wraps stored objects in reactive proxies, which is wasted work for a non-reactive WebSocket. Keep the WS in a module-scoped variable inside `useChatSocket.js` and expose imperative methods.

### 8.3 WebSocket lifecycle — composable pattern

```js
// src/composables/useChatSocket.js
import { useChatStore } from '@/stores/chatStore'
import { useGetToken } from '@/composables/useGetToken'

let socket = null               // module-private, non-reactive

export function useChatSocket() {
  const store = useChatStore()
  const { getToken } = useGetToken()    // existing composable

  async function connect({ orgId, computeNodeId, datasetId }) {
    const token = await getToken()
    const url = buildChatUrl({ token, orgId, computeNodeId, datasetId })
    socket = new WebSocket(url)
    socket.onopen    = () => { store.connectionState = 'open' }
    socket.onmessage = (e) => store.handleIncomingFrame(JSON.parse(e.data))
    socket.onclose   = (e) => handleClose(e)
    socket.onerror   = (e) => handleError(e)
    store.connectionState = 'connecting'
  }

  function send(frame) {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(frame))
    }
  }

  function close() { socket?.close(); socket = null }

  return { connect, send, close }
}
```

Components import the composable and call `connect()` / `send()` / `close()`; reactive state comes from `useChatStore()`.

**Token refresh**: the app already has `useGetToken` for Cognito JWT retrieval — use it. If the WebSocket closes with code 1008 (or you get 401/403 on the handshake response), discard the cached token, fetch a fresh one, and reconnect.

### 8.4 Markdown rendering

Check what `pennsieve-app` already uses — look in `src/components/` and the existing dependencies. If a markdown renderer is in place (e.g. for dataset descriptions or readmes), use the same library so styling is consistent. Otherwise `markdown-it` is the safe pick.

Configure with HTML disabled (`html: false`) — the assistant occasionally tries to embed HTML and we want to render only the markdown subset for safety. Pass model output through the renderer, NOT through `v-html` on raw strings.

Use a `<MarkdownContent :source="msg.content" />` wrapper component for assistant bubbles so swapping the renderer later is one place.

### 8.5 Avoid

- **Don't** put the WebSocket instance in the Pinia store. It's not reactive and reactive proxies of it are wasted overhead (also: console noise about un-proxyable types).
- **Don't** parse tool result content. Tool outputs go to the model, not your UI. You only ever render `tool_progress` (badges) and `message.content` (markdown).
- **Don't** render assistant content as anything other than markdown. No rich content (images, charts, embedded components) in v1.
- **Don't** persist Cognito tokens to LocalStorage tied to chat. Use whatever the rest of the app uses for auth state (Cognito SDK already manages storage).
- **Don't** show internal IDs (`N:dataset:...`, integer dataset IDs, etc.) in the UI. The model already turns those into names in its replies.
- **Don't** add new Vuex modules for chat. Pinia is the migration target; chat is greenfield code.

---

## 9. Tool catalog (informational)

You don't call these directly — the assistant does. Listed so you understand what kinds of questions work and can suggest starter prompts.

| Tool | Scope | One-line description |
|---|---|---|
| `summarize_workspace` | workspace | Workspace overview (members, storage, dataset count) |
| `list_datasets` | workspace | Paginated dataset list with search |
| `list_workspace_members` | workspace | Workspace member roster |
| `summarize_dataset` | dataset | Dataset metadata + contributors |
| `review_files` | dataset | File tree |
| `preview_file` | dataset | First ~100 lines / 50KB of a file |
| `list_dataset_collaborators` | dataset | Per-dataset access list with roles |
| `list_dataset_models` | dataset | Structured-metadata models (Subject, Sample, etc.) |
| `get_model` | dataset | Full property schema for one model |
| `list_model_records` | dataset | Paginated record dump (optionally filtered) |
| `query_model_records` | dataset | SELECT statement over records — counts, aggregates, filtering |
| `search_discover_datasets` | discover | Public Discover catalog search |
| `get_discover_dataset` | discover | Full metadata for one published dataset |
| `search_documentation` | documentation | Search docs.pennsieve.io guides |
| `get_documentation_page` | documentation | Full markdown body of one guide by slug |
| `lookup_citation` | global | DOI → title/authors/year/abstract |

More tools will land. Don't hardcode an allowlist on the frontend — render any `tool_progress` you receive.

---

## 10. Open UX decisions to make

These are intentionally left for the frontend to decide; flag them with product:

1. **Where does chat live?** ~~A slide-in drawer~~ → **DECIDED**: dedicated **Insights** page in the dataset's secondary nav (see §18). Two-column dashboard + chat layout, 40/60 split.
2. **One conversation or many?** v1 can be single-conversation-per-context; v2 might offer history list. Lean simple for v1.
3. **Token-cost visibility?** Do users see "this turn cost $0.003" or is it hidden? Probably hidden for v1.
4. **Suggested-prompt chips** — show 2-3 starter prompts based on mode (workspace vs dataset)?
5. **Streaming text** — backend currently sends one full `message` frame per turn (not token-by-token). Frontend can layer a 30ms-per-char reveal animation if you want a "typing" feel — see §13.

---

## 11. Resolving `computeNodeId`

Each Pennsieve workspace has one or more compute nodes (the customer-account AWS environments where processors and chat run). For chat, the frontend needs to choose one.

In the dev environment there's a single test compute node:
```
02ddb00a-541d-4502-8d62-f571b8e17578
```

In production, the user can have multiple compute nodes. Two reasonable choices for v1:
- Use the user's "default" compute node (account-service exposes a default-flag in the compute-nodes listing)
- Use whichever compute node the current dataset is "linked to" (datasets can be associated with a compute node)

For initial implementation: use account-service's "list my compute nodes" endpoint, pick the first one with `accessType !== ""`, and pass its UUID. If the user has none, show a "no compute node configured for chat" error and don't open the chat UI.

Endpoint shape (check `pennsieve-app`'s existing API client for the canonical helper): `GET /compute-nodes` returns a list with `{uuid, name, accessType, default}` per entry. Filter to ones where `accessType` is non-empty.

---

## 12. Dev / testing

### 12.1 Hostname

Dev backend:
- Custom domain (preferred): `wss://chat.pennsieve.net/dev?...` — works after [PR #9](https://github.com/Pennsieve/compute-node-chat/pull/9) lands and on/off VPN
- Execute-api fallback (current): `wss://szgl9urld5.execute-api.us-east-1.amazonaws.com/dev?...` — fails when DNS resolves to VPC-internal IPs (on Pennsieve VPN with split-DNS); disconnect VPN if you hit this

Read the WSS URL from the same site-config files that already drive `pennsieve-app`'s API endpoints (see `src/site-config/{local,dev,prod}.json`). Add a `chatWsUrl` field there.

### 12.2 Terminal repro

If you need to drive the backend directly (e.g. to confirm a backend bug vs frontend bug):

```bash
TOKEN='<paste-jwt>'
NODE='02ddb00a-541d-4502-8d62-f571b8e17578'
ORG='N:organization:050fae39-4412-43ef-a514-703ed8e299d5'

# Workspace mode
wscat -c "wss://szgl9urld5.execute-api.us-east-1.amazonaws.com/dev?token=${TOKEN}&computeNodeId=${NODE}&orgId=${ORG}"

# Then at the > prompt, paste (one line):
{"action":"chat","messages":[{"role":"user","content":"Tell me about this workspace"}]}
```

### 12.3 Backend logs

If something is misbehaving on the backend side, CloudWatch:
- `/aws/lambda/dev-compute-node-chat-service` — connection + dispatch logs
- `/aws/lambda/dev-pennsieve-mcp-service` — tool execution
- (Customer-account) llm-governor + compute-gateway-v2 logs — Bedrock dispatch

Frontend bugs are unlikely to require backend log access; mention which symptom you're seeing in a backend channel and someone will check.

---

## 13. Future-proofing (don't build for these now, but don't preclude them)

| Future feature | Wire-format impact |
|---|---|
| Token streaming | New event type `text_delta` between `tool_progress` events; final `message` still ends the turn. Render the running delta as it arrives. Existing client that ignores unknown types still sees the final `message` and works. |
| New tools | More `tool_progress` events with names you don't recognize. Fall back to "Running ${name}…" labels. |
| Discover-public chat (anonymous, no JWT) | A separate chat surface; same protocol minus the JWT. v1 frontend doesn't need to support this. |
| Server-pushed updates (e.g. "your dataset was updated") | Hypothetical future event type. Not on the near-term roadmap. |

When unknown event types arrive, **ignore them silently** rather than erroring. Keep the protocol forward-compatible.

---

## 14. What's NOT in scope for v1

To avoid scope creep and keep the v1 ship small:

- **Mid-conversation mode switching** — user must close + reopen chat to switch workspace ↔ dataset
- **Multi-conversation history** — one active conversation per chat-drawer; no sidebar of past conversations
- **File upload to chat** — assistant is read-only; users can't attach files
- **Voice input/output** — text only
- **Compute-node picker** — auto-pick the user's default; surface a settings affordance later
- **Cross-workspace queries** — assistant only sees the current org's content (Discover catalog being the exception)

---

## 15. Backend PRs that are open as of this writing

Cosmetic / DNS / guardrail polish — none block frontend development:

- [compute-node-chat#9](https://github.com/Pennsieve/compute-node-chat/pull/9) — private-zone DNS alias for `chat.pennsieve.net`
- [compute-node-aws-provisioner-v2#17, #18](https://github.com/Pennsieve/compute-node-aws-provisioner-v2/pulls) — gateway tools passthrough + chat guardrail polish
- [pennsieve-mcp#2, #3](https://github.com/Pennsieve/pennsieve-mcp/pulls) — tool scope mechanism + collaboration tools

All have been functionally validated in dev. Don't wait for them to merge — protocol is stable.

---

## 16. Questions you'll likely have

**Q: Composition API or Options API? Pinia or Vuex?**
A: Composition API + Pinia for new code. The app is Vue 3.5 + Pinia 3 + Vite. Some legacy modules in `src/store/` still use Vuex 4 — leave those alone, don't add to them. New stores go in `src/stores/` as setup-style Pinia stores (look at `collectionStore.js` for the convention).

**Q: TypeScript or JavaScript?**
A: The app is mostly JavaScript with TypeScript used for typed library wrappers (`useConcepts.ts`, etc.). Match the surrounding code — JS for components and stores is fine, TS where you'd naturally want types (e.g. frame-type discriminated unions).

**Q: How do I get a JWT for testing locally?**
A: Use the same auth flow as the rest of pennsieve-app — the `useGetToken` composable in `src/composables/useGetToken.js`. The chat URL takes whatever token the app already has for the user. There's no chat-specific auth.

**Q: Does the assistant need any context I send it about the user / dataset?**
A: No. The backend already injects org / dataset / compute-node info into the system prompt at dispatch time. Just send chat frames with messages.

**Q: What if the model returns something inappropriate / hallucinated / off-topic?**
A: Bedrock guardrails handle the egregious cases (returning a `blocked` frame). For hallucinations on tool data — the model is anchored by tool calls; off-tool hallucinations should be reported back to the chat-backend team as a system-prompt-tuning issue, not a frontend concern.

**Q: How do I tell which environment I'm pointing at?**
A: `chatWsUrl` in the site-config files (you'll add it). dev / prod / local each have their own.

**Q: Does the protocol version?**
A: Not currently. Treat unknown frame types as forward-compatible (ignore them). If we add breaking changes we'll add a `version` field and start with `v2`.

---

## 17. Acceptance criteria for v1

Minimum to ship:

- [ ] User can navigate to **Insights** in a dataset's secondary nav and land on the new page (§18)
- [ ] Metrics tiles populate from MCP tools at page load — subjects/samples/etc. counts, file count, contributor count, storage
- [ ] Chat panel takes ~60% of available width; metrics column takes ~40% (responsive breakpoints in §18.2)
- [ ] User can ask a dataset question that triggers `summarize_dataset` / `review_files` / `preview_file` / `list_dataset_models` / `query_model_records`; sees tool-progress badges; sees a markdown-rendered reply
- [ ] Multi-turn conversation works (follow-up question uses prior context)
- [ ] Suggested-prompt chips above the chat input populate from dataset content (model-aware after `list_dataset_models` resolves)
- [ ] Tool-progress badges are friendly-labeled, not raw tool names
- [ ] Assistant content renders as markdown (not raw text, not raw HTML)
- [ ] WebSocket reconnects gracefully on transient drops
- [ ] Token expiry produces a refresh-and-retry, not a stuck UI
- [ ] No console errors / unhandled promise rejections during a normal conversation
- [ ] Backend `error` and `blocked` frames produce coherent user-facing messages
- [ ] Below 1280px viewport: single-column collapse (chat first, metrics scrollable below)

---

## 18. Dataset Insights page — layout spec

This is the headline surface for v1. New page in the dataset's secondary nav labeled **Insights**, rendered at `/datasets/:id/insights` (or whatever path the existing dataset routes use as their convention).

### 18.1 Layout sketch

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Dataset header — name • role badge • storage • last updated             │
├────────────────────────────┬────────────────────────────────────────────┤
│  Left: 40% — Metrics       │  Right: 60% — Chat                          │
│                            │                                             │
│  ┌──────┐┌──────┐          │  ┌────────────────────────────────────┐     │
│  │  23  ││ 1.2k │          │  │  Chat with this dataset            │     │
│  │ Sub. ││Files │          │  │                                    │     │
│  └──────┘└──────┘          │  │   [conversation messages]          │     │
│  ┌──────┐┌──────┐          │  │                                    │     │
│  │  4   ││  7   │          │  │                                    │     │
│  │Models││Contri│          │  │                                    │     │
│  └──────┘└──────┘          │  │                                    │     │
│                            │  │                                    │     │
│  Models breakdown          │  │   Suggested prompts:               │     │
│  ─────────────             │  │   ▸ How many subjects?             │     │
│  Subject    23             │  │   ▸ Show me a sample               │     │
│  Sample     89             │  │   ▸ Who has access?                │     │
│  Session    147            │  │                                    │     │
│                            │  │   > Type a question…               │     │
│  Recent activity           │  └────────────────────────────────────┘     │
│  ─────────────             │                                             │
│  README.md   2d ago        │                                             │
│  subjects.csv 5d ago       │                                             │
└────────────────────────────┴─────────────────────────────────────────────┘
```

The chat panel is the primary visual anchor. The dashboard tiles inform — and feed the chat via interactivity (§18.5).

### 18.2 Widths

| Element | Target | Min | Max |
|---|---|---|---|
| Chat column | 60% of available | **600px** (below this, markdown tables wrap and tool_progress badges stack — bad UX) | ~900px (cap at 75ch / ~900px so message lines don't get unreadable) |
| Metrics column | 40% of available | **320px** (the 2×2 tile grid needs this width; below this it stacks 1-wide and looks lonely) | ~480px (tiles become unhelpfully large) |
| Combined min | — | **~960px** | — |
| Single-column breakpoint | — | **< 1280px viewport** — chat first, metrics scroll below | — |

The constraint that matters most: **chat min width of 600px**. Below that, the chat degrades faster than the tiles do. If you can only protect one, protect chat.

**Typical viewports**:

| Viewport | Available¹ | Chat (60%) | Metrics (40%) |
|---|---|---|---|
| 1920px | ~1640px | cap at 900px | cap at 480px (extra space goes to a center gutter) |
| 1440px | ~1160px | 696px | 464px (sweet spot) |
| 1280px | ~1000px | 600px | 400px (at the minimums; still works) |
| <1280px | — | single column | scrolled below chat |

¹ Available = viewport minus left primary nav + dataset secondary nav chrome (~280px combined).

### 18.3 Suggested-prompt chips

A small row above the chat input, 2-4 chips. Doubles as discoverability ("oh I can ask that?") and reduces cold-start friction. Click a chip → pre-fills the input.

**Default chips (before any data loads)**:
1. "Summarize this dataset"
2. "What's in the README?"
3. "Who has access?"
4. "Show me a few example records"

**After `list_dataset_models` resolves, swap to model-aware chips**:
1. "How many [largest-model] records do I have?" (e.g. "How many subjects?")
2. "What models are in this dataset?"
3. "Show me a few example [largest-model] records"
4. "Summarize this dataset"

Small touch, large polish gain. Make the chip list a small const file (`src/components/Chat/suggestedPrompts.js`) so it's easy to tune.

### 18.4 Metrics tiles — which MCP tools back what

Every metric below is available via the MCP tools chat already uses. **Same backend, two surface forms** — the dashboard and the chat agree because they read the same source.

| Tile | Backed by |
|---|---|
| Files count, storage | `summarize_dataset` (already available; just pull and project) |
| Contributors count | `summarize_dataset` (contributors list — count it) |
| Models count | `list_dataset_models` (length of the returned list) |
| Per-model record counts | `list_dataset_models` (each entry has property count) + optionally `query_model_records` with COUNT(*) per model (cleaner numbers, more queries) |
| Recent activity (file list) | `review_files` with sort by `updated_at` descending |

**Fan-out at page load**: `useDatasetInsights.js` makes parallel calls to the above. Cache the result in `datasetInsightsStore` keyed by `dataset_id` so re-navigation to the same dataset doesn't re-fetch.

**Auth path**: tiles need the same JWT chat uses. Use `useGetToken` — same source of truth. Tiles call the readme-service / metadata-service / pennsieve-api directly over HTTPS (these are the same backends chat hits via MCP, but called directly with the user's JWT — no MCP server involvement needed for read-only dashboard data).

### 18.5 Interactivity bridges — tiles ↔ chat

This is what makes the dashboard + chat combo meaningfully better than either alone. Each clickable element on the left should pre-populate the chat input with a useful prompt:

| Click target | Pre-fills chat with |
|---|---|
| "Subjects: 23" tile | "Show me all subjects" |
| "Files: 1.2k" tile | "What types of files are in this dataset?" |
| "Models: 4" tile | "What models does this dataset have?" |
| A row in the Models breakdown ("Subject — 23 records") | "Tell me about the Subject model and show me a sample" |
| A file in recent activity | "Preview the file `<filename>`" |

The click should **populate** the input, not auto-send. User gets to edit/extend the prompt before pressing enter — gives them confidence and lets them ask follow-ups in the same direction.

### 18.6 Overview page after the Insights split

Overview becomes purely descriptive:

- Hero: dataset name, banner, description
- README rendered prominently
- Metadata fields (license, DOI, citation)
- Tags
- "People & Roles" sidebar

No chat. No metrics tiles. Description gets the headline of the page rather than competing with a sidebar.

### 18.7 Workspace-level Insights — open product question

The same pattern could land at the workspace level (replacing or augmenting the current workspace dashboard). Same chat shell, different metrics:

- Datasets count, member count, total storage
- Datasets-by-status breakdown
- Recent activity across the workspace
- Chat in workspace-mode (no `datasetId`)

That's a bigger product decision and not required for v1. v1 is dataset-level Insights only. The workspace-level extension is straightforward if you decide to do it later — same components, different store + tiles.

### 18.8 "Focus mode" — optional v1.5

A toggle that hides the metrics column and gives chat the full width. Useful for users who already know what they want to ask. Not v1 priority but worth not designing yourself out of.
