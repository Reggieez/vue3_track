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

// 本地事件队列 (利用 requestIdleCallback 进行空闲时打点)
const eventQueue: any[] = []
let isProcessingQueue = false

function processQueue() {
  if (eventQueue.length === 0) {
    isProcessingQueue = false
    return
  }

  isProcessingQueue = true
  const data = eventQueue.shift()

  // 方案B：使用 1x1 透明 GIF 上报，不阻塞主线程，没有跨域限制
  const queryString = new URLSearchParams(data as any).toString()
  const urlWithParams = `${trackUrl}?${queryString}`

  const img = new Image()
  img.onload = img.onerror = () => {
    // 当前请求完成后，如果有剩余任务，继续在空闲时处理
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(processQueue)
    }
    else {
      setTimeout(processQueue, 50)
    }
  }
  img.src = urlWithParams
}

/**
 * 发送埋点请求
 */
export async function sendTrack(params: any) {
  // 如果没有 session，直接生成
  if (!sessionId) {
    sessionId = generateSessionId()
  }

  const data = {
    ...params,
    event_type: params.event_type || 'pv',
    user_id: getUserId(),
    session_id: sessionId,
    referrer: params.referrer || document.referrer,
    stay_duration: params.stay_duration || 0,
    ...(params.custom_data || {}),
  }

  console.log('[Track]', data)

  try {
    const { is_leave = false, ...restData } = data

    // 1. 如果是页面离开 (Stay 埋点)，必须使用 navigator.sendBeacon 保证在卸载前发出去
    if (is_leave) {
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(restData)], { type: 'application/json' })
        navigator.sendBeacon(trackUrl, blob)
      }
      else {
        const queryString = new URLSearchParams(restData as any).toString()
        const urlWithParams = `${trackUrl}?${queryString}`
        fetch(urlWithParams, { keepalive: true, method: 'GET' }).catch(() => {})
      }
      return { success: true }
    }

    // 2. 如果是正常的 PV/Click 等埋点，使用 Image 和 requestIdleCallback 降级处理
    eventQueue.push(restData)

    if (!isProcessingQueue) {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(processQueue)
      }
      else {
        setTimeout(processQueue, 50)
      }
    }

    return { success: true, session_id: sessionId }
  }
  catch (error) {
    console.error('[Track] Error:', error)
    return { success: false }
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
  const stayDuration = Math.floor((Date.now() - lastStayTime) / 1000)

  if (stayDuration >= 1) {
    sendTrack({
      event_type: 'stay',
      stay_duration: stayDuration,
      page_url: routeInfo.path,
      page_title: routeInfo.meta.title,
      is_leave: true, // 标记为离开事件，使用 beacon
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
  // 推荐使用 visibilitychange 和 pagehide 替代 beforeunload，以保证移动端和现代浏览器的兼容性
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      trackPageLeave(route)
    }
    else {
      // 页面重新可见时，重置计时器
      lastStayTime = Date.now()
    }
  })

  // 为了更好的兼容性（尤其是 Safari），添加 pagehide
  window.addEventListener('pagehide', () => {
    trackPageLeave(route)
  })

  // 页面卸载前（作为后备，但不推荐仅依赖此事件）
  // window.addEventListener('beforeunload', () => {
  //   trackPageLeave(route)
  // })

  console.log('[Track] Initialized, session:', sessionId, 'route:', route)
}
