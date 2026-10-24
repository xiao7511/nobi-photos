<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowUpRight,
  ArrowLeft,
  FolderHeart,
  Plus,
  Pencil,
  Trash2,
  Play,
  Music2,
  GalleryHorizontal,
  LayoutGrid,
} from '@lucide/vue'
import { useLibrary } from '../stores/library'
import PhotoGrid from '../components/PhotoGrid.vue'
import AlbumCover from '../components/AlbumCover.vue'
import AlbumFan from '../components/AlbumFan.vue'
import { useMusicSelection } from '../stores/music'
import type { Category, Photo } from '../domain/models'
import AlbumEditor from '../components/AlbumEditor.vue'
import AlbumRename from '../components/AlbumRename.vue'
import SmartOrganization from '../components/SmartOrganization.vue'
import { albumMusicTheme, musicScores } from '../domain/albumMusic'
const library = useLibrary()
const musicSelection = useMusicSelection()
const layout = ref<'fan' | 'grid'>('fan')
const photoIndex = computed(() => new Map(library.photos.map((photo) => [photo.id, photo])))
function coverPhotos(ids: string[]) {
  const result: Photo[] = []
  for (const id of ids) {
    const photo = photoIndex.value.get(id)
    if (photo) result.push(photo)
    if (result.length === 5) break
  }
  return result
}
const route = useRoute(),
  router = useRouter()
const selectedId = computed(() => (typeof route.query.album === 'string' ? route.query.album : ''))
const editor = ref<InstanceType<typeof AlbumEditor>>(),
  confirmation = ref<HTMLDialogElement>(),
  actionError = ref('')
const userAlbum = computed(() => library.albums.find((a) => a.id === selectedId.value))
const rename = ref<InstanceType<typeof AlbumRename>>()
const grid = ref<InstanceType<typeof PhotoGrid>>(),
  heading = ref<HTMLElement>()
