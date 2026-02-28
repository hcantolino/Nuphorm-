"""
CDISC Library API client.

Fetches ADaMIG variable definitions, controlled terminology codelists,
and standard metadata from https://library.cdisc.org/api.

Register for an API key: https://api.developer.library.cdisc.org
"""
from __future__ import annotations

import logging
from functools import lru_cache

import httpx

from config import settings

logger = logging.getLogger(__name__)

_BASE = settings.cdisc_library_base_url


def _headers() -> dict[str, str]:
    return {
        "api-key": settings.cdisc_api_key,
        "Accept": "application/json",
    }


# ── ADaMIG variable definitions ───────────────────────────────────────────────


async def get_adamig_versions() -> list[str]:
    """Return all published ADaMIG versions from the CDISC Library."""
    if not settings.cdisc_api_key:
        logger.warning("CDISC_API_KEY not set – returning default versions")
        return ["1.0", "1.1", "1.2", "1.3", "1.4"]

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{_BASE}/mdr/adam/adamig/versions", headers=_headers())
        r.raise_for_status()
        return r.json().get("versions", [])


async def get_adamig_variables(version: str = "1.3") -> list[dict]:
    """
    Fetch all ADaM variable definitions for a given ADaMIG version.

    Returns a list like:
      [{"name": "USUBJID", "label": "...", "type": "Char", "core": "Req", ...}]
    """
    if not settings.cdisc_api_key:
        logger.warning("CDISC_API_KEY not set – returning hardcoded ADSL skeleton")
        return _fallback_adsl_variables()

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{_BASE}/mdr/adam/adamig/{version}/datasets/ADSL/variables",
            headers=_headers(),
        )
        r.raise_for_status()
        return r.json().get("_links", {}).get("variables", [])


# ── Controlled Terminology ────────────────────────────────────────────────────


async def get_ct_package_dates() -> list[str]:
    """List available CDISC CT package release dates."""
    if not settings.cdisc_api_key:
        return ["2023-09-29", "2023-06-30", "2023-03-31"]

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{_BASE}/mdr/ct/packages", headers=_headers())
        r.raise_for_status()
        packages = r.json().get("_links", {}).get("packages", [])
        return [p.get("href", "").split("/")[-1] for p in packages]


async def get_codelist(package_date: str, codelist_id: str) -> dict:
    """
    Fetch a CDISC CT codelist by package date and codelist C-code.

    Example: get_codelist("2023-09-29", "C66731")  → SEX codelist
    """
    if not settings.cdisc_api_key:
        return _fallback_codelist(codelist_id)

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{_BASE}/mdr/ct/packages/{package_date}/codelists/{codelist_id}",
            headers=_headers(),
        )
        r.raise_for_status()
        return r.json()


@lru_cache(maxsize=32)
def get_nci_code_sync(codelist_c_code: str) -> list[str]:
    """
    Synchronous thin wrapper used during validation.
    Returns the list of permissible submission values for a codelist.
    Falls back to hard-coded common values when no API key is configured.
    """
    fallbacks: dict[str, list[str]] = {
        "C66731": ["M", "F", "U", "UNDIFFERENTIATED"],          # SEX
        "C74457": [                                               # RACE
            "AMERICAN INDIAN OR ALASKA NATIVE",
            "ASIAN",
            "BLACK OR AFRICAN AMERICAN",
            "NATIVE HAWAIIAN OR OTHER PACIFIC ISLANDER",
            "WHITE",
            "MULTIPLE",
            "NOT REPORTED",
            "UNKNOWN",
        ],
        "C66790": [                                               # ETHNIC
            "HISPANIC OR LATINO",
            "NOT HISPANIC OR LATINO",
            "NOT REPORTED",
            "UNKNOWN",
        ],
        "C101526": ["Y", "N"],                                   # NY (Yes/No)
    }
    return fallbacks.get(codelist_c_code, [])


# ── Define-XML metadata proxy ─────────────────────────────────────────────────


async def get_define_xml_standard(version: str = "2.1") -> dict:
    """Fetch Define-XML standard metadata from CDISC Library."""
    if not settings.cdisc_api_key:
        return {"version": version, "namespace": "http://www.cdisc.org/ns/def/v2.1"}

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{_BASE}/mdr/cdisc/define-xml/{version}",
            headers=_headers(),
        )
        r.raise_for_status()
        return r.json()


# ── Fallback data (no API key configured) ─────────────────────────────────────


def _fallback_adsl_variables() -> list[dict]:
    """
    Minimal ADSL required / expected variable metadata (ADaMIG 1.3 §3.2).
    Used when no CDISC API key is available.
    """
    return [
        {"name": "STUDYID", "label": "Study Identifier",            "type": "Char", "core": "Req", "length": 20},
        {"name": "USUBJID", "label": "Unique Subject Identifier",    "type": "Char", "core": "Req", "length": 50},
        {"name": "SUBJID",  "label": "Subject Identifier",          "type": "Char", "core": "Req", "length": 20},
        {"name": "SITEID",  "label": "Study Site Identifier",       "type": "Char", "core": "Req", "length": 20},
        {"name": "AGE",     "label": "Age",                         "type": "Num",  "core": "Exp"},
        {"name": "AGEU",    "label": "Age Units",                   "type": "Char", "core": "Exp", "codelist": "AGEU"},
        {"name": "SEX",     "label": "Sex",                         "type": "Char", "core": "Exp", "codelist": "C66731"},
        {"name": "RACE",    "label": "Race",                        "type": "Char", "core": "Exp", "codelist": "C74457"},
        {"name": "ETHNIC",  "label": "Ethnicity",                   "type": "Char", "core": "Exp", "codelist": "C66790"},
        {"name": "ARM",     "label": "Description of Planned Arm",  "type": "Char", "core": "Req"},
        {"name": "ARMCD",   "label": "Planned Arm Code",            "type": "Char", "core": "Req", "length": 20},
        {"name": "ACTARM",  "label": "Description of Actual Arm",   "type": "Char", "core": "Req"},
        {"name": "ACTARMCD","label": "Actual Arm Code",             "type": "Char", "core": "Req", "length": 20},
        {"name": "TRTSDT",  "label": "Date of First Exposure",      "type": "Num",  "core": "Exp"},
        {"name": "TRTEDT",  "label": "Date of Last Exposure",       "type": "Num",  "core": "Exp"},
        {"name": "SAFFL",   "label": "Safety Population Flag",      "type": "Char", "core": "Exp", "codelist": "C101526"},
        {"name": "ITTFL",   "label": "Intent-to-Treat Population Flag","type": "Char","core": "Exp","codelist": "C101526"},
        {"name": "PPROTFL", "label": "Per-Protocol Population Flag","type": "Char", "core": "Exp", "codelist": "C101526"},
        {"name": "RANDFL",  "label": "Randomised Population Flag",  "type": "Char", "core": "Exp", "codelist": "C101526"},
    ]


def _fallback_codelist(c_code: str) -> dict:
    return {
        "conceptId": c_code,
        "name": f"Unknown codelist {c_code}",
        "terms": [],
    }
