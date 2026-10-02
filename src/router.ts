import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import SetupView from './views/SetupView.vue'
import PlayView from './views/PlayView.vue'
import WordsView from './views/WordsView.vue'
import DataView from './views/DataView.vue'
import AboutView from './views/AboutView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/setup', name: 'setup', component: SetupView },
    { path: '/play', name: 'play', component: PlayView },
    { path: '/words', name: 'words', component: WordsView },
    { path: '/data', name: 'data', component: DataView },
    { path: '/about', name: 'about', component: AboutView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
