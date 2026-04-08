import { createClient } from '@clickhouse/client'

// ClickHouse 客户端配置
export const chClient = createClient({
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: process.env.CLICKHOUSE_DB || 'default',
})

// 初始化建表
export async function initClickHouse() {
  try {
    // 创建本地表 (为了简化，这里直接建一张大宽表存埋点，ClickHouse 极度适合大宽表查询)
    await chClient.exec({
      query: `
        CREATE TABLE IF NOT EXISTS track_events (
          id UUID DEFAULT generateUUIDv4(),
          event_type String,
          user_id String,
          session_id String,
          page_url String,
          page_title String,
          referrer String,
          stay_duration Int32,
          ip String,
          user_agent String,
          device_info String,
          sk_date UInt32,
          created_at DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(created_at)
        ORDER BY (event_type, sk_date, session_id)
      `
    })
    console.log('ClickHouse: track_events table initialized.')
  } catch (error) {
    console.error('ClickHouse initialization error:', error)
  }
}
