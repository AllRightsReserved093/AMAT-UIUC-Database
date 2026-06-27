"""中文：定义翼型 catalog、筛选、metadata 和几何文件相关的 FastAPI 路由。
English: Defines FastAPI routes for airfoil catalog, filters, metadata, and geometry files.
"""

from __future__ import annotations

from importlib import import_module
from pathlib import Path
from typing import Any, Callable, TypeVar

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from backend.models import FoilMetadata


db_access = import_module("backend.app.02_services.db_access")

T = TypeVar("T")

router = APIRouter(prefix="/airfoils", tags=["airfoils"])


# --------- Response Models ---------


class Catalog(BaseModel):
    """翼型轻量 catalog 条目。Lightweight airfoil catalog item."""

    file_name: str
    file_path: str
    family_series: str | None = None
    max_thickness: float | None = None
    cl_cd_max: float | None = None


class FileCatalogListResponse(BaseModel):
    file_catalogs: list[Catalog]


class FileNameListResponse(BaseModel):
    file_names: list[str]


class StatusResponse(BaseModel):
    status: str


# --------- Request Models ---------


class GeometryFilterRequest(BaseModel):
    geo_filter: list[Any]


class AeroFilterRequest(BaseModel):
    reynolds_number: Any
    aero_filter: list[Any]


class MetadataRequest(BaseModel):
    file_names: list[str]


class MetadataInsertRequest(BaseModel):
    metadata: dict[str, Any]


class GeometryFilesRequest(BaseModel):
    file_names: list[str]


# --------- Dependencies ---------

def get_connection():
    conn = db_access.get_db_connection()
    try:
        yield conn
    finally:
        conn.close()


# --------- Helper Functions ---------

def _normalize_filter_tuple(filter_values: list[Any]) -> tuple[Any, ...]:
    return tuple(tuple(value) if isinstance(value, list) else value for value in filter_values)


def _handle_db_call(operation: Callable[[], T]) -> T:
    try:
        return operation()
    except NotImplementedError as exc:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(exc)) from exc
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


# --------- File Name Routes ---------

# 读取所有翼型文件名。
# Read all airfoil file names.
@router.get("", response_model=FileNameListResponse)
def get_foil_list(conn=Depends(get_connection)) -> FileNameListResponse:
    file_names = _handle_db_call(lambda: db_access.get_foil_list(conn))
    return FileNameListResponse(file_names=file_names)


# --------- Catalog Routes ---------

# 读取全量翼型 catalog。
# Read the full airfoil catalog.
@router.get("/catalog", response_model=FileCatalogListResponse)
def get_full_catalog(
    conn=Depends(get_connection),
    reynolds_number: float = 1e6,
) -> FileCatalogListResponse:
    file_catalogs = _handle_db_call(lambda: db_access.get_full_catalog(conn, reynolds_number))
    return FileCatalogListResponse(file_catalogs=file_catalogs)


# --------- Geometry File Routes ---------

# 根据文件名读取几何文件。
# Read geometry files by file names.
@router.post("/geometry/files")
def get_geometry_files_with_file_names(
    request: GeometryFilesRequest,
    conn=Depends(get_connection),
) -> dict[str, Any]:
    file_names = request.file_names
    geometry_files: dict[str, str] = {}

    paths = _handle_db_call(lambda: db_access.get_geometry_file_paths(conn, file_names))

    for file_name, path in paths.items():
        path = Path(path)
        if not path.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Geometry file for '{file_name}' not found.",
            )
        geometry_files[file_name] = path.read_text(encoding="utf-8", errors="ignore")

    return geometry_files


# --------- Filter Routes ---------

# 按几何 metadata 筛选翼型文件名。
# Filter airfoil file names by geometry metadata.
@router.post("/filter/geometry", response_model=FileNameListResponse)
def get_foil_list_with_geo_filter(
    request: GeometryFilterRequest,
    conn=Depends(get_connection),
) -> FileNameListResponse:
    geo_filter = _normalize_filter_tuple(request.geo_filter)
    file_names = _handle_db_call(lambda: db_access.get_foil_list_with_geo_filter(conn, geo_filter))
    return FileNameListResponse(file_names=file_names)


# 按气动 metadata 和指定雷诺数筛选翼型文件名。
# Filter airfoil file names by aerodynamic metadata and Reynolds number.
@router.post("/filter/aero", response_model=FileNameListResponse)
def get_foil_list_with_aero_filter(
    request: AeroFilterRequest,
    conn=Depends(get_connection),
) -> FileNameListResponse:
    aero_filter = _normalize_filter_tuple(request.aero_filter)
    file_names = _handle_db_call(
        lambda: db_access.get_foil_list_with_aero_filter(conn, request.reynolds_number, aero_filter)
    )
    return FileNameListResponse(file_names=file_names)


# --------- Metadata Routes ---------

# 根据文件名读取翼型 metadata。
# Read airfoil metadata by file names.
@router.post("/metadata")
def get_metadatas(request: MetadataRequest, conn=Depends(get_connection)) -> dict[str, Any]:
    metadata = _handle_db_call(lambda: db_access.get_metadatas(conn, request.file_names))
    if isinstance(metadata, FoilMetadata):
        return metadata.to_dict()
    return metadata

# 插入一条翼型 metadata。
# Insert one airfoil metadata record.
@router.post("/metadata/insert", response_model=StatusResponse)
def insert_metadata(request: MetadataInsertRequest, conn=Depends(get_connection)) -> StatusResponse:
    metadata = FoilMetadata.from_dict(request.metadata)
    _handle_db_call(lambda: db_access.insert_metadata(conn, metadata))
    return StatusResponse(status="ok")


