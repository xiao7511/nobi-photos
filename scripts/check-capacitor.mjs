import assert from 'node:assert/strict'
import console from 'node:console'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import config from '../capacitor.config.ts'

assert.equal(config.appId, 'app.nobi.photos')
assert.equal(config.webDir, 'dist')
assert.equal(config.loggingBehavior, 'none')
assert.equal(config.server?.url, undefined)
assert.equal(config.server?.cleartext, undefined)
assert.equal(config.plugins?.CapacitorSQLite.iosDatabaseLocation, 'Library/NoCloud')
const manifest = readFileSync(
  new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url),
  'utf8',
)
assert.match(manifest, /android:allowBackup="false"/)
assert.match(manifest, /android.permission.INTERNET"\s*\/>/)
assert.match(manifest, /android:usesCleartextTraffic="false"/)
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')
assert.match(
  html,
  /media-src blob: https:\/\/incompetech\.com\/music\/royalty-free\/mp3-royaltyfree\//,
)
assert.match(html, /img-src 'self' data: blob:/)
assert.match(html, /connect-src 'self' ws:\/\/localhost:\* ws:\/\/127\.0\.0\.1:\*;/)
assert.match(html, /name="referrer" content="no-referrer"/)
const ios = readFileSync(new URL('../ios/App/App/Info.plist', import.meta.url), 'utf8')
assert.match(ios, /NSPhotoLibraryUsageDescription/)
assert.doesNotMatch(ios, /NSPhotoLibraryAddUsageDescription/)
assert.ok(existsSync(fileURLToPath(new URL('../dist/index.html', import.meta.url))))
for (const file of readdirSync(new URL('../dist/assets/', import.meta.url)).filter((f) =>
  f.endsWith('.css'),
)) {
  const css = readFileSync(new URL(`../dist/assets/${file}`, import.meta.url), 'utf8')
  assert.doesNotMatch(
    css,
    /@media[^{}]*\b(?:width|height)\s*[<>]/,
    'The installed WebView 101 needs min/max media queries; check Vite cssTarget',
  )
}
console.log(
  'Capacitor privacy configuration passed: local assets, read-only library, local SQLite, backup disabled.',
)
