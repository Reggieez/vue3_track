import axios from 'axios'
import { debounce } from 'lodash'

const trackUrl = import.meta.env.VITE_TRACK_URL || '/track'

// 状态管理
let sessionId = ''
let lastTrackUrl = ''
let lastStayTime = 0

/**
 * 生成唯一会话ID
 */
export function generateSessionId() {
  const stored = localStorage.getItem('track_session_id')
  if (stored)
    return stored

  const newId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  localStorage.setItem('track_session_id', newId)
  return newId
}

/**
 * 获取用户ID
 */
function getUserId() {
  return localStorage.getItem('user_id') || ''
}

/**
 * 发送埋点请求
 */
export async function sendTrack(params: any) {
  const data = {
    event_type: params.event_type || 'pv',
    user_id: getUserId(),
    session_id: sessionId,
    page_url: params.page_url,
    page_title: params.page_title,
    referrer: params.referrer || document.referrer,
    stay_duration: params.stay_duration || 0,
    ...(params.custom_data || {}),
  }

  console.log('[Track]', data)

  try {
    // 使用JSONP方式或图片beacon方式，避免跨域问题
    // 这里使用fetch，保证请求完成
    const response = await axios.get(trackUrl, {
      params: data,
      timeout: 5000,
    })

    // 更新session_id
    sessionId = generateSessionId()

    return response.data
  }
  catch (error) {
    console.error('[Track Error]', error)
    // 静默失败，不影响主业务
    return null
  }
}

/**
 * 追踪PV
 */
export async function trackPV(routeInfo: any) {
  // 防止短时间内重复发送相同请求
  const currentUrl = routeInfo.path
  if (currentUrl === lastTrackUrl)
    return

  lastTrackUrl = currentUrl

  return sendTrack({
    event_type: 'pv',
    page_url: routeInfo.path,
    page_title: routeInfo.name,
    referrer: document.referrer,
  })
}

/**
 * 追踪自定义事件
 */
export async function trackEvent(eventName: string, customData?: Record<string, any>) {
  return sendTrack({
    event_type: 'custom',
    custom_data: { event_name: eventName, ...customData },
  })
}

/**
 * 追踪点击事件
 */
export async function trackClick(element: string, customData?: Record<string, any>) {
  return sendTrack({
    event_type: 'click',
    custom_data: { element, ...customData },
  })
}

/**
 * 追踪页面停留
 * 页面可见性变化时调用
 */

export function trackPageLeave(routeInfo: any) {
  if (!sessionId)
    return

  const stayDuration = Math.floor((Date.now() - lastStayTime) / 1000)

  if (stayDuration >= 1) {
    sendTrack({
      event_type: 'stay',
      stay_duration: stayDuration,
      page_url: routeInfo.path,
      page_title: routeInfo.meta.title,
    })
  }
}

/**
 * 初始化埋点
 */
export function initTrack(route: any) {
  sessionId = generateSessionId()
  lastStayTime = Date.now()

  // 页面加载时
  // window.addEventListener('load', () => {
  //   console.log('???1 load')

  //   trackPV(route)
  // })

  // 创建防抖版本的trackPV
  const debouncedTrackPV = debounce(() => {
    trackPV(route)
  }, 500)

  // SPA路由变化时（通过history API）
  // const originalPushState = window.history.pushState
  // const originalReplaceState = window.history.replaceState

  // window.history.pushState = function (...args) {
  //   originalPushState.apply(window.history, args)
  //   // console.log('>>>pushState', args)
  //   debouncedTrackPV()
  // }

  // window.history.replaceState = function (...args) {
  //   originalReplaceState.apply(window.history, args)
  //   // console.log('>>>replaceState', args, window.location.href)
  //   debouncedTrackPV()
  // }

  // // popstate（浏览器前进后退）
  // window.addEventListener('popstate', () => {
  //   // console.log('>>>popstate')
  //   debouncedTrackPV()
  // })

  // 自动追踪页面离开
  // 页面隐藏时（切换标签页、关闭页面等）
  // document.addEventListener('visibilitychange', () => {
  //   if (document.visibilityState === 'hidden') {
  //     trackPageLeave()
  //   }
  //   else {
  //     lastStayTime = Date.now()
  //   }
  // })

  // 页面卸载前
  window.addEventListener('beforeunload', () => {
    trackPageLeave(route)
  })

  console.log('[Track] Initialized, session:', sessionId, 'route:', route)
}
