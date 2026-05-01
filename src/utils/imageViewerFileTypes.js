/**
 * Pure functions for detecting image-viewer-eligible file types.
 * Used by upload components and viewer logic.
 */

export function isOMETiff(filename) {
  const lower = filename.toLowerCase()
  return lower.endsWith('.ome.tiff') || lower.endsWith('.ome.tif')
}

export function isOMEZarr(filename) {
  const lower = filename.toLowerCase()
  return lower.endsWith('.ome.zarr') || lower.endsWith('.zarr')
}

export function isImageViewerEligible(filename) {
  return isOMETiff(filename) || isOMEZarr(filename)
}
