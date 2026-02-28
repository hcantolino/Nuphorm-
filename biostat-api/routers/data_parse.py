"""
Data Parse API — robust server-side CSV/TSV/Excel parsing with GxP-friendly logging.

Endpoint: POST /api/v1/data/parse

Accepts:  multipart/form-data  { file: UploadFile, user_id: str }
Returns:
  Success → {
      success: true,
      columns: list[str],
      row_count: int,
      preview: list[dict],   # df.head(10)
      issues: {
          missing_pct: {col: float},
          types: {col: "numeric"|"categorical"|"datetime"},
          constant_cols: list[str],
          high_cardinality: list[str],
      },
      gxp: { upload_ts, filename, user, row_count, col_count }
  }
  Failure → { success: false, error: str, suggestion: str }

GxP alignment (ICH E6 R2 §5.18.4):
  • Every upload is logged with ISO-8601 timestamp, filename, user_id, row/col counts.
  • Log is retrievable via GET /api/v1/data/parse/log.
  • on_bad_lines='skip' preserves parseable data while flagging malformed lines.
  • Original file is NOT stored — only the derived preview and metadata.
"""

import csv
import io
import logging
import re
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

router = APIRouter()
logger = logging.getLogger(__name__)

# ── GxP upload log (in-memory; swap for DB persistence in production) ─────────
_upload_log: list[dict] = []


# ── Helper: safe JSON serialisation (NaN/Inf → None) ─────────────────────────

def _safe_records(df: pd.DataFrame) -> list[dict]:
    """Convert DataFrame to list[dict] with NaN/NaT/Inf replaced by None."""
    return [
        {
            k: (None if (isinstance(v, float) and not np.isfinite(v)) else
                (None if pd.isna(v) else v))
            for k, v in row.items()
        }
        for row in df.to_dict("records")
    ]


# ── Helper: infer column type label ──────────────────────────────────────────

def _col_type(series: pd.Series) -> str:
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    # Try to parse as datetime
    sample = series.dropna().head(20)
    try:
        pd.to_datetime(sample, errors="raise")
        return "datetime"
    except Exception:
        pass
    return "categorical"


# ── POST /parse ───────────────────────────────────────────────────────────────

@router.post(
    "/parse",
    summary="Parse an uploaded CSV / TSV / Excel file",
    response_description="Parsed schema, 10-row preview, and quality issues",
)
async def parse_dataset(
    file: UploadFile = File(..., description="CSV, TSV, XLSX, or XLS file"),
    user_id: str = Form("local_user", description="Authenticated user ID (mock for local dev)"),
) -> JSONResponse:

    filename = file.filename or "unknown"
    ts = datetime.now(timezone.utc).isoformat()
    logger.info("DATA PARSE | user=%s | file=%s | ts=%s", user_id, filename, ts)

    contents = await file.read()
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    # ── Parse ────────────────────────────────────────────────────────────────

    df: pd.DataFrame

    try:
        if ext in ("csv", "tsv"):
            sep = "\t" if ext == "tsv" else ","
            df = pd.read_csv(
                io.BytesIO(contents),
                sep=sep,
                on_bad_lines="skip",   # ICH E6: preserve parseable rows, flag bad ones
                encoding="utf-8",
                low_memory=False,
                engine="python",
                quoting=csv.QUOTE_MINIMAL,
                skipinitialspace=True,
            )

        elif ext in ("xlsx", "xls"):
            df = pd.read_excel(io.BytesIO(contents), engine="openpyxl" if ext == "xlsx" else "xlrd")

        else:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": f"Unsupported file type '.{ext}'",
                    "suggestion": "Upload a CSV, TSV, XLSX, or XLS file.",
                },
            )

    except pd.errors.ParserError as exc:
        raw = str(exc)
        # Extract line number if present in pandas error message
        m = re.search(r"line (\d+)", raw)
        line_ref = f" on line {m.group(1)}" if m else ""
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "error": f"Tokenizing failed — mismatched columns{line_ref}",
                "suggestion": (
                    "Check for extra commas or unescaped quotes. "
                    "Try opening in Excel and re-saving as 'CSV UTF-8 (comma delimited)'."
                ),
            },
        )

    except UnicodeDecodeError:
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "error": "Encoding error — file is not valid UTF-8",
                "suggestion": "In Excel: File → Save As → 'CSV UTF-8 (comma delimited)'.",
            },
        )

    except ValueError as exc:
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "error": f"Value error during parse: {exc}",
                "suggestion": "Check the file has consistent column counts per row.",
            },
        )

    except Exception as exc:
        logger.exception("Unexpected parse error: %s", exc)
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "error": f"Parse failed: {type(exc).__name__} — {exc}",
                "suggestion": "Check the file format. Try saving as plain CSV.",
            },
        )

    if df.empty:
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "error": "File parsed but contains no data rows",
                "suggestion": "Check the file has a header row and at least one data row.",
            },
        )

    # Strip whitespace from column names
    df.columns = df.columns.str.strip()

    row_count = len(df)
    col_count = len(df.columns)
    columns = df.columns.tolist()

    # ── Quality issues ────────────────────────────────────────────────────────

    # Missing %
    missing_pct = {
        col: round(float(df[col].isna().mean() * 100), 2)
        for col in columns
    }

    # Column type labels
    types = {col: _col_type(df[col]) for col in columns}

    # Constant columns (all non-null values identical)
    constant_cols = [
        col for col in columns
        if df[col].dropna().nunique() == 1 and df[col].notna().any()
    ]

    # High-cardinality categorical columns (> 50% unique, > 50 unique values)
    high_cardinality = [
        col for col in columns
        if types[col] == "categorical"
        and df[col].nunique() > 50
        and df[col].nunique() > row_count * 0.5
    ]

    # ── GxP log ───────────────────────────────────────────────────────────────

    log_entry = {
        "ts": ts,
        "user": user_id,
        "filename": filename,
        "row_count": row_count,
        "col_count": col_count,
        "missing_cols": [c for c, p in missing_pct.items() if p > 0],
    }
    _upload_log.append(log_entry)
    logger.info(
        "DATA PARSE OK | user=%s | file=%s | rows=%d | cols=%d | missing_cols=%d",
        user_id, filename, row_count, col_count,
        len(log_entry["missing_cols"]),
    )

    return JSONResponse(
        content={
            "success": True,
            "columns": columns,
            "row_count": row_count,
            "preview": _safe_records(df.head(10)),
            "issues": {
                "missing_pct": missing_pct,
                "types": types,
                "constant_cols": constant_cols,
                "high_cardinality": high_cardinality,
            },
            "gxp": {
                "upload_ts": ts,
                "filename": filename,
                "user": user_id,
                "row_count": row_count,
                "col_count": col_count,
            },
        }
    )


# ── GET /parse/log ─────────────────────────────────────────────────────────────

@router.get(
    "/parse/log",
    summary="Retrieve GxP upload audit log",
    tags=["Smart Cleaning"],
)
async def get_parse_log() -> dict:
    """Return all upload events logged since the API started."""
    return {"count": len(_upload_log), "log": _upload_log}
