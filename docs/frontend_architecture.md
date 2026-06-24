<!-- 中文：说明 AMATUIUCDatabase 当前前端架构、状态归属、页面结构和几何渲染数据流。
English: Documents the current AMATUIUCDatabase frontend architecture, state ownership, page structure, and geometry-rendering data flow. -->

# Frontend Architecture

The frontend is a Vite/React TypeScript prototype for an airfoil database workspace. It currently emphasizes a desktop-style layout, centralized backend access, SVG airfoil previews, selected-airfoil viewport rendering, and a first-pass React Flow node editor.

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

Defines the desktop-style workspace shell and owns cross-panel state:

- title bar;
- viewport panel;
- airfoil library panel;
- properties panel;
- node editor panel;
- resizable panel handles;
- selected airfoil file name;
- full geometry SVG path map shared by the list and viewport.

`frontend/src/index.css`

Defines the workspace layout, panel styling, airfoil list styling, viewport SVG styling, node editor styling, and shared node visuals.

## Backend Access

Frontend backend access lives under `frontend/src/api/`.

Current files:

- `httpClient.ts`: backend URL, shared `request<T>()`, timeout handling, abort handling, and `ApiError`;
- `airfoilApi.ts`: airfoil catalog, geometry, filter, and metadata APIs;
- `nodeGraphApi.ts`: node-graph execution request/response types and frontend wrapper;
- `backend.ts`: compatibility entry that re-exports the split modules and preserves `backendApi`.

The compatibility `backendApi` provides:

- `backendApi.health()`
- `backendApi.getAirfoilFileNames()`
- `backendApi.getFullCatalogs(reynoldsNumber)`
- `backendApi.getGeometryFiles(fileNames)`
- `backendApi.filterAirfoilsByGeometry(geoFilter)`
- `backendApi.filterAirfoilsByAero(reynoldsNumber, aeroFilter)`
- `backendApi.getMetadata(fileNames)`
- `backendApi.insertMetadata(metadata)`
- `backendApi.executeNodeGraph(graph)`

The shared HTTP client centralizes:

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

## Top-Level State Ownership

Shared UI state lives in `App.tsx` when more than one panel needs it.

```text
App.tsx
  selectedAirfoilFileName
  geometryPreviewState
    paths: Record<fileName, svgPath>
    isLoading
    errorMessage

  -> ViewportPage
       selectedAirfoilFileName
       selectedAirfoilPath
       geometry loading/error state

  -> AirfoilLibraryPage
       selectedAirfoilFileName
       onSelectAirfoil(fileName)
       previewPaths
```

`AirfoilLibraryPage` does not own geometry loading. It owns only the lightweight catalog import and list-card model creation. Geometry SVG paths are loaded once by `App.tsx` and passed to both the list preview and the viewport.

## Page-Level Modules

`frontend/src/pages/ViewportPage.tsx`

Displays the main viewport panel. It receives the selected airfoil file name, selected SVG path, and geometry loading/error state from `App.tsx`.

Current behavior:

- no selected airfoil: shows the default visualization placeholder;
- selected airfoil while geometry is loading: shows a loading message;
- selected airfoil with SVG path: renders the airfoil as an SVG path;
- selected airfoil without a path: shows a geometry-unavailable message;
- geometry load failure: shows the geometry error message.

`frontend/src/pages/AirfoilLibraryPage.tsx`

Loads the real lightweight catalog through `getFullCatalogs()` and keeps placeholder catalog records only as initial loading-state data.

Current responsibilities:

- import lightweight catalog records;
- create card view models from catalog records and the `previewPaths` prop;
- render list cards and metadata tags;
- handle click and keyboard selection;
- highlight the currently selected airfoil.

It deliberately does not load geometry files. Geometry path data is owned by `App.tsx` and passed in as `previewPaths`.

`frontend/src/pages/PropertiesPage.tsx`

Currently contains static form controls. The intended role is to display and edit selected airfoil, selected node, or selected filter properties.

`frontend/src/pages/NodeEditorPage.tsx`

Coordinates React Flow editor state, context menu, edge connections, and pinned outlet-node synchronization. Implementation details for the initial graph, graph structure helpers, and pinned outlet-node layout live under `frontend/src/features/node-editor/`.

## Feature-Level Modules

`frontend/src/features/geometry/geometry.ts`

Owns frontend-side geometry loading and rendering preparation:

- `loadAllGeometries()` loads cleaned `.dat` text through the backend API;
- `AirfoilPoint` defines one parsed coordinate point as `{ x: number, y: number }`;
- `parseAirfoilPoints(rawText)` converts raw `.dat` text into an ordered point array;
- `calculateBounds(points)` calculates the point-array bounds for later scaling and coordinate mapping;
- `filterRenderablePoints(points)` removes non-renderable points and marks whether the point set can be rendered safely;
- `processGeometries(rawFiles)` wraps raw text, filtered points, bounds, warnings, and renderability by file name;
- `mapPointsToSvg(points, bounds, options)` maps filtered airfoil points into SVG/viewBox coordinates;
- `buildSvgPath(points, closePath)` converts mapped SVG points into a `<path>` `d` string;
- `buildAirfoilSvgPath(geometry, options)` is the rendering entry for converting processed geometry into an SVG path.

