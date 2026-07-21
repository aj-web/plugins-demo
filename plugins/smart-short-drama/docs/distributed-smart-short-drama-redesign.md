# Smart Short Drama 分布式任务系统重构技术方案

## 1. 背景

当前 `smart-short-drama` 是一个基于 Electron 插件体系运行的单机工具。每个使用者在自己的机器上启动客户端，独立登录平台、创建任务、下载短剧原片、执行混剪或复刻，再在本机查看任务结果。

这种模式在少量人员使用时可以接受，但使用人员变多后会出现明显问题：

- 每台机器都要手动创建任务，操作分散，管理成本高。
- 多人重复下载同一部短剧原片，浪费带宽和磁盘。
- 每台机器都维护自己的任务列表，无法集中查看全局进度。
- 任务失败、重试、排队、并发控制都只在本机生效。
- 用户需要知道哪台机器空闲、哪台机器登录状态正常、哪台机器有素材。
- 当前 Electron 主应用和插件 IPC 对分布式调度帮助有限，继续在现有框架内改会让系统复杂度快速上升。

新需求的目标非常明确：

> 重构完成后，只需要一个同学在统一入口创建任务，系统自动调度多台机器完成所有任务。

这个目标本质上不是“把现有 Electron 做强一点”，而是要把当前单机工具重构成一个**中心化任务编排 + 多 Worker 执行**的分布式系统。

## 2. 当前业务能力抽象

现有 `smart-short-drama` 主要能力可以抽象为四类任务：

| 现有模块 | 页面/能力 | 主要产物 | 关键依赖 |
| --- | --- | --- | --- |
| 爆款扒产 | ADX 热榜扒取 | 剧目列表、基础素材目录 | ADX 登录态、浏览器自动化 |
| 爆款复刻 | 跑量片段 + 原片下载 + 去重 | 复刻片段视频 | UserGrowth 登录态、去重服务、短剧原片 |
| 爆款混剪 | 原片 + 话术/脚本混剪 | 混剪视频 | FFmpeg、原片、话术文件 |
| 高光混剪 | 短剧原片三集拼接、叠图、尾帧 | 高光混剪视频 | FFmpeg、原片、叠图、尾帧 |

重构时不建议直接照搬“页面按钮触发节点方法”的组织方式，而应该抽象为：

```text
Job（业务任务）
  -> Task（可调度任务）
    -> Step（可观测步骤）
      -> Artifact（输入/输出资源）
```

例如一次高光混剪：

```text
Job: 高光混剪批量任务
  Task 1: 确保短剧原片就绪
  Task 2: 扫描叠图/尾帧素材
  Task 3: 执行第 1 部剧高光混剪
  Task 4: 执行第 2 部剧高光混剪
  ...
  Artifact: 短剧原片、混剪成品、日志、产出统计
```

## 3. 两种候选方案

用户提到的两个方向分别是：

1. Boss + Worker：一台 Boss 机器负责创建、发布、展示任务，多台 Worker 抢占并执行任务。
2. Mesh 网状结构：所有节点都可以创建任务、同步任务、抢占任务，状态最终一致。

下面分别分析。

## 4. 方案一：中心化 Boss + Worker

### 4.1 架构概览

```text
┌─────────────────────────────────────────────────────────────┐
│                       Boss Web 控制台                         │
│  创建任务 / 查看进度 / 重试失败 / 管理素材 / 查看产物           │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP/WebSocket
┌──────────────────────────▼──────────────────────────────────┐
│                      Boss API 服务                           │
│  Auth / Task API / Scheduler / Worker Registry / Callback     │
└──────────────┬─────────────────────────────┬────────────────┘
               │                             │
               │ SQL                         │ Queue
               ▼                             ▼
┌──────────────────────────┐       ┌──────────────────────────┐
│ PostgreSQL                │       │ Redis / BullMQ            │
│ 任务、状态、Worker、资源   │       │ 任务分发、延迟、重试       │
└──────────────────────────┘       └────────────┬─────────────┘
                                                 │
                 ┌───────────────────────────────┼───────────────────────────────┐
                 │                               │                               │
                 ▼                               ▼                               ▼
┌──────────────────────────┐       ┌──────────────────────────┐       ┌──────────────────────────┐
│ Worker A                  │       │ Worker B                  │       │ Worker C                  │
│ Playwright + FFmpeg        │       │ Playwright + FFmpeg        │       │ Playwright + FFmpeg        │
│ 执行任务、上传结果          │       │ 执行任务、上传结果          │       │ 执行任务、上传结果          │
└──────────────┬───────────┘       └──────────────┬───────────┘       └──────────────┬───────────┘
               │                                  │                                  │
               └──────────────────┬───────────────┴──────────────────┬───────────────┘
                                  ▼                                  ▼
                       ┌────────────────────┐             ┌────────────────────┐
                       │ NAS / 对象存储       │             │ 日志/监控系统        │
                       │ 原片、素材、产物      │             │ Loki/Prometheus 等   │
                       └────────────────────┘             └────────────────────┘
```

