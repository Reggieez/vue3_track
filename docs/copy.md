# 前端埋点系统设计文档 (Express + MongoDB)

## 1. 常见的埋点数据分析维度

### 1.1 用户行为分析

- **PV (Page View)**：页面浏览量
- **UV (Unique Visitor)**：独立访客数
- **人均浏览页数**：每个用户平均浏览的页面数
- **访问频次**：用户访问网站的频率
- **用户行为路径**：用户从进入网站到离开的完整路径

### 1.2 页面访问分析

- **热门页面排行**：访问量最高的页面
- **页面停留时长**：用户在各页面的平均停留时间
- **跳出率**：只访问一个页面就离开的比例
- **页面路径分析**：用户在页面间的跳转路径

### 1.3 留存分析

- **次日留存率**：今天访问的用户明天还访问的比例
- **7日留存率**：7天后还活跃的用户比例
- **30日留存率**：30天后还活跃的用户比例

### 1.4 事件分析

- **点击事件分析**：按钮、链接等元素的点击情况
- **自定义事件分析**：业务相关的自定义事件

### 1.5 设备和环境分析

- **设备类型分布**：PC、手机、平板的比例
- **浏览器分布**：不同浏览器的使用情况
- **操作系统分布**：iOS、Android、Windows等
- **屏幕分辨率**：用户设备的屏幕分辨率分布

### 1.6 时段分析

- **日活跃时段**：一天中用户最活跃的时间段
- **周活跃趋势**：一周内每天的活跃情况
- **月度趋势**：长期的趋势变化

### 1.7 实时监控

- **实时在线人数**：当前在线的用户数量
- **实时流量监控**：实时的访问流量
- **实时告警**：异常情况的实时通知

### 1.8 异常行为分析

- **异常流量检测**：识别爬虫、恶意访问
- **异常行为模式**：识别可能的作弊行为
- **错误日志分析**：系统错误和异常的统计

### 1.9 性能分析

- **页面加载时间**：各页面的平均加载时间
- **资源加载性能**：图片、脚本等资源的加载情况
- **错误率**：页面错误和异常的发生频率

## 2. 架构概述

本埋点系统基于 Node.js (Express) + MongoDB 构建，采用前后端分离的架构。前端通过 SDK 上报用户行为数据，后端接收并持久化到 MongoDB，同时提供数据统计聚合接口供管理后台 (Dashboard) 展示。

### 2.1 技术栈选型

- **前端 SDK**: 原生 JavaScript / TypeScript (支持 1x1 透明 GIF 上报、`requestIdleCallback` 任务调度和 `navigator.sendBeacon`)
- **后端服务**: Node.js + Express
- **消息队列**: Redis (结合本地内存队列做降级，用于高并发削峰)
- **数据库**: MongoDB

### 2.2 为什么选择 MongoDB？

相比于传统的关系型数据库（如 MySQL），MongoDB 在埋点场景下具有显著优势：

1. **Schema-free (无模式)**: 埋点事件的 `custom_data` (自定义数据) 和 `device_info` (设备信息) 是高度动态的嵌套 JSON 结构，MongoDB 的 BSON 格式能原生完美存储嵌套对象，无需像 MySQL 那样频繁变更表结构或依赖低效的 JSON 字段查询。
2. **高并发写入能力**: 埋点系统是一个典型的“写多读少”场景，MongoDB 内存映射机制提供了极高的单机写入吞吐量。
3. **强大的聚合框架 (Aggregation Pipeline)**: 统计接口需要按天、按页面分组、计算去重 UV 等操作，MongoDB 提供了丰富的聚合操作符 (`$group`, `$match`, `$addToSet`, `$dateToString` 等)，能高效完成复杂的统计计算。

***

## 3. 核心功能与高并发模块设计

### 3.1 埋点上报机制 (SDK 端降级优化)

为避免埋点请求阻塞主业务的 Ajax 请求和 JS 主线程，前端 SDK 采用了**本地队列 + 空闲调度**的混合上报策略：

1. **任务队列化与调度**: 所有普通的事件 (PV/Click) 会先被放入 SDK 内存队列中。通过 `requestIdleCallback` 监听浏览器主线程的空闲时间，只有在空闲时才打包发送，不抢占业务计算资源。
2. **1x1 透明 GIF 上报**: 采用 `new Image().src = "..."` 方式进行上报，替代传统的 Ajax/Fetch。其优势在于：没有跨域限制，不占用浏览器的并发请求池，完全由底层网络线程隐式处理。
3. **关键事件保活 (页面卸载)**: 针对如 `Stay` 停留时长这类页面关闭/跳转时的事件，直接采用 `navigator.sendBeacon` (POST) 确保数据能发往服务端。如果不支持则降级为带有 `keepalive: true` 的 fetch 请求。

#### 为什么采用这种混合上报策略？ (设计权衡)

在架构设计时，我们针对不同的 API 进行了深度权衡：

