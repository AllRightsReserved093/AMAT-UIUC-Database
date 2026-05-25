"""中文：从数据库行构建后端 metadata 模型。
English: Builds backend metadata models from database rows.
"""

from __future__ import annotations

from collections.abc import Mapping
from datetime import date, datetime
from typing import Any, Iterable

from backend.models import AerodynamicMetadata
from backend.models import FoilMetadata
from backend.models import GeometryMetadata


FOIL_FIELDS = (
    "file_name",
    "path",
    "family_series",
    "source",
    "quality_flags",
    "is_modified",
    "is_smooth",
    "is_naca",
    "naca_code",
    "schema_version",
    "generated_at_utc",
    "updated_at_utc",
    "xfoil_version",
)

GEOMETRY_FIELDS = (
    "max_thickness",
    "x_max_thickness",
    "max_camber",
    "x_max_camber",
    "area_2d",
    "leading_edge_radius",
    "trailing_edge_thickness",
    "trailing_edge_angle_deg",
    "point_count_raw",
    "point_count_clean",
    "upper_point_count",
    "lower_point_count",
    "x_min",
    "x_max",
    "y_min",
    "y_max",
    "chord_raw",
    "is_normalized",
    "te_x_gap",
    "te_y_gap",
    "is_closed_curve",
    "is_multi_element",
)

AERO_FIELDS = (
    "reynolds_number",
    "mach_number",
    "n_crit",
    "alpha_min_deg",
    "alpha_max_deg",
    "alpha_step_deg",
    "cl_alpha",
    "cl_max",
    "cl_cd_max",
    "cd_min",
    "cm_0",
    "alpha_stall_deg",
)


# 按字段名或带前缀的别名读取 row 中的值，找不到时返回 None。
# Read a value by raw field name or prefixed aliases, returning None when absent.
def _get(row: Mapping[str, Any], field: str, *prefixes: str) -> Any:
    for key in (field, *(f"{prefix}_{field}" for prefix in prefixes)):
        if key in row:
            return row[key]
    return None


# 将 datetime/date 等时间值转换成 ISO 字符串，保持 None 不变。
# Convert datetime/date values to ISO strings while preserving None.
def _as_iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


# 将数据库里的 quality_flags 统一转换成 list[str]。
# Normalize database quality_flags values into list[str].
def _as_quality_flags(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, tuple):
        return [str(item) for item in value]
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.startswith("{") and stripped.endswith("}"):
            inner = stripped[1:-1]
            if not inner:
                return []
            return [item.strip().strip('"') for item in inner.split(",")]
        return [stripped] if stripped else []
    return list(value)


# 从一行 join 结果中提取 airfoils 主表字段并做基础类型规整。
# Extract airfoils table fields from one joined row and normalize basic types.
def _build_foil_base(row: Mapping[str, Any]) -> dict[str, Any]:
    data = {field: _get(row, field, "airfoil", "a") for field in FOIL_FIELDS}
    data["quality_flags"] = _as_quality_flags(data["quality_flags"])
    data["generated_at_utc"] = _as_iso(data["generated_at_utc"])
    data["updated_at_utc"] = _as_iso(data["updated_at_utc"])
    return data


# 从一行 join 结果中构建 GeometryMetadata。
# Build GeometryMetadata from one joined row.
def _build_geometry(row: Mapping[str, Any]) -> GeometryMetadata:
    return GeometryMetadata.from_dict(
        {field: _get(row, field, "geometry", "g") for field in GEOMETRY_FIELDS}
    )


# 判断一行 join 结果中是否包含有效的气动数据。
# Determine whether one joined row contains aerodynamic data.
def _has_aero_payload(row: Mapping[str, Any]) -> bool:
    for key in ("aero_id", "aerodynamic_id", "am_id"):
        if row.get(key) is not None:
            return True
    return any(_get(row, field, "aero", "aerodynamic", "am") is not None for field in AERO_FIELDS)


# 从一行 join 结果中构建 AerodynamicMetadata。
# Build AerodynamicMetadata from one joined row.
def _build_aero(row: Mapping[str, Any]) -> AerodynamicMetadata:
    return AerodynamicMetadata.from_dict(
        {field: _get(row, field, "aero", "aerodynamic", "am") for field in AERO_FIELDS}
    )


# 将同一个翼型的多行 join 查询结果合并成一个 FoilMetadata。
# Merge joined rows for one airfoil into a single FoilMetadata.
def rows_to_foil_metadata(rows: Iterable[Mapping[str, Any]]) -> FoilMetadata:
    """Convert joined database mapping rows for one airfoil into ``FoilMetadata``.

    Expected input is the result of joining ``airfoils`` to
    ``geometry_metadata`` and optionally ``aerodynamic_metadata``.

    Supported column names are either the raw model field names or aliased
    names with these prefixes:
    - ``airfoil_`` or ``a_`` for airfoil fields
    - ``geometry_`` or ``g_`` for geometry fields
    - ``aero_``, ``aerodynamic_``, or ``am_`` for aerodynamic fields
    """

    mapped_rows = [dict(row) for row in rows]
    if not mapped_rows:
        raise ValueError("rows_to_foil_metadata requires at least one row")

    first = mapped_rows[0]
    foil_data = _build_foil_base(first)
    geometry = _build_geometry(first)

    reference_path = foil_data.get("path")
    reference_file_name = foil_data.get("file_name")
    aerodynamic_items: list[AerodynamicMetadata] = []

    for row in mapped_rows:
        row_path = _get(row, "path", "airfoil", "a")
        row_file_name = _get(row, "file_name", "airfoil", "a")
        if reference_path is not None and row_path not in {None, reference_path}:
            raise ValueError("rows contain more than one airfoil path")
        if reference_file_name is not None and row_file_name not in {None, reference_file_name}:
            raise ValueError("rows contain more than one airfoil file_name")

        if _has_aero_payload(row):
            aerodynamic_items.append(_build_aero(row))

    return FoilMetadata(
        file_name=foil_data["file_name"],
        path=foil_data["path"],
        family_series=foil_data.get("family_series"),
        source=foil_data.get("source") or "uiuc_database",
        quality_flags=foil_data.get("quality_flags") or [],
        is_modified=bool(foil_data.get("is_modified", False)),
        is_smooth=bool(foil_data.get("is_smooth", False)),
        is_naca=bool(foil_data.get("is_naca", False)),
        naca_code=foil_data.get("naca_code"),
        schema_version=foil_data.get("schema_version") or "v1",
        generated_at_utc=foil_data.get("generated_at_utc"),
        updated_at_utc=foil_data.get("updated_at_utc"),
        xfoil_version=foil_data.get("xfoil_version"),
        geometry_metadata=geometry,
        aerodynamic_metadata=aerodynamic_items,
    )
