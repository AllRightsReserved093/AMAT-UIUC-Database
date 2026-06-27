<!-- 中文：记录 AMATUIUCDatabase 当前后端 HTTP API 与前端 API wrapper 的对应关系。
English: Documents the current AMATUIUCDatabase backend HTTP API and frontend API wrapper mapping. -->

# API Reference

This document describes the current API surface used by the frontend and exposed by the FastAPI backend.

Base URL:

```text
http://127.0.0.1:8000
```

Frontend API wrapper:

```text
frontend/src/api/backend.ts
```

Backend router:

```text
backend/app/01_API/airfoil_api.py
backend/app/01_API/node_api.py
```

## Health

Frontend method:

```ts
backendApi.health()
```

HTTP:

```text
GET /health
```

Response:

```json
{
  "status": "ok"
}
```

## Airfoil File Names

Frontend method:

```ts
backendApi.getAirfoilFileNames()
```

HTTP:

```text
GET /airfoils
```

Response:

```ts
type FileNameListResponse = {
  file_names: string[]
}
```

## Full Catalog

Frontend method:

```ts
backendApi.getFullCatalogs(reynoldsNumber)
```

HTTP:

```text
GET /airfoils/catalog?reynolds_number=1000000
```

Query parameters:

```text
reynolds_number: float
```

Response:

```ts
type FileCatalogListResponse = {
  file_catalogs: {
    file_name: string
    file_path: string
    family_series?: string | null
    max_thickness?: number | null
    cl_cd_max?: number | null
  }[]
}
```

Current behavior:

- returns one lightweight catalog item per `airfoils` row;
- left-joins `geometry_metadata` for `max_thickness`;
- left-joins `aerodynamic_metadata` at the requested Reynolds number for `cl_cd_max`;
- returns `null` for missing joined metadata fields instead of dropping the catalog row;
- `file_path` is the project-relative path stored in PostgreSQL.

Current frontend usage:

- `AirfoilLibraryPage.tsx` uses this endpoint for the visible lightweight catalog.
- `geometry.ts` also uses this endpoint to get the complete file-name list before requesting geometry file contents.

## Geometry Files

Frontend method:

```ts
backendApi.getGeometryFiles(fileNames)
```

HTTP:

```text
POST /airfoils/geometry/files
```

Request:

```ts
type GeometryFilesRequest = {
  file_names: string[]
}
```

Response:

```ts
type GeometryFilesResponse = Record<string, string>
```

Example response:

```json
{
  "2032c.dat": "20-32C AIRFOIL\n1.0000000 0.0016000\n..."
}
```

Current behavior:

- frontend sends file names, not paths;
- backend looks up project-relative paths in PostgreSQL;
- backend returns cleaned `.dat` text from `coord_seligFmt_clean/`;
- unknown file names return HTTP 400;
- missing clean files return HTTP 404.

Current frontend usage:

- `loadAllGeometries()` sends the full catalog file-name list in one batch request.
- If a batch geometry request fails with a file-level backend error, the frontend falls back to single-file reads and keeps the files that are available.
- The response is parsed in `frontend/src/features/geometry/geometry.ts` into point arrays, bounds, renderability flags, and SVG paths.

## Geometry Filter

Frontend method:

```ts
backendApi.filterAirfoilsByGeometry(geoFilter)
```

HTTP:

```text
POST /airfoils/filter/geometry
```

Request:

```ts
type GeometryFilterRequest = {
  geo_filter: GeometryFilterValue[]
}

type GeometryFilterValue = [number | null, number | null] | boolean | null
```

Response:

```ts
type FileNameListResponse = {
  file_names: string[]
}
```

Current behavior:

- `geo_filter` order must match `GEOMETRY_FILTER_FIELDS` in `db_access.py`;
- range filters use `[min, max]`;
- boolean filters use `true`, `false`, or `null`;
- `null` disables a filter field.

## Aerodynamic Filter

Frontend method:

```ts
backendApi.filterAirfoilsByAero(reynoldsNumber, aeroFilter)
```

HTTP:

```text
POST /airfoils/filter/aero
```

Request:

```ts
type AeroFilterRequest = {
  reynolds_number: number
  aero_filter: AeroFilterValue[]
}

type AeroFilterValue = [number | null, number | null] | null
```

Response:

```ts
type FileNameListResponse = {
  file_names: string[]
}
```

Current behavior:

- `reynolds_number` is matched exactly;
- `aero_filter` order must match `AERO_FILTER_FIELDS` in `db_access.py`;
- `null` disables a filter field.

## Metadata

Frontend method:

```ts
backendApi.getMetadata(fileNames)
```

HTTP:

```text
POST /airfoils/metadata
```

Request:

```ts
type MetadataRequest = {
  file_names: string[]
}
```

Current response type in frontend:

```ts
type MetadataResponse = FoilMetadata | Record<string, FoilMetadata>
```

Current backend status:

- route exists;
- `db_access.get_metadatas()` is still a placeholder.

## Metadata Insert

Frontend method:

```ts
backendApi.insertMetadata(metadata)
```

HTTP:

```text
POST /airfoils/metadata/insert
```

Request:

```ts
{
  "metadata": FoilMetadata
}
```

Response:

```ts
type StatusResponse = {
  status: string
}
```

Current backend status:

- route exists;
- `db_access.insert_metadata()` is still a placeholder.

## Node Graph Execute

Frontend method:

```ts
backendApi.executeNodeGraph(graph)
```

HTTP:

```text
POST /node-graph/execute
```

Request:

```ts
type NodeGraphExecutionRequest = {
  graph: {
    version: number
    startNodeIds?: string[]
    nodes: {
      id: string
      type: string
      isStartNode?: boolean
      params: Record<string, unknown>
      inputs?: { id: string; label?: string; valueKind?: string }[]
      outputs?: { id: string; label?: string; valueKind?: string }[]
    }[]
    edges: {
      id: string
      source: { nodeId: string; portId: string }
      target: { nodeId: string; portId: string }
    }[]
    outlets: {
      id: string
      label?: string
      valueKind?: string
      order?: number
      inputPortId?: string
      sources: { nodeId: string; portId: string }[]
    }[]
  }
}
```

Response:

```ts
type NodeGraphExecutionResponse = {
  version: number
  status: string
  outlets: Record<string, {
    status?: string
    valueKind?: string
    data?: unknown
    message?: string
  }>
  diagnostics?: {
    level: "info" | "warning" | "error"
    message: string
    nodeId?: string
    portId?: string
    outletId?: string
  }[]
}
```

Current backend status:

- route exists;
- validates node ids, edge ids, outlet ids, and port references;
- compares frontend-provided `startNodeIds` with backend-inferred start nodes and returns a warning if they differ;
- real node graph execution is not implemented yet, so valid requests return `status: "not_implemented"` with outlet placeholder results.

## Error Handling

The frontend wrapper converts non-2xx responses into `ApiError`:

```ts
class ApiError extends Error {
  readonly status: number
  readonly payload: ApiErrorPayload | string | null
}
```

Network errors, CORS errors, and timeouts use:

```text
status = 0
```

FastAPI errors usually return:

```json
{
  "detail": "error message"
}
```
