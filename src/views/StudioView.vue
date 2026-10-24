<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useLibrary } from '../stores/library'
import { useAccount } from '../stores/account'
import { looks, mediaCaption, type Crop, type Look } from '../domain/mediaStudio'
import { renderMedia } from '../services/mediaStudio'
import { shareFile, shareMedia } from '../services/mediaShare'
import { filterPhotos } from '../services/photoService'
import PhotoThumbnail from '../components/PhotoThumbnail.vue'
const library = useLibrary(),
  account = useAccount(),
  route = useRoute()
const selected = ref<string[]>([]),
  query = ref(''),
  album = ref('')
const collage = ref(false),
  look = ref<Look>('natural'),
  amount = ref(70),
  crop = ref<Crop>('original')
const caption = ref(''),
  captionStyle = ref<'simple' | 'warm' | 'travel'>('simple')
const albumName = ref(''),
  savedAlbum = ref('')
const shareConsent = ref(false)
const busy = ref(false),
  sharing = ref(false),
  error = ref(''),
  notice = ref(''),
  preview = ref('')
const result = shallowRef<{ blob: Blob; width: number; height: number }>()
let controller: AbortController | undefined,
  request = 0
const matches = computed(() =>
  filterPhotos(library.photos, {
    text: query.value,
    photoIds: album.value
      ? (library.albums.find((a) => a.id === album.value)?.photoIds ?? [])
      : undefined,
  }),
)
const picked = computed(() =>
  selected.value.map((id) => library.photos.find((p) => p.id === id)).filter((p) => !!p),
)
function clearPreview() {
  shareConsent.value = false
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = ''
  result.value = undefined
}
function cancel() {
  ++request
  controller?.abort()
  controller = undefined
  busy.value = false
  clearPreview()
}
function choose(id: string) {
  if (busy.value || sharing.value) return
  if (selected.value.includes(id)) selected.value = selected.value.filter((v) => v !== id)
  else if (collage.value && selected.value.length >= 9) error.value = '一张拼图最多选择九张照片'
  else selected.value = collage.value ? [...selected.value, id] : [id]
}
async function generate() {
  cancel()
  error.value = ''
  notice.value = ''
  busy.value = true
  const version = request
  const abort = new AbortController()
  controller = abort
  try {
    account.require('beautify')
    if (collage.value) account.require('compose')
    const output = await renderMedia(
      picked.value,
      { collage: collage.value, look: look.value, amount: amount.value, crop: crop.value },
      abort.signal,
    )
    if (version !== request || abort.signal.aborted) return
    account.require('beautify')
    result.value = output
    preview.value = URL.createObjectURL(output.blob)
    if (!caption.value)
      caption.value = mediaCaption(picked.value[0]?.category ?? '', captionStyle.value)
    notice.value = '成品已在本机生成；原图未修改，未上传'
  } catch (e) {
    if (version === request && !abort.signal.aborted)
      error.value = e instanceof Error ? e.message : '成品未生成，请重试'
  } finally {
    if (version === request) busy.value = false
  }
}
async function share() {
  if (!result.value || sharing.value) return
  error.value = ''
  notice.value = ''
  try {
    if (!shareConsent.value) throw new Error('请先确认分享成品')
    account.require('share')
    // Prepare a File synchronously within the user gesture for Web Share.
    const file = shareFile(result.value.blob)
    sharing.value = true
    await shareMedia(file, caption.value)
    notice.value = '已调用系统分享；是否发布由你在目标应用确认'
  } catch (e) {
    if (e instanceof Error && (e.name === 'AbortError' || /cancel/i.test(e.message)))
      notice.value = '已取消分享'
    else
      error.value =
        '分享未完成。可以下载成品，或在目标应用手动选择图片；朋友圈是否可选取决于微信及系统。'
  } finally {
    sharing.value = false
  }
}
function download() {
  if (!result.value || library.isNative) return
  try {
    account.require('share')
    const anchor = document.createElement('a')
    anchor.href = preview.value
    anchor.download = shareFile(result.value.blob).name
    anchor.click()
    notice.value = '已请求浏览器保存成品，请确认下载位置'
  } catch (e) {
    error.value = e instanceof Error ? e.message : '下载未完成'
  }
}
async function copyCaption() {
  try {
    account.require('share')
    await navigator.clipboard.writeText(caption.value)
    notice.value = '文案已复制，可在目标应用粘贴'
  } catch {
    notice.value = '无法自动复制，请长按文案选择并复制'
  }
}
async function saveAlbum() {
  error.value = ''
  notice.value = ''
  try {
    account.require('compose')
    if (!picked.value.length) throw new Error('请先选择照片')
    const id = `user:${crypto.randomUUID()}`
    await library.saveAlbum({ id, name: albumName.value, photoIds: [...selected.value] })
    savedAlbum.value = id
    notice.value = '已保存本地相册关系，照片未复制或移动'
  } catch (e) {
    error.value = e instanceof Error ? e.message : '相册未保存'
  }
}
watch([selected, collage, look, amount, crop], cancel, { deep: true })
watch(collage, (value) => {
  if (!value) selected.value = selected.value.slice(0, 1)
})
watch(
  () => account.signedIn,
  (value) => {
    if (!value) {
      cancel()
      selected.value = []
      caption.value = ''
      albumName.value = ''
    }
  },
)
watch(
  () => library.photos,
  (photos) => {
    const ids = new Set(photos.map((p) => p.id))
    const accessible = selected.value.filter((id) => ids.has(id))
    if (accessible.length !== selected.value.length) selected.value = accessible
  },
)
function visibility() {
  if (document.hidden) {
    cancel()
    selected.value = []
    caption.value = ''
    albumName.value = ''
  }
}
onMounted(() => {
  document.addEventListener('visibilitychange', visibility)
  const id = typeof route.query.photo === 'string' ? route.query.photo : ''
  if (
    typeof route.query.album === 'string' &&
    library.albums.some((a) => a.id === route.query.album)
  )
    album.value = route.query.album
  if (library.photos.some((p) => p.id === id)) selected.value = [id]
})
onUnmounted(() => {
  document.removeEventListener('visibilitychange', visibility)
  cancel()
})
</script>
<template>
  <div class="member-page">
    <RouterLink to="/profile" class="back-link">← 返回我的空间</RouterLink>
    <section class="page-heading">
      <div>
        <span class="eyebrow">CREATE ON YOUR DEVICE</span>
        <h1>图片创作室</h1>
        <p>美化、排版、分享，只在你确认后发生。</p>
      </div>
    </section>
    <section v-if="!account.signedIn" class="member-card">
      <h2>注册用户专属创作</h2>
      <p>
        登录并验证邮箱后，使用本地美化、社交拼图与媒体分享。原有照片浏览和 AI 整理继续免费开放。
      </p>
      <RouterLink to="/account" class="primary-button">注册 / 登录</RouterLink>
      <p v-if="!account.available">账号服务尚未配置，当前无法解锁。没有创建演示账号或模拟登录。</p>
      <RouterLink to="/albums" class="text-link">继续整理本地相册 →</RouterLink>
    </section>
    <template v-else>
      <section class="member-card">
        <h2>1. 选择照片</h2>
        <div class="member-tabs">
          <button :aria-pressed="!collage" :disabled="busy || sharing" @click="collage = false">
            单图美化</button
          ><button :aria-pressed="collage" :disabled="busy || sharing" @click="collage = true">
            社交拼图 · 最多九张
          </button>
        </div>
        <div class="member-form">
          <label
            >筛选本地相册<select v-model="album">
              <option value="">全部照片</option>
              <option v-for="item in library.albums" :key="item.id" :value="item.id">
                {{ item.name }}
              </option>
            </select></label
          ><label>搜索要创作的照片<input v-model="query" type="search" maxlength="100" /></label>
        </div>
        <p>
          已选择 {{ selected.length }} 张{{
            matches.length > 100 ? ' · 当前显示前 100 张，请搜索缩小范围' : ''
          }}
        </p>
        <div class="studio-picker">
          <button
            v-for="photo in matches.slice(0, 100)"
            :key="photo.id"
            :aria-label="`选择创作照片${photo.title}`"
            :aria-pressed="selected.includes(photo.id)"
            :disabled="busy || sharing"
            @click="choose(photo.id)"
          >
            <PhotoThumbnail :photo="photo" /><span>{{ photo.title }}</span
            ><b v-if="selected.includes(photo.id)">✓</b>
          </button>
        </div>
        <p v-if="!matches.length">暂无可选照片，请连接本机相册或调整筛选。</p>
      </section>
      <section class="member-card">
        <h2>2. 调色与构图</h2>
        <div class="studio-looks">
          <button
            v-for="item in looks"
            :key="item.id"
            :aria-pressed="look === item.id"
            :disabled="busy || sharing"
            @click="look = item.id"
          >
            {{ item.name }}
          </button>
        </div>
        <div class="member-form">
          <label
            >美化强度 {{ amount }}%<input
              v-model.number="amount"
              type="range"
              min="0"
              max="100"
              :disabled="busy || sharing || look === 'natural'" /></label
          ><label v-if="!collage"
            >照片裁切<select v-model="crop" :disabled="busy || sharing">
              <option value="original">保留原比例</option>
              <option value="square">正方形 1:1</option>
              <option value="portrait">竖版 4:5</option>
            </select></label
          >
        </div>
        <button
          class="primary-button"
          :disabled="busy || sharing || !selected.length"
          @click="generate"
        >
          {{ busy ? '正在本地生成…' : '生成成品预览' }}</button
        ><button v-if="busy" class="secondary-button" @click="cancel">取消生成</button>
        <p class="fine-print">
          单图最长边 2400px；拼图为 2160×2160。导出 JPEG 副本不携带原图 EXIF / GPS
          信息，不覆盖原图。
        </p>
      </section>
      <section v-if="preview" class="member-card studio-result">
        <h2>3. 确认成品并分享</h2>
        <img :src="preview" alt="本地生成的成品预览" />
        <p>{{ result?.width }} × {{ result?.height }} · JPEG</p>
        <div class="member-form">
          <label
            >本地文案风格<select v-model="captionStyle">
              <option value="simple">简洁</option>
              <option value="warm">温暖</option>
              <option value="travel">旅行</option>
            </select></label
          ><button
            class="secondary-button"
            @click="caption = mediaCaption(picked[0]?.category ?? '', captionStyle)"
          >
            生成本地文案草稿</button
          ><label>分享文案<textarea v-model="caption" maxlength="300" rows="3"></textarea></label>
        </div>
        <p>
          文案为离线模板，可自行修改。分享到微信等应用后，还需要由你选择对象并确认发布；部分应用不接收附带文案，可先复制再粘贴。
        </p>
        <label class="consent-label"
          ><input v-model="shareConsent" type="checkbox" :disabled="sharing" /><span
            >我已检查成品，确认交给自己选择的其他应用。</span
          ></label
        >
        <div class="studio-share-actions">
          <button class="primary-button" :disabled="sharing || !shareConsent" @click="share">
            {{ sharing ? '等待系统分享…' : '选择应用分享' }}</button
          ><button v-if="!library.isNative" class="secondary-button" @click="download">
            下载成品</button
          ><button class="secondary-button" @click="copyCaption">复制文案</button>
        </div>
      </section>
      <section class="member-card">
        <h2>将所选照片整理成相册</h2>
        <form class="member-form" @submit.prevent="saveAlbum">
          <label>新相册名称<input v-model="albumName" maxlength="40" required /></label
          ><button
            class="secondary-button"
            :disabled="library.busy || !selected.length || busy || sharing"
          >
            保存所选照片到本地相册
          </button>
        </form>
        <RouterLink
          v-if="savedAlbum"
          :to="{ path: '/albums', query: { album: savedAlbum } }"
          class="text-link"
          >打开新相册 →</RouterLink
        ><RouterLink to="/albums" class="text-link">更多 AI 整理与批量操作 →</RouterLink>
      </section>
    </template>
    <p v-if="error" class="error-box" role="alert">{{ error }}</p>
    <p v-if="notice" class="notice-box" role="status">{{ notice }}</p>
  </div>
</template>
