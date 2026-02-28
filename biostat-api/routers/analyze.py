"""
POST /api/v1/analyze
POST /api/v1/analyze/upload   (multipart file upload)

Full pipeline:
  1. Accept SDTM-like data + analysis parameters
  2. Derive ADaM datasets (ADSL, ADAE, ADLB, ADTTE)
  3. Run statistical analyses (descriptive, MMRM, Cox PH)
  4. Generate Define-XML 2.1
  5. Build Dataset-JSON v1.0 envelope
  6. Validate all ADaM outputs
  7. Return everything in one response
"""
from __future__ import annotations

import io
import logging
import csv
import json

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from fastapi.responses import Response

from models.input_models import (
    AnalysisRequest,
    OutputFormat,
    AdamDatasetType,
    StatisticalMethod,
)
from services.adam_transformer import (
    derive_adsl,
    derive_adae,
    derive_adlb,
    derive_adtte,
    compute_descriptive,
    compute_mmrm,
    compute_cox_ph,
)
from services.define_xml import build_define_xml, validate_define_xml
from services.dataset_json import build_dataset_json
from services.validator import validate_all

logger = logging.getLogger(__name__)
router = APIRouter()

# Import lazily at call-time to avoid circular import at module load
def _store_datasets(study_id: str, domain_data: dict) -> None:
    from routers.adam_datasets import store_datasets
    store_datasets(study_id, domain_data)


# ── Main analysis endpoint ────────────────────────────────────────────────────


@router.post(
    "/analyze",
    summary="Submit data → receive ADaM datasets + statistics",
    response_description=(
        "ADaM domains (ADSL/ADAE/ADLB/ADTTE), statistical results, "
        "Define-XML 2.1, Dataset-JSON v1.0, and validation report."
    ),
    status_code=status.HTTP_200_OK,
)
async def analyze(req: AnalysisRequest) -> dict:
    """
    **Full analysis pipeline in one call.**

    - Accepts raw or SDTM-like rows via `inline_data`
    - Derives ADaM datasets according to ADaMIG 1.3/1.4
    - Runs statistical methods: `descriptive`, `mmrm`, `cox_ph`
    - Returns ADaM records, stats, Define-XML 2.1, Dataset-JSON v1.0,
      and a structural validation report
    """
    rows = req.inline_data
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="inline_data must not be empty.",
        )

    active_domains = [d.value for d in req.requested_datasets]

    # ── Step 1: Derive ADaM domains ───────────────────────────────────────────
    adsl  = derive_adsl(rows, date_fmt=req.date_format) if AdamDatasetType.ADSL  in req.requested_datasets else []
    adae  = derive_adae(rows, adsl)                     if AdamDatasetType.ADAE  in req.requested_datasets else []
    adlb  = derive_adlb(rows, adsl)                     if AdamDatasetType.ADLB  in req.requested_datasets else []
    adtte = derive_adtte(rows, adsl)                    if AdamDatasetType.ADTTE in req.requested_datasets else []

    # ── Step 2: Statistical analyses ──────────────────────────────────────────
    descriptive_results = []
    mmrm_results        = []
    cox_results         = []

    for param in req.analysis_parameters:
        # Determine analysis population (filter ADSL by flag)
        pop_flag = param.populations[0].value if param.populations else "SAFFL"
        pop_uids = {r["USUBJID"] for r in adsl if r.get(pop_flag) == "Y"}

        if param.method == StatisticalMethod.descriptive:
            analysis_data = [r for r in adsl if r.get("USUBJID") in pop_uids]
            stats = compute_descriptive(
                analysis_data,
                value_col=param.paramcd,
                paramcd=param.paramcd,
                param=param.param,
                group_col=req.treatment_var_sdtm if param.group_by else None,
            )
            descriptive_results.extend(stats)

        elif param.method == StatisticalMethod.mmrm and param.mmrm_params:
            analysis_data = [r for r in adlb if r.get("USUBJID") in pop_uids]
            mmrm_result = compute_mmrm(
                data=analysis_data,
                response_var=param.mmrm_params.response_var,
                time_var=param.mmrm_params.time_var,
                treatment_var=param.mmrm_params.treatment_var,
                covariate_vars=param.mmrm_params.covariate_vars,
                paramcd=param.paramcd,
            )
            mmrm_results.append(mmrm_result)

        elif param.method == StatisticalMethod.cox_ph:
            analysis_tte = [r for r in adtte if r.get("USUBJID") in pop_uids]
            # Merge treatment arm from ADSL
            adsl_map = {r["USUBJID"]: r for r in adsl}
            for r in analysis_tte:
                r[req.treatment_var_sdtm] = adsl_map.get(r["USUBJID"], {}).get(req.treatment_var_sdtm)
            cox_result = compute_cox_ph(analysis_tte, req.treatment_var_sdtm, param.paramcd)
            cox_results.append(cox_result)

    # ── Step 3: Define-XML 2.1 ────────────────────────────────────────────────
    define_xml_str = build_define_xml(
        study_id=req.study_id,
        adam_version=req.adam_version.value,
        active_domains=active_domains,
    )

    # Validate Define-XML structure
    define_xml_findings = validate_define_xml(define_xml_str)

    # ── Step 4: Dataset-JSON v1.0 ─────────────────────────────────────────────
    domain_data = {}
    if adsl:  domain_data["ADSL"]  = adsl
    if adae:  domain_data["ADAE"]  = adae
    if adlb:  domain_data["ADLB"]  = adlb
    if adtte: domain_data["ADTTE"] = adtte

    dataset_json = build_dataset_json(
        study_id=req.study_id,
        domains=domain_data,
    )

    # ── Step 5: ADaM structural validation ────────────────────────────────────
    validation = validate_all(
        adsl=adsl  or None,
        adae=adae  or None,
        adlb=adlb  or None,
        adtte=adtte or None,
    )
    # Inject Define-XML findings
    for f in define_xml_findings:
        validation["findings"].append({
            "severity": f["level"],
            "dataset":  "DEFINE-XML",
            "variable": None,
            "rule":     f["rule"],
            "message":  f["message"],
        })
    if any(f["severity"] == "ERROR" for f in define_xml_findings):
        validation["passed"] = False

    # ── Step 6: Persist to in-process store (enables GET /adam-dataset/…) ────
    if domain_data:
        _store_datasets(req.study_id, domain_data)

    # ── Step 7: Build response ────────────────────────────────────────────────
    return {
        "study_id":     req.study_id,
        "adam_version": req.adam_version.value,
        "generated_at": _now_iso(),
        # ADaM records (trace keys stripped)
        "adsl":  [_strip_trace(r) for r in adsl],
        "adae":  [_strip_trace(r) for r in adae],
        "adlb":  [_strip_trace(r) for r in adlb],
        "adtte": [_strip_trace(r) for r in adtte],
        # Statistics
        "statistical_results": {
            "descriptive": descriptive_results,
            "mmrm":        mmrm_results,
            "cox_ph":      cox_results,
        },
        # Metadata exports
        "dataset_json": dataset_json if req.output_format == OutputFormat.dataset_json else None,
        "define_xml":   define_xml_str,
        # Validation
        "validation": validation,
    }


