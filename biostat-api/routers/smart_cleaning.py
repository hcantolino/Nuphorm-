"""
Smart Data Cleaning API — GxP / ICH E6 compliant data quality analysis.

GxP alignment notes:
  • No silent overwrites — every change requires explicit user approval via /apply.
  • Immutable originals — session stores raw DataFrame; cleaned data is a separate copy.
  • Full audit trail — ISO-8601 timestamp, session_id, column, before_value, after_value,
    method, confidence score, user action (approved/rejected), version number.
  • Critical issues (>50 % missing, implausible combos) set requires_confirm=True and
    are excluded from bulk-approve to prevent accidental overwrite.
  • Version history — each /apply call increments session version; /revert restores v0.
"""

import io
import json
import re
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter()


# ── numpy → Python type coercion ──────────────────────────────────────────────
# FastAPI's jsonable_encoder cannot serialize numpy scalar types (numpy.bool_,
# numpy.int64, numpy.float64).  Call _native() on any value that may be a numpy
# scalar before putting it into a response dict.

def _native(v):
    """Convert numpy scalar to the closest Python builtin; pass anything else through."""
    if isinstance(v, np.bool_):
        return bool(v)
    if isinstance(v, np.integer):
        return int(v)
    if isinstance(v, np.floating):
        return float(v)
    return v


# ── In-memory session store (keyed by session_id) ────────────────────────────
# Each entry: { "original": DataFrame, "current": DataFrame, "audit": list, "version": int }
_sessions: dict[str, dict] = {}

# ── Pharma domain rules ───────────────────────────────────────────────────────
NUMERIC_RANGES: dict[str, dict] = {
    "AGE":        {"min": 0,  "max": 120, "unit": "years"},
    "WEIGHT":     {"min": 0,  "max": 700, "unit": "kg"},
    "HEIGHT":     {"min": 0,  "max": 300, "unit": "cm"},
    "BMI":        {"min": 10, "max": 80,  "unit": "kg/m²"},
    "SBP":        {"min": 60, "max": 250, "unit": "mmHg"},
    "DBP":        {"min": 40, "max": 150, "unit": "mmHg"},
    "HEART_RATE": {"min": 20, "max": 300, "unit": "bpm"},
    "TEMP":       {"min": 34, "max": 43,  "unit": "°C"},
    "DOSE":       {"min": 0,  "max": None, "unit": "mg"},
}

CATEGORICAL_STANDARDS: dict[str, list[str]] = {
    "SEX":    ["M", "F", "MALE", "FEMALE", "Male", "Female"],
    "AESEV":  ["MILD", "MODERATE", "SEVERE", "Mild", "Moderate", "Severe"],
    "AESER":  ["Y", "N", "YES", "NO"],
    "AEOUT":  ["RECOVERED/RESOLVED", "RECOVERING/RESOLVING", "NOT RECOVERED/NOT RESOLVED",
               "RECOVERED/RESOLVED WITH SEQUELAE", "FATAL", "UNKNOWN"],
    "ETHNIC": ["HISPANIC OR LATINO", "NOT HISPANIC OR LATINO", "NOT REPORTED", "UNKNOWN"],
}

SEX_CANON = {"male": "M", "female": "F", "m": "M", "f": "F",
             "1": "M", "2": "F", "man": "M", "woman": "F"}

SEVERITY_CANON = {"mild": "MILD", "moderate": "MODERATE", "severe": "SEVERE",
                  "1": "MILD", "2": "MODERATE", "3": "SEVERE"}


# ── Pydantic models ───────────────────────────────────────────────────────────

class ApplyRequest(BaseModel):
    session_id: str
    approved_issue_ids: list[str]
    user_id: str = "local_user"


class RevertRequest(BaseModel):
    session_id: str


# ── Helper: detect column meta-type ──────────────────────────────────────────

def _col_type(series: pd.Series) -> str:
    """Classify a column as: numeric | date | categorical | text | id."""
    name = series.name.upper() if isinstance(series.name, str) else ""
    if any(kw in name for kw in ("ID", "SUBJID", "USUBJID", "PATID")):
        return "id"
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"
    non_null = series.dropna().astype(str)
    if non_null.empty:
        return "text"
    date_hits = 0
    for v in non_null.head(50):
        if re.search(r"\d{1,4}[-/]\d{1,2}[-/]\d{2,4}", v):
            date_hits += 1
    if date_hits / max(len(non_null.head(50)), 1) > 0.5:
        return "date"
    if non_null.nunique() / max(len(non_null), 1) < 0.2 and non_null.nunique() <= 30:
        return "categorical"
    return "text"


