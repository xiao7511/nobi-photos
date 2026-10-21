<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search, Sparkles, ShieldCheck, ArrowUpRight } from '@lucide/vue'
import { useLibrary } from '../stores/library'
import { filterPhotos, validateQuery } from '../services/photoService'
import type { PhotoQuery } from '../domain/models'
import PhotoGrid from '../components/PhotoGrid.vue'
import BatchToolbar from '../components/BatchToolbar.vue'
import { usePhotoSelection } from '../composables/usePhotoSelection'
const library = useLibrary()
const query = ref(''),
  fromDate = ref(''),
  toDate = ref(''),
  albumId = ref(''),
  tags = ref('')
const favoritesOnly = ref(false),
  orientation = ref(''),
  searched = ref(false),
  error = ref('')
const criteria = ref<PhotoQuery>({}),
  searchedAlbum = ref('')
const results = computed(() => {
  const album = library.albums.find((a) => a.id === searchedAlbum.value)
  return filterPhotos(library.photos, {
    ...criteria.value,
    photoIds: searchedAlbum.value ? (album?.photoIds ?? []) : undefined,
  })
})
const { selecting, selectedIds, toggle, selectVisible, clear, exit } = usePhotoSelection(results)
function search(term = query.value) {
  query.value = term
  const next: PhotoQuery = {
    text: term,
    fromDate: fromDate.value,
    toDate: toDate.value,
    favoritesOnly: favoritesOnly.value,
    orientation: orientation.value as PhotoQuery['orientation'],
    manualTags: tags.value
      .split(/[,，]/)
      .map((v) => v.trim())
      .filter(Boolean),
  }
  error.value = ''
  try {
    validateQuery(next)
    criteria.value = next
    searchedAlbum.value = albumId.value
    searched.value = true
    exit()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '搜索条件无效'
  }
}
function reset() {
  query.value = fromDate.value = toDate.value = albumId.value = tags.value = orientation.value = ''
  favoritesOnly.value = false
  searched.value = false
  criteria.value = {}
  searchedAlbum.value = error.value = ''
  exit()
}
</script>
<template>
  <section class="page-heading">
    <div>
      <span class="eyebrow">FIND THE MOMENT YOU HAVE IN MIND</span>
      <h1>想起那一刻，就能找到<span class="title-dot">.</span></h1>
      <p>从一个关键词开始，把范围缩小到想找的那一刻。</p>
    </div>
  </section>
  <section class="search-panel">
    <div class="sparkle-emblem"><Sparkles :size="31" /></div>
    <h2>找回脑海里的小美好</h2>
    <p>
      {{
        library.isNative ? '按本机照片标题、日期和手动标签匹配。' : '浏览器使用本地示例标签匹配。'
      }}端侧语义 AI 尚未接入。
    </p>
    <form @submit.prevent="search()">
      <div class="search-box">
        <Search :size="21" /><input
          v-model="query"
          aria-label="搜索照片"
          placeholder="试试「山」「海」「咖啡」…"
          maxlength="120"
        /><button class="button primary" type="submit">搜索 <ArrowUpRight :size="17" /></button>
      </div>
      <details class="advanced-search">
        <summary>组合筛选 · 日期、相册、标签与画幅</summary>
        <div class="search-fields">
          <label class="field-label"
            >开始日期<input v-model="fromDate" class="text-input" type="date"
          /></label>
          <label class="field-label"
            >结束日期<input v-model="toDate" class="text-input" type="date"
          /></label>
          <label class="field-label"
            >所属相册<select v-model="albumId" class="text-input">
              <option value="">全部相册与照片</option>
              <option v-for="album in library.albums" :key="album.id" :value="album.id">
                {{ album.name }}
              </option>
            </select></label
          >
          <label class="field-label"
            >照片画幅<select v-model="orientation" class="text-input">
              <option value="">不限画幅</option>
              <option value="landscape">横图</option>
              <option value="portrait">竖图</option>
              <option value="square">方图</option>
            </select></label
          >
          <label class="field-label"
            >精确手动标签<input
              v-model="tags"
              class="text-input"
              maxlength="520"
              placeholder="多个标签用逗号分隔，需同时满足"
          /></label>
          <label class="check-field"
            ><input v-model="favoritesOnly" type="checkbox" />仅看本地收藏</label
          >
        </div>
        <p class="fine-print">
          所有条件同时满足；日期包含首尾两天，按索引中的照片日期筛选。手动标签精确匹配，忽略大小写。
        </p>
      </details>
      <div class="search-filter-actions">
        <button class="button" type="button" @click="reset">重置搜索</button
        ><span>修改筛选后点击“搜索”应用</span>
      </div>
      <p v-if="error" class="banner error" role="alert">{{ error }}</p>
    </form>
    <div class="suggestions">
      <span>灵感词</span
      ><button
        v-for="term in ['绿色', '海', '咖啡', '杭州', '日落']"
        :key="term"
        @click="search(term)"
      >
        {{ term }}
      </button>
    </div>
    <div class="search-privacy">
      <ShieldCheck :size="15" /> 查询仅在当前设备处理 · 无云端 AI · 不上传照片
    </div>
  </section>
  <section v-if="searched" class="spaced">
    <div class="section-title spaced">
      <h2>{{ criteria.text?.trim() ? `「${criteria.text}」的搜索结果` : '筛选结果' }}</h2>
      <span>{{ results.length }} 个瞬间</span>
    </div>
    <BatchToolbar
      :selecting="selecting"
      :selected-ids="selectedIds"
      :total="results.length"
      @start="selecting = true"
      @exit="exit"
      @all="selectVisible"
      @clear="clear"
      @saved="exit"
    />
    <PhotoGrid
      :photos="results"
      :selecting="selecting"
      :selected-ids="selectedIds"
      @toggle="toggle"
    />
  </section>
  <section v-else class="search-tips">
    <span class="eyebrow">A LITTLE TIP</span>
    <h3>从具体的词语开始</h3>
    <p>
      可以搜索照片标题、日期和标签。用空格组合多个词，如「山 绿色」，同时匹配两个关键词。<br />展开组合筛选，可进一步限定相册、日期、手动标签、收藏和画幅；搜索条件不保存到历史记录。
    </p>
  </section>
</template>
