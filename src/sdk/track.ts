import axios from 'axios'
import dayjs from 'dayjs'

// 配置
const CONFIG = {
  trackUrl: import.meta.env.VITE_TRACK_URL || '/track',
  apiUrl: import.meta.env.VITE_API_URL || '',
  // 是否自动追踪PV
  autoTrackPV: true,
  // 是否自动追踪页面离开
  autoTrackLeave: true,
  // 页面停留最小上报时间（毫秒），避免频繁上报
  minStayTime: 5000,
  // 调试模式
  debug: import.meta.env.DEV || false,
}

// 状态管理
let sessionId = ''
let userId = ''
let currentPage = ''
let pageTitle = ''
let lastStayTime = 0

/**
 * 生成唯一会话ID
 */
function generateSessionId() {
  const stored = localStorage.getItem('track_session_id')
  if (stored) return stored
  
  const newId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  localStorage.setItem('track_session_id', newId)
  return newId
}

/**
 * 获取用户ID
 */
function getUserId() {
  if (userId) return userId
  
  userId = localStorage.getItem('user_id')
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    localStorage.setItem('user_id', userId)
  }
  return userId
}

/**
 * 解析URL（去除敏感参数）
 */
function parseUrl(url) {
  try {
    const urlObj = new URL(url)
    // 去除hash和查询参数中的敏感信息
    const cleanPath = urlObj.pathname + urlObj.search
    return cleanPath
  } catch {
    return url
  }
}

/**
 * 发送埋点请求
 */
async function sendTrack(params) {
  const data = {
    event_type: params.event_type || 'pv',
    user_id: getUserId(),
    session_id: sessionId,
    page_url: params.page_url || currentPage,
    page_title: params.page_title || pageTitle,
    referrer: params.referrer || document.referrer,
    stay_duration: params.stay_duration || 0,
    ...params.custom_data,
  }

  if (CONFIG.debug) {
    console.log('[Track]', data)
  }

  try {
    // 使用JSONP方式或图片beacon方式，避免跨域问题
    // 这里使用fetch，保证请求完成
    const response = await axios.get(CONFIG.trackUrl, {
      params: data,
      timeout: 5000,
    })
    
    // 如果返回了新的session_id，更新
    if (response.data?.session_id) {
      sessionId = response.data.session_id
      localStorage.setItem('track_session_id', sessionId)
    }
    
    return response.data
  } catch (error) {
    if (CONFIG.debug) {
      console.error('[Track Error]', error)
    }
    // 静默失败，不影响主业务
    return null
  }
}

/**
 * 追踪PV
 */
export async function trackPV(pageUrl?: string, title?: string) {
  currentPage = parseUrl(pageUrl || window.location.href)
  pageTitle = title || document.title
  sessionId = generateSessionId()
  
  return sendTrack({
    event_type: 'pv',
    page_url: currentPage,
    page_title: pageTitle,
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
let leaveTimer: ReturnType<typeof setTimeout> | null = null

export function trackPageLeave() {
  if (!sessionId || !currentPage) return
  
  const stayDuration = Math.floor((Date.now() - lastStayTime) / 1000)
  
  if (stayDuration >= 1) {
    sendTrack({
      event_type: 'stay',
      stay_duration: stayDuration,
    })
  }
}

/**
 * 初始化埋点
 */
export function initTrack(options?: {
  autoTrackPV?: boolean
  autoTrackLeave?: boolean
  userId?: string
  debug?: boolean
}) {
  if (options) {
    Object.assign(CONFIG, options)
  }
  
  sessionId = generateSessionId()
  lastStayTime = Date.now()

  // 自动追踪PV
  if (CONFIG.autoTrackPV) {
    // 页面加载时
    window.addEventListener('load', () => {
      trackPV()
    })

    // SPA路由变化时（通过history API）
    const originalPushState = window.history.pushState
    const originalReplaceState = window.history.replaceState

    window.history.pushState = function(...args) {
      originalPushState.apply(window.history, args)
      trackPV()
    }

    window.history.replaceState = function(...args) {
      originalReplaceState.apply(window.history, args)
      trackPV()
    }

    // popstate（浏览器前进后退）
    window.addEventListener('popstate', () => {
      trackPV()
    })
  }

  // 自动追踪页面离开
  if (CONFIG.autoTrackLeave) {
    // 页面隐藏时（切换标签页、关闭页面等）
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        trackPageLeave()
      } else {
        lastStayTime = Date.now()
      }
    })

    // 页面卸载前
    window.addEventListener('beforeunload', () => {
      trackPageLeave()
    })
  }

  if (CONFIG.debug) {
    console.log('[Track] Initialized, session:', sessionId)
  }

  return {
    trackPV,
    trackEvent,
    trackClick,
    trackPageLeave,
    getSessionId: () => sessionId,
    getUserId,
  }
}

/**
 * 直接使用axios发送请求（用于更复杂的场景）
 */
export const trackAxios = axios.create({
  baseURL: CONFIG.trackUrl,
  timeout: 5000,
})

export default {
  init: initTrack,
  trackPV,
  trackEvent,
  trackClick,
  trackPageLeave,
  getSessionId: () => sessionId,
  getUserId,
}