### 4.2 核心思想

Boss 是系统唯一事实源：

- 任务由 Boss 创建。
- 任务状态由 Boss 维护。
- Worker 只负责领取和执行。
- 产物统一写入共享存储。
- 用户只需要打开 Boss Web 控制台。

Worker 是无状态或弱状态执行器：

- 启动后注册到 Boss。
- 定时心跳。
- 从队列抢任务。
- 上报步骤日志、进度、结果。
- 异常退出后任务可被其他 Worker 接管。

### 4.3 适用性

这个方案最适合当前诉求：

- 只需要一个人创建任务。
- 多台机器可以同时跑。
- 全局任务列表清晰。
- 调度、重试、限流都容易做。
- 和当前 Node.js/Playwright/FFmpeg 代码复用关系最好。
- 后期可以加更多 Worker，而不用改变用户操作方式。

## 5. 方案二：Mesh 网状结构

### 5.1 架构概览

```text
┌────────────┐       ┌────────────┐
│ Node A      │◄────►│ Node B      │
│ 可创建任务   │       │ 可创建任务   │
│ 可执行任务   │       │ 可执行任务   │
└─────▲──────┘       └─────▲──────┘
      │                    │
      │ gossip/raft/crdt   │
      │                    │
┌─────▼──────┐       ┌─────▼──────┐
│ Node C      │◄────►│ Node D      │
│ 可创建任务   │       │ 可创建任务   │
│ 可执行任务   │       │ 可执行任务   │
└────────────┘       └────────────┘
```

### 5.2 优点

- 没有单点 Boss。
- 任意节点都可以创建任务。
- 局域网内理论上可以自组织。
- Boss 机器挂掉时，不影响其他节点继续工作。

### 5.3 关键难点

Mesh 方案会引入大量和业务无关的分布式系统复杂度：

- 节点发现：节点上线、下线、网络隔离如何处理。
- 任务唯一性：多个节点同时创建同名任务如何去重。
- 任务抢占：两个节点同时认为自己抢到了任务怎么办。
- 状态合并：任务状态冲突时谁覆盖谁。
- 日志同步：每个节点日志如何聚合。
- 文件同步：产物在哪个节点，其他节点如何访问。
- 登录态管理：浏览器 Cookie 分散在各节点，权限和过期处理更复杂。
- 最终一致性带来的延迟：用户看到的状态可能不是最新。

### 5.4 结论

Mesh 不建议作为第一阶段方案。

它更适合：

- 多机房部署。
- 强离线容忍。
- 没有中心服务可部署。
- 团队有明确的分布式一致性经验。

当前目标是“一个人集中创建任务，多台机器执行”。中心化 Boss + Worker 足够满足需求，且成本显著更低。

## 6. 推荐方案

推荐采用：

> 中心化 Boss + Worker + 共享存储 + 可选队列中间件

并分阶段演进：

1. 第一阶段：Boss API + Web 控制台 + Worker 轮询抢任务 + NAS 共享存储。
2. 第二阶段：引入 Redis/BullMQ，增强调度、重试、优先级和延迟任务。
3. 第三阶段：拆分服务、增加监控、审计、多租户和弹性扩容。

不推荐第一阶段直接做 Mesh。

## 7. 技术选型

### 7.1 后端语言

建议使用 Node.js / TypeScript。

理由：

- 当前插件节点本身就是 Node.js。
- Playwright、FFmpeg、文件处理逻辑可以最大程度复用。
- Worker 可直接复用现有 `nodes` 和 `utils` 的部分代码。
- 前后端 TypeScript 统一，降低维护成本。

推荐框架：

