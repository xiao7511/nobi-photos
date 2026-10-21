<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Images,
  LayoutGrid,
  Search,
  Sparkles,
  BrushCleaning,
  UserRound,
  ShieldCheck,
  Sun,
  Moon,
  ArrowUpRight,
  X,
  WifiOff,
  PanelLeftClose,
  ArrowLeft,
} from '@lucide/vue'
import { useLibrary } from './stores/library'
import { usePreferences } from './stores/preferences'
import { useDeviceLibrary } from './stores/deviceLibrary'
import { hasAccess } from './native/contracts'
import { Capacitor, SystemBars, SystemBarsStyle, type PluginListenerHandle } from '@capacitor/core'
import { handleNativeBack } from './native/navigation'
const route = useRoute()
const router = useRouter()
const library = useLibrary()
const preferences = usePreferences()
const device = useDeviceLibrary()
let lifecycle: PluginListenerHandle | undefined
let backButton: PluginListenerHandle | undefined
let disposed = false
let resuming = false
let refreshAgain = false
let appActive = true
async function refreshNative() {
  if (resuming) {
    refreshAgain = true
    return
  }
  if (!appActive || device.requesting || device.scanning) return
  resuming = true
  try {
    await library.load()
    if (device.autoScan && hasAccess(device.access)) await library.scanDevice()
  } finally {
    resuming = false
    if (refreshAgain && appActive) {
      refreshAgain = false
      void refreshNative()
    }
  }
}
const systemDark = ref(false)
const offline = ref(!navigator.onLine)
const dark = computed(
  () => preferences.theme === 'dark' || (preferences.theme === 'system' && systemDark.value),
)
const nav = [
  { path: '/', name: '照片', en: 'Your moments', icon: Images },
  { path: '/albums', name: '分类', en: 'Collections', icon: LayoutGrid },
  { path: '/search', name: 'AI 搜索', en: 'Find a memory', icon: Search },
  { path: '/cleanup', name: '清理', en: 'Make some space', icon: BrushCleaning },
  { path: '/profile', name: '我的', en: 'Your little space', icon: UserRound },
]
const media = window.matchMedia('(prefers-color-scheme: dark)')
const onTheme = () => {
  systemDark.value = media.matches
}
const onNetwork = () => {
  offline.value = !navigator.onLine
}
watch(
  dark,
  (value) => {
    document.documentElement.dataset.theme = value ? 'dark' : 'light'
    if (library.isNative) {
      void SystemBars.setStyle({
        style: value ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
      }).catch(() => {
        /* System appearance must not block the local photo library. */
      })
    }
  },
  { immediate: true },
)
onMounted(() => {
  preferences.initialize()
  onTheme()
  if (library.isNative) {
    void import('@capacitor/app')
      .then(async ({ App }) => {
        lifecycle = await App.addListener('appStateChange', ({ isActive }) => {
          appActive = isActive
          if (isActive) {
            library.activate()
            void refreshNative()
          } else library.suspend()
        })
        if (Capacitor.getPlatform() === 'android') {
          backButton = await App.addListener('backButton', () => {
            void handleNativeBack(router, () => App.minimizeApp())
          })
        }
        if (disposed) {
          await lifecycle.remove()
          await backButton?.remove()
          return
        }
        await refreshNative()
      })
      .catch(() => {
        library.error = '无法监听应用状态，请重新启动应用。'
      })
  } else void library.load()
  media.addEventListener('change', onTheme)
  window.addEventListener('online', onNetwork)
  window.addEventListener('offline', onNetwork)
})
onUnmounted(() => {
  disposed = true
  void lifecycle?.remove()
  void backButton?.remove()
  if (library.isNative) library.suspend()
  media.removeEventListener('change', onTheme)
  window.removeEventListener('online', onNetwork)
  window.removeEventListener('offline', onNetwork)
})
</script>

