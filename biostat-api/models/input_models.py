"""
Request / input models for the Biostatistics API.

The AnalysisRequest accepts SDTM-like or raw tabular data together with
analysis parameters that drive ADaM derivations and statistical procedures.
"""
from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# ── Enums ─────────────────────────────────────────────────────────────────────


class OutputFormat(str, Enum):
    """Supported response payload formats."""
    json = "json"               # plain JSON records
    dataset_json = "dataset_json"  # CDISC Dataset-JSON v1.0
    xpt = "xpt"                 # SAS XPT (base64-encoded, returned in JSON envelope)


class AdamVersion(str, Enum):
    v1_3 = "1.3"
    v1_4 = "1.4"


class StatisticalMethod(str, Enum):
    descriptive = "descriptive"   # mean, median, SD, quartiles, min/max, n
    mmrm = "mmrm"                 # Mixed Model for Repeated Measures
    cox_ph = "cox_ph"             # Cox Proportional Hazards (survival)
    km = "km"                     # Kaplan-Meier
    ancova = "ancova"             # ANCOVA
    logistic = "logistic"         # Logistic regression
    chi_square = "chi_square"     # Chi-square / Fisher exact
    t_test = "t_test"             # Independent-samples t-test


class AdamDatasetType(str, Enum):
    ADSL = "ADSL"   # Subject-Level Analysis Dataset
    ADAE = "ADAE"   # Adverse Events
    ADLB  = "ADLB"  # Laboratory Data
    ADTTE = "ADTTE" # Time-to-Event
    ADEFF = "ADEFF" # Efficacy (custom)


class PopulationFlag(str, Enum):
    """Standard CDISC analysis-population flags."""
    SAFFL   = "SAFFL"    # Safety population
    ITTFL   = "ITTFL"    # Intent-to-treat
    PPROTFL = "PPROTFL"  # Per-protocol
    RANDFL  = "RANDFL"   # Randomised subjects
    COMPLFL = "COMPLFL"  # Completers


# ── Sub-models ────────────────────────────────────────────────────────────────


class MMRMParameters(BaseModel):
    """Parameters specific to MMRM analyses (ADaMIG 1.3 §4.3)."""
    response_var: str = Field(
        ...,
        description="Column name for the continuous repeated-measure endpoint (AVAL).",
        examples=["AVAL"],
    )
    time_var: str = Field(
        "AVISIT",
        description="Visit / time-point variable.",
        examples=["AVISIT"],
    )
    treatment_var: str = Field(
        "TRT01P",
        description="Planned treatment variable.",
        examples=["TRT01P"],
    )
    covariate_vars: list[str] = Field(
        default_factory=list,
        description="Additional covariates to include in the model.",
        examples=[["BASE", "SEX", "AGE"]],
    )
    unstructured_covariance: bool = Field(
        True,
        description="Use unstructured covariance matrix (UN). False → compound symmetry.",
    )


class CoxPHParameters(BaseModel):
    """Parameters for Cox PH / time-to-event analyses (ADTTE)."""
    time_var: str = Field("AVAL", description="Time-to-event variable (days).")
    event_var: str = Field("CNSR", description="Censoring flag (0 = event, 1 = censored).")
    treatment_var: str = Field("TRT01P", description="Treatment arm variable.")
    covariate_vars: list[str] = Field(default_factory=list)
    confidence_level: float = Field(0.95, ge=0.5, le=0.999)


class AnalysisParameter(BaseModel):
    """
    A single analysis to run on the submitted data.
    Multiple parameters may be requested in one call.
    """
    paramcd: str = Field(
        ...,
        description="CDISC PARAMCD value (e.g. 'DIABP', 'WGTKG', 'OS').",
        max_length=8,
        examples=["SYSBP"],
    )
    param: str = Field(
        ...,
        description="Full parameter label.",
        examples=["Systolic Blood Pressure (mmHg)"],
    )
    method: StatisticalMethod = Field(
        StatisticalMethod.descriptive,
        description="Statistical method to apply.",
    )
    populations: list[PopulationFlag] = Field(
        default_factory=lambda: [PopulationFlag.SAFFL],
        description="Analysis populations to include.",
    )
    mmrm_params: MMRMParameters | None = None
    cox_params: CoxPHParameters | None = None
    group_by: str | None = Field(
        None,
        description="Optional grouping variable (e.g. 'TRT01P') for subgroup summaries.",
    )


