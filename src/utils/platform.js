// Platform-detection helpers for keyboard-shortcut display.
//
// macOS uses ⌘ for the Command key; Windows / Linux use Ctrl. The
// shortcut LOGIC (in App.vue) already handles both via `metaKey || ctrlKey`;
// these helpers are just for the user-facing label so the right symbol
// renders on each platform.
//
// Use the value in a `computed()` or template — `navigator.platform` is
// stable for the session, so a one-time read is fine.

const PLATFORM = typeof navigator !== 'undefined' ? navigator.platform || '' : ''

export const isMac = /Mac|iPod|iPhone|iPad/.test(PLATFORM)

// Display label for the Cmd-or-Ctrl + K shortcut. Used by Spotlight's
// ⌘K badge and by ChatPanel's tip text. Macs see "⌘K", everyone else
// sees "Ctrl+K".
export const cmdKLabel = isMac ? '⌘K' : 'Ctrl+K'

// Parts variant — useful when the consumer wants to wrap the modifier
// + key in separate <kbd> tags.
export const cmdKParts = isMac ? ['⌘', 'K'] : ['Ctrl', 'K']
