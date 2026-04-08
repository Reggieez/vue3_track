import dayjs from 'dayjs'
import express from 'express'
import { queryApi, bucket } from './database.ts'

const router = express.Router()

/**
 * 封装执行 Flux 查询的工具函数
 */
async function queryFlux(query: string): Promise<any[]> {
  const rows: any[] = []
  return new Promise((resolve, reject) => {
    queryApi.queryRows(query, {
      next(row, tableMeta) {
        const o = tableMeta.toObject(row)
        rows.push(o)
      },
      error(error) {
        reject(error)
      },
      complete() {
        resolve(rows)
      },
    })
  })
}

/**
 * GET /stats/overview - 获取整体统计概览
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const { start_date, end_date } = req.query

    // Flux 需要 RFC3339 格式的时间戳
    const start = start_date 
      ? dayjs(String(start_date)).toISOString() 
      : dayjs().subtract(7, 'day').startOf('day').toISOString()
    const end = end_date 
      ? dayjs(String(end_date)).endOf('day').toISOString() 
      : dayjs().endOf('day').toISOString()

    // 1. PV 统计
    const pvQuery = `
      from(bucket: "${bucket}")
        |> range(start: ${start}, stop: ${end})
        |> filter(fn: (r) => r._measurement == "track_events" and r.event_type == "pv")
        |> filter(fn: (r) => r._field == "session_id")
        |> count()
    `
    const pvResult = await queryFlux(pvQuery)
    const pvCount = pvResult.reduce((sum, r) => sum + (r._value || 0), 0)

    // 2. UV 统计 (基于 user_id/session_id 的去重，在 Flux 中用 distinct)
    const uvQuery = `
      from(bucket: "${bucket}")
        |> range(start: ${start}, stop: ${end})
        |> filter(fn: (r) => r._measurement == "track_events")
        |> filter(fn: (r) => r._field == "session_id")
        |> distinct()
        |> count()
    `
    const uvResult = await queryFlux(uvQuery)
    const uvCount = uvResult.reduce((sum, r) => sum + (r._value || 0), 0)

    // 3. Stay 统计
    const stayQuery = `
      from(bucket: "${bucket}")
        |> range(start: ${start}, stop: ${end})
        |> filter(fn: (r) => r._measurement == "track_events" and r.event_type == "stay")
        |> filter(fn: (r) => r._field == "stay_duration")
        |> sum()
    `
    const stayResult = await queryFlux(stayQuery)
    const staySum = stayResult.reduce((sum, r) => sum + (r._value || 0), 0)

    res.json({
      success: true,
      data: {
        pv: pvCount,
        uv: uvCount,
        stay: staySum,
      },
    })
  } catch (error) {
    console.error('InfluxDB Overview stats error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

/**
 * GET /stats/pv - 获取PV趋势
 */
router.get('/stats/pv', async (req, res) => {
  try {
    const { start_date, end_date, granularity = 'day' } = req.query

    const start = start_date 
      ? dayjs(String(start_date)).toISOString() 
      : dayjs().subtract(7, 'day').startOf('day').toISOString()
    const end = end_date 
      ? dayjs(String(end_date)).endOf('day').toISOString() 
      : dayjs().endOf('day').toISOString()

    const window = granularity === 'hour' ? '1h' : '1d'

    // aggregateWindow: 按时间窗口聚合统计 PV
    const query = `
      from(bucket: "${bucket}")
        |> range(start: ${start}, stop: ${end})
        |> filter(fn: (r) => r._measurement == "track_events" and r.event_type == "pv")
        |> filter(fn: (r) => r._field == "session_id")
        |> aggregateWindow(every: ${window}, fn: count, createEmpty: true)
        |> yield(name: "pv_trend")
    `
    const results = await queryFlux(query)
    
    // 格式化输出
    const formattedData = results
      .filter(r => r._value !== null)
      .map(r => ({
        date: granularity === 'hour' 
          ? dayjs(r._time).format('YYYY-MM-DD HH:00') 
          : dayjs(r._time).format('YYYY-MM-DD'),
        pv: r._value || 0
      }))

    res.json({
      success: true,
      data: formattedData,
    })
  } catch (error) {
    console.error('InfluxDB PV stats error:', error)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

export default router