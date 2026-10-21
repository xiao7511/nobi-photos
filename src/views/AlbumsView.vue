<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowUpRight, FolderHeart, X, Plus, Pencil, Trash2 } from '@lucide/vue'
import { useLibrary } from '../stores/library'
import PhotoGrid from '../components/PhotoGrid.vue'
import PhotoThumbnail from '../components/PhotoThumbnail.vue'
import type { Category } from '../domain/models'
import AlbumEditor from '../components/AlbumEditor.vue'
const library = useLibrary()
const selected = ref<Category | '收藏' | null>(null)
const selectedUser = ref(''),
  editor = ref<InstanceType<typeof AlbumEditor>>(),
  confirmation = ref<HTMLDialogElement>(),
  actionError = ref('')
const userAlbum = computed(() => library.albums.find((a) => a.id === selectedUser.value))
const userPhotos = computed(() =>
  library.photos.filter((p) => userAlbum.value?.photoIds.includes(p.id)),
)
function chooseUser(id: string) {
  selected.value = null
  selectedUser.value = id
}
function chooseCategory(category: Category | '收藏') {
  selectedUser.value = ''
  selected.value = category
}
async function removeAlbum() {
  if (!userAlbum.value) return
  try {
    await library.deleteAlbum(userAlbum.value.id)
    selectedUser.value = ''
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
const visible = computed(() =>
  selected.value === '收藏'
    ? library.favorites
    : library.photos.filter((p) => p.category === selected.value),
)
</script>
<template>
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
        @click="chooseUser(album.id)"
      >
        <PhotoThumbnail
          v-if="library.photos.find((p) => album.photoIds.includes(p.id))"
          :photo="library.photos.find((p) => album.photoIds.includes(p.id))!"
        />
        <div v-else class="album-placeholder"></div>
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
    <span>{{ library.isNative ? '尚未进行 AI 分类' : '按示例标签整理' }}</span>
  </div>
  <div class="album-grid">
    <button
      v-for="album in albums"
      :key="album.name"
      class="album-card"
      @click="chooseCategory(album.name)"
    >
      <PhotoThumbnail v-if="album.photos[0]" :photo="album.photos[0]" />
      <div v-else class="album-placeholder"></div>
      <div>
        <span
          ><strong>{{ album.name }}</strong
          ><small>{{ album.photos.length }} 张照片</small></span
        ><ArrowUpRight :size="21" />
      </div>
    </button>
  </div>
  <section v-if="selected" class="spaced">
    <div class="library-toolbar">
      <div class="section-title">
        <h2>{{ selected }}</h2>
        <span>{{ visible.length }} 张照片</span>
      </div>
      <button class="icon-button" aria-label="关闭分类" @click="selected = null">
        <X :size="20" />
      </button>
    </div>
    <PhotoGrid :photos="visible" />
  </section>
  <section v-if="userAlbum" class="spaced">
    <div class="library-toolbar">
      <div class="section-title">
        <h2>{{ userAlbum.name }}</h2>
        <span>{{ userPhotos.length }} 张照片</span>
      </div>
      <div class="data-actions">
        <button class="button" @click="editor?.open(userAlbum)">
          <Pencil :size="15" /> 编辑相册</button
        ><button class="button danger" @click="confirmation?.showModal()">
          <Trash2 :size="15" /> 移除相册</button
        ><button class="icon-button" aria-label="关闭自建相册" @click="selectedUser = ''">
          <X :size="20" />
        </button>
      </div>
    </div>
    <PhotoGrid :photos="userPhotos" />
  </section>
  <AlbumEditor ref="editor" @saved="chooseUser" />
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
