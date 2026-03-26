import cors from 'cors'
import express from 'express'
import morgan from 'morgan'
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

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 路由
app.use('/', trackRoutes)
app.use('/', statsRoutes)

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
    // 初始化数据库
    await initDatabase()

    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════╗
║          🎯 埋点服务已启动                        ║
║                                                   ║
║   Local:   http://localhost:${PORT}                  ║
║                                                   ║
║   接口文档:                                       ║
║   - GET  /track          埋点上报 (GET)           ║
║   - POST /track/event    埋点上报 (POST)          ║
║   - POST /track/stay     停留时间上报             ║
║   - POST /track/page-leave 页面离开上报           ║
║   - GET  /stats/overview 统计概览                 ║
║   - GET  /stats/pv       PV趋势                   ║
║   - GET  /stats/uv       UV趋势                   ║
║   - GET  /stats/pages    页面统计                 ║
║   - GET  /stats/realtime 实时在线                 ║
║   - GET  /stats/events   事件列表                 ║
║                                                   ║
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
