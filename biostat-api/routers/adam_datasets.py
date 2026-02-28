"""
GET  /api/v1/adam-dataset/{study_id}/{domain}   – retrieve a generated dataset
GET  /api/v1/adam-dataset/{study_id}             – list all domains for a study
POST /api/v1/adam-dataset/{study_id}/validate    – validate stored/submitted records
GET  /api/v1/metadata/adam/{version}             – proxy CDISC Library ADaMIG metadata
GET  /api/v1/metadata/ct/{codelist_id}           – proxy CDISC CT codelist
GET  /api/v1/metadata/adam/versions              – list available ADaMIG versions

In-process storage: a simple module-level dict acts as an ephemeral dataset store.
In production, swap _STORE for a database / S3 backend.
"""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query, status

from services.adam_transformer import (
    derive_adsl,
    derive_adae,
    derive_adlb,
    derive_adtte,
)
from services.validator import validate_adam, validate_all
from services.cdisc_library import (
    get_adamig_versions,
    get_adamig_variables,
    get_codelist,
    get_ct_package_dates,
    get_nci_code_sync,
)
from models.input_models import AdamDatasetType

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Ephemeral in-process dataset store ───────────────────────────────────────
# Maps  study_id → domain → list[dict]
# Populated by the /analyze endpoint via store_datasets() below.
_STORE: dict[str, dict[str, list[dict]]] = {}


# ── Public helper (called by analyze router after derivation) ─────────────────


def store_datasets(study_id: str, domain_data: dict[str, list[dict]]) -> None:
    """Persist derived ADaM records in the module-level store."""
    if study_id not in _STORE:
        _STORE[study_id] = {}
    for domain, records in domain_data.items():
        _STORE[study_id][domain.upper()] = records
    logger.info("Stored %d domain(s) for study '%s'", len(domain_data), study_id)


# ── Dataset retrieval ─────────────────────────────────────────────────────────


@router.get(
    "/adam-dataset/{study_id}",
    summary="List all stored ADaM domains for a study",
    tags=["ADaM Datasets"],
)
async def list_study_domains(
    study_id: Annotated[str, Path(description="CDISC STUDYID")],
) -> dict:
    """
    Returns the list of ADaM domains currently stored for *study_id*
    together with their record counts.
    """
    study = _STORE.get(study_id)
    if study is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No datasets found for study '{study_id}'. "
                   "Submit data via POST /api/v1/analyze first.",
        )
    return {
        "study_id": study_id,
        "domains": {domain: len(records) for domain, records in study.items()},
    }


@router.get(
    "/adam-dataset/{study_id}/{domain}",
    summary="Retrieve a specific ADaM domain dataset",
    tags=["ADaM Datasets"],
)
async def get_domain_dataset(
    study_id: Annotated[str, Path(description="CDISC STUDYID")],
    domain: Annotated[str, Path(description="ADaM domain name, e.g. ADSL, ADAE")],
    offset: Annotated[int, Query(ge=0, description="Row offset (pagination)")] = 0,
    limit: Annotated[int, Query(ge=1, le=5000, description="Max rows to return")] = 500,
    strip_trace: Annotated[bool, Query(description="Strip internal _TRACE metadata keys")] = True,
) -> dict:
    """
    Returns the stored ADaM records for *study_id* / *domain* with optional
    pagination (`offset` + `limit`) and trace-key filtering.
    """
    domain_upper = domain.upper()
    study = _STORE.get(study_id, {})
    records = study.get(domain_upper)

    if records is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Domain '{domain_upper}' not found for study '{study_id}'. "
                   f"Available domains: {list(study.keys()) or 'none'}.",
        )

    page = records[offset: offset + limit]
    if strip_trace:
        page = [{k: v for k, v in r.items() if not k.startswith("_")} for r in page]

    return {
        "study_id":   study_id,
        "domain":     domain_upper,
        "total":      len(records),
        "offset":     offset,
        "limit":      limit,
        "records":    page,
    }


# ── On-the-fly validation ─────────────────────────────────────────────────────


@router.post(
    "/adam-dataset/{study_id}/validate",
    summary="Validate stored ADaM datasets for a study",
    tags=["ADaM Datasets"],
)
async def validate_study_datasets(
    study_id: Annotated[str, Path(description="CDISC STUDYID")],
    strict: Annotated[bool, Query(description="Promote WARNINGs to ERRORs")] = False,
) -> dict:
    """
    Runs the structural ADaM validator across all stored domains for *study_id*.
    Returns a `ValidationReport` identical to the one in POST /analyze.
    """
    study = _STORE.get(study_id)
    if not study:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No datasets found for study '{study_id}'.",
        )

    report = validate_all(
        adsl=study.get("ADSL"),
        adae=study.get("ADAE"),
        adlb=study.get("ADLB"),
        adtte=study.get("ADTTE"),
        strict=strict,
    )
    return {"study_id": study_id, **report}


