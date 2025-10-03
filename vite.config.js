import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
// import ElementPlus from 'unplugin-element-plus/vite'

import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";


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
      resolvers: [ElementPlusResolver({importStyle: "sass",})],
    }),
  ],
  define: {
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    dedupe: ['@aws-amplify/auth', '@aws-amplify/core',]
  },
  optimizeDeps: {
    include: ['@aws-amplify','@aws-amplify/auth'],  
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