The parser keeps the source point order, skips title or incomplete lines, and accepts whitespace or comma separators.
The filter removes non-finite coordinates and marks geometries with fewer than two points or zero x-span as not renderable. Processed geometry now carries bounds when at least one renderable point exists. SVG mapping defaults to a `240 x 80` viewBox, `8` padding, and chord-based scaling, while allowing callers to pass viewport-specific dimensions. Path generation keeps line segments, limits numeric output to three decimals, and leaves path closing optional.

`frontend/src/features/airfoil-library/AirfoilPreview.tsx`

Renders a real SVG path preview when the caller provides one, and falls back to `frontend/src/assets/hero.png` when geometry is unavailable or not renderable.

The component is memoized so selected-card changes do not force unchanged preview SVGs to re-render.

## Geometry Data Flow

The current geometry path flow is:

```text
App.tsx
  importAirfoilPreviewPaths()
      |
      v
frontend/src/features/geometry/geometry.ts
  loadAllGeometries()
    -> backendApi.getFullCatalogs(1_000_000)
    -> backendApi.getGeometryFiles(fileNames)
    -> fallback to single-file reads only when the batch request fails with file-level errors
      |
      v
  processGeometries(rawFiles)
    -> parseAirfoilPoints(rawText)
    -> filterRenderablePoints(points)
    -> calculateBounds(points)
      |
      v
  buildAirfoilSvgPath(geometry)
    -> mapPointsToSvg(points, bounds, options)
    -> buildSvgPath(svgPoints)
      |
      v
App geometryPreviewState.paths
  -> AirfoilLibraryPage card previews
  -> ViewportPage selected-airfoil SVG
```

The current shared path map uses the default SVG viewBox contract:

```text
viewBox: 0 0 240 80
padding: 8
scale mode: chord
```

This is sufficient for list previews and the first viewport display. Future viewport interaction can pass viewport-specific options to `buildAirfoilSvgPath()` or keep processed geometry in `App` when pan/zoom, axes, measurement tools, or hit testing need original points.

## Selection and Render Performance

Selection state is stored in `App.tsx` as `selectedAirfoilFileName`.

Current optimization boundary:

- `selectAirfoil` is wrapped in `useCallback`;
- selecting the already-selected file returns the existing state;
- `AirfoilLibraryPage` memoizes card view models with `useMemo`;
- `AirfoilCard` is memoized;
- `AirfoilPreview` is memoized.

This means a selection change should mainly affect the old selected card, the new selected card, and the viewport path. The full list still exists in the DOM, so resizing and initial list rendering can still be expensive until list virtualization is implemented.

## Node System

`frontend/src/features/nodes/TemplateNode.tsx`

Renders the shared node visual component.

`frontend/src/features/nodes/TemplateNodeModel.ts`

Defines the shared node model foundation:

- node id helpers;
- port id helpers;
- template node data;
- input/output port declarations;
- `valueKind` declarations for backend graph execution;
- node definition template;
- declarative node-definition factory.

`frontend/src/features/nodes/DatabaseRootNode.tsx`

Renders the current database-root node. Its non-React definition lives in `frontend/src/features/nodes/DatabaseRootNodeModel.ts`:

- node type;
- filename-list output port declaration;
- node factory;
- render-only React component.

`frontend/src/features/nodes/NodeEditorOutletNode.tsx`

Renders pinned outlet nodes. Its model, id helpers, factory, and pinned-position math live in `frontend/src/features/nodes/NodeEditorOutletNodeModel.ts`.

`frontend/src/features/nodes/index.ts`

Exports node helpers and registers React Flow node types.

`frontend/src/features/node-editor/nodeEditorInitialGraph.ts`

Defines the node editor's current initial nodes, initial edges, and outlet config.

`frontend/src/features/node-editor/nodeGraphStructure.ts`

Provides graph-structure helpers such as node creation order and structural-change detection. Actual node execution is intended to happen in the backend.

`frontend/src/features/node-editor/pinnedOutletNodeLayout.ts`

Synchronizes pinned outlet-node positions and viewport zoom data against the current React Flow viewport.

## Current Frontend Data Strategy

The intended data strategy is:

```text
Catalog:
  AirfoilLibraryPage loads all lightweight records once for list text and metadata tags.

Geometry files:
  App loads all cleaned .dat text once, processes it into SVG paths, and shares those paths with list previews and the viewport.

Selection:
  App owns selectedAirfoilFileName and passes it to both the list and viewport.

Metadata:
  Full structured metadata should be loaded only when a detail view or node workflow needs it.

Preview:
  Geometry parsing and SVG path generation stay in geometry.ts.
  List preview rendering stays in AirfoilPreview.tsx.
  Main viewport rendering stays in ViewportPage.tsx.
```

## Known Gaps

- The airfoil catalog list is not virtualized yet, so the full card list and SVG previews are still present in the DOM.
- Viewport rendering currently uses the same default `240 x 80` path contract as the list preview; there is no viewport-specific fit/pan/zoom model yet.
- `App.tsx` currently owns both shell layout and shared geometry path state; if the geometry state grows, it should move into a dedicated hook or provider.
- `AirfoilLibraryPage` still keeps placeholder catalog records as initial loading-state data.
- The resize handles still update CSS grid dimensions directly; large list DOM size can make resizing expensive.
- `Geometry Filter` and `Preview Output` are still placeholder graph nodes;
- node execution currently only has real behavior for the database-root node.