const selected = computed(() =>
  selectedId.value === 'favorites'
    ? '收藏'
    : selectedId.value.startsWith('category:')
      ? selectedId.value.slice(9)
      : '',
)
const validCategory = computed(() =>
  ['自然', '旅行', '生活', '建筑', '未分类', '收藏'].includes(selected.value),
)
const title = computed(
  () => userAlbum.value?.name ?? (validCategory.value ? selected.value : '相册不可用'),
)
const visible = computed(() => {
  if (userAlbum.value) {
    const ids = new Set(userAlbum.value.photoIds)
    return library.photos.filter((p) => ids.has(p.id))
  }
  if (!validCategory.value) return []
  return selected.value === '收藏'
    ? library.favorites
    : library.photos.filter((p) => p.category === selected.value)
})
const theme = computed(() => albumMusicTheme(selectedId.value, visible.value))
watch(selectedId, async (id) => {
  if (id) {
    await nextTick()
    heading.value?.focus()
    layout.value = 'fan'
  }
})
function chooseUser(id: string) {
  void router.push({ path: '/albums', query: { album: id } })
}
function chooseCategory(category: Category | '收藏') {
  chooseUser(category === '收藏' ? 'favorites' : `category:${category}`)
}
function closeAlbum() {
  void router.replace('/albums')
}
async function removeAlbum() {
  if (!userAlbum.value) return
  try {
    await library.deleteAlbum(userAlbum.value.id)
    closeAlbum()
    confirmation.value?.close()
    actionError.value = ''
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '相册未移除'
  }
}
const albums = computed(() =>
  ((library.isNative ? ['未分类'] : ['自然', '旅行', '生活', '建筑']) as Category[]).map(
    (name) => ({
      name,
      photos: library.photos.filter((p) => p.category === name),
    }),
  ),
)
</script>
<template>
  <section v-if="selectedId" class="album-detail" aria-label="相册详情">
    <button class="button album-back" @click="closeAlbum">
      <ArrowLeft :size="18" /> 返回相册列表
    </button>
    <div class="album-detail-heading">
      <div>
        <h1 ref="heading" tabindex="-1">{{ title }}</h1>
        <p>{{ visible.length }} 张照片</p>
      </div>
      <button
        class="button primary"
        :disabled="visible.length < 2 || library.loading"
        @click="grid?.play()"
      >
        <Play :size="18" /> 播放相册
      </button>
    </div>
    <div v-if="userAlbum" class="album-detail-actions">
      <button class="button" @click="rename?.open(userAlbum)">
        <Pencil :size="15" /> 修改名称
      </button>
      <button class="button" @click="editor?.open(userAlbum)">
        <Pencil :size="15" /> 编辑相册
      </button>
      <button class="button danger" @click="confirmation?.showModal()">
        <Trash2 :size="15" /> 移除相册
      </button>
    </div>
    <p v-if="library.loading" class="body-text" role="status">正在读取相册…</p>
    <template v-if="userAlbum || validCategory">
      <p class="album-music-note body-text">
        轮播时可联网播放「{{ musicScores[theme].title }}」· Kevin MacLeod（CC BY
        4.0），按分类匹配，默认关闭。
      </p>
      <div class="album-browse-actions">
        <div class="album-view-toggle" aria-label="相册浏览方式">
          <button
            class="button"
            :aria-pressed="layout === 'fan'"
            aria-label="扇形查看"
            @click="layout = 'fan'"
          >
            <GalleryHorizontal :size="17" /> 扇形
          </button>
          <button
            class="button"
            :aria-pressed="layout === 'grid'"
            aria-label="网格查看"
            @click="layout = 'grid'"
          >
            <LayoutGrid :size="17" /> 网格
          </button>
        </div>
        <button class="button" @click="musicSelection.open = true">
          <Music2 :size="17" /> 选择背景音乐
        </button>
      </div>
      <AlbumFan v-if="layout === 'fan'" :photos="visible" @open="grid?.openPhoto($event)" />
      <PhotoGrid
        ref="grid"
        :photos="visible"
        :music-theme="theme"
        :gallery-hidden="layout === 'fan'"
      />
    </template>
    <p v-if="!library.loading && !userAlbum && !validCategory" class="banner" role="status">
      相册已移除或暂不可访问，请返回列表重新选择。
    </p>
  </section>
  <template v-else>
    <section class="page-heading">
      <div>
        <template v-if="!library.isNative">
          <span class="eyebrow">A PLACE FOR EVERY MEMORY</span>
          <h1>喜欢的事物，自成一集<span class="title-dot">.</span></h1>
          <p>把散落的瞬间，整理成生活的章节。</p>
        </template>
        <p v-else>用相册整理你的回忆，仅在本机保存。</p>
      </div>
      <button class="button primary" @click="editor?.open()"><Plus :size="17" /> 新建相册</button>
    </section>
    <SmartOrganization />
    <div class="feature-panel soft">
      <FolderHeart :size="35" />
      <div>
        <h2>我的心动收藏</h2>
        <p>{{ library.favorites.length }} 个想再看一遍的瞬间</p>
      </div>
      <button class="button" @click="chooseCategory('收藏')">
        打开收藏 <ArrowUpRight :size="17" />
      </button>
    </div>
    <section class="spaced">
      <div class="section-title">
        <h2>自建相册</h2>
        <span>{{ library.albums.length }} 个 · 本地保存</span>
      </div>
      <div v-if="library.albums.length" class="album-grid">
        <button
          v-for="album in library.albums"
          :key="album.id"
          class="album-card user-album"
          :aria-label="`${album.name}，${album.photoIds.length} 张照片`"
          @click="chooseUser(album.id)"
        >
          <AlbumCover :photos="coverPhotos(album.photoIds)" />
          <div>
            <span
              ><strong>{{ album.name }}</strong
              ><small>{{ album.photoIds.length }} 张照片</small></span
            ><ArrowUpRight :size="21" />
          </div>
        </button>
      </div>
      <div v-else class="album-empty">
        <p>给一场旅行、一个周末，留一个专属位置。</p>
        <button class="button" @click="editor?.open()"><Plus :size="16" /> 创建第一个相册</button>
      </div>
    </section>
    <div class="section-title spaced">
      <h2>{{ library.isNative ? '本机照片' : '生活的四个切面' }}</h2>
      <span>{{ library.isNative ? '系统照片索引' : '按示例标签整理' }}</span>
    </div>
    <div class="album-grid">
      <button
        v-for="album in albums"
        :key="album.name"
        class="album-card"
        :aria-label="`${album.name}，${album.photos.length} 张照片`"
        @click="chooseCategory(album.name)"
      >
        <AlbumCover :photos="album.photos" />
        <div>
          <span
            ><strong>{{ album.name }}</strong
            ><small>{{ album.photos.length }} 张照片</small></span
          ><ArrowUpRight :size="21" />
        </div>
      </button>
    </div>
  </template>
  <AlbumEditor ref="editor" @saved="chooseUser" />
  <AlbumRename ref="rename" />
  <dialog ref="confirmation" class="confirm-dialog" aria-labelledby="remove-album-title">
    <h2 id="remove-album-title">移除这个相册？</h2>
    <p>仅移除本地整理关系，系统照片、其他相册与手动标签均不受影响。</p>
    <p v-if="actionError" class="banner error" role="alert">{{ actionError }}</p>
    <div class="data-actions">
      <button class="button" :disabled="library.busy" @click="confirmation?.close()">取消</button
      ><button class="button danger" :disabled="library.busy" @click="removeAlbum">
        确认移除相册
      </button>
    </div>
  </dialog>
</template>
