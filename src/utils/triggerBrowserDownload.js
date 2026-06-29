/**
 * Trigger a browser download for a (presigned) file URL.
 *
 * NOTE: Whether the browser saves vs. opens the file is controlled by the
 * S3 object's Content-Disposition. To *force* a download (never open inline),
 * the presigned URL must be generated with `ResponseContentDisposition=attachment`
 * server-side — see the download-manifest follow-up in
 * docs/public-datasets-in-workspace-plan.md. The `download` attribute below is
 * ignored for cross-origin URLs, so it only helps same-origin cases.
 *
 * @param {string} url
 * @param {string} [fileName]
 */
export function triggerBrowserDownload(url, fileName) {
  if (!url) return;
  const link = document.createElement("a");
  link.href = url;
  if (fileName) link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
