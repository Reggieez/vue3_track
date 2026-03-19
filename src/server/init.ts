import { ensureDatabase, query, testConnection } from './database.ts'

/**
 * 初始化数据库表
 */
export async function initDatabase() {
  // 先确保数据库存在
  await ensureDatabase()

  // 测试数据库连接
  const connected = await testConnection()
  if (!connected) {
    throw new Error('数据库连接失败，请检查配置')
  }

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS track_events (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL COMMENT '事件类型: pv, uv, stay, click, custom',
        user_id VARCHAR(128) DEFAULT NULL COMMENT '用户ID',
        session_id VARCHAR(128) DEFAULT NULL COMMENT '会话ID',
        page_url VARCHAR(2048) NOT NULL COMMENT '页面URL',
        page_title VARCHAR(512) DEFAULT NULL COMMENT '页面标题',
        referrer VARCHAR(2048) DEFAULT NULL COMMENT '来源页面',
        stay_duration INT UNSIGNED DEFAULT 0 COMMENT '停留时长(秒)',
        device_info JSON DEFAULT NULL COMMENT '设备信息',
        user_agent VARCHAR(1024) DEFAULT NULL COMMENT '浏览器UA',
        ip_address VARCHAR(45) DEFAULT NULL COMMENT 'IP地址',
        sk_date INT DEFAULT 0 COMMENT '日期 YYYYMMDD',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        INDEX idx_event_type (event_type),
        INDEX idx_user_id (user_id),
        INDEX idx_session_id (session_id),
        INDEX idx_page_url (page_url(500)),
        INDEX idx_created_at (created_at),
        INDEX idx_sk_date (sk_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='埋点事件表'
    `)
    console.log('✅ 埋点事件表 track_events 创建成功')

    // 2. 每日统计表 - 预聚合数据，提高查询性能
    await query(`
      CREATE TABLE IF NOT EXISTS daily_stats (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        stat_date DATE NOT NULL COMMENT '统计日期',
        page_url VARCHAR(2048) NOT NULL COMMENT '页面URL',
        pv INT UNSIGNED DEFAULT 0 COMMENT '页面访问量',
        uv INT UNSIGNED DEFAULT 0 COMMENT '独立访客数',
        total_stay_duration BIGINT UNSIGNED DEFAULT 0 COMMENT '总停留时长(秒)',
        avg_stay_duration DECIMAL(10, 2) DEFAULT 0.00 COMMENT '平均停留时长(秒)',
        bounce_count INT UNSIGNED DEFAULT 0 COMMENT '跳出次数(停留<10秒)',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_date_page (stat_date, page_url(500)),
        INDEX idx_stat_date (stat_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每日统计表'
    `)
    console.log('✅ 每日统计表 daily_stats 创建成功')

    // 3. 用户会话表 - 用于UV计算
    await query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(128) NOT NULL COMMENT '会话ID',
        user_id VARCHAR(128) DEFAULT NULL COMMENT '用户ID',
        first_visit_url VARCHAR(2048) DEFAULT NULL COMMENT '入口页面',
        first_visit_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '首次访问时间',
        last_active_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后活跃时间',
        total_pages INT UNSIGNED DEFAULT 0 COMMENT '访问页面数',
        total_stay_duration BIGINT UNSIGNED DEFAULT 0 COMMENT '总会话时长',
        is_bounce TINYINT(1) DEFAULT 0 COMMENT '是否跳出',
        created_date DATE DEFAULT (CURRENT_DATE) COMMENT '创建日期',
        INDEX idx_session_id (session_id),
        INDEX idx_user_id (user_id),
        INDEX idx_created_date (created_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户会话表'
    `)
    console.log('✅ 用户会话表 user_sessions 创建成功')

    console.log('🎉 所有数据库表初始化完成!')
    return true
  }
  catch (error) {
    console.error('❌ 数据库初始化失败:', error)
    throw error
  }
}

// 执行初始化
initDatabase().catch(console.error)
