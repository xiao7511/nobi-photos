import assert from 'node:assert/strict'
import console from 'node:console'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import config from '../capacitor.config.ts'

assert.equal(config.appId, 'app.nobi.photos')
assert.equal(config.webDir, 'dist')
assert.equal(config.server?.url, undefined)
assert.equal(config.server?.cleartext, undefined)
assert.equal(config.plugins?.CapacitorSQLite.iosDatabaseLocation, 'Library/NoCloud')
const manifest = readFileSync(
  new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url),
  'utf8',
)
assert.match(manifest, /android:allowBackup="false"/)
assert.match(manifest, /android.permission.INTERNET" tools:node="remove"/)
const ios = readFileSync(new URL('../ios/App/App/Info.plist', import.meta.url), 'utf8')
assert.match(ios, /NSPhotoLibraryUsageDescription/)
assert.doesNotMatch(ios, /NSPhotoLibraryAddUsageDescription/)
assert.ok(existsSync(fileURLToPath(new URL('../dist/index.html', import.meta.url))))
console.log(
  'Capacitor privacy configuration passed: local assets, read-only library, local SQLite, backup disabled.',
)
