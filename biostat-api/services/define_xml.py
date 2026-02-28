"""
Define-XML 2.1 generator and structural validator.

Produces a CDISC-compliant Define-XML 2.1 document for ADaM datasets including:
  - ODM root with all required attributes
  - Study / GlobalVariables / MetaDataVersion block
  - def:Standards element (ADaMIG version)
  - ItemGroupDef per domain with def:leaf pointers to Dataset-JSON files
  - ItemDef for every variable (DataType, Length, Description, Origin, Comment)
  - CodeListDef for all controlled terminology referenced by variables
  - WhereClauseDef for value-level metadata (e.g. ABLFL='Y' baseline filter)
  - def:CommentDef nodes carrying derivation rules for traceability
  - Structural validator that checks required elements/attributes

Standards:
  Define-XML 2.1 specification (CDISC)
  ADaMIG 1.3/1.4
  NCI EVS C-codes for controlled terminology
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from lxml import etree

logger = logging.getLogger(__name__)

# ── XML namespaces ─────────────────────────────────────────────────────────────

NS = {
    "odm":  "http://www.cdisc.org/ns/odm/v1.3",
    "def":  "http://www.cdisc.org/ns/def/v2.1",
    "arm":  "http://www.cdisc.org/ns/arm/v1.0",
    "xsi":  "http://www.w3.org/2001/XMLSchema-instance",
    "xml":  "http://www.w3.org/XML/1998/namespace",
}

NSMAP = {
    None:    NS["odm"],
    "def":   NS["def"],
    "arm":   NS["arm"],
    "xsi":   NS["xsi"],
}

_SCHEMA_LOCATION = (
    "http://www.cdisc.org/ns/odm/v1.3 "
    "https://library.cdisc.org/api/mdr/schemas/define-xml/2-1/schema"
)


def _q(ns_key: str, tag: str) -> str:
    """Qualified tag name."""
    return f"{{{NS[ns_key]}}}{tag}"


def _odm(tag: str) -> str: return _q("odm", tag)
def _def(tag: str) -> str: return _q("def", tag)
def _xml(attr: str) -> str: return _q("xml", attr)


# ── Controlled terminology (NCI EVS C-codes) ──────────────────────────────────

# Each entry: OID → {name, c_code, extensible, terms: [{coded_value, nci_code, decode}]}
_CODELISTS: dict[str, dict] = {
    "CL.C66731": {
        "name": "Sex",
        "c_code": "C66731",
        "extensible": "No",
        "terms": [
            {"coded_value": "M",               "nci_code": "C20197", "decode": "Male"},
            {"coded_value": "F",               "nci_code": "C16576", "decode": "Female"},
            {"coded_value": "U",               "nci_code": "C17998", "decode": "Unknown"},
            {"coded_value": "UNDIFFERENTIATED","nci_code": "C38046", "decode": "Undifferentiated"},
        ],
    },
    "CL.C74457": {
        "name": "Race",
        "c_code": "C74457",
        "extensible": "No",
        "terms": [
            {"coded_value": "AMERICAN INDIAN OR ALASKA NATIVE",       "nci_code": "C41259", "decode": "American Indian or Alaska Native"},
            {"coded_value": "ASIAN",                                   "nci_code": "C41260", "decode": "Asian"},
            {"coded_value": "BLACK OR AFRICAN AMERICAN",               "nci_code": "C16352", "decode": "Black or African American"},
            {"coded_value": "NATIVE HAWAIIAN OR OTHER PACIFIC ISLANDER","nci_code": "C41219","decode": "Native Hawaiian or Other Pacific Islander"},
            {"coded_value": "WHITE",                                   "nci_code": "C41261", "decode": "White"},
            {"coded_value": "MULTIPLE",                                "nci_code": "C17649", "decode": "Multiple"},
            {"coded_value": "NOT REPORTED",                            "nci_code": "C43234", "decode": "Not Reported"},
            {"coded_value": "UNKNOWN",                                 "nci_code": "C17998", "decode": "Unknown"},
        ],
    },
    "CL.C66790": {
        "name": "Ethnicity",
        "c_code": "C66790",
        "extensible": "No",
        "terms": [
            {"coded_value": "HISPANIC OR LATINO",     "nci_code": "C17459", "decode": "Hispanic or Latino"},
            {"coded_value": "NOT HISPANIC OR LATINO", "nci_code": "C41222", "decode": "Not Hispanic or Latino"},
            {"coded_value": "NOT REPORTED",            "nci_code": "C43234", "decode": "Not Reported"},
            {"coded_value": "UNKNOWN",                 "nci_code": "C17998", "decode": "Unknown"},
        ],
    },
    "CL.C101526": {
        "name": "No Yes Response",
        "c_code": "C101526",
        "extensible": "No",
        "terms": [
            {"coded_value": "N", "nci_code": "C49487", "decode": "No"},
            {"coded_value": "Y", "nci_code": "C49488", "decode": "Yes"},
        ],
    },
    "CL.C66769": {
        "name": "Severity or Intensity Scale for Adverse Events",
        "c_code": "C66769",
        "extensible": "No",
        "terms": [
            {"coded_value": "MILD",     "nci_code": "C41338", "decode": "Mild"},
            {"coded_value": "MODERATE", "nci_code": "C41339", "decode": "Moderate"},
            {"coded_value": "SEVERE",   "nci_code": "C41340", "decode": "Severe"},
        ],
    },
    "CL.AGEU": {
        "name": "Age Unit",
        "c_code": "C66781",
        "extensible": "No",
        "terms": [
            {"coded_value": "YEARS",  "nci_code": "C29848", "decode": "Year"},
            {"coded_value": "MONTHS", "nci_code": "C29846", "decode": "Month"},
            {"coded_value": "WEEKS",  "nci_code": "C29844", "decode": "Week"},
            {"coded_value": "DAYS",   "nci_code": "C25301", "decode": "Day"},
        ],
    },
}

# ── Variable catalogue ─────────────────────────────────────────────────────────
# Each var: name, label, type (text/float/integer/date), length, core (Req/Exp/Perm),
#           origin, source (SDTM path), derivation, codelist OID, comment_oid

_ADSL_VARS: list[dict] = [
    {"name": "STUDYID",  "label": "Study Identifier",                      "type": "text",    "length": 20,  "core": "Req", "origin": "Assigned",  "source": "DM.STUDYID"},
    {"name": "USUBJID",  "label": "Unique Subject Identifier",              "type": "text",    "length": 50,  "core": "Req", "origin": "Assigned",  "source": "DM.USUBJID"},
    {"name": "SUBJID",   "label": "Subject Identifier in the Study",        "type": "text",    "length": 20,  "core": "Req", "origin": "CRF",       "source": "DM.SUBJID"},
    {"name": "SITEID",   "label": "Study Site Identifier",                  "type": "text",    "length": 20,  "core": "Req", "origin": "CRF",       "source": "DM.SITEID"},
    {"name": "AGE",      "label": "Age",                                    "type": "float",   "length": None,"core": "Exp", "origin": "CRF",       "source": "DM.AGE"},
    {"name": "AGEU",     "label": "Age Units",                              "type": "text",    "length": 10,  "core": "Exp", "origin": "CRF",       "source": "DM.AGEU",    "codelist": "CL.AGEU"},
    {"name": "SEX",      "label": "Sex",                                    "type": "text",    "length": 1,   "core": "Exp", "origin": "CRF",       "source": "DM.SEX",     "codelist": "CL.C66731"},
    {"name": "RACE",     "label": "Race",                                   "type": "text",    "length": 200, "core": "Exp", "origin": "CRF",       "source": "DM.RACE",    "codelist": "CL.C74457"},
    {"name": "ETHNIC",   "label": "Ethnicity",                              "type": "text",    "length": 200, "core": "Exp", "origin": "CRF",       "source": "DM.ETHNIC",  "codelist": "CL.C66790"},
    {"name": "ARM",      "label": "Description of Planned Arm",             "type": "text",    "length": 200, "core": "Req", "origin": "Assigned",  "source": "DM.ARM"},
    {"name": "ARMCD",    "label": "Planned Arm Code",                       "type": "text",    "length": 20,  "core": "Req", "origin": "Assigned",  "source": "DM.ARMCD"},
    {"name": "ACTARM",   "label": "Description of Actual Arm",              "type": "text",    "length": 200, "core": "Req", "origin": "Derived",   "source": "DM.ARM",     "comment": "COM.ACTARM"},
    {"name": "ACTARMCD", "label": "Actual Arm Code",                        "type": "text",    "length": 20,  "core": "Req", "origin": "Derived",   "source": "DM.ARMCD",  "comment": "COM.ACTARMCD"},
    {"name": "TRTSDT",   "label": "Date of First Exposure to Treatment",    "type": "text",    "length": 10,  "core": "Exp", "origin": "Derived",   "source": "EX.EXSTDTC","comment": "COM.TRTSDT"},
    {"name": "TRTEDT",   "label": "Date of Last Exposure to Treatment",     "type": "text",    "length": 10,  "core": "Exp", "origin": "Derived",   "source": "EX.EXENDTC","comment": "COM.TRTEDT"},
    {"name": "SAFFL",    "label": "Safety Population Flag",                 "type": "text",    "length": 1,   "core": "Exp", "origin": "Derived",   "source": "EX.EXSTDTC","codelist": "CL.C101526", "comment": "COM.SAFFL"},
    {"name": "ITTFL",    "label": "Intent-to-Treat Population Flag",        "type": "text",    "length": 1,   "core": "Exp", "origin": "Derived",   "source": "DM.ARM",    "codelist": "CL.C101526", "comment": "COM.ITTFL"},
    {"name": "RANDFL",   "label": "Randomised Population Flag",             "type": "text",    "length": 1,   "core": "Exp", "origin": "Derived",   "source": "DM.RFSTDTC","codelist": "CL.C101526", "comment": "COM.RANDFL"},
    {"name": "PPROTFL",  "label": "Per-Protocol Population Flag",           "type": "text",    "length": 1,   "core": "Exp", "origin": "Derived",   "source": "DM.ARM",    "codelist": "CL.C101526", "comment": "COM.PPROTFL"},
]

_ADAE_VARS: list[dict] = [
    {"name": "STUDYID",  "label": "Study Identifier",                       "type": "text",    "length": 20,  "core": "Req", "origin": "Assigned",  "source": "AE.STUDYID"},
    {"name": "USUBJID",  "label": "Unique Subject Identifier",               "type": "text",    "length": 50,  "core": "Req", "origin": "Assigned",  "source": "AE.USUBJID"},
    {"name": "AESEQ",    "label": "Sequence Number",                         "type": "integer", "length": None,"core": "Req", "origin": "Assigned",  "source": "AE.AESEQ"},
    {"name": "AETERM",   "label": "Reported Term for the Adverse Event",     "type": "text",    "length": 200, "core": "Req", "origin": "CRF",       "source": "AE.AETERM"},
    {"name": "AEDECOD",  "label": "Dictionary-Derived Term",                 "type": "text",    "length": 200, "core": "Exp", "origin": "Assigned",  "source": "AE.AEDECOD"},
    {"name": "AEBODSYS", "label": "Body System or Organ Class",              "type": "text",    "length": 200, "core": "Exp", "origin": "Assigned",  "source": "AE.AEBODSYS"},
    {"name": "AESEV",    "label": "Severity/Intensity",                      "type": "text",    "length": 10,  "core": "Exp", "origin": "CRF",       "source": "AE.AESEV",   "codelist": "CL.C66769"},
    {"name": "AESER",    "label": "Serious Event",                           "type": "text",    "length": 1,   "core": "Exp", "origin": "CRF",       "source": "AE.AESER",   "codelist": "CL.C101526"},
    {"name": "ASTDT",    "label": "Analysis Start Date",                     "type": "text",    "length": 10,  "core": "Exp", "origin": "Derived",   "source": "AE.AESTDTC","comment": "COM.ASTDT"},
    {"name": "AENDT",    "label": "Analysis End Date",                       "type": "text",    "length": 10,  "core": "Exp", "origin": "Derived",   "source": "AE.AEENDTC","comment": "COM.AENDT"},
    {"name": "TRTEMFL",  "label": "Treatment Emergent Analysis Flag",        "type": "text",    "length": 1,   "core": "Exp", "origin": "Derived",   "source": "AE.AESTDTC","codelist": "CL.C101526", "comment": "COM.TRTEMFL"},
    {"name": "ANFL",     "label": "Analysis Flag",                           "type": "text",    "length": 1,   "core": "Exp", "origin": "Derived",   "source": None,         "codelist": "CL.C101526", "comment": "COM.ANFL"},
]

_ADLB_VARS: list[dict] = [
    {"name": "STUDYID",  "label": "Study Identifier",                "type": "text",    "length": 20,  "core": "Req", "origin": "Assigned", "source": "LB.STUDYID"},
    {"name": "USUBJID",  "label": "Unique Subject Identifier",       "type": "text",    "length": 50,  "core": "Req", "origin": "Assigned", "source": "LB.USUBJID"},
    {"name": "PARAMCD",  "label": "Parameter Code",                  "type": "text",    "length": 8,   "core": "Req", "origin": "Assigned", "source": "LB.LBTESTCD"},
    {"name": "PARAM",    "label": "Parameter",                       "type": "text",    "length": 200, "core": "Req", "origin": "Assigned", "source": "LB.LBTEST"},
    {"name": "AVAL",     "label": "Analysis Value",                  "type": "float",   "length": None,"core": "Exp", "origin": "Derived",  "source": "LB.LBORRES", "comment": "COM.AVAL"},
    {"name": "AVALC",    "label": "Analysis Value (C)",              "type": "text",    "length": 200, "core": "Perm","origin": "Derived",  "source": "LB.LBORRES"},
    {"name": "BASE",     "label": "Baseline Value",                  "type": "float",   "length": None,"core": "Exp", "origin": "Derived",  "source": "LB.LBORRES", "comment": "COM.BASE"},
    {"name": "CHG",      "label": "Change from Baseline",            "type": "float",   "length": None,"core": "Exp", "origin": "Derived",  "source": None,          "comment": "COM.CHG"},
    {"name": "PCHG",     "label": "Percent Change from Baseline",    "type": "float",   "length": None,"core": "Perm","origin": "Derived",  "source": None,          "comment": "COM.PCHG"},
    {"name": "ABLFL",    "label": "Baseline Record Flag",            "type": "text",    "length": 1,   "core": "Exp", "origin": "Derived",  "source": "LB.LBDTC",   "codelist": "CL.C101526", "comment": "COM.ABLFL"},
    {"name": "ANL01FL",  "label": "Analysis Flag 01",               "type": "text",    "length": 1,   "core": "Exp", "origin": "Derived",  "source": None,          "codelist": "CL.C101526"},
    {"name": "VISITNUM", "label": "Visit Number",                    "type": "float",   "length": None,"core": "Exp", "origin": "CRF",      "source": "LB.VISITNUM"},
    {"name": "VISIT",    "label": "Visit Name",                      "type": "text",    "length": 200, "core": "Exp", "origin": "CRF",      "source": "LB.VISIT"},
    {"name": "ADT",      "label": "Analysis Date",                   "type": "text",    "length": 10,  "core": "Exp", "origin": "Derived",  "source": "LB.LBDTC",   "comment": "COM.ADT"},
]

_ADTTE_VARS: list[dict] = [
    {"name": "STUDYID",  "label": "Study Identifier",         "type": "text",    "length": 20,  "core": "Req", "origin": "Assigned", "source": "DM.STUDYID"},
    {"name": "USUBJID",  "label": "Unique Subject Identifier","type": "text",    "length": 50,  "core": "Req", "origin": "Assigned", "source": "DM.USUBJID"},
    {"name": "PARAMCD",  "label": "Parameter Code",           "type": "text",    "length": 8,   "core": "Req", "origin": "Assigned", "source": None},
    {"name": "PARAM",    "label": "Parameter",                "type": "text",    "length": 200, "core": "Req", "origin": "Assigned", "source": None},
    {"name": "AVAL",     "label": "Analysis Value",           "type": "float",   "length": None,"core": "Req", "origin": "Derived",  "source": "DS.DSSTDTC", "comment": "COM.AVAL_TTE"},
    {"name": "AVALU",    "label": "Analysis Value Unit",      "type": "text",    "length": 10,  "core": "Req", "origin": "Assigned", "source": None},
    {"name": "CNSR",     "label": "Censor",                   "type": "integer", "length": None,"core": "Req", "origin": "Derived",  "source": "DS.DSDECOD", "comment": "COM.CNSR"},
    {"name": "EVNTDESC", "label": "Event or Censoring Description","type": "text","length": 200,"core": "Perm","origin": "Derived",  "source": "DS.DSDECOD"},
    {"name": "STARTDT",  "label": "Time-to-Event Origin Date","type": "text",    "length": 10,  "core": "Req", "origin": "Derived",  "source": "ADSL.TRTSDT"},
    {"name": "ADT",      "label": "Analysis Date",            "type": "text",    "length": 10,  "core": "Req", "origin": "Derived",  "source": "DS.DSSTDTC"},
]

_DOMAIN_CATALOGUE: dict[str, list[dict]] = {
    "ADSL":  _ADSL_VARS,
    "ADAE":  _ADAE_VARS,
    "ADLB":  _ADLB_VARS,
    "ADTTE": _ADTTE_VARS,
}

_DOMAIN_LABELS: dict[str, str] = {
    "ADSL":  "Subject-Level Analysis Dataset",
    "ADAE":  "Adverse Events Analysis Dataset",
    "ADLB":  "Laboratory Data Analysis Dataset",
    "ADTTE": "Time-to-Event Analysis Dataset",
}

_DOMAIN_CLASS: dict[str, str] = {
    "ADSL":  "ADSL",
    "ADAE":  "ADAE",
    "ADLB":  "BDS",
    "ADTTE": "TTE",
}

_DOMAIN_STRUCTURE: dict[str, str] = {
    "ADSL":  "One record per subject",
    "ADAE":  "One record per subject per adverse event",
    "ADLB":  "One record per subject per parameter per visit",
    "ADTTE": "One record per subject per parameter",
}

# ── Derivation comment catalogue ──────────────────────────────────────────────

_COMMENT_DEFS: dict[str, str] = {
    "COM.ACTARM":   "Copied from DM.ARM. Reflects the actual treatment arm. "
                    "Equals ARM when actual arm equals planned arm.",
    "COM.ACTARMCD": "Copied from DM.ARMCD. Reflects the actual arm code.",
    "COM.TRTSDT":   "Derived as the minimum EXSTDTC from SDTM EX domain, "
                    "converted to ISO 8601 date (YYYY-MM-DD). "
                    "Rule: TRTSDT = MIN(EX.EXSTDTC) WHERE EX.EXSTDTC NE ''.",
    "COM.TRTEDT":   "Derived as the maximum EXENDTC from SDTM EX domain. "
                    "Rule: TRTEDT = MAX(EX.EXENDTC) WHERE EX.EXENDTC NE ''.",
    "COM.SAFFL":    "Y if the subject received at least one dose of study treatment "
                    "(EX.EXSTDTC is non-null). Rule: SAFFL='Y' IF COUNT(EX) >= 1.",
    "COM.ITTFL":    "Y if the subject was randomised (DM.ARM is non-null and non-blank). "
                    "Rule: ITTFL='Y' IF DM.ARM NE ''.",
    "COM.RANDFL":   "Y if DM.RFSTDTC (reference start date) is non-null. "
                    "Rule: RANDFL='Y' IF DM.RFSTDTC NE ''.",
    "COM.PPROTFL":  "Y if ITTFL='Y' AND no major protocol deviation is recorded "
                    "(DS.DSDECOD does not contain 'PROTOCOL DEVIATION' for this subject). "
                    "Rule: PPROTFL='Y' IF ITTFL='Y' AND DVFL NE 'Y'.",
    "COM.ASTDT":    "Converted from AE.AESTDTC (ISO 8601) to analysis date. "
                    "Rule: ASTDT = INPUT(AE.AESTDTC, YYMMDD10.).",
    "COM.AENDT":    "Converted from AE.AEENDTC (ISO 8601) to analysis date.",
    "COM.TRTEMFL":  "Treatment-Emergent Adverse Event flag. "
                    "Y if ASTDT >= ADSL.TRTSDT AND "
                    "(ASTDT <= ADSL.TRTEDT + 30 days OR ADSL.TRTEDT IS MISSING).",
    "COM.ANFL":     "Y for all records included in the primary safety analysis.",
    "COM.AVAL":     "Numeric analysis value derived from LB.LBORRES via INPUT(LBORRES, BEST12.).",
    "COM.BASE":     "Baseline analysis value: last non-missing AVAL on or before ADSL.TRTSDT. "
                    "Rule: BASE = AVAL WHERE ABLFL='Y'.",
    "COM.CHG":      "Change from baseline. Rule: CHG = AVAL - BASE.",
    "COM.PCHG":     "Percent change from baseline. Rule: PCHG = 100 * CHG / BASE.",
    "COM.ABLFL":    "Baseline record flag. Y for the last non-missing observation "
                    "on or before the date of first dose (ADSL.TRTSDT). "
                    "Rule: ABLFL='Y' IF ADT <= ADSL.TRTSDT AND LAST(ADT).",
    "COM.ADT":      "Analysis date derived from LB.LBDTC (ISO 8601 conversion).",
    "COM.AVAL_TTE": "Time to event in days from STARTDT. "
                    "Rule: AVAL = ADT - STARTDT WHERE ADT IS NON-MISSING, "
                    "else imputed censoring date.",
    "COM.CNSR":     "Censoring indicator. 0 if the event (e.g. death) was observed; "
                    "1 if the observation was censored (no event by last contact date). "
                    "Rule: CNSR=0 IF DS.DSDECOD CONTAINS 'DEATH', ELSE CNSR=1.",
}

# ── WhereClauseDef catalogue ──────────────────────────────────────────────────
# Used for value-level metadata to restrict metadata to specific conditions.
# E.g. ABLFL='Y' applies only to baseline records.

_WHERE_CLAUSE_DEFS: list[dict] = [
    {
        "oid":      "WC.ABLFL.Y",
        "dataset":  "ADLB",
        "variable": "ABLFL",
        "op":       "EQ",
        "value":    "Y",
        "comment":  "Restricts to baseline records (ABLFL='Y').",
    },
    {
        "oid":      "WC.TRTEMFL.Y",
        "dataset":  "ADAE",
        "variable": "TRTEMFL",
        "op":       "EQ",
        "value":    "Y",
        "comment":  "Restricts to treatment-emergent adverse events.",
    },
    {
        "oid":      "WC.ANL01FL.Y",
        "dataset":  "ADLB",
        "variable": "ANL01FL",
        "op":       "EQ",
        "value":    "Y",
        "comment":  "Restricts to primary analysis flag records.",
    },
    {
        "oid":      "WC.SAFFL.Y",
        "dataset":  "ADSL",
        "variable": "SAFFL",
        "op":       "EQ",
        "value":    "Y",
        "comment":  "Restricts to the Safety population.",
    },
]


# ── Public API ────────────────────────────────────────────────────────────────


def build_define_xml(
    study_id: str,
    adam_version: str = "1.3",
    active_domains: list[str] | None = None,
    extra_codelists: dict[str, dict] | None = None,
    output_format: str = "dataset_json",
) -> str:
    """
    Build a conformant Define-XML 2.1 document for the supplied ADaM domains.

    Args:
        study_id:         CDISC STUDYID value.
        adam_version:     ADaMIG version (e.g. "1.3", "1.4").
        active_domains:   Which domains to include (default: all four).
        extra_codelists:  Study-specific codelists to merge with the standard ones.
        output_format:    "dataset_json" (default) or "xpt" — controls leaf href suffix.

    Returns:
        UTF-8 XML string.
    """
    domains = active_domains or list(_DOMAIN_CATALOGUE.keys())
    codelists = {**_CODELISTS, **(extra_codelists or {})}
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")
    file_ext = ".json" if output_format == "dataset_json" else ".xpt"

    # ── ODM root ──────────────────────────────────────────────────────────────
    root = etree.Element(_odm("ODM"), nsmap=NSMAP)
    root.set(f"{{{NS['xsi']}}}schemaLocation", _SCHEMA_LOCATION)
    root.set("FileOID",            f"Define.{study_id}.ADaM")
    root.set("FileType",           "Snapshot")
    root.set("CreationDateTime",   now)
    root.set("ODMVersion",         "1.3")
    root.set("Originator",         "NuPhorm Platform")
    root.set("SourceSystem",       "NuPhorm Biostatistics API v1.0")
    root.set("SourceSystemVersion","1.0.0")
    root.set(_def("Context"),      "ADaM")

    # ── Study ─────────────────────────────────────────────────────────────────
    study = etree.SubElement(root, _odm("Study"))
    study.set("OID", f"STUDY.{study_id}")

    gv = etree.SubElement(study, _odm("GlobalVariables"))
    _text_el(gv, _odm("StudyName"),        study_id)
    _text_el(gv, _odm("StudyDescription"), f"CDISC ADaM datasets for {study_id}")
    _text_el(gv, _odm("ProtocolName"),     study_id)

    # ── MetaDataVersion ───────────────────────────────────────────────────────
    mdv = etree.SubElement(study, _odm("MetaDataVersion"))
    mdv.set("OID",  "MDV.ADAM.1")
    mdv.set("Name", f"ADaM {adam_version} Metadata")
    mdv.set(_def("DefineVersion"),    "2.1.0")
    mdv.set(_def("StandardName"),     "ADaM")
    mdv.set(_def("StandardVersion"),  adam_version)

    # def:Standards
    stds = etree.SubElement(mdv, _def("Standards"))
    _standard_el(stds, "STD.ADAMIG", "ADaMIG", "IG", adam_version)
    _standard_el(stds, "STD.CDISC-CT", "CDISC/NCI", "CT", "2023-09-29")

    # ── def:AnnotatedCRF (placeholder, required by some validators) ───────────
    acrf = etree.SubElement(mdv, _def("AnnotatedCRF"))
    leaf = etree.SubElement(acrf, _def("DocumentRef"))
    leaf.set("leafID", "LF.CRF")

    # ── def:SupplementalDoc ───────────────────────────────────────────────────
    supdoc = etree.SubElement(mdv, _def("SupplementalDoc"))
    sap_ref = etree.SubElement(supdoc, _def("DocumentRef"))
    sap_ref.set("leafID", "LF.SAP")

    # ── Collect unique codelists & comments referenced by active domains ───────
    used_cls: set[str]  = set()
    used_coms: set[str] = set()

    for domain in domains:
        for var in _DOMAIN_CATALOGUE.get(domain, []):
            if var.get("codelist"):
                used_cls.add(var["codelist"])
            if var.get("comment"):
                used_coms.add(var["comment"])

    # ── ItemGroupDef per domain ───────────────────────────────────────────────
    item_def_map: dict[str, etree._Element] = {}

    for domain in domains:
        if domain not in _DOMAIN_CATALOGUE:
            logger.warning("Unknown domain %s – skipped", domain)
            continue
        _add_item_group_def(mdv, domain, file_ext, item_def_map, adam_version)

    # ── ValueListDef for value-level metadata (ABLFL, TRTEMFL, etc.) ──────────
    for wc in _WHERE_CLAUSE_DEFS:
        if wc["dataset"] in domains:
            _add_value_list_def(mdv, wc)

    # ── WhereClauseDef ────────────────────────────────────────────────────────
    for wc in _WHERE_CLAUSE_DEFS:
        if wc["dataset"] in domains:
            _add_where_clause_def(mdv, wc)

    # ── ItemDef elements (appended after groups) ───────────────────────────────
    for item_el in item_def_map.values():
        mdv.append(item_el)

    # ── CodeListDef ───────────────────────────────────────────────────────────
    for cl_oid in sorted(used_cls):
        if cl_oid in codelists:
            _add_codelist_def(mdv, cl_oid, codelists[cl_oid])

    # ── def:CommentDef ────────────────────────────────────────────────────────
    for com_oid in sorted(used_coms):
        if com_oid in _COMMENT_DEFS:
            _add_comment_def(mdv, com_oid, _COMMENT_DEFS[com_oid])

    # ── def:leaf elements ─────────────────────────────────────────────────────
    # One leaf per domain, plus CRF and SAP placeholders
    for domain in domains:
        if domain in _DOMAIN_CATALOGUE:
            _add_leaf(mdv, f"LF.{domain}", f"{domain.lower()}{file_ext}", f"{domain}{file_ext}")

    _add_leaf(mdv, "LF.CRF", "blankcrf.pdf",   "Annotated CRF")
    _add_leaf(mdv, "LF.SAP", "sap.pdf",         "Statistical Analysis Plan")

    return etree.tostring(
        root, pretty_print=True, xml_declaration=True, encoding="UTF-8"
    ).decode()


# ── Private builders ──────────────────────────────────────────────────────────


def _add_item_group_def(
    mdv: etree._Element,
    domain: str,
    file_ext: str,
    item_def_map: dict[str, etree._Element],
    adam_version: str,
) -> None:
    vars_catalogue = _DOMAIN_CATALOGUE[domain]
    is_repeating   = "No" if domain == "ADSL" else "Yes"

    igd = etree.SubElement(mdv, _odm("ItemGroupDef"))
    igd.set("OID",              f"IG.{domain}")
    igd.set("Name",             domain)
    igd.set("Repeating",        is_repeating)
    igd.set("IsReferenceData",  "No")
    igd.set("SASDatasetName",   domain)
    igd.set(_def("Structure"),  _DOMAIN_STRUCTURE[domain])
    igd.set(_def("Class"),      _DOMAIN_CLASS[domain])
    igd.set(_def("Purpose"),    "Analysis")
    igd.set(_def("StandardOID"),"STD.ADAMIG")
    igd.set(_def("ArchiveLocationID"), f"LF.{domain}")

    _desc(igd, _DOMAIN_LABELS[domain])

    # Key variables (STUDYID, USUBJID always keys)
    key_seq = {"STUDYID": 1, "USUBJID": 2}
    domain_keys = {"ADLB": ["STUDYID", "USUBJID", "PARAMCD", "VISITNUM"],
                   "ADAE": ["STUDYID", "USUBJID", "AESEQ"],
                   "ADTTE": ["STUDYID", "USUBJID", "PARAMCD"]}
    full_keys = domain_keys.get(domain, list(key_seq.keys()))

    for order, var in enumerate(vars_catalogue, start=1):
        ref = etree.SubElement(igd, _odm("ItemRef"))
        ref.set("ItemOID",    f"IT.{domain}.{var['name']}")
        ref.set("Mandatory",  "Yes" if var["core"] == "Req" else "No")
        ref.set("OrderNumber", str(order))
        if var["name"] in full_keys:
            ref.set("KeySequence", str(full_keys.index(var["name"]) + 1))

        # Build ItemDef if not already created
        item_oid = f"IT.{domain}.{var['name']}"
        if item_oid not in item_def_map:
            item_def_map[item_oid] = _build_item_def(item_oid, var, domain)


def _build_item_def(oid: str, var: dict, domain: str) -> etree._Element:
    el = etree.Element(_odm("ItemDef"))
    el.set("OID",          oid)
    el.set("Name",         var["name"])
    el.set("DataType",     _xsd_datatype(var["type"]))
    el.set("SASFieldName", var["name"][:8])  # SAS field name ≤8 chars
    if var.get("length"):
        el.set("Length", str(var["length"]))

    _desc(el, var["label"])

    # Origin
    orig = etree.SubElement(el, _def("Origin"))
    orig.set("Type", var.get("origin", "Assigned"))
    if var.get("source"):
        src = etree.SubElement(orig, _def("Source"))
        src.text = var["source"]

    # Comment reference (links to derivation rule)
    if var.get("comment"):
        el.set(_def("CommentOID"), var["comment"])

    # CodeList reference
    if var.get("codelist"):
        cl_ref = etree.SubElement(el, _odm("CodeListRef"))
        cl_ref.set("CodeListOID", var["codelist"])

    return el


def _add_codelist_def(
    mdv: etree._Element, oid: str, spec: dict
) -> None:
    cl = etree.SubElement(mdv, _odm("CodeList"))
    cl.set("OID",          oid)
    cl.set("Name",         spec["name"])
    cl.set("DataType",     "text")
    cl.set("SASFormatName", _safe_format_name(spec["name"]))
    if spec.get("c_code"):
        cl.set(_def("StandardOID"), "STD.CDISC-CT")

    _desc(cl, f"CDISC CT: {spec.get('c_code', oid)} — {spec['name']}")

    for term in spec.get("terms", []):
        item = etree.SubElement(cl, _odm("CodeListItem"))
        item.set("CodedValue", term["coded_value"])
        if term.get("nci_code"):
            item.set(_def("ExtendedValue"), "No")
            alias = etree.SubElement(item, _odm("Alias"))
            alias.set("Context", "nci:ExtCodeID")
            alias.set("Name",    term["nci_code"])
        _desc(item, term["decode"])


def _add_comment_def(mdv: etree._Element, oid: str, text: str) -> None:
    com = etree.SubElement(mdv, _def("CommentDef"))
    com.set("OID", oid)
    _desc(com, text)


def _add_where_clause_def(mdv: etree._Element, wc: dict) -> None:
    """
    WhereClauseDef — used for value-level metadata conditions.
    E.g. WHERE ABLFL = 'Y' restricts population-flag metadata to baseline rows.
    """
    wcd = etree.SubElement(mdv, _def("WhereClauseDef"))
    wcd.set("OID", wc["oid"])
    if wc.get("comment"):
        wcd.set(_def("CommentOID"), f"COM.WC.{wc['variable']}")
        # Register the comment if not already present
        _add_comment_def_safe(mdv, f"COM.WC.{wc['variable']}", wc["comment"])

    rcu = etree.SubElement(wcd, _def("RangeCheck"))
    rcu.set("Comparator",      wc["op"])
    rcu.set("SoftHard",        "Soft")
    rcu.set("def:ItemOID",     f"IT.{wc['dataset']}.{wc['variable']}")
    cv = etree.SubElement(rcu, _def("CheckValue"))
    cv.text = wc["value"]


def _add_value_list_def(mdv: etree._Element, wc: dict) -> None:
    """
    ValueListDef — links a WhereClause to value-level metadata for a variable.
    Here we define that e.g. BASE metadata applies only WHERE ABLFL='Y'.
    """
    vloid = f"VL.{wc['dataset']}.{wc['variable']}.{wc['value']}"
    vld = etree.SubElement(mdv, _def("ValueListDef"))
    vld.set("OID", vloid)

    ir = etree.SubElement(vld, _odm("ItemRef"))
    ir.set("ItemOID",        f"IT.{wc['dataset']}.{wc['variable']}")
    ir.set("Mandatory",      "No")
    ir.set("OrderNumber",    "1")
    wref = etree.SubElement(ir, _def("WhereClauseRef"))
    wref.set("WhereClauseOID", wc["oid"])


def _add_leaf(
    mdv: etree._Element, leaf_id: str, href: str, title: str
) -> None:
    leaf = etree.SubElement(mdv, _def("leaf"))
    leaf.set("ID",                          leaf_id)
    leaf.set(f"{{{NS['xsi']}}}href",        href)
    t = etree.SubElement(leaf, _def("title"))
    t.text = title


def _standard_el(
    parent: etree._Element,
    oid: str, name: str, std_type: str, version: str,
) -> None:
    std = etree.SubElement(parent, _def("Standard"))
    std.set("OID",     oid)
    std.set("Name",    name)
    std.set("Type",    std_type)
    std.set("Version", version)
    std.set("Status",  "Final")


def _desc(parent: etree._Element, text: str) -> None:
    """Add <Description><TranslatedText xml:lang="en">text</TranslatedText></Description>."""
    desc  = etree.SubElement(parent, _odm("Description"))
    trans = etree.SubElement(desc, _odm("TranslatedText"))
    trans.set(f"{{{NS['xml']}}}lang", "en")
    trans.text = text


def _text_el(parent: etree._Element, tag: str, text: str) -> etree._Element:
    el = etree.SubElement(parent, tag)
    el.text = text
    return el


def _xsd_datatype(adam_type: str) -> str:
    return {
        "text":    "text",
        "Char":    "text",
        "float":   "float",
        "Num":     "float",
        "integer": "integer",
        "date":    "date",
        "datetime":"datetime",
    }.get(adam_type, "text")


def _safe_format_name(name: str) -> str:
    """SAS format name: uppercase, remove spaces, truncate to 8 chars + '$'."""
    clean = name.upper().replace(" ", "")[:7]
    return f"${clean}"


# Track injected comment OIDs to avoid duplicates in the tree
_injected_comments: set[str] = set()


def _add_comment_def_safe(mdv: etree._Element, oid: str, text: str) -> None:
    if oid not in _injected_comments:
        _add_comment_def(mdv, oid, text)
        _injected_comments.add(oid)


# ── Structural validator ───────────────────────────────────────────────────────


class DefineXmlValidationError(Exception):
    """Raised when the generated Define-XML fails structural validation."""


def validate_define_xml(xml_string: str) -> list[dict]:
    """
    Structural validator for Define-XML 2.1.

    Checks:
      1. Required ODM root attributes (FileOID, FileType, CreationDateTime, ODMVersion)
      2. Exactly one Study element with an OID
      3. At least one MetaDataVersion with required attributes
      4. def:DefineVersion must be present and start with "2"
      5. Every ItemGroupDef has: OID, Name, Repeating, def:Class, def:Structure, def:Purpose
      6. Every ItemRef references an existing ItemDef
      7. Every CodeListRef references a defined CodeList
      8. Every def:CommentOID on an ItemDef references a defined CommentDef
      9. WhereClauseDef RangeCheck comparators are from the allowed set
     10. At least one def:leaf present

    Returns:
        List of finding dicts: {level: "ERROR"|"WARNING", rule: str, message: str}
    """
    findings: list[dict] = []

    def err(rule: str, msg: str) -> None:
        findings.append({"level": "ERROR", "rule": rule, "message": msg})

    def warn(rule: str, msg: str) -> None:
        findings.append({"level": "WARNING", "rule": rule, "message": msg})

    try:
        root = etree.fromstring(xml_string.encode())
    except etree.XMLSyntaxError as exc:
        err("XML-SYNTAX", f"Document is not well-formed XML: {exc}")
        return findings

    # ── 1. ODM root attributes ────────────────────────────────────────────────
    for attr in ("FileOID", "FileType", "CreationDateTime", "ODMVersion"):
        if not root.get(attr):
            err("ODM-1.1", f"ODM root is missing required attribute '{attr}'.")

    if root.get("FileType") not in ("Snapshot", "Transactional"):
        warn("ODM-1.2", "ODM/@FileType should be 'Snapshot' for Define-XML.")

    if not root.get(_def("Context")):
        warn("DEF-1.1", "ODM is missing def:Context attribute (expected 'ADaM').")

    # ── 2. Study element ──────────────────────────────────────────────────────
    studies = root.findall(_odm("Study"))
    if not studies:
        err("ODM-2.1", "No Study element found.")
        return findings
    if len(studies) > 1:
        warn("ODM-2.2", f"Multiple Study elements found ({len(studies)}); only one expected.")

    study = studies[0]
    if not study.get("OID"):
        err("ODM-2.3", "Study element is missing the OID attribute.")

    # ── 3. MetaDataVersion ────────────────────────────────────────────────────
    mdvs = study.findall(_odm("MetaDataVersion"))
    if not mdvs:
        err("ODM-3.1", "No MetaDataVersion element found.")
        return findings

    mdv = mdvs[0]
    for attr in ("OID", "Name"):
        if not mdv.get(attr):
            err("ODM-3.2", f"MetaDataVersion is missing required attribute '{attr}'.")

    # ── 4. def:DefineVersion ──────────────────────────────────────────────────
    def_version = mdv.get(_def("DefineVersion"), "")
    if not def_version:
        err("DEF-3.1", "MetaDataVersion is missing def:DefineVersion.")
    elif not def_version.startswith("2"):
        err("DEF-3.2", f"def:DefineVersion '{def_version}' is not a 2.x version.")

    # ── Collect defined OIDs ──────────────────────────────────────────────────
    item_group_oids = {el.get("OID") for el in mdv.findall(_odm("ItemGroupDef"))}
    item_oids       = {el.get("OID") for el in mdv.findall(_odm("ItemDef"))}
    codelist_oids   = {el.get("OID") for el in mdv.findall(_odm("CodeList"))}
    comment_oids    = {el.get("OID") for el in mdv.findall(_def("CommentDef"))}
    wc_oids         = {el.get("OID") for el in mdv.findall(_def("WhereClauseDef"))}
    leaf_oids       = {el.get("ID")  for el in mdv.findall(_def("leaf"))}

    # ── 5. ItemGroupDef required attributes ───────────────────────────────────
    required_igd_attrs = ("OID", "Name", "Repeating")
    required_def_attrs = (_def("Class"), _def("Structure"), _def("Purpose"))

    for igd in mdv.findall(_odm("ItemGroupDef")):
        igd_oid = igd.get("OID", "<unknown>")
        for attr in required_igd_attrs:
            if not igd.get(attr):
                err("DEF-4.1", f"ItemGroupDef OID='{igd_oid}' missing '{attr}'.")
        for attr in required_def_attrs:
            if not igd.get(attr):
                warn("DEF-4.2", f"ItemGroupDef OID='{igd_oid}' missing '{attr}' (best practice).")
        arch_id = igd.get(_def("ArchiveLocationID"))
        if arch_id and arch_id not in leaf_oids:
            err("DEF-4.3", f"ItemGroupDef '{igd_oid}' ArchiveLocationID='{arch_id}' not in any def:leaf/@ID.")

        # ── 6. ItemRef → ItemDef cross-reference ──────────────────────────────
        for ref in igd.findall(_odm("ItemRef")):
            ref_oid = ref.get("ItemOID", "")
            if ref_oid and ref_oid not in item_oids:
                err("DEF-5.1", f"ItemRef in '{igd_oid}' references undefined ItemOID='{ref_oid}'.")

    # ── 7. CodeListRef → CodeList ─────────────────────────────────────────────
    for item_el in mdv.findall(_odm("ItemDef")):
        item_oid = item_el.get("OID", "<unknown>")
        if not item_el.get("DataType"):
            err("DEF-6.1", f"ItemDef OID='{item_oid}' missing required DataType attribute.")
        for cl_ref in item_el.findall(_odm("CodeListRef")):
            cl_oid = cl_ref.get("CodeListOID", "")
            if cl_oid and cl_oid not in codelist_oids:
                err("DEF-7.1", f"ItemDef '{item_oid}' CodeListRef='{cl_oid}' not defined.")

    # ── 8. CommentOID → CommentDef ────────────────────────────────────────────
    for item_el in mdv.findall(_odm("ItemDef")):
        com_oid = item_el.get(_def("CommentOID"), "")
        if com_oid and com_oid not in comment_oids:
            err("DEF-8.1", f"ItemDef '{item_el.get('OID')}' CommentOID='{com_oid}' not defined.")

    # ── 9. WhereClauseDef comparator set ─────────────────────────────────────
    valid_comparators = {"EQ", "NE", "LT", "LE", "GT", "GE", "IN", "NOTIN"}
    for wcd in mdv.findall(_def("WhereClauseDef")):
        for rc in wcd.findall(_def("RangeCheck")):
            comp = rc.get("Comparator", "")
            if comp not in valid_comparators:
                err("DEF-9.1", f"WhereClauseDef '{wcd.get('OID')}' has invalid Comparator='{comp}'. "
                               f"Allowed: {sorted(valid_comparators)}.")

    # ── 10. At least one leaf ─────────────────────────────────────────────────
    if not leaf_oids:
        err("DEF-10.1", "No def:leaf elements found. Each dataset must have a leaf reference.")

    return findings