| 层 | 推荐 |
| --- | --- |
| API 服务 | NestJS 或 Fastify |
| Worker | Node.js + TypeScript |
| 队列 | BullMQ + Redis |
| 数据库 | PostgreSQL |
| 前端 | Vue 3 + Element Plus 或 React + Ant Design |
| 浏览器自动化 | Playwright |
| 视频处理 | FFmpeg/FFprobe |
| 存储 | NAS 第一阶段，对象存储第二阶段 |
| 日志 | Loki 或文件日志 + API 聚合 |
| 监控 | Prometheus + Grafana，可后置 |

### 7.2 为什么不用 Celery

Celery 是成熟方案，但主要生态在 Python。如果使用 Celery：

- 当前 Node.js 业务代码迁移成本高。
- Playwright 和 FFmpeg 逻辑要重写或跨语言调用。
- 长期会形成 Python 调度 + Node 执行的双语言架构。

除非团队后续确定主技术栈转 Python，否则不建议。

### 7.3 是否必须使用 Redis 队列

第一阶段可以不用 Redis，直接由 Worker 通过数据库抢任务：

```sql
UPDATE tasks
SET status = 'running', worker_id = $workerId
WHERE id = (
  SELECT id FROM tasks
  WHERE status = 'pending'
  ORDER BY priority DESC, created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING *;
```

优点：

- 少一个中间件。
- 逻辑更直观。
- PostgreSQL 可以保证抢占原子性。

第二阶段再引入 BullMQ：

- 需要延迟任务。
- 需要更细的重试策略。
- 需要任务优先级和并发控制。
- 需要更强的任务吞吐能力。

## 8. 新系统模块设计

### 8.1 Boss Web 控制台

职责：

- 创建任务。
- 批量导入剧目列表。
- 查看所有任务状态。
- 查看 Worker 状态。
- 查看任务日志。
- 查看和下载产物。
- 重试失败任务。
- 暂停/取消任务。
- 配置素材库、尾帧库、叠图库。

核心页面：

| 页面 | 功能 |
| --- | --- |
| 工作台 | 全局任务概览、今日产出、失败任务、Worker 在线数 |
| 任务创建 | 创建爆款扒产、复刻、混剪、高光混剪任务 |
| 任务列表 | 全局任务查询、筛选、批量操作 |
| 任务详情 | 步骤进度、日志、参数、产物、错误 |
| Worker 管理 | 在线状态、能力标签、当前任务、资源占用 |
| 素材库 | 原片、叠图、尾帧、话术文件管理 |
| 系统配置 | 登录态、队列并发、存储路径、通知配置 |

### 8.2 Boss API

职责：

- 对外提供任务创建和查询 API。
- 管理任务状态流转。
- 分配任务给 Worker。
- 接收 Worker 心跳。
- 接收 Worker 步骤日志。
- 接收 Worker 产物回调。
- 管理资源索引。
- 触发埋点和统计。

核心 API：

```text
POST   /api/jobs
GET    /api/jobs
GET    /api/jobs/{jobId}
POST   /api/jobs/{jobId}/cancel
POST   /api/jobs/{jobId}/retry

POST   /api/workers/register
POST   /api/workers/heartbeat
POST   /api/workers/poll-task
POST   /api/workers/tasks/{taskId}/start
POST   /api/workers/tasks/{taskId}/progress
POST   /api/workers/tasks/{taskId}/complete
POST   /api/workers/tasks/{taskId}/fail

GET    /api/artifacts
GET    /api/artifacts/{artifactId}
POST   /api/artifacts/register

GET    /api/logs?taskId=xxx
POST   /api/logs
```

### 8.3 Worker Agent

Worker 是安装在每台执行机器上的常驻进程。

职责：

- 注册自身能力。
- 定时心跳。
- 抢占或接收任务。
- 执行业务步骤。
- 上报日志和进度。
- 写入共享存储。
- 回调 Boss 更新状态。
- 在失败时保存现场信息。

Worker 能力标签：

```json
{
  "worker_id": "worker-001",
  "hostname": "render-pc-01",
  "ip": "192.168.1.21",
  "capabilities": [
    "playwright",
    "ffmpeg",
    "adx",
    "usergrowth",
    "highlight_mix",
    "replication",
    "remix"
  ],
  "max_concurrency": 2,
  "ffmpeg_version": "7.1",
  "gpu": "nvidia",
  "status": "online"
}
```

### 8.4 共享存储

第一阶段建议使用 NAS。

统一目录：

```text
\\nas\SmartShortDrama\
  originals\
    dramas\
      {dramaKey}\
        version.json
        episodes\
          1.mp4
          2.mp4
  materials\
    overlays\
      vertical\
      horizontal\
    end_frames\
      vertical\
      horizontal\
    scripts\
  outputs\
    highlight\
      {jobId}\
    replication\
      {jobId}\
    remix\
      {jobId}\
  logs\
    {jobId}\
  temp\
    {workerId}\
```

