import { expect, test } from '@playwright/test'
import { testWave } from './helpers/audio'

test('category albums open at the top, survive reload, and slideshow loops and pauses', async ({
  page,
}, testInfo) => {
  await page.goto('/#/albums')
  await page.getByRole('button', { name: /自然.*张照片/ }).click()
  await expect(page).toHaveURL(/album=category/)
  await expect(page.getByRole('heading', { name: '自然', exact: true })).toBeInViewport()
  await expect(page.locator('.album-card')).toHaveCount(0)
  const count = await page.locator('.photo-card').count()
  expect(count).toBeGreaterThan(1)
  await page.reload()
  await expect(page.locator('.photo-card')).toHaveCount(count)
  await page.getByRole('button', { name: '播放相册' }).click()
  const viewer = page.getByRole('dialog', { name: '照片详情' })
  await expect(viewer.locator('.viewer-quality')).toHaveText('示例插画')
  await expect(viewer.getByRole('button', { name: '暂停轮播' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await viewer.getByRole('button', { name: '暂停轮播' }).click()
  await page.clock.install()
  const first = await viewer.locator('img.is-current').getAttribute('alt')
  await viewer.getByRole('button', { name: '开始自动轮播' }).click()
  for (let i = 1; i <= count; i++) {
    await page.clock.fastForward(5100)
    await expect(viewer.locator('.viewer-count')).toHaveText(`${(i % count) + 1} / ${count}`)
    await expect(viewer.locator('.viewer-quality')).toHaveText('示例插画')
  }
  await expect(viewer.locator('img.is-current')).toHaveAttribute('alt', first!)
  await viewer.getByRole('button', { name: '暂停轮播' }).click()
  await page.clock.fastForward(20000)
  await expect(viewer.locator('img.is-current')).toHaveAttribute('alt', first!)
  const bounds = await viewer.locator('img.is-current').boundingBox()
  expect(bounds!.width).toBeCloseTo(page.viewportSize()!.width, 0)
  expect(bounds!.height).toBeCloseTo(page.viewportSize()!.height, 0)
  await page.screenshot({ path: `test-results/${testInfo.project.name}-fullscreen-playback.png` })
  await viewer.getByRole('button', { name: '关闭照片详情' }).click()
  await page.getByRole('button', { name: '返回相册列表' }).click()
  await expect(page.locator('.album-card')).toHaveCount(4)
})

// A short deterministic media response tests the browser decoder and network boundary.
// The separate scripts/check-online-music.mjs validates the actual artist-hosted recording.
test('online category music is opt-in, attributed and cancelled; offline photos remain usable', async ({
  page,
  context,
}) => {
  await page.addInitScript(`
    window.__nobiAudio = [];
    const Original = window.Audio;
    window.Audio = function() { const audio = new Original(); window.__nobiAudio.push(audio); return audio; };
  `)
  const requests: { url: string; method: string; body: string | null; referrer?: string }[] = []
  await page.route('https://incompetech.com/**', async (route) => {
    const request = route.request()
    requests.push({
      url: request.url(),
      method: request.method(),
      body: request.postData(),
      referrer: request.headers().referer,
    })
    await route.fulfill({ status: 200, contentType: 'audio/wav', body: testWave() })
  })
  const audio = () =>
    page.evaluate(() => {
      const list = (window as unknown as { __nobiAudio: HTMLAudioElement[] }).__nobiAudio
      const last = list[list.length - 1]
      return {
        count: list.length,
        paused: last?.paused,
        src: last?.getAttribute('src'),
        time: last?.currentTime ?? 0,
      }
    })
  await page.goto('/#/albums')
  await page.getByRole('button', { name: /自然.*张照片/ }).click()
  await page.getByRole('button', { name: '播放相册' }).click()
  const viewer = page.getByRole('dialog', { name: '照片详情' })
  await expect(viewer.locator('.viewer-quality')).toHaveText('示例插画')
  expect((await audio()).count).toBe(0)
  expect(requests).toEqual([])
  await viewer.getByRole('button', { name: '开启分类配乐' }).click()
  await expect.poll(async () => (await audio()).time).toBeGreaterThan(0.1)
  await expect(viewer.locator('.viewer-music-caption')).toContainText(
    'Dream Culture · Kevin MacLeod · CC BY 4.0',
  )
  await viewer.getByRole('button', { name: '曲目来源' }).click()
  const info = viewer.getByRole('region', { name: '配乐来源与授权' })
  await expect(info.getByRole('link', { name: /原曲页面/ })).toHaveAttribute(
    'href',
    'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300046&Search=Search',
  )
  await expect(info).toContainText('照片、文件名与相册标题不发送')
  await viewer.getByRole('button', { name: '收起配乐信息' }).click()
  expect(requests.length).toBeGreaterThan(0)
  expect(
    requests.every(
      (r) =>
        r.url ===
          'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Dream%20Culture.mp3' &&
        r.method === 'GET' &&
        r.body === null &&
        !r.referrer,
    ),
  ).toBe(true)
  await viewer.getByRole('button', { name: '关闭背景音乐' }).click()
  expect((await audio()).src).toBeNull()
  expect((await audio()).paused).toBe(true)
  await context.unrouteAll()
  await page.unrouteAll()
  await context.setOffline(true)
  await viewer.getByRole('button', { name: '开启分类配乐' }).click()
  await expect(viewer.getByRole('alert')).toContainText('在线音乐暂不可用')
  const before = await viewer.locator('.viewer-count').innerText()
  await viewer.getByRole('button', { name: '下一张照片' }).click()
  await expect(viewer.locator('.viewer-count')).not.toHaveText(before)
  await viewer.getByRole('button', { name: '关闭照片详情' }).click()
  expect((await audio()).src).toBeNull()
})

test('carousel keeps decoded photos mounted and covers every animation frame', async ({ page }) => {
  await page.goto('/#/albums')
  await page.getByRole('button', { name: /自然.*张照片/ }).click()
  await page.getByRole('button', { name: '网格查看' }).click()
  await page.locator('.photo-open').first().click()
  const viewer = page.getByRole('dialog', { name: '照片详情' })
  await expect(viewer.locator('.viewer-quality')).toHaveText('示例插画')
  // Sample each display frame, checking that no gap or blank image replaces the original.
  await page.evaluate(() => {
    const result = { frames: 0, overlap: 0, moving: 0, gaps: 0, broken: 0 }
    const old = document.querySelector('.viewer-image.is-current')!
    const sample = () => {
      if (!document.querySelector('.photo-viewer')) return
      const images = [...document.querySelectorAll<HTMLImageElement>('.viewer-image')]
      const rects = images.map((i) => i.getBoundingClientRect()).sort((a, b) => a.x - b.x)
      result.frames++
      if (images.length === 2) {
        result.overlap++
        if (old.isConnected && rects.some((r) => r.x < -1 && r.right > 1)) result.moving++
      }
      if (images.some((i) => !i.complete || !i.naturalWidth)) result.broken++
      if (
        !rects.length ||
        rects[0]!.x > 1 ||
        rects[rects.length - 1]!.right < innerWidth - 1 ||
        (rects.length === 2 && Math.abs(rects[0]!.right - rects[1]!.left) > 2)
      )
        result.gaps++
      requestAnimationFrame(sample)
    }
    ;(window as unknown as { __carousel: typeof result }).__carousel = result
    requestAnimationFrame(sample)
  })
  const first = await viewer.locator('img.is-current').getAttribute('alt')
  await viewer.getByRole('button', { name: '下一张照片' }).click()
  await expect(viewer.locator('img.is-current')).not.toHaveAttribute('alt', first!)
  const result = await page.evaluate(
    () =>
      (
        window as unknown as {
          __carousel: { overlap: number; moving: number; gaps: number; broken: number }
        }
      ).__carousel,
  )
  expect(result.overlap).toBeGreaterThan(2)
  expect(result.moving).toBeGreaterThan(2)
  expect(result.gaps).toBe(0)
  expect(result.broken).toBe(0)
  await viewer.getByRole('button', { name: '上一张照片' }).click()
  await expect(viewer.locator('img.is-current')).toHaveAttribute('alt', first!)
  await viewer.getByRole('button', { name: '关闭照片详情' }).click()
})
