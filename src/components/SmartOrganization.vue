<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { Sparkles, ShieldCheck } from '@lucide/vue'
import { useLibrary } from '../stores/library'
import { useSmartOrganization } from '../stores/smartOrganization'
const library = useLibrary()
const smart = useSmartOrganization()
const chosen = ref<string[]>([]),
  savingError = ref('')
const confirmation = ref<HTMLDialogElement>()
const selected = computed(() => smart.suggestions.filter((s) => chosen.value.includes(s.key)))
watch(
  () => smart.suggestions,
  () => {
    chosen.value = []
    confirmation.value?.close()
  },
)
async function save() {
  savingError.value = ''
  try {
    await library.saveSmartAlbums(selected.value)
    confirmation.value?.close()
  } catch (e) {
    savingError.value = e instanceof Error ? e.message : '相册未保存，请重试'
  }
}
onUnmounted(() => {
  smart.reset()
  confirmation.value?.close()
})
</script>
<template>
  <section class="smart-organizer" aria-label="AI 智能整理相册">
    <div class="smart-intro">
      <span class="smart-emblem"><Sparkles :size="24" /></span>
      <div>
        <h2>AI 智能整理</h2>
        <p>
          {{
            library.isNative
              ? '离线识别照片内容，生成可审核的分类相册建议。'
              : '浏览器演示整理流程；使用预设示例分类，不执行图像模型。'
          }}
        </p>
      </div>
    </div>
    <p class="body-text">
      支持自然、动物、美食、建筑、出行和文档主题。只读取本地预览，识别可能有误；分析结果仅留在本次内存中，勾选并确认后才保存相册关系。
    </p>
    <div class="data-actions">
      <button
        class="button primary"
        :disabled="smart.running || library.loading || library.busy || !library.photos.length"
        @click="smart.analyze(library.photos)"
      >
        <Sparkles :size="16" />{{
          smart.running ? '正在本地识别…' : library.isNative ? '开始智能整理' : '体验示例整理'
        }}
      </button>
      <button v-if="smart.running" class="button" @click="smart.cancel()">取消识别</button>
      <button v-if="smart.completed" class="button" @click="smart.reset()">丢弃本次建议</button>
    </div>
    <div v-if="smart.running" class="scan-progress" role="status">
      <progress :value="smart.processed" :max="Math.max(1, smart.total)"></progress
      ><span>{{ smart.processed }} / {{ smart.total }} 张</span>
    </div>
    <p v-if="smart.error" class="banner" role="status">{{ smart.error }}</p>
    <template v-if="smart.completed">
      <p class="body-text" role="status">
        {{ library.isNative ? '本地 AI 分析完成' : '示例整理完成' }}：{{
          smart.suggestions.length
        }}
        个建议相册；{{ smart.unmatched }} 张未获得可靠分类，{{ smart.skipped }} 张预览不可用。{{
          smart.limited ? '本次仅分析最新 500 张。' : ''
        }}
      </p>
      <div class="smart-suggestions">
        <label v-for="item in smart.suggestions" :key="item.key" class="smart-suggestion"
          ><input v-model="chosen" type="checkbox" :value="item.key" /><span
            ><strong>{{ item.name }}</strong
            ><small
              >{{ item.photoIds.length }} 张 ·
              {{
                library.isNative ? `最低模型评分 ${Math.round(item.confidence * 100)}%` : '预设示例'
              }}</small
            ></span
          ></label
        >
      </div>
      <button
        v-if="smart.suggestions.length"
        class="button primary"
        :disabled="!selected.length || library.busy"
        @click="confirmation?.showModal()"
      >
        预览保存 {{ selected.length }} 个相册
      </button>
      <p v-else class="fine-print">没有足够可靠的建议。不会强行为照片分类，可继续使用手动相册。</p>
    </template>
    <p class="smart-privacy"><ShieldCheck :size="14" /> 不上传 · 不改动原图 · 不做人脸身份识别</p>
    <dialog ref="confirmation" class="confirm-dialog" aria-labelledby="smart-save-title">
      <h2 id="smart-save-title">保存智能建议相册？</h2>
      <p>
        将创建或合并以下
        {{
          selected.length
        }}
        个本地相册。保留已有成员和相册改名，不替换手动标签，不修改或删除系统照片。
      </p>
      <ul>
        <li v-for="item in selected" :key="item.key">
          智能 · {{ item.name }}：{{ item.photoIds.length }} 张
        </li>
      </ul>
      <p v-if="savingError" class="banner error" role="alert">{{ savingError }}</p>
      <div class="data-actions">
        <button class="button" :disabled="library.busy" @click="confirmation?.close()">
          暂不保存</button
        ><button class="button primary" :disabled="library.busy || !selected.length" @click="save">
          确认保存相册
        </button>
      </div>
    </dialog>
  </section>
</template>
