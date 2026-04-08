import dayjs from 'dayjs'
import express from 'express'
import { chClient } from './database.ts'

const router = express.Router()

// 封装 CH 查询返回数据，因为 @clickhouse/client 返回的 JSON 包含 { data: [...] }
async function queryCH(queryStr: string, queryParams: Record<string, any> = {}) {
  const result = await chClient.query({
    query: queryStr,
    format: 'JSONEachRow',
    query_params: queryParams,
  })
  return result.json() // returns array of rows
}

/**
 * GET /stats/overview - 获取整体统计概览
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const { start_date, end_date, user_id } = req.query

    const start = start_date ? String(start_date) : dayjs().subtract(7, 'day').format('YYYY-MM-DD')
    const end = end_date ? String(end_date) : dayjs().format('YYYY-MM-DD')

    let whereClause = 'toDate(created_at) BETWEEN {start:String} AND {end:String}'
    const params: Record<string, any> = { start, end }

    if (user_id) {
      whereClause += ' AND user_id = {user_id:String}'
      params.user_id = String(user_id)
    }

    // 在 ClickHouse 中，聚合统计只需一条大 SQL 即可完成
    const query = `
      SELECT
        countIf(event_type = 'pv') AS pv,
        uniqExact(if(user_id != '', user_id, session_id)) AS uv,
        uniqExact(session_id) AS sessions,
        sumIf(stay_duration, event_type = 'stay') AS stay
      FROM track_events
      WHERE ${whereClause}
    `
    const results: any = await queryCH(query, params)

    res.json({
      success: true,
      data: {
        pv: Number(results[0]?.pv || 0),
        uv: Number(results[0]?.uv || 0),
        sessions: Number(results[0]?.sessions || 0),
        stay: Number(results[0]?.stay || 0),
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

    const start = start_date ? String(start_date) : dayjs().subtract(7, 'day').format('YYYY-MM-DD')
    const end = end_date ? String(end_date) : dayjs().format('YYYY-MM-DD')

    let dateExpr = 'toDate(created_at)' // 按天
    if (granularity === 'hour') {
      dateExpr = 'toStartOfHour(created_at)' // 按小时
    }

    const query = `
      SELECT 
        toString(${dateExpr}) as date,
        count() as pv
      FROM track_events 
      WHERE toDate(created_at) BETWEEN {start:String} AND {end:String}
        AND event_type = 'pv'
      GROUP BY date
      ORDER BY date ASC
    `
    const results = await queryCH(query, { start, end })

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

    const start = start_date ? String(start_date) : dayjs().subtract(7, 'day').format('YYYY-MM-DD')
    const end = end_date ? String(end_date) : dayjs().format('YYYY-MM-DD')

    const query = `
      SELECT 
        toString(toDate(created_at)) as date,
        uniqExact(session_id) as uv
      FROM track_events 
      WHERE toDate(created_at) BETWEEN {start:String} AND {end:String}
      GROUP BY date
      ORDER BY date ASC
    `
    const results = await queryCH(query, { start, end })

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

export default router
