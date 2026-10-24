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
import { createHash } from 'node:crypto'
import { testWave } from '../tests/e2e/helpers/audio.ts'
const output = resolve('artifacts/native-music-picker')
await mkdir(output, { recursive: true })
const wave = testWave(),
  wavePath = join(output, 'nobi_audio_reference.wav')
await writeFile(wavePath, wave)
const fixtureHash = createHash('sha256').update(wave).digest('hex')
try {
  const existing = await adb('shell', 'sha256sum', '/sdcard/Download/nobi_audio_reference.wav')
  assert.ok(existing.startsWith(fixtureHash), 'Refusing to overwrite an unknown audio file')
} catch (error) {
  if (!String(error).includes('No such file')) throw error
}
await adb('push', wavePath, '/sdcard/Download/nobi_audio_reference.wav')
const wifi = await adb('shell', 'settings', 'get', 'global', 'wifi_on')
const airplane = await adb('shell', 'settings', 'get', 'global', 'airplane_mode_on')
let browser, port
const captureUI = async () => {
  await adb('shell', 'uiautomator dump /sdcard/nobi_music_test.xml')
  const xml = await adb('shell', 'cat', '/sdcard/nobi_music_test.xml')
  return [...xml.matchAll(/<node\b([^>]*)\/?>(?:<\/node>)?/g)].map((match) =>
    Object.fromEntries(
      [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((pair) => [pair[1], pair[2]]),
    ),
  )
}
async function tap(nodes, predicate) {
  const node = nodes.find(predicate)
  if (!node) return false
  const bounds = node.bounds?.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/)
  if (!bounds) return false
  await adb(
    'shell',
    'input',
    'tap',
    String(Math.round((+bounds[1] + +bounds[3]) / 2)),
    String(Math.round((+bounds[2] + +bounds[4]) / 2)),
  )
  return true
}
try {
  await adb('shell', 'am', 'force-stop', 'app.nobi.photos')
  await adb('shell', 'am', 'force-stop', 'com.android.documentsui')
  await adb('shell', 'am', 'start', '-n', 'app.nobi.photos/.MainActivity')
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
  const page = browser
    .contexts()
    .flatMap((c) => c.pages())
    .find((p) => p.url().startsWith('https://localhost'))
  assert.ok(page)
  page.setDefaultTimeout(40000)
  await page.waitForFunction(() => !!globalThis.Capacitor?.Plugins.NobiPhotoLibrary)
  const remote = []
  page.on('request', (request) => {
    const url = request.url()
    if (!/^(https:\/\/localhost(?:\/|$)|blob:|data:)/.test(url)) remote.push(url)
  })
  await page.evaluate(() => {
    const Original = globalThis.Audio,
      revoke = globalThis.URL.revokeObjectURL.bind(globalThis.URL)
    globalThis.__nobiAudio = []
    globalThis.__nobiRevoked = []
    globalThis.Audio = function () {
      const audio = new Original()
      globalThis.__nobiAudio.push(audio)
      return audio
    }
    globalThis.URL.revokeObjectURL = (url) => {
      globalThis.__nobiRevoked.push(url)
      revoke(url)
    }
  })
  await adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'enable')
  await adb('shell', 'svc', 'wifi', 'disable')
  await page.locator('.mobile-nav a[href="#/albums"]').click()
  await page.getByRole('button', { name: /未分类.*张照片/ }).click()
  const fan = page.getByRole('region', { name: '扇形相册浏览' })
  await fan.waitFor()
  await page.screenshot({ path: join(output, 'fan-album.png') })
  await fan.locator('.fan-photo.is-active').click()
  const viewer = page.getByRole('dialog', { name: '照片详情' })
  await viewer
    .locator('.viewer-quality')
    .filter({ hasText: /^原图$/ })
    .waitFor()
  await viewer.getByRole('button', { name: '选择背景音乐' }).click()
  const picker = page.getByRole('dialog', { name: '选择背景音乐' })
  const localButton = picker.getByRole('button', { name: /从手机选择音乐文件/ })
  await localButton.click()
  // The system activity handles Back; cancelling must preserve the global music panel.
  await setTimeout(1000)
  assert.ok((await captureUI()).some((n) => n.package === 'com.android.documentsui'))
  await adb('shell', 'input', 'keyevent', '4')
  let foreground = false
  for (let i = 0; i < 10; i++) {
    const windows = await adb('shell', 'dumpsys', 'window')
    if (/mCurrentFocus=.*app\.nobi\.photos/.test(windows)) {
      foreground = true
      break
    }
    await setTimeout(400)
  }
  assert.ok(foreground, 'Cancelling the native picker must return to the app window')
  await page.waitForFunction(
    async () => (await globalThis.Capacitor.Plugins.App.getState()).isActive,
  )
  await setTimeout(300)
  await picker.waitFor()
  assert.equal(await viewer.count(), 0)
  assert.equal(await picker.locator('.music-local-selection').count(), 0)
  await localButton.click()
  let selected = false
  for (let i = 0; i < 12; i++) {
    const nodes = await captureUI()
    if (await tap(nodes, (n) => /^nobi_audio_reference(?:\.wav)?$/.test(n.text))) {
      selected = true
      break
    }
    if (await tap(nodes, (n) => /^(Downloads|下载)$/.test(n.text))) continue
    await tap(nodes, (n) =>
      /^(Show roots|显示根目录|Open navigation drawer)$/.test(n['content-desc']),
    )
  }
  assert.ok(selected, 'System audio file selection was not completed')
  await picker
    .locator('.music-local-selection')
    .filter({ hasText: 'nobi_audio_reference.wav' })
    .waitFor()
  await page.screenshot({ path: join(output, 'selected-local-music.png') })
  await picker.getByRole('button', { name: '完成选择' }).click()
  await fan.locator('.fan-photo.is-active').click()
  await viewer
    .locator('.viewer-quality')
    .filter({ hasText: /^原图$/ })
    .waitFor()
  await viewer.getByRole('button', { name: '开启分类配乐' }).click()
  await page.waitForFunction(() => {
    const audio = globalThis.__nobiAudio[globalThis.__nobiAudio.length - 1]
    return audio && !audio.paused && audio.currentTime > 0.2 && audio.readyState >= 3
  })
  const playback = await page.evaluate(() => {
    const audio = globalThis.__nobiAudio[globalThis.__nobiAudio.length - 1]
    return {
      blobSource: audio.src.startsWith('blob:'),
      time: audio.currentTime,
      duration: audio.duration,
      ready: audio.readyState,
    }
  })
  assert.ok(playback.blobSource && Math.abs(playback.duration - 10) < 0.1)
  await adb('shell', 'input', 'keyevent', '3')
  await setTimeout(800)
  await adb('shell', 'am', 'start', '-n', 'app.nobi.photos/.MainActivity')
  await page.waitForFunction(() => !globalThis.document.querySelector('.photo-viewer'))
  assert.ok(
    await page.evaluate(() =>
      globalThis.__nobiAudio.every((a) => a.paused && !a.getAttribute('src')),
    ),
  )
  assert.equal(await adb('shell', 'run-as', 'app.nobi.photos', 'ls', 'cache/nobi-viewer'), '')
  await page.getByRole('button', { name: '选择背景音乐' }).click()
  await picker.getByRole('button', { name: '移除本机音乐' }).click()
  assert.equal(await page.evaluate(() => globalThis.__nobiRevoked.length), 1)
  await picker.getByRole('button', { name: '完成选择' }).click()
  assert.deepEqual(remote, [])
  const result = {
    checkedAt: new Date().toISOString(),
    version: '0.9.0',
    platform: 'Android 14 / API 34 dedicated AVD',
    fixturePhotos: names.length,
    generatedAudioSha256: fixtureHash,
    nativeSystemPicker: true,
    cancelledPickerKeepsPanel: true,
    viewerClosedBeforePicker: true,
    localFileSelected: true,
    offlinePlayback: playback,
    noExternalRequests: true,
    backgroundStopsAudioAndClearsOriginals: true,
    removedAudioRevokesURL: true,
    privatePhotos: false,
    privateMusic: false,
    status: 'passed',
  }
  await writeFile(join(output, 'result.json'), JSON.stringify(result, null, 2))
  console.log(
    'Native fan albums, system audio picker, offline local audio and lifecycle cleanup passed',
  )
} finally {
  await browser?.close()
  if (port) await adb('forward', '--remove', `tcp:${port}`)
  await adb('shell', 'am', 'force-stop', 'app.nobi.photos')
  if (airplane !== '1') await adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'disable')
  if (wifi === '1' || wifi === '2') await adb('shell', 'svc', 'wifi', 'enable')
}
