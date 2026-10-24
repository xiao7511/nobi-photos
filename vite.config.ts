import { defineConfig, loadEnv } from 'vite'
import process from 'node:process'
import { accountConfig } from './src/domain/accountConfig.ts'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const account = accountConfig(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY)
  return {
    // Capacitor runs against the device's WebView, not the desktop browser.
    // The test phone has Chromium 101; preserve legacy media query syntax.
    build: { target: ['chrome100', 'safari15'], cssTarget: ['chrome100', 'safari15'] },
    plugins: [
      {
        name: 'nobi-account-csp',
        transformIndexHtml(html) {
          return account
            ? html.replace("connect-src 'self'", `connect-src 'self' ${account.url}`)
            : html
        },
      },
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
  }
})
