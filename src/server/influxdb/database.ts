import { InfluxDB, Point } from '@influxdata/influxdb-client'

const url = process.env.INFLUX_URL || 'http://localhost:8086'
const token = process.env.INFLUX_TOKEN || 'my-token'
export const org = process.env.INFLUX_ORG || 'my-org'
export const bucket = process.env.INFLUX_BUCKET || 'track_bucket'

// 初始化客户端
export const influxDB = new InfluxDB({ url, token })

// 获取写入 API (InfluxDB Node 客户端自带批量写入缓冲机制)
export const writeApi = influxDB.getWriteApi(org, bucket, 'ns')

// 获取查询 API
export const queryApi = influxDB.getQueryApi(org)

export async function initInfluxDB() {
  console.log('InfluxDB client initialized.')
  // InfluxDB 主要是通过 API / UI 创建 bucket。
  // 如果需要自动创建，需要调用 management API，这里假设 bucket 已经存在。
}
