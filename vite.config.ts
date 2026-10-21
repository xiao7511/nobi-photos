import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      injectRegister: false,
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'art/*.svg'],
      manifest: {
        name: 'NOBI Photos · Nobi 相册',
        short_name: 'NOBI',
        description: '照片留在本地，回忆自在生长。',
        theme_color: '#214f42',
        background_color: '#f6f7f2',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        navigateFallback: '/index.html',
      },
    }),
  ],
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
})
