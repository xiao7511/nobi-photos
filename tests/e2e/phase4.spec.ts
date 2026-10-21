import { expect, test } from '@playwright/test'

test('bulk organization persists offline and combined search updates when matching metadata changes', async ({
  page,
  context,
}, testInfo) => {
  const errors: string[] = [],
    remote: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('request', (request) => {
    if (!['127.0.0.1', 'localhost'].includes(new URL(request.url()).hostname))
      remote.push(request.url())
  })
  await page.goto('/#/albums')
  await page.getByRole('button', { name: '新建相册', exact: true }).click()
  const editor = page.getByRole('dialog', { name: '新建相册' })
  await editor.getByRole('textbox', { name: '相册名称' }).fill('批量旅行')
  await editor.getByRole('button', { name: '保存相册', exact: true }).click()
  await page.goto('/')
  async function selectPair() {
    await page.getByRole('button', { name: '选择照片', exact: true }).click()
    await page.getByRole('button', { name: '选择山野之间', exact: true }).click()
    await page.getByRole('button', { name: '选择海风来信', exact: true }).click()
    await page.getByRole('button', { name: '整理所选照片', exact: true }).click()
  }
  await selectPair()
  const batch = page.getByRole('dialog', { name: '批量整理 2 张照片', exact: true })
  await batch.getByRole('combobox', { name: '整理操作' }).selectOption('tags-add')
  await batch.getByRole('textbox', { name: '批量手动标签' }).fill('Phase4，旅行记')
  await batch.getByRole('button', { name: '确认保存整理' }).click()
  await selectPair()
  await batch.getByRole('combobox', { name: '整理操作' }).selectOption('album-add')
  await batch.getByRole('combobox', { name: '目标相册' }).selectOption({ label: '批量旅行' })
  await batch.getByRole('button', { name: '确认保存整理' }).click()
  await selectPair()
  await batch.getByRole('combobox', { name: '整理操作' }).selectOption('favorite-on')
  await batch.getByRole('button', { name: '确认保存整理' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: '取消收藏海风来信', exact: true })).toBeVisible()
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((r) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => r(), { once: true }),
      )
  })
  await context.setOffline(true)
  await page.goto('/#/search')
  await page.locator('.advanced-search summary').click()
  await page.getByLabel('开始日期', { exact: true }).fill('2026-10-18')
  await page.getByLabel('结束日期', { exact: true }).fill('2026-10-18')
  await page.getByRole('combobox', { name: '所属相册' }).selectOption({ label: '批量旅行' })
  await page.getByRole('textbox', { name: '精确手动标签' }).fill('phase4，旅行记')
  await page.getByRole('checkbox', { name: '仅看本地收藏' }).check()
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await expect(page.locator('.photo-card')).toHaveCount(2)
  await page.getByRole('combobox', { name: '照片画幅' }).selectOption('portrait')
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await expect(page.locator('.photo-card')).toHaveCount(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: '选择照片', exact: true }).click()
  await page.getByRole('button', { name: '全选当前结果', exact: true }).click()
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-phase4-search.png`,
    fullPage: true,
    style: '.skip-link:not(:focus) { visibility: hidden; }',
  })
  await page.getByRole('button', { name: '切换深色模式', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-phase4-dark.png`,
    fullPage: true,
    style: '.skip-link:not(:focus) { visibility: hidden; }',
  })
  await page.getByRole('button', { name: '整理所选照片', exact: true }).click()
  const single = page.getByRole('dialog', { name: '批量整理 1 张照片', exact: true })
  await single.getByRole('combobox', { name: '整理操作' }).selectOption('tags-remove')
  await single.getByRole('textbox', { name: '批量手动标签' }).fill('PHASE4')
  await single.getByRole('button', { name: '确认保存整理' }).click()
  await expect(page.locator('.photo-card')).toHaveCount(0)
  await page.getByRole('button', { name: '重置搜索', exact: true }).click()
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await expect(page.locator('.photo-card')).toHaveCount(12)
  expect(errors).toEqual([])
  expect(remote).toEqual([])
})

test('selection cancellation is harmless and invalid date ranges are explained', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: '选择照片', exact: true }).click()
  await page.getByRole('button', { name: '全选当前结果', exact: true }).click()
  await page.getByRole('button', { name: '整理所选照片', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '批量整理 12 张照片', exact: true })
  await dialog.getByRole('combobox', { name: '整理操作' }).selectOption('favorite-off')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '退出选择', exact: true }).click()
  await expect(page.locator('.favorite-button[aria-pressed="true"]')).toHaveCount(3)
  await page.getByRole('button', { name: '选择照片', exact: true }).click()
  await page.getByRole('button', { name: '选择海风来信', exact: true }).click()
  await page.getByRole('button', { name: '自然', exact: true }).click()
  await expect(page.getByRole('button', { name: '整理所选照片', exact: true })).toBeDisabled()
  await page.goto('/#/search')
  await page.locator('.advanced-search summary').click()
  await page.getByLabel('开始日期', { exact: true }).fill('2026-10-19')
  await page.getByLabel('结束日期', { exact: true }).fill('2026-10-18')
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('开始日期不能晚于结束日期。')
  await expect(page.locator('.photo-card')).toHaveCount(0)
})