- **为什么不把** **`navigator.sendBeacon`** **作为唯一方案？**
  虽然它专门设计用于页面卸载时发送数据，且不阻塞主线程，但存在几个致命局限：1. **数据大小限制**（通常全局仅 64KB），高频埋点极易被打满导致静默丢弃；2. **无法获取响应**，无法知道服务端是否成功处理（连 HTTP 状态码都拿不到）；3. **触发预检请求**，如果是跨域发送 JSON，依然会触发 `OPTIONS` 请求增加网络开销。
- **为什么引入** **`Image`** **(1x1 透明 GIF)？**
  图片请求 (GET) 是真正的“万金油”：1. **天然免跨域预检**，只需一次 RTT；2. **不抢占 Ajax 资源**，浏览器网络层对图片的优先级和并发池是独立的；3. **可监听状态**，通过 `img.onload` 能够确认埋点到达服务端，支持失败重试。缺点是受限于 URL 长度，不适合超大载荷（大载荷需降级为 fetch POST）。
- **既然** **`sendBeacon`** **和** **`Image`** **不阻塞，为何还需要** **`requestIdleCallback`？**
  发送网络请求不阻塞，**不代表“组装和发送请求前的 JS 代码”不阻塞**。深拷贝对象、URL 序列化等操作均在 JS 主线程执行。若在用户疯狂滚动或点击时同步执行这些代码，依然会引发掉帧（超过 16.6ms）。`requestIdleCallback` 的意义在于：把瞬时高频的埋点组装工作推迟到浏览器主线程**真正的空闲期**执行，确保核心业务和动画交互的极致丝滑。

因此，结合页面**运行中**（Image + 空闲调度）和**卸载前**（Beacon 争取最后发送权）两种不同生命周期的混合策略，是业界前端埋点的最佳实践。

### 3.2 后端数据接收层与高并发削峰 (Worker)

面对大量埋点请求，后端服务采用了**MQ 削峰 + 批量入库**的方案：

1. **接口极速响应 (Fire and Forget)**: `/track` 接口在收到数据后，不等待数据库操作。提取参数组装 JSON 后，直接推入消息队列，并立刻向前端返回 200 OK（返回 1x1 透明 GIF base64）或 204 No Content（针对 Beacon）。
2. **Redis 高可用消息队列**:
   - 默认使用 Redis 作为消息队列（`lpush`），速度极快，确保 Node.js 的事件循环不会被阻塞。
   - **平滑降级机制**: 若 Redis 连接失败或不可用，队列管理器会自动降级为 Node.js 本地内存数组 (`Array.unshift`)，保证服务在无 Redis 环境下依然可用。
3. **后台消费进程 (Micro-batching Worker)**:
   - 单独运行的后台定时器（每隔 3 秒执行一次），从队列中批量拉取最多 500 条数据。
   - 使用 MongoDB 的 `insertMany` 一次性完成入库，极大地减少了数据库的连接占用和 I/O 损耗。

### 3.3 数据库模型与高级可视化分析设计 (MongoDB)

为了支撑企业级的全面埋点分析系统（涵盖“人、场、事、时”四大维度），我们需要设计一套**高度扁平化且扩展性极强**的数据模型，并基于此构建丰富的可视化大屏。

#### 1. MongoDB 实体-事件模型设计 (Entity-Event Model)

系统主要包含三张核心 Collection（集合）：

**①** **`users`** **(用户实体表)**
维护用户的全局唯一画像。

```json
{
  "_id": "u_883921",
  "user_id": "test", // 用户id
  "user_name": "测试", // 用户名称
  "first_visit_time": ISODate("2024-01-01"), // 第一次访问日期
  "latest_visit_time": ISODate("2024-04-09"), // 最后一次访问日期
  "city": "guangzhou",
  "total_view": 45,
  "channel_source": "google_ads"
}
```

**②** **`user_sessions`** **(用户会话表)**
用于记录每个 Session 的基础信息（如首次访问页面、总访问页数等），是计算跳出率和访问路径的基础。

- **更新策略**: 使用 `updateOne` 配合 `$setOnInsert` 和 `$inc` 避免并发冲突。
- **索引**: `{ session_id: 1 }` (唯一索引)。

```json
{
  "_id": "session_a1b2c3",
  "user_id": "test",
  "user_name": "测试",
  "start_time": ISODate("2024-04-09T10:00:00Z"),
  "end_time": ISODate("2024-04-09T10:15:00Z"),
  "duration": 900, // 会话总时长
  "page_views": 5 // 如果为 1 则记为跳出
}
```

**③** **`track_events`** **(埋点事件流水大宽表)**
记录所有的原子埋点事件（包括 `pv`, `stay`, `click`, `search` 等）。为了极速查询，所有事件存在这一张宽表中。

