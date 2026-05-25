"""中文：批量运行 coord_seligFmt_clean 翼型的 XFoil 分析。
English: Batch-runs XFoil analysis for coord_seligFmt_clean airfoils.

Features:
- 3 groups in parallel.
- Each group uses 5 worker processes to solve 5 Reynolds numbers synchronously.
- Per-airfoil JSON output: <stem>_xfoil_result.json
- Resume support via _progress.json
- Atomic writes to avoid broken JSON files.
"""

from __future__ import annotations

import hashlib
import json
import multiprocessing as mp
import os
import signal
import sys
import time
import gc
from concurrent.futures import ProcessPoolExecutor
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
from lib.xfoil_dll import configure_windows_dll_search_path
from paths import CLEAN_COORD_DIR
from paths import RESULTS_XFOIL_DIR


# ------------------------------ Config ------------------------------
INPUT_DIR = CLEAN_COORD_DIR
OUTPUT_DIR = RESULTS_XFOIL_DIR
PROGRESS_FILE = OUTPUT_DIR / "_progress.json"

RE_LIST: list[float] = [1e5, 2.5e5, 5e5, 7.5e5, 1e6]

# RC model balanced profile
MACH_NUMBER = 0.05
N_CRIT = 7.0
ALPHA_MIN = -5.0
ALPHA_MAX = 15.0
ALPHA_STEP = 0.5
MAX_ITER = 80

# 3 groups, each with 5 logical CPUs, avoid CPU0
GROUP_CPU_SETS: list[tuple[int, ...]] = [
    (1, 2, 3, 4, 5),
    (6, 7, 8, 9, 10),
    (11, 12, 13, 14, 15),
]
MAX_TASKS_PER_CHILD = 20


# ------------------------------ Helpers ------------------------------
def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def make_output_path(dat_path: Path) -> Path:
    return OUTPUT_DIR / f"{dat_path.stem}_xfoil_result.json"


def atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    with tmp_path.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    os.replace(tmp_path, path)


def cleanup_temp_files(output_dir: Path) -> None:
    if not output_dir.exists():
        return
    for tmp_file in output_dir.glob("*.tmp"):
        try:
            tmp_file.unlink()
        except OSError:
            pass


def parse_dat_points(dat_path: Path) -> tuple[np.ndarray, np.ndarray]:
    xs: list[float] = []
    ys: list[float] = []

    with dat_path.open("r", encoding="utf-8", errors="ignore") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line:
                continue
            match = COORD_LINE_RE.match(line)
            if not match:
                continue
            xs.append(float(match.group(1)))
            ys.append(float(match.group(2)))

    if len(xs) < 3:
        raise ValueError(f"Not enough coordinate points: {dat_path}")
    return np.asarray(xs, dtype=float), np.asarray(ys, dtype=float)


