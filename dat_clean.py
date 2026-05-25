"""中文：批量清理 UIUC 风格的 .dat 翼型坐标文件。
English: Batch-cleans UIUC-style .dat airfoil coordinate files.

This script performs conservative cleaning:
1) Parse coordinate lines (x y) while preserving point order.
2) Keep at most one title line (first non-empty non-coordinate line before data).
3) Remove consecutive duplicate points (within tolerance).
4) Write cleaned files to a separate output directory.
5) Generate a JSON report with quality flags.

Default behavior does NOT modify original files.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from paths import CLEAN_COORD_DIR
from paths import PACKAGE_ROOT
from paths import RAW_COORD_DIR


FLOAT_TOKEN = r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?"
COORD_LINE_RE = re.compile(rf"^\s*({FLOAT_TOKEN})\s+({FLOAT_TOKEN})\s*$")


@dataclass
class Point:
    x: float
    y: float


@dataclass
class FileReport:
    file: str
    title: str
    source_point_count: int
    cleaned_point_count: int
    removed_consecutive_duplicates: int
    ignored_non_coordinate_lines_after_data: int
    min_x: float
    max_x: float
    min_y: float
    max_y: float
    start_x: float
    start_y: float
    end_x: float
    end_y: float
    flags: list[str]


@dataclass
class SummaryReport:
    generated_at_utc: str
    input_dir: str
    output_dir: str
    file_count: int
    success_count: int
    error_count: int
    low_point_count_files: int
    open_curve_files: int
    out_of_range_x_files: int
    files: list[FileReport]
    errors: list[dict[str, str]]


def list_dat_files(folder_path: Path) -> list[Path]:
    return sorted(folder_path.glob("*.dat"))


def parse_dat_file(path: Path) -> tuple[str, list[Point], int]:
    """Return: (title, points, ignored_non_coord_lines_after_data)."""
    title = path.stem
    points: list[Point] = []
    ignored_after_data = 0
    seen_data = False

    with path.open("r", encoding="utf-8", errors="ignore") as f:
        for raw in f:
            line = raw.strip()
            if not line:
                continue

            m = COORD_LINE_RE.match(line)
            if m:
                x = float(m.group(1))
                y = float(m.group(2))
                points.append(Point(x=x, y=y))
                seen_data = True
                continue

            if not seen_data and title == path.stem:
                # Use first non-coordinate line as title.
                title = line
            elif seen_data:
                ignored_after_data += 1

    return title, points, ignored_after_data


def remove_consecutive_duplicates(points: Iterable[Point], tol: float) -> tuple[list[Point], int]:
    cleaned: list[Point] = []
    removed = 0

    for p in points:
        if not cleaned:
            cleaned.append(p)
            continue
        prev = cleaned[-1]
        if abs(p.x - prev.x) <= tol and abs(p.y - prev.y) <= tol:
            removed += 1
            continue
        cleaned.append(p)

    return cleaned, removed


def compute_bounds(points: list[Point]) -> tuple[float, float, float, float]:
    xs = [p.x for p in points]
    ys = [p.y for p in points]
    return min(xs), max(xs), min(ys), max(ys)


def build_flags(
    points: list[Point],
    min_x: float,
    max_x: float,
    *,
    low_point_threshold: int,
    open_curve_dx_threshold: float,
    out_of_range_x_min: float,
    out_of_range_x_max: float,
) -> list[str]:
    flags: list[str] = []

    if len(points) < low_point_threshold:
        flags.append("low_point_count")

    if min_x < out_of_range_x_min or max_x > out_of_range_x_max:
        flags.append("out_of_range_x")

    start = points[0]
    end = points[-1]
    if abs(start.x - end.x) > open_curve_dx_threshold:
        flags.append("open_curve")

    if any(not math.isfinite(p.x) or not math.isfinite(p.y) for p in points):
        flags.append("non_finite_value")

    return flags


def write_cleaned_dat(path: Path, title: str, points: list[Point], precision: int) -> None:
    # parent is the directory containing the file. 
    # mkdir(parents=True, exist_ok=True) creates the directory if it doesn't exist, and does nothing if it already exists.
    path.parent.mkdir(parents=True, exist_ok=True)
    fmt = f"{{:.{precision}f}}"

    with path.open("w", encoding="utf-8", newline="\n") as f:
        f.write(f"{title}\n")
        for p in points:
            f.write(f"{fmt.format(p.x)} {fmt.format(p.y)}\n")


def process_file(
    input_path: Path,
    output_path: Path,
    *,
    dedup_tol: float,
    precision: int,
    low_point_threshold: int,
    open_curve_dx_threshold: float,
    out_of_range_x_min: float,
    out_of_range_x_max: float,
) -> FileReport:
    title, parsed_points, ignored_after_data = parse_dat_file(input_path)
    if not parsed_points:
        raise ValueError("no coordinate points found")

    cleaned_points, removed_dups = remove_consecutive_duplicates(parsed_points, dedup_tol)
    if not cleaned_points:
        raise ValueError("all points removed after cleaning")

    min_x, max_x, min_y, max_y = compute_bounds(cleaned_points)
    flags = build_flags(
        cleaned_points,
        min_x,
        max_x,
        low_point_threshold=low_point_threshold,
        open_curve_dx_threshold=open_curve_dx_threshold,
        out_of_range_x_min=out_of_range_x_min,
        out_of_range_x_max=out_of_range_x_max,
    )

    write_cleaned_dat(output_path, title, cleaned_points, precision)

    start = cleaned_points[0]
    end = cleaned_points[-1]
    return FileReport(
        file=input_path.name,
        title=title,
        source_point_count=len(parsed_points),
        cleaned_point_count=len(cleaned_points),
        removed_consecutive_duplicates=removed_dups,
        ignored_non_coordinate_lines_after_data=ignored_after_data,
        min_x=min_x,
        max_x=max_x,
        min_y=min_y,
        max_y=max_y,
        start_x=start.x,
        start_y=start.y,
        end_x=end.x,
        end_y=end.y,
        flags=flags,
    )

# Command-line interface and batch processing
def parse_args() -> argparse.Namespace:
    base_dir = PACKAGE_ROOT
    default_input = RAW_COORD_DIR
    default_output = CLEAN_COORD_DIR
    default_report = base_dir / "clean_report.json"

    parser = argparse.ArgumentParser(description="Batch clean .dat airfoil files.")
    parser.add_argument("--input-dir", type=Path, default=default_input, help="Directory containing source .dat files.")
    parser.add_argument("--output-dir", type=Path, default=default_output, help="Directory to write cleaned .dat files.")
    parser.add_argument("--report-file", type=Path, default=default_report, help="Path to write JSON cleaning report.")
    parser.add_argument("--precision", type=int, default=7, help="Decimal places for output coordinates.")
    parser.add_argument("--dedup-tol", type=float, default=1e-12, help="Tolerance for consecutive duplicate points.")
    parser.add_argument("--low-point-threshold", type=int, default=40, help="Flag files with fewer points than this.")
    parser.add_argument("--open-curve-dx-threshold", type=float, default=0.05, help="Flag open curve if |x_start-x_end| exceeds this.")
    parser.add_argument("--out-of-range-x-min", type=float, default=-0.05, help="Lower bound for x-range flag.")
    parser.add_argument("--out-of-range-x-max", type=float, default=1.05, help="Upper bound for x-range flag.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_dir: Path = args.input_dir
    output_dir: Path = args.output_dir
    report_file: Path = args.report_file

    if not input_dir.exists():
        raise FileNotFoundError(f"input directory not found: {input_dir}")

    files = list_dat_files(input_dir)
    if not files:
        raise RuntimeError(f"no .dat files found in: {input_dir}")

    reports: list[FileReport] = []
    errors: list[dict[str, str]] = []

    for src in files:
        dst = output_dir / src.name
        try:
            report = process_file(
                src,
                dst,
                dedup_tol=args.dedup_tol,
                precision=args.precision,
                low_point_threshold=args.low_point_threshold,
                open_curve_dx_threshold=args.open_curve_dx_threshold,
                out_of_range_x_min=args.out_of_range_x_min,
                out_of_range_x_max=args.out_of_range_x_max,
            )
            reports.append(report)
        except Exception as exc:  # keep full batch processing even if one file fails
            errors.append({"file": src.name, "error": str(exc)})

    summary = SummaryReport(
        generated_at_utc=datetime.now(timezone.utc).isoformat(),
        input_dir=str(input_dir.resolve()),
        output_dir=str(output_dir.resolve()),
        file_count=len(files),
        success_count=len(reports),
        error_count=len(errors),
        low_point_count_files=sum(1 for r in reports if "low_point_count" in r.flags),
        open_curve_files=sum(1 for r in reports if "open_curve" in r.flags),
        out_of_range_x_files=sum(1 for r in reports if "out_of_range_x" in r.flags),
        files=reports,
        errors=errors,
    )

    report_file.parent.mkdir(parents=True, exist_ok=True)
    with report_file.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(asdict(summary), f, ensure_ascii=False, indent=2)

    print(
        f"[done] files={summary.file_count} ok={summary.success_count} "
        f"errors={summary.error_count} report={report_file}"
    )


if __name__ == "__main__":
    main()
