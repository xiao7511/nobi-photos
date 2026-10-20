<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowUpRight, FolderHeart, X } from '@lucide/vue'
import { useLibrary } from '../stores/library'
import PhotoGrid from '../components/PhotoGrid.vue'
import type { Category } from '../domain/models'
const library = useLibrary()
const selected = ref<Category | '收藏' | null>(null)
const albums = computed(() =>
  (['自然', '旅行', '生活', '建筑'] as Category[]).map((name) => ({
    name,
    photos: library.photos.filter((p) => p.category === name),
  })),
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
      <span class="eyebrow">A PLACE FOR EVERY MEMORY</span>
      <h1>喜欢的事物，自成一集<span class="title-dot">.</span></h1>
      <p>把散落的瞬间，整理成生活的章节。</p>
    </div>
    <span class="pill">本地示例分类</span>
  </section>
  <div class="feature-panel soft">
    <FolderHeart :size="35" />
    <div>
      <h2>我的心动收藏</h2>
      <p>{{ library.favorites.length }} 个想再看一遍的瞬间</p>
    </div>
    <button class="button" @click="selected = '收藏'">打开收藏 <ArrowUpRight :size="17" /></button>
  </div>
  <div class="section-title spaced">
    <h2>生活的四个切面</h2>
    <span>按示例标签整理</span>
  </div>
  <div class="album-grid">
    <button
      v-for="album in albums"
      :key="album.name"
      class="album-card"
      @click="selected = album.name"
    >
      <img v-if="album.photos[0]" :src="album.photos[0].thumbnail" :alt="`${album.name}封面`" />
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
</template>
