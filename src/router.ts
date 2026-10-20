import { createRouter, createWebHashHistory } from 'vue-router'
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: () => import('./views/PhotosView.vue'), meta: { title: '照片' } },
    { path: '/albums', component: () => import('./views/AlbumsView.vue'), meta: { title: '分类' } },
    {
      path: '/search',
      component: () => import('./views/SearchView.vue'),
      meta: { title: 'AI 搜索' },
    },
    {
      path: '/cleanup',
      component: () => import('./views/CleanupView.vue'),
      meta: { title: '清理' },
    },
    {
      path: '/profile',
      component: () => import('./views/ProfileView.vue'),
      meta: { title: '我的' },
    },
    {
      path: '/privacy',
      component: () => import('./views/PrivacyView.vue'),
      meta: { title: '隐私与安全' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
router.afterEach((to) => {
  document.title = `${String(to.meta.title)} · NOBI Photos`
})
