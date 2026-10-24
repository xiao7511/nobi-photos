import { expect, test } from '@playwright/test'

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
  const first = await viewer.locator('img').getAttribute('alt')
  await viewer.getByRole('button', { name: '开始自动轮播' }).click()
  for (let i = 1; i <= count; i++) {
    await page.clock.fastForward(5100)
    await expect(viewer.locator('.viewer-count')).toHaveText(`${(i % count) + 1} / ${count}`)
    await expect(viewer.locator('.viewer-quality')).toHaveText('示例插画')
  }
  await expect(viewer.locator('img')).toHaveAttribute('alt', first!)
  await viewer.getByRole('button', { name: '暂停轮播' }).click()
  await page.clock.fastForward(20000)
  await expect(viewer.locator('img')).toHaveAttribute('alt', first!)
  const bounds = await viewer.locator('img').boundingBox()
  expect(bounds!.width).toBeCloseTo(page.viewportSize()!.width, 0)
  expect(bounds!.height).toBeCloseTo(page.viewportSize()!.height, 0)
  await page.screenshot({ path: `test-results/${testInfo.project.name}-fullscreen-playback.png` })
  await viewer.getByRole('button', { name: '关闭照片详情' }).click()
  await page.getByRole('button', { name: '返回相册列表' }).click()
  await expect(page.locator('.album-card')).toHaveCount(4)
})

test('category music produces real audio offline only on request and releases the audio context', async ({
  page,
  context,
}) => {
  await page.addInitScript({
    content: `
    const OriginalContext = window.AudioContext;
    window.__nobiAudio = [];
    window.AudioContext = class extends OriginalContext {
      constructor(...args) {
        super(...args);
        this.__tap = this.createAnalyser();
        this.__mute = this.createGain();
        this.__mute.gain.value = 0;
        this.__tap.connect(this.__mute);
        this.__mute.connect(this.destination);
        window.__nobiAudio.push(this);
      }
    };
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function(destination, ...args) {
      if (destination instanceof AudioDestinationNode && this.context.__tap && this !== this.context.__mute)
        connect.call(this, this.context.__tap);
      return connect.call(this, destination, ...args);
    };
  `,
  })
  await page.goto('/#/albums')
  await page.getByRole('button', { name: /自然.*张照片/ }).click()
  await page.getByRole('button', { name: '播放相册' }).click()
  const viewer = page.getByRole('dialog', { name: '照片详情' })
  await expect(viewer.locator('.viewer-quality')).toHaveText('示例插画')
  const audio = () =>
    page.evaluate(() => {
      const contexts = (
        window as unknown as { __nobiAudio: (AudioContext & { __tap: AnalyserNode })[] }
      ).__nobiAudio
      const last = contexts.at(-1)
      if (!last) return { count: 0, state: '', rms: 0 }
      const values = new Float32Array(last.__tap.fftSize)
      last.__tap.getFloatTimeDomainData(values)
      return {
        count: contexts.length,
        state: last.state,
        rms: Math.sqrt(values.reduce((sum, v) => sum + v * v, 0) / values.length),
      }
    })
  expect((await audio()).count).toBe(0)
  await context.setOffline(true)
  await viewer.getByRole('button', { name: '开启分类配乐' }).click()
  await expect(viewer.locator('.viewer-music-caption')).toHaveText('山林微风 · 分类配乐')
  await expect.poll(async () => (await audio()).rms).toBeGreaterThan(0.0001)
  expect((await audio()).state).toBe('running')
  await viewer.getByRole('button', { name: '关闭背景音乐' }).click()
  await expect.poll(async () => (await audio()).state).toBe('closed')
  await viewer.getByRole('button', { name: '开启分类配乐' }).click()
  await expect.poll(async () => (await audio()).rms).toBeGreaterThan(0.0001)
  await viewer.getByRole('button', { name: '关闭照片详情' }).click()
  await expect.poll(async () => (await audio()).state).toBe('closed')
})
