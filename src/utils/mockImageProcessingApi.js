/**
 * Mock API for image processing (prototype).
 * Simulates server-side processing for the Neuroglancer viewer.
 */

const jobs = new Map()

export function submitProcessForViewer({ packageId, datasetId, options = {} }) {
  const jobId = `job-${Date.now()}`
  const job = {
    jobId,
    packageId,
    datasetId,
    options,
    status: 'processing',
    startedAt: Date.now(),
  }
  jobs.set(packageId, job)

  // Auto-complete after 5 seconds
  setTimeout(() => {
    const j = jobs.get(packageId)
    if (j && j.status === 'processing') {
      j.status = 'ready'
      j.completedAt = Date.now()
      j.assets = [
        {
          asset_type: 'ome-zarr',
          asset_url: `s3://mock-bucket/processed/${packageId}/data.ome.zarr`,
          status: 'ready',
          name: 'Neuroglancer',
        },
      ]
    }
  }, 5000)

  return Promise.resolve(job)
}

export function checkProcessingStatus(packageId) {
  const job = jobs.get(packageId)
  if (!job) {
    return Promise.resolve({ status: 'none' })
  }
  return Promise.resolve({
    status: job.status,
    assets: job.assets || [],
  })
}

export function submitBatchProcessForViewer(files, options = {}) {
  console.log('[mock] Batch processing requested:', {
    fileCount: files.length,
    files: files.map(f => f.name || f),
    options,
  })
  return Promise.resolve({
    status: 'accepted',
    fileCount: files.length,
  })
}