原则：

- 所有 Worker 都能读素材。
- Worker 只写自己的任务目录。
- 任务完成后产物路径注册到 Boss。
- 不直接把半成品写到正式目录，必须先写 temp，再原子发布。

## 9. 任务模型

### 9.1 Job

Job 表示用户在 Boss 控制台创建的一次业务任务。

字段建议：

```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  job_type VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  created_by VARCHAR(128),
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  params JSONB NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}',
  error_message TEXT
);
```

`job_type`：

```text
adx_scrape
replication
remix
highlight_mix
original_download
```

### 9.2 Task

Task 是 Worker 可领取的执行单元。

```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id),
  task_type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  worker_id VARCHAR(128),
  attempt INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  lock_until TIMESTAMP,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  params JSONB NOT NULL,
  result JSONB NOT NULL DEFAULT '{}',
  error_message TEXT
);
```

`task_type` 示例：

```text
adx_fetch_hot_dramas
usergrowth_download_originals
replication_download_fragments
replication_deduplicate
highlight_mix_drama
remix_drama
```

### 9.3 Artifact

Artifact 表示输入和输出资源。

```sql
CREATE TABLE artifacts (
  id UUID PRIMARY KEY,
  job_id UUID,
  task_id UUID,
  artifact_type VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  storage_path TEXT NOT NULL,
  file_count INT DEFAULT 0,
  size_bytes BIGINT DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL
);
```

`artifact_type`：

```text
original_drama
highlight_output
replication_output
remix_output
log_file
overlay_material
end_frame_material
```

### 9.4 Worker

```sql
CREATE TABLE workers (
  id VARCHAR(128) PRIMARY KEY,
  hostname VARCHAR(255),
  ip VARCHAR(64),
  status VARCHAR(32) NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '[]',
  max_concurrency INT NOT NULL DEFAULT 1,
  running_count INT NOT NULL DEFAULT 0,
  last_heartbeat_at TIMESTAMP,
  metadata JSONB NOT NULL DEFAULT '{}'
);
```

### 9.5 Task Event / Log

```sql
CREATE TABLE task_events (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID,
  task_id UUID,
  worker_id VARCHAR(128),
  level VARCHAR(16) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  message TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL
);
```

## 10. 任务状态机

### 10.1 Job 状态

```text
created
  -> pending
  -> running
  -> partial_success
  -> succeeded
  -> failed
  -> canceled
```

### 10.2 Task 状态

```text
pending
  -> leased
  -> running
  -> succeeded
  -> failed
  -> retrying
  -> canceled
```

### 10.3 Worker 状态

```text
online
busy
draining
offline
disabled
```

### 10.4 任务抢占

Worker 抢任务时必须是原子操作。

PostgreSQL 版本：

```sql
WITH candidate AS (
  SELECT id
  FROM tasks
  WHERE status = 'pending'
    AND task_type = ANY($workerCapabilities)
  ORDER BY priority DESC, created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE tasks
SET
  status = 'leased',
  worker_id = $workerId,
  lock_until = NOW() + INTERVAL '10 minutes',
  updated_at = NOW()
WHERE id IN (SELECT id FROM candidate)
RETURNING *;
```

### 10.5 锁续约

长任务必须续约：

```text
Worker 每 30 秒上报心跳
Boss 将 running task 的 lock_until 延长
如果 worker 超过 2 分钟无心跳，标记疑似离线
如果 task lock_until 过期，任务可重新入队
```

## 11. 核心业务流程

### 11.1 高光混剪流程

```text
1. 用户在 Boss 创建高光混剪 Job
2. Boss 解析剧目列表
3. Boss 为每部剧创建 ensure_original task
4. Worker 检查 NAS 原片缓存
5. 缓存命中则直接返回
6. 缓存未命中则执行 UserGrowth 下载
7. 原片就绪后，Boss 创建 highlight_mix_drama task
8. Worker 读取原片、叠图、尾帧
9. Worker 执行 FFmpeg 混剪
10. Worker 将产物写入 outputs/highlight/{jobId}
11. Worker 回调 Boss，登记 artifact
12. Boss 更新 Job 统计
13. Boss 触发 drama_output 埋点，产出 N 个视频上报 N 次
```

### 11.2 爆款复刻流程

