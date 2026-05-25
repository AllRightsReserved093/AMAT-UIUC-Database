"""Infer family_series from a UIUC coord_seligFmt file name.

Rules are based on UIUC Airfoil Coordinates Database naming examples.
Unknown names return None.
"""

from __future__ import annotations

import re
from pathlib import Path


# Ordered rules: specific before generic.
_RULES: list[tuple[re.Pattern[str], str]] = [
    # Canonical families directly reflected in many UIUC names.
    (re.compile(r"^naca"), "NACA"),
    (re.compile(r"^ag\d"), "Drela AG"),
    (re.compile(r"^ah\d"), "Althaus AH"),
    (re.compile(r"^mh\d"), "Martin Hepperle MH"),
    (re.compile(r"^hq\d"), "HQ (Horstmann/Quast)"),
    (re.compile(r"^goe\d"), "Gottingen GOE"),
    (re.compile(r"^fx"), "Wortmann FX"),
    (re.compile(r"^e\d"), "Eppler E"),
    (re.compile(r"^sd\d"), "Selig/Donovan SD"),
    (re.compile(r"^sg\d"), "Selig/Giguere SG"),
    (re.compile(r"^sa\d"), "Selig/Ashok SA"),
    (re.compile(r"^as\d"), "AS (Ashok/Selig)"),
    (re.compile(r"^sc\d"), "SC (Sikorsky/NASA SC)"),
    (re.compile(r"^rg\d"), "Rolf Girsberger RG"),
    (re.compile(r"^rae\d"), "RAE"),
    (re.compile(r"^raf\d"), "RAF"),
    (re.compile(r"^usa\d"), "USA"),
    (re.compile(r"^nlf\d"), "NASA NLF"),
    (re.compile(r"^nlr"), "NLR"),
    (re.compile(r"^npl\d"), "NPL"),
    (re.compile(r"^du[-\d]"), "Delft University DU"),
    (re.compile(r"^clark|^clary"), "Clark"),
    # Common Selig S-series convention (avoid names like "saratov.dat").
    (re.compile(r"^s\d{4}[a-z0-9-]*$"), "Selig S"),
    # Compact NACA-style names in UIUC (e.g., n2414, n64215, n5h10).
    (re.compile(r"^n\d+h\d+[a-z0-9-]*$"), "NACA"),
    (re.compile(r"^n\d{4,}[a-z0-9-]*$"), "NACA"),
    # Non-NACA N-series (e.g., n10, n11, n24).
    (re.compile(r"^n\d{1,2}[a-z0-9-]*$"), "N-Series"),
]


def _normalize_stem(file_name: str) -> str:
    """Normalize file/path to lowercase stem."""
    return Path(file_name).stem.lower().strip()


def get_family_series_from_filename(file_name: str) -> str | None:
    """Return inferred family_series from file name, or None if unknown."""
    stem = _normalize_stem(file_name)
    for pattern, family in _RULES:
        if pattern.search(stem):
            return family
    return None

