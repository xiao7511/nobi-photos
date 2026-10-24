import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { accountService, configuredAccount, type Member } from '../services/accountService'
import type { MemberFeature } from '../domain/accountConfig'
export const useAccount = defineStore('account', () => {
  const member = ref<Member | null>(null)
  const clock = ref(Date.now())
  const recovery = ref(false)
  const busy = ref(false)
  const error = ref('')
  const notice = ref('')
  const available = !!configuredAccount
  const signedIn = computed(() => !!member.value && member.value.expires > clock.value)
  function can(feature: MemberFeature) {
    clock.value = Date.now()
    return signedIn.value && !recovery.value && !!member.value?.features.includes(feature)
  }
  function require(feature: MemberFeature) {
    if (!can(feature)) throw new Error('请登录已验证邮箱的注册账号后使用此功能')
  }
  async function run(action: () => Promise<void>) {
    if (busy.value) return false
    busy.value = true
    error.value = ''
    notice.value = ''
    try {
      await action()
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : '操作未完成，请稍后重试'
      return false
    } finally {
      busy.value = false
    }
  }
  async function logout() {
    member.value = null
    recovery.value = false
    await accountService.logout()
  }
  function tick() {
    clock.value = Date.now()
    if (member.value && !signedIn.value) {
      member.value = null
      void accountService.logout()
    }
  }
  return {
    member,
    recovery,
    busy,
    error,
    notice,
    available,
    signedIn,
    can,
    require,
    run,
    logout,
    tick,
    async login(email: string, password: string) {
      member.value = null
      recovery.value = false
      member.value = await accountService.login(email, password)
      tick()
    },
  }
})
