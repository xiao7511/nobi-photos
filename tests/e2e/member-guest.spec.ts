import { expect, test } from '@playwright/test'
test('guest keeps local library without account requests or fake membership', async ({ page }) => {
  const external: string[] = []
  page.on('request', (request) => {
    if (!['localhost', '127.0.0.1'].includes(new URL(request.url()).hostname))
      external.push(request.url())
  })
  await page.goto('/#/profile')
  await page.getByRole('link', { name: '注册 / 登录', exact: false }).click()
  await expect(
    page.getByText('账号服务尚未配置。注册和登录暂不可用', { exact: false }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: '登录', exact: true }).last()).toBeDisabled()
  await page.goto('/#/studio')
  await expect(page.getByRole('heading', { name: '注册用户专属创作' })).toBeVisible()
  await expect(page.getByRole('button', { name: '生成成品预览' })).toHaveCount(0)
  await page.goto('/#/albums')
  await expect(page.getByRole('button', { name: '新建相册', exact: true })).toBeEnabled()
  expect(external).toEqual([])
})
