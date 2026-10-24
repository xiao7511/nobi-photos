import { beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { accountService } from '../services/accountService'
import { useAccount } from './account'
vi.mock('../services/accountService', () => ({
  configuredAccount: { url: 'https://nobi-auth.invalid', key: 'test' },
  accountService: { login: vi.fn(), logout: vi.fn().mockResolvedValue(undefined) },
}))
beforeEach(() => {
  setActivePinia(createPinia())
})
it('never grants rights to guests, expired sessions or password recovery sessions', () => {
  const account = useAccount()
  expect(() => account.require('share')).toThrow()
  account.member = {
    id: 'test',
    email: 'test@example.invalid',
    expires: Date.now() + 60000,
    features: ['share'],
  }
  expect(account.can('share')).toBe(true)
  expect(account.can('beautify')).toBe(false)
  account.recovery = true
  expect(account.can('share')).toBe(false)
  account.recovery = false
  account.member.expires = Date.now() - 1
  expect(account.can('share')).toBe(false)
})
it('clears rights immediately when logging out, including when the service is unavailable', async () => {
  const account = useAccount()
  account.member = {
    id: 'test',
    email: 'test@example.invalid',
    expires: Date.now() + 60000,
    features: ['share'],
  }
  const pending = account.logout()
  expect(account.member).toBeNull()
  expect(account.can('share')).toBe(false)
  await pending
})
it('clears a prior member before a failed reauthentication and never persists tokens', async () => {
  const storage = vi.spyOn(Storage.prototype, 'setItem')
  const account = useAccount()
  account.member = {
    id: 'test',
    email: 'test@example.invalid',
    expires: Date.now() + 60000,
    features: ['share'],
  }
  vi.mocked(accountService.login).mockRejectedValueOnce(new Error('invalid'))
  expect(await account.run(() => account.login('test@example.invalid', 'bad'))).toBe(false)
  expect(account.member).toBeNull()
  expect(storage).not.toHaveBeenCalled()
})