def build_config_dict() -> dict[str, Any]:
    return {
        "re_list": RE_LIST,
        "mach_number": MACH_NUMBER,
        "n_crit": N_CRIT,
        "alpha_min_deg": ALPHA_MIN,
        "alpha_max_deg": ALPHA_MAX,
        "alpha_step_deg": ALPHA_STEP,
        "max_iter": MAX_ITER,
        "group_cpu_sets": [list(x) for x in GROUP_CPU_SETS],
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
        # Keep existing outputs as source of truth, reset progress structure.
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
    if data.get("config_fingerprint") != expected_fp:
        return False
    if not isinstance(data.get("reynolds_results"), list):
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
    configure_windows_dll_search_path()
    try:
        set_process_affinity(cpu_ids)
    except Exception:
        # Keep running even if affinity setup fails.
        pass

    # xfoil-python on Windows may raise PermissionError in __del__ when removing temp dll.
    # Patch once per process to avoid noisy, harmless warnings during large batch runs.
    try:
        from xfoil import xfoil as xfoil_module

        if not getattr(xfoil_module.XFoil, "_safe_del_patched", False):
            original_del = xfoil_module.XFoil.__del__

            def _safe_del(self: Any) -> None:
                try:
                    original_del(self)
                except PermissionError:
                    # Retry cleanup, Windows file handle release can lag.
                    lib_path = getattr(self, "_lib_path", None)
                    if isinstance(lib_path, str) and lib_path:
                        for _ in range(30):
                            try:
                                os.remove(lib_path)
                                break
                            except PermissionError:
                                time.sleep(0.05)
                            except FileNotFoundError:
                                break
                            except Exception:
                                break
                except Exception:
                    pass

            xfoil_module.XFoil.__del__ = _safe_del
            xfoil_module.XFoil._safe_del_patched = True
    except Exception:
        pass


def _safe_float(value: float | np.floating[Any]) -> float:
    return float(value)


def build_metrics(
    alpha: np.ndarray,
    cl: np.ndarray,
    cd: np.ndarray,
    cm: np.ndarray,
) -> dict[str, float | None]:
    if alpha.size == 0:
        return {
            "cl_alpha": None,
            "cl_max": None,
            "cl_cd_max": None,
            "cd_min": None,
            "cm_0": None,
            "alpha_stall_deg": None,
            "point_count": 0,
        }

    # cl_alpha: linear fit in small-angle region
    mask = (alpha >= -2.0) & (alpha <= 6.0)
    cl_alpha: float | None = None
    if np.count_nonzero(mask) >= 2:
        slope, _ = np.polyfit(alpha[mask], cl[mask], 1)
        cl_alpha = _safe_float(slope)

    cl_max_idx = int(np.argmax(cl))
    cl_max = _safe_float(cl[cl_max_idx])
    alpha_stall = _safe_float(alpha[cl_max_idx])

    cd_min = _safe_float(np.min(cd))

    cd_positive = cd > 1e-12
    cl_cd_max: float | None = None
    if np.any(cd_positive):
        cl_cd_max = _safe_float(np.max(cl[cd_positive] / cd[cd_positive]))

    cm_0: float | None = None
    alpha_sorted_idx = np.argsort(alpha)
    alpha_sorted = alpha[alpha_sorted_idx]
    cm_sorted = cm[alpha_sorted_idx]
    if alpha_sorted.size >= 2 and alpha_sorted[0] <= 0.0 <= alpha_sorted[-1]:
        cm_0 = _safe_float(np.interp(0.0, alpha_sorted, cm_sorted))
    else:
        zero_mask = np.isclose(alpha_sorted, 0.0)
        if np.any(zero_mask):
            cm_0 = _safe_float(cm_sorted[zero_mask][0])

    return {
        "cl_alpha": cl_alpha,
        "cl_max": cl_max,
        "cl_cd_max": cl_cd_max,
        "cd_min": cd_min,
        "cm_0": cm_0,
        "alpha_stall_deg": alpha_stall,
        "point_count": int(alpha.size),
    }


def run_single_re(dat_path_str: str, reynolds_number: float) -> dict[str, Any]:
    dat_path = Path(dat_path_str)
    xf = None

    try:
        configure_windows_dll_search_path()

        from xfoil import XFoil
        from xfoil.model import Airfoil

        x, y = parse_dat_points(dat_path)

        xf = XFoil()
        xf.print = False
        xf.airfoil = Airfoil(x, y)
        xf.Re = float(reynolds_number)
        xf.M = float(MACH_NUMBER)
        xf.n_crit = float(N_CRIT)
        xf.max_iter = int(MAX_ITER)

        alphas, cls, cds, cms, cps = xf.aseq(ALPHA_MIN, ALPHA_MAX, ALPHA_STEP)

        alpha_arr = np.asarray(alphas, dtype=float)
        cl_arr = np.asarray(cls, dtype=float)
        cd_arr = np.asarray(cds, dtype=float)
        cm_arr = np.asarray(cms, dtype=float)
        cp_arr = np.asarray(cps, dtype=float)

        finite_mask = (
            np.isfinite(alpha_arr)
            & np.isfinite(cl_arr)
            & np.isfinite(cd_arr)
            & np.isfinite(cm_arr)
            & np.isfinite(cp_arr)
        )
        alpha_arr = alpha_arr[finite_mask]
        cl_arr = cl_arr[finite_mask]
        cd_arr = cd_arr[finite_mask]
        cm_arr = cm_arr[finite_mask]
        cp_arr = cp_arr[finite_mask]

        # sort by alpha ascending for stable downstream processing
        sort_idx = np.argsort(alpha_arr)
        alpha_arr = alpha_arr[sort_idx]
        cl_arr = cl_arr[sort_idx]
        cd_arr = cd_arr[sort_idx]
        cm_arr = cm_arr[sort_idx]
        cp_arr = cp_arr[sort_idx]

        metrics = build_metrics(alpha_arr, cl_arr, cd_arr, cm_arr)
        polar_table = [
            {
                "alpha_deg": _safe_float(a),
                "cl": _safe_float(clv),
                "cd": _safe_float(cdv),
                "cm": _safe_float(cmv),
                "cp": _safe_float(cpv),
            }
            for a, clv, cdv, cmv, cpv in zip(alpha_arr, cl_arr, cd_arr, cm_arr, cp_arr)
        ]

        return {
            "status": "ok",
            "reynolds_number": float(reynolds_number),
            "mach_number": float(MACH_NUMBER),
            "n_crit": float(N_CRIT),
            "alpha_min_deg": float(ALPHA_MIN),
            "alpha_max_deg": float(ALPHA_MAX),
            "alpha_step_deg": float(ALPHA_STEP),
            "max_iter": int(MAX_ITER),
            "polar_table": polar_table,
            **metrics,
        }
    except Exception as exc:
        return {
            "status": "error",
            "reynolds_number": float(reynolds_number),
            "mach_number": float(MACH_NUMBER),
            "n_crit": float(N_CRIT),
            "alpha_min_deg": float(ALPHA_MIN),
            "alpha_max_deg": float(ALPHA_MAX),
            "alpha_step_deg": float(ALPHA_STEP),
            "max_iter": int(MAX_ITER),
            "polar_table": [],
            "cl_alpha": None,
            "cl_max": None,
            "cl_cd_max": None,
            "cd_min": None,
            "cm_0": None,
            "alpha_stall_deg": None,
            "point_count": 0,
            "error_type": type(exc).__name__,
            "error_message": str(exc),
        }
    finally:
        try:
            if xf is not None:
                del xf
        except Exception:
            pass
        gc.collect()


def build_airfoil_payload(
    dat_path: Path,
    re_results: list[dict[str, Any]],
    config_fp: str,
) -> dict[str, Any]:
    re_results_sorted = sorted(re_results, key=lambda x: x["reynolds_number"])
    errors = [x for x in re_results_sorted if x.get("status") != "ok"]

    return {
        "file_name": dat_path.name,
        "file_stem": dat_path.stem,
        "source_dat_path": str(dat_path.resolve()),
        "status": "ok" if not errors else "error",
        "generated_at_utc": now_utc_iso(),
        "config_fingerprint": config_fp,
        "reynolds_results": re_results_sorted,
        "errors": [
            {
                "reynolds_number": x.get("reynolds_number"),
                "error_type": x.get("error_type"),
                "error_message": x.get("error_message"),
            }
            for x in errors
        ],
    }


def build_pool_error_result(reynolds_number: float, error_message: str) -> dict[str, Any]:
    return {
        "status": "error",
        "reynolds_number": float(reynolds_number),
        "mach_number": float(MACH_NUMBER),
        "n_crit": float(N_CRIT),
        "alpha_min_deg": float(ALPHA_MIN),
        "alpha_max_deg": float(ALPHA_MAX),
        "alpha_step_deg": float(ALPHA_STEP),
        "max_iter": int(MAX_ITER),
        "polar_table": [],
        "cl_alpha": None,
        "cl_max": None,
        "cl_cd_max": None,
        "cd_min": None,
        "cm_0": None,
        "alpha_stall_deg": None,
        "point_count": 0,
        "error_type": "BrokenProcessPool",
        "error_message": error_message,
    }


def build_pool_failure_payload(dat_path: Path, config_fp: str, error_message: str) -> dict[str, Any]:
    re_results = [build_pool_error_result(re, error_message) for re in RE_LIST]
    return build_airfoil_payload(dat_path, re_results, config_fp)


def create_group_pool(mp_ctx: Any, cpu_set: tuple[int, ...]) -> ProcessPoolExecutor:
    return ProcessPoolExecutor(
        max_workers=5,
        mp_context=mp_ctx,
        initializer=worker_initializer,
        initargs=(cpu_set,),
        max_tasks_per_child=MAX_TASKS_PER_CHILD,
    )


def start_group_job(
    pool: ProcessPoolExecutor,
    job_index: int,
    dat_path: Path,
) -> dict[str, Any]:
    futures = {
        re: pool.submit(run_single_re, str(dat_path), float(re))
        for re in RE_LIST
    }
    return {
        "job_index": job_index,
        "dat_path": dat_path,
        "futures": futures,
        "started_at": time.time(),
    }


def all_futures_done(futures: dict[float, Any]) -> bool:
    return all(f.done() for f in futures.values())


def collect_group_result(
    job_state: dict[str, Any],
    config_fp: str,
) -> tuple[int, Path, dict[str, Any]]:
    dat_path: Path = job_state["dat_path"]
    re_results: list[dict[str, Any]] = []

    for re in RE_LIST:
        future = job_state["futures"][re]
        try:
            re_results.append(future.result())
        except Exception as exc:
            re_results.append(
                {
                    "status": "error",
                    "reynolds_number": float(re),
                    "mach_number": float(MACH_NUMBER),
                    "n_crit": float(N_CRIT),
                    "alpha_min_deg": float(ALPHA_MIN),
                    "alpha_max_deg": float(ALPHA_MAX),
                    "alpha_step_deg": float(ALPHA_STEP),
                    "max_iter": int(MAX_ITER),
                    "polar_table": [],
                    "cl_alpha": None,
                    "cl_max": None,
                    "cl_cd_max": None,
                    "cd_min": None,
                    "cm_0": None,
                    "alpha_stall_deg": None,
                    "point_count": 0,
                    "error_type": type(exc).__name__,
                    "error_message": str(exc),
                }
            )

    payload = build_airfoil_payload(dat_path, re_results, config_fp)
    return job_state["job_index"], dat_path, payload


def iter_pending_jobs(dat_files: list[Path], done_stems: set[str]) -> list[tuple[int, Path]]:
    jobs: list[tuple[int, Path]] = []
    for idx, dat_path in enumerate(dat_files):
        if dat_path.stem in done_stems:
            continue
        jobs.append((idx, dat_path))
    return jobs


def start_group_job_with_recovery(
    pools: list[ProcessPoolExecutor],
    group_id: int,
    mp_ctx: Any,
    job_index: int,
    dat_path: Path,
    config_fp: str,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    try:
        return start_group_job(pools[group_id], job_index, dat_path), None
    except BrokenProcessPool:
        try:
            pools[group_id].shutdown(wait=False, cancel_futures=True)
        except Exception:
            pass
        pools[group_id] = create_group_pool(mp_ctx, GROUP_CPU_SETS[group_id])
        try:
            return start_group_job(pools[group_id], job_index, dat_path), None
        except Exception as exc:
            msg = f"group {group_id} submit failed after pool rebuild: {type(exc).__name__}: {exc}"
            return None, build_pool_failure_payload(dat_path, config_fp, msg)
    except Exception as exc:
        msg = f"group {group_id} submit failed: {type(exc).__name__}: {exc}"
        return None, build_pool_failure_payload(dat_path, config_fp, msg)


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

    # Build done set from progress and existing valid outputs.
    done_stems = set(progress.get("done", []))
    for dat_path in dat_files:
        stem = dat_path.stem
        result_file = make_output_path(dat_path)
        if is_valid_result_file(result_file, stem, cfg_fp):
            done_stems.add(stem)

    # Normalize progress state.
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
    pools: list[ProcessPoolExecutor] = [create_group_pool(mp_ctx, cpu_set) for cpu_set in GROUP_CPU_SETS]

    # Assign initial jobs to 3 groups.
    job_iter = iter(jobs)
    active_jobs: dict[int, dict[str, Any]] = {}
    in_progress_stems: set[str] = set()
    write_buffer: dict[int, tuple[Path, dict[str, Any]]] = {}

    for group_id, pool in enumerate(pools):
        try:
            idx, dat_path = next(job_iter)
        except StopIteration:
            break
        state, payload = start_group_job_with_recovery(
            pools=pools,
            group_id=group_id,
            mp_ctx=mp_ctx,
            job_index=idx,
            dat_path=dat_path,
            config_fp=cfg_fp,
        )
        if state is not None:
            active_jobs[group_id] = state
            in_progress_stems.add(dat_path.stem)
        else:
            write_buffer[idx] = (dat_path, payload)

    next_pending_pos = 0
    completed = 0
    interrupted = False
    last_print_ts = 0.0

    try:
        while active_jobs:
            # collect finished group jobs
            for group_id in list(active_jobs.keys()):
                state = active_jobs[group_id]
                if not all_futures_done(state["futures"]):
                    continue

                idx, dat_path, payload = collect_group_result(state, cfg_fp)
                write_buffer[idx] = (dat_path, payload)
                in_progress_stems.discard(dat_path.stem)

                # assign next job to this group
                try:
                    next_idx, next_path = next(job_iter)
                    next_state, next_payload = start_group_job_with_recovery(
                        pools=pools,
                        group_id=group_id,
                        mp_ctx=mp_ctx,
                        job_index=next_idx,
                        dat_path=next_path,
                        config_fp=cfg_fp,
                    )
                    if next_state is not None:
                        active_jobs[group_id] = next_state
                        in_progress_stems.add(next_path.stem)
                    else:
                        write_buffer[next_idx] = (next_path, next_payload)
                        del active_jobs[group_id]
                except StopIteration:
                    del active_jobs[group_id]

            # ordered persistence in main process
            while (
                next_pending_pos < len(pending_indices)
                and pending_indices[next_pending_pos] in write_buffer
            ):
                idx = pending_indices[next_pending_pos]
                dat_path, payload = write_buffer.pop(idx)
                result_path = make_output_path(dat_path)
                atomic_write_json(result_path, payload)

                stem = dat_path.stem
                done_stems.add(stem)
                if payload.get("status") == "ok":
                    progress["failed"].pop(stem, None)
                else:
                    progress["failed"][stem] = payload.get("errors", [])

                progress["done"] = sorted(done_stems)
                progress["in_progress"] = sorted(in_progress_stems)
                save_progress(progress)

                completed += 1
                next_pending_pos += 1

            now_ts = time.time()
            if now_ts - last_print_ts > 2.0:
                print(
                    "[progress] completed="
                    f"{completed}/{total_jobs} in_progress={len(in_progress_stems)} "
                    f"remaining={total_jobs - completed}"
                ,
                    flush=True,
                )
                last_print_ts = now_ts

            if active_jobs:
                time.sleep(0.2)

    except KeyboardInterrupt:
        interrupted = True
        print("\n[interrupt] KeyboardInterrupt received. Stopping and saving progress...", flush=True)
    finally:
        progress["in_progress"] = sorted(in_progress_stems)
        save_progress(progress)

        # Shutdown pools and cancel pending futures.
        for pool in pools:
            pool.shutdown(wait=False, cancel_futures=True)

        cleanup_temp_files(OUTPUT_DIR)

    if interrupted:
        print("[stop] Interrupted. Re-run this script to continue from progress.", flush=True)
        return 130

    print(
        "[done] Batch finished. "
        f"total={len(dat_files)} done={len(progress['done'])} failed={len(progress['failed'])}"
        ,
        flush=True,
    )
    return 0


if __name__ == "__main__":
    # Keep Ctrl+C behavior explicit on Windows.
    signal.signal(signal.SIGINT, signal.default_int_handler)
    raise SystemExit(main())