```text
1. 用户创建爆款复刻 Job
2. Boss 根据 ADX 热榜或历史数据选剧
3. Worker 下载跑量片段
4. Worker 确保短剧原片就绪
5. Worker 调用去重服务
6. Worker 输出复刻片段
7. Worker 回调产出数量
8. Boss 更新任务状态和产出统计
9. Boss 上报 drama_output，产出 N 个视频上报 N 次
```

### 11.3 爆款混剪流程

```text
1. 用户创建爆款混剪 Job
2. Boss 获取输入原片和话术素材
3. 按剧目或视频拆分 remix_drama task
4. Worker 执行 FFmpeg 混剪
5. Worker 登记产物
6. Boss 汇总产出数量
```

### 11.4 爆款扒产流程

```text
1. 用户创建爆款扒产 Job
2. Worker 使用 ADX 登录态访问平台
3. 抓取剧目数据
4. 生成剧目目录或数据清单
5. Boss 登记结果
```

爆款扒产是否上报 `drama_output` 要看业务定义。如果它只是生成目录/剧单，不产出视频，则不应上报 `drama_output`。

## 12. 文件缓存和原片复用

这一部分是新系统的关键收益之一。

### 12.1 原片缓存 Key

短剧原片缓存应以剧目为单位：

```text
dramaKey = normalize(dramaName) + '-' + shortHash(source + dramaName)
```

目录：

```text
originals/dramas/{dramaKey}/version.json
originals/dramas/{dramaKey}/episodes/1.mp4
```

### 12.2 version.json

```json
{
  "version": 1,
  "status": "ready",
  "dramaName": "柔弱知青无人娶，直到我的出现",
  "dramaKey": "柔弱知青无人娶直到我的出现-a8f13c2b",
  "source": "usergrowth",
  "episodeCount": 56,
  "files": [
    {
      "episode": 1,
      "fileName": "1.mp4",
      "size": 26613236,
      "width": 720,
      "height": 1290,
      "duration": 171.2
    }
  ],
  "createdAt": "2026-05-21T10:00:00+08:00",
  "updatedAt": "2026-05-21T10:20:00+08:00"
}
```

### 12.3 下载锁

同一部剧只允许一个 Worker 下载。

可以用数据库锁：

```sql
CREATE TABLE drama_cache_locks (
  drama_key VARCHAR(255) PRIMARY KEY,
  owner_worker_id VARCHAR(128),
  lock_until TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

也可以用 Redis lock，但第一阶段数据库锁更易排查。

### 12.4 缓存命中策略

```text
1. 查 artifacts/originals 表
2. 查 NAS version.json
3. 校验 status=ready
4. 校验集数和文件存在
5. 命中则复用
6. 未命中则抢下载锁
7. 下载完成后发布缓存
```

## 13. Worker 执行环境

每台 Worker 机器需要：

- Node.js runtime。
- Playwright Chromium。
- FFmpeg/FFprobe。
- 可访问 NAS。
- 可访问 Boss API。
- 可访问 ADX/UserGrowth 等外部平台。
- 可运行本地去重服务，或访问统一去重服务。

Worker 配置：

```yaml
workerId: worker-001
bossApiUrl: http://boss:3000
storageRoot: \\nas\SmartShortDrama
maxConcurrency: 2
capabilities:
  - playwright
  - ffmpeg
  - usergrowth
  - adx
  - highlight_mix
  - replication
paths:
  ffmpeg: D:\tools\ffmpeg.exe
  ffprobe: D:\tools\ffprobe.exe
  chrome: D:\tools\chromium\chrome.exe
```

## 14. 登录态管理

当前单机工具把 Cookie 保存在本地。新系统有三种处理方式。

### 14.1 每个 Worker 独立登录

优点：

- 实现简单。
- 不集中保存敏感 Cookie。
- 和当前方式接近。

缺点：

- Worker 多时登录维护麻烦。
- 某台 Worker 登录失效会导致任务失败。

### 14.2 Boss 集中管理 Cookie

优点：

- 管理统一。
- Worker 不需要人工登录。

缺点：

- 安全风险更高。
- 平台风控可能识别异常。
- Cookie 分发和加密存储需要严肃处理。

### 14.3 推荐

第一阶段使用 Worker 独立登录，但 Boss 需要记录 Worker 登录状态：

```text
worker_capability_status:
  adx_login: valid/invalid/unknown
  usergrowth_login: valid/invalid/unknown