@router.post(
    "/adam-dataset/validate",
    summary="Validate submitted ADaM records (no storage)",
    tags=["ADaM Datasets"],
    status_code=status.HTTP_200_OK,
)
async def validate_inline_records(
    payload: dict,
    strict: Annotated[bool, Query(description="Promote WARNINGs to ERRORs")] = False,
) -> dict:
    """
    Validate ADaM records without storing them.

    **Request body shape:**
    ```json
    {
      "ADSL": [...],
      "ADAE": [...],
      "ADLB": [...],
      "ADTTE": [...]
    }
    ```
    Only the domains present in the body are validated.
    """
    valid_domains = {"ADSL", "ADAE", "ADLB", "ADTTE"}
    domain_data: dict[str, list[dict]] = {}
    for key, val in payload.items():
        if key.upper() in valid_domains and isinstance(val, list):
            domain_data[key.upper()] = val

    if not domain_data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Request body must contain at least one ADaM domain key "
                   "(ADSL, ADAE, ADLB, or ADTTE) with a list of records.",
        )

    report = validate_all(
        adsl=domain_data.get("ADSL"),
        adae=domain_data.get("ADAE"),
        adlb=domain_data.get("ADLB"),
        adtte=domain_data.get("ADTTE"),
        strict=strict,
    )
    return report


# ── CDISC metadata proxy endpoints ───────────────────────────────────────────


@router.get(
    "/metadata/adam/versions",
    summary="List available ADaMIG versions from the CDISC Library",
    tags=["CDISC Metadata"],
)
async def list_adamig_versions() -> dict:
    """
    Proxies `GET /mdr/adam/adamig/versions` from the CDISC Library API.
    Falls back to a hard-coded list when no API key is configured.
    """
    versions = await get_adamig_versions()
    return {"versions": versions}


@router.get(
    "/metadata/adam/{version}",
    summary="ADaMIG variable definitions for a given version",
    tags=["CDISC Metadata"],
)
async def get_adamig_metadata(
    version: Annotated[str, Path(description="ADaMIG version, e.g. 1.3 or 1.4")],
) -> dict:
    """
    Returns the ADSL variable definitions for the requested ADaMIG version.
    Proxies the CDISC Library and caches at the HTTP client layer.
    Falls back to a hardcoded skeleton when no API key is configured.
    """
    variables = await get_adamig_variables(version)
    return {"version": version, "variables": variables}


@router.get(
    "/metadata/ct/packages",
    summary="List available CDISC CT package dates",
    tags=["CDISC Metadata"],
)
async def list_ct_packages() -> dict:
    """Returns available CDISC Controlled Terminology release dates."""
    dates = await get_ct_package_dates()
    return {"packages": dates}


@router.get(
    "/metadata/ct/{codelist_id}",
    summary="Fetch a CDISC CT codelist by C-code",
    tags=["CDISC Metadata"],
)
async def get_ct_codelist(
    codelist_id: Annotated[
        str,
        Path(
            description="NCI C-code of the codelist, e.g. C66731 (SEX), "
                        "C74457 (RACE), C101526 (NY).",
        ),
    ],
    package_date: Annotated[
        str,
        Query(description="CT package date (YYYY-MM-DD). Defaults to latest available."),
    ] = "",
) -> dict:
    """
    Returns permitted submission values for a CDISC CT codelist.

    If no `package_date` is provided the endpoint picks the latest available
    package.  When no CDISC API key is configured it falls back to the
    hard-coded NCI values bundled in `cdisc_library.py`.
    """
    # Resolve package date
    if not package_date:
        dates = await get_ct_package_dates()
        package_date = dates[0] if dates else "2023-09-29"

    # Try the live CDISC Library first; fall back to in-process cache
    try:
        data = await get_codelist(package_date, codelist_id)
    except Exception as exc:  # network / auth failure
        logger.warning("CDISC Library request failed (%s); using local fallback", exc)
        allowed = get_nci_code_sync(codelist_id)
        data = {
            "conceptId": codelist_id,
            "packageDate": package_date,
            "submissionValues": allowed,
            "source": "local-fallback",
        }

    return data


# ── Store management (dev / test only) ───────────────────────────────────────


@router.delete(
    "/adam-dataset/{study_id}",
    summary="Delete all stored datasets for a study (dev/test only)",
    tags=["ADaM Datasets"],
    status_code=status.HTTP_200_OK,
)
async def delete_study_datasets(
    study_id: Annotated[str, Path(description="CDISC STUDYID to delete")],
) -> dict:
    """
    Removes all in-memory datasets for *study_id*.
    Useful during development and integration testing.
    """
    if study_id not in _STORE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No datasets found for study '{study_id}'.",
        )
    domains = list(_STORE.pop(study_id).keys())
    return {"study_id": study_id, "deleted_domains": domains}


@router.get(
    "/adam-dataset",
    summary="List all studies currently in the in-process store",
    tags=["ADaM Datasets"],
)
async def list_all_studies() -> dict:
    """
    Returns every study ID currently held in the ephemeral dataset store
    along with per-domain record counts.  Primarily for debugging.
    """
    return {
        "studies": {
            sid: {domain: len(records) for domain, records in domains.items()}
            for sid, domains in _STORE.items()
        }
    }
