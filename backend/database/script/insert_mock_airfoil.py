"""中文：向本地 PostgreSQL 数据库插入一条模拟翼型 metadata 记录。
English: Inserts one mock airfoil metadata record into the local PostgreSQL database.

This script uses Docker's bundled psql inside the running postgres container, so
it does not require installing a Python PostgreSQL client package.
"""

from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys


SCRIPT_PATH = Path(__file__).resolve()
PROJECT_ROOT = SCRIPT_PATH.parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from paths import CLEAN_COORD_DIR_NAME  # noqa: E402

CONTAINER_NAME = os.getenv("AIRFOIL_DB_CONTAINER", "airfoil-postgres")
DB_NAME = os.getenv("AIRFOIL_DB_NAME", "airfoil_db")
DB_USER = os.getenv("AIRFOIL_DB_USER", "airfoil_user")
MOCK_FILE_PATH = f"{CLEAN_COORD_DIR_NAME}/mock_naca2412.dat"


MOCK_SQL_TEMPLATE = r"""
\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE mock_airfoil_id (
    id BIGINT NOT NULL
) ON COMMIT DROP;

DELETE FROM airfoils
WHERE path = 'mock/coord_seligFmt_clean/mock_naca2412.dat';

DELETE FROM airfoils
WHERE file_name = 'mock_naca2412.dat'
  AND path <> '{mock_path}';


WITH upserted_airfoil AS (
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
        'mock_naca2412.dat',
        '{mock_path}',
        'NACA 4-digit',
        'uiuc_database',
        ARRAY['mock', 'schema_test']::TEXT[],
        false,
        false,
        true,
        '2412',
        'v1',
        now(),
        now(),
        'mock-xfoil-0.0'
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
        updated_at_utc = now(),
        xfoil_version = EXCLUDED.xfoil_version
    RETURNING id
)
INSERT INTO mock_airfoil_id (id)
SELECT id
FROM upserted_airfoil;

DELETE FROM geometry_metadata
WHERE airfoil_id IN (SELECT id FROM mock_airfoil_id);

DELETE FROM aerodynamic_metadata
WHERE airfoil_id IN (SELECT id FROM mock_airfoil_id);

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
SELECT
    id,
    0.1200,
    0.3000,
    0.0200,
    0.4000,
    0.0820,
    0.0158,
    0.0025,
    14.5,
    121,
    119,
    60,
    59,
    0.0,
    1.0,
    -0.042,
    0.079,
    1.0,
    true,
    0.0,
    0.0025,
    false,
    false
FROM mock_airfoil_id;

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
SELECT id, 500000.0, 0.05, 9.0, -8.0, 14.0, 1.0, 0.108, 1.32, 54.0, 0.0085, -0.045, 13.0
FROM mock_airfoil_id
UNION ALL
SELECT id, 1000000.0, 0.08, 9.0, -8.0, 16.0, 1.0, 0.110, 1.46, 62.0, 0.0068, -0.047, 15.0
FROM mock_airfoil_id;

SELECT
    (SELECT id FROM mock_airfoil_id) AS airfoil_id,
    (SELECT COUNT(*) FROM geometry_metadata WHERE airfoil_id IN (SELECT id FROM mock_airfoil_id)) AS geometry_rows,
    (SELECT COUNT(*) FROM aerodynamic_metadata WHERE airfoil_id IN (SELECT id FROM mock_airfoil_id)) AS aero_rows;

COMMIT;

SELECT
    a.id,
    a.file_name,
    a.path,
    a.quality_flags,
    g.max_thickness,
    g.max_camber,
    COUNT(am.id) AS aero_case_count
FROM airfoils AS a
JOIN geometry_metadata AS g ON g.airfoil_id = a.id
LEFT JOIN aerodynamic_metadata AS am ON am.airfoil_id = a.id
WHERE a.path = '{mock_path}'
GROUP BY a.id, a.file_name, a.path, a.quality_flags, g.max_thickness, g.max_camber;
"""


def sql_literal(value: str) -> str:
    return value.replace("'", "''")


def main() -> int:
    mock_sql = MOCK_SQL_TEMPLATE.format(mock_path=sql_literal(MOCK_FILE_PATH))
    command = [
        "docker",
        "exec",
        "-i",
        CONTAINER_NAME,
        "psql",
        "-U",
        DB_USER,
        "-d",
        DB_NAME,
        "-P",
        "pager=off",
    ]

    result = subprocess.run(command, input=mock_sql, text=True)
    if result.returncode != 0:
        print(
            "Failed to insert mock airfoil data. Make sure the postgres Docker "
            f"container '{CONTAINER_NAME}' is running and the schema has been created.",
            file=sys.stderr,
        )
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
