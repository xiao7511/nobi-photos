import { expect, test, type Page } from '@playwright/test'
const email = 'creative@example.invalid',
  password = 'Nobi-test-password-123'
const user = {
  id: 'a0000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email,
  email_confirmed_at: '2026-01-01T00:00:00Z',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
}
async function authFixture(page: Page) {
  const calls: { path: string; body: string | null; method: string }[] = [],
    forbidden: string[] = []
  page.on('request', (r) => {
    if (!['127.0.0.1', 'nobi-auth.invalid'].includes(new URL(r.url()).hostname))
      forbidden.push(r.url())
  })
  const session = () => ({
    access_token: `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test`,
    token_type: 'bearer',
    expires_in: 3600,
    refresh_token: 'synthetic-refresh-token',
    user,
  })
  await page.route('https://nobi-auth.invalid/**', async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname
    calls.push({ path, body: request.postData(), method: request.method() })
    let body: unknown = {}
    if (path.endsWith('/signup'))
      body = { user: { ...user, email_confirmed_at: undefined }, session: null }
    else if (path.endsWith('/token') || path.endsWith('/verify')) body = session()
    else if (path.endsWith('/user')) body = user
    else if (path.endsWith('/nobi_member_access')) body = ['beautify', 'compose', 'share']
    else if (path.endsWith('/nobi-delete-account')) body = { message: 'Account deleted' }
    else if (!['/auth/v1/logout', '/auth/v1/recover', '/auth/v1/resend'].includes(path))
      throw new Error(`Unexpected account request ${path}`)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(body),
    })
  })
  return { calls, forbidden }
}
async function login(page: Page) {
  await page.goto('/#/account')
  await page.getByRole('textbox', { name: '邮箱', exact: true }).fill(email)
  await page.getByLabel('密码', { exact: true }).fill(password)
  await page.getByRole('button', { name: '登录', exact: true }).last().click()
  await expect(page.getByText('已登录，注册用户创作权益已启用')).toBeVisible()
}
test('an authenticated response alone cannot grant rights when the server denies membership', async ({
  page,
}) => {
  await authFixture(page)
  await page.route('https://nobi-auth.invalid/rest/v1/rpc/nobi_member_access', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'denied' }),
    }),
  )
  await page.goto('/#/account')
  await page.getByLabel('邮箱', { exact: true }).fill(email)
  await page.getByLabel('密码', { exact: true }).fill(password)
  await page.getByRole('button', { name: '登录', exact: true }).last().click()
  await expect(page.getByRole('alert')).toContainText('账号权益暂不可用')
  await page.goto('/#/studio')
  await expect(page.getByRole('heading', { name: '注册用户专属创作' })).toBeVisible()
  await expect(page.getByRole('button', { name: '生成成品预览' })).toHaveCount(0)
})
test('registration, email OTP, recovery and account deletion require explicit steps', async ({
  page,
}) => {
  const fixture = await authFixture(page)
  await page.goto('/#/account')
  expect(fixture.calls).toHaveLength(0)
  await page.getByRole('button', { name: '注册', exact: true }).click()
  await page.getByRole('textbox', { name: '邮箱', exact: true }).fill(email)
  await page.getByLabel('密码', { exact: true }).fill(password)
  await page.getByLabel('确认密码', { exact: true }).fill(password)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: '注册并发送验证邮件' }).click()
  await page.getByLabel('邮件验证码').fill('123456')
  await page.getByRole('button', { name: '验证邮箱', exact: true }).click()
  await expect(page.getByText('邮箱验证完成，请登录')).toBeVisible()
  await page.getByRole('button', { name: '忘记密码' }).click()
  await page.getByRole('button', { name: '发送重置邮件' }).click()
  await page.getByLabel('邮件验证码').fill('654321')
  await page.getByRole('button', { name: '验证重置码' }).click()
  await page.getByLabel('密码', { exact: true }).fill(password)
  await page.getByLabel('确认密码', { exact: true }).fill(password)
  await page.getByRole('button', { name: '保存新密码' }).click()
  await expect(page.getByText('密码已更新，请重新登录')).toBeVisible()
  await page.getByLabel('密码', { exact: true }).fill(password)
  await page.getByRole('button', { name: '登录', exact: true }).last().click()
  await expect(page.getByText('已登录，注册用户创作权益已启用')).toBeVisible()
  await page.getByRole('button', { name: '注销云端账号' }).click()
  await page.getByLabel('当前密码').fill(password)
  await page.getByLabel('输入“注销账号”确认').fill('注销账号')
  await page.getByRole('button', { name: '确认注销账号', exact: true }).click()
  await expect(page.getByText('云端账号已注销；本机照片与整理记录保持不变')).toBeVisible()
  const stored = await page.evaluate(() =>
    JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
  )
  expect(stored).not.toContain('synthetic-refresh-token')
  expect(stored).not.toContain(email)
  expect(fixture.calls.some((c) => c.path.endsWith('/nobi-delete-account'))).toBe(true)
  expect(fixture.forbidden).toEqual([])
})
test('verified account creates local JPEG, composes album and shares only after confirmation', async ({
  page,
}, info) => {
  const fixture = await authFixture(page)
  await page.addInitScript(() => {
    const target = globalThis as typeof globalThis & {
      __share?: { size: number; type: string; text: string; header: number[] }
    }
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        const file = data.files![0]!
        target.__share = {
          size: file.size,
          type: file.type,
          text: data.text ?? '',
          header: [...new Uint8Array(await file.arrayBuffer()).slice(0, 2)],
        }
      },
    })
  })
  await login(page)
  await page.getByRole('link', { name: '进入图片创作室' }).click()
  await page.getByRole('button', { name: '选择创作照片山野之间', exact: true }).click()
  await page.getByRole('button', { name: '暖色', exact: true }).click()
  await page.getByLabel('照片裁切').selectOption('square')
  await page.getByRole('button', { name: '生成成品预览' }).click()
  await expect(page.getByAltText('本地生成的成品预览')).toBeVisible()
  const detail = await page
    .getByAltText('本地生成的成品预览')
    .evaluate((image: HTMLImageElement) => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 200
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0, 200, 200)
      const data = context.getImageData(0, 0, 200, 200).data
      let dark = 0
      for (let i = 0; i < data.length; i += 4)
        if (data[i]! + data[i + 1]! + data[i + 2]! < 450) dark++
      return dark / (200 * 200)
    })
  expect(detail).toBeGreaterThan(0.05)
  await expect(page.getByRole('button', { name: '选择应用分享' })).toBeDisabled()
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载成品' }).click()
  expect((await downloadEvent).suggestedFilename()).toMatch(/^nobi-.*\.jpg$/)
  await page.getByRole('checkbox', { name: '我已检查成品', exact: false }).check()
  await page.getByRole('button', { name: '选择应用分享' }).click()
  await expect(page.getByText('已调用系统分享；是否发布由你在目标应用确认')).toBeVisible()
  const shared = await page.evaluate(
    () =>
      (
        globalThis as typeof globalThis & {
          __share: { size: number; type: string; header: number[] }
        }
      ).__share,
  )
  expect(shared.size).toBeGreaterThan(1000)
  expect(shared.type).toBe('image/jpeg')
  expect(shared.header).toEqual([255, 216])
  await page.getByRole('button', { name: '社交拼图 · 最多九张' }).click()
  await page.getByRole('button', { name: '选择创作照片海风来信', exact: true }).click()
  await page.getByRole('button', { name: '生成成品预览' }).click()
  await expect(page.getByAltText('本地生成的成品预览')).toBeVisible()
  expect(
    await page
      .getByAltText('本地生成的成品预览')
      .evaluate((image: HTMLImageElement) => [image.naturalWidth, image.naturalHeight]),
  ).toEqual([2160, 2160])
  await page.getByLabel('新相册名称').fill('创作小集')
  await page.getByRole('button', { name: '保存所选照片到本地相册' }).click()
  await expect(page.getByRole('link', { name: '打开新相册' })).toBeVisible()
  await expect(page.getByAltText('本地生成的成品预览')).toBeVisible()
  await page.getByRole('heading', { name: '图片创作室', exact: true }).click()
  await page
    .getByAltText('本地生成的成品预览')
    .screenshot({ path: `test-results/${info.project.name}-phase10-composition.png` })
  await page.screenshot({
    path: `test-results/${info.project.name}-phase10-studio.png`,
    fullPage: true,
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(fixture.calls.every((c) => !/demo-|山野|创作小集|一些想/.test(c.body ?? ''))).toBe(true)
  await page.goto('/#/account')
  await page.getByRole('button', { name: '退出登录' }).click()
  await page.goto('/#/studio')
  await expect(page.getByRole('heading', { name: '注册用户专属创作' })).toBeVisible()
  expect(fixture.forbidden).toEqual([])
})
