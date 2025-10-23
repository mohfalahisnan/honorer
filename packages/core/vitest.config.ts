import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@honorer/core': path.resolve(__dirname, 'src')
    }
  },
  test: {
    environment: 'node',
    exclude: ['dist/**', '**/node_modules/**']
  }
})