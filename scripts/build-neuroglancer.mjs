/**
 * Builds neuroglancer from the npm package into dist/neuroglancer/.
 *
 * Neuroglancer can't be bundled through Vite because its workers require
 * IIFE format which conflicts with Vite's code-splitting. This script
 * uses esbuild directly to build it as a standalone app.
 */

import { build } from 'esbuild'
import { copyFileSync, mkdirSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const outdir = resolve(rootDir, 'dist/neuroglancer')

mkdirSync(outdir, { recursive: true })

// Plugin to handle Vite-style ?raw imports (used by neuroglancer for SVGs)
const rawImportPlugin = {
  name: 'raw-import',
  setup(build) {
    build.onResolve({ filter: /\?raw$/ }, (args) => {
      const bare = args.path.replace(/\?raw$/, '')
      // Bare specifier (e.g. "ikonate/icons/close.svg") — resolve from node_modules
      const resolved = bare.startsWith('.')
        ? resolve(args.resolveDir, bare)
        : resolve(rootDir, 'node_modules', bare)
      return { path: resolved, namespace: 'raw-import' }
    })
    build.onLoad({ filter: /.*/, namespace: 'raw-import' }, (args) => {
      const content = readFileSync(args.path, 'utf8')
      return { contents: content, loader: 'text' }
    })
  },
}

// Build the main entry and worker bundles
await build({
  entryPoints: [
    resolve(rootDir, 'node_modules/neuroglancer/lib/main.bundle.js'),
    resolve(rootDir, 'node_modules/neuroglancer/lib/chunk_worker.bundle.js'),
    resolve(rootDir, 'node_modules/neuroglancer/lib/async_computation.bundle.js'),
  ],
  bundle: true,
  outdir,
  format: 'esm',
  splitting: true,
  sourcemap: true,
  minify: true,
  target: ['chrome100', 'firefox100', 'safari15'],
  define: {
    'NEUROGLANCER_DEFAULT_STATE_FRAGMENT': 'undefined',
  },
  loader: {
    '.wasm': 'file',
    '.json': 'json',
    '.css': 'css',
  },
  plugins: [rawImportPlugin],
  conditions: [],
})

// Copy the HTML page and Service Worker
copyFileSync(
  resolve(rootDir, 'src/neuroglancer/index.html'),
  resolve(outdir, 'index.html')
)
copyFileSync(
  resolve(rootDir, 'src/neuroglancer/sw.js'),
  resolve(outdir, 'sw.js')
)

console.log('Neuroglancer built to dist/neuroglancer/')
