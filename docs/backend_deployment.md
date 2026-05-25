<!-- 中文：记录 AMATUIUCDatabase 后端本地部署流程和命令行。
English: Documents the AMATUIUCDatabase backend local deployment workflow and commands. -->

# Backend Deployment

This document describes the current local backend deployment flow on Windows PowerShell.
Run all commands from the project root:

```powershell
cd D:\GitHub\AMATUIUCDatabase
```

## 1. Prepare Python Runtime

Create and activate the project virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

The top-level `requirements.txt` delegates to `backend/requirements.txt`.
The backend uses `psycopg[binary]` so local Windows deployment does not require a separate PostgreSQL `libpq` installation.

## 2. Start PostgreSQL

Start the local PostgreSQL container:

```powershell
docker compose up -d
```

Default database settings are defined in `docker-compose.yml`:

```text
host: 127.0.0.1
port: 5432
database: airfoil_db
user: airfoil_user
password: airfoil_password
container: airfoil-postgres
```

Check that the container is running:

```powershell
docker ps --filter "name=airfoil-postgres"
```

## 3. Create Database Schema

Apply the SQL schema to the running PostgreSQL container:

```powershell
Get-Content .\backend\database\schema\001_create_tables.sql |
  docker exec -i airfoil-postgres psql -U airfoil_user -d airfoil_db -v ON_ERROR_STOP=1
```

## 4. Import Metadata

Validate the metadata import without writing to the database:

```powershell
.\.venv\Scripts\python.exe .\backend\database\script\insert_airfoil.py --dry-run --limit 5
```

Import the full metadata set:

```powershell
.\.venv\Scripts\python.exe .\backend\database\script\insert_airfoil.py
```

For a smaller test import:

```powershell
.\.venv\Scripts\python.exe .\backend\database\script\insert_airfoil.py --limit 20
```

## 5. Run Backend API

Development mode with auto-reload:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Simple deployment mode without auto-reload:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

## 6. Verify Backend

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Expected result:

```text
status
------
ok
```

OpenAPI documentation:

```text
http://127.0.0.1:8000/docs
```

## 7. Stop Services

Stop the API server with `Ctrl+C`.

Stop PostgreSQL while keeping the database volume:

```powershell
docker compose down
```

Stop PostgreSQL and remove the local database volume:

```powershell
docker compose down -v
```

Use `docker compose down -v` only when the local database can be discarded.

## Troubleshooting

If `psycopg` reports `no pq wrapper available`, reinstall dependencies:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

If the API cannot connect to PostgreSQL, check the container and port:

```powershell
docker ps --filter "name=airfoil-postgres"
Test-NetConnection 127.0.0.1 -Port 5432
```

If port `8000` is already in use, start the API on another port:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8001
```
