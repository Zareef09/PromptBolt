/**
 * @fileoverview Vite build for the popup (`index.html`), MV3 service worker, and content script.
 * Output paths must stay aligned with `public/manifest.json`.
 *
 * Path aliases: `@components`, `@services`, `@storage`, `@bolt-types` → `src/*`.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@components': resolve(rootDir, 'src/components'),
      '@services': resolve(rootDir, 'src/services'),
      '@storage': resolve(rootDir, 'src/storage'),
      '@bolt-types': resolve(rootDir, 'src/types'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        background: resolve(rootDir, 'src/background.ts'),
        content: resolve(rootDir, 'src/content.ts'),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') return 'src/background.js'
          if (chunk.name === 'content') return 'src/content.js'
          return 'assets/[name]-[hash].js'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
