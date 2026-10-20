import assert from 'node:assert/strict'
import console from 'node:console'
import { existsSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import config from '../capacitor.config.ts'

assert.equal(config.appId, 'app.nobi.photos')
assert.equal(config.webDir, 'dist')
assert.equal(config.server?.url, undefined)
assert.equal(config.server?.cleartext, undefined)
assert.equal(config.plugins, undefined)
assert.ok(existsSync(fileURLToPath(new URL('../dist/index.html', import.meta.url))))
console.log('Capacitor configuration passed: local dist assets, no remote server or plugins.')
