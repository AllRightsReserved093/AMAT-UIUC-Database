"""中文：将翼型 metadata JSON 导入 PostgreSQL。
English: Imports airfoil metadata JSON into PostgreSQL.

The importer is matched to:
- metadata_generation/metadata.py
- backend/database/schema/001_create_tables.sql

It upserts rows by airfoils.path, then refreshes the one-to-one geometry row and
the one-to-many aerodynamic rows for each airfoil.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path, PureWindowsPath
from typing import Any, Iterable

import psycopg


SCRIPT_PATH = Path(__file__).resolve()
PROJECT_ROOT = SCRIPT_PATH.parents[3]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from metadata_generation.metadata import AerodynamicMetadata  # noqa: E402
from metadata_generation.metadata import FoilMetadata  # noqa: E402
from metadata_generation.metadata import GeometryMetadata  # noqa: E402
from metadata_generation.metadata import load_metadata_json  # noqa: E402
from paths import METADATA_JSON_PATH  # noqa: E402
from paths import PACKAGE_ROOT  # noqa: E402

DATABASE_ROOT = PACKAGE_ROOT
DEFAULT_METADATA_PATH = METADATA_JSON_PATH


DB_CONFIG = {
    "host": os.getenv("AIRFOIL_DB_HOST", "127.0.0.1"),
    "port": int(os.getenv("AIRFOIL_DB_PORT", "5432")),
    "dbname": os.getenv("AIRFOIL_DB_NAME", "airfoil_db"),
    "user": os.getenv("AIRFOIL_DB_USER", "airfoil_user"),
    "password": os.getenv("AIRFOIL_DB_PASSWORD", "airfoil_password"),
}


AIRFOIL_SQL = """
INSERT INTO airfoils (
    file_name,
    path,
    family_series,
    source,
    quality_flags,
    is_modified,
    is_smooth,
    is_naca,
    naca_code,
    schema_version,
    generated_at_utc,
    updated_at_utc,
    xfoil_version
)
VALUES (
    %(file_name)s,
    %(path)s,
    %(family_series)s,
    %(source)s,
    %(quality_flags)s,
    %(is_modified)s,
    %(is_smooth)s,
    %(is_naca)s,
    %(naca_code)s,
    %(schema_version)s,
    %(generated_at_utc)s,
    %(updated_at_utc)s,
    %(xfoil_version)s
)
ON CONFLICT (path) DO UPDATE SET
    file_name = EXCLUDED.file_name,
    family_series = EXCLUDED.family_series,
    source = EXCLUDED.source,
    quality_flags = EXCLUDED.quality_flags,
    is_modified = EXCLUDED.is_modified,
    is_smooth = EXCLUDED.is_smooth,
    is_naca = EXCLUDED.is_naca,
    naca_code = EXCLUDED.naca_code,
    schema_version = EXCLUDED.schema_version,
    generated_at_utc = EXCLUDED.generated_at_utc,
    updated_at_utc = EXCLUDED.updated_at_utc,
    xfoil_version = EXCLUDED.xfoil_version
