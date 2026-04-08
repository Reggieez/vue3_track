import cors from 'cors'
import express from 'express'
import morgan from 'morgan'
// ClickHouse 路由和初始化
import { initClickHouse } from './click_house/database.ts'
import chStatsRoutes from './click_house/stats.ts'
import chTrackRoutes from './click_house/track.ts'

// InfluxDB 路由和初始化
import { initInfluxDB } from './influxdb/database.ts'
import influxStatsRoutes from './influxdb/stats.ts'
import influxTrackRoutes from './influxdb/track.ts'

import { initDatabase } from './init.ts'
import statsRoutes from './routes/stats.ts'
import trackRoutes from './routes/track.ts'

const app = express()
const PORT = process.env.PORT || 8899

// 中间件
app.use(cors())
app.use(morgan('combined'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.text()) // 解析 text/plain 类型的 body，这对 navigator.sendBeacon 很重要

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 默认路由 (MySQL 实现)
app.use('/', trackRoutes)
app.use('/', statsRoutes)

// ==========================================
// 可选: 新型时序数据库路由 (加上前缀以区分测试)
// ==========================================
// 测试 ClickHouse: GET /ch/track, GET /ch/stats/overview
app.use('/ch', chTrackRoutes)
app.use('/ch', chStatsRoutes)

// 测试 InfluxDB: GET /influx/track, GET /influx/stats/overview
app.use('/influx', influxTrackRoutes)
app.use('/influx', influxStatsRoutes)

// 404 处理
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' })
})

// 错误处理
app.use((err, req, res, next) => {
  console.error('Server error:', err)
  res.status(500).json({ success: false, error: 'Internal server error' })
})

// 启动服务器
async function startServer() {
  try {
    // 初始化 MySQL 数据库
    await initDatabase()

    // 初始化时序数据库 (仅作为示例，如果没有启动对应服务可能会报错)
    initClickHouse().catch(() => console.warn('ClickHouse not running, skipped.'))
    initInfluxDB().catch(() => console.warn('InfluxDB not running, skipped.'))

    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════╗
║          🎯 埋点服务已启动                        ║
║                                                   ║
║   Local:   http://localhost:${PORT}                  ║
║                                                   ║
║   接口前缀:                                       ║
║   - 默认(MySQL):  /track, /stats/*                ║
║   - ClickHouse:   /ch/track, /ch/stats/*          ║
║   - InfluxDB:     /influx/track, /influx/stats/*  ║
╚═══════════════════════════════════════════════════╝
      `)
    })
  }
  catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
