import dayjs from 'dayjs'
import express from 'express'
import { chClient } from './database.ts'

const router = express.Router()

// 简单的批处理缓冲队列 (ClickHouse 更适合批量写入而不是高频单条写入)
const eventBuffer: any[] = []
const MAX_BUFFER_SIZE = 100
const FLUSH_INTERVAL = 3000 // 3秒批量刷新一次

// 定时刷入
setInterval(flushEvents, FLUSH_INTERVAL)

async function flushEvents() {
  if (eventBuffer.length === 0)
    return
  const batch = [...eventBuffer]
  eventBuffer.length = 0

  try {
    await chClient.insert({
      table: 'track_events',
      // values 是 JSONEachRow 格式的数组对象
      values: batch,
      format: 'JSONEachRow',
    })
    console.log(`[ClickHouse] 批量写入 ${batch.length} 条埋点数据成功`)
  }
  catch (error) {
    console.error('[ClickHouse] 批量写入失败:', error)
    // 简单起见不处理失败重试了，真实生产中应写入本地日志或 Kafka
  }
}

function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

function getClientIp(req: express.Request) {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || (req.headers['x-real-ip'] as string)
    || (req.socket?.remoteAddress as string)
    || 'unknown'
}

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

async function handleTrackRequest(req: express.Request, res: express.Response) {
  try {
    let bodyData = req.body || {}
    if (typeof req.body === 'string') {
      try {
        const urlParams = new URLSearchParams(req.body)
        bodyData = Object.fromEntries(urlParams.entries())
      }
      catch (e) {}
    }

    const params = req.method === 'POST' ? { ...req.query, ...bodyData } : req.query

    const {
      event_type = 'pv',
      user_id = '',
      session_id = '',
      page_url = '',
      page_title = '',
      referrer = '',
      stay_duration = 0,
    } = params

    const ip = getClientIp(req)
    const userAgent = req.headers['user-agent'] || ''
    const deviceInfo = parseDeviceInfo(userAgent as string)
    const skDate = Number.parseInt(dayjs().format('YYYYMMDD'))
    const finalSessionId = (session_id as string) || generateSessionId()

    // 组装要写入 ClickHouse 的事件
    const event = {
      event_type: String(event_type),
      user_id: user_id ? String(user_id) : '',
      session_id: finalSessionId,
      page_url: String(page_url),
      page_title: String(page_title),
      referrer: String(referrer),
      stay_duration: Number.parseInt(String(stay_duration)) || 0,
      ip: String(ip),
      user_agent: String(userAgent),
      device_info: JSON.stringify(deviceInfo),
      sk_date: skDate,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'), // ClickHouse DateTime
    }

    // 放入缓冲队列
    eventBuffer.push(event)

    // 满了就直接冲刷
    if (eventBuffer.length >= MAX_BUFFER_SIZE) {
      flushEvents()
    }

    res.json({ success: true, session_id: finalSessionId })
  }
  catch (error) {
    console.error('[ClickHouse] Track error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
}

router.get('/track', handleTrackRequest)
router.post('/track', handleTrackRequest)
router.post('/track/event', handleTrackRequest)

export default router
