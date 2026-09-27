import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import SetupView from './views/SetupView.vue'
import PlayView from './views/PlayView.vue'
import WordsView from './views/WordsView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/setup', name: 'setup', component: SetupView },
    { path: '/play', name: 'play', component: PlayView },
    { path: '/words', name: 'words', component: WordsView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
