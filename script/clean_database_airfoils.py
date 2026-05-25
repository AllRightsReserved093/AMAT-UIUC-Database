"""中文：按数据库中的翼型文件名筛选并清理原始翼型坐标文件。
English: Filters and cleans raw airfoil coordinate files by database file names.

This script does not modify the raw ``coord_seligFmt`` directory. It reads the
database file-name list, processes matching raw ``.dat`` files, and writes the
normalized text format into ``coord_seligFmt_clean``.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from importlib import import_module
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from dat_clean import FileReport
from dat_clean import build_flags
from dat_clean import compute_bounds
from dat_clean import parse_dat_file
from dat_clean import remove_consecutive_duplicates
from dat_clean import write_cleaned_dat
from paths import CLEAN_COORD_DIR
from paths import RAW_COORD_DIR


db_access = import_module("backend.app.02_services.db_access")


@dataclass
class DatabaseCleanSummary:
    generated_at_utc: str
    input_dir: str
    output_dir: str
    database_file_count: int
    raw_file_count: int
    selected_file_count: int
    success_count: int
    error_count: int
    missing_source_count: int
    skipped_not_in_database_count: int
    dry_run: bool
    files: list[FileReport]
    errors: list[dict[str, str]]
    missing_source_files: list[str]
    skipped_not_in_database_files: list[str]


# --------- Arguments ---------

# 解析命令行参数。
# Parse command-line arguments.
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Clean raw .dat airfoils that are present in the database."
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=RAW_COORD_DIR,
        help="Directory containing raw .dat files.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=CLEAN_COORD_DIR,
        help="Directory to write cleaned .dat files.",
    )
    parser.add_argument(
        "--report-file",
        type=Path,
        default=PROJECT_ROOT / "database_clean_report.json",
        help="Path to write JSON report.",
    )
    parser.add_argument(
        "--precision",
        type=int,
        default=7,
        help="Decimal places for output coordinates.",
    )
    parser.add_argument(
        "--dedup-tol",
        type=float,
        default=1e-12,
        help="Tolerance for removing consecutive duplicate points.",
    )
    parser.add_argument(
        "--low-point-threshold",
        type=int,
        default=40,
        help="Flag files with fewer points than this.",
    )
    parser.add_argument(
        "--open-curve-dx-threshold",
        type=float,
        default=0.05,
        help="Flag open curve if |x_start-x_end| exceeds this.",
    )
    parser.add_argument(
        "--out-of-range-x-min",
        type=float,
        default=-0.05,
        help="Lower bound for x-range flag.",
    )
    parser.add_argument(
        "--out-of-range-x-max",
        type=float,
        default=1.05,
        help="Upper bound for x-range flag.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional limit for quick checks.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and report without writing cleaned files.",
    )
    return parser.parse_args()


# --------- Database ---------

# 从数据库读取所有翼型文件名。
# Read all airfoil file names from the database.
def read_database_file_names() -> set[str]:
    conn = db_access.get_db_connection()
    try:
        return set(db_access.get_foil_list(conn))
    finally:
        conn.close()


# --------- File Discovery ---------

# 按文件名索引原始 .dat 文件。
# Index raw .dat files by file name.
def index_raw_dat_files(input_dir: Path) -> dict[str, Path]:
    return {path.name: path for path in sorted(input_dir.glob("*.dat"))}


# 根据数据库文件名选择需要处理的原始文件。
# Select raw files to process based on database file names.
def select_database_files(
    raw_files_by_name: dict[str, Path],
    database_file_names: set[str],
    limit: int | None,
) -> tuple[list[Path], list[str], list[str]]:
    selected_names = [
        file_name
        for file_name in sorted(database_file_names)
        if file_name in raw_files_by_name
    ]
    missing_source_files = [
        file_name
        for file_name in sorted(database_file_names)
        if file_name not in raw_files_by_name
    ]
    skipped_not_in_database_files = [
        file_name
        for file_name in sorted(raw_files_by_name)
        if file_name not in database_file_names
    ]

    if limit is not None:
        selected_names = selected_names[:limit]

    selected_paths = [raw_files_by_name[file_name] for file_name in selected_names]
    return selected_paths, missing_source_files, skipped_not_in_database_files


# --------- Cleaning ---------

# 清理单个原始翼型文件，并可选择写出到 clean 目录。
# Clean one raw airfoil file and optionally write it to the clean directory.
def clean_one_file(
    input_path: Path,
    output_path: Path,
    *,
    dedup_tol: float,
    precision: int,
    low_point_threshold: int,
    open_curve_dx_threshold: float,
    out_of_range_x_min: float,
    out_of_range_x_max: float,
    dry_run: bool,
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

    if not dry_run:
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


# 批量清理数据库中存在的翼型文件。
# Batch-clean airfoil files that exist in the database.
def clean_database_files(args: argparse.Namespace) -> DatabaseCleanSummary:
    input_dir: Path = args.input_dir
    output_dir: Path = args.output_dir

    if not input_dir.exists():
        raise FileNotFoundError(f"input directory not found: {input_dir}")

    database_file_names = read_database_file_names()
    raw_files_by_name = index_raw_dat_files(input_dir)
    selected_paths, missing_source_files, skipped_not_in_database_files = select_database_files(
        raw_files_by_name,
        database_file_names,
        args.limit,
    )

    reports: list[FileReport] = []
    errors: list[dict[str, str]] = []

    for input_path in selected_paths:
        output_path = output_dir / input_path.name
        try:
            report = clean_one_file(
                input_path,
                output_path,
                dedup_tol=args.dedup_tol,
                precision=args.precision,
                low_point_threshold=args.low_point_threshold,
                open_curve_dx_threshold=args.open_curve_dx_threshold,
                out_of_range_x_min=args.out_of_range_x_min,
                out_of_range_x_max=args.out_of_range_x_max,
                dry_run=args.dry_run,
            )
            reports.append(report)
        except Exception as exc:
            errors.append({"file": input_path.name, "error": str(exc)})

    return DatabaseCleanSummary(
        generated_at_utc=datetime.now(timezone.utc).isoformat(),
        input_dir=str(input_dir.resolve()),
        output_dir=str(output_dir.resolve()),
        database_file_count=len(database_file_names),
        raw_file_count=len(raw_files_by_name),
        selected_file_count=len(selected_paths),
        success_count=len(reports),
        error_count=len(errors),
        missing_source_count=len(missing_source_files),
        skipped_not_in_database_count=len(skipped_not_in_database_files),
        dry_run=bool(args.dry_run),
        files=reports,
        errors=errors,
        missing_source_files=missing_source_files,
        skipped_not_in_database_files=skipped_not_in_database_files,
    )


# --------- Reporting ---------

# 将清理报告写入 JSON 文件。
# Write the cleaning report to a JSON file.
def write_summary(report_file: Path, summary: DatabaseCleanSummary) -> None:
    report_file.parent.mkdir(parents=True, exist_ok=True)
    with report_file.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(asdict(summary), f, ensure_ascii=False, indent=2)


# --------- Entry Point ---------

# 脚本入口：执行数据库筛选清理并输出摘要。
# Script entry point: run database-filtered cleaning and print a summary.
def main() -> int:
    args = parse_args()
    summary = clean_database_files(args)
    write_summary(args.report_file, summary)

    print(
        "[done] "
        f"db={summary.database_file_count} raw={summary.raw_file_count} "
        f"selected={summary.selected_file_count} ok={summary.success_count} "
        f"errors={summary.error_count} missing_source={summary.missing_source_count} "
        f"skipped_not_in_db={summary.skipped_not_in_database_count} "
        f"dry_run={summary.dry_run} report={args.report_file}",
        flush=True,
    )
    return 0 if summary.error_count == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