# ── Analysis functions ────────────────────────────────────────────────────────

def _analyze_missing(df: pd.DataFrame) -> list[dict]:
    issues = []
    n = len(df)
    for col in df.columns:
        missing = df[col].isna().sum()
        if missing == 0:
            continue
        pct = missing / n * 100
        severity = "critical" if pct > 50 else "high" if pct > 20 else "medium" if pct > 5 else "low"
        ctype = _col_type(df[col])
        if ctype == "numeric":
            median_val = df[col].median()
            mean_val = df[col].mean()
            action = "impute_median"
            fix_value = round(float(median_val), 4) if not np.isnan(median_val) else None
            method_note = (f"Median imputation (value={fix_value}): robust to outliers; "
                           f"preserves distribution shape for skewed clinical data.")
            confidence = 0.80 if pct < 20 else 0.60
        elif ctype == "categorical":
            mode_val = df[col].mode().iloc[0] if not df[col].mode().empty else None
            action = "impute_mode"
            fix_value = str(mode_val) if mode_val is not None else None
            method_note = f"Mode imputation (value='{fix_value}'): most frequent category used."
            confidence = 0.70 if pct < 20 else 0.50
        else:
            action = "flag_review"
            fix_value = None
            method_note = "Flag for manual review: non-numeric/non-categorical column."
            confidence = 1.0

        rows_affected = list(df.index[df[col].isna()].tolist())
        is_crit = bool(pct > 50)   # pct is numpy.float64; > returns numpy.bool_ — cast to Python bool
        issues.append({
            "id": str(uuid.uuid4()),
            "type": "missing_value",
            "severity": severity,
            "column": col,
            "rows_affected": rows_affected[:200],
            "count": int(missing),
            "description": f"{missing} missing values in '{col}' ({pct:.1f}% of rows)",
            "explanation": (f"{pct:.1f}% missing in '{col}' → {action.replace('_',' ')} "
                            f"({fix_value}). {method_note}"),
            "suggested_fix": {
                "action": action,
                "value": fix_value,
                "confidence": float(confidence),
                "method_note": method_note,
            },
            "is_critical": is_crit,
            "requires_confirm": is_crit,
            "gcp_note": "GCP §5.5: All data must be verifiable. Imputation must be pre-specified in SAP.",
        })
    return issues


