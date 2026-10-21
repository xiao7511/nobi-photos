import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import './style.css'
import { Capacitor } from '@capacitor/core'
if (Capacitor.isNativePlatform()) document.documentElement.classList.add('native-app')
if (Capacitor.getPlatform() === 'ios') document.documentElement.classList.add('ios-app')
if (!Capacitor.isNativePlatform()) {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW())
}
createApp(App).use(createPinia()).use(router).mount('#app')
