"""中文：创建 AMAT UIUC Airfoil 后端 FastAPI 应用。
English: Creates the AMAT UIUC Airfoil backend FastAPI application.
"""

from __future__ import annotations

from importlib import import_module

from fastapi import FastAPI


app = FastAPI(title="AMAT UIUC Airfoil Backend")

airfoil_api = import_module("backend.app.01_API.airfoil_api")
app.include_router(airfoil_api.router)


# 检查 API 服务是否存活。
# Check whether the API service is alive.
@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
