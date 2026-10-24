import assert from 'node:assert/strict'
import { URL } from 'node:url'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import console from 'node:console'
import { chromium } from '@playwright/test'
// Run against this project's built preview. No routes, replacement audio or private photos.
const baseURL = process.env.NOBI_MUSIC_PREVIEW || 'http://127.0.0.1:4398'
assert.ok(/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(baseURL))
const browser = await chromium.launch({
  channel: process.env.NOBI_BROWSER_CHANNEL || 'msedge',
  headless: true,
})
const results = [],
  requests = []
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await context.addInitScript(() => {
    const Original = globalThis.Audio
    globalThis.__nobiAudio = []
    globalThis.Audio = function () {
      const audio = new Original()
      globalThis.__nobiAudio.push(audio)
      return audio
    }
  })
  const page = await context.newPage()
  page.on('requestfailed', (request) =>
    console.log('Media request failure:', request.url(), request.failure()?.errorText),
  )
  page.on('response', (response) => {
    if (response.url().includes('incompetech'))
      console.log('Media response:', response.status(), response.url())
  })
  page.on('console', (message) => {
    if (message.type() === 'error') console.log('Browser error:', message.text())
  })
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== baseURL)
      requests.push({
        url: request.url(),
        method: request.method(),
        body: request.postData(),
        referer: request.headers().referer,
      })
  })
  for (const category of (process.env.NOBI_MUSIC_CATEGORIES || '自然,旅行,生活,建筑').split(',')) {
    await page.goto(`${baseURL}/#/albums`)
    await page.getByRole('button', { name: new RegExp(`${category}.*张照片`) }).click()
    const play = page.getByRole('button', { name: '播放相册' })
    if (await play.isEnabled()) await play.click()
    else await page.locator('.photo-open').first().click()
    const viewer = page.getByRole('dialog', { name: '照片详情' })
    await viewer
      .locator('.viewer-quality')
      .filter({ hasText: /^示例插画$/ })
      .waitFor()
    const pause = viewer.getByRole('button', { name: '暂停轮播' })
    if (await pause.count()) await pause.click()
    await viewer.getByRole('button', { name: '开启分类配乐' }).click()
    await page
      .waitForFunction(
        () => {
          const audio = globalThis.__nobiAudio[globalThis.__nobiAudio.length - 1]
          return audio && !audio.paused && audio.currentTime > 0.5 && audio.duration > 30
        },
        undefined,
        { timeout: 25000 },
      )
      .catch(async (error) => {
        console.log(
          'Playback state:',
          await page.evaluate(() => ({
            audio: globalThis.__nobiAudio.map((a) => ({
              src: a.src,
              current: a.currentSrc,
              paused: a.paused,
              time: a.currentTime,
              ready: a.readyState,
              network: a.networkState,
              error: a.error?.message,
            })),
            message: globalThis.document.querySelector('.viewer-error')?.textContent,
            visibility: globalThis.document.visibilityState,
          })),
        )
        throw error
      })
    const recording = await page.evaluate(() => {
      const audio = globalThis.__nobiAudio[globalThis.__nobiAudio.length - 1]
      return {
        url: audio.currentSrc,
        time: audio.currentTime,
        duration: audio.duration,
        ready: audio.readyState,
      }
    })
    await viewer.getByRole('button', { name: '关闭照片详情' }).click()
    assert.ok(
      await page.evaluate(() =>
        globalThis.__nobiAudio.every((a) => a.paused && !a.getAttribute('src')),
      ),
    )
    results.push({ category, ...recording, releasedOnClose: true })
  }
  assert.ok(requests.length > 0)
  assert.ok(
    requests.every(
      (r) =>
        /^https:\/\/incompetech\.com\/music\/royalty-free\/mp3-royaltyfree\/[A-Za-z0-9%]+\.mp3$/.test(
          r.url,
        ) &&
        r.method === 'GET' &&
        !r.body &&
        !r.referer,
    ),
  )
  const output = resolve('artifacts/online-music')
  await mkdir(output, { recursive: true })
  await writeFile(
    resolve(output, 'result.json'),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        recordings: results,
        requestCount: requests.length,
        onlyFixedMusicGetRequests: true,
        privatePhotos: false,
        status: 'passed',
      },
      null,
      2,
    ),
  )
  console.log(JSON.stringify(results))
} finally {
  await browser.close()
}
