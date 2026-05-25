"""中文：使用一个已清理的 UIUC 翼型执行快速 XFoil 冒烟测试。
English: Runs a quick XFoil smoke test with one cleaned UIUC airfoil.

Usage:
  python testxfoilpython.py
"""

from __future__ import annotations

import csv
import json
import random
import re
import shutil
import sys
import traceback
from datetime import datetime
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from paths import CLEAN_COORD_DIR
from paths import PACKAGE_ROOT
from lib.xfoil_dll import configure_windows_dll_search_path

# 正则：匹配一行中的两个浮点数（x y），用于识别翼型坐标行。
FLOAT_TOKEN = r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?"
COORD_LINE_RE = re.compile(rf"^\s*({FLOAT_TOKEN})\s+({FLOAT_TOKEN})\s*$")

# 固定配置区：脚本不接收外部参数，所有试跑参数在这里集中定义。
BASE_DIR = PACKAGE_ROOT
CLEAN_DIR = CLEAN_COORD_DIR
OUTPUT_ROOT = BASE_DIR / "testxfoilpython_output"
SEED = 42
REYNOLDS_NUMBER = 2.5e5
ALPHA_START_DEG = -2.0
ALPHA_END_DEG = 8.0
ALPHA_STEP_DEG = 0.5
MAX_ITER = 80


def parse_dat_points(dat_path: Path) -> tuple[np.ndarray, np.ndarray]:
    """解析翼型 .dat 文件中的坐标点，返回 x/y 两个 numpy 数组。"""
    # xs/ys 分别存储提取到的 x 坐标和 y 坐标。
    xs: list[float] = []
    ys: list[float] = []

    # 逐行读取文件，只保留符合“两个数字”的坐标行。
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

    # 至少要有若干个点才能构成有效翼型轮廓。
    if len(xs) < 3:
        raise ValueError(f"Not enough coordinate points in file: {dat_path}")

    # 转为 numpy 数组，便于后续传给 xfoil.model.Airfoil。
    return np.asarray(xs, dtype=float), np.asarray(ys, dtype=float)


def main() -> int:
    """执行一次完整试跑：随机选翼型、调用 XFoil、保存结果与摘要。"""
    # 读取固定配置，便于后续引用。
    clean_dir: Path = CLEAN_DIR
    output_root: Path = OUTPUT_ROOT

    # 输入目录存在性检查。
    if not clean_dir.exists():
        raise FileNotFoundError(f"Clean directory does not exist: {clean_dir}")

    # 扫描可用翼型文件，确保有可测试样本。
    dat_files = sorted(clean_dir.glob("*.dat"))
    if not dat_files:
        raise RuntimeError(f"No .dat files found in: {clean_dir}")

    # 用固定随机种子挑选一个翼型，保证可复现。
    rng = random.Random(SEED)
    chosen_file = rng.choice(dat_files)

    # 为本次试跑创建独立输出目录，避免覆盖历史结果。
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = output_root / f"run_{timestamp}"
    run_dir.mkdir(parents=True, exist_ok=False)

    # 先写入基础摘要信息，后面会补充成功/失败细节。
    summary: dict[str, object] = {
        "status": "started",
        "timestamp_local": timestamp,
        "selected_airfoil": str(chosen_file.resolve()),
        "reynolds_number": REYNOLDS_NUMBER,
        "alpha_start_deg": ALPHA_START_DEG,
        "alpha_end_deg": ALPHA_END_DEG,
        "alpha_step_deg": ALPHA_STEP_DEG,
        "max_iter": MAX_ITER,
    }

    try:
        # 在 Windows 下补充 DLL 搜索路径，避免 xfoil 动态库依赖找不到。
        dll_dir = configure_windows_dll_search_path()
        if dll_dir is not None:
            summary["dll_search_dir"] = dll_dir

        # 延迟导入：只有到真正执行时才加载 xfoil 相关模块。
        from xfoil import XFoil
        from xfoil.model import Airfoil

        # 解析选中的 .dat，并将原文件拷贝到输出目录留档。
        x, y = parse_dat_points(chosen_file)
        copied_airfoil = run_dir / "selected_airfoil.dat"
        shutil.copyfile(chosen_file, copied_airfoil)

        # 配置 XFoil 求解器参数。
        xf = XFoil()
        xf.print = False
        xf.airfoil = Airfoil(x, y)
        xf.Re = float(REYNOLDS_NUMBER)
        xf.max_iter = int(MAX_ITER)

        # 在攻角区间内做序列计算，得到极曲线数据。
        alphas, cls, cds, cms, cps = xf.aseq(ALPHA_START_DEG, ALPHA_END_DEG, ALPHA_STEP_DEG)

        # 将结果写入 CSV，便于后续画图或统计。
        polar_csv = run_dir / "polar.csv"
        with polar_csv.open("w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["alpha_deg", "cl", "cd", "cm", "cp"])
            for row in zip(alphas, cls, cds, cms, cps):
                writer.writerow([float(v) for v in row])

        # 成功时补充结果信息并落盘 summary.json。
        summary.update(
            {
                "status": "ok",
                "point_count": int(x.shape[0]),
                "result_count": int(len(alphas)),
                "polar_csv": str(polar_csv.resolve()),
                "copied_airfoil": str(copied_airfoil.resolve()),
            }
        )
        (run_dir / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[ok] XFoil test finished. Output: {run_dir}")
        return 0

    except Exception as exc:
        # 失败时记录错误类型和 traceback，方便排查。
        summary.update(
            {
                "status": "error",
                "error_type": type(exc).__name__,
                "error_message": str(exc),
                "traceback": traceback.format_exc(),
            }
        )
        (run_dir / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[error] XFoil test failed. Output: {run_dir}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