# ── Main request model ────────────────────────────────────────────────────────


class AnalysisRequest(BaseModel):
    """
    Full analysis request.  Accepts raw or SDTM-like tabular data plus
    the parameters that control ADaM derivation and statistical procedures.
    """

    # ── Study identification ──────────────────────────────────────────────────
    study_id: str = Field(
        ...,
        description="CDISC STUDYID value.",
        examples=["STUDY-001"],
    )
    adam_version: AdamVersion = Field(
        AdamVersion.v1_3,
        description="Target ADaMIG version for derivations and variable naming.",
    )
    output_format: OutputFormat = Field(
        OutputFormat.dataset_json,
        description="Format of the returned ADaM datasets.",
    )
    requested_datasets: list[AdamDatasetType] = Field(
        default_factory=lambda: [AdamDatasetType.ADSL],
        description="Which ADaM domains to generate.",
    )

    # ── Input data ────────────────────────────────────────────────────────────
    # Supply either inline_data (list of row dicts) or a CSV/JSON string.
    # For file uploads, use the /analyze/upload multipart endpoint.
    inline_data: list[dict[str, Any]] = Field(
        default_factory=list,
        description=(
            "Raw or SDTM-like rows as a list of dicts. "
            "Expected SDTM domains can be separated by a 'DOMAIN' key."
        ),
        examples=[
            [
                {
                    "STUDYID": "STUDY-001",
                    "DOMAIN": "DM",
                    "USUBJID": "STUDY-001-001-0001",
                    "SUBJID": "0001",
                    "SITEID": "001",
                    "AGE": 45,
                    "AGEU": "YEARS",
                    "SEX": "M",
                    "RACE": "WHITE",
                    "ETHNIC": "NOT HISPANIC OR LATINO",
                    "ARM": "Placebo",
                    "ARMCD": "PBO",
                    "RFSTDTC": "2023-01-15",
                    "RFENDTC": "2023-06-30",
                }
            ]
        ],
    )

    # ── Analysis parameters ───────────────────────────────────────────────────
    analysis_parameters: list[AnalysisParameter] = Field(
        default_factory=list,
        description="One or more statistical analyses to perform.",
    )

    # ── ADSL-specific derivation overrides ───────────────────────────────────
    treatment_var_sdtm: str = Field(
        "ARM",
        description="SDTM variable holding the planned treatment arm.",
    )
    date_format: str = Field(
        "%Y-%m-%d",
        description="Expected date format in the input data.",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "study_id": "STUDY-001",
                    "adam_version": "1.3",
                    "output_format": "dataset_json",
                    "requested_datasets": ["ADSL"],
                    "inline_data": [
                        {
                            "STUDYID": "STUDY-001",
                            "DOMAIN": "DM",
                            "USUBJID": "STUDY-001-001-0001",
                            "SUBJID": "0001",
                            "SITEID": "001",
                            "AGE": 45,
                            "AGEU": "YEARS",
                            "SEX": "M",
                            "RACE": "WHITE",
                            "ETHNIC": "NOT HISPANIC OR LATINO",
                            "ARM": "Placebo",
                            "ARMCD": "PBO",
                            "RFSTDTC": "2023-01-15",
                            "RFENDTC": "2023-06-30",
                        }
                    ],
                    "analysis_parameters": [
                        {
                            "paramcd": "AGE",
                            "param": "Age (Years)",
                            "method": "descriptive",
                            "populations": ["SAFFL"],
                            "group_by": "ARM",
                        }
                    ],
                }
            ]
        }
    }
