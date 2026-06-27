<!-- 中文：说明 AMATUIUCDatabase 当前后端架构、数据流和主要模块职责。
English: Documents the current AMATUIUCDatabase backend architecture, data flow, and module responsibilities. -->

# Backend Architecture

The backend is a FastAPI service backed by PostgreSQL. It exposes airfoil catalog, filter, metadata, and geometry-file endpoints for the frontend.

## Runtime Stack

```text
FastAPI
  backend/app/main.py
    includes router from backend/app/01_API/airfoil_api.py
    includes router from backend/app/01_API/node_api.py

PostgreSQL
  docker-compose.yml
  database: airfoil_db
  user: airfoil_user
  host: 127.0.0.1
  port: 5432

Python data scripts
  dat_clean.py
  script/clean_database_airfoils.py
  script/geometry_batch_run.py
  script/xfoil_batch_run.py
  metadata_generation/
```

## Main Modules

`backend/app/main.py`

Creates the FastAPI app, registers the airfoil router, and defines `/health`.

`backend/app/01_API/airfoil_api.py`

Defines HTTP routes and Pydantic request/response models. This layer translates request bodies and query parameters into service calls and converts service errors into HTTP errors.

`backend/app/01_API/node_api.py`

Defines the node-graph execution HTTP contract. The current implementation validates graph structure and returns placeholder outlet results until real node executors are connected.

`backend/app/02_services/db_access.py`

Owns PostgreSQL access. It contains the generic `execute_sql()` helper and query functions for catalog, file-name lists, filters, and geometry file paths.

`backend/models/foil_metadata.py`

Defines backend dataclasses for `GeometryMetadata`, `AerodynamicMetadata`, and `FoilMetadata`. These mirror the metadata-generation model shape.

`backend/lib/metadata_ops.py`

Converts joined database rows into backend metadata objects.

`backend/database/schema/001_create_tables.sql`

Defines the PostgreSQL tables:

- `airfoils`
- `geometry_metadata`
- `aerodynamic_metadata`

For field-level details, see `docs/database_structure.md`.

`backend/database/script/insert_airfoil.py`

Imports `metadata/metadata.json` into PostgreSQL. Stored `path` values are expected to be relative to the project root.

## Data Flow

```text
coord_seligFmt/
  raw downloaded .dat files
      |
      v
coord_seligFmt_clean/
  cleaned .dat files used by frontend geometry loading
      |
      v
results_geometry/ and results_xfoil/
  generated analysis outputs
      |
      v
metadata/metadata.json
  structured metadata source
      |
      v
PostgreSQL
  airfoils, geometry_metadata, aerodynamic_metadata
      |
      v
FastAPI
  catalog, filter, metadata, geometry-file routes
  node-graph execution route
      |
      v
frontend/src/api/backend.ts
```

## Current Backend Boundaries

The API layer should stay thin:

- parse request bodies;
- read query parameters;
- call `db_access`;
- return Pydantic response models where the response shape is stable.

The service layer should stay focused on database work:

- use `execute_sql()` for SQL execution;
- return ordinary Python structures such as `list[str]` or `list[dict[str, Any]]`;
- avoid depending on FastAPI response models.

File reading currently happens in `airfoil_api.py` for `POST /airfoils/geometry/files`. The database helper returns only database-stored paths; the public API accepts file names and returns file contents keyed by file name.

The frontend currently loads all available geometry text in one batch request, then parses and maps the geometry client-side for SVG list previews and selected-airfoil viewport rendering.

## Implemented Backend Capabilities

- health check;
- all file names;
- lightweight catalog;
- geometry-file text loading by file name;
- geometry metadata filtering;
- aerodynamic metadata filtering.
- node-graph execution endpoint shape and graph validation.

## Known Gaps

- `get_metadatas()` is still a placeholder in `db_access.py`;
- `insert_metadata()` is still a placeholder in `db_access.py`;
- node-graph execution currently returns `not_implemented` placeholder results;
- geometry-file response is currently a `file_name -> raw_text` map, not parsed points;
- geometry file path resolution should be hardened further before exposing untrusted path-like inputs;
- `01_API` and `02_services` numeric package names work through `importlib`, but they are awkward import paths.
