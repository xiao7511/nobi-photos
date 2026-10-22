import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import process from 'node:process'
import console from 'node:console'
import { setTimeout } from 'node:timers/promises'
import { chromium } from '@playwright/test'

const run = promisify(execFile)
const serial = 'emulator-5580'
const sdk = process.env.ANDROID_HOME || join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
const adbPath = join(sdk, 'platform-tools', 'adb.exe')
const adb = async (...args) =>
  (await run(adbPath, ['-s', serial, ...args], { maxBuffer: 10 * 1024 * 1024 })).stdout.trim()
assert.equal(
  (await adb('emu', 'avd', 'name')).split(/\s+/)[0],
  'nobi_photos_test',
  'Refusing every other device',
)
const output = resolve('artifacts/native-ai')
await mkdir(output, { recursive: true })
await adb('shell', 'mkdir', '-p', '/sdcard/DCIM/NobiAIReference')
await adb(
  'push',
  'tests/fixtures/ai/parrot.jpg',
  '/sdcard/DCIM/NobiAIReference/nobi_ai_reference_parrot.jpg',
)
await adb(
  'shell',
  'am',
  'broadcast',
  '-a',
  'android.intent.action.MEDIA_SCANNER_SCAN_FILE',
  '-d',
  'file:///sdcard/DCIM/NobiAIReference/nobi_ai_reference_parrot.jpg',
)
let assetId
for (let i = 0; i < 20; i++) {
  const media = await adb(
    'shell',
    `content query --uri content://media/external/images/media --projection _id --where "_display_name='nobi_ai_reference_parrot.jpg'"`,
  )
  assetId = media.match(/_id=(\d+)/)?.[1]
  if (assetId) break
  await setTimeout(500)
}
assert.ok(assetId, 'Public reference fixture not indexed')
await adb('shell', 'pm', 'grant', 'app.nobi.photos', 'android.permission.READ_MEDIA_IMAGES')
await adb('shell', 'am', 'force-stop', 'app.nobi.photos')
await adb('shell', 'am', 'start', '-n', 'app.nobi.photos/.MainActivity')
let browser, port
const originalWifi = await adb('shell', 'settings', 'get', 'global', 'wifi_on')
async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const pid = await adb('shell', 'pidof', 'app.nobi.photos')
      if (port) await adb('forward', '--remove', `tcp:${port}`)
      port = await adb('forward', 'tcp:0', `localabstract:webview_devtools_remote_${pid}`)
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, {
        noDefaults: true,
        timeout: 2000,
      })
      const page = browser.contexts()[0].pages()[0]
      if (!page) throw new Error('Waiting for WebView')
      page.setDefaultTimeout(90000)
      await page.waitForFunction(() => !!globalThis.Capacitor?.Plugins.NobiPhotoLibrary)
      return page
    } catch {
      await setTimeout(1000)
    }
  }
  throw new Error('Native WebView unavailable')
}
try {
  let page = await connect()
  await adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'enable')
  await adb('shell', 'svc', 'wifi', 'disable')
  assert.equal(await adb('shell', 'settings', 'get', 'global', 'airplane_mode_on'), '1')
  assert.equal(await adb('shell', 'settings', 'get', 'global', 'wifi_on'), '0')
  const prediction = await page.evaluate(
    (assetId) => globalThis.Capacitor.Plugins.NobiPhotoLibrary.classify({ assetId }),
    assetId,
  )
  assert.equal(prediction.engine, 'mobilenet-v2-int8')
  assert.ok(
    prediction.labels.some((r) => /macaw|parrot/i.test(r.label) && r.confidence >= 0.55),
    'Public parrot reference must have a confident bird prediction',
  )
  console.log('Bundled model identified public parrot reference in airplane mode')
  // The compact connection panel disappears once an existing index finishes loading.
  // Privacy always owns the full scan controls, making reruns exercise the same explicit UI.
  await page.evaluate(() => {
    location.hash = '/privacy'
  })
  await page.getByRole('button', { name: '立即扫描', exact: true }).click()
  await page.locator('.mobile-nav a[href="#/"]').click()
  await page.waitForFunction(() => document.querySelectorAll('.photo-card').length === 102)
  await page.locator('.mobile-nav a[href="#/albums"]').click()
  await page.getByRole('button', { name: '开始智能整理', exact: true }).click()
  await page
    .getByRole('status')
    .filter({ hasText: '本地 AI 分析完成' })
    .waitFor({ timeout: 180000 })
  const suggestion = page.locator('.smart-suggestion').filter({ hasText: '宠物与动物' })
  await suggestion.getByRole('checkbox').check()
  await page.getByRole('button', { name: '预览保存 1 个相册', exact: true }).click()
  await page
    .getByRole('dialog', { name: '保存智能建议相册？' })
    .getByRole('button', { name: '确认保存相册' })
    .click()
  await page
    .locator('.user-album')
    .filter({ hasText: /智能 · 宠物与动物|我的动物朋友/ })
    .waitFor()
  const query = () =>
    page.evaluate(() =>
      globalThis.Capacitor.Plugins.CapacitorSQLite.query({
        database: 'nobi_photos',
        statement: "SELECT COUNT(*) AS count FROM album_photos WHERE album_id='user:smart:animals'",
        values: [],
        readonly: false,
      }),
    )
  assert.ok((await query()).values[0].count >= 1)
  const originalMembers = (await query()).values[0].count
  await page
    .locator('.user-album')
    .filter({ hasText: /智能 · 宠物与动物|我的动物朋友/ })
    .click()
  await page.getByRole('button', { name: '修改名称', exact: true }).click()
  const rename = page.getByRole('dialog', { name: '修改相册名称' })
  await rename.getByRole('textbox', { name: '相册名称' }).fill('我的动物朋友')
  await rename.getByRole('button', { name: '保存名称', exact: true }).click()
  assert.equal((await query()).values[0].count, originalMembers)
  await page.getByRole('button', { name: '查看nobi_ai_reference_parrot.jpg', exact: true }).click()
  const viewer = page.getByRole('dialog', { name: '照片详情' })
  await viewer
    .locator('.viewer-quality')
    .filter({ hasText: /^原图$/ })
    .waitFor()
  const original = await viewer.locator('img').evaluate((image) => ({
    width: image.naturalWidth,
    height: image.naturalHeight,
    source: image.getAttribute('src'),
  }))
  assert.ok(
    original.width > 256 && original.height > 256,
    'Must decode the actual original, not upscale the thumbnail',
  )
  const cacheFile = decodeURIComponent(original.source).split('/nobi-viewer/')[1]
  assert.match(cacheFile, /^[a-f0-9-]+\.jpg$/i)
  const digest = await adb(
    'shell',
    'run-as',
    'app.nobi.photos',
    'sha256sum',
    `cache/nobi-viewer/${cacheFile}`,
  )
  const fixture = await readFile('tests/fixtures/ai/parrot.jpg')
  // Scoped MediaStore may redact EXIF without ACCESS_MEDIA_LOCATION. Compare every decoded
  // pixel instead of requiring location metadata or treating system redaction as compression.
  const pixelHashes = await viewer.locator('img').evaluate(
    async (image, reference) => {
      const fixtureImage = new globalThis.Image()
      fixtureImage.src = reference
      await fixtureImage.decode()
      async function hash(image) {
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const context = canvas.getContext('2d', { willReadFrequently: true })
        context.drawImage(image, 0, 0)
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
        return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', pixels)))
          .map((v) => v.toString(16).padStart(2, '0'))
          .join('')
      }
      return {
        actual: await hash(image),
        reference: await hash(fixtureImage),
        referenceWidth: fixtureImage.naturalWidth,
        referenceHeight: fixtureImage.naturalHeight,
      }
    },
    `data:image/jpeg;base64,${fixture.toString('base64')}`,
  )
  assert.equal(original.width, pixelHashes.referenceWidth)
  assert.equal(original.height, pixelHashes.referenceHeight)
  assert.equal(pixelHashes.actual, pixelHashes.reference)
  const viewerSize = await viewer.boundingBox(),
    imageArea = await viewer.locator('.viewer-stage').boundingBox()
  assert.ok(imageArea.height / viewerSize.height > 0.76)
  await viewer.getByRole('button', { name: '放大照片' }).click()
  await viewer.getByRole('button', { name: '适应屏幕' }).click()
  await page.screenshot({ path: join(output, 'local-original-viewer.png') })
  await viewer.getByRole('button', { name: '关闭照片详情' }).click()
  await page.waitForFunction(() => !document.querySelector('.photo-viewer'))
  for (
    let i = 0;
    i < 20 && (await adb('shell', 'run-as', 'app.nobi.photos', 'ls', 'cache/nobi-viewer'));
    i++
  )
    await setTimeout(200)
  assert.equal(await adb('shell', 'run-as', 'app.nobi.photos', 'ls', 'cache/nobi-viewer'), '')
  // A background transition must discard the original lease as well as the image UI.
  await page.getByRole('button', { name: '查看nobi_ai_reference_parrot.jpg', exact: true }).click()
  await viewer
    .locator('.viewer-quality')
    .filter({ hasText: /^原图$/ })
    .waitFor()
  await adb('shell', 'input', 'keyevent', '3')
  await setTimeout(1000)
  assert.equal(await adb('shell', 'run-as', 'app.nobi.photos', 'ls', 'cache/nobi-viewer'), '')
  await adb('shell', 'am', 'start', '-n', 'app.nobi.photos/.MainActivity')
  await page.waitForFunction(() => !document.querySelector('.photo-viewer'))
  console.log(
    `Original viewer passed: ${original.width}x${original.height}, identical full-resolution pixels, zoom, close/background cleanup, renamed AI album`,
  )
  await page.screenshot({ path: join(output, 'reviewed-albums.png') })
  await browser.close()
  browser = undefined
  await adb('shell', 'am', 'force-stop', 'app.nobi.photos')
  await adb('shell', 'am', 'start', '-n', 'app.nobi.photos/.MainActivity')
  page = await connect()
  await page.waitForFunction(() => document.querySelectorAll('.photo-card').length === 102)
  await page.locator('.mobile-nav a[href="#/albums"]').click()
  await page.locator('.user-album').filter({ hasText: '我的动物朋友' }).waitFor()
  assert.ok((await query()).values[0].count >= 1)
  await writeFile(
    join(output, 'result.json'),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        platform: 'Android 14 AOSP API 34',
        engine: prediction.engine,
        publicReferencePrediction: prediction.labels,
        source: '101 synthetic images plus 1 public Google Coral parrot reference',
        airplaneMode: true,
        wifiDisabled: true,
        reviewedAlbumSaved: true,
        nativeSqlite: true,
        coldStartPersistence: true,
        renamedAlbum: '我的动物朋友',
        membershipPreserved: originalMembers,
        originalDimensions: { width: original.width, height: original.height },
        fixtureSha256: createHash('sha256').update(fixture).digest('hex'),
        readableOriginalSha256: digest.split(/\s+/)[0],
        decodedPixelsSha256: pixelHashes.actual,
        originalPixelsMatchFixture: true,
        originalCloseAndBackgroundCleanup: true,
        originalViewportRatio: imageArea.height / viewerSize.height,
        privatePhotos: false,
        status: 'passed',
      },
      null,
      2,
    ),
  )
  console.log(
    'Native offline AI passed: reviewed album saved to SQLite and restored after process cold start',
  )
} finally {
  await browser?.close()
  if (port) await adb('forward', '--remove', `tcp:${port}`)
  await adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'disable')
  if (originalWifi === '1' || originalWifi === '2') await adb('shell', 'svc', 'wifi', 'enable')
}
