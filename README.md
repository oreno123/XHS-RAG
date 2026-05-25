# XHS RAG - 小红书收藏知识库

把小红书收藏变成可对话、可分类的知识库。

## 功能

- Cookie 登录，拉取全部收藏笔记
- AI 自动分类（基于笔记内容）
- 左右分屏：左边看视频/读文档，右边 AI 问答
- RAG 语义检索，基于 DashScope
- 全局/单笔记两种问答模式

## 快速开始

1. 安装依赖：
```bash
cd D:\desktop\xhs-rag
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

2. 配置环境变量：
```bash
cp .env.example .env
# 编辑 .env 填写 DASHSCOPE_API_KEY
```

3. 启动（双击 启动.bat 或手动启动）：

后端：
```bash
python -m uvicorn app.main:app --reload
```

前端：
```bash
cd frontend
npm install
npm run dev
```

4. 打开 http://localhost:3000

5. 获取小红书 Cookie：
   - 打开 xiaohongshu.com 并登录
   - F12 → Application → Cookies
   - 复制全部 cookie 粘贴到登录页

## 技术栈

- **后端**：FastAPI + LangChain + ChromaDB + DashScope
- **爬虫**：Spider_XHS (小红书数据采集)
- **前端**：Next.js + React + Tailwind CSS
- **存储**：SQLite + ChromaDB (本地)