<script setup lang="ts">
import { ref } from 'vue'
import {
  ShieldCheck,
  ArrowLeft,
  LockKeyhole,
  CloudOff,
  UserRound,
  Trash2,
  RefreshCw,
  X,
} from '@lucide/vue'
import { useLibrary } from '../stores/library'
const library = useLibrary()
const confirmDialog = ref<HTMLDialogElement>()
const action = ref<'clear' | 'restore'>('clear')
let opener: HTMLElement | null = null
function ask(value: 'clear' | 'restore', event: MouseEvent) {
  action.value = value
  opener = event.currentTarget as HTMLElement
  confirmDialog.value?.showModal()
}
function close() {
  confirmDialog.value?.close()
  opener?.focus()
}
async function confirm() {
  await library.reset(action.value === 'clear')
  close()
}
const policies = [
  {
    icon: CloudOff,
    title: '照片不上传',
    body: '未集成照片上传、云同步、云端 AI 或第三方统计 SDK。',
    state: '已禁用',
  },
  {
    icon: LockKeyhole,
    title: '系统相册未授权',
    body: 'Phase 1 不请求照片、相机或文件权限，也不进行后台扫描。',
    state: '未请求',
  },
  {
    icon: Trash2,
    title: '原始照片不删除',
    body: '清理页面仅展示建议；原图删除服务被明确禁用。',
    state: '已禁用',
  },
  {
    icon: UserRound,
    title: '无需注册',
    body: '没有账号系统，离线也可浏览已缓存的界面与示例。',
    state: '本地模式',
  },
]
</script>
<template>
  <RouterLink to="/profile" class="back-link"><ArrowLeft :size="17" /> 返回我的空间</RouterLink>
  <section class="page-heading">
    <div>
      <span class="eyebrow">PRIVATE BY DESIGN</span>
      <h1>安心，是最好的底色<span class="title-dot">.</span></h1>
      <p>关于你的照片，每一条边界都清清楚楚。</p>
    </div>
    <ShieldCheck class="privacy-heading-icon" :size="48" :stroke-width="1.2" />
  </section>
  <div class="privacy-intro">
    <ShieldCheck :size="26" />
    <div>
      <h2>你的照片，只属于你</h2>
      <p>目前使用随应用打包的示例插画。未读取任何真实照片，未连接任何生产数据库。</p>
    </div>
  </div>
  <div class="policy-list">
    <article v-for="policy in policies" :key="policy.title">
      <component :is="policy.icon" :size="23" />
      <div>
        <h3>{{ policy.title }}</h3>
        <p>{{ policy.body }}</p>
      </div>
      <span class="pill">{{ policy.state }}</span>
    </article>
  </div>
  <section class="settings-card">
    <h2>本地数据与安全说明</h2>
    <p class="body-text">
      当前仅在浏览器 localStorage
      保存示例照片的收藏记录与外观偏好；离线缓存保存应用代码和示例插画。元数据未加密，不构成私密保险箱。共用设备时请使用系统锁屏。
    </p>
    <p class="body-text">
      清除示例记录不会移除外观偏好或应用缓存。若要彻底移除此站点的数据，请在浏览器的站点设置中清除存储与离线缓存。SQLite
      结构已准备好，原生数据库驱动将在后续阶段接入。
    </p>
    <div class="data-actions">
      <button class="button" :disabled="library.busy" @click="ask('restore', $event)">
        <RefreshCw :size="16" /> 恢复示例相册</button
      ><button class="button danger" :disabled="library.busy" @click="ask('clear', $event)">
        <Trash2 :size="16" /> 清除本地示例记录
      </button>
    </div>
  </section>
  <dialog
    ref="confirmDialog"
    class="confirm-dialog"
    aria-labelledby="confirm-title"
    @cancel.prevent="close"
  >
    <button class="dialog-close icon-button" aria-label="关闭确认" @click="close">
      <X :size="20" /></button
    ><ShieldCheck :size="32" />
    <h2 id="confirm-title">{{ action === 'clear' ? '清除本地示例记录？' : '恢复示例相册？' }}</h2>
    <p>
      {{
        action === 'clear'
          ? '将清除示例收藏并隐藏示例相册。不会访问或删除设备照片，可随时恢复示例。'
          : '将重置示例收藏，恢复 12 张示例插画。不会读取设备照片。'
      }}
    </p>
    <div class="data-actions">
      <button class="button" :disabled="library.busy" @click="close">取消</button
      ><button class="button primary" :disabled="library.busy" @click="confirm">
        {{ library.busy ? '处理中…' : '确认操作' }}
      </button>
    </div>
  </dialog>
</template>