- **文档结构示例**:
  ```json
  {
    "_id": ObjectId("..."),
    // 1. Who
    "user_id": "test",
    "session_id": "session_168...",
    
    // 2. When
    "created_at": ISODate("2024-04-08T10:00:00Z"),
    
    // 3. What
    "event_type": "click", // pv | stay | click | fund | fund_manager

    // 4. Where
    "page_url": "/home",
    "page_title": "首页",
    
    // 4. Context (设备与环境)
    "device_info": { 
      "browser": "Chrome", 
      "os": "Windows 10", 
      "width": 1980, 
      "height": 960 
    },
    "ip_address": "192.168.1.1",
    
    // 5. Properties (自定义事件属性，高度动态，MongoDB 最大优势)
    "custom_data": {
      "element_id": "btn_buy_now", // (点击事件特有) 按钮标识
      "target_type": "fund",       // 操作的业务实体类型
      "target_id": "005827.OF",    // 业务实体ID
      "target_name": "易方达蓝筹", // 冗余名称，免去联表查询
      "stay_duration": 120         // (停留事件特有)
    }
  }
  ```
- **核心索引设计**:
  - `{ created_at: -1 }`: 用于按时间范围过滤统计（最常用）。
  - `{ event_type: 1, created_at: -1 }`: 用于针对特定事件类型的时间范围查询。&#x20;

***

## 4. 统计接口实现方案

后端通过 MongoDB 的 Aggregation Pipeline 实现数据统计。

### 4.1 概览统计 (`/track/overview`)

**功能**: 统计一段时间内的总 PV、总 UV 和总停留时长。
**聚合策略**:

1. `$match`: 筛选时间范围和特定的 `user_id` (如果提供)。
2. `$group`:
   - **PV**: 使用 `$cond` 判断 `event_type === 'pv'`，是则累加 1。
   - **Stay**: 使用 `$cond` 判断 `event_type === 'stay'`，是则累加 `stay_duration`。
   - **UV (去重)**: 核心难点在于“同一用户一天多次访问算一次”。使用 `$addToSet` 将日期和用户标识拼接成唯一字符串（如 `2024-04-08_u123` 或 `2024-04-08_session_123`）存入数组。
3. `$project`: 通过 `$size` 计算去重数组的长度，即为真实的 UV 数。

### 4.2 PV 趋势统计 (`/track/pv`)

**功能**: 按天或按小时输出 PV 的变化趋势。
**聚合策略**:

1. `$match`: 筛选 `event_type: 'pv'` 及时间范围。
2. `$group`: 使用 `$dateToString` 根据传入的粒度 (`day` 或 `hour`) 将 `created_at` 格式化为对应精度的字符串作为分组 `_id`，并对文档数求和 (`$sum: 1`)。
3. `$sort`: 按日期字符串升序排列。

### 4.3 页面停留时长排行 (`/track/pages/stay`)

**功能**: 统计各页面的用户总停留时间，由长到短排序。
**聚合策略**:

1. `$match`: 筛选 `event_type: 'stay'` 及时间范围。
2. `$group`: 以 `{ page_url: "$page_url", page_title: "$page_title" }` 作为分组键，累加 `$stay_duration`。
3. `$sort`: 针对累加结果降序排列。
4. `$limit`: 可选的返回条数限制。

### 4.4 页面访问数排行 (`/track/pages/uv`)

**功能**: 统计访问过每个页面的用户数量 (UV 排行)。
**聚合策略**:
与概览统计的 UV 计算类似，按页面 URL/Title 分组后，使用 `$addToSet` 对拼接后的日期+用户标识进行去重，最后用 `$size` 求长度并降序排列。

***

## 5. 接口文档汇总

### 5.1 埋点上报 API

- **`GET /track`**
  - **用途**: 1x1 透明 GIF 上报接口。前端通过 `new Image().src` 将埋点参数拼接到 URL 的 Query 中进行静默发送。
  - **响应**: 立即返回 `200 OK` (内容为 1x1 px 的 Base64 GIF 字节流)。
- **`POST /track`**
  - **用途**: 专门用于接收 `navigator.sendBeacon` 发送的离线 (页面卸载) 埋点数据，支持 JSON/Text/FormData。
  - **响应**: 立即返回 `204 No Content`。

### 5.2 统计聚合 API

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

***

## 6. 总结与扩展建议

当前的架构已经完全移除了传统的关系型数据库限制，利用 MongoDB 极大地提升了前端埋点数据结构变更的灵活性。

**未来可扩展方向：**

1. **高并发缓冲**: 如果流量极高，可在 Express 和 MongoDB 之间引入 Redis List 或 Kafka 作为消息队列进行削峰填谷。
2. **TTL 索引**: 对于不需要永久保存的原始埋点明细数据，可以为 `track_events` 的 `created_at` 字段添加 MongoDB TTL 索引（例如 90 天后自动删除），节约磁盘空间。
3. **数据分片 (Sharding)**: 当单表数据突破亿级，MongoDB 可以方便地按 `user_id` 或 `created_at` 进行水平分片集群部署。

