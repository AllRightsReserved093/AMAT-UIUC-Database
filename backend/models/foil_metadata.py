"""中文：定义后端使用的翼型 metadata 数据模型。
English: Defines backend metadata models for airfoil records.

These dataclasses intentionally mirror
metadata_generation.metadata so backend code can depend on a
stable model module without importing metadata-generation helpers.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional


def _to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


@dataclass
class GeometryMetadata:
    # Geometry information
    max_thickness: Optional[float] = None
    x_max_thickness: Optional[float] = None
    max_camber: Optional[float] = None
    x_max_camber: Optional[float] = None
    area_2d: Optional[float] = None
    leading_edge_radius: Optional[float] = None
    trailing_edge_thickness: Optional[float] = None
    trailing_edge_angle_deg: Optional[float] = None

    # Point and bounds summary
    point_count_raw: Optional[int] = None
    point_count_clean: Optional[int] = None
    upper_point_count: Optional[int] = None
    lower_point_count: Optional[int] = None
    x_min: Optional[float] = None
    x_max: Optional[float] = None
    y_min: Optional[float] = None
    y_max: Optional[float] = None
    chord_raw: Optional[float] = None
    is_normalized: Optional[bool] = None
    te_x_gap: Optional[float] = None
    te_y_gap: Optional[float] = None
    is_closed_curve: Optional[bool] = None
    is_multi_element: Optional[bool] = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "GeometryMetadata":
        return cls(
            max_thickness=_to_float(data.get("max_thickness")),
            x_max_thickness=_to_float(data.get("x_max_thickness")),
            max_camber=_to_float(data.get("max_camber")),
            x_max_camber=_to_float(data.get("x_max_camber")),
            area_2d=_to_float(data.get("area_2d")),
            leading_edge_radius=_to_float(data.get("leading_edge_radius")),
            trailing_edge_thickness=_to_float(data.get("trailing_edge_thickness")),
            trailing_edge_angle_deg=_to_float(data.get("trailing_edge_angle_deg")),
            point_count_raw=_to_int(data.get("point_count_raw")),
            point_count_clean=_to_int(data.get("point_count_clean")),
            upper_point_count=_to_int(data.get("upper_point_count")),
            lower_point_count=_to_int(data.get("lower_point_count")),
            x_min=_to_float(data.get("x_min")),
            x_max=_to_float(data.get("x_max")),
            y_min=_to_float(data.get("y_min")),
            y_max=_to_float(data.get("y_max")),
            chord_raw=_to_float(data.get("chord_raw")),
            is_normalized=data.get("is_normalized"),
            te_x_gap=_to_float(data.get("te_x_gap")),
            te_y_gap=_to_float(data.get("te_y_gap")),
            is_closed_curve=data.get("is_closed_curve"),
            is_multi_element=data.get("is_multi_element"),
        )


@dataclass
class AerodynamicMetadata:
    # Aerodynamic information
    reynolds_number: Optional[float] = None
    mach_number: Optional[float] = None
    n_crit: Optional[float] = None
    alpha_min_deg: Optional[float] = None
    alpha_max_deg: Optional[float] = None
    alpha_step_deg: Optional[float] = None
    cl_alpha: Optional[float] = None
    cl_max: Optional[float] = None
    cl_cd_max: Optional[float] = None
    cd_min: Optional[float] = None
    cm_0: Optional[float] = None
    alpha_stall_deg: Optional[float] = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "AerodynamicMetadata":
        return cls(
            reynolds_number=_to_float(data.get("reynolds_number")),
            mach_number=_to_float(data.get("mach_number")),
            n_crit=_to_float(data.get("n_crit")),
            alpha_min_deg=_to_float(data.get("alpha_min_deg")),
            alpha_max_deg=_to_float(data.get("alpha_max_deg")),
            alpha_step_deg=_to_float(data.get("alpha_step_deg")),
            cl_alpha=_to_float(data.get("cl_alpha")),
            cl_max=_to_float(data.get("cl_max")),
            cl_cd_max=_to_float(data.get("cl_cd_max")),
            cd_min=_to_float(data.get("cd_min")),
            cm_0=_to_float(data.get("cm_0")),
            alpha_stall_deg=_to_float(data.get("alpha_stall_deg")),
        )


@dataclass
class FoilMetadata:
    # ------------ General metadata ------------
    file_name: str
    path: str
    family_series: Optional[str] = None
    source: str = "uiuc_database"

    quality_flags: list[str] = field(default_factory=list)

    is_modified: bool = False
    is_smooth: bool = False
    is_naca: bool = False
    naca_code: Optional[str] = None

    # Version information
    schema_version: str = "v1"
    generated_at_utc: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at_utc: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    xfoil_version: Optional[str] = None

    # ------------ Analysis metadata ------------
    geometry_metadata: GeometryMetadata = field(default_factory=GeometryMetadata)
    aerodynamic_metadata: list[AerodynamicMetadata] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "FoilMetadata":
        geom_raw = data.get("geometry_metadata")
        aero_raw = data.get("aerodynamic_metadata", [])

        geom = GeometryMetadata.from_dict(geom_raw) if geom_raw else GeometryMetadata()
        aero = [AerodynamicMetadata.from_dict(x) for x in aero_raw]

        return cls(
            file_name=data["file_name"],
            path=data["path"],
            family_series=data.get("family_series"),
            source=data.get("source", "uiuc_database"),
            quality_flags=list(data.get("quality_flags", [])),
            is_modified=bool(data.get("is_modified", False)),
            is_smooth=bool(data.get("is_smooth", False)),
            is_naca=bool(data.get("is_naca", False)),
            naca_code=data.get("naca_code"),
            geometry_metadata=geom,
            aerodynamic_metadata=aero,
            schema_version=data.get("schema_version", "v1"),
            generated_at_utc=data.get("generated_at_utc", datetime.now(timezone.utc).isoformat()),
            updated_at_utc=data.get("updated_at_utc", datetime.now(timezone.utc).isoformat()),
            xfoil_version=data.get("xfoil_version"),
        )
