/* eslint-disable no-undef */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/router', () => ({
    default: { currentRoute: { value: { params: { datasetId: 'N:dataset:test' } } } },
}))
vi.mock('@/composables/useGetToken', () => ({
    useGetToken: () => Promise.resolve('test-token'),
}))
vi.mock('../utils/event-bus', () => ({
    default: { $emit: vi.fn(), $on: vi.fn(), $off: vi.fn() },
}))
// The AWS SDK is only exercised by UploadFiles, which these tests don't drive.
// Stubbed so importing the store doesn't pull the real client in.
vi.mock('@aws-sdk/lib-storage', () => ({ Upload: class {} }))
vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: class {},
    ChecksumAlgorithm: { SHA256: 'SHA256' },
}))

import { actions, getters, mutations } from './uploadModule'
import finalizeJournal from '../utils/finalizeJournal'

const entry = (n) => ({
    uploadId: `upload-${n}`,
    size: 10,
    sha256: `sha-${n}`,
    mapKey: `key-${n}`,
})

const makeContext = (pending) => {
    const state = {
        manifestNodeId: 'manifest-1',
        onConflict: 'keepBoth',
        pendingFinalize: [...pending],
        uploadFileMap: new Map(
            pending.map((p) => [p.mapKey, { status: 'processing' }])
        ),
        isUploading: false,
    }
    return {
        state,
        rootState: { config: { api2Url: 'https://api.test' } },
        commit: (name, payload) => mutations[name](state, payload),
    }
}

// Resolves once the pending microtask/timer queue has drained, so an action
// that is mid-`await` has a chance to reach its next suspension point.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('uploadModule finalize drain', () => {
    beforeEach(() => {
        window.localStorage.clear()
        vi.restoreAllMocks()
    })

    it('queues a contending flush instead of dropping its batch', async () => {
        const bodies = []
        let releaseFirst
        const firstGate = new Promise((r) => { releaseFirst = r })
        let callCount = 0

        global.fetch = vi.fn(async (url, opts) => {
            const body = JSON.parse(opts.body)
            bodies.push(body)
            // Hold the first POST open so the second caller has to contend.
            if (++callCount === 1) await firstGate
            return {
                ok: true,
                json: async () => ({
                    results: body.files.map((f) => ({
                        uploadId: f.uploadId,
                        status: 'finalized',
                    })),
                }),
            }
        })

        const ctx = makeContext([entry(1), entry(2)])

        const first = actions.flushFinalizeBatch(ctx)
        await settle()

        // First flush has claimed its batch and is blocked in fetch.
        expect(bodies).toHaveLength(1)
        expect(ctx.state.pendingFinalize).toHaveLength(0)

        // Two more files finish their PUT while that POST is still in flight.
        // This is the window the old boolean mutex dropped on the floor.
        ctx.state.pendingFinalize.push(entry(3), entry(4))

        const second = actions.flushFinalizeBatch(ctx)
        releaseFirst()
        await first
        await second

        expect(bodies).toHaveLength(2)
        expect(bodies[1].files.map((f) => f.uploadId)).toEqual([
            'upload-3',
            'upload-4',
        ])
        expect(ctx.state.pendingFinalize).toHaveLength(0)
    })

    it('empties the queue even when the request fails, so a drain loop terminates', async () => {
        global.fetch = vi.fn(async () => ({
            ok: false,
            status: 500,
            text: async () => 'boom',
        }))

        const ctx = makeContext([entry(1)])
        await actions.flushFinalizeBatch(ctx)

        expect(ctx.state.pendingFinalize).toHaveLength(0)
        expect(ctx.state.uploadFileMap.get('key-1').status).toBe('failed')
    })

    it('keeps journal entries after a request-level failure and clears them after a verdict', async () => {
        finalizeJournal.add([{
            manifestNodeId: 'manifest-1',
            datasetId: 'N:dataset:test',
            uploadId: 'upload-1',
            size: 10,
            sha256: 'sha-1',
            onConflict: 'keepBoth',
        }])
        expect(finalizeJournal.count()).toBe(1)

        // Request-level failure: no per-file verdict, entry must survive for a
        // later replay.
        global.fetch = vi.fn(async () => { throw new Error('offline') })
        await actions.flushFinalizeBatch(makeContext([entry(1)]))
        expect(finalizeJournal.count()).toBe(1)

        // Server verdict: entry is settled either way and drops out.
        global.fetch = vi.fn(async (url, opts) => {
            const body = JSON.parse(opts.body)
            return {
                ok: true,
                json: async () => ({
                    results: body.files.map((f) => ({
                        uploadId: f.uploadId,
                        status: 'failed',
                        error: 'object not found',
                    })),
                }),
            }
        })
        await actions.flushFinalizeBatch(makeContext([entry(1)]))
        expect(finalizeJournal.count()).toBe(0)
    })

    it('SET_FILE_STATUS ignores rows already cleared from the map', () => {
        const state = { uploadFileMap: new Map() }
        expect(() =>
            mutations.SET_FILE_STATUS(state, { key: 'gone', status: 'finalized' })
        ).not.toThrow()
    })

    it('reports unfinalized work while the journal is non-empty', () => {
        const state = { isUploading: false }
        expect(getters.getHasUnfinalizedWork(state)()).toBe(false)
        finalizeJournal.add([{
            manifestNodeId: 'm',
            datasetId: 'd',
            uploadId: 'u',
            size: 1,
            sha256: 's',
        }])
        expect(getters.getHasUnfinalizedWork(state)()).toBe(true)
    })
})

describe('finalizeJournal', () => {
    beforeEach(() => window.localStorage.clear())

    it('groups outstanding files by dataset, manifest and conflict strategy', () => {
        finalizeJournal.add([
            { manifestNodeId: 'm1', datasetId: 'd1', uploadId: 'a', size: 1, sha256: 'x', onConflict: 'keepBoth' },
            { manifestNodeId: 'm1', datasetId: 'd1', uploadId: 'b', size: 2, sha256: 'y', onConflict: 'keepBoth' },
            { manifestNodeId: 'm2', datasetId: 'd1', uploadId: 'c', size: 3, sha256: 'z', onConflict: 'replace' },
        ])

        const groups = finalizeJournal.groups()
        expect(groups).toHaveLength(2)

        const keepBoth = groups.find((g) => g.onConflict === 'keepBoth')
        expect(keepBoth.manifestNodeId).toBe('m1')
        expect(keepBoth.files.map((f) => f.uploadId)).toEqual(['a', 'b'])

        const replace = groups.find((g) => g.onConflict === 'replace')
        expect(replace.files).toEqual([{ uploadId: 'c', size: 3, sha256: 'z' }])
    })

    it('deduplicates repeated adds of the same uploadId', () => {
        const e = { manifestNodeId: 'm', datasetId: 'd', uploadId: 'a', size: 1, sha256: 'x' }
        finalizeJournal.add([e])
        finalizeJournal.add([e])
        expect(finalizeJournal.count()).toBe(1)
    })

    it('survives localStorage being unavailable', () => {
        const spy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError')
        })
        expect(() =>
            finalizeJournal.add([{ manifestNodeId: 'm', datasetId: 'd', uploadId: 'a', size: 1, sha256: 'x' }])
        ).not.toThrow()
        spy.mockRestore()
    })
})
