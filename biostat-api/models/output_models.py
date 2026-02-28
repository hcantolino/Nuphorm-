"""
Response / output models for the Biostatistics API.

Covers:
  - ADaM records (ADSL, ADAE, ADLB, ADTTE)
  - Statistical result summaries
  - Dataset-JSON v1.0 envelope
  - Define-XML reference
  - Validation findings
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ── ADaM variable models ───────────────────────────────────────────────────────


class AdslRecord(BaseModel):
    """Subject-Level Analysis Dataset (ADSL) — ADaMIG §3.2 required variables."""
    # --- Identifier variables ---
    STUDYID: str
    USUBJID: str
    SUBJID: str
    SITEID: str

    # --- Demographic variables ---
    AGE: float | None = None
    AGEU: str | None = "YEARS"
    SEX: str | None = None           # M / F / U (CDISC CT: C66731)
    RACE: str | None = None          # CDISC CT: C74457
    ETHNIC: str | None = None        # CDISC CT: C66790

    # --- Treatment variables ---
    ARM: str | None = None           # Planned arm description
    ARMCD: str | None = None         # Planned arm code (≤20 chars)
    ACTARM: str | None = None        # Actual arm
    ACTARMCD: str | None = None

    # --- Treatment dates ---
    TRTSDT: str | None = None        # Treatment start date (ISO 8601)
    TRTEDT: str | None = None        # Treatment end date

    # --- Population flags (Y / N / '') ---
    SAFFL: str | None = None         # Safety population
    ITTFL: str | None = None         # Intent-to-treat
    PPROTFL: str | None = None       # Per-protocol
    RANDFL: str | None = None        # Randomised

    # --- Derivation metadata (traceability) ---
    TRACEABILITY: dict[str, str] | None = Field(
        default=None,
        description="Maps each derived variable to its SDTM source and rule.",
        exclude=True,  # omitted from Dataset-JSON rows; carried in metadata
    )

    model_config = {"extra": "allow"}  # permit study-specific variables


class AdaeRecord(BaseModel):
    """Adverse Events Analysis Dataset (ADAE)."""
    STUDYID: str
    USUBJID: str
    AESEQ: int | None = None
    AETERM: str | None = None
    AEDECOD: str | None = None      # MedDRA preferred term
    AEBODSYS: str | None = None     # MedDRA SOC
    AESEV: str | None = None        # MILD / MODERATE / SEVERE
    AESER: str | None = None        # Y / N
    AESTDTC: str | None = None
    AEENDTC: str | None = None
    ASTDT: str | None = None        # Analysis start date (numeric/char)
    AENDT: str | None = None
    TRTEMFL: str | None = None      # Treatment-emergent flag (Y / '')
    ANFL: str | None = None         # Analysis flag

    model_config = {"extra": "allow"}


class AdlbRecord(BaseModel):
    """Laboratory Data Analysis Dataset (ADLB)."""
    STUDYID: str
    USUBJID: str
    PARAMCD: str                    # ≤8 chars
    PARAM: str
    AVAL: float | None = None       # Analysis value
    AVALC: str | None = None        # Analysis value (character)
    BASE: float | None = None       # Baseline value
    CHG: float | None = None        # Change from baseline
    PCHG: float | None = None       # % change from baseline
    ABLFL: str | None = None        # Baseline record flag (Y / '')
    ANL01FL: str | None = None      # Analysis flag 01
    VISITNUM: float | None = None
    VISIT: str | None = None
    ADT: str | None = None          # Analysis date

    model_config = {"extra": "allow"}


class AdtteRecord(BaseModel):
    """Time-to-Event Analysis Dataset (ADTTE)."""
    STUDYID: str
    USUBJID: str
    PARAMCD: str
    PARAM: str
    AVAL: float | None = None       # Time to event (days)
    AVALU: str | None = "DAYS"
    CNSR: int | None = None         # 0 = event, 1 = censored
    EVNTDESC: str | None = None
    STARTDT: str | None = None
    ADT: str | None = None

    model_config = {"extra": "allow"}


# ── Statistical result models ─────────────────────────────────────────────────


class DescriptiveStats(BaseModel):
    """Summary statistics for a single parameter × group combination."""
    paramcd: str
    param: str
    group: str | None = None
    n: int
    mean: float | None = None
    std: float | None = None
    median: float | None = None
    q1: float | None = None
    q3: float | None = None
    min: float | None = None
    max: float | None = None
    missing: int = 0


class MMRMResult(BaseModel):
    """MMRM least-squares means and contrasts."""
    paramcd: str
    visits: list[str]
    lsmeans: list[dict[str, Any]]   # [{treatment, visit, lsmean, se, ci_lo, ci_hi}]
    contrasts: list[dict[str, Any]] # [{visit, diff, se, p_value, ci_lo, ci_hi}]
    convergence: str                # "converged" | "failed" | "singular"


class CoxPHResult(BaseModel):
    """Cox PH hazard ratios and Kaplan-Meier summary."""
    paramcd: str
    hr: float | None = None
    hr_ci_lo: float | None = None
    hr_ci_hi: float | None = None
    p_value: float | None = None
    log_rank_p: float | None = None
    median_tte: dict[str, float | None] = Field(
        default_factory=dict,
        description="Median time-to-event by treatment arm.",
    )
    km_table: list[dict[str, Any]] = Field(
        default_factory=list,
        description="KM step-function rows [{time, survival, at_risk, events, arm}].",
    )


class StatisticalResults(BaseModel):
    """All statistical results for one analysis request."""
    descriptive: list[DescriptiveStats] = Field(default_factory=list)
    mmrm: list[MMRMResult] = Field(default_factory=list)
    cox_ph: list[CoxPHResult] = Field(default_factory=list)


# ── Dataset-JSON v1.0 models ──────────────────────────────────────────────────


class DatasetJsonItem(BaseModel):
    """A single variable definition in Dataset-JSON items array."""
    OID: str          # e.g. "IT.ADSL.USUBJID"
    name: str
    label: str
    dataType: str     # text | integer | float | date | datetime
    length: int | None = None
    keySequence: int | None = None


class DatasetJsonItemGroup(BaseModel):
    """One domain within the Dataset-JSON itemGroupData."""
    records: int
    name: str
    label: str
    items: list[DatasetJsonItem]
    rows: list[list[Any]]  # each row is an ordered list matching items


class DatasetJsonResponse(BaseModel):
    """Top-level Dataset-JSON v1.0 envelope (CDISC DS-JSON §3)."""
    datasetJSONCreationDateTime: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat() + "Z"
    )
    datasetJSONVersion: str = "1.0.0"
    fileOID: str
    dbLastModifiedDateTime: str | None = None
    originator: str = "NuPhorm Platform"
    sourceSystem: dict[str, str] = Field(
        default_factory=lambda: {
            "name": "NuPhorm Biostatistics API",
            "version": "1.0.0",
        }
    )
    studyOID: str
    metaDataVersionOID: str = "MDV.1"
    metaDataRef: str = "define.xml"
    itemGroupData: dict[str, DatasetJsonItemGroup]


# ── Validation models ─────────────────────────────────────────────────────────


class ValidationFinding(BaseModel):
    severity: str           # "ERROR" | "WARNING" | "INFO"
    dataset: str
    variable: str | None = None
    rule: str               # e.g. "ADaMIG 1.3 §3.2.1"
    message: str


class ValidationReport(BaseModel):
    passed: bool
    findings: list[ValidationFinding] = Field(default_factory=list)
    datasets_checked: list[str] = Field(default_factory=list)


# ── Top-level API response ────────────────────────────────────────────────────


class AnalysisResponse(BaseModel):
    """
    Full response returned by POST /analyze.
    Contains ADaM datasets, statistical results, metadata, and validation.
    """
    study_id: str
    adam_version: str
    generated_at: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat() + "Z"
    )

    # ADaM datasets (plain JSON format; Dataset-JSON returned separately)
    adsl: list[AdslRecord] = Field(default_factory=list)
    adae: list[AdaeRecord] = Field(default_factory=list)
    adlb: list[AdlbRecord] = Field(default_factory=list)
    adtte: list[AdtteRecord] = Field(default_factory=list)

    # Statistical results
    statistical_results: StatisticalResults = Field(
        default_factory=StatisticalResults
    )

    # Dataset-JSON v1.0 (populated when output_format == "dataset_json")
    dataset_json: DatasetJsonResponse | None = None

    # Define-XML (XML string)
    define_xml: str | None = Field(
        None,
        description="Define-XML 2.1 document describing all generated ADaM datasets.",
    )

    # Validation
    validation: ValidationReport = Field(default_factory=ValidationReport)
