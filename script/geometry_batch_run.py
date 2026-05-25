"""中文：批量运行 coord_seligFmt_clean 翼型几何分析。
English: Batch-runs geometry analysis for coord_seligFmt_clean airfoils.

Features:
- 3 groups in parallel.
- Each group uses 5 worker processes.
- Per-airfoil JSON output: <stem>_geometry_result.json
- Resume support via _progress.json
- Atomic writes to avoid broken JSON files.
"""

from __future__ import annotations

import gc
import hashlib
import json
import multiprocessing as mp
import os
import signal
import sys
import time
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
from concurrent.futures.process import BrokenProcessPool
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np


# Ensure project root is on sys.path when running this file directly.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from dat_clean import COORD_LINE_RE
from paths import CLEAN_COORD_DIR
from paths import RAW_COORD_DIR
from paths import RESULTS_GEOMETRY_DIR


# ------------------------------ Config ------------------------------
RAW_INPUT_DIR = RAW_COORD_DIR
INPUT_DIR = CLEAN_COORD_DIR
OUTPUT_DIR = RESULTS_GEOMETRY_DIR
PROGRESS_FILE = OUTPUT_DIR / "_progress.json"

WORKER_CPU_SET: tuple[int, ...] = tuple(range(1, 16))
WORKER_COUNT = 15
CHUNK_SIZE = 24
RESULT_FLUSH_BATCH_SIZE = 100
MAX_TASKS_PER_CHILD = 100

PROFILE_X_GRID_METHOD = "surface_union_x"
REUSE_EXISTING_RESULTS = True
NORMALIZED_X_TOL = 0.05
NORMALIZED_CHORD_TOL = 0.05
CLOSED_CURVE_TOL = 1e-4
SIGN_CHANGE_TOL = 1e-6


# ------------------------------ Helpers ------------------------------
def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def make_output_path(dat_path: Path) -> Path:
    return OUTPUT_DIR / f"{dat_path.stem}_geometry_result.json"


def atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload_text = json.dumps(payload, ensure_ascii=False, indent=2)
    for attempt in range(30):
        try:
            with path.open("w", encoding="utf-8", newline="\n") as f:
                f.write(payload_text)
            return
        except PermissionError:
            if attempt == 29:
                raise
            time.sleep(0.05)


def cleanup_temp_files(output_dir: Path) -> None:
    if not output_dir.exists():
        return
    for tmp_file in output_dir.glob("*.tmp"):
        try:
            tmp_file.chmod(0o666)
            tmp_file.unlink()
        except OSError:
            pass


def parse_dat_points(dat_path: Path) -> np.ndarray:
    points: list[tuple[float, float]] = []

    with dat_path.open("r", encoding="utf-8", errors="ignore") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line:
                continue
            match = COORD_LINE_RE.match(line)
            if not match:
                continue
            points.append((float(match.group(1)), float(match.group(2))))

    if len(points) < 3:
        raise ValueError(f"Not enough coordinate points: {dat_path}")
    return np.asarray(points, dtype=float)


def count_coord_points(dat_path: Path) -> int | None:
    if not dat_path.exists():
        return None

    count = 0
    with dat_path.open("r", encoding="utf-8", errors="ignore") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line:
                continue
            if COORD_LINE_RE.match(line):
                count += 1
    return count


def build_config_dict() -> dict[str, Any]:
    return {
        "raw_input_dir": str(RAW_INPUT_DIR),
        "input_dir": str(INPUT_DIR),
        "profile_x_grid_method": PROFILE_X_GRID_METHOD,
        "normalized_x_tol": NORMALIZED_X_TOL,
        "normalized_chord_tol": NORMALIZED_CHORD_TOL,
        "closed_curve_tol": CLOSED_CURVE_TOL,
        "sign_change_tol": SIGN_CHANGE_TOL,
    }


