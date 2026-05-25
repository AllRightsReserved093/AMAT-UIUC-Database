"""中文：调用 xfoil-python 并保存单个翼型的气动分析结果。
English: Calls xfoil-python and saves aerodynamic analysis results for one airfoil.
"""

# 导入dat文件
# 设置参数
# 使用DARcorporation/xfoil-python
# 多核心并行调用xfoil
# 保存至 results_xfoil

import subprocess
from pathlib import Path

import multiprocessing
import numpy as np
from xfoil import XFoil

from dat_clean import COORD_LINE_RE
from metadata_generation import metadata
from lib.xfoil_dll import configure_windows_dll_search_path
from paths import CLEAN_COORD_DIR
from paths import RESULTS_XFOIL_DIR

FOIL_DIR = CLEAN_COORD_DIR
RESULT_DIR = RESULTS_XFOIL_DIR

def list_dat_files(folder_path: Path) -> list[Path]:
    """Return all .dat files under the given folder (non-recursive)."""
    return sorted(folder_path.glob("*.dat"))

# import dat files
def import_dat_file(file_path: Path) -> str:
    """Read the content of a .dat file and return it as a string."""
    with file_path.open("r") as f:
        return f.read()

# 读取dat文件
def parse_dat_points(dat_path: Path) -> tuple[np.ndarray, np.ndarray]:
    """解析翼型 .dat 文件中的坐标点，并返回 x/y 两个 numpy 数组。"""
    xs: list[float] = []
    ys: list[float] = []

    with dat_path.open("r", encoding="utf-8", errors="ignore") as f:
        for raw_line in f:
            line = raw_line.strip() # 去掉行首行尾的空白字符
            if not line: # 如果行是空的，跳过
                continue
            match = COORD_LINE_RE.match(line) # 使用正则表达式匹配坐标行，提取 x 和 y
            if not match:
                continue
            xs.append(float(match.group(1)))
            ys.append(float(match.group(2)))

    if len(xs) < 3:
        raise ValueError(f"Not enough coordinate points in file: {dat_path}")

    return np.asarray(xs, dtype=float), np.asarray(ys, dtype=float)

def xfoil_run() -> None:
    # 设置参数
    xf = XFoil()
    Re_list: list[int] = [1e5, 2.5e5, 5e5, 7.5e5, 1e6]
    xf.Re = Re_list[0]  # 设置雷诺数
    xf.max_iter = 40 # 设置最大迭代次数

    # 读取dat文件
    dat_path = RESULT_DIR / "airfoil.dat"
    dat_content = import_dat_file(dat_path)
    

def main() -> None:
    low_point_count_flag: bool = False

    foil_dir = FOIL_DIR
    result_dir = RESULT_DIR

    # Get all dat files in the folder
    dat_files = list_dat_files(foil_dir)

    # Terverse through all dat files
    for dat_file_name in dat_files:

        # Create new metadata for this dat file
        metadata = metadata.generate_metadata(dat_file_name)

        # Construct the full path to the dat file
        dat_file_path = foil_dir / dat_file_name
        print(f"Processing {dat_file_path}...")
        
        # parse dat file to get x and y coordinates
        x, y = parse_dat_points(dat_file_path)

        # Check if the number of points is less than 20, if so set low_point_count_flag to True
        if len(x) < 20:
            # Set low_point_count flag
            low_point_count_flag = True
            
