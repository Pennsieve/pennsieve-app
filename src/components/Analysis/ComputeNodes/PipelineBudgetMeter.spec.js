import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PipelineBudgetMeter from './PipelineBudgetMeter.vue'

const axis = { key: 'userConcurrency', scope: 'user', label: 'Your runs in flight', limit: 1, active: 1, remaining: 0, source: 'node-default', utilization: 1, disabled: false }

const meter = (blockedAxis) =>
  mount(PipelineBudgetMeter, {
    props: {
      budget: { allowed: false, blockedAxis, reason: 'blocked' },
      concurrencyAxes: [axis],
      level: 'over',
    },
  })

describe('PipelineBudgetMeter', () => {
  it('names the limit a run is blocked on', () => {
    expect(meter('user-concurrency').find('.pill-over').text()).toBe('At your run limit')
    expect(meter('node-concurrency').find('.pill-over').text()).toBe('At the node’s run limit')
    expect(meter('user-daily').find('.pill-over').text()).toBe('Your daily budget reached')
  })

  it('says open notebooks count toward your run limit', async () => {
    const w = meter('user-concurrency')
    await w.find('.collapsed-row').trigger('click')
    expect(w.find('.remedy').text()).toContain('open notebooks count')
  })
})
