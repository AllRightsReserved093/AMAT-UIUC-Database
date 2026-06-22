<!-- 中文：记录 2026-06-20 当时 AirfoilLibraryPage 全量 geometry 预览链路的历史性能采样结果。
English: Records historical 2026-06-20 performance samples for the then-current full-geometry preview pipeline in AirfoilLibraryPage. -->

# Airfoil Library Page Performance Test - 2026-06-20

## Scope

This test measured the data and preview-generation pipeline used by `AirfoilLibraryPage.tsx` on 2026-06-20.

Current note: geometry loading and SVG path ownership later moved to `App.tsx`, so this file is a historical benchmark for the earlier page-owned pipeline.

Measured pipeline per run:

```text
getFullCatalogs()
loadAllGeometries()
processGeometries()
createAirfoilPreviewPathMap()
createAirfoilCardViewModel()
```

The test does not measure browser DOM layout, paint, or scroll interaction.

## Test Setup

- Run count: 10
- Backend: `http://127.0.0.1:8000`
- Catalog Reynolds number: `1000000`
- Catalog records per run: `1666`
- Geometry files returned per run: `1665`
- Missing geometry files per run: `1`
- `geometryFallbackUsed`: `true` for every run

The page was temporarily changed into a performance-test version with:

```text
ENABLE_PERFORMANCE_TEST_MODE = true
PERFORMANCE_TEST_RUN_COUNT = 10
```

Backup file:

```text
frontend/src/pages/AirfoilLibraryPage.backup.2026-06-20-performance-test.tsx.bak
```

## Summary

Durations are in milliseconds.

| Stage | Average | Median | Min | Max |
|---|---:|---:|---:|---:|
| catalogFetchMs | 37.4 | 25.8 | 23.8 | 111.1 |
| geometryLoadMs | 36762.4 | 36335.0 | 34751.3 | 42896.2 |
| geometryProcessMs | 42.0 | 41.6 | 38.0 | 48.5 |
| previewPathBuildMs | 53.4 | 52.6 | 49.5 | 60.8 |
| cardModelBuildMs | 0.5 | 0.5 | 0.4 | 0.6 |
| totalMs | 36895.7 | 36456.9 | 34870.5 | 43117.2 |

## Raw Samples

| Run | catalogFetchMs | geometryLoadMs | geometryProcessMs | previewPathBuildMs | cardModelBuildMs | totalMs | rawGeometryCount | previewPathCount | fallback | skippedFiles |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| 1 | 111.1 | 42896.2 | 48.5 | 60.8 | 0.6 | 43117.2 | 1665 | 1665 | true | 1 |
| 2 | 43.0 | 37405.7 | 44.7 | 55.6 | 0.5 | 37549.6 | 1665 | 1665 | true | 1 |
| 3 | 24.2 | 34975.4 | 43.9 | 51.6 | 0.5 | 35095.6 | 1665 | 1665 | true | 1 |
| 4 | 35.9 | 34773.3 | 38.0 | 53.5 | 0.5 | 34901.2 | 1665 | 1665 | true | 1 |
| 5 | 24.8 | 34751.3 | 40.9 | 53.0 | 0.4 | 34870.5 | 1665 | 1665 | true | 1 |
| 6 | 25.3 | 34983.2 | 42.9 | 55.8 | 0.4 | 35107.7 | 1665 | 1665 | true | 1 |
| 7 | 25.4 | 36976.6 | 41.8 | 52.0 | 0.4 | 37096.1 | 1665 | 1665 | true | 1 |
| 8 | 26.2 | 36914.9 | 39.0 | 49.5 | 0.5 | 37030.0 | 1665 | 1665 | true | 1 |
| 9 | 23.8 | 38192.5 | 39.1 | 49.8 | 0.4 | 38305.5 | 1665 | 1665 | true | 1 |
| 10 | 34.7 | 35755.1 | 41.4 | 52.2 | 0.4 | 35883.7 | 1665 | 1665 | true | 1 |

## Initial Observations

- The dominant measured delay is `geometryLoadMs`.
- `geometryLoadMs` accounts for almost all measured total time.
- `processGeometries()` and preview path generation are small compared with geometry loading.
- The current `loadAllGeometries()` path falls back every run because one catalog entry has no matching geometry file.
- That fallback means the frontend issues many single-file geometry requests after the full batch fails.
- React DOM render, browser layout, and paint are not included in this measurement.
