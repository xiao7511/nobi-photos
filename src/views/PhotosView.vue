<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ArrowUpRight,
  SlidersHorizontal,
  Images,
  Heart,
  Grid2X2,
  LayoutGrid,
  Leaf,
  LockKeyhole,
} from '@lucide/vue'
import PhotoGrid from '../components/PhotoGrid.vue'
import LibraryConnection from '../components/LibraryConnection.vue'
import { useLibrary } from '../stores/library'
import type { Category } from '../domain/models'
import BatchToolbar from '../components/BatchToolbar.vue'
import { usePhotoSelection } from '../composables/usePhotoSelection'
const library = useLibrary()
const filter = ref('全部照片')
const order = ref('newest')
const compact = ref(false)
const filters = computed(() =>
  library.isNative
    ? ['全部照片', '我的收藏', '未分类']
    : ['全部照片', '我的收藏', '自然', '旅行', '生活', '建筑'],
)
const connection = ref<HTMLElement>()
function connect() {
  if (library.isNative) connection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  else library.notice = '浏览器不请求系统相册权限，请使用 Android / iOS 应用连接照片。'
}
const visible = computed(() =>
  library.photos
    .filter(
      (p) =>
        filter.value === '全部照片' ||
        (filter.value === '我的收藏' ? p.favorite : p.category === (filter.value as Category)),
    )
    .sort((a, b) =>
      order.value === 'newest'
        ? b.takenAt.localeCompare(a.takenAt)
        : a.takenAt.localeCompare(b.takenAt),
    ),
)
const groups = computed(() =>
  [...new Set(visible.value.map((p) => p.takenAt.slice(0, 10)))].map((date) => ({
    date,
    photos: visible.value.filter((p) => p.takenAt.startsWith(date)),
  })),
)
const { selecting, selectedIds, toggle, selectVisible, clear, exit } = usePhotoSelection(visible)
</script>
<template>
  <section v-if="!library.isNative" class="page-heading">
    <div>
      <span class="eyebrow">YOUR LIFE, BEAUTIFULLY COLLECTED</span>
      <h1>把日子，存成喜欢的样子<span class="title-dot">.</span></h1>
      <p>那些平凡又闪光的瞬间，都在这里。</p>
    </div>
    <button class="button primary" @click="connect">
      <Images :size="17" /> 连接本机相册 <ArrowUpRight :size="17" />
    </button>
  </section>
  <div v-if="!library.isNative" ref="connection"><LibraryConnection /></div>
  <div v-else class="native-library-status">
    <span><LockKeyhole :size="15" /> 照片与整理记录保存在本机</span>
    <RouterLink to="/privacy">管理相册 <ArrowUpRight :size="15" /></RouterLink>
  </div>
  <LibraryConnection v-if="library.isNative && !library.photos.length" compact />
  <section v-if="!library.isNative" class="memory-hero">
    <div class="hero-copy">
      <span class="hero-label"><Leaf :size="14" /> LITTLE THINGS, BIG MEMORIES</span>
      <h2>走慢一点，<br />美好一直都在。</h2>
      <p>
        山间的风，窗边的光，还有刚刚好的日常。<br
          class="desktop-break"
        />让每一份小小的喜欢，都有迹可循。
      </p>
      <button class="hero-link" @click="filter = '我的收藏'">
        重温我的收藏 <ArrowUpRight :size="18" />
      </button>
      <div class="hero-pagination">
        <span></span><i></i><i></i><small>慢慢记录 · 本地示例</small>
      </div>
    </div>
    <div class="hero-art">
      <img src="/art/mountains.svg" alt="本地插画：阳光下的山野" /><span class="hero-art-label"
        >IN THE MOUNTAINS <span>↗</span></span
      >
    </div>
    <div class="hero-note">好好生活<br />慢慢记录 <span>✳</span></div>
  </section>
  <div class="library-toolbar">
    <div class="section-title">
      <h2>{{ library.isNative ? '全部回忆' : '我的照片' }}</h2>
      <span>{{ library.photos.length }} {{ library.isNative ? '张本机照片' : '个示例瞬间' }}</span>
    </div>
    <div class="toolbar-right">
      <span class="demo-badge">{{ library.isNative ? '本机索引' : '示例相册' }}</span
      ><label class="sort-label"
        ><SlidersHorizontal :size="15" /><select v-model="order" aria-label="照片排序">
          <option value="newest">最新优先</option>
          <option value="oldest">最早优先</option>
        </select></label
      >
      <div class="view-toggle">
        <button
          :class="{ chosen: !compact }"
          aria-label="舒适视图"
          :aria-pressed="!compact"
          @click="compact = false"
        >
          <LayoutGrid :size="16" /></button
        ><button
          :class="{ chosen: compact }"
          aria-label="紧凑视图"
          :aria-pressed="compact"
          @click="compact = true"
        >
          <Grid2X2 :size="16" />
        </button>
      </div>
    </div>
  </div>
  <div class="filter-row" aria-label="照片筛选">
    <button
      v-for="item in filters"
      :key="item"
      :class="['filter', { selected: filter === item }]"
      :aria-pressed="filter === item"
      @click="filter = item"
    >
      <Heart v-if="item === '我的收藏'" :size="14" />{{ item
      }}<span v-if="item === '全部照片'">{{ library.photos.length }}</span>
    </button>
  </div>
  <BatchToolbar
    :selecting="selecting"
    :selected-ids="selectedIds"
    :total="visible.length"
    @start="selecting = true"
    @exit="exit"
    @all="selectVisible"
    @clear="clear"
    @saved="exit"
  />
  <div v-if="library.loading" class="empty-state" role="status">正在打开本地相册…</div>
  <template v-else-if="visible.length">
    <section v-for="group in groups" :key="group.date" class="date-group">
      <div class="date-heading">
        <h3>
          {{ Number(group.date.slice(5, 7)) }} 月 {{ Number(group.date.slice(8)) }} 日<span>{{
            group.date.slice(0, 4)
          }}</span>
        </h3>
        <span>{{ group.photos.length }} 张照片</span>
      </div>
      <PhotoGrid
        :photos="group.photos"
        :compact="compact"
        :selecting="selecting"
        :selected-ids="selectedIds"
        @toggle="toggle"
      />
    </section>
  </template>
  <PhotoGrid v-else :photos="[]" />
  <div class="privacy-strip">
    <LockKeyhole :size="14" /><span>你的照片，只在你的设备上。无需注册，也能安心记录。</span
    ><RouterLink to="/privacy">隐私承诺 <ArrowUpRight :size="13" /></RouterLink>
  </div>
</template>
