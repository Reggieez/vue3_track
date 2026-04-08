import { MongoClient, Db } from 'mongodb'

const url = process.env.MONGODB_URL || 'mongodb://localhost:27017'
const dbName = process.env.MONGODB_DB || 'vue3_track'

export const client = new MongoClient(url)

let dbInstance: Db | null = null

export async function initMongoDB() {
  try {
    await client.connect()
    dbInstance = client.db(dbName)
    console.log('MongoDB connected successfully to server')
    
    // 初始化索引
    await initIndexes(dbInstance)
  } catch (error) {
    console.error('MongoDB connection error:', error)
    throw error
  }
}

export function getDb(): Db {
  if (!dbInstance) {
    throw new Error('MongoDB not initialized. Call initMongoDB first.')
  }
  return dbInstance
}

async function initIndexes(db: Db) {
  const userSessions = db.collection('user_sessions')
  await userSessions.createIndex({ session_id: 1 }, { unique: true })

  const trackEvents = db.collection('track_events')
  // 为了时间范围查询和分组统计优化
  await trackEvents.createIndex({ created_at: -1 })
  await trackEvents.createIndex({ event_type: 1, created_at: -1 })
  await trackEvents.createIndex({ sk_date: -1 })
  
  console.log('MongoDB indexes initialized.')
}
