<!-- 中文：记录删除 mock_naca2412 数据库记录后，2026-06-20 当时 AirfoilLibraryPage 全量 geometry 预览链路的历史性能采样结果。
English: Records historical 2026-06-20 AirfoilLibraryPage full-geometry preview performance samples after removing the mock_naca2412 database record. -->

# Airfoil Library Page Performance Test After Mock Cleanup - 2026-06-20

## Scope

This test repeats the same data and preview-generation pipeline measured in
`airfoil_library_page_2026-06-20.md`, after removing the stale
`mock_naca2412.dat` database record.

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
- Catalog records per run: `1665`
- Geometry files returned per run: `1665`
- Missing geometry files per run: `0`
- `geometryFallbackUsed`: `false` for every run

## Summary

Durations are in milliseconds.

| Stage | Average | Median | Min | Max |
|---|---:|---:|---:|---:|
| catalogFetchMs | 28.2 | 25.4 | 23.9 | 53.9 |
| geometryLoadMs | 327.3 | 325.4 | 313.5 | 359.4 |
| geometryProcessMs | 44.5 | 42.2 | 39.4 | 64.6 |
| previewPathBuildMs | 51.6 | 50.5 | 48.6 | 58.7 |
| cardModelBuildMs | 0.9 | 0.8 | 0.8 | 1.2 |
| totalMs | 452.4 | 444.8 | 429.8 | 513.7 |

## Raw Samples

| Run | catalogFetchMs | geometryLoadMs | geometryProcessMs | previewPathBuildMs | cardModelBuildMs | totalMs | rawGeometryCount | previewPathCount | fallback | skippedFiles |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| 1 | 53.9 | 335.2 | 64.6 | 58.7 | 1.2 | 513.7 | 1665 | 1665 | false | 0 |
| 2 | 26.7 | 359.4 | 44.8 | 56.5 | 0.9 | 488.2 | 1665 | 1665 | false | 0 |
| 3 | 25.2 | 327.2 | 45.4 | 50.3 | 0.8 | 448.9 | 1665 | 1665 | false | 0 |
| 4 | 26.1 | 313.6 | 41.2 | 51.3 | 0.9 | 433.2 | 1665 | 1665 | false | 0 |
| 5 | 25.0 | 323.5 | 42.5 | 50.0 | 0.8 | 441.8 | 1665 | 1665 | false | 0 |
| 6 | 26.4 | 313.5 | 40.5 | 48.6 | 0.8 | 429.8 | 1665 | 1665 | false | 0 |
| 7 | 25.4 | 333.2 | 43.3 | 51.3 | 0.8 | 454.1 | 1665 | 1665 | false | 0 |
| 8 | 24.3 | 315.7 | 41.9 | 49.5 | 0.8 | 432.2 | 1665 | 1665 | false | 0 |
| 9 | 23.9 | 331.4 | 41.1 | 50.6 | 0.8 | 447.9 | 1665 | 1665 | false | 0 |
| 10 | 25.3 | 320.2 | 39.4 | 48.9 | 0.8 | 434.6 | 1665 | 1665 | false | 0 |

## Comparison To Previous Run

| Metric | Before Cleanup | After Cleanup |
|---|---:|---:|
| catalogCount | 1666 | 1665 |
| rawGeometryCount | 1665 | 1665 |
| skippedFiles | 1 | 0 |
| fallbackUsed | true | false |
| average geometryLoadMs | 36762.4 | 327.3 |
| average totalMs | 36895.7 | 452.4 |

## Observations

- Removing the stale mock record fixed the fallback path.
- Full geometry loading now completes through one batch request.
- The measured data pipeline dropped from about `36.9s` to about `0.45s`.
- Geometry parsing and SVG path generation remain small compared with the old fallback cost.
- Browser DOM rendering, layout, paint, and scrolling are still not included in this measurement.
