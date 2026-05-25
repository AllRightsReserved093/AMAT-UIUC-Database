"""中文：集中管理 AMATUIUCDatabase 独立项目根目录下的文件系统路径。
English: Centralizes filesystem paths under the standalone AMATUIUCDatabase project root.
"""

from __future__ import annotations

from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent
PACKAGE_ROOT = PROJECT_ROOT

RAW_COORD_DIR_NAME = "coord_seligFmt"
CLEAN_COORD_DIR_NAME = "coord_seligFmt_clean"

RAW_COORD_DIR = PROJECT_ROOT / RAW_COORD_DIR_NAME
CLEAN_COORD_DIR = PROJECT_ROOT / CLEAN_COORD_DIR_NAME

METADATA_DIR = PROJECT_ROOT / "metadata"
METADATA_JSON_PATH = METADATA_DIR / "metadata.json"

RESULTS_GEOMETRY_DIR = PROJECT_ROOT / "results_geometry"
RESULTS_XFOIL_DIR = PROJECT_ROOT / "results_xfoil"

BACKEND_DIR = PROJECT_ROOT / "backend"
DATABASE_DIR = BACKEND_DIR / "database"
DATABASE_SCHEMA_DIR = DATABASE_DIR / "schema"
DATABASE_SCRIPTS_DIR = DATABASE_DIR / "script"

DOCKER_COMPOSE_PATH = PROJECT_ROOT / "docker-compose.yml"
