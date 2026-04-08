import { Point } from '@influxdata/influxdb-client'
import dayjs from 'dayjs'
import express from 'express'
import { writeApi } from './database.ts'

const router = express.Router()

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
    const finalSessionId = (session_id as string) || generateSessionId()

    // 构建 InfluxDB 的数据点 (Point)
    // measurement 类似表名
    const point = new Point('track_events')
      // tag: 用于建立索引的低基数维度
      .tag('event_type', String(event_type))
      .tag('device', deviceInfo.device)
      .tag('browser', deviceInfo.browser)
      .tag('os', deviceInfo.os)
      // field: 实际存储的高基数数据或指标
      .stringField('user_id', user_id ? String(user_id) : 'anonymous')
      .stringField('session_id', finalSessionId)
      .stringField('page_url', String(page_url))
      .stringField('page_title', String(page_title))
      .stringField('referrer', String(referrer))
      .stringField('ip', String(ip))
      .stringField('user_agent', String(userAgent))
      .intField('stay_duration', Number.parseInt(String(stay_duration)) || 0)

    // 写入缓存池，InfluxDB Client 会自动批量发送 (flush)
    writeApi.writePoint(point)

    res.json({ success: true, session_id: finalSessionId })
  }
  catch (error) {
    console.error('[InfluxDB] Track error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
}

router.get('/track', handleTrackRequest)
router.post('/track', handleTrackRequest)
router.post('/track/event', handleTrackRequest)

export default router
