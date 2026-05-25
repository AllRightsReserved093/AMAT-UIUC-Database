<!-- 中文：说明 AMATUIUCDatabase 当前 PostgreSQL 数据库表结构、字段含义和表关系。 English: Documents the current AMATUIUCDatabase PostgreSQL schema, field meanings, and table relationships. -->

# Database Structure

The database schema is defined in:

```text
backend/database/schema/001_create_tables.sql
```

The current schema stores one core airfoil record, one geometry metadata record, and zero or more aerodynamic metadata records.

```text
airfoils
  1 -> 0..1 geometry_metadata
  1 -> 0..n aerodynamic_metadata
```

## Tables

### airfoils

`airfoils` is the root table. Each row represents one airfoil source file known to the project.

| Column | Type | Meaning |
| --- | --- | --- |
| `id` | `BIGSERIAL` | Internal primary key. |
| `file_name` | `TEXT` | File name shown to the frontend, for example `2032c.dat`. |
| `path` | `TEXT` | Project-relative file path. This is unique and is used for file lookup. |
| `family_series` | `TEXT` | Optional family or series label. |
| `source` | `TEXT` | Data source label. Defaults to `uiuc_database`. |
| `quality_flags` | `TEXT[]` | List of quality or preprocessing notes. |
| `is_modified` | `BOOLEAN` | Whether the airfoil is a modified variant. |
| `is_smooth` | `BOOLEAN` | Whether the airfoil is marked as smoothed. |
| `is_naca` | `BOOLEAN` | Whether the file is recognized as a NACA airfoil. |
| `naca_code` | `TEXT` | Parsed NACA code when available. |
| `schema_version` | `TEXT` | Metadata schema version. |
| `generated_at_utc` | `TIMESTAMPTZ` | Time when the metadata was generated. |
| `updated_at_utc` | `TIMESTAMPTZ` | Time when the metadata row was last updated. |
| `xfoil_version` | `TEXT` | XFoil version used for aerodynamic data, when known. |

Important constraints:

- `id` is the primary key.
- `path` is unique.
- `file_name` is indexed but is not currently unique.
- deleting an airfoil cascades to related metadata rows.

### geometry_metadata

`geometry_metadata` stores shape-derived values for an airfoil. It is currently one-to-one with `airfoils`.

| Column | Type | Meaning |
| --- | --- | --- |
| `id` | `BIGSERIAL` | Internal primary key. |
| `airfoil_id` | `BIGINT` | Foreign key to `airfoils.id`; unique. |
| `max_thickness` | `DOUBLE PRECISION` | Maximum thickness. |
| `x_max_thickness` | `DOUBLE PRECISION` | X location of maximum thickness. |
| `max_camber` | `DOUBLE PRECISION` | Maximum camber. |
| `x_max_camber` | `DOUBLE PRECISION` | X location of maximum camber. |
| `area_2d` | `DOUBLE PRECISION` | Approximate 2D enclosed area. |
| `leading_edge_radius` | `DOUBLE PRECISION` | Leading-edge radius estimate. |
| `trailing_edge_thickness` | `DOUBLE PRECISION` | Trailing-edge thickness estimate. |
| `trailing_edge_angle_deg` | `DOUBLE PRECISION` | Trailing-edge angle in degrees. |
| `point_count_raw` | `INTEGER` | Number of points in the raw coordinate file. |
| `point_count_clean` | `INTEGER` | Number of points after cleaning. |
| `upper_point_count` | `INTEGER` | Number of upper-surface points. |
| `lower_point_count` | `INTEGER` | Number of lower-surface points. |
| `x_min` | `DOUBLE PRECISION` | Minimum x coordinate. |
| `x_max` | `DOUBLE PRECISION` | Maximum x coordinate. |
| `y_min` | `DOUBLE PRECISION` | Minimum y coordinate. |
| `y_max` | `DOUBLE PRECISION` | Maximum y coordinate. |
| `chord_raw` | `DOUBLE PRECISION` | Raw chord length estimate. |
| `is_normalized` | `BOOLEAN` | Whether coordinates are normalized. |
| `te_x_gap` | `DOUBLE PRECISION` | Trailing-edge x gap. |
| `te_y_gap` | `DOUBLE PRECISION` | Trailing-edge y gap. |
| `is_closed_curve` | `BOOLEAN` | Whether the geometry is treated as closed. |
| `is_multi_element` | `BOOLEAN` | Whether the airfoil appears to contain multiple elements. |

