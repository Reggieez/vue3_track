import dayjs from 'dayjs'
import express from 'express'
import { query } from '../database.ts'

const router = express.Router()

// ==================== 统计查询接口 ====================

/**
 * GET /stats/overview - 获取整体统计概览
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const { start_date, end_date, user_id } = req.query

    // 处理默认时间：近一周
    const start = start_date || dayjs().subtract(7, 'day').format('YYYY-MM-DD')
    const end = end_date || dayjs().format('YYYY-MM-DD')

    let whereClause = 'WHERE DATE(created_at) BETWEEN ? AND ?'
    const params: any[] = [start, end]

    // 处理可选的 user_id
    if (user_id) {
      whereClause += ' AND user_id = ?'
      params.push(user_id)
    }

    // 获取PV (event_type = 'pv'的事件数)
    const pvResult: any = await query(
      `SELECT COUNT(*) as total FROM track_events ${whereClause} AND event_type = 'pv'`,
      params,
    )

    // 获取UV (网站用户访问数，每个用户一天访问多次算一次)
    // 逻辑：按天去重 user_id 或 session_id (如果没有user_id)
    const uvResult: any = await query(
      `SELECT COUNT(DISTINCT CONCAT(DATE(created_at), '_', IFNULL(user_id, session_id))) as total 
       FROM track_events ${whereClause}`,
      params,
    )

    // 获取用户总逗留时间 (stay)
    const stayResult: any = await query(
      `SELECT SUM(stay_duration) as total_duration FROM track_events ${whereClause} AND event_type = 'stay'`,
      params,
    )

    res.json({
      success: true,
      data: {
        pv: pvResult[0]?.total || 0,
        uv: uvResult[0]?.total || 0,
        stay: Number(stayResult[0]?.total_duration || 0),
      },
    })
  }
  catch (error) {
    console.error('Overview stats error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

/**
 * GET /stats/pv - 获取PV趋势
 */
