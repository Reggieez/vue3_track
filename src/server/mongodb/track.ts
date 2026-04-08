import dayjs from 'dayjs'
import express from 'express'
import { getDb } from './database.ts'

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
    const db = getDb()

    // 解析 req.body 支持 navigator.sendBeacon
    let bodyData = req.body || {}
    if (typeof req.body === 'string') {
      try {
        const urlParams = new URLSearchParams(req.body)
        bodyData = Object.fromEntries(urlParams.entries())
      }
      catch (e) {}
    }

    const params = req.method === 'POST' ? { ...req.query, ...bodyData } : (req.query || {})

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

    // 1. 处理会话 (session)
    if (event_type === 'pv') {
      const userSessions = db.collection('user_sessions')

      // 使用 upsert，如果不存在就插入，存在就更新
      await userSessions.updateOne(
        { session_id: finalSessionId },
        {
          $setOnInsert: {
            session_id: finalSessionId,
            user_id: user_id || null,
            first_visit_url: page_url,
            created_at: new Date(),
          },
          $inc: { total_pages: 1 },
          $set: { updated_at: new Date() },
        },
        { upsert: true },
      )
    }

    // 2. 插入埋点事件
    const trackEvents = db.collection('track_events')
    await trackEvents.insertOne({
      session_id: finalSessionId,
      user_id: user_id || null,
      event_type: String(event_type),
      page_url: String(page_url),
      page_title: String(page_title),
      referrer: String(referrer),
      stay_duration: Number.parseInt(String(stay_duration)) || 0,
      ip: String(ip),
      user_agent: String(userAgent),
      device_info: deviceInfo,
      sk_date: skDate,
      created_at: new Date(),
    })

    res.json({ success: true, session_id: finalSessionId })
  }
  catch (error) {
    console.error('[MongoDB] Track error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
}

// ==================== 上报接口 ====================
router.get('/track', handleTrackRequest)
router.post('/track', handleTrackRequest)
router.post('/track/event', handleTrackRequest)

// ==================== 统计接口 ====================

/**
 * GET /track/overview - 获取整体统计概览
 */
router.get('/track/overview', async (req, res) => {
  try {
    const db = getDb()
    const { start_date, end_date, user_id } = req.query

    // 构建查询时间范围
    const start = start_date ? dayjs(String(start_date)).startOf('day').toDate() : dayjs().subtract(7, 'day').startOf('day').toDate()
    const end = end_date ? dayjs(String(end_date)).endOf('day').toDate() : dayjs().endOf('day').toDate()

    const matchQuery: any = {
      created_at: { $gte: start, $lte: end },
    }
    if (user_id) {
      matchQuery.user_id = String(user_id)
    }

    const trackEvents = db.collection('track_events')

    // 使用 MongoDB 聚合管道实现概览统计
    const pipeline = [
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          pv: {
            $sum: { $cond: [{ $eq: ['$event_type', 'pv'] }, 1, 0] },
          },
          // UV: 按天和用户合并去重 (如果 user_id 为空则取 session_id)
          uniqueUsers: {
            $addToSet: {
              $concat: [
                { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
                '_',
                { $ifNull: ['$user_id', '$session_id'] },
              ],
            },
          },
          stay: {
            $sum: { $cond: [{ $eq: ['$event_type', 'stay'] }, '$stay_duration', 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          pv: 1,
          uv: { $size: '$uniqueUsers' },
          stay: 1,
        },
      },
    ]

    const results = await trackEvents.aggregate(pipeline).toArray()
    const data = results[0] || { pv: 0, uv: 0, stay: 0 }

    res.json({
      success: true,
      data,
    })
  }
  catch (error) {
    console.error('[MongoDB] Overview track error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

/**
 * GET /track/pv - 获取PV趋势
 */
router.get('/track/pv', async (req, res) => {
  try {
    const db = getDb()
    const { start_date, end_date, granularity = 'day' } = req.query

    const start = start_date ? dayjs(String(start_date)).startOf('day').toDate() : dayjs().subtract(7, 'day').startOf('day').toDate()
    const end = end_date ? dayjs(String(end_date)).endOf('day').toDate() : dayjs().endOf('day').toDate()

    const dateFormat = granularity === 'hour' ? '%Y-%m-%d %H:00' : '%Y-%m-%d'

    const trackEvents = db.collection('track_events')
    const pipeline = [
      {
        $match: {
          created_at: { $gte: start, $lte: end },
          event_type: 'pv',
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$created_at' } },
          pv: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          pv: 1,
        },
      },
      { $sort: { date: 1 as 1 | -1 } },
    ]

    const results = await trackEvents.aggregate(pipeline).toArray()

    res.json({
      success: true,
      data: results,
    })
  }
  catch (error) {
    console.error('[MongoDB] PV track error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

/**
 * GET /track/pages/stay - 获取所有页面的停留时间
 */
router.get('/track/pages/stay', async (req, res) => {
  try {
    const db = getDb()
    const { start_date, end_date, limit } = req.query

    const start = start_date ? dayjs(String(start_date)).startOf('day').toDate() : dayjs().subtract(7, 'day').startOf('day').toDate()
    const end = end_date ? dayjs(String(end_date)).endOf('day').toDate() : dayjs().endOf('day').toDate()

    const trackEvents = db.collection('track_events')
    const pipeline: any[] = [
      {
        $match: {
          created_at: { $gte: start, $lte: end },
          event_type: 'stay',
        },
      },
      {
        $group: {
          _id: { page_url: '$page_url', page_title: '$page_title' },
          total_stay_duration: { $sum: '$stay_duration' },
        },
      },
      {
        $project: {
          _id: 0,
          page_url: '$_id.page_url',
          page_title: '$_id.page_title',
          total_stay_duration: 1,
        },
      },
      { $sort: { total_stay_duration: -1 as 1 | -1 } },
    ]

    if (limit) {
      const limitNum = Number.parseInt(limit as string)
      if (!Number.isNaN(limitNum) && limitNum > 0) {
        pipeline.push({ $limit: limitNum })
      }
    }

    const results = await trackEvents.aggregate(pipeline).toArray()

    res.json({
      success: true,
      data: results,
    })
  }
  catch (error) {
    console.error('[MongoDB] Page stay track error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

/**
 * GET /track/pages/uv - 获取所有页面的用户访问次数
 */
router.get('/track/pages/uv', async (req, res) => {
  try {
    const db = getDb()
    const { start_date, end_date, limit } = req.query

    const start = start_date ? dayjs(String(start_date)).startOf('day').toDate() : dayjs().subtract(7, 'day').startOf('day').toDate()
    const end = end_date ? dayjs(String(end_date)).endOf('day').toDate() : dayjs().endOf('day').toDate()

    const trackEvents = db.collection('track_events')
    const pipeline: any[] = [
      {
        $match: {
          created_at: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { page_url: '$page_url', page_title: '$page_title' },
          uniqueUsers: {
            $addToSet: {
              $concat: [
                { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
                '_',
                { $ifNull: ['$user_id', '$session_id'] },
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          page_url: '$_id.page_url',
          page_title: '$_id.page_title',
          uv: { $size: '$uniqueUsers' },
        },
      },
      { $sort: { uv: -1 as 1 | -1 } },
    ]

    if (limit) {
      const limitNum = Number.parseInt(limit as string)
      if (!Number.isNaN(limitNum) && limitNum > 0) {
        pipeline.push({ $limit: limitNum })
      }
    }

    const results = await trackEvents.aggregate(pipeline).toArray()

    res.json({
      success: true,
      data: results,
    })
  }
  catch (error) {
    console.error('[MongoDB] Page uv track error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

export default router