Important constraints:

- `airfoil_id` references `airfoils.id`.
- `airfoil_id` is unique, so each airfoil can have only one geometry metadata row.
- `ON DELETE CASCADE` removes geometry metadata when the parent airfoil is deleted.

### aerodynamic_metadata

`aerodynamic_metadata` stores aerodynamic summary values. An airfoil may have multiple rows for different Reynolds numbers, Mach numbers, or analysis settings.

| Column | Type | Meaning |
| --- | --- | --- |
| `id` | `BIGSERIAL` | Internal primary key. |
| `airfoil_id` | `BIGINT` | Foreign key to `airfoils.id`. |
| `reynolds_number` | `DOUBLE PRECISION` | Reynolds number for this analysis row. |
| `mach_number` | `DOUBLE PRECISION` | Mach number for this analysis row. |
| `n_crit` | `DOUBLE PRECISION` | XFoil transition parameter. |
| `alpha_min_deg` | `DOUBLE PRECISION` | Minimum angle of attack in the analysis sweep. |
| `alpha_max_deg` | `DOUBLE PRECISION` | Maximum angle of attack in the analysis sweep. |
| `alpha_step_deg` | `DOUBLE PRECISION` | Angle-of-attack step size. |
| `cl_alpha` | `DOUBLE PRECISION` | Lift-curve slope estimate. |
| `cl_max` | `DOUBLE PRECISION` | Maximum lift coefficient. |
| `cl_cd_max` | `DOUBLE PRECISION` | Maximum lift-to-drag ratio. |
| `cd_min` | `DOUBLE PRECISION` | Minimum drag coefficient. |
| `cm_0` | `DOUBLE PRECISION` | Pitching moment coefficient near zero lift or reference condition. |
| `alpha_stall_deg` | `DOUBLE PRECISION` | Estimated stall angle. |

Important constraints:

- `airfoil_id` references `airfoils.id`.
- multiple aerodynamic rows can exist for the same airfoil.
- there is currently no uniqueness constraint for `(airfoil_id, reynolds_number, mach_number, n_crit)`.
- `ON DELETE CASCADE` removes aerodynamic metadata when the parent airfoil is deleted.

## Indexes

The schema currently defines these indexes:

| Index | Table | Column | Purpose |
| --- | --- | --- | --- |
| `idx_airfoils_file_name` | `airfoils` | `file_name` | Faster file-name lookup and list queries. |
| `idx_airfoils_naca_code` | `airfoils` | `naca_code` | Faster NACA-code lookup. |
| `idx_aero_airfoil_id` | `aerodynamic_metadata` | `airfoil_id` | Faster joins from aerodynamic rows to airfoils. |
| `idx_aero_reynolds_number` | `aerodynamic_metadata` | `reynolds_number` | Faster Reynolds-number filtering. |

## Current Query Assumptions

The frontend-facing catalog query currently joins all three tables:

```text
airfoils
  JOIN geometry_metadata ON geometry_metadata.airfoil_id = airfoils.id
  JOIN aerodynamic_metadata ON aerodynamic_metadata.airfoil_id = airfoils.id
```

Then it filters aerodynamic rows by `reynolds_number`.

This means catalog results require:

- one matching `airfoils` row;
- one matching `geometry_metadata` row;
- one matching `aerodynamic_metadata` row at the requested Reynolds number.

If an airfoil exists but does not have matching geometry or aerodynamic metadata, the current catalog query will not return it.

## File Path Assumptions

`airfoils.path` is stored as a project-relative path. The geometry-file API currently uses the stored path to find cleaned coordinate files under:

```text
coord_seligFmt_clean/
```

The frontend should request geometry files by `file_name`, not by path. Path lookup stays inside the backend.
