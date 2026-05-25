@echo off
echo Starting XHS RAG...
echo.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
echo.
start "Backend" cmd /k "cd /d D:\desktop\xhs-rag && venv\Scripts\activate && python -m uvicorn app.main:app --reload --port 8000"
start "Frontend" cmd /k "cd /d D:\desktop\xhs-rag\frontend && npm run dev"
echo Both services started.
pause