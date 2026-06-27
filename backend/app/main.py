"""中文：创建 AMAT UIUC Airfoil 后端 FastAPI 应用。
English: Creates the AMAT UIUC Airfoil backend FastAPI application.
"""

from __future__ import annotations

from importlib import import_module

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(title="AMAT UIUC Airfoil Backend")

# 允许本地 Vite 前端访问后端 API。
# Allow the local Vite frontend to access the backend API.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):517[0-9]",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

airfoil_api = import_module("backend.app.01_API.airfoil_api")
app.include_router(airfoil_api.router)

node_api = import_module("backend.app.01_API.node_api")
app.include_router(node_api.router)


# 检查 API 服务是否存活。
# Check whether the API service is alive.
@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
