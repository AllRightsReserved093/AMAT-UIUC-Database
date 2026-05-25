"""中文：封装后端访问 PostgreSQL 翼型 metadata 数据的操作。
English: Encapsulates backend PostgreSQL access for airfoil metadata.
"""

from __future__ import annotations

from typing import Any, Literal, Sequence

import psycopg

from backend.models import FoilMetadata


# 数据库监听在 docker-compose.yml 映射的本机 IPv4 地址。
# Database listens on the local IPv4 address mapped by docker-compose.yml.
HOST = "127.0.0.1"
DB_NAME = "airfoil_db"
USER = "airfoil_user"
PASSWORD = "airfoil_password"

# 数据库连接超时时间，避免 API 在数据库不可达时长时间挂起。
# Database connection timeout, preventing API calls from hanging when the database is unreachable.
CONNECT_TIMEOUT_SECONDS = 5

GeometryFilterKind = Literal["range", "bool"]
GeometryFilterSpec = tuple[str, GeometryFilterKind]

GEOMETRY_FILTER_FIELDS: tuple[GeometryFilterSpec, ...] = (
    ("max_thickness", "range"),
    ("x_max_thickness", "range"),
    ("max_camber", "range"),
    ("x_max_camber", "range"),
    ("area_2d", "range"),
    ("leading_edge_radius", "range"),
    ("trailing_edge_thickness", "range"),
    ("trailing_edge_angle_deg", "range"),
    ("point_count_raw", "range"),
    ("point_count_clean", "range"),
    ("upper_point_count", "range"),
    ("lower_point_count", "range"),
    ("x_min", "range"),
    ("x_max", "range"),
    ("y_min", "range"),
    ("y_max", "range"),
    ("chord_raw", "range"),
    ("is_normalized", "bool"),
    ("te_x_gap", "range"),
    ("te_y_gap", "range"),
    ("is_closed_curve", "bool"),
    ("is_multi_element", "bool"),
)

GeometryRangeFilter = tuple[float | int | None, float | int | None]
GeometryBoolFilter = bool | None
GeometryFilterValue = GeometryRangeFilter | GeometryBoolFilter
GeometryFilterTuple = tuple[GeometryFilterValue, ...]