<template>
  <a class="skip-link" href="#main">跳转到内容</a>
  <aside v-if="!library.isNative" class="sidebar">
    <RouterLink to="/" class="brand" aria-label="NOBI Photos 首页">
      <img src="/favicon.svg" alt="" /><span>NOBI<span class="brand-sub">PHOTOS</span></span>
    </RouterLink>
    <div class="sidebar-caption">让回忆，自在生长。</div>
    <nav aria-label="主导航">
      <RouterLink
        v-for="item in nav"
        :key="item.path"
        :to="item.path"
        :class="[
          'nav-item',
          {
            active:
              route.path === item.path || (item.path === '/profile' && route.path === '/privacy'),
          },
        ]"
      >
        <component :is="item.icon" :size="21" :stroke-width="1.7" /><span
          >{{ item.name }}<small>{{ item.en }}</small></span
        ><span v-if="item.path === '/'" class="nav-count">{{ library.photos.length }}</span>
      </RouterLink>
    </nav>
    <div class="sidebar-bottom">
      <div class="local-card">
        <ShieldCheck :size="24" /><strong>只属于你的回忆</strong>
        <p>照片留在本地<br />安心收藏每一刻</p>
        <RouterLink to="/privacy">了解隐私保护 <ArrowUpRight :size="14" /></RouterLink>
      </div>
      <div class="sidebar-footer">
        <span><i class="status-dot"></i> 本地模式</span><span>PHASE 04</span>
      </div>
    </div>
  </aside>
  <div class="workspace">
    <header v-if="library.isNative" class="native-topbar">
      <div class="native-title">
        <button
          v-if="route.path === '/privacy'"
          class="icon-button"
          aria-label="返回我的"
          @click="router.replace('/profile')"
        >
          <ArrowLeft :size="22" />
        </button>
        <img v-else src="/favicon.svg" alt="" />
        <h1>{{ route.meta.title }}</h1>
      </div>
      <RouterLink
        v-if="route.path !== '/privacy'"
        to="/privacy"
        class="native-local-status"
        aria-label="隐私与安全中心"
      >
        <ShieldCheck :size="15" />仅本机
      </RouterLink>
      <button
        class="icon-button"
        :aria-label="dark ? '切换浅色模式' : '切换深色模式'"
        @click="preferences.setTheme(dark ? 'light' : 'dark')"
      >
        <Sun v-if="dark" :size="21" /><Moon v-else :size="21" />
      </button>
    </header>
    <header v-else class="topbar">
      <div class="breadcrumb">
        <PanelLeftClose :size="18" /><span>我的空间</span><span class="separator">/</span
        ><strong>{{ route.meta.title }}</strong>
      </div>
      <div class="top-actions">
        <span class="local-badge"><ShieldCheck :size="14" /> 本地优先 · 隐私守护</span
        ><button
          class="icon-button"
          :aria-label="dark ? '切换浅色模式' : '切换深色模式'"
          @click="preferences.setTheme(dark ? 'light' : 'dark')"
        >
          <Sun v-if="dark" :size="19" /><Moon v-else :size="19" /></button
        ><RouterLink to="/profile" class="avatar" aria-label="我的空间">N</RouterLink>
      </div>
    </header>
    <main id="main" tabindex="-1">
      <div v-if="offline && !library.isNative" class="banner">
        <WifiOff :size="17" /> 当前离线 · 已缓存的相册功能仍可使用
      </div>
      <div v-if="library.error || preferences.error" class="banner error" role="alert">
        {{ library.error || preferences.error }} <RouterLink to="/privacy">前往隐私中心</RouterLink>
      </div>
      <RouterView />
      <footer v-if="!library.isNative" class="page-footer">
        <span>NOBI PHOTOS</span><span>每一刻，都值得被好好珍藏。</span><ShieldCheck :size="14" />
      </footer>
    </main>
  </div>
  <nav class="mobile-nav" aria-label="移动导航">
    <RouterLink
      v-for="item in nav"
      :key="item.path"
      :to="item.path"
      :class="{
        active: route.path === item.path || (item.path === '/profile' && route.path === '/privacy'),
      }"
    >
      <component :is="item.icon" :size="21" /><span>{{ item.name }}</span>
    </RouterLink>
  </nav>
  <div v-if="library.notice" class="toast" role="status">
    <Sparkles :size="17" /><span>{{ library.notice }}</span
    ><button class="icon-button" aria-label="关闭通知" @click="library.notice = ''">
      <X :size="16" />
    </button>
  </div>
</template>
