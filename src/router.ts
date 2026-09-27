import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import SetupView from './views/SetupView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/setup', name: 'setup', component: SetupView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
