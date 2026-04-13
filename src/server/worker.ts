import { getDb } from './mongodb/database.ts'
import { popTrackEvents } from './queue.ts'

let isConsuming = false

/**
 * 启动异步消费者进程 (Worker)
 * 不断地从队列（Redis / Memory）中拉取数据，批量写入 MongoDB
 */
export function startTrackConsumer() {
  if (isConsuming) return
  isConsuming = true

  console.log('[Worker] Track events consumer started in background.')

  // 定时器：每隔 3 秒去拉取一次队列并批量写库
  // 这种"微批处理 (Micro-batching)" 极大降低了数据库写入的 I/O 次数
  setInterval(async () => {
    try {
      const db = getDb()
      if (!db) return // 数据库可能还没准备好

      const trackEvents = db.collection('track_events')
      const BATCH_SIZE = 500 // 每次最多写 500 条
      const events = await popTrackEvents(BATCH_SIZE)

      if (events.length > 0) {
        // 恢复时间对象的格式（从 JSON 反序列化后是字符串）
        events.forEach((e: any) => {
          if (e.created_at) e.created_at = new Date(e.created_at)
        })

        // 一次性批量插入
        await trackEvents.insertMany(events)
        console.log(`[Worker] Flushed ${events.length} track events to MongoDB.`)
      }
    }
    catch (error) {
      console.error('[Worker] Consumer error:', error)
    }
  }, 3000)
}
