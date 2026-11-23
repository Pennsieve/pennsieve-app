import { describe, it, expect } from "vitest";
import {
  FRAME_HEIGHT_MESSAGE,
  MAX_FRAME_HEIGHT,
  buildSrcdoc,
  externalScriptHosts,
  frameHeight,
  needsFrame,
} from "./htmlFrameHelpers";

describe("HTML outputs that need a frame", () => {
  it("are the ones with scripts", () => {
    expect(needsFrame('<div id="p"></div><script type="text/javascript">Bokeh.embed()</script>')).toBe(true);
    expect(needsFrame("<SCRIPT src='x.js'></SCRIPT>")).toBe(true);
  });

  it("aren't static HTML, even with event handlers", () => {
    expect(needsFrame('<table class="dataframe"><tr><td>1</td></tr></table>')).toBe(false);
    expect(needsFrame('<img src="x" onerror="alert(1)">')).toBe(false);
    expect(needsFrame("<p>a description of scripts</p>")).toBe(false);
    expect(needsFrame(null)).toBe(false);
  });
});

describe("script hosts an output loads from", () => {
  it("are listed once each", () => {
    const html =
      '<script src="https://cdn.bokeh.org/bokeh/release/bokeh-3.4.0.min.js"></script>' +
      "<script type='text/javascript' src='https://cdn.bokeh.org/bokeh/release/bokeh-widgets.min.js'></script>" +
      "<script src=//cdn.jsdelivr.net/npm/x></script>" +
      '<script src="http://Example.org:8080/a.js?x=1"></script>';
    expect(externalScriptHosts(html)).toEqual(["cdn.bokeh.org", "cdn.jsdelivr.net", "example.org:8080"]);
  });

  it("aren't inline scripts, relative sources or other tags", () => {
    const html =
      '<script>var s = "https://cdn.example.com/x.js";</script>' +
      '<script src="lib/local.js"></script>' +
      '<img src="https://images.example.com/a.png">' +
      '<link href="https://fonts.example.com/a.css" rel="stylesheet">';
    expect(externalScriptHosts(html)).toEqual([]);
    expect(externalScriptHosts(undefined)).toEqual([]);
  });
});

describe("the frame's document", () => {
  it("holds the output and posts its height", () => {
    const doc = buildSrcdoc("<div id=plot></div><script>draw()</script>");
    expect(doc.startsWith("<!doctype html>")).toBe(true);
    expect(doc).toContain("<body><div id=plot></div><script>draw()</script></body>");
    expect(doc).toContain(FRAME_HEIGHT_MESSAGE);
    expect(doc).toContain("ResizeObserver");
  });
});

describe("height messages", () => {
  const frame = {};
  const msg = (data, source = frame) => ({ source, data });

  it("are taken from the frame's own window", () => {
    expect(frameHeight(msg({ type: FRAME_HEIGHT_MESSAGE, height: 312.4 }), frame)).toBe(313);
  });

  it("are clamped", () => {
    expect(frameHeight(msg({ type: FRAME_HEIGHT_MESSAGE, height: 1e9 }), frame)).toBe(MAX_FRAME_HEIGHT);
    expect(frameHeight(msg({ type: FRAME_HEIGHT_MESSAGE, height: -40 }), frame)).toBe(0);
    expect(frameHeight(msg({ type: FRAME_HEIGHT_MESSAGE, height: 900 }), frame, 500)).toBe(500);
  });

  it("are ignored from other windows or without a valid height", () => {
    expect(frameHeight(msg({ type: FRAME_HEIGHT_MESSAGE, height: 100 }, {}), frame)).toBeNull();
    expect(frameHeight(msg({ type: FRAME_HEIGHT_MESSAGE, height: 100 }), null)).toBeNull();
    expect(frameHeight(msg({ type: "other", height: 100 }), frame)).toBeNull();
    expect(frameHeight(msg({ type: FRAME_HEIGHT_MESSAGE, height: "100" }), frame)).toBeNull();
    expect(frameHeight(msg({ type: FRAME_HEIGHT_MESSAGE, height: NaN }), frame)).toBeNull();
    expect(frameHeight(msg({ type: FRAME_HEIGHT_MESSAGE, height: Infinity }), frame)).toBeNull();
    expect(frameHeight(msg("100"), frame)).toBeNull();
    expect(frameHeight(null, frame)).toBeNull();
  });
});
