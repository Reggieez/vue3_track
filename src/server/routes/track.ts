import dayjs from 'dayjs'
import express from 'express'
import { query } from '../database.ts'

const router = express.Router()

/**
 * 生成唯一会话ID
 */
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

/**
 * 获取客户端IP
 */
function getClientIp(req: express.Request) {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || (req.headers['x-real-ip'] as string)
    || (req.socket?.remoteAddress as string)
    || 'unknown'
}

/**
 * 解析设备信息
 */
function parseDeviceInfo(userAgent: string) {
  const info = {
    browser: 'unknown',
    os: 'unknown',
    device: 'desktop',
    isMobile: false,
    isBot: false,
  }

  if (!userAgent)
    return info

  if (/Windows NT 10/.test(userAgent))
    info.os = 'Windows 10'
  else if (/Windows/.test(userAgent))
    info.os = 'Windows'
  else if (/Mac OS X/.test(userAgent))
    info.os = 'macOS'
  else if (/Linux/.test(userAgent))
    info.os = 'Linux'
  else if (/Android/.test(userAgent))
    info.os = 'Android'
  else if (/iOS|iPhone|iPad/.test(userAgent))
    info.os = 'iOS'

  if (/Chrome\/\d+/.test(userAgent) && !/Edg/.test(userAgent))
    info.browser = 'Chrome'
  else if (/Firefox\/\d+/.test(userAgent))
    info.browser = 'Firefox'
  else if (/Safari\/\d+/.test(userAgent) && !/Chrome/.test(userAgent))
    info.browser = 'Safari'
  else if (/Edg\/\d+/.test(userAgent))
    info.browser = 'Edge'

  info.isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent)
  info.device = info.isMobile ? 'mobile' : 'desktop'
  info.isBot = /Bot|Spider|Crawler/.test(userAgent)

  return info
}

// ==================== 埋点接口 ====================

/**
 * GET /track - 埋点上报接口
 */
router.get('/track', async (req, res) => {
  try {
    const {
      event_type = 'pv',
      user_id = '',
      session_id = '',
      page_url = '',
      page_title = '',
      referrer = '',
      stay_duration = 0,
    } = req.query

    const ip = getClientIp(req)
    const userAgent = req.headers['user-agent'] || ''
    const deviceInfo = parseDeviceInfo(userAgent as string)
    const skDate = Number.parseInt(dayjs().format('YYYYMMDD'))
    const finalSessionId = (session_id as string) || generateSessionId()

    if (event_type === 'pv') {
      const existing: any = await query(
        'SELECT id FROM user_sessions WHERE session_id = ?',
        [finalSessionId],
      )

      if (!existing || existing.length === 0) {
        await query(
          `INSERT INTO user_sessions (session_id, user_id, first_visit_url, total_pages) 
           VALUES (?, ?, ?, 1)`,
          [finalSessionId, user_id || null, page_url],
        )
      }
      else {
        await query(
          `UPDATE user_sessions 
           SET total_pages = total_pages + 1, 
               last_active_time = NOW() 
           WHERE session_id = ?`,
          [finalSessionId],
        )
      }
    }

    await query(
      `INSERT INTO track_events 
       (event_type, user_id, session_id, page_url, page_title, referrer, 
        stay_duration, device_info, user_agent, ip_address, sk_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event_type as string,
        user_id || null,
        finalSessionId,
        page_url as string,
        page_title as string,
        referrer as string,
        Number.parseInt(stay_duration as string) || 0,
        JSON.stringify(deviceInfo),
        userAgent,
        ip,
        skDate,
      ],
    )

    res.json({
      success: true,
      session_id: finalSessionId,
    })
  }
  catch (error) {
    console.error('Track error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

/**
 * POST /track/event - 埋点上报接口（POST方式）
 */
router.post('/track/event', async (req, res) => {
  try {
    const {
      event_type = 'custom',
      user_id = '',
      session_id = '',
      page_url = '',
      page_title = '',
      referrer = '',
      stay_duration = 0,
    } = req.body

    const ip = getClientIp(req)
    const userAgent = req.headers['user-agent'] || ''
    const deviceInfo = parseDeviceInfo(userAgent as string)
    const skDate = Number.parseInt(dayjs().format('YYYYMMDD'))
    const finalSessionId = (session_id as string) || generateSessionId()

    await query(
      `INSERT INTO track_events 
       (event_type, user_id, session_id, page_url, page_title, referrer, 
        stay_duration, device_info, user_agent, ip_address, sk_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event_type as string,
        user_id || null,
        finalSessionId,
        page_url as string,
        page_title as string,
        referrer as string,
        Number.parseInt(stay_duration as string) || 0,
        JSON.stringify(deviceInfo),
        userAgent,
        ip,
        skDate,
      ],
    )

    res.json({
      success: true,
      session_id: finalSessionId,
    })
  }
  catch (error) {
    console.error('Track error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

/**
 * POST /track/stay - 页面停留时间上报
 */
router.post('/track/stay', async (req, res) => {
  try {
    const { session_id, page_url, stay_duration } = req.body

    if (!session_id || !page_url) {
      return res.status(400).json({
        success: false,
        error: 'session_id and page_url are required',
      })
    }

    await query(
      `UPDATE user_sessions 
       SET total_stay_duration = total_stay_duration + ? 
       WHERE session_id = ?`,
      [Number.parseInt(stay_duration) || 0, session_id],
    )

    res.json({ success: true })
  }
  catch (error) {
    console.error('Stay track error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

/**
 * POST /track/page-leave - 页面离开时上报停留时间
 */
router.post('/track/page-leave', async (req, res) => {
  try {
    const { session_id, page_url, stay_duration, is_last_page = false } = req.body

    if (!session_id || !page_url) {
      return res.status(400).json({
        success: false,
        error: 'session_id and page_url are required',
      })
    }

    const duration = Number.parseInt(stay_duration) || 0

    await query(
      `INSERT INTO track_events 
       (event_type, user_id, session_id, page_url, stay_duration, sk_date) 
       VALUES ('stay', NULL, ?, ?, ?, ?)`,
      [session_id, page_url, duration, Number.parseInt(dayjs().format('YYYYMMDD'))],
    )

    const isBounce = duration < 10 && is_last_page
    await query(
      `UPDATE user_sessions 
       SET total_stay_duration = total_stay_duration + ?,
           is_bounce = ? 
       WHERE session_id = ?`,
      [duration, isBounce ? 1 : 0, session_id],
    )

    res.json({ success: true })
  }
  catch (error) {
    console.error('Page leave error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

export default router
