"""中文：为 xfoil-python 配置 Windows DLL 搜索路径。
English: Configures Windows DLL search paths for xfoil-python.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from paths import CLEAN_COORD_DIR

REQUIRED_DLLS = ("libgfortran-5.dll", "libgcc_s_seh-1.dll")


def _dir_has_required_dlls(path: Path) -> bool:
    """检查给定目录是否同时包含 XFoil 运行需要的 DLL。"""
    return path.is_dir() and all((path / dll_name).exists() for dll_name in REQUIRED_DLLS)


# 中文：在 Windows 下通过环境变量和 PATH 配置 XFoil DLL 搜索路径。
# English: Configures the XFoil DLL search path on Windows through environment variables and PATH.
def configure_windows_dll_search_path() -> str | None:
    """在 Windows 下配置 DLL 搜索路径，返回命中的目录；若未命中则返回 None。"""
    if os.name != "nt":
        return None

    candidates: list[Path] = []

    # User-provided DLL directories. Separate multiple entries with the OS path separator.
    configured_dirs = os.environ.get("XFOIL_DLL_DIRS", "")
    for entry in configured_dirs.split(os.pathsep):
        entry = entry.strip().strip('"')
        if entry:
            candidates.append(Path(entry))

    # Existing PATH entries.
    for entry in os.environ.get("PATH", "").split(os.pathsep):
        entry = entry.strip().strip('"')
        if entry:
            candidates.append(Path(entry))

    seen: set[str] = set()
    for candidate in candidates:
        key = str(candidate).lower()
        if key in seen:
            continue
        seen.add(key)
        if _dir_has_required_dlls(candidate):
            os.add_dll_directory(str(candidate))
            os.environ["PATH"] = f"{candidate}{os.pathsep}" + os.environ.get("PATH", "")
            return str(candidate)

    return None


def build_parser(base_dir: Path) -> argparse.ArgumentParser:
    """构建 XFoil 测试脚本的命令行参数解析器（放在 lib 里复用）。"""
    parser = argparse.ArgumentParser(description="Run one XFoil test with a cleaned airfoil.")
    parser.add_argument(
        "--clean-dir",
        type=Path,
        default=CLEAN_COORD_DIR,
        help="Directory containing cleaned .dat files.",
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=base_dir / "testxfoilpython_output",
        help="Root directory for test outputs.",
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed for airfoil selection.")
    parser.add_argument("--re", type=float, default=2.5e5, help="Reynolds number.")
    parser.add_argument("--alpha-start", type=float, default=-2.0, help="Start alpha (deg).")
    parser.add_argument("--alpha-end", type=float, default=8.0, help="End alpha (deg).")
    parser.add_argument("--alpha-step", type=float, default=0.5, help="Alpha step (deg).")
    parser.add_argument("--max-iter", type=int, default=80, help="XFoil max iterations.")
    return parser
