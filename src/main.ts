import { createApp } from 'vue'
import '@fontsource/baloo-bhaijaan-2/latin-500.css'
import '@fontsource/baloo-bhaijaan-2/latin-700.css'
import '@fontsource/baloo-bhaijaan-2/latin-800.css'
import '@fontsource/baloo-bhaijaan-2/arabic-500.css'
import '@fontsource/baloo-bhaijaan-2/arabic-700.css'
import '@fontsource/baloo-bhaijaan-2/arabic-800.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/animations.css'
import App from './App.vue'
import { router } from './router'

createApp(App).use(router).mount('#app')
