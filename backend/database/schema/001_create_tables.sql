/*
CREATE TABLE
INSERT INTO
SELECT
ALTER TABLE
CREATE INDEX
DROP TABLE
*/

/*
INTEGER        -- 整数
BIGINT         -- 大整数
REAL           -- 单精度小数
DOUBLE PRECISION -- 双精度小数
NUMERIC        -- 精确小数，适合金额/高精度
TEXT           -- 字符串
VARCHAR(100)   -- 限长字符串
BOOLEAN        -- true / false
DATE           -- 日期
TIMESTAMP      -- 日期 + 时间
JSONB          -- JSON 数据
*/

-- Create tables for the AMAT UIUC Database
CREATE TABLE IF NOT EXISTS airfoils (
    id BIGSERIAL PRIMARY KEY,

    file_name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    family_series TEXT,
    source TEXT NOT NULL DEFAULT 'uiuc_database',

    quality_flags TEXT[] NOT NULL DEFAULT '{}',

    is_modified BOOLEAN NOT NULL DEFAULT FALSE,
    is_smooth BOOLEAN NOT NULL DEFAULT FALSE,
    is_naca BOOLEAN NOT NULL DEFAULT FALSE,
    naca_code TEXT,

    schema_version TEXT NOT NULL DEFAULT 'v1',
    generated_at_utc TIMESTAMPTZ NOT NULL,
    updated_at_utc TIMESTAMPTZ NOT NULL,
    xfoil_version TEXT
);

CREATE TABLE IF NOT EXISTS geometry_metadata (
    id BIGSERIAL PRIMARY KEY,
    airfoil_id BIGINT NOT NULL UNIQUE
        REFERENCES airfoils(id)
        ON DELETE CASCADE,

    max_thickness DOUBLE PRECISION,
    x_max_thickness DOUBLE PRECISION,
    max_camber DOUBLE PRECISION,
    x_max_camber DOUBLE PRECISION,
    area_2d DOUBLE PRECISION,
    leading_edge_radius DOUBLE PRECISION,
    trailing_edge_thickness DOUBLE PRECISION,
    trailing_edge_angle_deg DOUBLE PRECISION,

    point_count_raw INTEGER,
    point_count_clean INTEGER,
    upper_point_count INTEGER,
    lower_point_count INTEGER,

    x_min DOUBLE PRECISION,
    x_max DOUBLE PRECISION,
    y_min DOUBLE PRECISION,
    y_max DOUBLE PRECISION,
    chord_raw DOUBLE PRECISION,

    is_normalized BOOLEAN,
    te_x_gap DOUBLE PRECISION,
    te_y_gap DOUBLE PRECISION,
    is_closed_curve BOOLEAN,
    is_multi_element BOOLEAN
);

CREATE TABLE IF NOT EXISTS aerodynamic_metadata (
    id BIGSERIAL PRIMARY KEY,
    airfoil_id BIGINT NOT NULL
        REFERENCES airfoils(id)
        ON DELETE CASCADE,

    reynolds_number DOUBLE PRECISION,
    mach_number DOUBLE PRECISION,
    n_crit DOUBLE PRECISION,

    alpha_min_deg DOUBLE PRECISION,
    alpha_max_deg DOUBLE PRECISION,
    alpha_step_deg DOUBLE PRECISION,

    cl_alpha DOUBLE PRECISION,
    cl_max DOUBLE PRECISION,
    cl_cd_max DOUBLE PRECISION,
    cd_min DOUBLE PRECISION,
    cm_0 DOUBLE PRECISION,
    alpha_stall_deg DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_airfoils_file_name
    ON airfoils(file_name);

CREATE INDEX IF NOT EXISTS idx_airfoils_naca_code
    ON airfoils(naca_code);

CREATE INDEX IF NOT EXISTS idx_aero_airfoil_id
    ON aerodynamic_metadata(airfoil_id);

CREATE INDEX IF NOT EXISTS idx_aero_reynolds_number
    ON aerodynamic_metadata(reynolds_number);
