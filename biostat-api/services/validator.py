"""
ADaM dataset structural validator.

Checks generated ADaM records against ADaMIG 1.3/1.4 rules:
  - Required variables are present and non-null
  - Controlled terminology values are from the allowed NCI set
  - Flag variables contain only 'Y' or ''  (not 'N' — ADaM convention)
  - PARAMCD ≤ 8 characters (BDS / TTE domains)
  - Date variables are ISO 8601 formatted
  - CHG = AVAL - BASE (ADLB)
  - CNSR is 0 or 1 (ADTTE)

Runs in-process; returns a ValidationReport with ERROR / WARNING / INFO findings.
"""
from __future__ import annotations

import re
import logging
from typing import Any

from services.cdisc_library import get_nci_code_sync

logger = logging.getLogger(__name__)

_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# ── Required variables per domain ─────────────────────────────────────────────

_REQUIRED: dict[str, list[str]] = {
    "ADSL":  ["STUDYID", "USUBJID", "SUBJID", "SITEID", "ARM", "ARMCD", "ACTARM", "ACTARMCD"],
    "ADAE":  ["STUDYID", "USUBJID", "AESEQ", "AETERM"],
    "ADLB":  ["STUDYID", "USUBJID", "PARAMCD", "PARAM", "AVAL"],
    "ADTTE": ["STUDYID", "USUBJID", "PARAMCD", "PARAM", "AVAL", "CNSR"],
}

# ── Prohibited variables (ADaMIG) ─────────────────────────────────────────────

_PROHIBITED: dict[str, list[str]] = {
    "ADSL":  ["DOMAIN"],      # ADSL has no DOMAIN variable (ADaMIG §3.2)
    "ADLB":  ["DOMAIN"],
    "ADAE":  [],
    "ADTTE": [],
}

# ── Controlled terminology checks: variable → (codelist C-code, allow_empty) ──

_CT_CHECKS: dict[str, dict[str, tuple[str, bool]]] = {
    "ADSL": {
        "SEX":    ("C66731",  True),
        "RACE":   ("C74457",  True),
        "ETHNIC": ("C66790",  True),
        "AGEU":   ("C66781",  True),
        "SAFFL":  ("C101526", True),
        "ITTFL":  ("C101526", True),
        "RANDFL": ("C101526", True),
        "PPROTFL":("C101526", True),
    },
    "ADAE": {
        "AESEV":   ("C66769",  True),
        "AESER":   ("C101526", True),
        "TRTEMFL": ("C101526", True),
        "ANFL":    ("C101526", True),
    },
    "ADLB": {
        "ABLFL":  ("C101526", True),
        "ANL01FL":("C101526", True),
    },
}

# ── Flag variables — ADaM convention: 'Y' or '' (empty string), never 'N' ─────

_FLAG_VARS: dict[str, list[str]] = {
    "ADSL": ["SAFFL", "ITTFL", "RANDFL", "PPROTFL"],
    "ADAE": ["TRTEMFL", "AESER", "ANFL"],
    "ADLB": ["ABLFL", "ANL01FL"],
}

# ── Date variables ────────────────────────────────────────────────────────────

_DATE_VARS: dict[str, list[str]] = {
    "ADSL": ["TRTSDT", "TRTEDT"],
    "ADAE": ["ASTDT", "AENDT"],
    "ADLB": ["ADT"],
    "ADTTE": ["STARTDT", "ADT"],
}


# ── Public API ────────────────────────────────────────────────────────────────

