import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import process from 'node:process'
import console from 'node:console'
import { chromium } from '@playwright/test'
const run = promisify(execFile),
  serial = 'emulator-5580'
const adbPath = join(
  process.env.ANDROID_HOME || join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
  'platform-tools',
  'adb.exe',
)
const adb = async (...args) =>
  (await run(adbPath, ['-s', serial, ...args], { maxBuffer: 2 * 1024 * 1024 })).stdout.trim()
assert.equal(
  (await adb('emu', 'avd', 'name')).split(/\s+/)[0],
  'nobi_photos_test',
  'Refusing any physical phone or unrelated AVD',
)
const names = await adb(
  'shell',
  'content query --uri content://media/external/images/media --projection _display_name',
)
const fixtures = [...names.matchAll(/_display_name=([^\r\n]+)/g)].map((r) => r[1])
assert.ok(
  fixtures.length >= 102 &&
    fixtures.every((n) =>
      /^(synthetic_\d{3}\.png|nobi_ai_reference_parrot\.jpg|nobi_hd_4032\.png)$/.test(n),
    ),
  'Refusing a library containing unknown photos',
)
const output = resolve('artifacts/native-share')
await mkdir(output, { recursive: true })
let browser, port, page, path
try {
  await adb('shell', 'am', 'force-stop', 'app.nobi.photos')
  await adb('shell', 'am', 'start', '-n', 'app.nobi.photos/.MainActivity')
  for (let i = 0; i < 35; i++) {
    try {
      const pid = await adb('shell', 'pidof', 'app.nobi.photos')
      port = await adb('forward', 'tcp:0', `localabstract:webview_devtools_remote_${pid}`)
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, {
        noDefaults: true,
        timeout: 2000,
      })
      break
    } catch {
      if (port) await adb('forward', '--remove', `tcp:${port}`)
      await setTimeout(1000)
    }
  }
  assert.ok(browser)
  page = browser
    .contexts()
    .flatMap((c) => c.pages())
    .find((p) => p.url().startsWith('https://localhost'))
  assert.ok(page)
  page.setDefaultTimeout(30000)
  await page.waitForFunction(
    () => !!globalThis.Capacitor?.Plugins.Share && !!globalThis.Capacitor?.Plugins.Filesystem,
  )
  const remote = []
  page.on('request', (r) => {
    if (!/^(https:\/\/localhost(?:\/|$)|blob:|data:)/.test(r.url())) remote.push(r.url())
  })
  await page.locator('.native-topbar h1').waitFor()
  await page.locator('.mobile-nav a[href="#/profile"]').click()
  await page.getByRole('link', { name: '注册 / 登录', exact: false }).click()
  await page.getByText('账号服务尚未配置。注册和登录暂不可用', { exact: false }).waitFor()
  assert.ok(await page.getByRole('button', { name: '登录', exact: true }).last().isDisabled())
  await page.getByRole('link', { name: '返回我的空间', exact: false }).click()
  await page.getByRole('link', { name: '图片创作室', exact: false }).click()
  await page.getByRole('heading', { name: '注册用户专属创作' }).waitFor()
  await page.screenshot({ path: join(output, 'native-guest-studio.png') })
  path = `nobi-share/nobi-${randomUUID()}.jpg`
  const generated = await page.evaluate(async (path) => {
    const canvas = globalThis.document.createElement('canvas')
    canvas.width = canvas.height = 2160
    const context = canvas.getContext('2d')
    context.fillStyle = '#285a47'
    context.fillRect(0, 0, 2160, 2160)
    context.fillStyle = '#f6f7f2'
    context.font = '120px sans-serif'
    context.fillText('NOBI TEST', 200, 1080)
    const data = canvas.toDataURL('image/jpeg', 0.92).split(',')[1]
    canvas.width = canvas.height = 0
    const { uri } = await globalThis.Capacitor.Plugins.Filesystem.writeFile({
      directory: 'CACHE',
      path,
      data,
      recursive: true,
    })
    // This test checks the actual native bridge/chooser contract, not a fake login or publication.
    globalThis.__nobiShareResult = 'pending'
    void globalThis.Capacitor.Plugins.Share.share({
      files: [uri],
      text: 'NOBI synthetic share test',
      title: 'NOBI Photos',
      dialogTitle: 'NOBI share validation',
    })
      .then(() => {
        globalThis.__nobiShareResult = 'resolved'
      })
      .catch(() => {
        globalThis.__nobiShareResult = 'cancelled'
      })
    return {
      cacheUri: uri.includes('/cache/nobi-share/'),
      jpegBytes: Math.floor((data.length * 3) / 4),
    }
  }, path)
  assert.ok(generated.cacheUri && generated.jpegBytes > 1000)
  let chooser = false
  for (let i = 0; i < 15; i++) {
    const state = await adb('shell', 'dumpsys', 'window')
    if (/mCurrentFocus=.*(ChooserActivity|ResolverActivity)/.test(state)) {
      chooser = true
      break
    }
    await setTimeout(400)
  }
  assert.ok(chooser, 'Native Android share chooser did not open')
  await adb('shell', 'uiautomator dump /sdcard/nobi_share_test.xml')
  const xml = await adb('shell', 'cat', '/sdcard/nobi_share_test.xml')
  assert.match(xml, /NOBI|分享|Sharing|Share/)
  await adb('shell', 'input', 'keyevent', '4')
  await page.waitForFunction(() => globalThis.__nobiShareResult !== 'pending')
  await page.evaluate(
    async (path) =>
      globalThis.Capacitor.Plugins.Filesystem.deleteFile({ directory: 'CACHE', path }),
    path,
  )
  const cleaned = !(
    await adb('shell', 'run-as', 'app.nobi.photos', 'ls', 'cache/nobi-share')
  ).includes(path.split('/').pop())
  assert.ok(cleaned)
  assert.deepEqual(remote, [])
  await page.getByRole('link', { name: '返回我的空间', exact: false }).click()
  await page.getByRole('link', { name: '隐私与安全中心', exact: true }).click()
  const info = await page.evaluate(() => globalThis.Capacitor.Plugins.App.getInfo())
  assert.equal(info.version, JSON.parse(await readFile('package.json', 'utf8')).version)
  await writeFile(
    join(output, 'result.json'),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        version: info.version,
        build: info.build,
        platform: 'Android 14 / API 34 dedicated AVD',
        fixturePhotos: fixtures.length,
        guestMembershipLocked: true,
        nativeFilesystemAndShare: true,
        generatedJpegOnly: true,
        chooserOpened: true,
        cancelledWithoutPublishing: true,
        testCopyRemoved: cleaned,
        noExternalRequests: true,
        realAccountBackend: false,
        wechatPublicationTested: false,
        privatePhotos: false,
        status: 'passed',
      },
      null,
      2,
    ),
  )
  console.log(
    'Native guest gating, private-cache JPEG and real Android share chooser cancellation passed',
  )
} finally {
  if (page && path)
    await page
      .evaluate(
        async (path) =>
          globalThis.Capacitor.Plugins.Filesystem.deleteFile({ directory: 'CACHE', path }).catch(
            () => {},
          ),
        path,
      )
      .catch(() => {})
  await browser?.close()
  if (port) await adb('forward', '--remove', `tcp:${port}`)
  await adb('shell', 'am', 'force-stop', 'app.nobi.photos')
}
