import { expect, test } from '@playwright/test'
test('reviewed smart albums require explicit confirmation and merge without changing originals', async ({
  page,
}) => {
  await page.goto('/#/albums')
  const card = page.getByRole('region', { name: 'AI 智能整理相册' })
  await expect(card).toContainText('不执行图像模型')
  await card.getByRole('button', { name: '体验示例整理', exact: true }).click()
  await expect(card.getByRole('status')).toContainText('示例整理完成')
  await expect(page.locator('.user-album')).toHaveCount(0)
  await expect(card.getByRole('button', { name: '预览保存 0 个相册' })).toBeDisabled()
  await card.getByRole('checkbox').first().check()
  await card.getByRole('button', { name: '预览保存 1 个相册' }).click()
  const dialog = page.getByRole('dialog', { name: '保存智能建议相册？' })
  await dialog.getByRole('button', { name: '暂不保存' }).click()
  await expect(page.locator('.user-album')).toHaveCount(0)
  await card.getByRole('button', { name: '预览保存 1 个相册' }).click()
  await dialog.getByRole('button', { name: '确认保存相册' }).click()
  await expect(page.locator('.user-album')).toHaveCount(1)
  await page.reload()
  await expect(page.locator('.user-album')).toHaveCount(1)
  await page.goto('/')
  await expect(page.locator('.photo-card')).toHaveCount(12)
})
