import {
  getManifestAsset,
  parseManifestText,
} from './useAppManifest'

/*
  Verbatim from GET /applications/store/3da0ad0a-9cc0-4c22-94aa-2204eb41a77a —
  the shape the backend actually serves.
*/
const NESTED_YAML = [
  '# yaml-language-server: $schema=./pennsieve-app-schema.json',
  'schemaVersion: 1.0.0',
  'application:',
  '  id: test-private-repo-3',
  '  name: test-private-repo-3',
  '  type: processor',
  'runtime:',
  '  cpu: 1024',
  '  memory: 2048',
  '  computeTypes:',
  '    - standard',
  'parameters:',
  '  - name: mode',
  '    type: string',
  '    defaultValue: fast',
  '    validValues:',
  '      - fast',
  '      - accurate',
].join('\n')

describe('useAppManifest helpers', () => {
  describe('getManifestAsset', () => {
    it('finds app.yml regardless of casing or extension', () => {
      expect(getManifestAsset({ 'app.yml': 'a' })).toBe('a')
      expect(getManifestAsset({ 'app.yaml': 'b' })).toBe('b')
      expect(getManifestAsset({ 'APP.YML': 'c' })).toBe('c')
    })

    it('returns empty when there is no manifest', () => {
      // The common case: most applications ship a README and nothing else.
      expect(getManifestAsset({ 'README.md': '# hi' })).toBe('')
      expect(getManifestAsset(undefined)).toBe('')
      expect(getManifestAsset(null)).toBe('')
    })

    it('does not match a path-prefixed key', () => {
      expect(getManifestAsset({ 'docs/app.yml': 'x' })).toBe('')
    })
  })

  describe('parseManifestText', () => {
    it('parses the backend nested shape', () => {
      const parsed = parseManifestText(NESTED_YAML)
      expect(parsed).not.toBeNull()
      expect(parsed.meta.name).toBe('test-private-repo-3')
      expect(parsed.schema.resources).toEqual({ cpu: 1024, memory: 2048 })
      expect(parsed.schema.parameters[0]).toMatchObject({
        name: 'mode',
        defaultValue: 'fast',
        validValues: ['fast', 'accurate'],
      })
    })

    it('returns null rather than throwing on unusable input', () => {
      // A caller mid-flow (dropping a node) must fall back to defaults, not break.
      expect(parseManifestText('')).toBeNull()
      expect(parseManifestText('   ')).toBeNull()
      expect(parseManifestText(undefined)).toBeNull()
      expect(parseManifestText('a: [unclosed')).toBeNull()
      // Valid YAML, but not a mapping.
      expect(parseManifestText('just a string')).toBeNull()
      expect(parseManifestText('- one\n- two')).toBeNull()
    })
  })
})
