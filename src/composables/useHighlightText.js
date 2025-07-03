import { defaultTo, head } from 'ramda'
import DOMPurify from 'dompurify'

export function useHighlightText() {
  /**
   * Replaces matched search text with bolded version
   * @param {String} needle
   * @param {String} stack
   */
  const highlight = (needle, stack) => {
    if (!needle) {
      return defaultTo('', stack)
    }
    
    const regex = new RegExp(needle, 'gi')
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