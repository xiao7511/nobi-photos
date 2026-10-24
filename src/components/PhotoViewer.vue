<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  X,
  Heart,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Tags,
  Play,
  Pause,
  Music2,
  ListMusic,
  VolumeX,
  Expand,
  Shrink,
} from '@lucide/vue'
import { SystemBars } from '@capacitor/core'
import type { Photo } from '../domain/models'
import { useLibrary } from '../stores/library'
import { originalPhoto } from '../services/originalPhoto'
import TagEditor from './TagEditor.vue'
import { AlbumMusic } from '../services/albumMusic'
import { useMusicSelection } from '../stores/music'
import { albumMusicTheme, type MusicTheme } from '../domain/albumMusic'
const props = defineProps<{
  photos: Photo[]
  initialId: string
  autoplay?: boolean
  musicTheme?: MusicTheme
}>()
const emit = defineEmits<{ close: [] }>()
const library = useLibrary()
const router = useRouter()
function createPhoto() {
  const selectedId = photo.value?.id
  close()
  if (selectedId) void router.push({ path: '/studio', query: { photo: selectedId } })
}
const musicSelection = useMusicSelection()
const id = ref(props.initialId),
  dialog = ref<HTMLDialogElement>(),
  stage = ref<HTMLElement>()
const photo = computed(() => props.photos.find((p) => p.id === id.value))
const index = computed(() => props.photos.findIndex((p) => p.id === id.value))
const status = ref(''),
  error = ref('')
const zoom = ref(1),
  details = ref(false),
  naturalWidth = ref(0),
  naturalHeight = ref(0)
const fill = ref(true),
  controls = ref(true),
  ready = ref(false),
  playing = ref(!!props.autoplay)
const viewport = ref({ width: window.innerWidth, height: window.innerHeight })
const musicDetails = ref(false)
const musicOn = ref(false),
  musicError = ref(''),
  musicLoading = ref(false)
const music = new AlbumMusic(() => {
  musicOn.value = false
  musicLoading.value = false
  musicError.value = '配乐已暂停，请点击重新开启。'
})
const theme = computed(() => props.musicTheme ?? albumMusicTheme('', props.photos))
const track = computed(() => musicSelection.track(theme.value))
let slideTimer: ReturnType<typeof setTimeout> | undefined
let musicRequest = 0,
  ended = false
let bars: Promise<void> | undefined
const zoomSize = computed(() => {
  const scale = (fill.value ? Math.max : Math.min)(
    viewport.value.width / Math.max(1, naturalWidth.value),
    viewport.value.height / Math.max(1, naturalHeight.value),
  )
  return {
    width: `${naturalWidth.value * scale * zoom.value}px`,
    height: `${naturalHeight.value * scale * zoom.value}px`,
  }
})
function resize() {
  viewport.value = {
    width: window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight,
  }
}
function schedule() {
  clearTimeout(slideTimer)
  if (
    !playing.value ||
    !ready.value ||
    details.value ||
    zoom.value > 1 ||
    props.photos.length < 2 ||
    ended ||
    loading.value
  )
    return
  slideTimer = setTimeout(() => {
    if (!document.hidden && playing.value) {
      const next = props.photos[(index.value + 1) % props.photos.length]
      if (next) void load(next, 1)
    }
  }, 5000)
}
function togglePlayback() {
  playing.value = !playing.value
  details.value = false
  zoom.value = 1
  schedule()
}
function stopMusic() {
  ++musicRequest
  musicOn.value = false
  musicLoading.value = false
  music.stop()
}
async function startMusic() {
  const request = ++musicRequest
  musicError.value = ''
  musicOn.value = true
  musicLoading.value = true
  try {
    await music.play(track.value)
  } catch {
    if (request === musicRequest && !ended) {
      musicOn.value = false
      musicError.value =
        track.value.kind === 'local'
          ? '本机音频暂不能播放，请重新选择可用格式；照片轮播可继续使用。'
          : '在线音乐暂不可用，请检查网络后重试；照片轮播可继续使用。'
    }
  } finally {
    if (request === musicRequest) musicLoading.value = false
  }
}
function toggleMusic() {
  if (musicOn.value) stopMusic()
  else void startMusic()
}
function toggleDetails() {
  details.value = !details.value
  if (details.value) playing.value = false
}
function toggleControls() {
  controls.value = !controls.value
  stage.value?.focus()
}
function toggleFit() {
  fill.value = !fill.value
  zoom.value = 1
}
interface Frame {
  token: number
  photo: Photo
  source: string
  original: boolean
  controller: AbortController
  release: () => Promise<void>
}
const frames = shallowRef<Frame[]>([])
const originalSource = computed(() => (frames.value[0]?.original ? frames.value[0].source : ''))
const loading = ref(false),
  sliding = ref(false),
  direction = ref(1)
