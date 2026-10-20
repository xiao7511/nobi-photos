import { expect, test } from '@playwright/test'
test('five pages, local actions, safety and responsive layout', async ({ page }, testInfo) => {
  const errors: string[] = []
  const remote: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('request', (r) => {
    if (!new URL(r.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/)) remote.push(r.url())
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '把日子，存成喜欢的样子.' })).toBeVisible()
  await expect(page.locator('.photo-card')).toHaveCount(12)
  await page.getByRole('button', { name: '收藏海风来信', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: '取消收藏海风来信', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: '我的收藏', exact: true }).click()
  await expect(page.locator('.photo-card')).toHaveCount(4)
  await page.getByRole('button', { name: '查看海风来信', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.goto('/#/albums')
  await expect(page.locator('.album-card')).toHaveCount(4)
  await page.getByRole('button', { name: /自然.*张照片/ }).click()
  await expect(page.locator('.photo-card')).toHaveCount(5)
  await page.goto('/#/search')
  await page.getByRole('textbox', { name: '搜索照片' }).fill('海')
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  // Includes the architecture sample located in 上海, since location is searchable.
  await expect(page.locator('.photo-card')).toHaveCount(4)
  await page.goto('/#/cleanup')
  await expect(page.getByText('自动删除已禁用')).toBeVisible()
  await page.getByRole('button', { name: '全部保留（本次会话）' }).click()
  await expect(page.getByRole('button', { name: '已标记全部保留' })).toBeDisabled()
  await page.goto('/#/profile')
  await page.getByRole('button', { name: '深色', exact: true }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.screenshot({ path: `test-results/${testInfo.project.name}-dark.png`, fullPage: true })
  await page.getByRole('button', { name: '浅色', exact: true }).click()
  await page.goto('/#/privacy')
  await page.getByRole('button', { name: '清除本地示例记录', exact: true }).click()
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await page.goto('/')
  await expect(page.locator('.photo-card')).toHaveCount(12)
  await page.goto('/#/privacy')
  await page.getByRole('button', { name: '清除本地示例记录', exact: true }).click()
  await page.getByRole('button', { name: '确认操作', exact: true }).click()
  await page.goto('/')
  await expect(page.locator('.photo-card')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.photo-card')).toHaveCount(0)
  await page.goto('/#/privacy')
  await page.getByRole('button', { name: '恢复示例相册', exact: true }).click()
  await page.getByRole('button', { name: '确认操作', exact: true }).click()
  await page.goto('/')
  await expect(page.locator('.photo-card')).toHaveCount(12)
  await page.getByRole('button', { name: /连接本机相册/ }).click()
  await expect(page.getByRole('status')).toContainText('Phase 2')
  await page.getByRole('button', { name: '关闭通知' }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-photos.png`,
    fullPage: true,
  })
  if (testInfo.project.name === 'desktop') {
    for (const width of [320, 680, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true)
      const bounds = await page.locator('.memory-hero').boundingBox()
      expect(bounds?.height).toBeLessThanOrEqual(360)
    }
  }
  expect(errors).toEqual([])
  expect(remote).toEqual([])
})

test('production cache supports offline reload and all five routes', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      )
  })
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.photo-card')).toHaveCount(12)
  for (const [route, heading] of [
    ['albums', '喜欢的事物，自成一集.'],
    ['search', '想起那一刻，就能找到.'],
    ['cleanup', '轻一点，装下更多美好.'],
    ['profile', '你的回忆，你的空间.'],
    ['privacy', '安心，是最好的底色.'],
  ]) {
    await page.goto(`/#/${route}`)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
  }
  expect(
    await page.evaluate(() => [...document.images].every((i) => !i.complete || i.naturalWidth > 0)),
  ).toBe(true)
})
