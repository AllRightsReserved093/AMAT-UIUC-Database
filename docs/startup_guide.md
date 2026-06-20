<!-- 中文：说明 AMATUIUCDatabase 在本地完整启动、验证和关闭的步骤。
English: Documents the complete local startup, verification, and shutdown workflow for AMATUIUCDatabase. -->

# Startup Guide

本文档说明如何在 Windows PowerShell 中完整启动 AMATUIUCDatabase。

项目本地运行时主要有三个服务层：

```text
PostgreSQL database  ->  FastAPI backend API  ->  Vite/React frontend
127.0.0.1:5432       ->  127.0.0.1:8000       ->  Vite printed URL, usually 5173
```

所有未特别说明的命令都从项目根目录运行：

```powershell
cd D:\GitHub\AMATUIUCDatabase
```

## Prerequisites

本地需要先安装：

- Docker Desktop
- Python
- Node.js / npm
- Windows PowerShell

## First-Time Setup

首次配置时需要准备 Python 环境、数据库结构、初始数据和前端依赖。

### 1. Prepare Python Environment

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

如果 PowerShell 阻止激活脚本，先只对当前用户放开本地脚本执行：

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

然后重新运行：

```powershell
.\.venv\Scripts\Activate.ps1
```

### 2. Start PostgreSQL

```powershell
docker compose up -d
```

确认数据库容器正在运行：

```powershell
docker ps --filter "name=airfoil-postgres"
```

本地数据库配置来自 `docker-compose.yml`：

```text
host: 127.0.0.1
port: 5432
database: airfoil_db
user: airfoil_user
container: airfoil-postgres
```

### 3. Create Database Schema

```powershell
Get-Content .\backend\database\schema\001_create_tables.sql |
  docker exec -i airfoil-postgres psql -U airfoil_user -d airfoil_db -v ON_ERROR_STOP=1
```

### 4. Import Metadata

先做一次 dry-run，确认导入脚本能读取数据：

```powershell
.\.venv\Scripts\python.exe .\backend\database\script\insert_airfoil.py --dry-run --limit 5
```

导入完整 metadata：

```powershell
.\.venv\Scripts\python.exe .\backend\database\script\insert_airfoil.py
```

如果只是快速测试，也可以只导入少量记录：

```powershell
.\.venv\Scripts\python.exe .\backend\database\script\insert_airfoil.py --limit 20
```

### 5. Install Frontend Dependencies

```powershell
cd frontend
npm install
cd ..
```

## Daily Startup

日常启动通常不需要重新建表、重新导入 metadata 或重新安装依赖。

### 1. Start Database

在项目根目录运行：

```powershell
docker compose up -d
```

### 2. Start Backend API

打开一个 PowerShell 终端，在项目根目录运行：

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

后端 API 默认地址：

```text
http://127.0.0.1:8000
```

健康检查：

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

预期结果包含：

```text
status: ok
```

API 文档页面：

```text
http://127.0.0.1:8000/docs
```

### 3. Start Frontend

再打开一个 PowerShell 终端：

```powershell
cd D:\GitHub\AMATUIUCDatabase\frontend
npm run dev
```

Vite 会在终端输出前端访问地址，通常是：

```text
http://localhost:5173
```

前端默认连接：

```text
http://127.0.0.1:8000
```

如果后端端口不是 `8000`，在 `frontend/.env` 中设置：

```text
VITE_BACKEND_URL=http://127.0.0.1:8001
```

然后重启前端 dev server。

## Verification Checklist

启动完成后按这个顺序检查：

```powershell
docker ps --filter "name=airfoil-postgres"
Invoke-RestMethod http://127.0.0.1:8000/health
```

然后在浏览器打开：

```text
http://127.0.0.1:8000/docs
http://localhost:5173
```

如果前端页面能打开，且后端健康检查返回 `ok`，说明三层服务已经连通。

## Shutdown

关闭前端和后端：

```text
在对应终端按 Ctrl+C
```

停止 PostgreSQL，但保留本地数据库卷：

```powershell
docker compose down
```

只有确定本地数据库可以删除时，才使用：

```powershell
docker compose down -v
```

`docker compose down -v` 会删除 PostgreSQL 数据卷，下次需要重新建表和导入 metadata。

## Troubleshooting

### Backend Cannot Connect To Database

先检查容器和端口：

```powershell
docker ps --filter "name=airfoil-postgres"
Test-NetConnection 127.0.0.1 -Port 5432
```

如果容器没有运行：

```powershell
docker compose up -d
```

### Port 8000 Is Already In Use

改用其他后端端口：

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8001 --reload
```

然后同步设置 `frontend/.env`：

```text
VITE_BACKEND_URL=http://127.0.0.1:8001
```

### Python Dependencies Are Missing

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### Frontend Dependencies Are Missing

```powershell
cd frontend
npm install
```

### Database Has No Data

如果 API 能启动，但 catalog 或 metadata 没有数据，通常需要重新导入 metadata：

```powershell
.\.venv\Scripts\python.exe .\backend\database\script\insert_airfoil.py
```

如果数据库卷被 `docker compose down -v` 删除过，需要先重新执行建表步骤，再导入 metadata。

## Related Documents

- [Backend Deployment](backend_deployment.md)
- [Backend Architecture](backend_architecture.md)
- [Frontend Architecture](frontend_architecture.md)
- [Database Structure](database_structure.md)
- [API Reference](api_reference.md)
