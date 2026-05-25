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

Currently contains mock list data. The intended role is to render the real catalog from `getFullCatalogs()` and lazily request geometry text through `getGeometryFiles()`.

`frontend/src/pages/PropertiesPage.tsx`

Currently contains static form controls. The intended role is to display and edit selected airfoil, selected node, or selected filter properties.

`frontend/src/pages/NodeEditorPage.tsx`

Owns the React Flow editor state, context menu, edge connections, and the first in-memory executor.

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
  Load by file name when preview or viewport needs the cleaned .dat text.

Metadata:
  Load full structured metadata only when a detail view or node workflow needs it.

Preview:
  Keep rendering logic separate from list data loading.
```

## Known Gaps

- `AirfoilLibraryPage` still uses mock data;
- viewport geometry rendering is not wired to `getGeometryFiles()`;
- no virtualized catalog list is implemented yet;
- no preview cache is implemented yet;
- `Geometry Filter` and `Preview Output` are still placeholder graph nodes;
- node execution currently only has real behavior for the database-root node.