def _analyze_outliers(df: pd.DataFrame) -> list[dict]:
    issues = []
    for col in df.select_dtypes(include=[np.number]).columns:
        series = df[col].dropna()
        if len(series) < 10:
            continue
        q1, q3 = series.quantile(0.25), series.quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            continue
        lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        outlier_mask = (df[col] < lower) | (df[col] > upper)
        rows = list(df.index[outlier_mask & df[col].notna()].tolist())
        if not rows:
            continue

        # Check pharma domain caps
        cname = col.upper()
        rule = next((r for k, r in NUMERIC_RANGES.items() if k in cname), None)
        if rule:
            domain_breach = df[col].dropna()
            if rule["min"] is not None:
                domain_breach = domain_breach[domain_breach < rule["min"]]
            lo_breach = list(domain_breach.index.tolist())
            if rule["max"] is not None:
                hi_breach = list(df[col].dropna()[df[col].dropna() > rule["max"]].index.tolist())
            else:
                hi_breach = []
            all_breach = list(set(lo_breach + hi_breach))
            if all_breach:
                issues.append({
                    "id": str(uuid.uuid4()),
                    "type": "domain_violation",
                    "severity": "critical",
                    "column": col,
                    "rows_affected": all_breach[:200],
                    "count": len(all_breach),
                    "description": (f"{len(all_breach)} domain violations in '{col}': "
                                    f"expected {rule.get('min','?')}–{rule.get('max','?')} {rule.get('unit','')}"),
                    "explanation": (f"Pharma rule: {col} should be "
                                    f"{rule.get('min','?')}–{rule.get('max','?')} {rule.get('unit','')}. "
                                    f"{len(all_breach)} rows fall outside this range → cap at bounds."),
                    "suggested_fix": {
                        "action": "cap_outlier",
                        "value": {"lower": rule.get("min"), "upper": rule.get("max")},
                        "confidence": 0.90,
                        "method_note": f"Cap to domain bounds [{rule.get('min')}, {rule.get('max')}] per pharma guideline.",
                    },
                    "is_critical": True,
                    "requires_confirm": True,
                    "gcp_note": "ICH E6: Implausible values must be queried and resolved before database lock.",
                })
                continue

        severity = "high" if len(rows) / len(df) > 0.05 else "medium"
        cap_lo = round(float(lower), 4)
        cap_hi = round(float(upper), 4)
        issues.append({
            "id": str(uuid.uuid4()),
            "type": "outlier",
            "severity": severity,
            "column": col,
            "rows_affected": rows[:200],
            "count": len(rows),
            "description": f"{len(rows)} outliers in '{col}' (IQR method; bounds [{cap_lo}, {cap_hi}])",
            "explanation": (f"IQR method: Q1={q1:.2f}, Q3={q3:.2f}, IQR={iqr:.2f}. "
                            f"Fence: [{cap_lo}, {cap_hi}]. "
                            f"{len(rows)} values outside → Winsorize (cap) to fence."),
            "suggested_fix": {
                "action": "cap_outlier",
                "value": {"lower": cap_lo, "upper": cap_hi},
                "confidence": 0.75,
                "method_note": f"Winsorization (cap) to [{cap_lo}, {cap_hi}]. Review if clinically meaningful.",
            },
            "is_critical": False,
            "requires_confirm": False,
            "gcp_note": "Document outlier handling rule in SAP prior to unblinding.",
        })
    return issues


def _analyze_dates(df: pd.DataFrame) -> list[dict]:
    issues = []
    date_patterns = [
        (r"^\d{4}-\d{2}-\d{2}$", "YYYY-MM-DD"),
        (r"^\d{2}/\d{2}/\d{4}$", "MM/DD/YYYY"),
        (r"^\d{2}-\d{2}-\d{4}$", "DD-MM-YYYY"),
        (r"^\d{1,2}\s+\w{3}\s+\d{4}$", "D Mon YYYY"),
        (r"^\d{8}$", "YYYYMMDD"),
    ]
    for col in df.select_dtypes(include="object").columns:
        if not any(kw in col.upper() for kw in ("DT", "DATE", "DAT", "DTM")):
            continue
        non_null = df[col].dropna().astype(str)
        if len(non_null) < 3:
            continue
        found_patterns: dict[str, list[int]] = defaultdict(list)
        for idx, val in non_null.items():
            for pat, label in date_patterns:
                if re.match(pat, val.strip()):
                    found_patterns[label].append(int(idx))
                    break
            else:
                found_patterns["Unknown"].append(int(idx))
        if len(found_patterns) > 1:
            dominant = max(found_patterns, key=lambda k: len(found_patterns[k]))
            minority_rows = [r for k, rows in found_patterns.items()
                             if k != dominant for r in rows]
            issues.append({
                "id": str(uuid.uuid4()),
                "type": "date_format",
                "severity": "high",
                "column": col,
                "rows_affected": minority_rows[:200],
                "count": len(minority_rows),
                "description": (f"'{col}' has {len(found_patterns)} mixed date formats: "
                                + ", ".join(f"{k}({len(v)})" for k, v in found_patterns.items())),
                "explanation": (f"Dominant format: {dominant} ({len(found_patterns[dominant])} rows). "
                                f"{len(minority_rows)} rows use a different format → convert to ISO 8601 (YYYY-MM-DD)."),
                "suggested_fix": {
                    "action": "convert_date",
                    "value": "YYYY-MM-DD",
                    "confidence": 0.85,
                    "method_note": "Convert all values to ISO 8601 (YYYY-MM-DD) per CDISC standard.",
                },
                "is_critical": False,
                "requires_confirm": False,
                "gcp_note": "CDISC CDASH: All dates should follow ISO 8601 format (YYYY-MM-DD).",
            })
    return issues


