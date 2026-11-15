// The session sidecar's code assistant, and its reply as it streams: the
// Anthropic Messages API's server-sent events, which the sidecar passes on
// as they come. Without imports: useJupyterSession calls it.

// Server-sent events from a buffer: the complete events' data, parsed, and
// what's left of an event still arriving.
export function sseEvents(buffer) {
  const parts = buffer.split(/\r?\n\r?\n/);
  const rest = parts.pop();
  const events = [];
  for (const part of parts) {
    const data = part
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).replace(/^ /, ""))
      .join("\n");
    if (!data) continue;
    try {
      events.push(JSON.parse(data));
    } catch {
      // not JSON: not ours
    }
  }
  return { events, rest };
}

// The text an event adds to the reply; an error event throws.
export function deltaText(ev) {
  if (ev?.type === "content_block_delta" && ev.delta?.type === "text_delta") return ev.delta.text || "";
  if (ev?.type === "error") throw new Error(ev.error?.message || "The assistant stopped with an error.");
  return "";
}

// The notebook's code assistant, on a session whose node has LLM access:
//   GET  {session}/pennsieve/assist -> { available, model }
//   POST {session}/pennsieve/assist {mode, prompt, cell, …} -> the model's
//        reply, streamed (server-sent events)
// A sidecar without one answers GET with available: false, or (an older
// one) not at all: then there's none.
const ASSIST_PATH = "/pennsieve/assist";

export async function getAssist(kernelBaseUrl, token, { fetchFn = globalThis.fetch } = {}) {
  try {
    const resp = await fetchFn(`${kernelBaseUrl}${ASSIST_PATH}`, {
      credentials: "include",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return { available: false };
    const body = await resp.json();
    return { available: !!body.available, model: body.model || "" };
  } catch {
    return { available: false };
  }
}

// Asks, calling onText with the reply so far as it arrives; resolves to the
// whole reply. signal stops it.
export async function postAssist(kernelBaseUrl, token, body, { onText, signal, fetchFn = globalThis.fetch } = {}) {
  const resp = await fetchFn(`${kernelBaseUrl}${ASSIST_PATH}`, {
    method: "POST",
    credentials: "include",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    let message = "";
    try {
      message = JSON.parse(text).error?.message || "";
    } catch {
      // not the governor's JSON: the sidecar's own words
    }
    throw new Error(message || text.trim() || `The assistant couldn't answer (${resp.status}).`);
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let reply = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = sseEvents(buffer);
    buffer = rest;
    for (const ev of events) {
      const text = deltaText(ev);
      if (text) {
        reply += text;
        onText?.(reply);
      }
    }
  }
  return reply;
}

// The notebook's agent (the session image's /pennsieve-agent): it looks at
// the session's files and the kernel before it writes, and can run its fix.
// Newer images have it; without it the sidecar's single-shot assistant
// (getAssist, postAssist) is used.
//   GET  {session}/pennsieve-agent -> { available, model, budget }
//   POST {session}/pennsieve-agent {kernelId, mode, prompt, …} -> events
//        (step, run, note, usage, budget, proposal, error)
const AGENT_PATH = "/pennsieve-agent";

export async function getAgent(kernelBaseUrl, token, { fetchFn = globalThis.fetch } = {}) {
  try {
    const resp = await fetchFn(`${kernelBaseUrl}${AGENT_PATH}`, {
      credentials: "include",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return { available: false };
    const body = await resp.json();
    return { available: !!body.available, model: body.model || "", budget: body.budget || null };
  } catch {
    return { available: false };
  }
}

// Asks the agent, calling onEvent with each event as it arrives; resolves to
// its proposal ({ code, summary, outputs, conversationId }).
export async function postAgent(kernelBaseUrl, token, body, { onEvent, signal, fetchFn = globalThis.fetch } = {}) {
  const resp = await fetchFn(`${kernelBaseUrl}${AGENT_PATH}`, {
    method: "POST",
    credentials: "include",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    let message = "";
    try {
      message = JSON.parse(text).message || "";
    } catch {
      // not the server's JSON
    }
    throw new Error(message || `The assistant couldn't answer (${resp.status}).`);
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let proposal = null;
  let failure = "";
  let usedUp = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = sseEvents(buffer);
    buffer = rest;
    for (const ev of events) {
      if (ev.type === "proposal") proposal = ev;
      if (ev.type === "error") failure = ev.message || "The assistant stopped with an error.";
      if (ev.type === "budget_exceeded") usedUp = ev;
      onEvent?.(ev);
    }
  }
  // No AI budget left: not a failure of the assistant's, said as it is.
  if (usedUp) throw Object.assign(new Error(usedUp.message || "There's no AI budget left."), { budgetExceeded: usedUp });
  if (failure) throw new Error(failure);
  if (!proposal) throw new Error("The assistant stopped without proposing code.");
  return proposal;
}
