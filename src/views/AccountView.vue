<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useAccount } from '../stores/account'
import { accountService } from '../services/accountService'
import { validCredentials } from '../domain/accountConfig'
const account = useAccount()
const mode = ref<'login' | 'register' | 'verify' | 'recover' | 'code' | 'password'>('login')
const email = ref(''),
  password = ref(''),
  repeat = ref(''),
  token = ref(''),
  consent = ref(false)
const deleteConfirmation = ref(''),
  deletePassword = ref(''),
  deleteOpen = ref(false)
const resendAt = ref(0),
  clock = ref(Date.now())
const timer = setInterval(() => {
  clock.value = Date.now()
  account.tick()
}, 1000)
function change(next: typeof mode.value) {
  mode.value = next
  password.value = ''
  repeat.value = ''
  token.value = ''
  account.error = ''
  account.notice = ''
}
async function submit() {
  const current = mode.value
  const secret = password.value,
    code = token.value
  const success = await account.run(async () => {
    const address = email.value.trim()
    if (current !== 'password') validCredentials(address, 'validation-only', false)
    if (current === 'login') {
      validCredentials(address, secret)
      await account.login(address, secret)
      account.notice = '已登录，注册用户创作权益已启用'
    } else if (current === 'register') {
      validCredentials(address, secret, true)
      if (secret !== repeat.value) throw new Error('两次密码不一致')
      if (!consent.value) throw new Error('请先阅读并同意账号数据说明')
      await accountService.register(address, secret)
      mode.value = 'verify'
      resendAt.value = Date.now() + 60000
      account.notice = '如邮箱可注册，验证邮件将发送到该邮箱；请输入邮件中的验证码'
    } else if (current === 'recover') {
      await account.logout()
      await accountService.recover(address)
      mode.value = 'code'
      resendAt.value = Date.now() + 60000
      account.notice = '如账号存在，重置邮件将发送到该邮箱'
    } else if (current === 'verify' || current === 'code') {
      if (!/^\d{6,10}$/.test(code)) throw new Error('请输入邮件中的数字验证码')
      await accountService.verify(address, code, current === 'code')
      account.recovery = current === 'code'
      mode.value = current === 'code' ? 'password' : 'login'
      account.notice = current === 'code' ? '验证完成，请设置新密码' : '邮箱验证完成，请登录'
    } else {
      if (!account.recovery) throw new Error('请先验证重置邮件')
      validCredentials('reset@example.invalid', secret, true)
      if (secret !== repeat.value) throw new Error('两次密码不一致')
      await accountService.changePassword(secret)
      account.recovery = false
      mode.value = 'login'
      account.notice = '密码已更新，请重新登录'
    }
  })
  password.value = ''
  repeat.value = ''
  token.value = ''
  if (!success && current === 'password') account.notice = '可重新输入密码，或重新获取重置邮件'
}
async function resend() {
  if (Date.now() < resendAt.value) return
  resendAt.value = Date.now() + 60000
  await account.run(async () => {
    validCredentials(email.value.trim(), 'validation-only')
    if (mode.value === 'code') await accountService.recover(email.value.trim())
    else await accountService.resend(email.value.trim())
    account.notice = '如账号符合条件，邮件将发送；请检查收件箱和垃圾邮件'
  })
}
async function removeAccount() {
  const secret = deletePassword.value
  deletePassword.value = ''
  await account.run(async () => {
    if (deleteConfirmation.value !== '注销账号' || !account.member)
      throw new Error('请输入“注销账号”确认')
    validCredentials(account.member.email, secret)
    await accountService.deleteAccount(secret, account.member.email)
    await account.logout()
    deleteOpen.value = false
    deleteConfirmation.value = ''
    account.notice = '云端账号已注销；本机照片与整理记录保持不变'
  })
}
onUnmounted(() => {
  clearInterval(timer)
  password.value = ''
  repeat.value = ''
  token.value = ''
  deletePassword.value = ''
  if (account.recovery) void account.logout()
})
</script>
<template>
  <div class="member-page">
    <RouterLink to="/profile" class="back-link">← 返回我的空间</RouterLink>
    <section class="page-heading">
      <div>
        <span class="eyebrow">YOUR CREATIVE MEMBERSHIP</span>
        <h1>账号与创作权益</h1>
        <p>自愿注册，照片始终由你掌握。</p>
      </div>
    </section>
    <section class="member-card">
      <h2>{{ account.signedIn ? '注册用户' : '邮箱账号' }}</h2>
      <p v-if="!account.available" role="status" class="notice-box">
        账号服务尚未配置。注册和登录暂不可用；本地看图、AI 整理、标签和收藏继续可用。
      </p>
      <template v-if="account.signedIn">
        <p class="account-email">{{ account.member?.email }}</p>
        <p>已验证邮箱 · 当前会话登录</p>
        <RouterLink to="/studio" class="primary-button">进入图片创作室</RouterLink>
        <button
          class="secondary-button"
          :disabled="account.busy"
          @click="account.run(() => account.logout())"
        >
          退出登录
        </button>
        <button class="text-link" :disabled="account.busy" @click="deleteOpen = !deleteOpen">
          注销云端账号
        </button>
        <form v-if="deleteOpen" class="member-form" @submit.prevent="removeAccount">
          <p>删除邮箱账号及其云端权益，不删除本机照片、相册或标签。此操作无法撤销。</p>
          <label
            >当前密码<input
              v-model="deletePassword"
              type="password"
              autocomplete="current-password"
              maxlength="128"
              required
          /></label>
          <label
            >输入“注销账号”确认<input v-model="deleteConfirmation" autocomplete="off" required
          /></label>
          <button
            class="danger-button"
            :disabled="account.busy || deleteConfirmation !== '注销账号'"
          >
            确认注销账号
          </button>
        </form>
      </template>
      <template v-else>
        <div class="member-tabs">
          <button
            type="button"
            :aria-pressed="mode === 'login'"
            :disabled="account.busy"
            @click="change('login')"
          >
            登录</button
          ><button
            type="button"
            :aria-pressed="mode === 'register'"
            :disabled="account.busy"
            @click="change('register')"
          >
            注册
          </button>
        </div>
        <form class="member-form" @submit.prevent="submit">
          <fieldset :disabled="!account.available || account.busy">
            <label v-if="mode !== 'password'"
              >邮箱<input
                v-model="email"
                type="email"
                autocomplete="email"
                maxlength="254"
                required
            /></label>
            <label v-if="['login', 'register', 'password'].includes(mode)"
              >密码<input
                v-model="password"
                type="password"
                :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
                :minlength="mode === 'login' ? 1 : 10"
                maxlength="128"
                required
            /></label>
            <label v-if="mode === 'register' || mode === 'password'"
              >确认密码<input
                v-model="repeat"
                type="password"
                autocomplete="new-password"
                minlength="10"
                maxlength="128"
                required
            /></label>
            <label v-if="mode === 'verify' || mode === 'code'"
              >邮件验证码<input
                v-model="token"
                inputmode="numeric"
                autocomplete="one-time-code"
                pattern="[0-9]{6,10}"
                maxlength="10"
                required
            /></label>
            <label v-if="mode === 'register'" class="consent-label"
              ><input v-model="consent" type="checkbox" required /><span
                >我已阅读下方账号数据说明及
                <RouterLink to="/privacy">隐私中心</RouterLink
                >，同意将邮箱和认证请求交给本应用账号服务处理。</span
              ></label
            >
            <button class="primary-button" :disabled="account.busy">
              {{
                account.busy
                  ? '正在处理…'
                  : {
                      login: '登录',
                      register: '注册并发送验证邮件',
                      verify: '验证邮箱',
                      recover: '发送重置邮件',
                      code: '验证重置码',
                      password: '保存新密码',
                    }[mode]
              }}
            </button>
            <button
              v-if="mode === 'verify' || mode === 'code'"
              type="button"
              class="secondary-button"
              :disabled="clock < resendAt"
              @click="resend"
            >
              {{
                clock < resendAt
                  ? `${Math.ceil((resendAt - clock) / 1000)} 秒后重发`
                  : '重新发送验证码'
              }}
            </button>
          </fieldset>
        </form>
        <div class="member-actions">
          <button class="text-link" :disabled="account.busy" @click="change('recover')">
            忘记密码</button
          ><button class="text-link" :disabled="account.busy" @click="change('verify')">
            已有验证码
          </button>
        </div>
      </template>
      <p v-if="account.error" role="alert" class="error-box">{{ account.error }}</p>
      <p v-if="account.notice" role="status" class="notice-box">{{ account.notice }}</p>
    </section>
    <section class="member-card">
      <h2>免费注册权益</h2>
      <ul>
        <li>本地调色美化：明亮、暖色、清透、黑白与裁切。</li>
        <li>单图或最多九张照片拼图，生成适合社交分享的图片。</li>
        <li>本地文案草稿与系统分享，由你选择媒体和确认发布。</li>
      </ul>
      <p>游客保留全部基础看图、AI 整理、相册、标签和收藏功能；目前不收取会员费用。</p>
    </section>
    <section class="member-card">
      <h2>账号数据说明</h2>
      <p>
        账号服务处理邮箱、加密认证所需凭据及会话信息，服务方可能记录 IP
        与访问日志；不会接收照片、照片名称、相册、标签或搜索内容。登录令牌仅保存在内存，关闭应用后需重新登录。没有照片云备份或自动发布。
      </p>
      <p>
        美化和拼图只生成副本，不覆盖原图。主动分享会把你确认的成品交给选定的其他应用，之后由该应用处理。注销账号不清除本机记录。
      </p>
    </section>
  </div>
</template>
