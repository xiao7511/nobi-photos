<script setup lang="ts">
import { computed } from 'vue'
import { Images } from '@lucide/vue'
import type { Photo } from '../domain/models'
import PhotoThumbnail from './PhotoThumbnail.vue'
const props = defineProps<{ photos: Photo[] }>()
const cards = computed(() => props.photos.slice(0, 5))
</script>
<template>
  <span class="album-fan-cover" aria-hidden="true">
    <span v-if="!cards.length" class="album-cover-empty"><Images :size="32" /></span>
    <span
      v-for="(photo, index) in cards"
      :key="photo.id"
      class="album-cover-leaf"
      :style="{
        '--angle': `${(index - (cards.length - 1) / 2) * 10}deg`,
        '--lift': `${Math.abs(index - (cards.length - 1) / 2) * 5}px`,
        zIndex: 5 - Math.round(Math.abs(index - (cards.length - 1) / 2)),
      }"
      ><PhotoThumbnail :photo="photo"
    /></span>
  </span>
</template>
