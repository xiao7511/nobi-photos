import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js'
import { accountConfig, memberFeatures, type MemberFeature } from '../domain/accountConfig'

export const configuredAccount = accountConfig(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)
export interface Member {
  id: string
  email: string
  expires: number
  features: MemberFeature[]
}
let client: SupabaseClient | undefined
function api() {
  if (!configuredAccount) throw new Error('账号服务尚未配置，基础相册仍可正常使用')
  if (!client) {
    const origin = configuredAccount.url
    client = createClient(origin, configuredAccount.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: async (input, init) => {
          const target = new URL(
            typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
          )
          const tokenQuery =
            target.pathname === '/auth/v1/token' &&
            ['?grant_type=password', '?grant_type=refresh_token'].includes(target.search)
          const logoutQuery =
            target.pathname === '/auth/v1/logout' && target.search === '?scope=local'
          if (
            target.origin !== origin ||
            (target.search && !tokenQuery && !logoutQuery) ||
            !(
              target.pathname.startsWith('/auth/v1/') ||
              target.pathname === '/rest/v1/rpc/nobi_member_access' ||
              target.pathname === '/functions/v1/nobi-delete-account'
            )
          )
            throw new Error('账号请求超出允许范围')
          // WebView 101 has AbortController but not AbortSignal.timeout.
          const abort = new AbortController()
          const cancel = () => abort.abort()
          const timeout = setTimeout(cancel, 20000)
          if (init?.signal?.aborted) cancel()
          init?.signal?.addEventListener('abort', cancel, { once: true })
          try {
            return await fetch(input, {
              ...init,
              credentials: 'omit',
              referrerPolicy: 'no-referrer',
              redirect: 'error',
              signal: abort.signal,
            })
          } finally {
            clearTimeout(timeout)
            init?.signal?.removeEventListener('abort', cancel)
          }
        },
      },
    })
  }
  return client
}
export async function verifiedMember(session: Session | null): Promise<Member | null> {
  if (!session) return null
  const { data, error } = await api().auth.getUser()
  if (error || !data.user?.email_confirmed_at || !data.user.email)
    throw new Error('请先验证邮箱并重新登录')
  const result = await api().rpc('nobi_member_access')
  if (
    result.error ||
    !Array.isArray(result.data) ||
    !result.data.every(
      (v: unknown) => typeof v === 'string' && memberFeatures.includes(v as MemberFeature),
    )
  )
    throw new Error('账号权益暂不可用，请稍后重新登录')
  return {
    id: data.user.id,
    email: data.user.email,
    expires: (session.expires_at ?? 0) * 1000,
    features: result.data,
  }
}
export const accountService = {
  async register(email: string, password: string) {
    const { error } = await api().auth.signUp({ email, password })
    if (error) throw new Error('注册未完成，请检查密码要求或稍后重试')
    // Never grant rights from a signup response; email confirmation and login are separate.
    await this.logout()
  },
  async login(email: string, password: string) {
    const { data, error } = await api().auth.signInWithPassword({ email, password })
    if (error) throw new Error('登录未完成，请检查邮箱、密码及邮箱验证状态')
    try {
      return await verifiedMember(data.session)
    } catch (error) {
      await this.logout()
      throw error
    }
  },
  async verify(email: string, token: string, recovery: boolean) {
    const { error } = await api().auth.verifyOtp({
      email,
      token,
      type: recovery ? 'recovery' : 'email',
    })
    if (error) throw new Error('验证码无效或已过期，请重新获取')
    if (!recovery) await this.logout()
  },
  async resend(email: string) {
    const { error } = await api().auth.resend({ email, type: 'signup' })
    if (error) throw new Error('验证码暂未发出，请稍后再试')
  },
  async recover(email: string) {
    const { error } = await api().auth.resetPasswordForEmail(email)
    if (error) throw new Error('重置邮件暂未发出，请稍后重试')
  },
  async changePassword(password: string) {
    const { error } = await api().auth.updateUser({ password })
    if (error) throw new Error('密码未更新，请重新验证邮箱后重试')
    await this.logout()
  },
  async deleteAccount(password: string, email: string) {
    await this.login(email, password)
    const { error } = await api().functions.invoke('nobi-delete-account', { body: {} })
    if (error) throw new Error('账号未注销，请稍后重试或联系服务管理员')
    await this.logout()
  },
  async logout() {
    const old = client
    client = undefined
    await old?.auth.signOut({ scope: 'local' }).catch(() => {})
  },
}
