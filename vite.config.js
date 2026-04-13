import { fileURLToPath, URL } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";
import { nodePolyfills } from 'vite-plugin-node-polyfills';


// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 3000,
  },
  preview: {
    port: 3000,
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "./src/styles/index.scss" as *;`,
        silenceDeprecations: ['global-builtin', 'legacy-js-api', 'new-global', 'color-functions'],
      },
    },
  },
  plugins: [
    // CloudFront asset proxy for neuroglancer dev.
    // Stores signing params in memory, appends them to proxied requests.
    {
      name: 'neuroglancer-cf-proxy',
      configureServer(server) {
        let cfParams = ''

        // Endpoint to set signing params (called by NeuroglancerViewer.vue)
        server.middlewares.use('/neuroglancer-cf-params', (req, res) => {
          if (req.method === 'POST') {
            let body = ''
            req.on('data', (chunk) => { body += chunk })
            req.on('end', () => {
              cfParams = body
              res.writeHead(200)
              res.end('ok')
            })
          } else {
            res.writeHead(405)
            res.end()
          }
        })

        // Proxy: /neuroglancer-cf-proxy/path → https://assets.pennsieve.net/path?signing-params
        server.middlewares.use('/neuroglancer-cf-proxy', async (req, res) => {
          const path = req.url || '/'
          const target = `https://assets.pennsieve.net${path}${cfParams ? (path.includes('?') ? '&' : '?') + cfParams : ''}`
          try {
            const upstream = await fetch(target)
            res.writeHead(upstream.status, {
              'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
              'Access-Control-Allow-Origin': '*',
            })
            const buffer = Buffer.from(await upstream.arrayBuffer())
            res.end(buffer)
          } catch (err) {
            res.writeHead(502)
            res.end(err.message)
          }
        })
      },
    },
    // Serve dist/neuroglancer/ during dev
    {
      name: 'serve-neuroglancer',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || ''
          if (!url.startsWith('/neuroglancer/') && url !== '/neuroglancer') {
            return next()
          }
          const ngDir = resolve(__dirname, 'dist/neuroglancer')
          if (!existsSync(ngDir)) {
            res.statusCode = 404
            res.end('Neuroglancer not built. Run: npm run build-neuroglancer')
            return
          }
          // Strip /neuroglancer prefix and query string
          const subPath = url.replace(/^\/neuroglancer\/?/, '').split('?')[0].split('#')[0]
          const filePath = resolve(ngDir, subPath === '' ? 'index.html' : subPath)
          if (existsSync(filePath)) {
            const ext = filePath.split('.').pop()
            const mimeTypes = { html: 'text/html', js: 'application/javascript', css: 'text/css', map: 'application/json', wasm: 'application/wasm' }
            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream')
            res.end(readFileSync(filePath))
          } else {
            next()
          }
        })
      },
    },
    vue(),
    // ElementPlus({
    //   useSource: true,
    // }),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver({importStyle: false})],
    }),
    nodePolyfills({
      include: ['util'],
      globals: {
        process: true,
        Buffer: true,
      },
    }),
  ],
  define: {
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Need to build for esnext to support PDF Viewer which has a await statement that needs next es
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm'],
    esbuildOptions: {
      target: "esnext",
    },
  },
  test: {
    // enable jest-like global test APIs
    globals: true,
    // max duration for async calls in tests
    testTimeout: 200,
    setupFiles: ['./src/test/setup.ts'],
    server: {
      deps: {
        inline:['element-plus'],
      },
    },

    // simulate DOM with happy-dom
    // (requires installing happy-dom as a peer dependency)
    environment: 'happy-dom'
  }
});
