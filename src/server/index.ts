import cors from 'cors'
import express from 'express'
import morgan from 'morgan'

// MongoDB 路由和初始化
import { initMongoDB } from './mongodb/database.ts'
import mongoTrackRoutes from './mongodb/track.ts'

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

// 默认路由 (MongoDB 实现，合并了 track 和 track 接口)
app.use('/', mongoTrackRoutes)

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
    // 初始化 MongoDB
    await initMongoDB()

    app.listen(PORT, () => {
      console.log(`🎯 埋点服务已启动 http://localhost:${PORT}`)
    })
  }
  catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
