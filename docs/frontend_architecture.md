<!-- 中文：说明 AMATUIUCDatabase 当前前端架构、页面结构和数据访问方式。
English: Documents the current AMATUIUCDatabase frontend architecture, page structure, and data access approach. -->

# Frontend Architecture

The frontend is a Vite/React TypeScript prototype for an airfoil database workspace. It currently emphasizes a desktop-style layout, centralized backend access, and a first-pass React Flow node editor.

## Runtime Stack

```text
Vite
React
TypeScript
@xyflow/react
```

## Main Entry Points

`frontend/src/main.tsx`

Mounts the React app.

`frontend/src/App.tsx`

Defines the desktop-style workspace shell:

- title bar;
- viewport panel;
- airfoil library panel;
- properties panel;
- node editor panel;
- resizable panel handles.

`frontend/src/index.css`

Defines the workspace layout, panel styling, airfoil list styling, node editor styling, and shared node visuals.

## Backend Access

`frontend/src/api/backend.ts` is the single frontend API boundary.

It provides:

- `backendApi.health()`
- `backendApi.getAirfoilFileNames()`
- `backendApi.getFullCatalogs(reynoldsNumber)`
- `backendApi.getGeometryFiles(fileNames)`
- `backendApi.filterAirfoilsByGeometry(geoFilter)`
- `backendApi.filterAirfoilsByAero(reynoldsNumber, aeroFilter)`
- `backendApi.getMetadata(fileNames)`
- `backendApi.insertMetadata(metadata)`

The wrapper centralizes:

- backend URL construction;
- JSON serialization;
- response parsing;
- request timeout;
- abort handling;
- normalized `ApiError` creation.

The default backend URL is:

```text
http://127.0.0.1:8000
```

It can be overridden with `VITE_BACKEND_URL`.

## Page-Level Modules

`frontend/src/pages/ViewportPage.tsx`

Currently displays the main preview area and placeholder visualization content. The intended role is detailed geometry preview and future analysis-result rendering.

`frontend/src/pages/AirfoilLibraryPage.tsx`

Loads the real lightweight catalog through `getFullCatalogs()` and keeps placeholder catalog records as an initial fallback. Its intended role is to render catalog text and pass geometry rendering work to feature-level geometry modules.

`frontend/src/pages/PropertiesPage.tsx`

Currently contains static form controls. The intended role is to display and edit selected airfoil, selected node, or selected filter properties.

`frontend/src/pages/NodeEditorPage.tsx`

Owns the React Flow editor state, context menu, edge connections, and the first in-memory executor.

## Feature-Level Modules

`frontend/src/features/geometry/geometry.ts`

Owns frontend-side geometry loading and the first rendering-preparation step:

- `loadAllGeometries()` loads cleaned `.dat` text through the backend API;
- `AirfoilPoint` defines one parsed coordinate point as `{ x: number, y: number }`;
- `parseAirfoilPoints(rawText)` converts raw `.dat` text into an ordered point array;
- `calculateBounds(points)` calculates the point-array bounds for later scaling and coordinate mapping;
- `mapPointsToSvg(points, bounds, options)` maps filtered airfoil points into SVG/viewBox coordinates;
- `buildSvgPath(points, closePath)` converts mapped SVG points into a `<path>` `d` string;
- `buildAirfoilSvgPath(geometry, options)` is the rendering entry for converting processed geometry into an SVG path;
- `filterRenderablePoints(points)` removes non-renderable points and marks whether the point set can be rendered safely;
- `processGeometries(rawFiles)` wraps raw text and parsed points by file name.

The parser keeps the source point order, skips title or incomplete lines, and accepts whitespace or comma separators.
The filter removes non-finite coordinates and marks geometries with fewer than two points or zero x-span as not renderable. Processed geometry now carries bounds when at least one renderable point exists. SVG mapping defaults to a `240 x 80` viewBox, `8` padding, and chord-based scaling, while allowing callers to pass viewport-specific dimensions. Path generation keeps line segments, limits numeric output to three decimals, and leaves path closing optional.

`frontend/src/features/airfoil-library/AirfoilPreview.tsx`

Renders a real SVG path preview when the airfoil library page provides one, and falls back to the placeholder image when geometry is unavailable or not renderable.

## Node System

`frontend/src/features/nodes/TemplateNode.tsx`

Defines the shared node visual model:

- node id helpers;
- port id helpers;
- template node data;
- output status;
- abstract node definition base class;
- shared renderer.

`frontend/src/features/nodes/DatabaseRootNode.tsx`

Defines the current database-root node:

- node type;
- filename-list output;
- node factory;
- backend execution function through `backendApi.getAirfoilFileNames()`;
- render-only React component.

`frontend/src/features/nodes/index.ts`

Exports node helpers and registers React Flow node types.

## Current Frontend Data Strategy

The intended data strategy is:

```text
Catalog:
  Load all lightweight records once.

Geometry files:
  Load cleaned .dat text, then convert it into point arrays before preview or viewport rendering.

Metadata:
  Load full structured metadata only when a detail view or node workflow needs it.

Preview:
  Keep rendering logic separate from list data loading.
```

## Known Gaps

- `AirfoilLibraryPage` still keeps placeholder data as an initial fallback;
- viewport geometry rendering is not wired to the parsed geometry point arrays;
- generated SVG paths are wired into list previews but not into the viewport UI yet;
- no virtualized catalog list is implemented yet;
- no preview cache is implemented yet;
- `Geometry Filter` and `Preview Output` are still placeholder graph nodes;
- node execution currently only has real behavior for the database-root node.
