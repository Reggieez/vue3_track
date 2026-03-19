import { createPool } from 'mysql2/promise'

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '111111',
  port: Number.parseInt(process.env.DB_PORT || '3306'),
  database: process.env.DB_NAME || 'track_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
}

// 先连接不带数据库
const initPool = createPool({
  ...dbConfig,
  database: undefined,
})

// 创建数据库
export async function ensureDatabase() {
  const conn = await initPool.getConnection()
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    console.log(`✅ 数据库 ${dbConfig.database} 已就绪`)
  }
  finally {
    conn.release()
  }
}

// 创建带数据库的连接池
const pool = createPool(dbConfig)

// 导出连接池
export default pool

// 导出直接使用的连接方法
export async function query(sql: string, params?: any[]) {
  const [rows] = await pool.query(sql, params)
  return rows
}

// 测试连接
export async function testConnection() {
  try {
    const connection = await pool.getConnection()
    console.log('✅ 数据库连接成功')
    connection.release()
    return true
  }
  catch (error) {
    console.error('❌ 数据库连接失败:', error)
    return false
  }
}
