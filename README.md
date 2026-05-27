# XHS RAG - 小红书收藏知识库

把小红书收藏变成可对话、可检索、可分类的个人知识库。

## 功能

- **Cookie 登录** — 粘贴浏览器 Cookie 即可，无需扫码
- **同步收藏** — 一键拉取全部收藏笔记（图文/视频）
- **AI 自动分类** — 基于笔记内容智能归类
- **RAG 语义检索** — 用自然语言搜索收藏内容（DashScope + LangChain + ChromaDB）
- **双模式问答** — 全局问答（跨笔记检索）& 单笔记问答（针对某篇深聊）
- **左右分屏** — 左边看视频/读图文，右边 AI 对话

## 快速开始

### 环境要求

- Python 3.10+
- Node.js 18+
- [DashScope API Key](https://dashscope.console.aliyun.com/)

### 安装

```bash
# 克隆
git clone git@github.com:oreno123/XHS-RAG.git
cd XHS-RAG

# 后端
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 前端
cd frontend
npm install
```

### 配置

```bash
cp .env.example .env
# 编辑 .env，填入 DASHSCOPE_API_KEY
```

### 启动

**方式一：一键启动（Windows）**

双击 `启动.bat`

**方式二：手动启动**

```bash
# 后端（端口 8000）
python -m uvicorn app.main:app --reload --port 8000

# 前端（端口 3000）
cd frontend && npm run dev
```

打开 http://localhost:3000

### 获取小红书 Cookie

1. 打开 [xiaohongshu.com](https://www.xiaohongshu.com) 并登录
2. F12 → Application → Cookies → 复制全部 cookie
3. 粘贴到登录页输入框

## 项目结构

```
├── app/                    # FastAPI 后端
│   ├── main.py            # 入口，CORS，路由注册
│   ├── config.py          # 配置管理
│   ├── database.py        # SQLAlchemy + SQLite
│   ├── models.py          # 数据模型
│   ├── routers/           # API 路由
│   │   ├── auth.py        # Cookie 登录
│   │   ├── notes.py       # 笔记 CRUD
│   │   ├── knowledge.py   # 同步收藏 + 构建索引
│   │   ├── chat.py        # 流式问答
│   │   └── category.py    # 分类管理
│   └── services/          # 业务逻辑
│       ├── xhs.py         # 小红书 API 对接
│       ├── rag.py         # RAG 检索链
│       └── classifier.py  # AI 分类
├── spider_xhs/            # 小红书爬虫（签名 + 采集）
├── frontend/              # Next.js 前端
│   ├── app/
│   │   ├── page.tsx       # 登录页
│   │   └── workspace/     # 主工作台
│   ├── components/        # UI 组件
│   └── lib/api.ts         # API 客户端
├── tests/                 # 测试
├── .env.example
├── requirements.txt
└── 启动.bat               # Windows 一键启动
```

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | FastAPI, SQLAlchemy, Uvicorn |
| AI/LLM | LangChain, DashScope (Qwen), ChromaDB |
| 爬虫 | Spider_XHS (X-s 签名) |
| 前端 | Next.js 16, React 19, Tailwind CSS 4 |
| 存储 | SQLite + ChromaDB（全部本地） |

## API 文档

启动后端后访问 http://localhost:8000/docs 查看 Swagger 文档。

## License

MIT
