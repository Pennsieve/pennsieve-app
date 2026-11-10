// A colour as text on white: the colour itself when it already reads
// (WCAG AA for body text, 4.5:1), else darkened toward black in small steps
// until it does. Reads #rgb, #rrggbb, #rrggbbaa, rgb() and rgba() (the
// workspace settings' colour pickers save rgba); a translucent colour is
// taken as it shows on white. null for a colour it can't read.

const AA = 4.5;

// [r, g, b] (0 to 255) as the colour shows on white.
function parseColor(color) {
  if (typeof color !== "string") return null;
  const value = color.trim();
  let rgb;
  let alpha = 1;
  const fn = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (fn) {
    rgb = fn.slice(1, 4).map(Number);
    if (fn[4] !== undefined) alpha = Number(fn[4]);
  } else {
    let hex = value.replace(/^#/, "");
    if (/^[0-9a-f]{3}$/i.test(hex)) hex = hex.split("").map((c) => c + c).join("");
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) return null;
    rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    if (hex.length === 8) alpha = parseInt(hex.slice(6, 8), 16) / 255;
  }
  if (rgb.some((v) => !(v >= 0 && v <= 255)) || !(alpha >= 0 && alpha <= 1)) return null;
  return rgb.map((v) => alpha * v + (1 - alpha) * 255);
}

function toHex(rgb) {
  return "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

// WCAG relative luminance of an sRGB colour.
function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Contrast of a colour against white (1 to 21).
export function contrastOnWhite(color) {
  const rgb = parseColor(color);
  return rgb ? 1.05 / (luminance(rgb) + 0.05) : null;
}

export function readableOnWhite(color, ratio = AA) {
  const rgb = parseColor(color);
  if (!rgb) return null;
  for (let step = 0; step <= 20; step++) {
    const shade = rgb.map((v) => v * (1 - step * 0.05));
    if (1.05 / (luminance(shade) + 0.05) >= ratio) return toHex(shade);
  }
  return "#000000";
}
