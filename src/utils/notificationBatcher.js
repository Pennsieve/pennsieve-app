// utils/notificationBatcher.js
// Coalesces bursts of same-category events on the same dataset (e.g. a bulk
// upload firing hundreds of FILES events) into a single NotificationEvent
// instead of flooding a user's feed with one row per event.

function defaultFormatMessage(count, sampleEvent) {
  if (count === 1) {
    return sampleEvent.message
  }
  return `${count} ${sampleEvent.category.toLowerCase()} events`
}

function bucketKey(event) {
  return `${event.datasetId}:${event.category}:${event.eventType}`
}

export class NotificationBatcher {
  constructor({ windowMs = 5 * 60 * 1000, onFlush, formatMessage = defaultFormatMessage } = {}) {
    if (typeof onFlush !== 'function') {
      throw new Error('NotificationBatcher requires an onFlush callback')
    }
    this.windowMs = windowMs
    this.onFlush = onFlush
    this.formatMessage = formatMessage
    this.buckets = new Map()
  }

  ingest(event) {
    const key = bucketKey(event)
    const bucket = this.buckets.get(key)

    if (!bucket) {
      this.buckets.set(key, {
        count: 1,
        sampleEvent: event,
        firstAt: event.createdAt,
        timer: setTimeout(() => this.flush(key), this.windowMs)
      })
      return
    }

    bucket.count += 1
  }

  flush(key) {
    const bucket = this.buckets.get(key)
    if (!bucket) {
      return
    }

    clearTimeout(bucket.timer)
    this.buckets.delete(key)

    const { datasetId, category, eventType } = bucket.sampleEvent
    this.onFlush({
      datasetId,
      category,
      eventType,
      count: bucket.count,
      message: this.formatMessage(bucket.count, bucket.sampleEvent),
      createdAt: bucket.firstAt
    })
  }

  flushAll() {
    Array.from(this.buckets.keys()).forEach(key => this.flush(key))
  }
}
