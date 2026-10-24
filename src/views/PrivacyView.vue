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
import LibraryConnection from '../components/LibraryConnection.vue'
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
    title: '相册权限由你决定',
    body: '仅在原生端经系统授权读取照片，支持有限访问。不申请相机或位置权限；自动扫描默认关闭，仅在前台运行。',
    state: '按需授权',
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
  <RouterLink v-if="!library.isNative" to="/profile" class="back-link"
    ><ArrowLeft :size="17" /> 返回我的空间</RouterLink
  >
  <section v-if="!library.isNative" class="page-heading">
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
      <p>
        {{
          library.isNative
            ? '仅访问系统授权的本机照片，照片不上传。未连接任何生产数据库。'
            : '浏览器使用随应用打包的示例插画。未读取任何真实照片，未连接任何生产数据库。'
        }}
      </p>
    </div>
  </div>
  <LibraryConnection />
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
      分类配乐由应用内置原创乐谱在本机合成，默认关闭，不下载音乐、不申请麦克风权限。退出看图或切到后台时停止播放。
    </p>
    <p class="body-text">
      {{
        library.isNative
          ? '原生端在本地 SQLite 保存照片标识、日期、尺寸、标题、收藏、自建相册和手动标签；照片原图不写入数据库。缩略图仅在界面内存中使用。打开照片时按需读取本机原图，临时副本存于应用私有缓存，关闭、切换照片或进入后台时清理；异常退出残留会在下次启动清理。不会主动下载 iCloud 照片。'
          : '浏览器仅在 localStorage 保存示例收藏、自建相册、手动标签和外观偏好；离线缓存保存应用代码和示例插画。'
      }}元数据未启用应用层加密，不构成私密保险箱。共用设备时请使用系统锁屏。
    </p>
    <p class="body-text">
      {{
        library.isNative
          ? '清除本地索引会清除照片元数据、收藏、自建相册、手动标签和扫描记录，并关闭自动扫描；不会删除原图或撤销系统权限。可通过系统设置撤销权限。原生数据库配置为不参与应用备份。'
          : '清除或恢复示例会重置示例收藏、自建相册和手动标签，不会移除外观偏好或应用缓存。若要彻底移除此站点的数据，请在浏览器站点设置中清除存储与离线缓存。原生端使用独立 SQLite 索引。'
      }}
    </p>
    <p class="body-text">
      相似照片分析仅在点击后处理最多 500
      张本地缩略图，结果可能误判，需要人工核对。图像指纹与分析结果只在内存中保留，切换后台会清除，不上传、不用于训练，也不自动删除照片。
    </p>
    <p class="body-text">
      批量整理每次最多处理 500
      张照片，只修改本地收藏、手动标签和相册关系，不写入系统相册。搜索条件与所选照片不保存到历史记录。
    </p>
    <div class="data-actions">
      <button
        v-if="!library.isNative"
        class="button"
        :disabled="library.busy"
        @click="ask('restore', $event)"
      >
        <RefreshCw :size="16" /> 恢复示例相册</button
      ><button class="button danger" :disabled="library.busy" @click="ask('clear', $event)">
        <Trash2 :size="16" /> {{ library.isNative ? '清除本地照片索引' : '清除本地示例记录' }}
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
    <h2 id="confirm-title">
      {{
        library.isNative
          ? '清除本地照片索引？'
          : action === 'clear'
            ? '清除本地示例记录？'
            : '恢复示例相册？'
      }}
    </h2>
    <p>
      {{
        library.isNative
          ? '将清除本地索引、收藏、自建相册和手动标签，并关闭自动扫描。系统照片不会删除，系统授权不会撤销。请先取消正在进行的扫描。'
          : action === 'clear'
            ? '将清除示例收藏、自建相册和手动标签并隐藏示例相册。不会访问或删除设备照片，可随时恢复示例。'
            : '将重置示例收藏、自建相册和手动标签，恢复 12 张示例插画。不会读取设备照片。'
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
