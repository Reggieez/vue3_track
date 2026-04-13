import Redis from 'ioredis'

// ==========================================
// 消息队列设计：Redis 为主，本地内存为辅（降级）
// 目的：应对大并发请求，保护数据库
// ==========================================

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    // 如果重试 3 次仍连不上，停止重试，自动降级为内存队列
    if (times > 3) return null
    return Math.min(times * 50, 2000)
  },
})

export let isRedisConnected = false

redis.on('ready', () => {
  isRedisConnected = true
  console.log('[Queue] Redis Connected. Running in High-Concurrency Mode.')
})

redis.on('error', (err) => {
  isRedisConnected = false
  console.warn(`[Queue] Redis Connection Warning: ${err.message}. Fallback to Memory Queue.`)
})

// 内存队列 (当 Redis 连不上时的降级方案)
const memoryQueue: any[] = []

/**
 * 将埋点事件推入队列 (O(1) 复杂度)
 */
export async function pushTrackEvent(data: any) {
  if (isRedisConnected) {
    try {
      await redis.lpush('track:events:queue', JSON.stringify(data))
    }
    catch (e) {
      memoryQueue.unshift(data)
    }
  }
  else {
    memoryQueue.unshift(data)
  }
}

/**
 * 从队列中批量拉取埋点事件
 */
export async function popTrackEvents(batchSize: number = 100): Promise<any[]> {
  const events = []
  
  if (isRedisConnected) {
    try {
      for (let i = 0; i < batchSize; i++) {
        const item = await redis.rpop('track:events:queue')
        if (!item) break
        events.push(JSON.parse(item))
      }
      return events
    }
    catch (e) {
      // 如果出错，临时回退到内存读取
    }
  }
  
  // 内存队列弹出
  for (let i = 0; i < batchSize; i++) {
    const item = memoryQueue.pop()
    if (!item) break
    events.push(item)
  }
  return events
}
