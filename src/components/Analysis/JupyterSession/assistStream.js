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