def config_fingerprint(config: dict[str, Any]) -> str:
    payload = json.dumps(config, sort_keys=True, ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def default_progress(config: dict[str, Any], ordered_files: list[str]) -> dict[str, Any]:
    return {
        "version": "v1",
        "created_at_utc": now_utc_iso(),
        "updated_at_utc": now_utc_iso(),
        "config": config,
        "config_fingerprint": config_fingerprint(config),
        "ordered_files": ordered_files,
        "done": [],
        "failed": {},
        "in_progress": [],
    }


def load_progress(config: dict[str, Any], ordered_files: list[str]) -> dict[str, Any]:
    if not PROGRESS_FILE.exists():
        return default_progress(config, ordered_files)

    try:
        with PROGRESS_FILE.open("r", encoding="utf-8") as f:
            progress = json.load(f)
    except (OSError, json.JSONDecodeError):
        return default_progress(config, ordered_files)

    if not isinstance(progress, dict):
        return default_progress(config, ordered_files)

    if progress.get("config_fingerprint") != config_fingerprint(config):
        return default_progress(config, ordered_files)

    progress["ordered_files"] = ordered_files
    progress["updated_at_utc"] = now_utc_iso()
    progress.setdefault("done", [])
    progress.setdefault("failed", {})
    progress.setdefault("in_progress", [])
    return progress


def save_progress(progress: dict[str, Any]) -> None:
    progress["updated_at_utc"] = now_utc_iso()
    atomic_write_json(PROGRESS_FILE, progress)


def is_valid_result_file(result_file: Path, stem: str, expected_fp: str) -> bool:
    if not result_file.exists():
        return False

    try:
        with result_file.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return False

    if not isinstance(data, dict):
        return False
    if data.get("file_stem") != stem:
        return False
    if not REUSE_EXISTING_RESULTS and data.get("config_fingerprint") != expected_fp:
        return False
    geometry_metadata = data.get("geometry_metadata")
    if not isinstance(geometry_metadata, dict):
        return False
    if data.get("status") not in {"ok", "error"}:
        return False
    return True


def set_process_affinity(cpu_ids: tuple[int, ...]) -> None:
    if not cpu_ids:
        return
    if os.name == "nt":
        import ctypes

        mask = 0
        for cpu_id in cpu_ids:
            mask |= 1 << cpu_id
        handle = ctypes.windll.kernel32.GetCurrentProcess()
        ctypes.windll.kernel32.SetProcessAffinityMask(handle, mask)
        return

    if hasattr(os, "sched_setaffinity"):
        os.sched_setaffinity(0, set(cpu_ids))


def worker_initializer(cpu_ids: tuple[int, ...]) -> None:
    try:
        set_process_affinity(cpu_ids)
    except Exception:
        pass


def _safe_float(value: float | np.floating[Any] | None) -> float | None:
    if value is None:
        return None
    return float(value)


def build_empty_geometry_metadata() -> dict[str, Any]:
    return {
        "max_thickness": None,
        "x_max_thickness": None,
        "max_camber": None,
        "x_max_camber": None,
        "area_2d": None,
        "leading_edge_radius": None,
        "trailing_edge_thickness": None,
        "trailing_edge_angle_deg": None,
        "point_count_raw": None,
        "point_count_clean": None,
        "upper_point_count": None,
        "lower_point_count": None,
        "x_min": None,
        "x_max": None,
        "y_min": None,
        "y_max": None,
        "chord_raw": None,
        "is_normalized": None,
        "te_x_gap": None,
        "te_y_gap": None,
        "is_closed_curve": None,
        "is_multi_element": None,
    }


def polygon_area(points: np.ndarray) -> float:
    x = points[:, 0]
    y = points[:, 1]
    return float(0.5 * abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1))))


