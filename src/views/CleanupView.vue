<script setup lang="ts">
import { computed, ref } from 'vue'
import { ShieldCheck, Copy, Check, Leaf, ScanLine } from '@lucide/vue'
import { useLibrary } from '../stores/library'
import PhotoGrid from '../components/PhotoGrid.vue'
import { useAnalysis } from '../stores/analysis'
const library = useLibrary()
const analysis = useAnalysis()
const visibleGroups = computed(() =>
  analysis.groups
    .map((g) => ({ ...g, photos: library.photos.filter((p) => g.photoIds.includes(p.id)) }))
    .filter((g) => g.photos.length > 1),
)
const similarCount = computed(() =>
  visibleGroups.value.reduce((sum, g) => sum + g.photos.length, 0),
)
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
      <p>手动启动本地缩略图分析，找出可能相似的照片。<br />未计算实际可释放空间。</p>
      <div class="chips">
        <span class="chip">无后台扫描</span><span class="chip">无自动删除</span
        ><span class="chip">原图不变</span>
      </div>
    </div>
    <Leaf :size="105" :stroke-width="0.8" />
  </section>
  <section class="connection-panel spaced" aria-label="本地相似照片分析">
    <div class="connection-heading">
      <ScanLine :size="23" />
      <div>
        <h2>找一找，相似的瞬间</h2>
        <p>
          仅比较本地缩略图结构、颜色与比例；不是 AI
          或原图一致性证明，结果需要逐张核对。图像指纹不写入数据库。
        </p>
      </div>
    </div>
    <div class="data-actions">
      <button
        class="button primary"
        :disabled="analysis.running || !library.photos.length"
        @click="analysis.analyze(library.photos)"
      >
        {{ analysis.running ? '分析中…' : '开始本地分析' }}</button
      ><button v-if="analysis.running" class="button" @click="analysis.cancel()">取消分析</button>
    </div>
    <p class="body-text">
      本次最多分析最新 500 张照片；低信息量或不可用的预览会跳过。不会上传照片、调用云端 AI
      或删除原图。
    </p>
    <div v-if="analysis.running" class="scan-progress" role="status">
      <progress :value="analysis.processed" :max="Math.max(1, analysis.total)"></progress
      ><span>{{ analysis.processed }} / {{ analysis.total }} 张</span>
    </div>
    <p v-if="analysis.error" class="banner" role="status">{{ analysis.error }}</p>
    <p v-if="analysis.completed" class="body-text" role="status">
      本地分析完成：{{ visibleGroups.length }} 组可能相似照片；已处理
      {{ analysis.processed }} 张，跳过 {{ analysis.skipped }} 张。{{
        analysis.limited ? '仅覆盖最新 500 张。' : ''
      }}
    </p>
  </section>
  <section v-for="group in visibleGroups" :key="group.id" class="spaced">
    <div class="library-toolbar">
      <div class="section-title">
        <h2>可能相似 · {{ group.photos.length }} 张</h2>
        <span>与参考图的指纹距离 ≤ {{ group.distance }} / 64</span>
      </div>
      <button
        class="button"
        :disabled="analysis.reviewed.includes(group.id)"
        @click="analysis.keep(group.id)"
      >
        <Check :size="16" />{{
          analysis.reviewed.includes(group.id) ? '已标记保留' : '保留此组（本次会话）'
        }}
      </button>
    </div>
    <PhotoGrid :photos="group.photos" compact />
  </section>
  <div class="cleanup-stats">
    <div>
      <Copy :size="23" /><strong>{{ analysis.completed ? similarCount : candidates.length }}</strong
      ><span>{{
        analysis.completed
          ? '本次可能相似的照片'
          : library.isNative
            ? '等待手动分析'
            : '预设示例相似照片'
      }}</span>
    </div>
    <div>
      <ScanLine :size="23" /><strong>{{
        library.isNative ? library.photos.length : '未开启'
      }}</strong
      ><span>{{ library.isNative ? '本机已索引照片' : '本机照片扫描' }}</span>
    </div>
    <div><ShieldCheck :size="23" /><strong>0 张</strong><span>已删除的原始照片</span></div>
  </div>
  <section v-if="!analysis.completed && !library.isNative" class="spaced">
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
