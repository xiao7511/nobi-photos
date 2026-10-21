import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { promisify } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { deflateSync } from 'node:zlib'
import process from 'node:process'
import console from 'node:console'
import { setTimeout } from 'node:timers/promises'
import { chromium } from '@playwright/test'

const run = promisify(execFile)
const sdk = process.env.ANDROID_HOME || join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk')
const serial = process.env.NOBI_TEST_SERIAL || 'emulator-5580'
assert.match(serial, /^emulator-\d+$/, 'Only the dedicated emulator is permitted')
const adbPath = join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb')
async function adb(...args) {
  return (
    await run(adbPath, ['-s', serial, ...args], { maxBuffer: 10 * 1024 * 1024 })
  ).stdout.trim()
}
async function appPid() {
  try {
    return await adb('shell', 'pidof', 'app.nobi.photos')
  } catch {
    return ''
  }
}
assert.equal(
  (await adb('emu', 'avd', 'name')).split(/\s+/)[0],
  'nobi_photos_test',
  'Refusing a non-NOBI test AVD',
)
for (let i = 0; i < 120; i++) {
  if ((await adb('shell', 'getprop', 'sys.boot_completed')) === '1') break
  await setTimeout(1000)
  assert.ok(i < 119, 'Emulator boot timed out')
}
const output = resolve('artifacts/native-test')
await mkdir(output, { recursive: true })
const fixtures = join(output, 'fixtures')
await mkdir(fixtures, { recursive: true })
async function choosePermission(button) {
  let xml = ''
  for (let i = 0; i < 10; i++) {
    await adb('shell', 'uiautomator', 'dump', '/sdcard/nobi-window.xml')
    xml = await adb('shell', 'cat', '/sdcard/nobi-window.xml')
    if (xml.includes(button)) break
    await setTimeout(500)
  }
  await writeFile(join(output, `${button}.xml`), xml)
  const node = xml.match(
    new RegExp(`<node[^>]*resource-id="com\\.android\\.permissioncontroller:id/${button}"[^>]*>`),
  )?.[0]
  assert.ok(node, 'System photo permission dialog missing')
  const bounds = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
  assert.ok(bounds)
  await adb(
    'shell',
    'input',
    'tap',
    String(Math.round((+bounds[1] + +bounds[3]) / 2)),
    String(Math.round((+bounds[2] + +bounds[4]) / 2)),
  )
}
const crc = (data) => {
  let c = 0xffffffff
  for (const b of data) {
    c ^= b
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0)
  }
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (name, data) => {
  const body = Buffer.concat([Buffer.from(name), data])
  const size = Buffer.alloc(4),
    sum = Buffer.alloc(4)
  size.writeUInt32BE(data.length)
  sum.writeUInt32BE(crc(body))
  return Buffer.concat([size, body, sum])
}
function png(seed) {
  const w = 64,
    h = 64,
    rows = Buffer.alloc(h * (w * 3 + 1))
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * (w * 3 + 1) + 1 + x * 3
      rows[p] = (x * 4 + seed * 31) % 256
      rows[p + 1] = (y * 4 + seed * 53) % 256
      rows[p + 2] = ((x + y) * 2 + seed * 23) % 256
    }
  }
  const head = Buffer.alloc(13)
  head.writeUInt32BE(w)
  head.writeUInt32BE(h, 4)
  head[8] = 8
  head[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', head),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
for (let i = 0; i < 101; i++)
  await writeFile(join(fixtures, `synthetic_${String(i).padStart(3, '0')}.png`), png(i % 5))
await adb('shell', 'mkdir', '-p', '/sdcard/DCIM/NobiSynthetic')
await adb('push', fixtures + '/.', '/sdcard/DCIM/NobiSynthetic/')
await adb(
  'shell',
  'for f in /sdcard/DCIM/NobiSynthetic/*.png; do am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d "file://$f" >/dev/null; done',
)
console.log('Seeded 101 synthetic images in the dedicated AVD')
const apk = resolve(
  process.env.NOBI_TEST_APK || 'android/app/build/outputs/apk/debug/app-debug.apk',
)
await adb('install', '-r', '-t', apk)
await adb('shell', 'pm', 'clear', 'app.nobi.photos')
await adb('shell', 'am', 'start', '-n', 'app.nobi.photos/.MainActivity')
let pid = ''
for (let i = 0; i < 30; i++) {
  pid = await appPid()
  if (pid) break
  await setTimeout(1000)
}
assert.match(pid, /^\d+$/)
await adb('forward', 'tcp:9225', `localabstract:webview_devtools_remote_${pid}`)
let browser
const originalWifi =
  process.env.NOBI_TEST_PHASE4 === '1'
    ? await adb('shell', 'settings', 'get', 'global', 'wifi_on')
    : ''
async function connectPage() {
  let currentPid = ''
  for (let i = 0; i < 30; i++) {
    currentPid = await appPid()
    if (currentPid) break
    await setTimeout(1000)
  }
  assert.match(currentPid, /^\d+$/)
  await adb('forward', 'tcp:9225', `localabstract:webview_devtools_remote_${currentPid}`)
  for (let i = 0; i < 40; i++) {
    try {
      browser = await chromium.connectOverCDP('http://127.0.0.1:9225', {
        timeout: 2000,
        noDefaults: true,
      })
      const context = browser.contexts()[0]
      const page = context.pages()[0] || (await context.waitForEvent('page', { timeout: 15000 }))
      page.setDefaultTimeout(90000)
      return page
    } catch {
      await setTimeout(1000)
    }
  }
  throw new Error('WebView debugging unavailable')
}
try {
  for (let i = 0; i < 40; i++) {
    try {
      browser = await chromium.connectOverCDP('http://127.0.0.1:9225', {
        timeout: 2000,
        noDefaults: true,
      })
      break
    } catch {
      await setTimeout(1000)
    }
  }
  assert.ok(browser, 'WebView debugging unavailable')
  const context = browser.contexts()[0]
  let page = context.pages()[0]
  if (!page) page = await context.waitForEvent('page', { timeout: 15000 })
  page.setDefaultTimeout(60000)
  await page.getByRole('button', { name: '连接并读取照片', exact: true }).waitFor()
  assert.equal(
    await page.locator('.photo-card').count(),
    0,
    'Native mode must not display demo photos',
  )
  const initial = await page.evaluate(() =>
    globalThis.Capacitor.Plugins.NobiPhotoLibrary.getAccess(),
  )
  assert.equal(initial.status, 'prompt')
  await page.screenshot({ path: join(output, 'native-before-consent.png') })
  await page.getByRole('button', { name: '连接并读取照片', exact: true }).click()
  await page.getByRole('button', { name: '继续系统授权', exact: true }).click()
  await choosePermission('permission_deny_button')
  await page.getByText('照片权限未开启', { exact: true }).waitFor()
  assert.equal(await page.locator('.photo-card').count(), 0)
  await page.getByRole('button', { name: '连接并读取照片', exact: true }).click()
  await page.getByRole('button', { name: '继续系统授权', exact: true }).click()
  await choosePermission('permission_allow_all_button')
  page.setDefaultTimeout(30000)
  await page.waitForFunction(
    () => document.querySelectorAll('.photo-card').length === 101,
    {},
    { timeout: 60000 },
  )
  await page.locator('.photo-card').first().scrollIntoViewIfNeeded()
  await page.waitForFunction(() =>
    document
      .querySelector('.photo-card img')
      ?.getAttribute('src')
      ?.startsWith('data:image/jpeg;base64,'),
  )
  const thumbnail = await page.locator('.photo-card img').first().getAttribute('src')
  const favorite = page.locator('.favorite-button').first()
  await favorite.click()
  await page.waitForFunction(
    () => document.querySelector('.favorite-button')?.getAttribute('aria-pressed') === 'true',
  )
  await page.screenshot({ path: join(output, 'native-indexed.png') })
  const connection = await page.evaluate(() =>
    globalThis.Capacitor.Plugins.CapacitorSQLite.query({
      database: 'nobi_photos',
      statement: "SELECT COUNT(*) AS count FROM photos WHERE source='device'",
      values: [],
      readonly: false,
    }),
  )
  assert.equal(connection.values[0].count, 101)
  assert.equal(thumbnail.startsWith('https://'), false)
  await page.reload()
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.photo-card').length === 101 &&
      document.querySelector('.favorite-button')?.getAttribute('aria-pressed') === 'true',
  )
  console.log(
    'Native base passed: system denial/full grant, 101 indexed photos, thumbnails and persisted favorite',
  )
  let organization = false
  if (process.env.NOBI_TEST_PHASE3 !== '0') {
    await page.evaluate(() => {
      location.hash = '/albums'
    })
    await page.getByRole('button', { name: '新建相册', exact: true }).click()
    const editor = page.getByRole('dialog', { name: '新建相册', exact: true })
    await editor.getByRole('textbox', { name: '相册名称' }).fill('原生合成相册')
    await editor.getByRole('checkbox').first().check()
    await editor.getByRole('button', { name: '保存相册', exact: true }).click()
    await page.locator('.photo-open').first().click()
    const detail = page.getByRole('dialog', { name: '照片详情' })
    await detail.getByRole('textbox', { name: '手动标签', exact: true }).fill('原生验证')
    await detail.getByRole('button', { name: '保存标签', exact: true }).click()
    await detail.locator('.chip').filter({ hasText: '原生验证' }).waitFor()
    await page.keyboard.press('Escape')
    await page.reload()
    await page.locator('.user-album').filter({ hasText: '原生合成相册' }).waitFor()
    const saved = await page.evaluate(() =>
      globalThis.Capacitor.Plugins.CapacitorSQLite.query({
        database: 'nobi_photos',
        statement:
          "SELECT COUNT(*) AS count FROM photo_tags WHERE origin='manual' AND tag='原生验证'",
        values: [],
        readonly: false,
      }),
    )
    assert.equal(saved.values[0].count, 1)
    await page.screenshot({ path: join(output, 'native-phase3-albums.png') })
    await page.evaluate(() => {
      location.hash = '/cleanup'
    })
    await page.getByRole('button', { name: '开始本地分析', exact: true }).click()
    await page.getByRole('status').filter({ hasText: '本地分析完成' }).waitFor({ timeout: 90000 })
    assert.ok((await page.getByRole('heading', { name: /可能相似 ·/ }).count()) > 0)
    await page.screenshot({ path: join(output, 'native-phase3-analysis.png') })
    organization = true
    console.log('Native organization passed: album, manual tag and local similarity analysis')
  }
  let phase4 = false
  if (process.env.NOBI_TEST_PHASE4 === '1') {
    await page.evaluate(() => {
      location.hash = '/'
    })
    await page.getByRole('button', { name: '选择照片', exact: true }).click()
    await page.locator('.photo-open').nth(0).click()
    await page.locator('.photo-open').nth(1).click()
    await page.getByRole('button', { name: '整理所选照片', exact: true }).click()
    const batch = page.getByRole('dialog', { name: '批量整理 2 张照片', exact: true })
    await batch.getByRole('combobox', { name: '整理操作' }).selectOption('tags-add')
    await batch.getByRole('textbox', { name: '批量手动标签' }).fill('批量验证')
    await batch.getByRole('button', { name: '确认保存整理' }).click()
    await page.getByRole('button', { name: '选择照片', exact: true }).waitFor()
    const queryTags = async () =>
      page.evaluate(() =>
        globalThis.Capacitor.Plugins.CapacitorSQLite.query({
          database: 'nobi_photos',
          statement:
            "SELECT COUNT(*) AS count FROM photo_tags WHERE origin='manual' AND tag='批量验证'",
          values: [],
          readonly: false,
        }),
      )
    assert.equal((await queryTags()).values[0].count, 2)
    console.log('Native Phase 4 batch labels saved for two synthetic photos')
    await page.evaluate(() => {
      location.hash = '/search'
    })
    await page.locator('.advanced-search summary').click()
    await page.getByRole('textbox', { name: '精确手动标签' }).fill('批量验证')
    await page.getByRole('button', { name: '搜索', exact: true }).click()
    await page.waitForFunction(() => document.querySelectorAll('.photo-card').length === 2)
    await page.screenshot({ path: join(output, 'native-phase4-search.png') })
    await adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
    await page.waitForFunction(
      () => document.querySelectorAll('.photo-card').length === 0,
      {},
      { polling: 100 },
    )
    await adb('shell', 'am', 'start', '-n', 'app.nobi.photos/.MainActivity')
    await page.waitForFunction(() => document.querySelectorAll('.photo-card').length === 2)
    console.log('Native Phase 4 search and background/resume passed')
    await adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'enable')
    await adb('shell', 'svc', 'wifi', 'disable')
    assert.equal(await adb('shell', 'settings', 'get', 'global', 'airplane_mode_on'), '1')
    assert.equal(await adb('shell', 'settings', 'get', 'global', 'wifi_on'), '0')
    await browser.close()
    browser = undefined
    await adb('shell', 'am', 'force-stop', 'app.nobi.photos')
    await adb('shell', 'am', 'start', '-n', 'app.nobi.photos/.MainActivity')
    page = await connectPage()
    await page.waitForFunction(
      () => document.querySelectorAll('.photo-card').length === 101,
      {},
      { timeout: 90000 },
    )
    assert.equal((await queryTags()).values[0].count, 2)
    await page.screenshot({ path: join(output, 'native-phase4-offline-cold-start.png') })
    console.log('Native Phase 4 airplane-mode cold start passed, Wi-Fi was disabled')
    await adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'disable')
    await browser.close()
    browser = undefined
    // Android terminates the app when media permissions are revoked.
    await adb('shell', 'pm', 'revoke', 'app.nobi.photos', 'android.permission.READ_MEDIA_IMAGES')
    await adb(
      'shell',
      'pm',
      'revoke',
      'app.nobi.photos',
      'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
    )
    await adb('shell', 'am', 'start', '-n', 'app.nobi.photos/.MainActivity')
    page = await connectPage()
    await page.getByRole('button', { name: '连接并读取照片', exact: true }).waitFor()
    // Wait for the actual library load, not the initial prompt button before SQLite opens.
    await page.getByRole('heading', { name: '留一点空间，给新的回忆', exact: true }).waitFor()
    const revokedAccess = await page.evaluate(() =>
      globalThis.Capacitor.Plugins.NobiPhotoLibrary.getAccess(),
    )
    assert.ok(['prompt', 'denied'].includes(revokedAccess.status))
    assert.equal(await page.locator('.photo-card').count(), 0)
    const cleared = await page.evaluate(() =>
      globalThis.Capacitor.Plugins.CapacitorSQLite.query({
        database: 'nobi_photos',
        statement: 'SELECT COUNT(*) AS count FROM photos',
        values: [],
        readonly: false,
      }),
    )
    assert.equal(cleared.values[0].count, 0)
    const noTags = await queryTags()
    assert.equal(noTags.values[0].count, 0)
    await page.screenshot({ path: join(output, 'native-phase4-revoked.png') })
    phase4 = true
    console.log(
      'Native Phase 4 permission revocation passed: no visible photos, index and manual tags cleared',
    )
  }
  await writeFile(
    join(output, 'result.json'),
    JSON.stringify(
      {
        platform: 'Android 14 AOSP API 34',
        serial,
        photos: 101,
        initialPermission: initial.status,
        systemDenial: true,
        systemFullGrant: true,
        nativeSqlite: true,
        nativeThumbnails: true,
        persistedFavorite: true,
        nativeOrganizationAndAnalysis: organization,
        phase4BatchSearchLifecycle: phase4,
        ...(phase4
          ? {
              backgroundHiddenAndRestored: true,
              airplaneModeColdStart: true,
              permissionRevocationClearsIndex: true,
            }
          : {}),
        source: 'synthetic',
        status: 'passed',
      },
      null,
      2,
    ),
  )
  console.log(
    'Native smoke passed: consent/denial, 101 MediaStore photos, SQLite index, JPEG thumbnails, local favorite',
  )
} finally {
  await browser?.close()
  await adb('forward', '--remove', 'tcp:9225')
  if (process.env.NOBI_TEST_PHASE4 === '1') {
    await adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'disable')
    if (originalWifi === '1' || originalWifi === '2') await adb('shell', 'svc', 'wifi', 'enable')
  }
}
