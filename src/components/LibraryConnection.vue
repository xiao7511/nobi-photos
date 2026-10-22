<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { ShieldCheck, ScanLine, X, Square, Settings, Images } from '@lucide/vue'
import { useDeviceLibrary } from '../stores/deviceLibrary'
import { useLibrary } from '../stores/library'
import { hasAccess } from '../native/contracts'
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
const device = useDeviceLibrary()
const library = useLibrary()
const consent = ref<HTMLDialogElement>()
const operationError = ref('')
const permitted = computed(() => hasAccess(device.access))
const statusLabel = computed(
  () =>
    ({
      unavailable: '浏览器示例模式',
      prompt: '尚未授权',
      denied: '照片权限未开启',
      limited: '仅访问已选照片',
      granted: '已授权照片读取',
    })[device.access],
)
async function connect() {
  consent.value?.close()
  await device.requestAccess()
  if (hasAccess(device.access)) await library.scanDevice()
  else await library.load()
}
async function autoChanged(event: Event) {
  const target = event.target as HTMLInputElement
  operationError.value = ''
  try {
    await device.setAutoScan(target.checked)
  } catch (e) {
    operationError.value = e instanceof Error ? e.message : '设置未保存'
    target.checked = device.autoScan
  }
}
async function settings() {
  try {
    await device.openSettings()
  } catch {
    operationError.value = '无法打开系统设置，请在系统设置中手动调整照片权限。'
  }
}
onUnmounted(() => consent.value?.close())
</script>
<template>
  <section class="connection-panel" aria-label="本机相册连接与扫描">
    <div class="connection-heading">
      <ShieldCheck :size="23" />
      <div>
        <h2>
          本机相册 <span class="pill">{{ statusLabel }}</span>
        </h2>
        <p>
          {{
            device.isNative
              ? '仅建立设备内索引。照片不上传，原图不修改，不请求位置或相机权限。'
              : '真实照片读取需要 Android / iOS 原生应用；浏览器继续展示本地示例。'
          }}
        </p>
      </div>
    </div>
    <template v-if="device.isNative">
      <div class="data-actions">
        <button
          v-if="!permitted"
          class="button primary"
          :disabled="library.loading || device.requesting || device.scanning"
          @click="consent?.showModal()"
        >
          <Images :size="16" />{{ device.requesting ? '等待系统授权…' : '连接并读取照片' }}
        </button>
        <button
          v-if="permitted"
          class="button"
          :disabled="library.loading || device.scanning || device.requesting"
          @click="library.scanDevice()"
        >
          <ScanLine :size="16" /> 立即扫描
        </button>
        <button
          v-if="device.access === 'denied' || device.access === 'limited'"
          class="button"
          @click="settings"
        >
          <Settings :size="16" /> 管理系统照片权限
        </button>
        <button
          v-if="device.scanning"
          class="button"
          :disabled="device.scan.status === 'cancelling'"
          @click="device.cancel()"
        >
          <Square :size="15" />{{ device.scan.status === 'cancelling' ? '正在取消…' : '取消扫描' }}
        </button>
      </div>
      <label v-if="!compact" class="autoscan-toggle"
        ><input
          type="checkbox"
          :checked="device.autoScan"
          :disabled="!permitted || device.scanning || device.requesting"
          @change="autoChanged"
        /><span
          >开启前台自动扫描<small
            >默认关闭；仅在应用打开或返回前台时检查。不在后台持续运行。</small
          ></span
        ></label
      >
      <div v-if="device.scanning" class="scan-progress" role="status">
        <progress :value="device.scan.processed" :max="Math.max(1, device.scan.total)"></progress
        ><span
          >{{ device.scan.processed }} / {{ device.scan.total }} 张 ·
          {{ device.scan.total ? '正在建立本地索引' : '正在读取相册目录…' }}</span
        >
      </div>
      <p v-else-if="device.scan.status === 'cancelled'" class="body-text" role="status">
        扫描已取消，上一次完整索引保持不变。
      </p>
      <p v-else-if="device.lastScanAt && !compact" class="body-text">
        上次完整扫描：{{ new Date(device.lastScanAt).toLocaleString('zh-CN') }}
      </p>
      <p v-if="device.error || operationError" class="banner error" role="alert">
        {{ device.error || operationError }}
      </p>
      <p v-if="!compact" class="fine-print">
        只索引照片。iCloud 中未在本地的缩略图可能不可用；不会为预览主动下载原图。
      </p>
    </template>
    <dialog ref="consent" class="confirm-dialog" aria-labelledby="library-consent-title">
      <button
        class="dialog-close icon-button"
        aria-label="关闭照片授权说明"
        @click="consent?.close()"
      >
        <X :size="20" /></button
      ><ShieldCheck :size="32" />
      <h2 id="library-consent-title">连接本机相册？</h2>
      <p>
        接下来由系统请求照片读取权限。可选择有限照片授权。授权后会读取照片标识、日期、尺寸和文件名，在本机建立
        SQLite 索引；缩略图仅在内存显示。不上传、不使用云端 AI、不删除原图。
      </p>
      <p class="body-text">
        自动扫描保持关闭，可稍后单独开启。索引未启用应用层加密，请保护好设备锁屏。
      </p>
      <div class="data-actions">
        <button class="button" @click="consent?.close()">暂不连接</button
        ><button class="button primary" @click="connect">继续系统授权</button>
      </div>
    </dialog>
  </section>
</template>
