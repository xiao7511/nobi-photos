export interface AccountConfig {
  url: string
  key: string
}
export function accountConfig(url = '', key = ''): AccountConfig | null {
  if (!url && !key) return null
  let endpoint: URL
  try {
    endpoint = new URL(url)
  } catch {
    throw new Error('账号服务需要有效的 HTTPS 项目地址')
  }
  if (
    endpoint.protocol !== 'https:' ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    !['', '/'].includes(endpoint.pathname)
  )
    throw new Error('账号服务必须是独立的 HTTPS origin')
  let publicKey = /^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key)
  if (key.startsWith('eyJ')) {
    try {
      const encoded = key.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')
      publicKey = JSON.parse(atob(encoded)).role === 'anon'
    } catch {
      publicKey = false
    }
  }
  if (!publicKey) throw new Error('只允许 Supabase publishable/anon 公钥，禁止管理员密钥')
  return { url: endpoint.origin, key }
}

export const memberFeatures = ['beautify', 'compose', 'share'] as const
export type MemberFeature = (typeof memberFeatures)[number]
export function validCredentials(email: string, password: string, registering = false) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254)
    throw new Error('请输入有效邮箱')
  if (!password || password.length > 128 || (registering && password.length < 10))
    throw new Error(registering ? '密码长度须为 10–128 个字符' : '请输入密码')
}