def circumradius(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float | None:
    ab = float(np.linalg.norm(a - b))
    bc = float(np.linalg.norm(b - c))
    ca = float(np.linalg.norm(c - a))
    cross = float(abs(np.cross(b - a, c - a)))
    if cross <= 1e-12:
        return None
    return (ab * bc * ca) / (2.0 * cross)


def compress_sign_changes(x: np.ndarray) -> int:
    dx = np.diff(x)
    dx = dx[np.abs(dx) > SIGN_CHANGE_TOL]
    if dx.size == 0:
        return 0

    signs = np.sign(dx)
    compressed = [int(signs[0])]
    for sign in signs[1:]:
        sign_i = int(sign)
        if sign_i != compressed[-1]:
            compressed.append(sign_i)
    return max(0, len(compressed) - 1)


def split_upper_lower(points: np.ndarray) -> tuple[np.ndarray, np.ndarray, int]:
    le_idx = int(np.argmin(points[:, 0]))
    if le_idx <= 0 or le_idx >= points.shape[0] - 1:
        raise ValueError("Leading edge split failed")

    upper = points[: le_idx + 1]
    lower = points[le_idx:]
    if upper.shape[0] < 2 or lower.shape[0] < 2:
        raise ValueError("Not enough upper/lower surface points")
    return upper, lower, le_idx


def prepare_surface(surface: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    xs = surface[:, 0]
    ys = surface[:, 1]
    if xs[0] > xs[-1]:
        xs = xs[::-1]
        ys = ys[::-1]

    unique_x, unique_idx = np.unique(xs, return_index=True)
    unique_y = ys[unique_idx]
    return unique_x, unique_y


def build_profile_x_grid(
    x_upper: np.ndarray,
    x_lower: np.ndarray,
    x_common_min: float,
    x_common_max: float,
) -> np.ndarray:
    x_grid = np.unique(np.concatenate((x_upper, x_lower)))
    return x_grid[(x_grid >= x_common_min) & (x_grid <= x_common_max)]


def compute_trailing_edge_angle_deg(points: np.ndarray) -> float | None:
    if points.shape[0] < 4:
        return None

    upper_vec = points[1] - points[0]
    lower_vec = points[-2] - points[-1]

    upper_norm = float(np.linalg.norm(upper_vec))
    lower_norm = float(np.linalg.norm(lower_vec))
    if upper_norm <= 1e-12 or lower_norm <= 1e-12:
        return None

    cos_theta = float(np.dot(upper_vec, lower_vec) / (upper_norm * lower_norm))
    cos_theta = max(-1.0, min(1.0, cos_theta))
    return float(np.degrees(np.arccos(cos_theta)))


def compute_profile_metrics(points: np.ndarray) -> dict[str, Any]:
    metrics: dict[str, Any] = {
        "max_thickness": None,
        "x_max_thickness": None,
        "max_camber": None,
        "x_max_camber": None,
        "leading_edge_radius": None,
        "upper_point_count": None,
        "lower_point_count": None,
        "is_multi_element": None,
    }

    try:
        upper, lower, le_idx = split_upper_lower(points)
    except Exception:
        metrics["is_multi_element"] = bool(compress_sign_changes(points[:, 0]) > 1)
        return metrics

    metrics["upper_point_count"] = int(upper.shape[0])
    metrics["lower_point_count"] = int(lower.shape[0])

    sign_change_count = compress_sign_changes(points[:, 0])
    is_multi_element = sign_change_count > 1
    metrics["is_multi_element"] = bool(is_multi_element)

    if le_idx > 0 and le_idx < points.shape[0] - 1:
        metrics["leading_edge_radius"] = _safe_float(
            circumradius(points[le_idx - 1], points[le_idx], points[le_idx + 1])
        )

    if is_multi_element:
        return metrics

    x_upper, y_upper = prepare_surface(upper)
    x_lower, y_lower = prepare_surface(lower)
    if x_upper.size < 2 or x_lower.size < 2:
        return metrics

    # Keep upper/lower role consistent before interpolation.
    if float(np.mean(y_upper)) < float(np.mean(y_lower)):
        x_upper, y_upper, x_lower, y_lower = x_lower, y_lower, x_upper, y_upper

    x_common_min = max(float(x_upper[0]), float(x_lower[0]))
    x_common_max = min(float(x_upper[-1]), float(x_lower[-1]))
    if x_common_max <= x_common_min:
        return metrics

    x_grid = build_profile_x_grid(x_upper, x_lower, x_common_min, x_common_max)
    if x_grid.size < 2:
        return metrics

    y_upper_grid = np.interp(x_grid, x_upper, y_upper)
    y_lower_grid = np.interp(x_grid, x_lower, y_lower)

    thickness = y_upper_grid - y_lower_grid
    camber = 0.5 * (y_upper_grid + y_lower_grid)

    thickness_idx = int(np.argmax(thickness))
    metrics["max_thickness"] = _safe_float(thickness[thickness_idx])
    metrics["x_max_thickness"] = _safe_float(x_grid[thickness_idx])

    camber_idx = int(np.argmax(np.abs(camber)))
    metrics["max_camber"] = _safe_float(abs(camber[camber_idx]))
    metrics["x_max_camber"] = _safe_float(x_grid[camber_idx])

    return metrics


def build_geometry_metadata(clean_dat_path: Path) -> dict[str, Any]:
    raw_dat_path = RAW_INPUT_DIR / clean_dat_path.name
    points = parse_dat_points(clean_dat_path)

    x = points[:, 0]
    y = points[:, 1]

    x_min = float(np.min(x))
    x_max = float(np.max(x))
    y_min = float(np.min(y))
    y_max = float(np.max(y))

    te_x_gap = float(abs(points[0, 0] - points[-1, 0]))
    te_y_gap = float(abs(points[0, 1] - points[-1, 1]))
    trailing_edge_thickness = float(np.hypot(te_x_gap, te_y_gap))
    chord_raw = float(x_max - x_min)

    profile_metrics = compute_profile_metrics(points)

    return {
        "max_thickness": profile_metrics["max_thickness"],
        "x_max_thickness": profile_metrics["x_max_thickness"],
        "max_camber": profile_metrics["max_camber"],
        "x_max_camber": profile_metrics["x_max_camber"],
        "area_2d": _safe_float(polygon_area(points)),
        "leading_edge_radius": profile_metrics["leading_edge_radius"],
        "trailing_edge_thickness": _safe_float(trailing_edge_thickness),
        "trailing_edge_angle_deg": _safe_float(compute_trailing_edge_angle_deg(points)),
        "point_count_raw": count_coord_points(raw_dat_path),
        "point_count_clean": int(points.shape[0]),
        "upper_point_count": profile_metrics["upper_point_count"],
        "lower_point_count": profile_metrics["lower_point_count"],
        "x_min": _safe_float(x_min),
        "x_max": _safe_float(x_max),
        "y_min": _safe_float(y_min),
        "y_max": _safe_float(y_max),
        "chord_raw": _safe_float(chord_raw),
        "is_normalized": bool(
            abs(x_min) <= NORMALIZED_X_TOL and abs(chord_raw - 1.0) <= NORMALIZED_CHORD_TOL
        ),
        "te_x_gap": _safe_float(te_x_gap),
        "te_y_gap": _safe_float(te_y_gap),
        "is_closed_curve": bool(trailing_edge_thickness <= CLOSED_CURVE_TOL),
        "is_multi_element": profile_metrics["is_multi_element"],
    }


def build_success_payload(dat_path: Path, config_fp: str) -> dict[str, Any]:
    raw_dat_path = RAW_INPUT_DIR / dat_path.name
    geometry_metadata = build_geometry_metadata(dat_path)
    return {
        "file_name": dat_path.name,
        "file_stem": dat_path.stem,
        "source_clean_dat_path": str(dat_path.resolve()),
        "source_raw_dat_path": str(raw_dat_path.resolve()) if raw_dat_path.exists() else None,
        "status": "ok",
        "generated_at_utc": now_utc_iso(),
        "config_fingerprint": config_fp,
        "geometry_metadata": geometry_metadata,
        "errors": [],
    }


def build_error_payload(dat_path: Path, config_fp: str, exc: Exception | str) -> dict[str, Any]:
    raw_dat_path = RAW_INPUT_DIR / dat_path.name
    error_type = type(exc).__name__ if not isinstance(exc, str) else "RuntimeError"
    error_message = str(exc)
    return {
        "file_name": dat_path.name,
        "file_stem": dat_path.stem,
        "source_clean_dat_path": str(dat_path.resolve()),
        "source_raw_dat_path": str(raw_dat_path.resolve()) if raw_dat_path.exists() else None,
        "status": "error",
        "generated_at_utc": now_utc_iso(),
        "config_fingerprint": config_fp,
        "geometry_metadata": build_empty_geometry_metadata(),
        "errors": [
            {
                "error_type": error_type,
                "error_message": error_message,
            }
        ],
    }


def run_single_geometry(dat_path_str: str, config_fp: str) -> dict[str, Any]:
    dat_path = Path(dat_path_str)
    try:
        return build_success_payload(dat_path, config_fp)
    except Exception as exc:
        return build_error_payload(dat_path, config_fp, exc)
    finally:
        gc.collect()


def run_geometry_chunk(
    jobs: list[tuple[int, str]],
    config_fp: str,
) -> list[tuple[int, str, dict[str, Any]]]:
    results: list[tuple[int, str, dict[str, Any]]] = []
    for job_index, dat_path_str in jobs:
        payload = run_single_geometry(dat_path_str, config_fp)
        results.append((job_index, dat_path_str, payload))
    gc.collect()
    return results


def create_worker_pool(mp_ctx: Any) -> Any:
    try:
        return ProcessPoolExecutor(
            max_workers=WORKER_COUNT,
            mp_context=mp_ctx,
            initializer=worker_initializer,
            initargs=(WORKER_CPU_SET,),
            max_tasks_per_child=MAX_TASKS_PER_CHILD,
        )
    except Exception:
        # Some restricted environments block multiprocessing pipes.
        return ThreadPoolExecutor(max_workers=WORKER_COUNT)


def iter_pending_jobs(dat_files: list[Path], done_stems: set[str]) -> list[tuple[int, Path]]:
    jobs: list[tuple[int, Path]] = []
    for idx, dat_path in enumerate(dat_files):
        if dat_path.stem in done_stems:
            continue
        jobs.append((idx, dat_path))
    return jobs


def chunk_jobs(jobs: list[tuple[int, Path]], chunk_size: int) -> list[list[tuple[int, str]]]:
    chunks: list[list[tuple[int, str]]] = []
    current: list[tuple[int, str]] = []

    for job_index, dat_path in jobs:
        current.append((job_index, str(dat_path)))
        if len(current) >= chunk_size:
            chunks.append(current)
            current = []

    if current:
        chunks.append(current)
    return chunks


def flush_ready_results(
    ready_results: list[tuple[Path, dict[str, Any]]],
    done_stems: set[str],
    progress: dict[str, Any],
    in_progress_stems: set[str],
) -> int:
    if not ready_results:
        return 0

    flushed = 0
    for dat_path, payload in ready_results:
        result_path = make_output_path(dat_path)
        atomic_write_json(result_path, payload)

        stem = dat_path.stem
        done_stems.add(stem)
        if payload.get("status") == "ok":
            progress["failed"].pop(stem, None)
        else:
            progress["failed"][stem] = payload.get("errors", [])
        flushed += 1

    ready_results.clear()
    progress["done"] = sorted(done_stems)
    progress["in_progress"] = sorted(in_progress_stems)
    save_progress(progress)
    gc.collect()
    return flushed


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    cleanup_temp_files(OUTPUT_DIR)

    if not INPUT_DIR.exists():
        raise FileNotFoundError(f"Input directory not found: {INPUT_DIR}")

    dat_files = sorted(INPUT_DIR.glob("*.dat"))
    if not dat_files:
        raise RuntimeError(f"No .dat files found in: {INPUT_DIR}")

    config = build_config_dict()
    cfg_fp = config_fingerprint(config)
    ordered_files = [x.name for x in dat_files]
    progress = load_progress(config, ordered_files)

    done_stems = set(progress.get("done", []))
    for dat_path in dat_files:
        stem = dat_path.stem
        result_file = make_output_path(dat_path)
        if is_valid_result_file(result_file, stem, cfg_fp):
            done_stems.add(stem)

    progress["done"] = sorted(done_stems)
    progress["failed"] = {
        k: v for k, v in progress.get("failed", {}).items() if k not in done_stems
    }
    progress["in_progress"] = []
    save_progress(progress)

    jobs = iter_pending_jobs(dat_files, done_stems)
    if not jobs:
        print("[done] No pending airfoils. All results already exist.", flush=True)
        return 0

    pending_indices = [idx for idx, _ in jobs]
    total_jobs = len(jobs)
    print(f"[start] total={len(dat_files)} done={len(done_stems)} pending={total_jobs}", flush=True)

    mp_ctx = mp.get_context("spawn")
    pool = create_worker_pool(mp_ctx)
    chunks = chunk_jobs(jobs, CHUNK_SIZE)

    in_progress_stems: set[str] = {dat_path.stem for _, dat_path in jobs}
    write_buffer: dict[int, tuple[Path, dict[str, Any]]] = {}
    ready_results: list[tuple[Path, dict[str, Any]]] = []

    next_pending_pos = 0
    queued = 0
    flushed = 0
    interrupted = False
    last_print_ts = 0.0

    try:
        future_to_chunk = {
            pool.submit(run_geometry_chunk, chunk, cfg_fp): chunk
            for chunk in chunks
        }

        for future in as_completed(future_to_chunk):
            chunk = future_to_chunk[future]
            try:
                chunk_results = future.result()
            except (BrokenProcessPool, Exception) as exc:
                chunk_results = [
                    (
                        job_index,
                        dat_path_str,
                        build_error_payload(Path(dat_path_str), cfg_fp, exc),
                    )
                    for job_index, dat_path_str in chunk
                ]

            for idx, dat_path_str, payload in chunk_results:
                dat_path = Path(dat_path_str)
                write_buffer[idx] = (dat_path, payload)
                in_progress_stems.discard(dat_path.stem)

            while (
                next_pending_pos < len(pending_indices)
                and pending_indices[next_pending_pos] in write_buffer
            ):
                idx = pending_indices[next_pending_pos]
                dat_path, payload = write_buffer.pop(idx)
                ready_results.append((dat_path, payload))
                queued += 1
                next_pending_pos += 1

                if len(ready_results) >= RESULT_FLUSH_BATCH_SIZE:
                    flushed += flush_ready_results(
                        ready_results,
                        done_stems,
                        progress,
                        in_progress_stems,
                    )

            now_ts = time.time()
            if now_ts - last_print_ts > 2.0:
                print(
                    "[progress] queued="
                    f"{queued}/{total_jobs} flushed={flushed} "
                    f"in_progress={len(in_progress_stems)} "
                    f"remaining={total_jobs - queued}",
                    flush=True,
                )
                last_print_ts = now_ts

        while (
            next_pending_pos < len(pending_indices)
            and pending_indices[next_pending_pos] in write_buffer
        ):
            idx = pending_indices[next_pending_pos]
            dat_path, payload = write_buffer.pop(idx)
            ready_results.append((dat_path, payload))
            queued += 1
            next_pending_pos += 1

            if len(ready_results) >= RESULT_FLUSH_BATCH_SIZE:
                flushed += flush_ready_results(
                    ready_results,
                    done_stems,
                    progress,
                    in_progress_stems,
                )

    except KeyboardInterrupt:
        interrupted = True
        print("\n[interrupt] KeyboardInterrupt received. Stopping and saving progress...", flush=True)
    finally:
        flushed += flush_ready_results(
            ready_results,
            done_stems,
            progress,
            in_progress_stems,
        )
        progress["in_progress"] = sorted(in_progress_stems)
        save_progress(progress)

        pool.shutdown(wait=False, cancel_futures=True)

        cleanup_temp_files(OUTPUT_DIR)

    if interrupted:
        print("[stop] Interrupted. Re-run this script to continue from progress.", flush=True)
        return 130

    print(
        "[done] Batch finished. "
        f"total={len(dat_files)} done={len(progress['done'])} failed={len(progress['failed'])}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal.default_int_handler)
    raise SystemExit(main())
