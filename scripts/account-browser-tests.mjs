import { spawnSync } from 'node:child_process'
import process from 'node:process'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Only this isolated build has a synthetic .invalid endpoint, intercepted by the tests.
const env = {
  ...process.env,
  VITE_SUPABASE_URL: 'https://nobi-auth.invalid',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_nobi_photos_synthetic_test_only',
}
for (const args of [
  ['node_modules/vite/bin/vite.js', 'build', '--outDir', 'artifacts/account-dist'],
  ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.account.config.ts'],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
  if (args[1] === 'build')
    assert.ok(
      readFileSync('artifacts/account-dist/index.html', 'utf8').includes(
        "connect-src 'self' https://nobi-auth.invalid ",
      ),
      'The isolated account build must pin its synthetic endpoint in CSP',
    )
}