router.get('/stats/pv', async (req, res) => {
  try {
    const { start_date, end_date, granularity = 'day' } = req.query

    const start = start_date || dayjs().subtract(7, 'day').format('YYYY-MM-DD')
    const end = end_date || dayjs().format('YYYY-MM-DD')

    let dateFormat = '%Y-%m-%d'
    if (granularity === 'hour') {
      dateFormat = '%Y-%m-%d %H:00'
    }

    const results: any = await query(
      `SELECT 
        DATE_FORMAT(created_at, '${dateFormat}') as date,
        COUNT(*) as pv
       FROM track_events 
       WHERE DATE(created_at) BETWEEN ? AND ?
       GROUP BY date
       ORDER BY date ASC`,
      [start, end],
    )

    res.json({
      success: true,
      data: Array.isArray(results) ? results : [],
    })
  }
  catch (error) {
    console.error('PV stats error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

/**
 * GET /stats/uv - 获取UV趋势
 */
router.get('/stats/uv', async (req, res) => {
  try {
    const { start_date, end_date } = req.query

    const start = start_date || dayjs().subtract(7, 'day').format('YYYY-MM-DD')
    const end = end_date || dayjs().format('YYYY-MM-DD')

    const results: any = await query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(DISTINCT session_id) as uv
       FROM track_events 
       WHERE DATE(created_at) BETWEEN ? AND ?
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [start, end],
    )

    res.json({
      success: true,
      data: Array.isArray(results) ? results : [],
    })
  }
  catch (error) {
    console.error('UV stats error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

/**
 * GET /stats/pages - 获取页面统计
 */
router.get('/stats/pages', async (req, res) => {
  try {
    const { start_date, end_date, limit = 20 } = req.query

    const start = start_date || dayjs().subtract(7, 'day').format('YYYY-MM-DD')
    const end = end_date || dayjs().format('YYYY-MM-DD')
    const limitNum = Number.parseInt(limit as string) || 20

    const results: any = await query(
      `SELECT 
        page_url,
        page_title,
        COUNT(*) as pv,
        COUNT(DISTINCT session_id) as uv,
        AVG(stay_duration) as avg_stay_duration,
        SUM(stay_duration) as total_stay_duration
       FROM track_events 
       WHERE DATE(created_at) BETWEEN ? AND ?
         AND event_type IN ('pv', 'stay')
       GROUP BY page_url, page_title
       ORDER BY pv DESC
       LIMIT ${limitNum}`,
      [start, end],
    )

    const data = Array.isArray(results) ? results : []
    res.json({
      success: true,
      data: data.map((r: any) => ({
        ...r,
        avg_stay_duration: Number.parseFloat(r.avg_stay_duration || 0).toFixed(2),
      })),
    })
  }
  catch (error) {
    console.error('Page stats error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

/**
 * GET /stats/pages/stay - 获取所有页面的停留时间
 */
router.get('/stats/pages/stay', async (req, res) => {
  try {
    const { start_date, end_date, limit } = req.query

    const start = start_date || dayjs().subtract(7, 'day').format('YYYY-MM-DD')
    const end = end_date || dayjs().format('YYYY-MM-DD')

    let limitClause = ''
    if (limit) {
      const limitNum = Number.parseInt(limit as string)
      if (!Number.isNaN(limitNum) && limitNum > 0) {
        limitClause = `LIMIT ${limitNum}`
      }
    }

    const results: any = await query(
      `SELECT 
        page_url,
        page_title,
        SUM(stay_duration) as total_stay_duration
       FROM track_events 
       WHERE DATE(created_at) BETWEEN ? AND ?
         AND event_type = 'stay'
       GROUP BY page_url, page_title
       ORDER BY total_stay_duration DESC
       ${limitClause}`,
      [start, end],
    )

    res.json({
      success: true,
      data: Array.isArray(results) ? results : [],
    })
  }
  catch (error) {
    console.error('Page stay stats error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

/**
 * GET /stats/pages/uv - 获取所有页面的用户访问次数
 */
router.get('/stats/pages/uv', async (req, res) => {
  try {
    const { start_date, end_date, limit } = req.query

    const start = start_date || dayjs().subtract(7, 'day').format('YYYY-MM-DD')
    const end = end_date || dayjs().format('YYYY-MM-DD')

    let limitClause = ''
    if (limit) {
      const limitNum = Number.parseInt(limit as string)
      if (!Number.isNaN(limitNum) && limitNum > 0) {
        limitClause = `LIMIT ${limitNum}`
      }
    }

    const results: any = await query(
      `SELECT 
        page_url,
        page_title,
        COUNT(DISTINCT CONCAT(DATE(created_at), '_', IFNULL(user_id, session_id))) as uv
       FROM track_events 
       WHERE DATE(created_at) BETWEEN ? AND ?
       GROUP BY page_url, page_title
       ORDER BY uv DESC
       ${limitClause}`,
      [start, end],
    )

    res.json({
      success: true,
      data: Array.isArray(results) ? results : [],
    })
  }
  catch (error) {
    console.error('Page uv stats error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

/**
 * GET /stats/referrers - 获取来源统计
 */
router.get('/stats/referrers', async (req, res) => {
  try {
    const { start_date, end_date, limit = 20 } = req.query

    const start = start_date || dayjs().subtract(7, 'day').format('YYYY-MM-DD')
    const end = end_date || dayjs().format('YYYY-MM-DD')
    const limitNum = Number.parseInt(limit as string) || 20

    const results: any = await query(
      `SELECT 
        referrer,
        COUNT(*) as pv,
        COUNT(DISTINCT session_id) as uv
       FROM track_events 
       WHERE DATE(created_at) BETWEEN ? AND ?
         AND referrer IS NOT NULL 
         AND referrer != ''
       GROUP BY referrer
       ORDER BY pv DESC
       LIMIT ${limitNum}`,
      [start, end],
    )

    res.json({
      success: true,
      data: Array.isArray(results) ? results : [],
    })
  }
  catch (error) {
    console.error('Referrer stats error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

/**
 * GET /stats/realtime - 获取实时在线人数
 */
router.get('/stats/realtime', async (req, res) => {
  try {
    const results: any = await query(
      `SELECT COUNT(DISTINCT session_id) as online_users
       FROM track_events 
       WHERE created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
    )

    res.json({
      success: true,
      data: {
        online_users: results[0]?.online_users || 0,
      },
    })
  }
  catch (error) {
    console.error('Realtime stats error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

/**
 * GET /stats/device - 获取设备分布
 */
router.get('/stats/device', async (req, res) => {
  try {
    const { start_date, end_date } = req.query

    const start = start_date || dayjs().subtract(7, 'day').format('YYYY-MM-DD')
    const end = end_date || dayjs().format('YYYY-MM-DD')

    const results: any = await query(
      `SELECT 
        JSON_EXTRACT(device_info, '$.device') as device,
        JSON_EXTRACT(device_info, '$.browser') as browser,
        JSON_EXTRACT(device_info, '$.os') as os,
        COUNT(*) as count
       FROM track_events 
       WHERE DATE(created_at) BETWEEN ? AND ?
       GROUP BY device, browser, os
       ORDER BY count DESC`,
      [start, end],
    )

    res.json({
      success: true,
      data: Array.isArray(results) ? results : [],
    })
  }
  catch (error) {
    console.error('Device stats error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

/**
 * GET /stats/events - 获取事件列表
 */
router.get('/stats/events', async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      event_type,
      page_url,
      user_id,
      page = 1,
      page_size = 50,
    } = req.query

    let whereClause = 'WHERE 1=1'
    const params: any[] = []

    if (start_date && end_date) {
      whereClause += ' AND DATE(created_at) BETWEEN ? AND ?'
      params.push(start_date, end_date)
    }

    if (event_type) {
      whereClause += ' AND event_type = ?'
      params.push(event_type)
    }

    if (page_url) {
      whereClause += ' AND page_url LIKE ?'
      params.push(`%${page_url}%`)
    }

    if (user_id) {
      whereClause += ' AND user_id = ?'
      params.push(user_id)
    }

    // 获取总数
    const countResult: any = await query(
      `SELECT COUNT(*) as total FROM track_events ${whereClause}`,
      params,
    )

    // 获取分页数据
    const offset = (Number.parseInt(page as string) - 1) * (Number.parseInt(page_size as string) || 50)
    const pageSizeNum = Number.parseInt(page_size as string) || 50

    const results: any = await query(
      `SELECT * FROM track_events 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ${offset}, ${pageSizeNum}`,
      params,
    )

    res.json({
      success: true,
      data: {
        list: Array.isArray(results) ? results : [],
        total: countResult[0]?.total || 0,
        page: Number.parseInt(page as string) || 1,
        page_size: pageSizeNum,
      },
    })
  }
  catch (error) {
    console.error('Events stats error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

export default router
