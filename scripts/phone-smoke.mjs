import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import process from 'node:process'
import console from 'node:console'
import { setTimeout } from 'node:timers/promises'
import { chromium } from '@playwright/test'

// Physical-device UI checks intentionally omit install, reset, permission requests,
// scans, photo selection and every metadata mutation. Select the device explicitly.
const serial = process.env.NOBI_PHONE_SERIAL
assert.ok(serial && /^[\w.-]+$/.test(serial) && !serial.startsWith('emulator-'))
const baseline = process.env.NOBI_PHONE_BASELINE === '1'
const run = promisify(execFile)
const sdk = process.env.ANDROID_HOME || join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
const adbPath = join(sdk, 'platform-tools', 'adb.exe')
const adb = async (...args) =>
  (await run(adbPath, ['-s', serial, ...args], { maxBuffer: 1024 * 1024 })).stdout.trim()
const output = resolve('artifacts', baseline ? 'phone-baseline' : 'phone-app')
await mkdir(output, { recursive: true })
assert.equal(await adb('get-state'), 'device')
assert.match(await adb('shell', 'pm', 'path', 'app.nobi.photos'), /^package:/)
const coldStart = process.env.NOBI_PHONE_COLD_START === '1'
if (coldStart) await adb('shell', 'am', 'force-stop', 'app.nobi.photos')
await adb('shell', 'am', 'start', '-n', 'app.nobi.photos/.MainActivity')
let pid
for (let i = 0; i < 30; i++) {
  try {
    pid = await adb('shell', 'pidof', 'app.nobi.photos')
  } catch {
    /* App starting. */
  }
  if (pid) break
  await setTimeout(1000)
}
assert.match(pid, /^\d+$/)
const port = await adb('forward', 'tcp:0', `localabstract:webview_devtools_remote_${pid}`)
let browser
try {
  for (let i = 0; i < 30; i++) {
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { noDefaults: true })
      break
    } catch {
      await setTimeout(1000)
    }
  }
  assert.ok(browser, 'Debug WebView unavailable')
  const page = browser
    .contexts()
    .flatMap((c) => c.pages())
    .find((p) => p.url().startsWith('https://localhost'))
  assert.ok(page, 'Refusing to inspect a non-app page')
  page.setDefaultTimeout(30000)
  // Recent Playwright assumes checkVisibility; this phone's older WebView lacks it.
  // This test-only shim supports locator visibility checks, not application code.
  const compatibility = () => {
    if (!Element.prototype.checkVisibility) {
      Element.prototype.checkVisibility = function () {
        return this.getClientRects().length > 0 && getComputedStyle(this).visibility !== 'hidden'
      }
    }
  }
  await page.addInitScript(compatibility)
  await page.evaluate(compatibility)
  await page.locator('body').count()
  const session = await page.context().newCDPSession(page)
  session.on('Runtime.executionContextCreated', ({ context }) => {
    if (context.name.includes('utility')) {
      void session
        .send('Runtime.evaluate', {
          expression: `(${compatibility.toString()})()`,
          contextId: context.id,
        })
        .catch(() => {})
    }
  })
  await session.send('Runtime.enable')
  await session.send('Runtime.evaluate', { expression: '1' })
  const errors = []
  page.on('pageerror', () => errors.push('pageerror'))
  await page.waitForFunction(() => globalThis.Capacitor?.getPlatform() === 'android')
  await page.evaluate(() => {
    location.hash = '/privacy'
  })
  await page.locator('.policy-list').waitFor()
  // Only record UI geometry and app identity, never DOM dumps, photo names or images.
  const geometry = async () =>
    page.evaluate(() => {
      const header = document.querySelector('.native-topbar')
      const nav = document.querySelector('.mobile-nav')
      return {
        width: innerWidth,
        height: innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        nativeShell: document.documentElement.classList.contains('native-app'),
        headerHeight: header?.getBoundingClientRect().height ?? 0,
        navigationVisible: nav ? getComputedStyle(nav).display !== 'none' : false,
        navigationBottom: nav?.getBoundingClientRect().bottom ?? 0,
        localOrigin: location.origin === 'https://localhost',
        nativeSqlite: !!globalThis.Capacitor.Plugins.CapacitorSQLite,
        nativePhotoLibrary: !!globalThis.Capacitor.Plugins.NobiPhotoLibrary,
      }
    })
  const metadataCounts = async () => {
    const result = await page.evaluate(async () => {
      const db = globalThis.Capacitor.Plugins.CapacitorSQLite
      return db.query({
        database: 'nobi_photos',
        statement:
          'SELECT (SELECT COUNT(*) FROM photos) AS photos, (SELECT COUNT(*) FROM albums) AS albums, (SELECT COUNT(*) FROM photo_tags) AS tags, (SELECT COUNT(*) FROM album_photos) AS memberships, (SELECT COUNT(*) FROM photos WHERE is_favorite=1) AS favorites',
        values: [],
        readonly: false,
      })
    })
    return result.values[0]
  }
  if (baseline) {
    const result = await geometry()
    const counts = await metadataCounts()
    await writeFile(join(output, 'metadata-counts.json'), JSON.stringify(counts))
    await page.screenshot({ path: join(output, 'privacy-before.png') })
    await writeFile(join(output, 'result.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result))
  } else {
    assert.equal((await geometry()).nativeShell, true)
    const metadataBefore = await metadataCounts()
    // Native Playwright masks require the Popover API (newer than this WebView).
    // Hide whole private sections in the page before taking any screenshot.
    await page.addStyleTag({
      content:
        '.date-group, .album-grid, .profile-stats, .connection-panel .body-text { visibility: hidden !important; }',
    })
    const originalTheme = await page.evaluate(() => localStorage.getItem('nobi.photos.theme.v1'))
    const routes = []
    try {
      for (const path of ['/', '/albums', '/search', '/cleanup', '/profile']) {
        await page.locator(`.mobile-nav a[href="#${path}"]`).click()
        await page.waitForFunction((path) => location.hash === `#${path}`, path)
        await page.locator('.native-topbar h1').waitFor()
        const size = await geometry()
        assert.ok(
          size.width >= 320 && size.width === size.documentWidth,
          `Horizontal overflow: ${path}`,
        )
        assert.ok(size.headerHeight >= 52 && size.headerHeight < 85)
        assert.ok(size.navigationVisible && Math.abs(size.navigationBottom - size.height) <= 1)
        assert.equal(await page.locator('.memory-hero').count(), 0)
        // No private albums, file names, images, dates, or stored statistics in screenshots.
        await page.screenshot({
          path: join(output, `${path === '/' ? 'photos' : path.slice(1)}.png`),
        })
        routes.push({ path, ...size })
      }
      await page.getByRole('button', { name: '深色', exact: true }).click()
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
      await page.screenshot({
        path: join(output, 'profile-dark.png'),
      })
      await page.getByRole('button', { name: '浅色', exact: true }).click()
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'light')
      await page.locator('.settings-link[href="#/privacy"]').click()
      await page.locator('.policy-list').waitFor()
      await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
      await page.waitForFunction(() => location.hash === '#/profile')
      await page.locator('.mobile-nav a[href="#/albums"]').click()
      await page.getByRole('button', { name: '新建相册', exact: true }).click()
      await page.getByRole('dialog', { name: '新建相册', exact: true }).waitFor()
      await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
      await page.waitForFunction(() => !document.querySelector('dialog[open]'))
      assert.equal(await page.evaluate(() => location.hash), '#/albums')
      await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
      await page.waitForFunction(() => location.hash === '#/')
      // Verify IME resizing with a neutral query; do not submit a photo search.
      await page.locator('.mobile-nav a[href="#/search"]').click()
      const beforeKeyboard = await geometry()
      const input = page.getByRole('textbox', { name: '搜索照片', exact: true })
      await input.scrollIntoViewIfNeeded()
      const inputRect = await input.boundingBox()
      assert.ok(inputRect)
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: inputRect.x + 20, y: inputRect.y + inputRect.height / 2 }],
      })
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await page.waitForFunction((height) => innerHeight < height - 80, beforeKeyboard.height)
      const withKeyboard = await geometry()
      await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
      await page.waitForFunction((height) => innerHeight === height, beforeKeyboard.height)
      assert.equal(await page.evaluate(() => location.hash), '#/search')
      await page.locator('.mobile-nav a[href="#/"]').click()
      await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
      let backgrounded = false
      for (let i = 0; i < 20; i++) {
        backgrounded = !(await page.evaluate(() => globalThis.Capacitor.Plugins.App.getState()))
          .isActive
        if (backgrounded) break
        await setTimeout(100)
      }
      assert.ok(backgrounded, 'Root back must minimize the app')
      await page.waitForFunction(
        () => document.querySelectorAll('.photo-card').length === 0,
        {},
        { polling: 100 },
      )
      await adb('shell', 'am', 'start', '-n', 'app.nobi.photos/.MainActivity')
      await page.waitForFunction(
        async () => (await globalThis.Capacitor.Plugins.App.getState()).isActive,
      )
      await page.evaluate(() => {
        location.hash = '/privacy'
      })
      await page.locator('.policy-list').waitFor()
      await page.screenshot({
        path: join(output, 'privacy.png'),
      })
      assert.deepEqual(errors, [])
      const runtime = await page.evaluate(async () => {
        const info = await globalThis.Capacitor.Plugins.App.getInfo()
        const database = await globalThis.Capacitor.Plugins.CapacitorSQLite.query({
          database: 'nobi_photos',
          statement: 'PRAGMA user_version',
          values: [],
          readonly: false,
        })
        return {
          appId: info.id,
          version: info.version,
          build: info.build,
          sqliteVersion: database.values[0].user_version,
          localOrigin: location.origin === 'https://localhost',
        }
      })
      assert.equal(runtime.appId, 'app.nobi.photos')
      assert.equal(runtime.version, '0.4.1')
      assert.equal(runtime.sqliteVersion, 2)
      const result = {
        checkedAt: new Date().toISOString(),
        model: await adb('shell', 'getprop', 'ro.product.model'),
        android: await adb('shell', 'getprop', 'ro.build.version.release'),
        api: Number(await adb('shell', 'getprop', 'ro.build.version.sdk')),
        routes,
        hardwareBack: true,
        modalBack: true,
        keyboardResizes: withKeyboard.height < beforeKeyboard.height,
        themeSwitching: true,
        coldStart,
        rootBackMinimizes: true,
        resumeRestoresApp: true,
        runtime,
        privatePhotoCapture: false,
        destructiveActions: false,
        status: 'passed',
      }
      const counts = await metadataCounts()
      assert.deepEqual(
        counts,
        metadataBefore,
        'This UI run must not change local organization records',
      )
      result.localMetadataUnchanged = true
      await writeFile(join(output, 'metadata-counts.json'), JSON.stringify(counts))
      await writeFile(join(output, 'result.json'), JSON.stringify(result, null, 2))
      console.log(
        'Physical-device UI passed: five routes, native shell, back, modal, keyboard and themes',
      )
    } finally {
      await page.evaluate((theme) => {
        if (theme === null) localStorage.removeItem('nobi.photos.theme.v1')
        else localStorage.setItem('nobi.photos.theme.v1', theme)
      }, originalTheme)
      // Reload the safe page so the original preference takes effect.
      await page.reload()
    }
  }
} finally {
  await browser?.close()
  await adb('forward', '--remove', `tcp:${port}`)
}