```

任务调度时只分配给登录态有效的 Worker。

后续再考虑集中登录态管理。

## 15. 任务拆分策略

### 15.1 按剧目拆分

高光混剪和复刻适合按剧目拆分：

```text
一部剧 = 一个 task
```

优点：

- 不同剧之间天然并行。
- 单个任务失败不影响其他剧。
- 产物目录清晰。

### 15.2 按视频拆分

如果单部剧非常大，高光混剪还可以进一步拆成：

```text
第 1-3 集混剪 = 一个 task
第 2-4 集混剪 = 一个 task
```

但第一阶段不建议这么细：

- 会增加调度数量。
- 会增加素材读取竞争。
- 尾帧、叠图随机选择要考虑一致性。

第一阶段建议按剧目拆。

### 15.3 Worker 并发

建议每台 Worker 默认：

```text
Playwright 下载类任务并发：1
FFmpeg 混剪类任务并发：1-2
```

不要盲目开高并发。FFmpeg 对 CPU/GPU/磁盘 IO 压力很大。

## 16. API 设计示例

### 16.1 创建高光混剪任务

```http
POST /api/jobs
Content-Type: application/json
```

```json
{
  "job_type": "highlight_mix",
  "name": "2026-05-21 高光混剪批次 1",
  "priority": 10,
  "params": {
    "drama_names": [
      "柔弱知青无人娶，直到我的出现"
    ],
    "overlay_set_id": "default_vertical",
    "end_frame_set_id": "default_vertical",
    "end_retention_seconds": 10,
    "output_profile": {
      "vertical": {
        "width": 720,
        "height": 1280,
        "video_bitrate_k": 2400,
        "audio_bitrate_k": 96
      }
    }
  }
}
```

### 16.2 Worker 轮询任务

```http
POST /api/workers/poll-task
```

```json
{
  "worker_id": "worker-001",
  "capabilities": ["highlight_mix", "ffmpeg", "usergrowth"],
  "available_slots": 1
}
```

响应：

```json
{
  "task": {
    "id": "task-001",
    "job_id": "job-001",
    "task_type": "highlight_mix_drama",
    "params": {
      "drama_name": "柔弱知青无人娶，直到我的出现",
      "original_path": "\\\\nas\\SmartShortDrama\\originals\\dramas\\xxx\\episodes",
      "output_path": "\\\\nas\\SmartShortDrama\\outputs\\highlight\\job-001\\xxx"
    }
  }
}
```

### 16.3 Worker 完成任务

```http
POST /api/workers/tasks/{taskId}/complete
```

```json
{
  "worker_id": "worker-001",
  "result": {
    "output_count": 50,
    "artifacts": [
      {
        "type": "highlight_output",
        "path": "\\\\nas\\SmartShortDrama\\outputs\\highlight\\job-001\\xxx",
        "file_count": 50
      }
    ]
  }
}
```

## 17. 埋点和统计

当前已有约定：

```text
event_name = drama_output
page_name = highlight / replication / remix
```

新系统建议由 Boss 统一上报，不再由 Worker 直接上报。

原因：

- Boss 才知道任务最终状态。
- Boss 可以去重，避免 Worker 重试导致重复上报。
- Boss 有完整 job/task/artifact 数据。
- 用户身份、组织身份、客户端类型更好统一。

上报策略：

```text
任务成功完成
  -> Boss 读取 output_count
  -> 产出 N 个视频，上报 N 次 drama_output
