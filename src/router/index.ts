import {
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router'
import { useCachedViewStore } from '@/store/modules/cached-view'
import NProgress from '@/utils/progress'
import setPageTitle from '@/utils/set-page-title'
import { sendTrack } from '../sdk/track'
import routes from './routes'

const router = createRouter({
  history: createWebHistory(),
  routes,
})

let enterTime = Date.now()

router.beforeEach((to, from, next) => {
  NProgress.start()
  // 路由缓存
  useCachedViewStore().addCachedView(to)
  // 页面 title
  setPageTitle(to.meta.title)
  next()
})

router.afterEach((to, from) => {
  NProgress.done()

  console.log('****router.afterEach', to.name, from.name, enterTime)

  if (from.name && enterTime) {
    const stayTime = Math.floor((Date.now() - enterTime) / 1000)

    if (stayTime >= 1) {
      sendTrack({
        event_type: 'stay',
        stay_duration: stayTime,
        page_url: from.path,
        page_title: from.meta.title,
      })
      enterTime = Date.now()
    }
  }

  sendTrack({
    event_type: 'pv',
    page_url: to.path,
    page_title: to.meta.title,
  })
})

export default router