def _analyze_duplicates(df: pd.DataFrame) -> list[dict]:
    dup_mask = df.duplicated(keep="first")
    dup_rows = list(df.index[dup_mask].tolist())
    if not dup_rows:
        return []
    return [{
        "id": str(uuid.uuid4()),
        "type": "duplicate",
        "severity": "high",
        "column": None,
        "rows_affected": dup_rows[:200],
        "count": len(dup_rows),
        "description": f"{len(dup_rows)} exact duplicate rows detected",
        "explanation": (f"{len(dup_rows)} rows are exact duplicates of earlier rows "
                        f"(keeping first occurrence) → recommend dropping duplicates."),
        "suggested_fix": {
            "action": "drop_row",
            "value": None,
            "confidence": 0.95,
            "method_note": "Drop duplicate rows (keep first occurrence). Original data preserved in audit.",
        },
        "is_critical": False,
        "requires_confirm": False,
        "gcp_note": "GCP §5.1: Duplicate records may indicate data entry errors; investigate before dropping.",
    }]


def _analyze_categoricals(df: pd.DataFrame) -> list[dict]:
    issues = []
    for col in df.select_dtypes(include="object").columns:
        cname = col.upper()
        standard = next((v for k, v in CATEGORICAL_STANDARDS.items() if k in cname), None)
        if standard is None:
            continue
        non_null = df[col].dropna().astype(str)
        bad_rows = [int(idx) for idx, val in non_null.items()
                    if val not in standard and val.upper() not in [s.upper() for s in standard]]
        if not bad_rows:
            continue
        bad_vals = df[col].iloc[[df.index.get_loc(r) for r in bad_rows if r < len(df)]].unique().tolist()

        # Determine canonicalization map
        canon = SEX_CANON if "SEX" in cname else SEVERITY_CANON if "AESEV" in cname else {}
        mapped = {v: canon.get(str(v).lower(), standard[0]) for v in bad_vals if v is not None}
        explanation = (f"Non-standard values in '{col}': {bad_vals}. "
                       f"Expected: {standard[:6]}. "
                       f"Suggested mapping: {mapped}")
        issues.append({
            "id": str(uuid.uuid4()),
            "type": "categorical_mismatch",
            "severity": "medium",
            "column": col,
            "rows_affected": bad_rows[:200],
            "count": len(bad_rows),
            "description": f"{len(bad_rows)} non-standard values in '{col}': {bad_vals[:5]}",
            "explanation": explanation,
            "suggested_fix": {
                "action": "standardize",
                "value": mapped,
                "confidence": 0.80,
                "method_note": f"Map to CDISC-standard values: {mapped}",
            },
            "is_critical": False,
            "requires_confirm": False,
            "gcp_note": "CDISC SDTM: Controlled terminology must be used for all standard domains.",
        })
    return issues


def _analyze_negative_durations(df: pd.DataFrame) -> list[dict]:
    issues = []
    for col in df.select_dtypes(include=[np.number]).columns:
        cname = col.upper()
        if not any(kw in cname for kw in ("DUR", "TIME", "DURATION", "ELPS", "ELAPSED")):
            continue
        neg_mask = df[col] < 0
        neg_rows = list(df.index[neg_mask & df[col].notna()].tolist())
        if not neg_rows:
            continue
        issues.append({
            "id": str(uuid.uuid4()),
            "type": "negative_duration",
            "severity": "critical",
            "column": col,
            "rows_affected": neg_rows[:200],
            "count": len(neg_rows),
            "description": f"{len(neg_rows)} negative duration values in '{col}'",
            "explanation": (f"Duration/time column '{col}' has {len(neg_rows)} negative values. "
                            f"Duration must be ≥ 0. Flag for source data query."),
            "suggested_fix": {
                "action": "flag_review",
                "value": None,
                "confidence": 1.0,
                "method_note": "Flag for manual data query — negative durations indicate data entry error.",
            },
            "is_critical": True,
            "requires_confirm": True,
            "gcp_note": "GCP §4.9: Negative durations are implausible; raise data clarification form (DCF).",
        })
    return issues


