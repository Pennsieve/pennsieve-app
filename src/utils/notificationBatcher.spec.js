import { NotificationBatcher } from './notificationBatcher'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function makeEvent(overrides = {}) {
  return {
    datasetId: 'N:dataset:1',
    category: 'FILES',
    eventType: 'PACKAGE_CREATED',
    message: '1 file added',
    createdAt: '2026-08-03T00:00:00.000Z',
    ...overrides
  }
}

describe('NotificationBatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requires an onFlush callback', () => {
    expect(() => new NotificationBatcher()).toThrow()
  })

  it('flushes a single event as-is after the window elapses', () => {
    const onFlush = vi.fn()
    const batcher = new NotificationBatcher({ windowMs: 1000, onFlush })

    batcher.ingest(makeEvent())
    expect(onFlush).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)

    expect(onFlush).toHaveBeenCalledTimes(1)
    expect(onFlush).toHaveBeenCalledWith({
      datasetId: 'N:dataset:1',
      category: 'FILES',
      eventType: 'PACKAGE_CREATED',
      count: 1,
      message: '1 file added',
      createdAt: '2026-08-03T00:00:00.000Z'
    })
  })

  it('coalesces multiple matching events within the window into one notification', () => {
    const onFlush = vi.fn()
    const batcher = new NotificationBatcher({ windowMs: 1000, onFlush })

    for (let i = 0; i < 212; i += 1) {
      batcher.ingest(makeEvent())
    }
    vi.advanceTimersByTime(1000)

    expect(onFlush).toHaveBeenCalledTimes(1)
    expect(onFlush.mock.calls[0][0]).toMatchObject({ count: 212, message: '212 files events' })
  })

  it('keeps buckets independent by dataset, category, and event type', () => {
    const onFlush = vi.fn()
    const batcher = new NotificationBatcher({ windowMs: 1000, onFlush })

    batcher.ingest(makeEvent({ eventType: 'PACKAGE_CREATED' }))
    batcher.ingest(makeEvent({ eventType: 'PACKAGE_DELETED' }))
    batcher.ingest(makeEvent({ datasetId: 'N:dataset:2' }))
    batcher.ingest(makeEvent({ category: 'STATUS', eventType: 'PROCESSING_COMPLETE' }))

    vi.advanceTimersByTime(1000)

    expect(onFlush).toHaveBeenCalledTimes(4)
  })

  it('starts a fresh window once a bucket flushes', () => {
    const onFlush = vi.fn()
    const batcher = new NotificationBatcher({ windowMs: 1000, onFlush })

    batcher.ingest(makeEvent())
    vi.advanceTimersByTime(1000)
    expect(onFlush).toHaveBeenCalledTimes(1)

    batcher.ingest(makeEvent())
    vi.advanceTimersByTime(1000)
    expect(onFlush).toHaveBeenCalledTimes(2)
  })

  it('supports a custom formatMessage', () => {
    const onFlush = vi.fn()
    const formatMessage = (count, sampleEvent) =>
      count === 1 ? sampleEvent.message : `${count} files added`
    const batcher = new NotificationBatcher({ windowMs: 1000, onFlush, formatMessage })

    batcher.ingest(makeEvent())
    batcher.ingest(makeEvent())
    vi.advanceTimersByTime(1000)

    expect(onFlush.mock.calls[0][0].message).toBe('2 files added')
  })

  it('flushAll immediately flushes every pending bucket', () => {
    const onFlush = vi.fn()
    const batcher = new NotificationBatcher({ windowMs: 60000, onFlush })

    batcher.ingest(makeEvent())
    batcher.ingest(makeEvent({ datasetId: 'N:dataset:2' }))
    batcher.flushAll()

    expect(onFlush).toHaveBeenCalledTimes(2)
  })

  it('is a no-op to flush a key that already flushed', () => {
    const onFlush = vi.fn()
    const batcher = new NotificationBatcher({ windowMs: 1000, onFlush })

    batcher.ingest(makeEvent())
    batcher.flushAll()
    batcher.flushAll()

    expect(onFlush).toHaveBeenCalledTimes(1)
  })
})