# ── File upload endpoint ──────────────────────────────────────────────────────


@router.post(
    "/analyze/upload",
    summary="Upload CSV/JSON file → receive ADaM datasets",
    status_code=status.HTTP_200_OK,
)
async def analyze_upload(
    file: UploadFile = File(..., description="CSV or JSON file with SDTM-like data"),
    study_id: str  = Form(..., description="CDISC STUDYID"),
    adam_version: str = Form("1.3"),
    requested_datasets: str = Form("ADSL", description="Comma-separated domain list, e.g. 'ADSL,ADAE'"),
    output_format: str = Form("dataset_json"),
) -> dict:
    """
    Upload a **CSV** or **JSON** file containing SDTM-like data rows.
    The API derives ADaM datasets and returns the same payload as `/analyze`.
    """
    content = await file.read()
    filename = file.filename or ""

    # ── Parse uploaded file ───────────────────────────────────────────────────
    rows: list[dict] = []
    if filename.endswith(".csv"):
        reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
        for row in reader:
            rows.append({k: _coerce(v) for k, v in row.items()})
    elif filename.endswith(".json") or filename.endswith(".ndjson"):
        parsed = json.loads(content)
        rows = parsed if isinstance(parsed, list) else [parsed]
    else:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{filename}'. Use .csv or .json.",
        )

    if not rows:
        raise HTTPException(status_code=422, detail="Uploaded file contains no data rows.")

    # ── Build a synthetic AnalysisRequest and delegate ────────────────────────
    domains = [d.strip().upper() for d in requested_datasets.split(",")]
    req = AnalysisRequest(
        study_id=study_id,
        adam_version=adam_version,                              # type: ignore[arg-type]
        output_format=output_format,                            # type: ignore[arg-type]
        requested_datasets=[AdamDatasetType(d) for d in domains if d in AdamDatasetType.__members__],
        inline_data=rows,
    )
    return await analyze(req)


# ── Define-XML download endpoint ──────────────────────────────────────────────


@router.post(
    "/analyze/define-xml",
    summary="Generate Define-XML 2.1 for given domains",
    response_class=Response,
    responses={200: {"content": {"application/xml": {}}}},
)
async def generate_define_xml(
    study_id: str,
    adam_version: str = "1.3",
    domains: str = "ADSL,ADAE,ADLB,ADTTE",
) -> Response:
    """
    Returns a **raw Define-XML 2.1** document (Content-Type: application/xml)
    for the requested ADaM domains.
    """
    active = [d.strip().upper() for d in domains.split(",")]
    xml_str = build_define_xml(
        study_id=study_id,
        adam_version=adam_version,
        active_domains=active,
    )
    findings = validate_define_xml(xml_str)
    errors   = [f for f in findings if f["level"] == "ERROR"]

    if errors:
        raise HTTPException(
            status_code=500,
            detail=f"Define-XML validation failed with {len(errors)} errors: "
                   + "; ".join(e["message"] for e in errors[:3]),
        )

    return Response(
        content=xml_str,
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="define_{study_id}.xml"'},
    )


# ── Helpers ───────────────────────────────────────────────────────────────────


def _strip_trace(record: dict) -> dict:
    return {k: v for k, v in record.items() if not k.startswith("_")}


def _coerce(val: str) -> str | int | float:
    """Try to coerce a CSV string to int or float; otherwise keep as string."""
    stripped = val.strip()
    try:
        return int(stripped)
    except ValueError:
        pass
    try:
        return float(stripped)
    except ValueError:
        pass
    return stripped


def _now_iso() -> str:
    from datetime import datetime
    return datetime.utcnow().isoformat() + "Z"