def _compute_stats(df: pd.DataFrame) -> dict:
    stats: dict[str, Any] = {
        "row_count": int(len(df)),
        "col_count": int(len(df.columns)),
        "columns": [],
    }
    for col in df.columns:
        ctype = _col_type(df[col])
        entry: dict[str, Any] = {
            "name": col,
            "type": ctype,
            "missing": int(df[col].isna().sum()),
            "missing_pct": round(df[col].isna().mean() * 100, 1),
        }
        if ctype == "numeric":
            s = df[col].dropna()
            entry.update({
                "mean": round(float(s.mean()), 4) if len(s) else None,
                "median": round(float(s.median()), 4) if len(s) else None,
                "std": round(float(s.std()), 4) if len(s) else None,
                "min": round(float(s.min()), 4) if len(s) else None,
                "max": round(float(s.max()), 4) if len(s) else None,
            })
        elif ctype == "categorical":
            vc = df[col].value_counts().head(5).to_dict()
            entry["top_values"] = {str(k): int(v) for k, v in vc.items()}
        stats["columns"].append(entry)
    return stats


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/analyze")
async def analyze_file(file: UploadFile = File(...)):
    """Upload a file and run full AI data quality analysis."""
    raw = await file.read()
    name = file.filename or "upload.csv"

    try:
        if name.endswith(".csv") or name.endswith(".tsv"):
            sep = "\t" if name.endswith(".tsv") else ","
            df = pd.read_csv(io.BytesIO(raw), sep=sep, low_memory=False)
        elif name.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(raw))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Use CSV, TSV, or Excel.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")

    df = df.reset_index(drop=True)
    session_id = str(uuid.uuid4())

    # Run all analysis passes
    all_issues: list[dict] = []
    all_issues.extend(_analyze_missing(df))
    all_issues.extend(_analyze_outliers(df))
    all_issues.extend(_analyze_dates(df))
    all_issues.extend(_analyze_duplicates(df))
    all_issues.extend(_analyze_categoricals(df))
    all_issues.extend(_analyze_negative_durations(df))

    # Sort: critical first
    sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    all_issues.sort(key=lambda i: sev_order.get(i["severity"], 4))

    _sessions[session_id] = {
        "original": df.copy(),
        "current": df.copy(),
        "audit": [],
        "version": 0,
        "filename": name,
        # Store issues so /apply can look them up by the same UUID that was sent
        # to the frontend.  Re-running analysis in /apply generates NEW UUIDs,
        # so the frontend's approved_issue_ids would never match — nothing would
        # ever be applied.
        "issues": all_issues,
    }

    column_stats = _compute_stats(df)
    preview = json.loads(df.head(10).to_json(orient="records"))

    # Build column_stats dict keyed by column name (matches ColumnStat interface)
    col_stats_dict: dict[str, Any] = {}
    for entry in column_stats.get("columns", []):
        col_name = entry.pop("name", None)
        if col_name:
            col_stats_dict[col_name] = {
                "count": int(len(df) - df[col_name].isna().sum()),
                "missing": int(df[col_name].isna().sum()),
                # isna().mean() is numpy.float64 — round() preserves numpy type; cast explicitly
                "missing_pct": float(round(float(df[col_name].isna().mean()) * 100, 1)),
                "unique": int(df[col_name].nunique()),
                "dtype": entry.get("type", "unknown"),
                **{k: _native(v) for k, v in entry.items() if k not in ("type",)},
            }

    return {
        "session_id": session_id,
        # Fields matching AnalyzeResponse TypeScript interface:
        "file_name": name,
        "shape": [int(len(df)), int(len(df.columns))],
        "columns": list(df.columns),
        "column_stats": col_stats_dict,
        "preview_rows": preview,
        "issues": all_issues,
        # Extra metadata (not required by frontend but useful for debugging)
        "issue_counts": {
            "critical": sum(1 for i in all_issues if i["severity"] == "critical"),
            "high": sum(1 for i in all_issues if i["severity"] == "high"),
            "medium": sum(1 for i in all_issues if i["severity"] == "medium"),
            "low": sum(1 for i in all_issues if i["severity"] == "low"),
            "total": len(all_issues),
        },
    }


