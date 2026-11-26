import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
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
        additionalData: `@use "@/styles/index.scss" as *;`,
        silenceDeprecations: ['global-builtin', 'legacy-js-api', 'new-global', 'color-functions'],
      },
    },
  },
  plugins: [
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
    // One copy of what the app and @pennsieve/notebooks share (its peers and
    // dependencies), from the app's node_modules, also when the package is
    // linked from a local checkout (npm link).
    dedupe: [
      "vue",
      "vue-router",
      "element-plus",
      "@element-plus/icons-vue",
      "@jupyterlab/services",
      "@codemirror/autocomplete",
      "@codemirror/commands",
      "@codemirror/lang-markdown",
      "@codemirror/lang-python",
      "@codemirror/language",
      "@codemirror/state",
      "@codemirror/view",
      "dompurify",
      "katex",
      "marked",
      "plotly.js-dist",
      "ramda",
      "vega",
      "vega-embed",
      "vega-interpreter",
      "vega-lite",
    ],
  },
  // Need to build for esnext to support PDF Viewer which has a await statement that needs next es
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm'],
    rolldownOptions: {
      transform: {
        target: "esnext",
      },
    },
  },
  test: {
    // enable jest-like global test APIs
    globals: true,
    // max duration of a test: Vitest's default. 200ms timed out synchronous
    // tests on a busy machine (Jenkins) once Vitest 5 came in.
    testTimeout: 5000,
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
