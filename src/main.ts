import { createApp } from 'vue'
import { initializeDarkMode } from '@/utils/dark-mode'
import App from './App.vue'
import router from './router'
import { store } from './store'
// normalize.css
import 'normalize.css/normalize.css'
// 全局样式
import './styles/index.less'
// tailwindcss
import './styles/tailwind.css'
// 埋点SDK
import { initTrack } from './sdk/track'

// 初始化埋点
initTrack({
  autoTrackPV: true,
  autoTrackLeave: true,
  debug: import.meta.env.DEV,
})

initializeDarkMode()

const app = createApp(App)
app.use(store)
app.use(router)

app.mount('#app')