```

幂等控制：

```sql
CREATE TABLE event_reports (
  id UUID PRIMARY KEY,
  job_id UUID,
  task_id UUID,
  event_name VARCHAR(64),
  page_name VARCHAR(64),
  report_index INT,
  status VARCHAR(32),
  created_at TIMESTAMP
);
```

唯一约束：

```sql
UNIQUE(task_id, event_name, page_name, report_index)
```

这样任务重试或服务重启时不会重复上报。

## 18. 日志和可观测性

必须有集中日志，否则多 Worker 排查会非常痛苦。

### 18.1 日志类型

```text
job_log       用户关心的业务日志
task_log      Worker 执行日志
system_log    系统调度日志
platform_log  ADX/UserGrowth 平台交互日志
ffmpeg_log    视频处理日志
```

### 18.2 日志上报方式

第一阶段：

- Worker 调 API 上报结构化日志。
- 同时本机保留文件日志。

第二阶段：

- Loki/Promtail 收集 Worker 日志。
- Boss 控制台按 taskId/jobId 查询。

### 18.3 指标

核心指标：

- Worker 在线数量。
- Worker 当前任务数。
- Job 成功率。
- Task 平均耗时。
- 原片缓存命中率。
- drama_output 上报成功率。
- FFmpeg 失败率。
- UserGrowth 下载失败率。

## 19. 错误处理和重试

### 19.1 错误分类

| 错误类型 | 示例 | 处理 |
| --- | --- | --- |
| 可重试平台错误 | 请求超时、页面加载失败 | 自动重试 |
| 登录态错误 | Cookie 失效 | 标记 Worker 能力失效，等待人工处理 |
| 素材缺失 | 尾帧目录为空 | 任务失败，提示配置问题 |
| 原片缺失 | 平台无剧 | 标记不可处理 |
| FFmpeg 错误 | 编码失败、音频流异常 | 重试或转 CPU 编码 |
| Worker 离线 | 机器关机 | 任务超时后重新入队 |

### 19.2 重试策略

```text
普通任务：最多 3 次
下载任务：最多 2 次
FFmpeg 任务：最多 2 次
登录态错误：不自动重试
配置错误：不自动重试
```

### 19.3 任务接管

如果 Worker 心跳断开：

```text
1. Boss 标记 Worker offline
2. 查找 worker_id 对应 running tasks
3. 如果 lock_until 过期，状态改为 pending
4. attempt + 1
5. 其他 Worker 可重新领取
```

## 20. 安全和权限

### 20.1 用户角色

```text
admin       管理系统配置、Worker、账号
operator    创建任务、重试任务、查看产物
viewer      只读查看任务和产物
```

### 20.2 Worker 鉴权

Worker 启动时使用 token 注册：

```yaml
workerToken: xxxxx
```

Boss 校验 token 后签发短期 access token。

### 20.3 敏感信息

需要加密存储：

- 平台 Cookie。
- 激活码/用户 ID。
- Worker token。
- 外部 API token。

## 21. 部署方案

### 21.1 第一阶段部署

```text
Boss 机器：
  - Boss API
  - Boss Web
  - PostgreSQL
  - 可选 Redis

NAS：
  - 原片
  - 素材
  - 产物

Worker 机器：
  - Worker Agent
  - Playwright Chromium
  - FFmpeg
  - 可选去重服务
```

### 21.2 Docker 化

Boss 推荐 Docker 化：

```yaml
services:
  boss-api:
    image: smart-short-drama-boss-api
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis

  boss-web:
    image: smart-short-drama-boss-web
    ports:
      - "8080:80"

  postgres:
    image: postgres:16

  redis:
    image: redis:7
```

Worker 在 Windows 上可以先用普通 Node 进程部署，因为 Playwright、FFmpeg、NAS 映射盘在 Windows 下更接近当前环境。

### 21.3 Worker 开机自启

Windows Worker 建议注册为服务：

- NSSM
- Windows Task Scheduler
- PM2 Windows Service

## 22. 迁移路线

### 22.1 第一阶段：可用的中心化系统

目标：一个人可以创建任务，多台 Worker 执行。

范围：

- Boss Web。
- Boss API。
- PostgreSQL。
- Worker 注册/心跳。
- Worker 轮询抢任务。
- 高光混剪任务。
- NAS 原片缓存。
- 任务日志。
- 产物登记。

验收：

- 一个人在 Boss 创建 10 部剧高光混剪任务。
- 至少 2 台 Worker 自动领取执行。
- Boss 能看到每部剧状态。
- 产物统一出现在 NAS。
- 任务完成后自动统计产出数量。

### 22.2 第二阶段：复刻和混剪迁移

范围：

- 爆款复刻。
- 爆款混剪。
- 去重服务 Worker 化。
- 素材库配置。
- 失败重试。
- drama_output 幂等上报。

验收：

- 爆款复刻可集中创建并多机执行。
- 产出视频数量可准确统计。
- 去重失败不影响其他剧目。

### 22.3 第三阶段：调度增强

范围：

- Redis/BullMQ。
- 任务优先级。
- 定时任务。
- Worker 分组。
- 资源占用调度。
- Worker draining。

验收：

- 可以指定任务优先级。
- 可以暂停某台 Worker，不再分配新任务。
- 可以按能力标签分配任务。

### 22.4 第四阶段：平台化

范围：

- 权限系统。
- 审计日志。
- 统一账号/登录态管理。
- 监控告警。
- 多团队/多项目隔离。

## 23. 当前代码复用策略

不建议把现有 Electron 项目直接改造成分布式系统，但可以复用业务内核。

可复用：

- `nodes/hightlight-mix-edit.js` 中的高光混剪逻辑。
- `utils/video-mixer.js` 中的 FFmpeg 封装。
- `nodes/usergrowth-short-film.js` 中的短剧原片抓取。
- `nodes/bytegrowth-batch-frag.js` 中的复刻流程。
- `nodes/video-dedup-service.js` 中的去重服务调用。
- `utils/drama-list-parser.js`。
- `utils/ffmpeg-locator.js` 的部分思路。

需要重写：

- Electron IPC。
- plugin_host。
- 本机 JSON 任务队列。
- 前端插件页面。
- 本机任务 dashboard。
- 本机激活流程和按钮埋点触发方式。

建议拆出新包：

```text
packages/
  core/
    video/
    platform/
    storage/
    workflows/
  boss-api/
  boss-web/
  worker-agent/
  shared/