RETURNING id;
"""


DELETE_GEOMETRY_SQL = """
DELETE FROM geometry_metadata
WHERE airfoil_id = %s;
"""


DELETE_AERO_SQL = """
DELETE FROM aerodynamic_metadata
WHERE airfoil_id = %s;
"""


GEOMETRY_SQL = """
INSERT INTO geometry_metadata (
    airfoil_id,
    max_thickness,
    x_max_thickness,
    max_camber,
    x_max_camber,
    area_2d,
    leading_edge_radius,
    trailing_edge_thickness,
    trailing_edge_angle_deg,
    point_count_raw,
    point_count_clean,
    upper_point_count,
    lower_point_count,
    x_min,
    x_max,
    y_min,
    y_max,
    chord_raw,
    is_normalized,
    te_x_gap,
    te_y_gap,
    is_closed_curve,
    is_multi_element
)
VALUES (
    %(airfoil_id)s,
    %(max_thickness)s,
    %(x_max_thickness)s,
    %(max_camber)s,
    %(x_max_camber)s,
    %(area_2d)s,
    %(leading_edge_radius)s,
    %(trailing_edge_thickness)s,
    %(trailing_edge_angle_deg)s,
    %(point_count_raw)s,
    %(point_count_clean)s,
    %(upper_point_count)s,
    %(lower_point_count)s,
    %(x_min)s,
    %(x_max)s,
    %(y_min)s,
    %(y_max)s,
    %(chord_raw)s,
    %(is_normalized)s,
    %(te_x_gap)s,
    %(te_y_gap)s,
    %(is_closed_curve)s,
    %(is_multi_element)s
);
"""


AERO_SQL = """
INSERT INTO aerodynamic_metadata (
    airfoil_id,
    reynolds_number,
    mach_number,
    n_crit,
    alpha_min_deg,
    alpha_max_deg,
    alpha_step_deg,
    cl_alpha,
    cl_max,
    cl_cd_max,
    cd_min,
    cm_0,
    alpha_stall_deg
)
VALUES (
    %(airfoil_id)s,
    %(reynolds_number)s,
    %(mach_number)s,
    %(n_crit)s,
    %(alpha_min_deg)s,
    %(alpha_max_deg)s,
    %(alpha_step_deg)s,
    %(cl_alpha)s,
    %(cl_max)s,
    %(cl_cd_max)s,
    %(cd_min)s,
    %(cm_0)s,
    %(alpha_stall_deg)s
);
"""

# 配置并调用parse_args()
# 解析命令行参数，获取metadata_path、limit和dry_run等参数
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import AMAT UIUC airfoil metadata into PostgreSQL.",
    )
    parser.add_argument(
        "--metadata-path",
        type=Path,
        default=DEFAULT_METADATA_PATH,
        help=f"Path to metadata JSON. Default: {DEFAULT_METADATA_PATH}",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Import only the first N airfoils. Useful for local checks.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Load and validate metadata without writing to PostgreSQL.",
    )
    return parser.parse_args()


def parse_timestamptz(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def normalize_metadata_path(path_value: str) -> str:
    """Keep database paths relative to AMATUIUCDatabase and slash-separated."""
    if not path_value:
        raise ValueError("metadata path cannot be empty")

    if ":" not in path_value and "\\" not in path_value:
        return path_value

    try:
        return PureWindowsPath(path_value).relative_to(
            PureWindowsPath(str(DATABASE_ROOT))
        ).as_posix()
    except ValueError:
        pass

    candidate = Path(path_value)
    try:
        return candidate.resolve().relative_to(DATABASE_ROOT.resolve()).as_posix()
    except (OSError, ValueError):
        return path_value.replace("\\", "/")


def airfoil_params(meta: FoilMetadata) -> dict[str, Any]:
    return {
        "file_name": meta.file_name,
        "path": normalize_metadata_path(meta.path),
        "family_series": meta.family_series,
        "source": meta.source,
        "quality_flags": list(meta.quality_flags),
        "is_modified": meta.is_modified,
        "is_smooth": meta.is_smooth,
        "is_naca": meta.is_naca,
        "naca_code": meta.naca_code,
        "schema_version": meta.schema_version,
        "generated_at_utc": parse_timestamptz(meta.generated_at_utc),
        "updated_at_utc": parse_timestamptz(meta.updated_at_utc),
        "xfoil_version": meta.xfoil_version,
    }


def geometry_params(airfoil_id: int, geometry: GeometryMetadata) -> dict[str, Any]:
    return {
        "airfoil_id": airfoil_id,
        "max_thickness": geometry.max_thickness,
        "x_max_thickness": geometry.x_max_thickness,
        "max_camber": geometry.max_camber,
        "x_max_camber": geometry.x_max_camber,
        "area_2d": geometry.area_2d,
        "leading_edge_radius": geometry.leading_edge_radius,
        "trailing_edge_thickness": geometry.trailing_edge_thickness,
        "trailing_edge_angle_deg": geometry.trailing_edge_angle_deg,
        "point_count_raw": geometry.point_count_raw,
        "point_count_clean": geometry.point_count_clean,
        "upper_point_count": geometry.upper_point_count,
        "lower_point_count": geometry.lower_point_count,
        "x_min": geometry.x_min,
        "x_max": geometry.x_max,
        "y_min": geometry.y_min,
        "y_max": geometry.y_max,
        "chord_raw": geometry.chord_raw,
        "is_normalized": geometry.is_normalized,
        "te_x_gap": geometry.te_x_gap,
        "te_y_gap": geometry.te_y_gap,
        "is_closed_curve": geometry.is_closed_curve,
        "is_multi_element": geometry.is_multi_element,
    }


def aero_params(
    airfoil_id: int,
    aerodynamic_items: Iterable[AerodynamicMetadata],
) -> list[dict[str, Any]]:
    return [
        {
            "airfoil_id": airfoil_id,
            "reynolds_number": aero.reynolds_number,
            "mach_number": aero.mach_number,
            "n_crit": aero.n_crit,
            "alpha_min_deg": aero.alpha_min_deg,
            "alpha_max_deg": aero.alpha_max_deg,
            "alpha_step_deg": aero.alpha_step_deg,
            "cl_alpha": aero.cl_alpha,
            "cl_max": aero.cl_max,
            "cl_cd_max": aero.cl_cd_max,
            "cd_min": aero.cd_min,
            "cm_0": aero.cm_0,
            "alpha_stall_deg": aero.alpha_stall_deg,
        }
        for aero in aerodynamic_items
    ]


def validate_metadata(items: list[FoilMetadata]) -> None:
    seen_paths: set[str] = set()
    duplicate_paths: set[str] = set()

    for index, meta in enumerate(items, start=1):
        if not meta.file_name:
            raise ValueError(f"metadata item {index} has empty file_name")
        path = normalize_metadata_path(meta.path)
        if path in seen_paths:
            duplicate_paths.add(path)
        seen_paths.add(path)

    if duplicate_paths:
        samples = ", ".join(sorted(duplicate_paths)[:5])
        raise ValueError(f"duplicate metadata paths found: {samples}")


def import_airfoil(cur: psycopg.Cursor[Any], meta: FoilMetadata) -> tuple[int, int]:
    cur.execute(AIRFOIL_SQL, airfoil_params(meta))
    row = cur.fetchone()
    if row is None:
        raise RuntimeError(f"airfoil upsert returned no id for path={meta.path!r}")

    airfoil_id = int(row[0])

    cur.execute(DELETE_GEOMETRY_SQL, (airfoil_id,))
    cur.execute(DELETE_AERO_SQL, (airfoil_id,))

    cur.execute(GEOMETRY_SQL, geometry_params(airfoil_id, meta.geometry_metadata))

    aerodynamic_rows = aero_params(airfoil_id, meta.aerodynamic_metadata)
    if aerodynamic_rows:
        cur.executemany(AERO_SQL, aerodynamic_rows)

    return 1, len(aerodynamic_rows)


def import_metadata(items: list[FoilMetadata]) -> tuple[int, int, int]:
    airfoil_count = 0
    geometry_count = 0
    aero_count = 0

    with psycopg.connect(**DB_CONFIG) as conn:
        with conn.cursor() as cur:
            for meta in items:
                inserted_geometry, inserted_aero = import_airfoil(cur, meta)
                airfoil_count += 1
                geometry_count += inserted_geometry
                aero_count += inserted_aero
        conn.commit()

    return airfoil_count, geometry_count, aero_count


def main() -> int:
    args = parse_args()
    metadata_path = args.metadata_path.resolve()

    items = load_metadata_json(metadata_path)
    if args.limit is not None:
        if args.limit < 0:
            raise ValueError("--limit must be non-negative")
        items = items[: args.limit]

    validate_metadata(items)

    if args.dry_run:
        print(f"Validated {len(items)} airfoil metadata records from {metadata_path}")
        return 0

    airfoil_count, geometry_count, aero_count = import_metadata(items)
    print(
        "Imported metadata: "
        f"airfoils={airfoil_count}, "
        f"geometry_rows={geometry_count}, "
        f"aerodynamic_rows={aero_count}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
