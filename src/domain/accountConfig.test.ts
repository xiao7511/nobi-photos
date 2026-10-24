import { describe, expect, it } from 'vitest'
import { accountConfig, validCredentials } from './accountConfig'
describe('account configuration and credentials', () => {
  const key = 'sb_publishable_nobi_photos_test_only'
  it('keeps guest builds unconfigured and rejects partial configuration', () => {
    expect(accountConfig()).toBeNull()
    expect(() => accountConfig('https://account.example')).toThrow()
    expect(() => accountConfig('', key)).toThrow()
  })
  it('pins one HTTPS origin without paths, credentials or query strings', () => {
    expect(accountConfig('https://account.example/', key)?.url).toBe('https://account.example')
    for (const url of [
      'http://account.example',
      'https://a:b@account.example',
      'https://account.example/a',
      'https://account.example/?a=b',
      'https://account.example/#x',
    ])
      expect(() => accountConfig(url, key)).toThrow()
  })
  it('refuses server secrets and service_role JWTs in the client', () => {
    const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role }))}.signature`
    expect(() => accountConfig('https://account.example', 'sb_secret_private')).toThrow()
    expect(() => accountConfig('https://account.example', jwt('service_role'))).toThrow()
    expect(accountConfig('https://account.example', jwt('anon'))?.key).toContain('eyJ')
  })
  it('validates email and stronger signup passwords without blocking existing passwords', () => {
    expect(() => validCredentials('a@example.com', 'short')).not.toThrow()
    expect(() => validCredentials('a@example.com', 'short', true)).toThrow()
    expect(() => validCredentials('invalid', 'long-enough-password', true)).toThrow()
    expect(() => validCredentials('a@example.com', 'a'.repeat(129), true)).toThrow()
  })
})