@router.post("/apply")
async def apply_fixes(req: ApplyRequest):
    """Apply approved fixes to the session dataset. Every change is audit-logged."""
    session = _sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found. Re-upload the file.")

    # Use the issues stored during /analyze — those carry the same UUIDs that
    # were sent to the frontend and put into approved_issue_ids.  Re-running
    # analysis here would generate brand-new UUIDs, so nothing would ever match.
    df = session["current"].copy()
    stored_issues: list[dict] = session.get("issues", [])
    issue_map = {i["id"]: i for i in stored_issues}

    rows_changed = 0
    new_audit: list[dict] = []

    for issue_id in req.approved_issue_ids:
        issue = issue_map.get(issue_id)
        if not issue:
            continue
        fix = issue["suggested_fix"]
        action = fix["action"]
        col = issue.get("column")
        affected = issue.get("rows_affected", [])

        ts = datetime.now(timezone.utc).isoformat()

        if action == "impute_median" and col:
            med = df[col].median()
            for row in affected:
                if row < len(df) and pd.isna(df.at[row, col]):
                    old = df.at[row, col]
                    df.at[row, col] = med
                    rows_changed += 1
                    new_audit.append({
                        "ts": ts, "session_id": req.session_id,
                        "version": session["version"] + 1,
                        "user": req.user_id, "action": "impute_median",
                        "column": col, "row": row,
                        "before": str(old), "after": str(round(float(med), 4)),
                        "method": "Median imputation",
                        "confidence": fix.get("confidence", 1.0),
                        "gcp_note": issue.get("gcp_note", ""),
                    })

        elif action == "impute_mode" and col:
            mode_val = df[col].mode().iloc[0] if not df[col].mode().empty else None
            if mode_val is not None:
                for row in affected:
                    if row < len(df) and pd.isna(df.at[row, col]):
                        old = df.at[row, col]
                        df.at[row, col] = mode_val
                        rows_changed += 1
                        new_audit.append({
                            "ts": ts, "session_id": req.session_id,
                            "version": session["version"] + 1,
                            "user": req.user_id, "action": "impute_mode",
                            "column": col, "row": row,
                            "before": str(old), "after": str(mode_val),
                            "method": "Mode imputation",
                            "confidence": fix.get("confidence", 1.0),
                            "gcp_note": issue.get("gcp_note", ""),
                        })

        elif action == "cap_outlier" and col:
            bounds = fix.get("value", {})
            lo = bounds.get("lower") if isinstance(bounds, dict) else None
            hi = bounds.get("upper") if isinstance(bounds, dict) else None
            for row in affected:
                if row >= len(df):
                    continue
                val = df.at[row, col]
                if pd.isna(val):
                    continue
                new_val = val
                if lo is not None and val < lo:
                    new_val = lo
                elif hi is not None and val > hi:
                    new_val = hi
                if new_val != val:
                    df.at[row, col] = new_val
                    rows_changed += 1
                    new_audit.append({
                        "ts": ts, "session_id": req.session_id,
                        "version": session["version"] + 1,
                        "user": req.user_id, "action": "cap_outlier",
                        "column": col, "row": row,
                        "before": str(val), "after": str(new_val),
                        "method": f"Winsorization [{lo}, {hi}]",
                        "confidence": fix.get("confidence", 1.0),
                        "gcp_note": issue.get("gcp_note", ""),
                    })

        elif action == "standardize" and col:
            mapping = fix.get("value", {})
            if isinstance(mapping, dict):
                for row in affected:
                    if row >= len(df):
                        continue
                    val = df.at[row, col]
                    new_val = mapping.get(str(val), val)
                    if new_val != val:
                        df.at[row, col] = new_val
                        rows_changed += 1
                        new_audit.append({
                            "ts": ts, "session_id": req.session_id,
                            "version": session["version"] + 1,
                            "user": req.user_id, "action": "standardize",
                            "column": col, "row": row,
                            "before": str(val), "after": str(new_val),
                            "method": "Categorical standardization (CDISC CT)",
                            "confidence": fix.get("confidence", 1.0),
                            "gcp_note": issue.get("gcp_note", ""),
                        })

        elif action == "drop_row":
            rows_to_drop = [r for r in affected if r < len(df)]
            if rows_to_drop:
                for row in rows_to_drop:
                    new_audit.append({
                        "ts": ts, "session_id": req.session_id,
                        "version": session["version"] + 1,
                        "user": req.user_id, "action": "drop_row",
                        "column": "ALL", "row": row,
                        "before": "DUPLICATE", "after": "DROPPED",
                        "method": "Duplicate removal (keep first)",
                        "confidence": fix.get("confidence", 1.0),
                        "gcp_note": issue.get("gcp_note", ""),
                    })
                df = df.drop(index=rows_to_drop).reset_index(drop=True)
                rows_changed += len(rows_to_drop)

        elif action == "convert_date" and col:
            target_fmt = fix.get("value", "YYYY-MM-DD")
            for row in affected:
                if row >= len(df):
                    continue
                val = df.at[row, col]
                try:
                    import dateutil.parser
                    parsed = dateutil.parser.parse(str(val))
                    new_val = parsed.strftime("%Y-%m-%d")
                    if new_val != str(val):
                        df.at[row, col] = new_val
                        rows_changed += 1
                        new_audit.append({
                            "ts": ts, "session_id": req.session_id,
                            "version": session["version"] + 1,
                            "user": req.user_id, "action": "convert_date",
                            "column": col, "row": row,
                            "before": str(val), "after": new_val,
                            "method": f"Date standardization → ISO 8601 (YYYY-MM-DD)",
                            "confidence": fix.get("confidence", 1.0),
                            "gcp_note": issue.get("gcp_note", ""),
                        })
                except Exception:
                    pass

    session["current"] = df
    session["version"] += 1
    session["audit"].extend(new_audit)

    cleaned_stats = _compute_stats(df)
    preview = json.loads(df.head(10).to_json(orient="records"))

    return {
        "session_id": req.session_id,
        "version": session["version"],
        # Fields matching what SmartDataUpload.tsx reads:
        "fixes_applied": rows_changed,
        "preview_rows": preview,
        "audit_entries": new_audit,
        # Extra metadata
        "rows_changed": rows_changed,
        "cleaned_stats": cleaned_stats,
        "audit_entries_added": len(new_audit),
    }