def validate_adam(
    domain: str,
    records: list[dict[str, Any]],
    strict: bool = False,
) -> dict:
    """
    Validate a list of ADaM records for a given domain.

    Args:
        domain:  ADaM domain name (e.g. "ADSL", "ADAE").
        records: List of record dicts (keys are variable names).
        strict:  If True, promote WARNINGs to ERRORs.

    Returns:
        {
          "passed": bool,
          "datasets_checked": [domain],
          "findings": [{"severity", "dataset", "variable", "rule", "message"}]
        }
    """
    findings: list[dict] = []
    if not records:
        findings.append(_info(domain, None, "ADAM-0.1", f"No {domain} records to validate."))
        return _report([domain], findings)

    def _err(var, rule, msg):
        findings.append(_finding("ERROR", domain, var, rule, msg))

    def _warn(var, rule, msg):
        sev = "ERROR" if strict else "WARNING"
        findings.append(_finding(sev, domain, var, rule, msg))

    # ── Required variables present in every record ─────────────────────────
    required = _REQUIRED.get(domain, [])
    all_keys  = set(records[0].keys()) - {"_TRACE"}  # use first record as schema

    for var in required:
        if var not in all_keys:
            _err(var, "ADAM-1.1", f"Required variable '{var}' is absent from {domain}.")

    # ── Prohibited variables ───────────────────────────────────────────────
    for var in _PROHIBITED.get(domain, []):
        if var in all_keys:
            _err(var, "ADAM-1.2", f"Variable '{var}' is prohibited in {domain} (ADaMIG §3.2).")

    # ── Per-record checks ──────────────────────────────────────────────────
    ct_checks   = _CT_CHECKS.get(domain, {})
    flag_vars   = _FLAG_VARS.get(domain, [])
    date_vars   = _DATE_VARS.get(domain, [])

    for i, rec in enumerate(records):
        uid = rec.get("USUBJID", f"row[{i}]")

        # Null check on required variables
        for var in required:
            if var in rec and (rec[var] is None or str(rec[var]).strip() == ""):
                _err(var, "ADAM-2.1", f"USUBJID={uid}: Required variable '{var}' is null/empty.")

        # PARAMCD length ≤ 8 (BDS/TTE domains)
        if domain in ("ADLB", "ADTTE") and "PARAMCD" in rec:
            paramcd = str(rec.get("PARAMCD") or "")
            if len(paramcd) > 8:
                _err("PARAMCD", "ADAM-2.2", f"USUBJID={uid}: PARAMCD='{paramcd}' exceeds 8 characters.")

        # Controlled terminology
        for var, (c_code, allow_empty) in ct_checks.items():
            if var not in rec:
                continue
            val = str(rec[var]).strip() if rec[var] is not None else ""
            if allow_empty and val == "":
                continue
            allowed = get_nci_code_sync(c_code)
            if allowed and val not in allowed:
                _warn(var, "ADAM-2.3",
                      f"USUBJID={uid}: {var}='{val}' is not in CDISC CT codelist {c_code} "
                      f"(allowed: {allowed}).")

        # Flag variables: must be 'Y' or '' — never 'N'
        for var in flag_vars:
            if var not in rec:
                continue
            val = str(rec[var]).strip() if rec[var] is not None else ""
            if val not in ("Y", ""):
                _err(var, "ADAM-2.4",
                     f"USUBJID={uid}: Flag variable '{var}'='{val}'. "
                     f"ADaM flags must be 'Y' or '' (empty), not 'N'.")

        # Date variables: ISO 8601 format YYYY-MM-DD
        for var in date_vars:
            if var not in rec:
                continue
            val = str(rec[var]).strip() if rec[var] is not None else ""
            if val and not _ISO_DATE_RE.match(val):
                _warn(var, "ADAM-2.5",
                      f"USUBJID={uid}: Date variable '{var}'='{val}' is not ISO 8601 (YYYY-MM-DD).")

        # ADLB: CHG = AVAL - BASE (within tolerance)
        if domain == "ADLB":
            aval = _to_float(rec.get("AVAL"))
            base = _to_float(rec.get("BASE"))
            chg  = _to_float(rec.get("CHG"))
            if aval is not None and base is not None and chg is not None:
                expected_chg = round(aval - base, 6)
                if abs(chg - expected_chg) > 1e-4:
                    _err("CHG", "ADAM-2.6",
                         f"USUBJID={uid} PARAMCD={rec.get('PARAMCD')}: "
                         f"CHG={chg} ≠ AVAL-BASE ({aval}-{base}={expected_chg}).")

        # ADTTE: CNSR must be 0 or 1
        if domain == "ADTTE" and "CNSR" in rec:
            cnsr = rec.get("CNSR")
            if cnsr not in (0, 1, "0", "1"):
                _err("CNSR", "ADAM-2.7",
                     f"USUBJID={uid}: CNSR='{cnsr}' is invalid. Must be 0 (event) or 1 (censored).")

        # ADTTE: AVAL must be non-negative
        if domain == "ADTTE" and "AVAL" in rec:
            aval = _to_float(rec.get("AVAL"))
            if aval is not None and aval < 0:
                _err("AVAL", "ADAM-2.8",
                     f"USUBJID={uid}: Time-to-event AVAL={aval} is negative.")

    return _report([domain], findings)


def validate_all(
    adsl: list[dict] | None = None,
    adae: list[dict] | None = None,
    adlb: list[dict] | None = None,
    adtte: list[dict] | None = None,
    strict: bool = False,
) -> dict:
    """Run validation across all supplied ADaM domains and merge results."""
    all_findings: list[dict] = []
    checked: list[str] = []

    for domain, records in [("ADSL", adsl), ("ADAE", adae), ("ADLB", adlb), ("ADTTE", adtte)]:
        if records is not None:
            r = validate_adam(domain, records, strict=strict)
            all_findings.extend(r["findings"])
            checked.append(domain)

    return _report(checked, all_findings)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _finding(severity: str, dataset: str, variable: str | None, rule: str, message: str) -> dict:
    return {"severity": severity, "dataset": dataset, "variable": variable,
            "rule": rule, "message": message}


def _info(dataset: str, variable: str | None, rule: str, message: str) -> dict:
    return _finding("INFO", dataset, variable, rule, message)


def _report(datasets: list[str], findings: list[dict]) -> dict:
    has_error = any(f["severity"] == "ERROR" for f in findings)
    return {
        "passed":           not has_error,
        "datasets_checked": datasets,
        "findings":         findings,
    }


def _to_float(val: Any) -> float | None:
    try:
        return float(val) if val is not None else None
    except (ValueError, TypeError):
        return None
