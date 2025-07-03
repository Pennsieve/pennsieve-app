// composables/useSorter.js
import { ref } from 'vue'
import { ascend, compose, defaultTo, descend, head, path, prop, sort } from 'ramda'

/**
 * Returns the path to an object
 * @param {Array} list
 * @param {String} acc
 * @returns {String}
 */
const idx = (list, acc) => list.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, acc)

/**
 * Sets the descending sort based on data type
 * @param {String} key
 * @param {Object} prop
 * @param {String} type
 * @returns {Function}
 */
const sortDescending = (key, prop, type) => type === 'string' ? sortDescendingStr(key) : descend(prop)

/**
 * Sort predicate for descending order
 * @param {String} key
 * @returns {Function}
 */
const sortDescendingStr = function(key) {
  const sortPath = key.indexOf('.') >= 0 ? key.split('.') : [key]
  return function(a, b) {
    const aa = defaultTo('', idx(sortPath, a))
    const bb = defaultTo('', idx(sortPath, b))
    return bb.localeCompare(aa, 'en', { numeric: true})
  }
}

/**
 * Sets the ascending sort based on data type
 * @param {String} key
 * @param {Object} prop
 * @param {String} type
 * @returns {Function}
 */
const sortAscending = (key, prop, type) => type === 'string' ? sortAscendingStr(key) : ascend(prop)

/**
 * Sort predicate for ascending order
 * @param {String} key
 * @returns {Function}
 */
const sortAscendingStr = function(key) {
  const sortPath = key.indexOf('.') >= 0 ? key.split('.') : [key]
  return function(a, b) {
    const aa = defaultTo('', idx(sortPath, a))
    const bb = defaultTo('', idx(sortPath, b))
    return aa.localeCompare(bb, 'en', { numeric: true})
  }
}

export function useSorter() {
  // Reactive state
  const sortBy = ref('name')
  const sortDirection = ref('desc')

  /**
   * Sets the sort direction
   * @param {String} key
   * @param {String} direction
   */
  const setSortDirection = (key, direction) => {
    if (direction) {
      sortDirection.value = direction
      return
    }
    if (sortBy.value !== key) {
      sortDirection.value = 'asc'
      return
    }
    sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
  }

  /**
   * Sort a given list
   * @param {String} key
   * @param {Array} list
   * @param {String} direction
   */
  const _sorter = (key, list, direction) => {
    setSortDirection(key, direction)
    sortBy.value = key
    const property = key.indexOf('.') >= 0 ? path(key.split('.')) : prop(key)
    const dataType = typeof compose(defaultTo(''), property, head)(list)
    const sortFn = sortDirection.value === 'desc' ? sortDescending(key, property, dataType) : sortAscending(key, property, dataType)
    return sort(sortFn, list)
  }

  /**
   * Sort the list and emit sorted payload
   * Note: EventBus is not available in composition API by default
   * You'll need to either:
   * 1. Use provide/inject for event communication
   * 2. Use a global event emitter
   * 3. Return the sorted list and handle events in the component
   * @param {String} key
   * @param {Array} list
   * @param {String} direction
   */
  const setSort = (key, list, direction) => {
    const sortedList = _sorter(key, list, direction)
    // EventBus.$emit('sorted', sortedList) // Remove this line
    return sortedList // Return the sorted list instead
  }

  /**
   * Sort the list and return the sorted list
   * @param {String} key
   * @param {Array} list
   * @param {String} direction
   */
  const returnSort = (key, list, direction = "desc") => {
    return _sorter(key, list, direction)
  }

  /**
   * Compute if the package list is sorted by given column
   * @param {String} name
   */
  const isSorting = (name) => {
    return sortBy.value === name
  }

  /**
   * Calculates the sort icon
   * @param {String} nameOfColumn
   * @returns {String}
   */
  const sortIcon = (nameOfColumn) => {
    const dir = sortDirection.value === 'desc' ? 'desc' : 'asc'
    if (isSorting(nameOfColumn)) {
      return `icon-sort-${dir}`
    }
    return `icon-sort-asc`
  }

  /**
   * Sort table listener
   * @param {String} property
   * @param {Function} emit - Pass the emit function from the component
   */
  const onTableSort = (property = '', emit) => {
    if (property) {
      setSortDirection(property, 'desc')
      sortBy.value = property

      if (emit) {
        emit('set-table-sort', {
          sortBy: sortBy.value,
          sortDirection: sortDirection.value
        })
      }
    }
  }

  return {
    // Reactive state
    sortBy,
    sortDirection,
    
    // Methods
    setSortDirection,
    setSort,
    returnSort,
    isSorting,
    sortIcon,
    onTableSort
  }
}