```

## 24. 项目目录建议

```text
smart-short-drama-distributed/
  apps/
    boss-api/
    boss-web/
    worker-agent/
  packages/
    core/
      workflows/
        highlight/
        replication/
        remix/
        adx/
      platform/
        adx/
        usergrowth/
      video/
      storage/
    shared/
      types/
      constants/
      utils/
  deploy/
    docker-compose.yml
    worker.example.yml
  docs/
```

## 25. 关键设计决策

### 25.1 Boss 是唯一任务事实源

不要让 Worker 自己决定全局任务状态。Worker 只能上报事实：

```text
我开始了
我进度到 30%
我产出了 50 个文件
我失败了，错误是 xxx
```

最终状态由 Boss 计算。

### 25.2 产物必须集中存储

如果产物还散落在 Worker 本机，那么“一个人完成所有任务”的体验不完整。

### 25.3 下载和混剪要分离

下载任务和混剪任务应该拆开：

- 下载任务重网络和平台登录态。
- 混剪任务重 CPU/GPU/磁盘。

拆开后调度更灵活。

### 25.4 上报由 Boss 做

Worker 不直接上报业务埋点。

原因：

- Worker 可能重试。
- Worker 可能重复完成回调。
- Boss 可以做幂等。
- Boss 知道最终产出数量。

## 26. 风险清单

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 平台登录态失效 | Worker 无法下载 | Worker 登录态健康检查 |
| NAS 性能不足 | FFmpeg 读写慢 | 复制到本地临时目录处理，完成后上传 |
| Worker 异常退出 | 任务卡住 | 心跳 + lock_until + 重入队 |
| 任务重复执行 | 重复产物/重复上报 | task attempt + artifact 幂等 + event_reports 唯一约束 |
| FFmpeg 环境不一致 | 同任务不同机器结果不同 | Worker 启动自检，版本记录 |
| 去重服务不稳定 | 复刻失败 | 去重服务健康检查和隔离 |
| 单点 Boss 故障 | 无法创建/调度任务 | 第一阶段可接受，后续数据库备份和服务守护 |
| Mesh 复杂度过高 | 项目延期 | 第一阶段不采用 Mesh |

## 27. 推荐最终结论

推荐不要做 Mesh 网状结构作为第一版。

最务实、成功率最高的方案是：

```text
Boss Web + Boss API + PostgreSQL + NAS + Worker Agent
```

第一阶段甚至可以不引入 Redis，用 PostgreSQL `FOR UPDATE SKIP LOCKED` 完成任务抢占。

当任务量增长后，再引入 Redis/BullMQ 做专业队列。

这个架构能满足核心目标：

- 一个同学集中创建任务。
- 多台机器自动领取执行。
- 全局任务状态集中展示。
- 原片和产物统一存储。
- 任务失败可重试。
- 产出数量可统计。
- 后续可以平滑扩展到更多 Worker。

## 28. 建议下一步

建议按下面顺序推进：

1. 确定第一阶段只做 Boss + Worker，不做 Mesh。
2. 确定首个迁移业务：建议先迁移高光混剪。
3. 设计数据库 schema 和 API contract。
4. 抽离现有高光混剪核心逻辑到 `packages/core`。
5. 实现 Worker 注册、心跳、抢任务。
6. 实现 NAS 原片缓存和产物目录规范。
7. 实现 Boss Web 最小任务台。
8. 做两台 Worker 的端到端验证。

第一阶段完成后，再迁移爆款复刻和爆款混剪。
