// HTML outputs that need JavaScript (Bokeh, pyvis, folium-style pages, ...)
// can't go through DOMPurify, which drops their scripts. They render in a
// sandboxed iframe instead (allow-scripts only: an opaque origin with no way
// into the app's DOM, cookies, storage or tokens). These helpers decide which
// outputs need one, build its document, and check the height it reports.

// The message the frame's document posts with its height.
export const FRAME_HEIGHT_MESSAGE = "pennsieve-nb-frame-height";
// The tallest a frame grows; past it, the frame scrolls.
export const MAX_FRAME_HEIGHT = 2000;

// Only scripts call for a frame: inline event handlers alone don't (the
// sanitized output without them still shows its content).
export function needsFrame(html) {
  return typeof html === "string" && /<script\b/i.test(html);
}

// The hosts an output loads scripts from (<script src="https://host/...">).
// The app's Content-Security-Policy applies to the frame too and blocks them.
export function externalScriptHosts(html) {
  if (typeof html !== "string") return [];
  const hosts = new Set();
  const tag = /<script\b[^>]*>/gi;
  let m;
  while ((m = tag.exec(html))) {
    const src = /\bsrc\s*=\s*["']?\s*(?:https?:)?\/\/([^/"'\s>?#]+)/i.exec(m[0]);
    if (src) hosts.add(src[1].toLowerCase());
  }
  return [...hosts];
}

// Base styles: the notebook's font and colours, compact tables like the
// sanitized HTML outputs, and nothing that fixes the document's height (it's
// measured).
const BASE_STYLE = `
:root { color-scheme: light; }
html, body { margin: 0; padding: 0; background: transparent; }
body {
  display: flow-root;
  padding: 6px 8px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 13px;
  line-height: 1.5;
  color: #333333;
  overflow-wrap: break-word;
}
table { border-collapse: collapse; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12.5px; }
th, td { border: 1px solid #ededed; padding: 4px 10px; }
thead th { background: #f2f2f2; color: #011f5b; }
a { color: #011f5b; }
`;

// Posts the document's height to the notebook whenever it changes.
const HEIGHT_SCRIPT = `(function () {
  var last = -1;
  function post() {
    var h = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (h === last) return;
    last = h;
    parent.postMessage({ type: "${FRAME_HEIGHT_MESSAGE}", height: h }, "*");
  }
  if (window.ResizeObserver) new ResizeObserver(post).observe(document.documentElement);
  addEventListener("load", post);
})();`;

// The frame's whole document (its srcdoc).
export function buildSrcdoc(html) {
  return (
    "<!doctype html><html><head><meta charset=\"utf-8\">" +
    `<style>${BASE_STYLE}</style><script>${HEIGHT_SCRIPT}</script>` +
    `</head><body>${html ?? ""}</body></html>`
  );
}

// The height a message reports, or null when it isn't a height message from
// this frame. Only the frame's own window counts; the height is a finite
// number, clamped to 0..max.
export function frameHeight(event, frameWindow, max = MAX_FRAME_HEIGHT) {
  if (!event || !frameWindow || event.source !== frameWindow) return null;
  const d = event.data;
  if (!d || typeof d !== "object" || d.type !== FRAME_HEIGHT_MESSAGE) return null;
  const h = d.height;
  if (typeof h !== "number" || !Number.isFinite(h)) return null;
  return Math.min(Math.max(Math.ceil(h), 0), max);
}
