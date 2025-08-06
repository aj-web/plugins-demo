import { createRouter, createWebHashHistory } from 'vue-router'
import Layout from '@/views/Layout.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: Layout,
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/views/Home.vue')
        },
        {
          path: '/plugin/:name',
          name: 'plugin',
          component: () => import('@/views/PluginView.vue')
        }
      ]
    }
  ]
})

export default router 