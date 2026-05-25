# 小红书收藏知识库（XHS RAG）设计文档

> 把小红书收藏变成可对话、可分类、可学习的技术知识库。

## 1. 项目定位

全栈 Web 应用，前后端分离。用户扫码登录小红书 → 拉取收藏笔记 → AI 自动分类 → 向量化入库 → 左右分屏浏览+AI陪读问答。

核心场景：收藏了大量技术教程/干货笔记 → 自动归类 → 点开一条 → 左边看视频/读文档 → 右边 AI 陪读问答。

## 2. 技术栈

与 bilibili-rag 保持一致，复用大部分代码：

- **后端**：FastAPI + Python 3.x
- **LLM/Embedding**：DashScope（通义千问）
- **向量库**：ChromaDB（本地持久化）
- **文本处理**：LangChain（TextSplitter + VectorStore）
- **数据库**：SQLite（aiosqlite 异步驱动）
- **小红书爬虫**：Spider_XHS（cv-cat/Spider_XHS），Cookie 认证
- **前端**：Next.js 16 + React 19 + TypeScript + Tailwind CSS 4
- **日志**：loguru

## 3. 整体架构

```
用户浏览器
    ↓
Next.js 前端 (localhost:3000)
    ├── 左侧：分类侧边栏 + 媒体播放区（视频/图片/文档）
    └── 右侧：AI 对话面板
    ↓
FastAPI 后端 (localhost:8000)
    ├── routers/auth.py        — 扫码登录 + Cookie 备选
    ├── routers/notes.py       — 笔记列表、分类、详情
    ├── routers/knowledge.py   — 笔记入库（文本→向量化）
    ├── routers/chat.py        — RAG 对话（流式）
    ├── routers/category.py    — AI 自动分类
    └── services/
        ├── xhs.py             — Spider_XHS 封装（拉收藏、笔记详情）
        ├── rag.py             — 复用：ChromaDB + LangChain RAG
        └── classifier.py      — 新增：LLM 自动分类打标签
    ↓
存储层
    ├── SQLite — 笔记元数据、分类、用户会话
    └── ChromaDB — 笔记内容向量（语义检索）
```

## 4. 数据模型

### SQLite 表

**user_session** — 用户登录态

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| cookie | TEXT | 小红书 Cookie |
| xhs_user_id | TEXT | 小红书用户 ID |
| nickname | TEXT | 昵称 |
| avatar | TEXT | 头像 URL |
| created_at | DATETIME | 创建时间 |

**category** — AI 自动分类

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| name | TEXT UNIQUE | 分类名称（2-4字） |
| description | TEXT | 分类描述 |
| icon_emoji | TEXT | 显示用 emoji |
| note_count | INTEGER | 笔记数量（缓存） |

**note** — 收藏的笔记

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| note_id | TEXT UNIQUE | 小红书原始笔记 ID |
| title | TEXT | 标题 |
| content | TEXT | 正文文本 |
| author | TEXT | 作者昵称 |
| author_avatar | TEXT | 作者头像 |
| cover_url | TEXT | 封面图 URL |
| images | TEXT (JSON) | 图片 URL 数组 |
| video_url | TEXT | 视频 URL |
| note_type | TEXT | 图文/视频 |
| tags | TEXT (JSON) | 标签数组 |
| like_count | INTEGER | 点赞数 |
| collect_count | INTEGER | 收藏数 |
| comment_count | INTEGER | 评论数 |
| category_id | INTEGER FK | → category.id |
| status | TEXT | pending / indexed / removed / error |
| error_msg | TEXT | 错误信息 |
| synced_at | DATETIME | 同步时间 |

**chat_message** — 对话记录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| session_id | TEXT | 会话 ID |
| role | TEXT | user / assistant |
| content | TEXT | 消息内容 |
| sources | TEXT (JSON) | 引用的笔记来源 |
| note_ids | TEXT (JSON) | 关联的笔记 ID |
| created_at | DATETIME | 创建时间 |

### ChromaDB

- Collection: `xhs_notes`
- 每条 document: note_id + 分块文本 + metadata(category, tags, title)
- 用于语义检索

## 5. 核心业务流程

### 流程一：登录 + 同步收藏

1. 用户扫码登录（主要方式）或粘贴 Cookie（备选）
2. 扫码流程：后端调小红书登录 API 生成二维码 → 前端展示 → 用户用 App 扫码 → 后端轮询状态 → 成功拿 Cookie
3. Cookie 备选：用户从浏览器复制 Cookie 粘贴
4. 后端验证 Cookie 有效性（调 get_user_self_info）
5. 保存到 user_session
6. 用户点"同步收藏" → 调 Spider_XHS 的 get_user_all_collect_note_info
7. 拉取全部收藏笔记列表，存入 note 表（status=pending）

### 流程二：入库 + AI 分类

1. 遍历 pending 状态的笔记
2. 对每条笔记：
   - 调 get_note_info 拉取完整内容（正文、图片、视频地址）
   - 更新 note 表
   - 调 LLM 做自动分类：
     - 输入：标题 + 正文前 500 字 + 标签
     - 输出：category_name
     - 查 category 表，有则关联，无则新建
   - 文本分块 → Embedding → 写入 ChromaDB
   - status → indexed
