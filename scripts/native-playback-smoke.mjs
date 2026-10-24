import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
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
  'Refusing other devices',
)
const fixtureNames = await adb(
  'shell',
  'content query --uri content://media/external/images/media --projection _display_name',
)
const names = [...fixtureNames.matchAll(/_display_name=([^\r\n]+)/g)].map((r) => r[1])
if (names.includes('nobi_hd_4032.png')) {
  const hdHash = await adb('shell', 'sha256sum', '/sdcard/DCIM/NobiHDReference/nobi_hd_4032.png')
  assert.ok(
    hdHash.startsWith('bb348f053a3107f0b838e76471c89e5c3b509b282cb5d4c2c426e396725ffb6b'),
    'Unknown HD fixture content',
  )
}
assert.ok(
  names.length >= 102 &&
    names.every((name) =>
      /^(synthetic_\d{3}\.png|nobi_ai_reference_parrot\.jpg|nobi_hd_4032\.png)$/.test(name),
    ),
  'Only synthetic/public fixture libraries permitted',
)
const output = resolve('artifacts/native-playback')
await mkdir(output, { recursive: true })
const wifi = await adb('shell', 'settings', 'get', 'global', 'wifi_on')
const airplane = await adb('shell', 'settings', 'get', 'global', 'airplane_mode_on')
await adb('shell', 'am', 'force-stop', 'app.nobi.photos')
await adb('shell', 'am', 'start', '-n', 'app.nobi.photos/.MainActivity')
let browser, port
try {
  for (let i = 0; i < 40; i++) {
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
  const page = browser.contexts()[0].pages()[0]
  page.setDefaultTimeout(45000)
  await page.waitForFunction(() => globalThis.Capacitor?.Plugins.NobiPhotoLibrary)
  await page.evaluate(() => {
    const Original = globalThis.AudioContext,
      connect = globalThis.AudioNode.prototype.connect
    globalThis.__nobiAudio = []
    globalThis.AudioContext = class extends Original {
      constructor(...args) {
        super(...args)
        this.__tap = this.createAnalyser()
        this.__mute = this.createGain()
        this.__mute.gain.value = 0
        this.__tap.connect(this.__mute)
        this.__mute.connect(this.destination)
        globalThis.__nobiAudio.push(this)
      }
    }
    globalThis.AudioNode.prototype.connect = function (destination, ...args) {
      if (
        destination instanceof globalThis.AudioDestinationNode &&
        this.context.__tap &&
        this !== this.context.__mute
      )
        connect.call(this, this.context.__tap)
      return connect.call(this, destination, ...args)
    }
  })
  const sample = () =>
    page.evaluate(() => {
      const last = globalThis.__nobiAudio.at(-1)
      if (!last) return { count: 0, state: '', rms: 0 }
      const values = new Float32Array(last.__tap.fftSize)
      last.__tap.getFloatTimeDomainData(values)
      return {
        count: globalThis.__nobiAudio.length,
        state: last.state,
        rms: Math.sqrt(values.reduce((sum, v) => sum + v * v, 0) / values.length),
      }
    })
  await adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'enable')
  await adb('shell', 'svc', 'wifi', 'disable')
  // Use the mounted app navigation: an early raw hash change can race initial lazy routing.
  await page.locator('.native-topbar a[href="#/privacy"]').click()
  await page.getByRole('button', { name: '立即扫描', exact: true }).click()
  await page.locator('.mobile-nav a[href="#/albums"]').click()
  const ai = page.locator('.user-album').filter({ hasText: /我的动物朋友|智能 · 宠物与动物/ })
  await ai.click()
  await page.getByRole('button', { name: '返回相册列表' }).waitFor()
  assert.equal(await page.locator('.album-card').count(), 0)
  assert.ok((await page.getByRole('heading', { level: 1 }).last().boundingBox()).y < 180)
  assert.ok((await page.locator('.photo-card').count()) >= 1)
  await adb('shell', 'input', 'keyevent', '4')
  await page.locator('.album-card').first().waitFor()
  await page.getByRole('button', { name: /未分类.*张照片/ }).click()
  await page.getByRole('button', { name: '查看nobi_ai_reference_parrot.jpg', exact: true }).click()
  const viewer = page.getByRole('dialog', { name: '照片详情' })
  await viewer
    .locator('.viewer-quality')
    .filter({ hasText: /^原图$/ })
    .waitFor()
  await page.waitForFunction(() => {
    const image = globalThis.document.querySelector('.viewer-image'),
      bounds = image?.getBoundingClientRect()
    return (
      bounds &&
      Math.abs(bounds.height - globalThis.innerHeight) < 2 &&
      Math.abs(bounds.width - globalThis.innerWidth) < 2
    )
  })
  const geometry = await viewer.locator('img').evaluate((image) => ({
    viewport: { width: globalThis.innerWidth, height: globalThis.innerHeight },
    image: {
      width: image.getBoundingClientRect().width,
      height: image.getBoundingClientRect().height,
    },
    natural: { width: image.naturalWidth, height: image.naturalHeight },
    fit: globalThis.getComputedStyle(image).objectFit,
    pixelRatio: globalThis.devicePixelRatio,
  }))
  assert.equal(geometry.fit, 'cover')
  assert.deepEqual(geometry.natural, { width: 512, height: 929 })
  await page.screenshot({ path: join(output, 'fullscreen-original.png') })
  await viewer.getByRole('button', { name: '完整显示照片' }).click()
  assert.equal(
    await viewer.locator('img').evaluate((image) => globalThis.getComputedStyle(image).objectFit),
    'contain',
  )
  await viewer.getByRole('button', { name: '铺满屏幕' }).click()
  assert.equal((await sample()).count, 0)
  await viewer.getByRole('button', { name: '开启分类配乐' }).click()
  let sound
  for (let i = 0; i < 30; i++) {
    sound = await sample()
    if (sound.rms > 0.0001) break
    await setTimeout(100)
  }
  assert.ok(sound.rms > 0.0001 && sound.state === 'running', 'Real Web Audio samples required')
  const before = await viewer.locator('.viewer-count').innerText()
  await viewer.getByRole('button', { name: '开始自动轮播' }).click()
  await page.waitForFunction(
    (before) => globalThis.document.querySelector('.viewer-count')?.textContent.trim() !== before,
    before,
    { timeout: 15000 },
  )
  await viewer.getByRole('button', { name: '暂停轮播' }).click()
  const paused = await viewer.locator('.viewer-count').innerText()
  await setTimeout(5500)
  assert.equal(await viewer.locator('.viewer-count').innerText(), paused)
  await page.screenshot({ path: join(output, 'slideshow-music.png') })
  await adb('shell', 'input', 'keyevent', '3')
  await setTimeout(1000)
  assert.equal((await sample()).state, 'closed')
  assert.equal(await adb('shell', 'run-as', 'app.nobi.photos', 'ls', 'cache/nobi-viewer'), '')
  await adb('shell', 'am', 'start', '-n', 'app.nobi.photos/.MainActivity')
  await page.waitForFunction(() => !globalThis.document.querySelector('.photo-viewer'))
  await page.getByRole('button', { name: '返回相册列表' }).click()
  await ai.click()
  await page.getByRole('button', { name: '查看nobi_ai_reference_parrot.jpg', exact: true }).click()
  await viewer
    .locator('.viewer-quality')
    .filter({ hasText: /^原图$/ })
    .waitFor()
  await viewer.getByRole('button', { name: '开启分类配乐' }).click()
  await viewer.locator('.viewer-music-caption').filter({ hasText: '小小伙伴' }).waitFor()
  await viewer.getByRole('button', { name: '关闭照片详情' }).click()
  assert.equal((await sample()).state, 'closed')
  await writeFile(
    join(output, 'result.json'),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        version: '0.7.0',
        platform: 'Android 14 / API 34 dedicated AVD',
        fixturePhotos: names.length,
        geometry,
        aiAndCategoryAlbumDetails: true,
        nativeBackToList: true,
        originalPixels: true,
        defaultSilent: true,
        musicRms: sound.rms,
        categoryMusic: ['日常小确幸', '小小伙伴'],
        slideshowAdvanceAndPause: true,
        backgroundStopsAudioAndReleasesOriginal: true,
        closedViewerStopsAudio: true,
        airplaneMode: true,
        wifiDisabled: true,
        privatePhotos: false,
        status: 'passed',
      },
      null,
      2,
    ),
  )
  console.log(
    'Native fullscreen, AI/category album details, slideshow, real offline audio and lifecycle cleanup passed',
  )
} finally {
  await browser?.close()
  if (port) await adb('forward', '--remove', `tcp:${port}`)
  await adb('shell', 'am', 'force-stop', 'app.nobi.photos')
  if (airplane !== '1') await adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'disable')
  if (wifi === '1' || wifi === '2') await adb('shell', 'svc', 'wifi', 'enable')
}