let controller: AbortController | undefined
let version = 0,
  token = 0
async function retire(frame: Frame) {
  frame.controller.abort()
  await frame.release().catch(() => {})
}
function dispose() {
  clearTimeout(slideTimer)
  ready.value = false
  ++version
  controller?.abort()
  controller = undefined
  for (const frame of frames.value) void retire(frame)
  frames.value = []
  loading.value = false
}
function close() {
  ended = true
  playing.value = false
  stopMusic()
  dispose()
  dialog.value?.close()
  emit('close')
}
function decode(source: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      image.onload = image.onerror = null
      if (error) {
        image.src = ''
        reject(error)
      } else resolve(image)
    }
    const abort = () => finish(new Error('已取消'))
    const timer = setTimeout(() => finish(new Error('原图解码超时')), 30000)
    signal.addEventListener('abort', abort, { once: true })
    image.onerror = () => finish(new Error('原图格式不可读'))
    image.onload = () => {
      // Decode before mounting the successor; the current image stays painted throughout.
      image.decode().then(
        () => finish(),
        () => finish(new Error('原图解码失败')),
      )
    }
    image.src = source
    if (signal.aborted) abort()
  })
}
async function slide(signal: AbortSignal) {
  await nextTick()
  if (signal.aborted) return
  stage.value?.getBoundingClientRect() // Commit the incoming off-screen position before moving it.
  sliding.value = true
  await new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(
      done,
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 720,
    )
    signal.addEventListener('abort', done, { once: true })
  })
}
async function load(target: Photo | undefined = photo.value, offset = 1) {
  if (!target || loading.value || ended) return
  clearTimeout(slideTimer)
  loading.value = true
  const request = ++version
  const pending = new AbortController()
  controller = pending
  const signal = pending.signal
  const previous = frames.value[0]
  if (!previous)
    frames.value = [
      {
        token: ++token,
        photo: target,
        source: target.thumbnail,
        original: false,
        controller: new AbortController(),
        release: async () => {},
      },
    ]
  zoom.value = 1
  details.value = false
  error.value = ''
  status.value = previous?.original ? '正在读取下一张…' : '正在读取原图…'
  let incoming: Frame | undefined
  try {
    const result = await originalPhoto(target, signal)
    incoming = {
      token: ++token,
      photo: target,
      source: result.source,
      original: true,
      controller: pending,
      release: result.release,
    }
    const image = await decode(result.source, signal)
    if (request !== version || signal.aborted) {
      await retire(incoming)
      return
    }
    direction.value = offset < 0 ? -1 : 1
    if (previous?.original && previous.photo.id !== target.id) {
      frames.value = [previous, incoming]
      await slide(signal)
    }
    if (request !== version || signal.aborted) {
      await retire(incoming)
      return
    }
    if (!props.photos.some((p) => p.id === target.id)) throw new Error('照片已不可用')
    frames.value = [incoming]
    sliding.value = false
    id.value = target.id
    naturalWidth.value = image.naturalWidth
    naturalHeight.value = image.naturalHeight
    status.value = target.source === 'device' ? '原图' : '示例插画'
    ready.value = true
    if (previous) await retire(previous)
  } catch {
    const cancelled = request !== version || signal.aborted
    if (incoming) await retire(incoming)
    if (cancelled) return
    frames.value = previous ? [previous] : frames.value.filter((f) => !f.original)
    sliding.value = false
    playing.value = false
    status.value = previous?.original
      ? previous.photo.source === 'device'
        ? '原图'
        : '示例插画'
      : ''
    error.value = '下一张原图暂不可读，请确认照片在本机且已授权。当前照片已保留。'
  } finally {
    if (request === version) {
      loading.value = false
      controller = undefined
      schedule()
    }
  }
}
function frameStyle(position: number) {
  const x =
    position === 0
      ? sliding.value
        ? -direction.value * 100
        : 0
      : sliding.value
        ? 0
        : direction.value * 100
  return {
    ...(zoom.value > 1 ? zoomSize.value : {}),
    objectFit: fill.value ? ('cover' as const) : ('contain' as const),
    transform: `translateX(${x}%)`,
  }
}
function move(offset: number) {
  const next = props.photos[index.value + offset]
  if (next) void load(next, offset)
}
async function setZoom(value: number) {
  if (loading.value) return
  if (value > 1 && (!originalSource.value || status.value === '正在读取原图…')) return
  zoom.value = value
  if (value > 1) playing.value = false
  await nextTick()
  if (stage.value) {
    stage.value.scrollLeft = (stage.value.scrollWidth - stage.value.clientWidth) / 2
    stage.value.scrollTop = (stage.value.scrollHeight - stage.value.clientHeight) / 2
  }
}
function key(event: KeyboardEvent) {
  if ((event.target as HTMLElement).closest('input, textarea, select')) return
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    move(1)
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    move(-1)
  }
}
let touchX = 0,
  touchY = 0,
  multiTouch = false