3. 请求限速：每条笔记间隔 3 秒，防风控

### 流程三：浏览 + AI 陪读

1. 用户点击左侧分类 → 展示该分类下所有笔记卡片（封面+标题+标签）
2. 点击某条笔记 → 进入左右分屏：
   - 左侧：
     - 图文笔记：图片轮播 + 正文阅读
     - 视频笔记：内嵌视频播放器 + 正文
   - 右侧：AI 对话面板
     - 默认加载当前笔记上下文
     - 支持单笔记问答（note_id 过滤）和全局问答（不过滤）
     - 流式输出，末尾附来源引用

### 流程四：增量同步

1. 用户再次点"同步收藏"
2. 拉取当前收藏列表
3. 与本地 note 表对比：
   - 新增的 → 入库流程
   - 取消收藏的 → 标记 removed
   - 已有的 → 跳过

## 6. 前端页面设计

### 登录页

- 居中布局，显示二维码（扫码登录）
- 下方备选：粘贴 Cookie 输入框
- 品牌标题"小红书收藏知识库"

### 主工作区（左右分屏）

三栏布局：

- **左侧边栏（~200px）**：分类列表
  - 全部 / 各 AI 分类
  - 底部：同步收藏按钮、重新入库按钮
- **中间内容区（flex 1）**：
  - 笔记卡片网格模式：点分类后显示封面+标题卡片
  - 笔记详情模式：点具体笔记后显示视频播放器/图片轮播+正文
  - 全屏切换按钮
- **右侧 AI 面板（~400px）**：
  - 对话消息列表（支持 Markdown 渲染）
  - 模式切换：单笔记问答 / 全局问答
  - 输入框 + 发送按钮

### 交互细节

- 点击分类 → 中间区显示笔记卡片网格
- 点击卡片 → 中间区切换为笔记详情（视频/图片+正文）
- 全屏按钮 → 内容区占满屏幕，侧边栏和 AI 面板隐藏
- AI 面板默认加载当前笔记上下文，可切换全局模式

## 7. AI 分类策略

分类 Prompt：

```
你是一个内容分类助手。根据以下小红书笔记内容，给出一个分类名称。
分类应该简洁（2-4个字），例如：Python、前端、设计、美食、旅行、健身、职场、摄影。
如果现有分类都不合适，就创建新分类。只返回分类名称，不要解释。

现有分类列表：{existing_categories}

笔记标题：{title}
笔记内容：{content_preview}
笔记标签：{tags}
```

首批入库时创建 10-20 个分类，后续逐渐收敛。LLM 优先将笔记归入已有分类。

## 8. Cookie 管理

- 扫码登录成功 → Cookie 存 SQLite
- 每次调 Spider_XHS API 带上 Cookie
- Cookie 过期检测：API 返回 401 → 前端提示重新扫码
- 请求限速：每 2 秒一个请求

## 9. 视频播放

- Spider_XHS 的 get_note_info 返回视频地址（标准 MP4）
- 前端用 HTML5 `<video>` 播放，支持进度条、倍速
- 图文笔记：images 数组 → 图片轮播组件

## 10. RAG 对话（复用 bilibili-rag）

- RecursiveCharacterTextSplitter 分块（1000字，200重叠）
- DashScope Embedding → ChromaDB
- 单笔记模式：ChromaDB filter by note_id
- 全局模式：不过滤，跨笔记检索
- 流式输出（SSE），末尾追加 `[[SOURCES_JSON]]` 来源信息

## 11. 项目目录结构

```
xhs-rag/
├── app/
│   ├── main.py              # FastAPI 入口
│   ├── config.py            # 配置（DashScope API Key 等）
│   ├── database.py          # SQLite 异步引擎
│   ├── models.py            # 数据模型
│   ├── routers/
│   │   ├── auth.py          # 扫码登录 + Cookie 备选
│   │   ├── notes.py         # 笔记 CRUD
│   │   ├── knowledge.py     # 入库流程
│   │   ├── chat.py          # RAG 对话
│   │   └── category.py      # 分类管理
│   └── services/
│       ├── xhs.py           # Spider_XHS 封装
│       ├── rag.py           # RAG 管线（复用）
│       └── classifier.py    # AI 分类器
├── frontend/
│   ├── app/
│   │   ├── page.tsx         # 登录页
│   │   ├── workspace/       # 主工作区
│   │   └── layout.tsx       # 布局
│   ├── components/
│   │   ├── LoginModal.tsx   # 登录弹窗（扫码+Cookie）
│   │   ├── CategorySidebar.tsx  # 分类侧边栏
│   │   ├── NoteGrid.tsx     # 笔记卡片网格
│   │   ├── NoteDetail.tsx   # 笔记详情（视频/图片+正文）
│   │   ├── ChatPanel.tsx    # AI 对话面板
│   │   └── VideoPlayer.tsx  # 视频播放器
│   └── lib/
│       └── api.ts           # API 客户端
├── data/                    # SQLite + ChromaDB 运行时数据
├── spider_xhs/              # Spider_XHS 库（作为子模块或复制）
├── docs/
│   └── superpowers/specs/   # 设计文档
├── requirements.txt
└── README.md
```
