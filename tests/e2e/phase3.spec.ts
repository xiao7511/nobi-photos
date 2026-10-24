import { expect, test } from '@playwright/test'
test('albums and manual tags persist, search offline, and album removal leaves photos intact', async ({
  page,
  context,
}, testInfo) => {
  const errors: string[] = []
  const remote: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('request', (r) => {
    if (!['127.0.0.1', 'localhost'].includes(new URL(r.url()).hostname)) remote.push(r.url())
  })
  await page.goto('/#/albums')
  await page.getByRole('button', { name: '新建相册', exact: true }).click()
  const editor = page.getByRole('dialog', { name: '新建相册', exact: true })
  await editor.getByRole('textbox', { name: '相册名称' }).fill('周末小记')
  await editor.getByRole('checkbox', { name: '将山野之间加入相册', exact: true }).check()
  await editor.getByRole('checkbox', { name: '将海风来信加入相册', exact: true }).check()
  await editor.getByRole('button', { name: '保存相册', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByRole('heading', { name: '周末小记', exact: true })).toBeInViewport()
  await page.getByRole('button', { name: '返回相册列表' }).click()
  await page.reload()
  await expect(page.locator('.user-album')).toContainText('周末小记')
  await page.locator('.user-album').click()
  await expect(page.locator('.photo-card')).toHaveCount(2)
  await page.getByRole('button', { name: '查看山野之间', exact: true }).click()
  const detail = page.getByRole('dialog', { name: '照片详情' })
  await detail.getByRole('button', { name: '编辑标签', exact: true }).click()
  await detail.getByRole('textbox', { name: '手动标签', exact: true }).fill('周末印记，珍藏')
  await detail.getByRole('button', { name: '保存标签', exact: true }).click()
  await expect(detail.locator('.chip').filter({ hasText: '周末印记' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((r) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => r(), { once: true }),
      )
  })
  await context.setOffline(true)
  await page.goto('/#/search')
  await page.getByRole('textbox', { name: '搜索照片' }).fill('周末印记')
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await expect(page.locator('.photo-card')).toHaveCount(1)
  await page.goto('/#/albums')
  await page.locator('.user-album').click()
  await page.getByRole('button', { name: '编辑相册', exact: true }).click()
  const edit = page.getByRole('dialog', { name: '编辑相册', exact: true })
  await edit.getByRole('textbox', { name: '相册名称' }).fill('珍藏周末')
  await edit.getByRole('checkbox', { name: '将海风来信加入相册', exact: true }).uncheck()
  await edit.getByRole('button', { name: '保存相册', exact: true }).click()
  await expect(page.locator('.photo-card')).toHaveCount(1)
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-phase3-albums.png`,
    fullPage: true,
  })
  await page.getByRole('button', { name: '移除相册', exact: true }).click()
  await page.getByRole('button', { name: '确认移除相册', exact: true }).click()
  await expect(page.locator('.user-album')).toHaveCount(0)
  await page.goto('/')
  await expect(page.locator('.photo-card')).toHaveCount(12)
  expect(errors).toEqual([])
  expect(remote).toEqual([])
})
test('local similarity suggestions are explicit and preserve every original', async ({
  page,
}, testInfo) => {
  await page.goto('/#/cleanup')
  await expect(page.getByText(/本地分析完成/)).toHaveCount(0)
  await page.getByRole('button', { name: '开始本地分析', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '本地分析完成' })).toBeVisible({
    timeout: 20000,
  })
  await expect(page.getByRole('heading', { name: /可能相似 ·/ }).first()).toBeVisible()
  await page.getByRole('button', { name: '保留此组（本次会话）', exact: true }).first().click()
  await expect(page.getByRole('button', { name: '已标记保留', exact: true }).first()).toBeDisabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-phase3-similar.png`,
    fullPage: true,
  })
  await page.goto('/')
  await expect(page.locator('.photo-card')).toHaveCount(12)
})
