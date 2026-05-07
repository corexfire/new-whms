import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['stores/**', 'composables/**', 'services/**'],
      exclude: ['node_modules/**', '.nuxt/**']
    },
    server: {
      deps: {
        inline: ['pinia']
      }
    }
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, '.'),
      '@': resolve(__dirname, '.')
    }
  },
  esbuild: {
    // Don't use Nuxt's tsconfig, use our standalone one
    tsconfigRaw: '{}'
  }
})
