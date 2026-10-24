import { expect, test } from '@playwright/test'
import { testWave } from './helpers/audio'

test('organized album covers and browsing form a fan, with grid and fullscreen original access', async ({
  page,
}, info) => {
  await page.goto('/#/albums')
  await expect(page.locator('.album-fan-cover')).toHaveCount(4)
  const covers = page.locator('.album-cover-leaf')
  expect(await covers.count()).toBeGreaterThan(4)
  await page.getByRole('button', { name: /自然.*张照片/ }).click()
  const fan = page.getByRole('region', { name: '扇形相册浏览' })
  await expect(fan).toBeVisible()
  await expect(fan.locator('.fan-photo')).toHaveCount(5)
  expect(
    await fan
      .locator('.fan-photo')
      .evaluateAll((cards) => new Set(cards.map((card) => getComputedStyle(card).transform)).size),
  ).toBeGreaterThan(2)
  const first = await fan.getByRole('status').innerText()
  await fan.locator('.is-active').focus()
  await page.keyboard.press('ArrowRight')
  await expect(fan.locator('.is-active')).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(fan.getByRole('status')).toHaveText('5 / 5')
  await expect(fan.locator('.is-active')).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await expect(fan.getByRole('status')).toHaveText(first)
  await fan.getByRole('button', { name: '扇形下一张' }).click()
  await expect(fan.getByRole('status')).not.toHaveText(first)
  await fan.getByRole('button', { name: '扇形上一张' }).click()
  await expect(fan.getByRole('status')).toHaveText(first)
  const title = (await fan.locator('.is-active').getAttribute('aria-label'))!.slice(2)
  await fan.locator('.is-active').click()
  const viewer = page.getByRole('dialog', { name: '照片详情' })
  await expect(viewer.locator('img.is-current')).toHaveAttribute('alt', title)
  await expect(viewer.locator('.viewer-quality')).toHaveText('示例插画')
  await viewer.getByRole('button', { name: '关闭照片详情' }).click()
  await expect(fan.locator('.is-active')).toBeFocused()
  await page.getByRole('button', { name: '网格查看' }).click()
  await expect(page.locator('.photo-open').first()).toBeVisible()
  await page.getByRole('button', { name: '扇形查看' }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `test-results/${info.project.name}-fan-album.png` })
})

test('music list is selectable without network requests or automatic playback', async ({
  page,
}) => {
  const remote: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).protocol === 'https:') remote.push(request.url())
  })
  await page.goto('/#/albums')
  await page.getByRole('button', { name: /自然.*张照片/ }).click()
  await page.getByRole('button', { name: '选择背景音乐' }).click()
  const picker = page.getByRole('dialog', { name: '选择背景音乐' })
  await picker.getByRole('button', { name: '选用 Long Stroll', exact: true }).click()
  await expect(
    picker.getByRole('button', { name: '选用 Long Stroll', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(remote).toEqual([])
  await picker.getByRole('button', { name: '完成选择' }).click()
  await page.locator('.fan-photo.is-active').click()
  const viewer = page.getByRole('dialog', { name: '照片详情' })
  await viewer.getByRole('button', { name: '选择背景音乐' }).click()
  await expect(
    picker.getByRole('button', { name: '选用 Long Stroll', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await picker.getByRole('button', { name: '按相册分类推荐' }).click()
  await picker.getByRole('button', { name: '完成选择' }).click()
  await expect(viewer.getByRole('button', { name: '开启分类配乐' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  expect(remote).toEqual([])
})

test('local audio survives native-style viewer closure, plays offline, and is revocable and session-only', async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    const Original = window.Audio
    const state = window as unknown as { __audio: HTMLAudioElement[]; __revoked: string[] }
    state.__audio = []
    state.__revoked = []
    window.Audio = function () {
      const audio = new Original()
      state.__audio.push(audio)
      return audio
    } as unknown as typeof Audio
    const revoke = URL.revokeObjectURL.bind(URL)
    URL.revokeObjectURL = (url) => {
      state.__revoked.push(url)
      revoke(url)
    }
  })
  const remote: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).protocol === 'https:') remote.push(request.url())
  })
  await page.goto('/#/albums')
  await page.getByRole('button', { name: /自然.*张照片/ }).click()
  await page.locator('.fan-photo.is-active').click()
  let viewer = page.getByRole('dialog', { name: '照片详情' })
  await viewer.getByRole('button', { name: '选择背景音乐' }).click()
  const picker = page.getByRole('dialog', { name: '选择背景音乐' })
  const fileChooser = page.waitForEvent('filechooser')
  await picker.getByRole('button', { name: /从手机选择音乐文件/ }).click()
  await (
    await fileChooser
  ).setFiles({ name: '本机测试曲.wav', mimeType: 'audio/wav', buffer: testWave() })
  await expect(viewer).toHaveCount(0)
  await expect(picker).toContainText('已选择：本机测试曲.wav')
  await picker.getByRole('button', { name: '完成选择' }).click()
  await context.setOffline(true)
  await page.locator('.fan-photo.is-active').click()
  viewer = page.getByRole('dialog', { name: '照片详情' })
  await viewer.getByRole('button', { name: '开启分类配乐' }).click()
  await expect(viewer.locator('.viewer-music-caption')).toContainText('本机测试曲.wav · 本机音频')
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __audio: HTMLAudioElement[] }).__audio.at(-1)?.currentTime ?? 0,
      ),
    )
    .toBeGreaterThan(0.1)
  expect(remote).toEqual([])
  expect(await page.evaluate(() => JSON.stringify(localStorage).includes('本机测试曲'))).toBe(false)
  await viewer.getByRole('button', { name: '选择背景音乐' }).click()
  await picker.getByRole('button', { name: '移除本机音乐' }).click()
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __revoked: string[] }).__revoked.length),
    )
    .toBe(1)
  await picker.getByRole('button', { name: '完成选择' }).click()
  await expect(viewer.getByRole('button', { name: '开启分类配乐' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await viewer.getByRole('button', { name: '关闭照片详情' }).click()
  await context.setOffline(false)
  await page.reload()
  await page.getByRole('button', { name: '选择背景音乐' }).click()
  await expect(picker).not.toContainText('本机测试曲.wav')
  await expect(picker.getByRole('button', { name: '按相册分类推荐' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})
