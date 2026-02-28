"""
Dataset-JSON v1.0 generator.

Converts ADaM domain records into the CDISC Dataset-JSON v1.0 format.
Spec: https://www.cdisc.org/standards/data-exchange/dataset-json

Top-level structure:
{
  "datasetJSONCreationDateTime": "...",
  "datasetJSONVersion": "1.0.0",
  "fileOID": "...",
  "originator": "...",
  "sourceSystem": {"name": "...", "version": "..."},
  "studyOID": "...",
  "metaDataVersionOID": "...",
  "metaDataRef": "define.xml",
  "itemGroupData": {
    "IG.ADSL": {
      "records": <n>,
      "name": "ADSL",
      "label": "Subject-Level Analysis Dataset",
      "items": [ {"OID":"...","name":"...","label":"...","type":"...","length":...}, ... ],
      "rows":  [ [...row values in item order...], ... ]
    }
  }
}
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from config import settings

# Variable metadata for each domain (name → {label, type, length})
_ADSL_META: list[tuple[str, str, str, int | None]] = [
    # (name, label, dataset_json_type, length)
    ("STUDYID",  "Study Identifier",                       "string",  20),
    ("USUBJID",  "Unique Subject Identifier",              "string",  50),
    ("SUBJID",   "Subject Identifier in the Study",        "string",  20),
    ("SITEID",   "Study Site Identifier",                  "string",  20),
    ("AGE",      "Age",                                    "decimal", None),
    ("AGEU",     "Age Units",                              "string",  10),
    ("SEX",      "Sex",                                    "string",  1),
    ("RACE",     "Race",                                   "string",  200),
    ("ETHNIC",   "Ethnicity",                              "string",  200),
    ("ARM",      "Description of Planned Arm",             "string",  200),
    ("ARMCD",    "Planned Arm Code",                       "string",  20),
    ("ACTARM",   "Description of Actual Arm",              "string",  200),
    ("ACTARMCD", "Actual Arm Code",                        "string",  20),
    ("TRTSDT",   "Date of First Exposure to Treatment",    "string",  10),
    ("TRTEDT",   "Date of Last Exposure to Treatment",     "string",  10),
    ("SAFFL",    "Safety Population Flag",                 "string",  1),
    ("ITTFL",    "Intent-to-Treat Population Flag",        "string",  1),
    ("RANDFL",   "Randomised Population Flag",             "string",  1),
    ("PPROTFL",  "Per-Protocol Population Flag",           "string",  1),
]

_ADAE_META: list[tuple[str, str, str, int | None]] = [
    ("STUDYID",  "Study Identifier",                       "string",  20),
    ("USUBJID",  "Unique Subject Identifier",              "string",  50),
    ("AESEQ",    "Sequence Number",                        "integer", None),
    ("AETERM",   "Reported Term for the Adverse Event",    "string",  200),
    ("AEDECOD",  "Dictionary-Derived Term",                "string",  200),
    ("AEBODSYS", "Body System or Organ Class",             "string",  200),
    ("AESEV",    "Severity/Intensity",                     "string",  10),
    ("AESER",    "Serious Event",                          "string",  1),
    ("ASTDT",    "Analysis Start Date",                    "string",  10),
    ("AENDT",    "Analysis End Date",                      "string",  10),
    ("TRTEMFL",  "Treatment Emergent Analysis Flag",       "string",  1),
    ("ANFL",     "Analysis Flag",                          "string",  1),
]

_ADLB_META: list[tuple[str, str, str, int | None]] = [
    ("STUDYID",  "Study Identifier",                       "string",  20),
    ("USUBJID",  "Unique Subject Identifier",              "string",  50),
    ("PARAMCD",  "Parameter Code",                         "string",  8),
    ("PARAM",    "Parameter",                              "string",  200),
    ("AVAL",     "Analysis Value",                         "decimal", None),
    ("AVALC",    "Analysis Value (C)",                     "string",  200),
    ("BASE",     "Baseline Value",                         "decimal", None),
    ("CHG",      "Change from Baseline",                   "decimal", None),
    ("PCHG",     "Percent Change from Baseline",           "decimal", None),
    ("ABLFL",    "Baseline Record Flag",                   "string",  1),
    ("ANL01FL",  "Analysis Flag 01",                       "string",  1),
    ("VISITNUM", "Visit Number",                           "decimal", None),
    ("VISIT",    "Visit Name",                             "string",  200),
    ("ADT",      "Analysis Date",                          "string",  10),
]

_ADTTE_META: list[tuple[str, str, str, int | None]] = [
    ("STUDYID",  "Study Identifier",                       "string",  20),
    ("USUBJID",  "Unique Subject Identifier",              "string",  50),
    ("PARAMCD",  "Parameter Code",                         "string",  8),
    ("PARAM",    "Parameter",                              "string",  200),
    ("AVAL",     "Analysis Value",                         "decimal", None),
    ("AVALU",    "Analysis Value Unit",                    "string",  10),
    ("CNSR",     "Censor",                                 "integer", None),
    ("EVNTDESC", "Event or Censoring Description",         "string",  200),
    ("STARTDT",  "Time-to-Event Origin Date",              "string",  10),
    ("ADT",      "Analysis Date",                          "string",  10),
]

_DOMAIN_META: dict[str, list[tuple[str, str, str, int | None]]] = {
    "ADSL":  _ADSL_META,
    "ADAE":  _ADAE_META,
    "ADLB":  _ADLB_META,
    "ADTTE": _ADTTE_META,
}

_DOMAIN_LABELS: dict[str, str] = {
    "ADSL":  "Subject-Level Analysis Dataset",
    "ADAE":  "Adverse Events Analysis Dataset",
    "ADLB":  "Laboratory Data Analysis Dataset",
    "ADTTE": "Time-to-Event Analysis Dataset",
}


def build_dataset_json(
    study_id: str,
    domains: dict[str, list[dict]],  # domain_name → list of record dicts
    metadata_ref: str = "define.xml",
) -> dict[str, Any]:
    """
    Build a Dataset-JSON v1.0 envelope for one or more ADaM domains.

    Args:
        study_id:     STUDYID value (used for fileOID / studyOID).
        domains:      Mapping of domain name → list of record dicts.
                      The '_TRACE' key is automatically stripped from rows.
        metadata_ref: Relative path to the Define-XML file (default: "define.xml").

    Returns:
        Dataset-JSON v1.0 structure as a Python dict (JSON-serialisable).
    """
    now = datetime.utcnow().isoformat() + "Z"
    item_group_data: dict[str, dict] = {}

    for domain, records in domains.items():
        if not records:
            continue

        meta = _DOMAIN_META.get(domain)
        if meta is None:
            # Generic fallback: infer columns from first record
            meta = _infer_meta(records[0])

        items = [
            {
                "OID":      f"IT.{domain}.{col}",
                "name":     col,
                "label":    label,
                "dataType": dtype,
                **({"length": length} if length else {}),
            }
            for col, label, dtype, length in meta
        ]

        col_order = [col for col, *_ in meta]
        rows = [_record_to_row(r, col_order) for r in records]

        item_group_data[f"IG.{domain}"] = {
            "records": len(rows),
            "name":    domain,
            "label":   _DOMAIN_LABELS.get(domain, domain),
            "items":   items,
            "rows":    rows,
        }

    return {
        "datasetJSONCreationDateTime": now,
        "datasetJSONVersion":          settings.dataset_json_version,
        "fileOID":                     f"DS.{study_id}.ADaM",
        "dbLastModifiedDateTime":      now,
        "originator":                  settings.originator,
        "sourceSystem": {
            "name":    "NuPhorm Biostatistics API",
            "version": "1.0.0",
        },
        "studyOID":          f"STUDY.{study_id}",
        "metaDataVersionOID":"MDV.ADAM.1",
        "metaDataRef":       metadata_ref,
        "itemGroupData":     item_group_data,
    }


def _record_to_row(record: dict, col_order: list[str]) -> list[Any]:
    """
    Convert a record dict to an ordered list matching items[].
    Strips internal '_TRACE' metadata key; coerces None → null.
    """
    clean = {k: v for k, v in record.items() if not k.startswith("_")}
    return [clean.get(col) for col in col_order]


def _infer_meta(
    record: dict,
) -> list[tuple[str, str, str, int | None]]:
    """Fallback: infer Dataset-JSON items from a record dict."""
    result = []
    for key, val in record.items():
        if key.startswith("_"):
            continue
        dtype = "decimal" if isinstance(val, float) else (
                "integer" if isinstance(val, int) else "string")
        result.append((key, key, dtype, None))
    return result
