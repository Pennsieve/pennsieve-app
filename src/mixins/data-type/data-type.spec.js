import { shallowMount} from '@vue/test-utils'

import DataType from './'
import TestComponent from "../test-component.vue";

describe('DataType Mixin', () => {

  let cmp

  beforeEach(() => {
    cmp = shallowMount(TestComponent, {
      mixins: [DataType],
      data() {
        return {
          placeholder: ''
        }
      }
    })
  })

  it('getRawDataType(): array', () => {
    const prop = {
      'name': 'multiple_values',
      'displayName': 'Multiple Values',
      'dataType': {
        'type': 'array',
        'items':{
          'type': 'String'
        }
      }
    }
    const dataType = cmp.vm.getRawDataType(prop)
    expect(dataType).toBe('String')
  })

  it('getRawDataType(): enum', () => {
    const prop = {
      'name': 'enum_value',
      'displayName': 'Enum value',
      'dataType': {
        'type': 'enum',
        'items':{
          'enum': [1, 2, 3],
          'type': 'Long'
        }
      }
    }
    const dataType = cmp.vm.getRawDataType(prop)
    expect(dataType).toBe('Long')
  })

  it('getRawDataType(): Simple Data Type', () => {
    const prop = {
      'name': 'simple_value',
      'displayName': 'Simple Value',
      'dataType': 'String',
    }
    const dataType = cmp.vm.getRawDataType(prop)
    expect(dataType).toBe('String')
  })

  it('formatDataType(): DateTime', () => {
    const prop = {
      'name': 'simple_value',
      'displayName': 'Simple Value',
      'dataType': 'DateTime',
    }
    const dataType = cmp.vm.formatDataType(prop)
    expect(dataType).toBe('Date')
  })

  it('formatDataType(): Long', () => {
    const prop = {
      'name': 'simple_value',
      'displayName': 'Simple Value',
      'dataType': 'Long',
    }
    const dataType = cmp.vm.formatDataType(prop)
    expect(dataType).toBe('Number')
  })

  it('formatDataType(): Double', () => {
    const prop = {
      'name': 'simple_value',
      'displayName': 'Simple Value',
      'dataType': 'Double',
    }
    const dataType = cmp.vm.formatDataType(prop)
    expect(dataType).toBe('Decimal')
  })

  it('formatDataType(): String', () => {
    const prop = {
      'name': 'simple_value',
      'displayName': 'Simple Value',
      'dataType': 'String',
    }
    const dataType = cmp.vm.formatDataType(prop)
    expect(dataType).toBe('String')
  })
})