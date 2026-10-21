<script setup lang="ts">
import {
  ShieldCheck,
  ChevronRight,
  Monitor,
  Moon,
  Sun,
  Heart,
  Images,
  HardDrive,
} from '@lucide/vue'
import { useLibrary } from '../stores/library'
import { usePreferences } from '../stores/preferences'
import type { Theme } from '../domain/models'
const library = useLibrary()
const preferences = usePreferences()
const themes: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
]
</script>
<template>
  <section v-if="!library.isNative" class="page-heading">
    <div>
      <span class="eyebrow">MAKE YOURSELF AT HOME</span>
      <h1>你的回忆，你的空间<span class="title-dot">.</span></h1>
      <p>不必注册，生活本就值得被记录。</p>
    </div>
  </section>
  <section class="profile-card">
    <div class="large-avatar">N</div>
    <div>
      <span class="eyebrow">HELLO, MOMENT COLLECTOR</span>
      <h2>本地生活记录者</h2>
      <p>离线也自在 · 无需账号</p>
    </div>
    <ShieldCheck :size="28" />
  </section>
  <div class="profile-stats">
    <div>
      <Images :size="21" /><strong>{{ library.photos.length }}</strong
      ><span>{{ library.isNative ? '本机照片' : '示例照片' }}</span>
    </div>
    <div>
      <Heart :size="21" /><strong>{{ library.favorites.length }}</strong
      ><span>我的收藏</span>
    </div>
    <div><HardDrive :size="21" /><strong>本地</strong><span>数据存储</span></div>
  </div>
  <section class="settings-card">
    <div class="setting-heading">
      <h2>让这里更像你</h2>
      <p>选择舒服的相册外观</p>
    </div>
    <div class="theme-options">
      <button
        v-for="theme in themes"
        :key="theme.value"
        :class="{ selected: preferences.theme === theme.value }"
        :aria-pressed="preferences.theme === theme.value"
        @click="preferences.setTheme(theme.value)"
      >
        <component :is="theme.icon" :size="25" /><strong>{{ theme.label }}</strong>
      </button>
    </div>
  </section>
  <RouterLink to="/privacy" class="settings-link">
    <span class="setting-icon"><ShieldCheck :size="25" /></span
    ><span><strong>隐私与安全中心</strong><small>查看权限、数据边界与本地存储</small></span
    ><ChevronRight :size="20" />
  </RouterLink>
  <div class="about-note">
    <img src="/favicon.svg" alt="" /><strong>NOBI Photos</strong>
    <p>照片留在本地，回忆自在生长。</p>
    <span>v0.5.0 · {{ library.isNative ? 'Android / iOS 本地应用' : '浏览器示例预览' }}</span>
  </div>
</template>
