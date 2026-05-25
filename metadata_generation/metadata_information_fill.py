"""中文：汇总几何与 XFoil 结果并填充翼型 metadata JSON。
English: Combines geometry and XFoil results into airfoil metadata JSON.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json

from . import metadata
from .metadata import AerodynamicMetadata
from .metadata import FoilMetadata

from .family_series_from_filename import get_family_series_from_filename
from paths import CLEAN_COORD_DIR
from paths import METADATA_JSON_PATH
from paths import PACKAGE_ROOT
from paths import PROJECT_ROOT
from paths import RESULTS_GEOMETRY_DIR
from paths import RESULTS_XFOIL_DIR

DATABASE_ROOT = PACKAGE_ROOT
GEOMETRY_RESULTS_DIR = RESULTS_GEOMETRY_DIR
XFOIL_RESULTS_DIR = RESULTS_XFOIL_DIR


def compute_sha256(file_path: Path, chunk_size: int = 1024 * 1024) -> str:
    """Compute SHA-256 hash for a file."""
    hasher = hashlib.sha256()
    with file_path.open("rb") as f:
        for chunk in iter(lambda: f.read(chunk_size), b""):
            hasher.update(chunk)
    return hasher.hexdigest()

# indent = 2: pretty-print with 2 spaces per level. 

def extract_naca_code(file_name: str) -> str:
    """Extract NACA code from filename, e.g. "naca2412.dat" -> "2412"."""
    lower_name = file_name.lower()
    if "naca" in lower_name:
        start = lower_name.find("naca") + 4
        
        digits = 0
        for char in lower_name[start:]:
            if char.isdigit():
                digits += 1
            else:
                break

        end = start + digits
        return lower_name[start:end]
    return ""

def add_quality_flages(foil_meta: metadata.FoilMetadata, flag: str) -> None:
    """Add quality flag to metadata if not already exists."""
    if flag not in foil_meta.quality_flags:
        foil_meta.quality_flags.append(flag)

def add_new_aero_metadata(foil_meta: FoilMetadata, aero_metadata: AerodynamicMetadata) -> FoilMetadata:
    """Add a new AerodynamicMetadata entry to the given FoilMetadata object."""
    foil_meta.aerodynamic_metadata.append(aero_metadata)
    return foil_meta

def list_dat_files(folder_path: Path) -> list[Path]:
    """Return all .dat files under the given folder (non-recursive)."""
    return sorted(folder_path.glob("*.dat"))

def fill_general_metadata_information(foil_meta: metadata.FoilMetadata, file_path: Path) -> metadata.FoilMetadata:
    """Generate general metadata for a given .dat file."""

    # Main iteration

    # file_name
    foil_meta.file_name = file_path.name
    # path
    try:
        foil_meta.path = file_path.resolve().relative_to(DATABASE_ROOT.resolve()).as_posix()
    except ValueError:
        foil_meta.path = file_path.as_posix()
    # family_series
    foil_meta.family_series = get_family_series_from_filename(file_path.name)
    # todo
    lower_name = foil_meta.file_name.lower()

    # source
    foil_meta.source = "uiuc_database"

    # quality_flags
    foil_meta.quality_flags = []
    if file_path.stat().st_size < 1024:
        add_quality_flages(foil_meta, "low_point_count")

    # is_modified, is_smooth, is_naca, naca_code
    foil_meta.is_modified = "md" in lower_name
    foil_meta.is_smooth = "sm" in lower_name
    foil_meta.is_naca = "naca" in lower_name
    foil_meta.naca_code = extract_naca_code(foil_meta.file_name) if foil_meta.is_naca else None

    # Version information
    foil_meta.schema_version = "v1"
    now_utc = datetime.now(timezone.utc).isoformat()
    if not foil_meta.generated_at_utc:
        foil_meta.generated_at_utc = now_utc
    foil_meta.updated_at_utc = now_utc

    return foil_meta

def fill_geometry_metadata_information(foil_meta: metadata.FoilMetadata, lines: dict) -> metadata.FoilMetadata:
    """
    Fill geometry metadata from geometry result JSON data.
    """

    geo = lines["geometry_metadata"]
    foil_meta.geometry_metadata.max_thickness = geo.get("max_thickness")
    foil_meta.geometry_metadata.x_max_thickness = geo.get("x_max_thickness")
    foil_meta.geometry_metadata.max_camber = geo.get("max_camber")
    foil_meta.geometry_metadata.x_max_camber = geo.get("x_max_camber")
    foil_meta.geometry_metadata.area_2d = geo.get("area_2d")
    foil_meta.geometry_metadata.leading_edge_radius = geo.get("leading_edge_radius")
    foil_meta.geometry_metadata.trailing_edge_thickness = geo.get("trailing_edge_thickness")
    foil_meta.geometry_metadata.trailing_edge_angle_deg = geo.get("trailing_edge_angle_deg")

    foil_meta.geometry_metadata.point_count_raw = geo.get("point_count_raw")
    foil_meta.geometry_metadata.point_count_clean = geo.get("point_count_clean")
    foil_meta.geometry_metadata.upper_point_count = geo.get("upper_point_count")
    foil_meta.geometry_metadata.lower_point_count = geo.get("lower_point_count")
    foil_meta.geometry_metadata.x_min = geo.get("x_min")
    foil_meta.geometry_metadata.x_max = geo.get("x_max")
    foil_meta.geometry_metadata.y_min = geo.get("y_min")
    foil_meta.geometry_metadata.y_max = geo.get("y_max")
    foil_meta.geometry_metadata.chord_raw = geo.get("chord_raw")
    foil_meta.geometry_metadata.is_normalized = geo.get("is_normalized")
    foil_meta.geometry_metadata.te_x_gap = geo.get("te_x_gap")
    foil_meta.geometry_metadata.te_y_gap = geo.get("te_y_gap")
    foil_meta.geometry_metadata.is_closed_curve = geo.get("is_closed_curve")
    foil_meta.geometry_metadata.is_multi_element = geo.get("is_multi_element")

    return foil_meta

def fill_aerodynamic_metadata_information(foil_meta: metadata.FoilMetadata, lines: dict) -> metadata.FoilMetadata:
    """Generate aerodynamic metadata for a given .dat file."""
    foil_meta.aerodynamic_metadata = []
    reynolds_results = lines["reynolds_results"]
    for rn in reynolds_results:
        aero_metadata = AerodynamicMetadata(
            reynolds_number=rn.get("reynolds_number"),
            mach_number=rn.get("mach_number"),
            n_crit=rn.get("n_crit"),
            alpha_min_deg=rn.get("alpha_min_deg"),
            alpha_max_deg=rn.get("alpha_max_deg"),
            alpha_step_deg=rn.get("alpha_step_deg"),
            cl_alpha=rn.get("cl_alpha"),
            cl_max=rn.get("cl_max"),
            cl_cd_max=rn.get("cl_cd_max"),
            cd_min=rn.get("cd_min"),
            cm_0=rn.get("cm_0"),
            alpha_stall_deg=rn.get("alpha_stall_deg")
        )
        foil_meta = add_new_aero_metadata(foil_meta, aero_metadata)
            
    return foil_meta

def fill_metadata_information(
    foil_meta: metadata.FoilMetadata,
    foil_file_path: Path,
) -> metadata.FoilMetadata | None:

    file_path = foil_file_path
    file_name = file_path.stem

    geo_file_path: Path = GEOMETRY_RESULTS_DIR / f"{file_name}_geometry_result.json"
    aero_file_path: Path = XFOIL_RESULTS_DIR / f"{file_name}_xfoil_result.json"

    try:
        with geo_file_path.open("r", encoding="utf-8") as f:
            geo_result = json.load(f)
        with aero_file_path.open("r", encoding="utf-8") as f:
            aero_result = json.load(f)
    except Exception as e:
        print(f"Error reading geometry or aerodynamic data from {geo_file_path} or {aero_file_path}: {e}")
        return None

    foil_meta = fill_general_metadata_information(foil_meta, file_path)
    foil_meta = fill_geometry_metadata_information(foil_meta, geo_result)
    foil_meta = fill_aerodynamic_metadata_information(foil_meta, aero_result)

    return foil_meta


def main() -> None:
    foil_file_folder_path = CLEAN_COORD_DIR
    metadata_output_path = METADATA_JSON_PATH

    foil_list = list_dat_files(foil_file_folder_path)
    metadata_list: list[metadata.FoilMetadata] = []
    
    for foil in foil_list:
        foil_meta = FoilMetadata(file_name="", path="")
        foil_meta = fill_metadata_information(foil_meta, foil)
        if foil_meta is not None:
            print(f"Metadata for {foil_meta.file_name}:")
            print(foil_meta)
            metadata_list.append(foil_meta)
        else:
            print(f"Failed to fill metadata for {foil.name}")

    metadata.save_metadata_json(metadata_list, metadata_output_path)

    return None
        
    
