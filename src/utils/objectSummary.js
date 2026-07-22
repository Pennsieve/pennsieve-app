/**
 * Strip literal HTML tags from source text (e.g. "<br />" in NLM reference
 * fields) for plain-text display. Leaves non-tag uses of "<" alone.
 */
export function stripHtml(s) {
  return s.includes('<') ? s.replace(/<\/?[a-z][^>]*>/gi, ' ').replace(/\s+/g, ' ').trim() : s
}

/**
 * One-line human summary for an object value (e.g. an xref entry). Prefers a
 * name-ish + value-ish key pair ("NINDS: C57136"), falling back to the first
 * few primitive fields as "key: value" pairs.
 */
export function summarizeObject(obj) {
  const primitives = Object.entries(obj).filter(
    ([, v]) => v != null && typeof v !== 'object'
  )
  const pick = (keys) => {
    for (const key of keys) {
      const hit = primitives.find(([k]) => k.toLowerCase() === key)
      if (hit) return String(hit[1])
    }
    return null
  }
  const name = pick(['label', 'name', 'title', 'system', 'source', 'key', 'type'])
  const val = pick(['value', 'id', 'code', 'identifier', 'url'])
  if (name && val && name !== val) return `${name}: ${val}`
  if (name || val) return name || val
  if (primitives.length) {
    return primitives.slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ')
  }
  return JSON.stringify(obj)
}
