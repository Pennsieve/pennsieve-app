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
