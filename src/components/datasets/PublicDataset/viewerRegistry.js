// Read-only file-preview registry for public (Discover) datasets.
// Ported from pennsieve-discover-app2 config/viewerRegistry.ts (V1 subset:
// markdown / ome-tiff / image / text). Timeseries + OME-Zarr/neuroglancer
// (which need viewer assets + streaming) are future phases.

const getFileExtension = (uri) => (uri?.toLowerCase().split(".").pop() || "");

// Order matters — first match wins.
export const viewerRegistry = [
  {
    type: "markdown",
    component: "Markdown",
    extensions: [".md", ".markdown"],
    needs: "content",
    loadingMessage: "Loading markdown file...",
    getProps: (ctx) => ({ markdownText: ctx.fileContent, disabled: true }),
  },
  {
    type: "ome-tiff",
    component: "OmeViewer",
    // Custom matcher to distinguish from a plain .tiff.
    match: (uri) => {
      const lower = (uri || "").toLowerCase();
      return lower.endsWith(".ome.tiff") || lower.endsWith(".ome.tif");
    },
    needs: "url",
    getProps: (ctx) => ({ sourceType: "ome-tiff", source: ctx.imgSourceUrl }),
  },
  {
    type: "image",
    component: "img", // native <img>, fed the presigned URL
    extensions: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico", ".avif"],
    needs: "url",
  },
  {
    type: "text",
    component: "TextViewer",
    extensions: [".txt", ".csv", ".json", ".xml", ".log", ".yaml", ".yml"],
    needs: "content",
    loadingMessage: "Loading text file...",
    getProps: (ctx) => ({
      content: ctx.fileContent,
      fileType: getFileExtension(ctx.fileUri),
      showLineNumbers: true,
      maxHeight: "70vh",
    }),
  },
];

export function resolveViewer(uri, packageType) {
  const lowerUri = uri?.toLowerCase() || "";
  for (const viewer of viewerRegistry) {
    if (viewer.match && viewer.match(uri, packageType)) return viewer;
    if (viewer.packageTypes?.includes(packageType)) return viewer;
    if (viewer.extensions?.some((ext) => lowerUri.endsWith(ext))) return viewer;
  }
  return null;
}
