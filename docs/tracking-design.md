# 前端埋点系统设计文档 (Express + MongoDB)

## 1. 架构概述

本埋点系统基于 Node.js (Express) + MongoDB 构建，采用前后端分离的架构。前端通过 SDK 上报用户行为数据，后端接收并持久化到 MongoDB，同时提供数据统计聚合接口供管理后台 (Dashboard) 展示。

### 1.1 技术栈选型
- **前端 SDK**: 原生 JavaScript / TypeScript (支持 axios、fetch 和 navigator.sendBeacon)
- **后端服务**: Node.js + Express
- **数据库**: MongoDB

### 1.2 为什么选择 MongoDB？
相比于传统的关系型数据库（如 MySQL），MongoDB 在埋点场景下具有显著优势：
1. **Schema-free (无模式)**: 埋点事件的 `custom_data` (自定义数据) 和 `device_info` (设备信息) 是高度动态的嵌套 JSON 结构，MongoDB 的 BSON 格式能原生完美存储嵌套对象，无需像 MySQL 那样频繁变更表结构或依赖低效的 JSON 字段查询。
2. **高并发写入能力**: 埋点系统是一个典型的“写多读少”场景，MongoDB 内存映射机制提供了极高的单机写入吞吐量。
3. **强大的聚合框架 (Aggregation Pipeline)**: 统计接口需要按天、按页面分组、计算去重 UV 等操作，MongoDB 提供了丰富的聚合操作符 (`$group`, `$match`, `$addToSet`, `$dateToString` 等)，能高效完成复杂的统计计算。

---

## 2. 核心功能与模块设计

### 2.1 埋点上报机制 (SDK 端)
前端通过不同的上报策略确保数据不丢失：
- **普通上报 (PV/点击)**: 使用 `axios` 或 `fetch` (GET/POST) 异步发送。
- **页面离开/关闭上报 (Stay 停留时长)**: 监听 `visibilitychange` 和 `pagehide` 事件，并在页面卸载时使用 `navigator.sendBeacon` (POST) 发送数据。如果浏览器不支持，降级使用带有 `keepalive: true` 的 `fetch` 请求。

### 2.2 后端数据接收层
- **中间件配置**: 支持 `application/json`、`application/x-www-form-urlencoded` 和 `text/plain` (专门用于兼容 `sendBeacon` 的原生 JSON 字符串载荷)。
- **统一路由解析**: `handleTrackRequest` 兼容处理 GET 和 POST 请求，自动合并 `req.query` 和 `req.body`，提取 `event_type`、`user_id`、`session_id`、`page_url` 等公共参数。
- **客户端信息解析**: 通过 `req.headers['user-agent']` 解析浏览器、系统、设备类型，通过 `x-forwarded-for` 获取客户端 IP。

### 2.3 数据库模型设计 (MongoDB)
系统主要包含两个 Collection（集合）：

#### 1. `user_sessions` (用户会话表)
用于记录每个 Session 的基础信息（如首次访问页面、总访问页数等）。
- **更新策略**: 使用 `updateOne` 配合 `$setOnInsert` (不存在则插入) 和 `$inc` (存在则累加访问次数)，避免并发插入冲突。
- **索引**: `{ session_id: 1 }` (唯一索引)。

#### 2. `track_events` (埋点事件明细表)
记录所有的原子埋点事件，包括 `pv`, `stay`, `click`, `custom` 等。
- **文档结构示例**:
  ```json
  {
    "_id": ObjectId("..."),
    "event_type": "pv",
    "user_id": "u123",
    "session_id": "session_168...",
    "page_url": "/home",
    "page_title": "首页",
    "stay_duration": 0,
    "device_info": {
      "browser": "Chrome",
      "os": "Windows 10",
      "device": "desktop",
      "isMobile": false
    },
    "ip_address": "192.168.1.1",
    "sk_date": 20240408,
    "created_at": ISODate("2024-04-08T10:00:00Z")
  }
  ```
- **核心索引设计**:
  - `{ created_at: -1 }`: 用于按时间范围过滤统计（最常用）。
  - `{ event_type: 1, created_at: -1 }`: 用于针对特定事件类型（如 `pv`, `stay`）的时间范围查询。
  - `{ sk_date: -1 }`: 冗余的整型日期字段，便于快速按天分组聚合。

---

## 3. 统计接口实现方案

