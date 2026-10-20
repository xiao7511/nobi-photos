<script setup lang="ts">
import { computed, ref } from 'vue'
import { ShieldCheck, Copy, Check, Leaf, ScanLine } from '@lucide/vue'
import { useLibrary } from '../stores/library'
import PhotoGrid from '../components/PhotoGrid.vue'
const library = useLibrary()
const reviewed = ref(false)
const candidates = computed(() => library.photos.filter((p) => p.duplicateGroup))
</script>
<template>
  <section class="page-heading">
    <div>
      <span class="eyebrow">MORE ROOM FOR WHAT MATTERS</span>
      <h1>轻一点，装下更多美好<span class="title-dot">.</span></h1>
      <p>每一张照片的去留，都由你决定。</p>
    </div>
    <span class="pill"><ShieldCheck :size="15" /> 自动删除已禁用</span>
  </section>
  <section class="cleanup-hero">
    <div>
      <span class="eyebrow">A LITTLE BREATHING SPACE</span>
      <h2>给回忆，留一些呼吸感。</h2>
      <p>这里只展示预设的示例相似组。<br />未扫描设备，未计算实际可释放空间。</p>
      <div class="chips">
        <span class="chip">无后台扫描</span><span class="chip">无自动删除</span
        ><span class="chip">原图不变</span>
      </div>
    </div>
    <Leaf :size="105" :stroke-width="0.8" />
  </section>
  <div class="cleanup-stats">
    <div>
      <Copy :size="23" /><strong>{{ candidates.length }}</strong
      ><span>示例相似照片</span>
    </div>
    <div><ScanLine :size="23" /><strong>未开启</strong><span>本机照片扫描</span></div>
    <div><ShieldCheck :size="23" /><strong>0 张</strong><span>已删除的原始照片</span></div>
  </div>
  <section class="spaced">
    <div class="library-toolbar">
      <div class="section-title">
        <h2>相似照片 · 示例组</h2>
        <span>预设标签，非 AI 检测结果</span>
      </div>
      <button class="button" :disabled="!candidates.length || reviewed" @click="reviewed = true">
        <Check :size="17" />{{ reviewed ? '已标记全部保留' : '全部保留（本次会话）' }}
      </button>
    </div>
    <div v-if="reviewed" class="banner" role="status">
      这些瞬间都值得保留。此标记仅用于本次预览。
    </div>
    <PhotoGrid :photos="candidates" compact />
  </section>
</template>
