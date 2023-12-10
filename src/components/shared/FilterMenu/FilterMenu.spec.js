import { mount } from '@vue/test-utils'
import FilterMenu from './FilterMenu.vue'

const options = [
  {
    label: 'foo',
    value: 'FOO'
  },
  {
    label: 'bar',
    value: 'BAR'
  }
]

describe('FilterMenu.vue', () => {
  let cmp = {}

  beforeEach(() => {
    cmp = mount(FilterMenu, {
      props: {
        options: options,
        selectedOption: options[0]
      }
    })
  })

  it('Displays label properly', () => {
    const selectedLabel = cmp.find('[data-selected-label]')
    expect(selectedLabel.text()).toBe('Show foo')
  })

})