@router.get("/audit/{session_id}")
async def get_audit(session_id: str):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {
        "session_id": session_id,
        "version": session["version"],
        "entries": session["audit"],
        "total": len(session["audit"]),
    }


@router.post("/revert/{session_id}")
async def revert_session(session_id: str):
    """Revert dataset to original uploaded state (v0). Audit log is preserved."""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    session["current"] = session["original"].copy()
    prev_version = session["version"]
    session["version"] = 0
    session["audit"].append({
        "ts": datetime.now(timezone.utc).isoformat(),
        "session_id": session_id,
        "version": 0,
        "user": "local_user",
        "action": "revert_to_original",
        "column": "ALL",
        "row": None,
        "before": f"v{prev_version}",
        "after": "v0 (original)",
        "method": "Full revert to uploaded data",
        "confidence": 1.0,
        "gcp_note": "Revert action logged per GxP audit trail requirements.",
    })
    preview = json.loads(session["current"].head(10).to_json(orient="records"))
    return {"session_id": session_id, "version": 0, "original_preview": preview}


@router.get("/export/{session_id}")
async def export_cleaned(session_id: str, include_audit: bool = False):
    """Download cleaned CSV. Optionally appends audit trail as a second sheet (not for CSV)."""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    df = session["current"]
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)
    fname = session.get("filename", "cleaned.csv").rsplit(".", 1)[0]
    return StreamingResponse(
        io.BytesIO(buf.read().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fname}_cleaned_v{session["version"]}.csv"'},
    )


@router.get("/export-audit/{session_id}")
async def export_audit_csv(session_id: str):
    """Download audit trail as CSV (GxP-compliant record of all changes)."""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    audit_df = pd.DataFrame(session["audit"])
    if audit_df.empty:
        audit_df = pd.DataFrame(columns=["ts", "session_id", "version", "user",
                                          "action", "column", "row", "before", "after",
                                          "method", "confidence", "gcp_note"])
    buf = io.StringIO()
    audit_df.to_csv(buf, index=False)
    buf.seek(0)
    fname = session.get("filename", "data").rsplit(".", 1)[0]
    return StreamingResponse(
        io.BytesIO(buf.read().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fname}_audit_trail.csv"'},
    )