AERO_FILTER_FIELDS: tuple[str, ...] = (
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

AeroFilterValue = GeometryRangeFilter | None
AeroFilterTuple = tuple[AeroFilterValue, ...]


# --------- Low-Level Database Access ---------

# 执行一条通用 SQL 语句，并返回查询结果行。
# Execute a generic SQL statement and return fetched result rows.
def execute_sql(
    conn,
    query: str,
    params: Sequence[Any] | None = None,
) -> list[tuple[Any, ...]]:
    with conn.cursor() as cur:
        cur.execute(query, params or ())
        if cur.description is None:
            return []
        return list(cur.fetchall())


# --------- Database Access Functions ---------

# 创建并返回 PostgreSQL 数据库连接。
# Create and return a PostgreSQL database connection.
def get_db_connection():
    conn = psycopg.connect(
        host=HOST,
        dbname=DB_NAME,
        user=USER,
        password=PASSWORD,
        connect_timeout=CONNECT_TIMEOUT_SECONDS,
    )

    if conn is None:
        raise ConnectionError("Failed to connect to the database.")

    return conn


# --------- Database Getter Functions ---------

# 读取数据库中所有翼型文件名。
# Read all airfoil file names from the database.
def get_foil_list(conn) -> list[str]:
    rows = execute_sql(conn, "SELECT file_name FROM airfoils ORDER BY file_name;")
    return [row[0] for row in rows]


# 根据文件名批量读取几何文件路径。
# Read geometry file paths in batches by file name.
def get_geometry_file_paths(conn, file_names: list[str]) -> dict[str, str]:
    if not file_names:
        return {}

    unique_file_names = list(dict.fromkeys(file_names))
    query = """
        SELECT file_name, path
        FROM airfoils
        WHERE file_name = ANY(%s)
        ORDER BY file_name;
    """

    rows = execute_sql(conn, query, [unique_file_names])
    path_by_file_name = {row[0]: row[1] for row in rows}
    missing_file_names = [
        file_name
        for file_name in unique_file_names
        if file_name not in path_by_file_name
    ]

    if missing_file_names:
        raise ValueError(
            "Unknown airfoil file names: "
            f"{', '.join(missing_file_names)}"
        )

    return path_by_file_name


# 根据文件名读取对应的翼型 metadata。
# Read airfoil metadata records by file name.
def get_metadatas(conn, file_name: list[str]) -> FoilMetadata:
    raise NotImplementedError("get_metadatas is not implemented yet")


# 按几何 metadata 筛选翼型，并返回符合条件的文件名列表。
# Filter airfoils by geometry metadata and return matching file names.
# geo_filter 顺序必须完全对应 GeometryMetadata。
# geo_filter order must exactly match GeometryMetadata.
# 1. max_thickness: (min, max) or None
# 2. x_max_thickness: (min, max) or None
# 3. max_camber: (min, max) or None
# 4. x_max_camber: (min, max) or None
# 5. area_2d: (min, max) or None
# 6. leading_edge_radius: (min, max) or None
# 7. trailing_edge_thickness: (min, max) or None
# 8. trailing_edge_angle_deg: (min, max) or None
# 9. point_count_raw: (min, max) or None
# 10. point_count_clean: (min, max) or None
# 11. upper_point_count: (min, max) or None
# 12. lower_point_count: (min, max) or None
# 13. x_min: (min, max) or None
# 14. x_max: (min, max) or None
# 15. y_min: (min, max) or None
# 16. y_max: (min, max) or None
# 17. chord_raw: (min, max) or None
# 18. is_normalized: bool or None
# 19. te_x_gap: (min, max) or None
# 20. te_y_gap: (min, max) or None
# 21. is_closed_curve: bool or None
# 22. is_multi_element: bool or None
def get_foil_list_with_geo_filter(conn, geo_filter: GeometryFilterTuple) -> list[str]:
    if len(geo_filter) != len(GEOMETRY_FILTER_FIELDS):
        raise ValueError(
            "geo_filter must have exactly "
            f"{len(GEOMETRY_FILTER_FIELDS)} items, matching GeometryMetadata fields"
        )

    clauses: list[str] = []
    params: list[Any] = []

    for (field_name, filter_kind), filter_value in zip(GEOMETRY_FILTER_FIELDS, geo_filter):
        if filter_value is None:
            continue

        if filter_kind == "bool":
            bool_value = _validate_bool_filter(field_name, filter_value)
            clauses.append(f"g.{field_name} = %s")
            params.append(bool_value)
            continue

        lower, upper = _validate_range_filter(field_name, filter_value)
        if lower is not None:
            clauses.append(f"g.{field_name} >= %s")
            params.append(lower)
        if upper is not None:
            clauses.append(f"g.{field_name} <= %s")
            params.append(upper)

    where_clause = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    query = f"""
        SELECT a.file_name
        FROM airfoils AS a
        JOIN geometry_metadata AS g ON g.airfoil_id = a.id
        {where_clause}
        ORDER BY a.file_name;
    """

    rows = execute_sql(conn, query, params)
    return [row[0] for row in rows]


# 按气动 metadata 和指定雷诺数筛选翼型，并返回符合条件的文件名列表。
# Filter airfoils by aerodynamic metadata for one Reynolds number and return matching file names.
# reynolds_number 单独传入，并进行精确匹配。
# reynolds_number is passed separately and matched exactly.
# aero_filter 顺序必须对应 AerodynamicMetadata 中 reynolds_number 之后的字段。
# aero_filter order must match AerodynamicMetadata fields after reynolds_number.
# 1. mach_number: (min, max) or None
# 2. n_crit: (min, max) or None
# 3. alpha_min_deg: (min, max) or None
# 4. alpha_max_deg: (min, max) or None
# 5. alpha_step_deg: (min, max) or None
# 6. cl_alpha: (min, max) or None
# 7. cl_max: (min, max) or None
# 8. cl_cd_max: (min, max) or None
# 9. cd_min: (min, max) or None
# 10. cm_0: (min, max) or None
# 11. alpha_stall_deg: (min, max) or None
def get_foil_list_with_aero_filter(conn, reynolds_number: float, aero_filter: AeroFilterTuple) -> list[str]:
    if len(aero_filter) != len(AERO_FILTER_FIELDS):
        raise ValueError(
            "aero_filter must have exactly "
            f"{len(AERO_FILTER_FIELDS)} items, matching AerodynamicMetadata fields after reynolds_number"
        )

    clauses: list[str] = ["am.reynolds_number = %s"]
    params: list[Any] = [_validate_reynolds_number(reynolds_number)]

    for field_name, filter_value in zip(AERO_FILTER_FIELDS, aero_filter):
        if filter_value is None:
            continue

        lower, upper = _validate_range_filter(field_name, filter_value)
        if lower is not None:
            clauses.append(f"am.{field_name} >= %s")
            params.append(lower)
        if upper is not None:
            clauses.append(f"am.{field_name} <= %s")
            params.append(upper)

    query = f"""
        SELECT DISTINCT a.file_name
        FROM airfoils AS a
        JOIN aerodynamic_metadata AS am ON am.airfoil_id = a.id
        WHERE {" AND ".join(clauses)}
        ORDER BY a.file_name;
    """

    rows = execute_sql(conn, query, params)
    return [row[0] for row in rows]

def get_full_catalog(conn, reynolds_number: float) -> list[dict[str, Any]]:
    """
    file_name: str
    file_path: str
    family_series: str
    max_thickness: float
    cl_cd_max: float
    """
    query = """
        SELECT
            a.file_name,
            a.path,
            a.family_series,
            a.quality_flags,
            a.is_modified,
            a.is_smooth,
            a.is_naca,
            a.naca_code,
            g.max_thickness,
            g.max_camber,
            g.point_count_raw,
            am.cl_cd_max
        FROM airfoils AS a
        LEFT JOIN geometry_metadata AS g ON g.airfoil_id = a.id
        LEFT JOIN aerodynamic_metadata AS am
            ON am.airfoil_id = a.id
            AND am.reynolds_number = %s
        ORDER BY a.file_name;
    """

    rows = execute_sql(conn, query, [reynolds_number])  # 使用指定的雷诺数来获取 cl_cd_max
    catalogs = []
    for row in rows:
        catalog = {
            "file_name": row[0],
            "file_path": row[1],
            "family_series": row[2],
            "max_thickness": row[8],
            "cl_cd_max": row[11],
        }
        catalogs.append(catalog)

    return catalogs



# --------- Filter Validation and Normalization Helpers ---------

# 校验范围筛选条件，并返回最小值和最大值。
# Validate a range filter and return its lower and upper bounds.
def _validate_range_filter(field_name: str, value: Any) -> GeometryRangeFilter:
    if not isinstance(value, tuple) or len(value) != 2:
        raise ValueError(f"{field_name} filter must be None or a (min, max) tuple")

    lower, upper = value
    if lower is None and upper is None:
        return lower, upper

    for bound_name, bound in (("min", lower), ("max", upper)):
        if bound is not None and (isinstance(bound, bool) or not isinstance(bound, (int, float))):
            raise TypeError(f"{field_name} {bound_name} bound must be int, float, or None")

    if lower is not None and upper is not None and lower > upper:
        raise ValueError(f"{field_name} min bound cannot be greater than max bound")

    return lower, upper


# 校验布尔筛选条件，并返回布尔值。
# Validate a boolean filter and return the boolean value.
def _validate_bool_filter(field_name: str, value: Any) -> bool:
    if not isinstance(value, bool):
        raise TypeError(f"{field_name} filter must be None, True, or False")
    return value


# 校验雷诺数输入，并返回 float 雷诺数。
# Validate the Reynolds number input and return it as a float value.
def _validate_reynolds_number(reynolds_number: Any) -> float:
    if isinstance(reynolds_number, bool) or not isinstance(reynolds_number, float):
        raise TypeError("reynolds_number must be float")
    if reynolds_number < 0:
        raise ValueError("reynolds_number must be non-negative")
    return reynolds_number


# --------- Database Mutation Functions ---------

# 向数据库插入一条翼型 metadata。
# Insert one airfoil metadata record into the database.
def insert_metadata(conn, metadata: FoilMetadata) -> None:
    raise NotImplementedError("insert_metadata is not implemented yet")
