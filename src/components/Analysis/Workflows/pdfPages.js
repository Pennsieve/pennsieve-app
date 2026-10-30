/*
  Shows a PDF's pages as canvases in host, one under the other, each as wide
  as width (CSS px) and sharp on high-density screens. Every page gets its
  place (its size) right away; a page is drawn only once it scrolls near the
  view, so a long PDF doesn't hold all its pages in memory. pdf.js loads only
  when first used. The link must allow CORS (the curation CDN does).
  isCurrent: () => false stops the work (the viewer closed or moved on).
  Resolves to { pages, destroy }; call destroy when the viewer closes.
  onFirstPage fires once the first page is drawn.
*/
let pdfjsPromise = null;
const loadPdfjs = () => {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]).then(
      ([pdfjs, worker]) => {
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        return pdfjs;
      }
    );
    pdfjsPromise.catch(() => {
      pdfjsPromise = null;
    });
  }
  return pdfjsPromise;
};

export const renderPdfPages = async (href, host, { width, isCurrent = () => true, onFirstPage = () => {} } = {}) => {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ url: href, withCredentials: false }).promise;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let observer = null;
  const destroy = () => {
    observer?.disconnect();
    doc.destroy();
  };
  try {
    const draw = async (canvas, page, viewport) => {
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      canvas.classList.add("is-drawn");
      if (page.pageNumber === 1) onFirstPage();
    };
    const pending = new Map(); // canvas -> () => draw
    observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              for (const e of entries) {
                if (!e.isIntersecting || !pending.has(e.target)) continue;
                const run = pending.get(e.target);
                pending.delete(e.target);
                observer.unobserve(e.target);
                run().catch(() => {});
              }
            },
            { root: host.closest(".sample-viewer__scroll") || null, rootMargin: "800px 0px" }
          )
        : null;
    for (let n = 1; n <= doc.numPages; n++) {
      if (!isCurrent()) break;
      const page = await doc.getPage(n);
      const scale = width / page.getViewport({ scale: 1 }).width;
      const viewport = page.getViewport({ scale: scale * dpr });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
      canvas.setAttribute("aria-label", `Page ${n} of ${doc.numPages}`);
      canvas.className = "sample-viewer__page";
      host.appendChild(canvas);
      if (n === 1) await draw(canvas, page, viewport);
      else if (observer) {
        pending.set(canvas, () => draw(canvas, page, viewport));
        observer.observe(canvas);
      } else await draw(canvas, page, viewport);
    }
    if (!isCurrent()) destroy();
    return { pages: doc.numPages, destroy };
  } catch (err) {
    destroy();
    throw err;
  }
};
