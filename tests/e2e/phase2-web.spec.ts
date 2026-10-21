import { expect, test } from '@playwright/test'
test('browser explains native boundary without requesting access or scanning', async ({
  page,
}, testInfo) => {
  const remote: string[] = []
  page.on('request', (request) => {
    if (!['127.0.0.1', 'localhost'].includes(new URL(request.url()).hostname))
      remote.push(request.url())
  })
  await page.goto('/#/privacy')
  await expect(page.getByRole('heading', { name: '安心，是最好的底色.' })).toBeVisible()
  await expect(page.getByText('浏览器示例模式', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '连接并读取照片' })).toHaveCount(0)
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByText('相册权限由你决定', { exact: true })).toBeVisible()
  await expect(page.getByText(/元数据未启用应用层加密/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-phase2-privacy.png`,
    fullPage: true,
  })
  await page.goto('/')
  await expect(page.locator('.photo-card')).toHaveCount(12)
  await expect(page.getByText('浏览器示例模式', { exact: true })).toBeVisible()
  expect(remote).toEqual([])
})
