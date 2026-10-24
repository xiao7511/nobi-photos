<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { X, Check, Music2, FolderOpen, Sparkles } from '@lucide/vue'
import { musicCatalog } from '../domain/albumMusic'
import { useMusicSelection } from '../stores/music'
const music = useMusicSelection()
const dialog = ref<HTMLDialogElement>(),
  input = ref<HTMLInputElement>()
let opener: HTMLElement | null = null
watch(
  () => music.open,
  async (open) => {
    if (open) {
      opener = document.activeElement as HTMLElement
      await nextTick()
      if (music.open) dialog.value?.showModal()
    } else {
      dialog.value?.close()
      if (opener?.isConnected) opener.focus()
    }
  },
)
function pickLocal() {
  music.error = ''
  // Close the photo viewer synchronously before opening a native activity. The picker
  // lives at the app root so its file input survives album refresh/background cleanup.
  music.localRequest++
  input.value?.click()
}
function chosen(event: Event) {
  const element = event.target as HTMLInputElement,
    file = element.files?.[0]
  if (file) music.selectFile(file)
  element.value = '' // Allow selecting the same file again after a failure.
}
onUnmounted(() => {
  dialog.value?.close()
  music.reset()
})
</script>
<template>
  <dialog
    ref="dialog"
    class="music-picker"
    aria-labelledby="music-picker-title"
    @cancel.self.prevent="music.open = false"
    @close="music.open = false"
  >
    <header class="music-picker-heading">
      <div>
        <span class="eyebrow">SOUNDTRACK</span>
        <h2 id="music-picker-title">选择背景音乐</h2>
      </div>
      <button class="icon-button" aria-label="关闭音乐选择" autofocus @click="music.open = false">
        <X :size="22" />
      </button>
    </header>
    <p class="body-text">选曲仅在本次使用中保留，默认不播放。回到照片后点击配乐按钮开启。</p>
    <button
      class="music-choice"
      :aria-pressed="music.choice === 'auto'"
      @click="music.select('auto')"
    >
      <Sparkles :size="22" /><span
        ><strong>按相册分类推荐</strong><small>随相册主题匹配在线录音</small></span
      ><Check v-if="music.choice === 'auto'" :size="20" />
    </button>
    <h3>在线曲目列表</h3>
    <button
      v-for="track in musicCatalog"
      :key="track.id"
      class="music-choice"
      :aria-pressed="music.choice === track.id"
      :aria-label="`选用 ${track.title}`"
      @click="music.select(track.id)"
    >
      <Music2 :size="22" /><span
        ><strong>{{ track.title }}</strong
        ><small>{{ track.artist }} · CC BY 4.0</small></span
      ><Check v-if="music.choice === track.id" :size="20" />
    </button>
    <h3>本机音频</h3>
    <button class="music-choice" @click="pickLocal">
      <FolderOpen :size="22" /><span
        ><strong>从手机选择音乐文件</strong
        ><small>通过系统文件选择器授权，单曲不超过 100MB</small></span
      >
    </button>
    <div v-if="music.local" class="music-local-selection">
      <p>已选择：{{ music.local.title }}</p>
      <div class="data-actions">
        <button
          class="button"
          :aria-pressed="music.choice === 'local'"
          @click="music.choice = 'local'"
        >
          使用这首本机音乐</button
        ><button class="button" @click="music.clearLocal">移除本机音乐</button>
      </div>
    </div>
    <p v-if="music.error" class="banner error" role="alert">{{ music.error }}</p>
    <p class="body-text music-picker-note">
      本机文件仅在设备内播放，不上传、不复制到相册数据库。MP3、M4A、AAC、WAV
      优先；其他格式取决于设备解码能力。音乐播放器需提供可访问的音频文件；仅在线或受保护的曲目不能直接接入。
    </p>
    <p class="body-text">
      在线曲目播放时使用网络，来源与授权可在照片播放器中查看；选曲不会启动下载。
    </p>
    <button class="button primary music-picker-done" @click="music.open = false">完成选择</button>
    <!-- Keep the file input outside dialog's DOM ancestry: trusted Android input
         cancel events can invoke the ancestor dialog's native default close action. -->
    <Teleport to="body">
      <input
        ref="input"
        class="music-file-input"
        tabindex="-1"
        aria-hidden="true"
        type="file"
        accept="audio/*"
        aria-label="选择本机音频文件"
        @change="chosen"
      />
    </Teleport>
  </dialog>
</template>
