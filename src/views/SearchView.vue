<script setup lang="ts">
import { ref } from 'vue'
import { Search, Sparkles, ShieldCheck, ArrowUpRight } from '@lucide/vue'
import { useLibrary } from '../stores/library'
import { filterPhotos } from '../services/photoService'
import type { Photo } from '../domain/models'
import PhotoGrid from '../components/PhotoGrid.vue'
const library = useLibrary()
const query = ref('')
const results = ref<Photo[]>([])
const searched = ref(false)
const searching = ref(false)
async function search(term = query.value) {
  query.value = term
  searching.value = true
  results.value = filterPhotos(library.photos, { text: term })
  searched.value = true
  searching.value = false
}
</script>
<template>
  <section class="page-heading">
    <div>
      <span class="eyebrow">FIND THE MOMENT YOU HAVE IN MIND</span>
      <h1>想起那一刻，就能找到<span class="title-dot">.</span></h1>
      <p>从一个地点、一种颜色，或一个小小的关键词开始。</p>
    </div>
  </section>
  <section class="search-panel">
    <div class="sparkle-emblem"><Sparkles :size="31" /></div>
    <h2>找回脑海里的小美好</h2>
    <p>Phase 1 使用本地示例标签匹配。端侧语义 AI 尚未接入。</p>
    <form class="search-box" @submit.prevent="search()">
      <Search :size="21" /><input
        v-model="query"
        aria-label="搜索照片"
        placeholder="试试「山」「海」「咖啡」…"
        maxlength="120"
      /><button class="button primary" type="submit" :disabled="searching">
        搜索 <ArrowUpRight :size="17" />
      </button>
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
      <h2>{{ query.trim() ? `「${query}」的搜索结果` : '全部示例照片' }}</h2>
      <span>{{ results.length }} 个瞬间</span>
    </div>
    <PhotoGrid
      :photos="
        results.map((p) => library.photos.find((current) => current.id === p.id)!).filter(Boolean)
      "
    />
  </section>
  <section v-else class="search-tips">
    <span class="eyebrow">A LITTLE TIP</span>
    <h3>从具体的词语开始</h3>
    <p>
      可以搜索示例照片的标题、分类、地点和标签。<br />用空格组合多个词，如「山
      绿色」，同时匹配两个关键词。
    </p>
  </section>
</template>
