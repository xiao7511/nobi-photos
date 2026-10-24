import { spawnSync } from 'node:child_process'
import process from 'node:process'
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
}