function start(event: TouchEvent) {
  multiTouch = event.touches.length !== 1
  if (event.touches.length !== 1) return
  touchX = event.touches[0]!.clientX
  touchY = event.touches[0]!.clientY
}
function end(event: TouchEvent) {
  if (multiTouch || zoom.value !== 1 || event.changedTouches.length !== 1 || event.touches.length)
    return
  const x = event.changedTouches[0]!.clientX - touchX,
    y = event.changedTouches[0]!.clientY - touchY
  if (Math.abs(x) > 70 && Math.abs(x) > Math.abs(y) * 1.5) move(x < 0 ? 1 : -1)
}
function visibility() {
  if (document.hidden) close()
}
watch(
  () => photo.value?.id,
  (value) => {
    if (!value) close()
  },
)
watch([playing, details, zoom, () => props.photos.length], schedule)
watch(
  () => track.value.url,
  () => {
    musicError.value = ''
    if (musicOn.value) stopMusic()
  },
)
watch(() => musicSelection.localRequest, close, { flush: 'sync' })
onMounted(() => {
  resize()
  void load()
  dialog.value?.showModal()
  document.documentElement.classList.add('viewer-open')
  window.addEventListener('resize', resize)
  window.visualViewport?.addEventListener('resize', resize)
  if (library.isNative)
    bars = SystemBars.hide({ animation: 'NONE' })
      .then(() => {
        if (!ended) resize()
      })
      .catch(() => {})
  document.addEventListener('visibilitychange', visibility)
})
onUnmounted(() => {
  ended = true
  stopMusic()
  dispose()
  dialog.value?.close()
  document.removeEventListener('visibilitychange', visibility)
  document.documentElement.classList.remove('viewer-open')
  window.removeEventListener('resize', resize)
  window.visualViewport?.removeEventListener('resize', resize)
  if (library.isNative)
    void (bars ?? Promise.resolve())
      .then(() => {
        if (!document.querySelector('.photo-viewer[open]'))
          return SystemBars.show({ animation: 'NONE' })
      })
      .catch(() => {})
})
</script>
<template>
  <dialog
    ref="dialog"
    class="photo-viewer"
    :style="{
      width: `${viewport.width}px`,
      height: `${viewport.height}px`,
      maxHeight: `${viewport.height}px`,
    }"
    aria-label="照片详情"
    @cancel.prevent="close"
    @keydown="key"
  >
    <template v-if="photo">
      <header v-show="controls || details" class="viewer-toolbar">
        <button class="viewer-button" aria-label="关闭照片详情" autofocus @click="close">
          <X :size="22" />
        </button>
        <span class="viewer-count">{{ index + 1 }} / {{ photos.length }}</span>
        <button
          class="viewer-button"
          :aria-label="musicOn ? '关闭背景音乐' : '开启分类配乐'"
          :aria-pressed="musicOn"
          @click="toggleMusic"
        >
          <VolumeX v-if="musicOn" :size="21" /><Music2 v-else :size="21" />
        </button>
        <button class="viewer-button" aria-label="选择背景音乐" @click="musicSelection.open = true">
          <ListMusic :size="21" />
        </button>
        <button
          class="viewer-button"
          :aria-label="photo.favorite ? '取消收藏' : '收藏照片'"
          :aria-pressed="photo.favorite"
          :disabled="library.busy"
          @click="library.favorite(photo)"
        >
          <Heart :size="21" :fill="photo.favorite ? 'currentColor' : 'none'" />
        </button>
        <button
          class="viewer-button"
          aria-label="编辑标签"
          :aria-expanded="details"
          @click="toggleDetails"
        >
          <Tags :size="21" />
        </button>
      </header>
      <div
        ref="stage"
        class="viewer-stage"
        tabindex="0"
        :class="{ zoomed: zoom > 1 }"
        :data-fit="fill ? 'cover' : 'contain'"
        @click="toggleControls"
        @touchstart.passive="start"
        @touchend.passive="end"
        @dblclick="setZoom(zoom === 1 ? 2 : 1)"
      >
        <img
          v-for="(frame, position) in frames"
          :key="frame.token"
          class="viewer-image"
          :class="{ 'is-current': position === 0, 'is-sliding': sliding }"
          :aria-hidden="position !== 0"
          :src="frame.source || undefined"
          :alt="position === 0 ? frame.photo.title : ''"
          :style="frameStyle(position)"
          draggable="false"
        />
      </div>
      <footer v-show="controls || details" class="viewer-toolbar viewer-bottom">
        <button
          class="viewer-button"
          aria-label="上一张照片"
          :disabled="loading || index <= 0"
          @click="move(-1)"
        >
          <ChevronLeft :size="24" />
        </button>
        <button
          class="viewer-button"
          :aria-label="playing ? '暂停轮播' : '开始自动轮播'"
          :aria-pressed="playing"
          :disabled="photos.length < 2"
          @click="togglePlayback"
        >
          <Pause v-if="playing" :size="21" /><Play v-else :size="21" />
        </button>
        <button
          class="viewer-button"
          aria-label="下一张照片"
          :disabled="loading || index >= photos.length - 1"
          @click="move(1)"
        >
          <ChevronRight :size="24" />
        </button>
        <span class="viewer-quality" role="status">{{ status }}</span>
        <button
          class="viewer-button"
          :aria-label="fill ? '完整显示照片' : '铺满屏幕'"
          @click="toggleFit"
        >
          <Shrink v-if="fill" :size="20" /><Expand v-else :size="20" />
        </button>
        <button
          class="viewer-button"
          :aria-label="zoom > 1 ? '适应屏幕' : '放大照片'"
          :disabled="loading || !originalSource || status === '正在读取原图…'"
          @click="setZoom(zoom > 1 ? 1 : 2)"
        >
          <ZoomOut v-if="zoom > 1" :size="21" /><ZoomIn v-else :size="21" />
        </button>
      </footer>
      <p v-if="musicOn && controls" class="viewer-music-caption" role="status">
        {{ musicLoading ? '正在准备… ' : '' }}{{ track.title }} · {{ track.artist
        }}<template v-if="track.kind === 'online'"> · CC BY 4.0</template>
        <button class="music-info-button" @click="musicDetails = !musicDetails">曲目来源</button>
      </p>
      <section v-if="musicDetails" class="viewer-details" aria-label="配乐来源与授权">
        <div class="viewer-details-title">
          <h2>{{ track.kind === 'local' ? '本机配乐' : '在线配乐' }}</h2>
          <button class="icon-button" aria-label="收起配乐信息" @click="musicDetails = false">
            <X :size="20" />
          </button>
        </div>
        <template v-if="track.kind === 'online'">
          <p>
            '{{ track.title }}' — {{ track.artist }} (incompetech.com) — Licensed under Creative
            Commons: By Attribution 4.0.
          </p>
          <p>
            原版录音，未作改编。默认关闭；仅播放时请求音乐，可能使用移动流量。音乐提供方可收到 IP
            与设备请求信息，照片、文件名与相册标题不发送。
          </p>
          <p>
            <a :href="track.page" target="_blank" rel="noopener noreferrer"
              >incompetech.com · 原曲页面</a
            >
            ·
            <a :href="track.licenseUrl" target="_blank" rel="noopener noreferrer">CC BY 4.0 许可</a>
          </p>
        </template>
        <template v-else
          ><p>{{ track.title }}</p>
          <p>
            由你通过系统选择的本机音频，仅在设备内播放。不会上传、不写入相册数据库；关闭应用后需重新选择。
          </p></template
        >
      </section>
      <div v-if="musicError" class="viewer-error" role="alert">{{ musicError }}</div>
      <div v-if="error" class="viewer-error" role="alert">
        {{ error }} <button @click="load()">重试</button>
      </div>
      <section v-if="details" class="viewer-details" aria-label="照片标签">
        <div class="viewer-details-title">
          <h2>{{ photo.title }}</h2>
          <button class="icon-button" aria-label="收起标签" @click="details = false">
            <X :size="20" />
          </button>
        </div>
        <div class="chips">
          <span v-for="tag in photo.tags" :key="tag" class="chip">{{ tag }}</span>
        </div>
        <TagEditor :photo-id="photo.id" />
        <button class="button" @click="createPhoto">美化与分享此照片 →</button>
      </section>
    </template>
  </dialog>
</template>
