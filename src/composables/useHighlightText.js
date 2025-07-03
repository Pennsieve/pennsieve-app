import { defaultTo, head } from 'ramda'
import DOMPurify from 'dompurify'

export function useHighlightText() {
  /**
   * Escapes special regex characters in a string
   * @param {String} string
   * @returns {String}
   */
  const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * Replaces matched search text with bolded version
   * @param {String} needle
   * @param {String} stack
   */
  const highlight = (needle, stack) => {
    if (!needle) {
      return defaultTo('', stack)
    }

    // Escape special regex characters in the search term
    const escapedNeedle = escapeRegExp(needle)
    const regex = new RegExp(escapedNeedle, 'gi')
    const matched = stack.match(regex)

    if (matched && matched.length >= 1) {
      return stack.replace(regex, `<strong>${head(matched)}</strong>`)
    }

    // Use DOMPurify for sanitization
    return DOMPurify.sanitize(stack, { ALLOWED_TAGS: ['strong'] })
  }

  return {
    highlight
  }
}