后端通过 MongoDB 的 Aggregation Pipeline 实现数据统计。

### 3.1 概览统计 (`/track/overview`)
**功能**: 统计一段时间内的总 PV、总 UV 和总停留时长。
**聚合策略**:
1. `$match`: 筛选时间范围和特定的 `user_id` (如果提供)。
2. `$group`:
   - **PV**: 使用 `$cond` 判断 `event_type === 'pv'`，是则累加 1。
   - **Stay**: 使用 `$cond` 判断 `event_type === 'stay'`，是则累加 `stay_duration`。
   - **UV (去重)**: 核心难点在于“同一用户一天多次访问算一次”。使用 `$addToSet` 将日期和用户标识拼接成唯一字符串（如 `2024-04-08_u123` 或 `2024-04-08_session_123`）存入数组。
3. `$project`: 通过 `$size` 计算去重数组的长度，即为真实的 UV 数。

### 3.2 PV 趋势统计 (`/track/pv`)
**功能**: 按天或按小时输出 PV 的变化趋势。
**聚合策略**:
1. `$match`: 筛选 `event_type: 'pv'` 及时间范围。
2. `$group`: 使用 `$dateToString` 根据传入的粒度 (`day` 或 `hour`) 将 `created_at` 格式化为对应精度的字符串作为分组 `_id`，并对文档数求和 (`$sum: 1`)。
3. `$sort`: 按日期字符串升序排列。

### 3.3 页面停留时长排行 (`/track/pages/stay`)
**功能**: 统计各页面的用户总停留时间，由长到短排序。
**聚合策略**:
1. `$match`: 筛选 `event_type: 'stay'` 及时间范围。
2. `$group`: 以 `{ page_url: "$page_url", page_title: "$page_title" }` 作为分组键，累加 `$stay_duration`。
3. `$sort`: 针对累加结果降序排列。
4. `$limit`: 可选的返回条数限制。

### 3.4 页面访问数排行 (`/track/pages/uv`)
**功能**: 统计访问过每个页面的用户数量 (UV 排行)。
**聚合策略**:
与概览统计的 UV 计算类似，按页面 URL/Title 分组后，使用 `$addToSet` 对拼接后的日期+用户标识进行去重，最后用 `$size` 求长度并降序排列。

---

## 4. 接口文档汇总

### 4.1 埋点上报 API
- **`GET /track`**
  - **用途**: 普通的埋点数据上报（通常前端拼接参数在 URL Query 中）。
- **`POST /track`**
  - **用途**: 专门用于接收 `navigator.sendBeacon` 发送的离线上报数据，支持 JSON/Text body 解析。
- **`POST /track/event`**
  - **用途**: 自定义事件上报接口（复用处理逻辑）。

### 4.2 统计聚合 API
> 以下接口均支持可选的 `start_date` 和 `end_date` 参数，默认查询近 7 天。

- **`GET /track/overview`**
  - **返回**: `{ pv: number, uv: number, stay: number }`
- **`GET /track/pv`**
  - **参数**: `granularity` (可选 'day' 或 'hour')
  - **返回**: 数组 `[{ date: '2024-04-08', pv: 100 }, ...]`
- **`GET /track/pages/stay`**
  - **参数**: `limit` (限制返回条数)
  - **返回**: 数组 `[{ page_url: '/home', page_title: '首页', total_stay_duration: 3600 }, ...]` (按时长降序)
- **`GET /track/pages/uv`**
  - **参数**: `limit` (限制返回条数)
  - **返回**: 数组 `[{ page_url: '/about', page_title: '关于', uv: 50 }, ...]` (按访问人数降序)

---

## 5. 总结与扩展建议
当前的架构已经完全移除了传统的关系型数据库限制，利用 MongoDB 极大地提升了前端埋点数据结构变更的灵活性。

**未来可扩展方向：**
1. **高并发缓冲**: 如果流量极高，可在 Express 和 MongoDB 之间引入 Redis List 或 Kafka 作为消息队列进行削峰填谷。
2. **TTL 索引**: 对于不需要永久保存的原始埋点明细数据，可以为 `track_events` 的 `created_at` 字段添加 MongoDB TTL 索引（例如 90 天后自动删除），节约磁盘空间。
3. **数据分片 (Sharding)**: 当单表数据突破亿级，MongoDB 可以方便地按 `user_id` 或 `created_at` 进行水平分片集群部署。
