import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
  plugins: [vue({ template: { transformAssetUrls: false } })],
  test: { include: ['src/**/*.test.ts'], environment: 'jsdom', restoreMocks: true, maxWorkers: 2 },
})
