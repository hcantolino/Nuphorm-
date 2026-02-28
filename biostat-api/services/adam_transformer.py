"""
ADaM dataset derivation service.

Implements admiral-like derivation logic in pure Python/pandas.
Each derive_* function converts SDTM-like input rows into a
fully populated ADaM domain (ADSL, ADAE, ADLB, ADTTE).

Traceability: every derived variable is annotated with the SDTM source
variable(s) and derivation rule, matching CDISC ADaMIG §2.2.
"""
from __future__ import annotations

import logging
from datetime import datetime, date
from typing import Any

import numpy as np          # fixes "nump y" typo + missing import
import pandas as pd         # fixes "pandas" missing
import statsmodels.formula.api as smf   # fixes statsmodels.formula.api import
import lifelines            # fixes lifelines missing

logger = logging.getLogger(__name__)

# ── Date helpers ───────────────────────────────────────────────────────────────

_ISO_FMT = "%Y-%m-%d"


def _to_date(val: Any, fmt: str = _ISO_FMT) -> date | None:
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return None
    try:
        if isinstance(val, (date, datetime)):
            return val if isinstance(val, date) else val.date()
        return datetime.strptime(str(val)[:10], fmt).date()
    except (ValueError, TypeError):
        return None


def _days_between(d1: date | None, d2: date | None) -> float | None:
    if d1 is None or d2 is None:
        return None
    return float((d2 - d1).days)


# ── Population-flag derivations ───────────────────────────────────────────────

def _derive_saffl(row: pd.Series) -> str:
    """
    SAFFL = 'Y' if subject received at least one dose (EXSTDTC is non-null).
    Source: SDTM EX.EXSTDTC
    Rule: ADaMIG 1.3 §3.3.2 — Safety population
    """
    return "Y" if pd.notna(row.get("EXSTDTC")) and str(row.get("EXSTDTC", "")).strip() else "N"


def _derive_ittfl(row: pd.Series) -> str:
    """
    ITTFL = 'Y' if subject was randomised (RANDDT or ARM is non-null/non-empty).
    Source: SDTM DM.ARM, SDTM DM.RFSTDTC
    Rule: ADaMIG 1.3 §3.3.3 — Intent-to-Treat population
    """
    return "Y" if pd.notna(row.get("ARM")) and str(row.get("ARM", "")).strip() else "N"


def _derive_randfl(row: pd.Series) -> str:
    """
    RANDFL = 'Y' if RANDDT (DS.DSSTDTC where DSDECOD='RANDOMIZATION') is present.
    Approximated here from DM.RFSTDTC.
    """
    return "Y" if pd.notna(row.get("RFSTDTC")) else "N"


def _derive_pprotfl(row: pd.Series) -> str:
    """
    PPROTFL = 'Y' if ITTFL='Y' AND no major protocol deviation (DS record).
    Simplified: 'Y' if ITTFL='Y' and DVFL not present.
    """
    return "Y" if _derive_ittfl(row) == "Y" and not row.get("DVFL") else "N"


# ── ADSL derivation ───────────────────────────────────────────────────────────


def derive_adsl(rows: list[dict[str, Any]], date_fmt: str = _ISO_FMT) -> list[dict]:
    """
    Derive ADSL from SDTM DM (+ EX, DS where available).

    Key derivations (ADaMIG 1.3):
      TRTSDT  ← earliest EXSTDTC  (EX.EXSTDTC; rule: first dose date)
      TRTEDT  ← latest   EXENDTC  (EX.EXENDTC; rule: last dose date)
      SAFFL   ← Y if ≥1 dose received
      ITTFL   ← Y if randomised
      RANDFL  ← Y if RFSTDTC present
      PPROTFL ← Y if ITTFL=Y and no major deviation
      ACTARM  ← ARM (when actual treatment = planned)
      ACTARMCD← ARMCD
    """
    dm_rows = [r for r in rows if r.get("DOMAIN", "DM") in ("DM", "")]
    ex_rows = [r for r in rows if r.get("DOMAIN") == "EX"]

    # Build EX lookup: USUBJID → {first start, last end}
    ex_df = pd.DataFrame(ex_rows) if ex_rows else pd.DataFrame(columns=["USUBJID"])
    ex_lookup: dict[str, dict] = {}
    if not ex_df.empty and "USUBJID" in ex_df.columns:
        for uid, grp in ex_df.groupby("USUBJID"):
            starts = [_to_date(d, date_fmt) for d in grp.get("EXSTDTC", pd.Series([])) if pd.notna(d)]
            ends   = [_to_date(d, date_fmt) for d in grp.get("EXENDTC", pd.Series([])) if pd.notna(d)]
            ex_lookup[str(uid)] = {
                "TRTSDT":   min(starts).isoformat() if starts else None,
                "TRTEDT":   max(ends).isoformat()   if ends   else None,
                "EXSTDTC":  grp["EXSTDTC"].iloc[0]  if "EXSTDTC" in grp.columns else None,
            }

    adsl_records = []
    for raw in dm_rows:
        uid = str(raw.get("USUBJID", ""))
        ex  = ex_lookup.get(uid, {})

        # Merge EX data into row for flag derivations
        merged = {**raw, **ex}
        row    = pd.Series(merged)

        record: dict[str, Any] = {
            # ── Identifier variables ─────────────────────────────────────────
            "STUDYID":  raw.get("STUDYID", ""),
            "USUBJID":  uid,
            "SUBJID":   raw.get("SUBJID", ""),
            "SITEID":   raw.get("SITEID", ""),

            # ── Demographics (mapped 1:1 from DM) ───────────────────────────
            "AGE":    _num(raw.get("AGE")),
            "AGEU":   raw.get("AGEU", "YEARS"),
            "SEX":    raw.get("SEX"),
            "RACE":   raw.get("RACE"),
            "ETHNIC": raw.get("ETHNIC"),

            # ── Treatment ────────────────────────────────────────────────────
            "ARM":      raw.get("ARM"),
            "ARMCD":    raw.get("ARMCD"),
            "ACTARM":   raw.get("ACTARM") or raw.get("ARM"),    # fallback to planned
            "ACTARMCD": raw.get("ACTARMCD") or raw.get("ARMCD"),

            # ── Treatment dates (from EX) ─────────────────────────────────
            "TRTSDT": ex.get("TRTSDT") or _isodate(raw.get("RFSTDTC")),
            "TRTEDT": ex.get("TRTEDT") or _isodate(raw.get("RFENDTC")),

            # ── Population flags ──────────────────────────────────────────
            "SAFFL":   _derive_saffl(row),
            "ITTFL":   _derive_ittfl(row),
            "RANDFL":  _derive_randfl(row),
            "PPROTFL": _derive_pprotfl(row),

            # ── Traceability metadata ─────────────────────────────────────
            "_TRACE": {
                "TRTSDT":   "Derived from EX.EXSTDTC (earliest dose start date)",
                "TRTEDT":   "Derived from EX.EXENDTC (latest dose end date)",
                "SAFFL":    "Y if EX.EXSTDTC is non-null (at least one dose received)",
                "ITTFL":    "Y if DM.ARM is non-null (subject was randomised)",
                "RANDFL":   "Y if DM.RFSTDTC is non-null",
                "PPROTFL":  "Y if ITTFL=Y and no major protocol deviation (DS.DVFL absent)",
                "ACTARM":   "Copied from DM.ARM (actual arm equals planned when available)",
                "ACTARMCD": "Copied from DM.ARMCD",
            },
        }
        adsl_records.append(record)

    return adsl_records


# ── ADAE derivation ───────────────────────────────────────────────────────────


def derive_adae(rows: list[dict[str, Any]], adsl: list[dict]) -> list[dict]:
    """
    Derive ADAE from SDTM AE domain + ADSL (for treatment dates).

    Key derivations:
      ASTDT    ← AE.AESTDTC (converted to SAS-style numeric date)
      AENDT    ← AE.AEENDTC
      TRTEMFL  ← 'Y' if ASTDT >= TRTSDT and ASTDT <= TRTEDT + 30 days
      ANFL     ← 'Y' (all AE records are included in default analysis flag 01)
    """
    ae_rows = [r for r in rows if r.get("DOMAIN") == "AE"]
    if not ae_rows:
        return []

    # Build ADSL lookup: USUBJID → {TRTSDT, TRTEDT}
    adsl_map = {r["USUBJID"]: r for r in adsl}

    adae_records = []
    for raw in ae_rows:
        uid = str(raw.get("USUBJID", ""))
        subj = adsl_map.get(uid, {})

        astdt = _to_date(raw.get("AESTDTC"))
        aendt = _to_date(raw.get("AEENDTC"))
        trtsdt = _to_date(subj.get("TRTSDT"))
        trtedt = _to_date(subj.get("TRTEDT"))

        # TRTEMFL: on/after first dose and on/before last dose + 30-day window
        trtfl = ""
        if astdt and trtsdt:
            after_start = astdt >= trtsdt
            before_end = True
            if trtedt:
                delta = _days_between(trtedt, astdt)
                before_end = delta is None or delta <= 30
            trtfl = "Y" if (after_start and before_end) else ""

        adae_records.append({
            "STUDYID":  raw.get("STUDYID", subj.get("STUDYID", "")),
            "USUBJID":  uid,
            "AESEQ":    raw.get("AESEQ"),
            "AETERM":   raw.get("AETERM"),
            "AEDECOD":  raw.get("AEDECOD"),
            "AEBODSYS": raw.get("AEBODSYS"),
            "AESEV":    raw.get("AESEV"),
            "AESER":    raw.get("AESER"),
            "AESTDTC":  raw.get("AESTDTC"),
            "AEENDTC":  raw.get("AEENDTC"),
            "ASTDT":    astdt.isoformat() if astdt else None,
            "AENDT":    aendt.isoformat() if aendt else None,
            "TRTEMFL":  trtfl,
            "ANFL":     "Y",
            "_TRACE": {
                "ASTDT":   "Derived from AE.AESTDTC (converted from ISO 8601)",
                "AENDT":   "Derived from AE.AEENDTC",
                "TRTEMFL": "Y if ASTDT >= ADSL.TRTSDT and ASTDT <= ADSL.TRTEDT + 30 days",
                "ANFL":    "Y for all AE records in analysis dataset",
            },
        })

    return adae_records


# ── ADLB derivation ───────────────────────────────────────────────────────────


def derive_adlb(rows: list[dict[str, Any]], adsl: list[dict]) -> list[dict]:
    """
    Derive ADLB from SDTM LB domain.

    Key derivations:
      AVAL   ← LB.LBORRES (numeric result)
      BASE   ← AVAL where ABLFL='Y' (baseline = last pre-dose value)
      CHG    ← AVAL - BASE
      PCHG   ← 100 * CHG / BASE
      ABLFL  ← 'Y' for last pre-dose observation
      ANL01FL← 'Y' for all records used in primary analysis
      PARAMCD← LB.LBTESTCD (≤8 chars)
      PARAM  ← LB.LBTEST
    """
    lb_rows = [r for r in rows if r.get("DOMAIN") == "LB"]
    if not lb_rows:
        return []

    adsl_map = {r["USUBJID"]: r for r in adsl}
    df = pd.DataFrame(lb_rows)

    records = []
    for uid, grp in df.groupby("USUBJID"):
        trtsdt = _to_date(adsl_map.get(str(uid), {}).get("TRTSDT"))

        for testcd, tgrp in grp.groupby("LBTESTCD" if "LBTESTCD" in grp.columns else grp.columns[0]):
            tgrp = tgrp.copy()
            tgrp["_ADT"]  = tgrp["LBDTC"].apply(_to_date) if "LBDTC" in tgrp else None
            tgrp["_AVAL"] = pd.to_numeric(tgrp.get("LBORRES", pd.Series([])), errors="coerce")

            # Baseline: last observation before or on treatment start
            pre_dose = tgrp[tgrp["_ADT"].apply(lambda d: d is not None and (trtsdt is None or d <= trtsdt))]
            baseline_val: float | None = None
            baseline_idx: Any = None
            if not pre_dose.empty:
                baseline_row = pre_dose.loc[pre_dose["_ADT"].apply(lambda d: d or date.min).idxmax()]
                baseline_val = float(baseline_row["_AVAL"]) if pd.notna(baseline_row["_AVAL"]) else None
                baseline_idx = baseline_row.name

            for idx, r in tgrp.iterrows():
                aval = float(r["_AVAL"]) if pd.notna(r["_AVAL"]) else None
                chg  = round(aval - baseline_val, 6) if (aval is not None and baseline_val is not None) else None
                pchg = round(100 * chg / baseline_val, 4) if (chg is not None and baseline_val) else None

                records.append({
                    "STUDYID": r.get("STUDYID", ""),
                    "USUBJID": str(uid),
                    "PARAMCD": str(testcd)[:8],
                    "PARAM":   r.get("LBTEST", str(testcd)),
                    "AVAL":    aval,
                    "AVALC":   str(r.get("LBORRES", "")) if aval is None else None,
                    "BASE":    baseline_val,
                    "CHG":     chg,
                    "PCHG":    pchg,
                    "ABLFL":   "Y" if idx == baseline_idx else "",
                    "ANL01FL": "Y",
                    "VISITNUM": _num(r.get("VISITNUM")),
                    "VISIT":   r.get("VISIT"),
                    "ADT":     r["_ADT"].isoformat() if r["_ADT"] else None,
                    "_TRACE": {
                        "AVAL":  "Derived from LB.LBORRES (numeric cast)",
                        "BASE":  "Last pre-dose AVAL (LBDTC <= ADSL.TRTSDT)",
                        "CHG":   "AVAL - BASE",
                        "PCHG":  "100 * CHG / BASE",
                        "ABLFL": "Y for the baseline record (last pre-dose observation)",
                    },
                })

    return records


# ── ADTTE derivation ──────────────────────────────────────────────────────────


def derive_adtte(rows: list[dict[str, Any]], adsl: list[dict]) -> list[dict]:
    """
    Derive ADTTE (Time-to-Event) from SDTM DS + AE domains.

    Supports Overall Survival (OS) as the primary endpoint.
    AVAL = days from TRTSDT to event/censoring date.
    CNSR = 0 if event occurred, 1 if censored.
    """
    ds_rows = [r for r in rows if r.get("DOMAIN") == "DS"]
    adsl_map = {r["USUBJID"]: r for r in adsl}
    records  = []

    for subj in adsl:
        uid    = subj["USUBJID"]
        trtsdt = _to_date(subj.get("TRTSDT"))
        if trtsdt is None:
            continue

        # Find death or study completion record in DS
        subj_ds = [r for r in ds_rows if str(r.get("USUBJID", "")) == uid]
        death_dt = None
        censor_dt = None

        for ds in subj_ds:
            dsdecod = str(ds.get("DSDECOD", "")).upper()
            if "DEATH" in dsdecod:
                death_dt = _to_date(ds.get("DSSTDTC"))
            elif "COMPLETE" in dsdecod or "WITHDRAWAL" in dsdecod:
                censor_dt = _to_date(ds.get("DSSTDTC"))

        event_dt = death_dt or censor_dt or _to_date(subj.get("TRTEDT"))
        cnsr     = 0 if death_dt else 1
        aval     = _days_between(trtsdt, event_dt)

        records.append({
            "STUDYID":   subj.get("STUDYID", ""),
            "USUBJID":   uid,
            "PARAMCD":   "OS",
            "PARAM":     "Overall Survival",
            "AVAL":      aval,
            "AVALU":     "DAYS",
            "CNSR":      cnsr,
            "EVNTDESC":  "Death" if cnsr == 0 else "Censored",
            "STARTDT":   trtsdt.isoformat() if trtsdt else None,
            "ADT":       event_dt.isoformat() if event_dt else None,
            "_TRACE": {
                "AVAL":  "Days from ADSL.TRTSDT to event/censoring date (DS.DSSTDTC)",
                "CNSR":  "0 if DS.DSDECOD contains 'DEATH', else 1 (censored)",
                "ADT":   "DS.DSSTDTC of death or last known alive date",
            },
        })

    return records


# ── Statistical computations ──────────────────────────────────────────────────


def compute_descriptive(
    data: list[dict],
    value_col: str,
    paramcd: str,
    param: str,
    group_col: str | None = None,
) -> list[dict]:
    """
    Compute descriptive statistics (n, mean, SD, median, Q1, Q3, min, max).
    Returns a list of result dicts, one per group level (or one total).
    """
    df = pd.DataFrame(data)
    if value_col not in df.columns:
        return []

    df[value_col] = pd.to_numeric(df[value_col], errors="coerce")

    def _stats(series: pd.Series, group: str | None = None) -> dict:
        s = series.dropna()
        return {
            "paramcd": paramcd,
            "param":   param,
            "group":   group,
            "n":       int(s.count()),
            "mean":    round(float(s.mean()), 4)   if s.count() else None,
            "std":     round(float(s.std()),  4)   if s.count() > 1 else None,
            "median":  round(float(s.median()), 4) if s.count() else None,
            "q1":      round(float(s.quantile(0.25)), 4) if s.count() else None,
            "q3":      round(float(s.quantile(0.75)), 4) if s.count() else None,
            "min":     round(float(s.min()), 4) if s.count() else None,
            "max":     round(float(s.max()), 4) if s.count() else None,
            "missing": int(series.isna().sum()),
        }

    if group_col and group_col in df.columns:
        results = []
        for grp_val, grp_df in df.groupby(group_col):
            results.append(_stats(grp_df[value_col], group=str(grp_val)))
        results.append(_stats(df[value_col], group="Total"))
        return results

    return [_stats(df[value_col])]


def compute_mmrm(
    data: list[dict],
    response_var: str,
    time_var: str,
    treatment_var: str,
    covariate_vars: list[str],
    paramcd: str,
) -> dict:
    """
    Approximate MMRM using statsmodels MixedLM (unstructured covariance).
    Returns LSMeans per visit × treatment and pairwise contrasts.

    Note: True MMRM (SAS PROC MIXED) uses GLS with configurable covariance
    structures. This implementation uses random intercepts as an approximation
    when an unstructured matrix cannot be estimated from Python alone.
    """
    import statsmodels.formula.api as smf

    df = pd.DataFrame(data).copy()
    df[response_var] = pd.to_numeric(df[response_var], errors="coerce")
    df = df.dropna(subset=[response_var, time_var, treatment_var])

    if df.empty or df[time_var].nunique() < 2:
        return {"paramcd": paramcd, "visits": [], "lsmeans": [], "contrasts": [], "convergence": "failed"}

    # Encode categoricals
    df["_time"]  = df[time_var].astype("category")
    df["_trt"]   = df[treatment_var].astype("category")

    covs = " + ".join(covariate_vars) if covariate_vars else "1"
    formula = f"{response_var} ~ C(_trt) * C(_time) + {covs}"

    try:
        if "USUBJID" in df.columns:
            model  = smf.mixedlm(formula, df, groups=df["USUBJID"])
        else:
            model  = smf.ols(formula, df)
        result = model.fit(reml=True) if hasattr(model, "fit") else model.fit()
        # Safely determine convergence status
        converged_flag = result.converged if hasattr(result, "converged") else True
        convergence = "converged" if converged_flag else "singular"
    except Exception as exc:
        logger.warning("MMRM failed: %s", exc)
        return {"paramcd": paramcd, "visits": [], "lsmeans": [], "contrasts": [], "convergence": "failed"}

    visits = sorted(df["_time"].cat.categories.tolist())
    treatments = sorted(df["_trt"].cat.categories.tolist())

    # Extract LSMeans by computing mean predicted value per treatment × visit cell
    lsmeans = []
    for trt in treatments:
        for vis in visits:
            cell = df[(df["_trt"] == trt) & (df["_time"] == vis)]
            if cell.empty:
                continue
            pred  = result.predict(cell) if hasattr(result, "predict") else cell[response_var]
            lsmean = float(pred.mean())
            se     = float(pred.std() / (len(pred) ** 0.5)) if len(pred) > 1 else 0.0
            lsmeans.append({
                "treatment": trt,
                "visit":     vis,
                "lsmean":    round(lsmean, 4),
                "se":        round(se, 4),
                "ci_lo":     round(lsmean - 1.96 * se, 4),
                "ci_hi":     round(lsmean + 1.96 * se, 4),
            })

    # Pairwise contrasts (active vs first arm at each visit)
    contrasts = []
    ref_trt = treatments[0] if treatments else None
    for vis in visits:
        ref_ls = next((x for x in lsmeans if x["treatment"] == ref_trt and x["visit"] == vis), None)
        for trt in treatments[1:]:
            act_ls = next((x for x in lsmeans if x["treatment"] == trt and x["visit"] == vis), None)
            if ref_ls and act_ls:
                diff = act_ls["lsmean"] - ref_ls["lsmean"]
                se   = (ref_ls["se"] ** 2 + act_ls["se"] ** 2) ** 0.5
                contrasts.append({
                    "visit":   vis,
                    "active":  trt,
                    "ref":     ref_trt,
                    "diff":    round(diff, 4),
                    "se":      round(se, 4),
                    "p_value": None,  # would need proper Wald test from model
                    "ci_lo":   round(diff - 1.96 * se, 4),
                    "ci_hi":   round(diff + 1.96 * se, 4),
                })

    return {
        "paramcd":     paramcd,
        "visits":      [str(v) for v in visits],
        "lsmeans":     lsmeans,
        "contrasts":   contrasts,
        "convergence": convergence,
    }


def compute_cox_ph(adtte: list[dict], treatment_var: str, paramcd: str) -> dict:
    """
    Kaplan-Meier + Cox PH for a time-to-event endpoint (uses lifelines).
    """
    from lifelines import KaplanMeierFitter, CoxPHFitter

    df = pd.DataFrame(adtte).copy()
    df["AVAL"] = pd.to_numeric(df.get("AVAL", pd.Series([])), errors="coerce")
    df["CNSR"] = pd.to_numeric(df.get("CNSR", pd.Series([])), errors="coerce").fillna(1)
    df["event"] = 1 - df["CNSR"]  # lifelines uses event_col=1 for event

    adsl_col = treatment_var  # must be merged into ADTTE before calling
    df = df.dropna(subset=["AVAL"])

    if df.empty:
        return {"paramcd": paramcd, "hr": None, "hr_ci_lo": None, "hr_ci_hi": None,
                "p_value": None, "log_rank_p": None, "median_tte": {}, "km_table": []}

    # KM per treatment arm
    km_table = []
    median_tte: dict[str, float | None] = {}

    if adsl_col in df.columns:
        for arm, grp in df.groupby(adsl_col):
            kmf = KaplanMeierFitter(label=str(arm))
            kmf.fit(grp["AVAL"], event_observed=grp["event"])
            median_tte[str(arm)] = float(kmf.median_survival_time_) if not np.isnan(kmf.median_survival_time_) else None
            for t, s, at_r in zip(
                kmf.survival_function_.index,
                kmf.survival_function_[str(arm)],
                kmf.event_table["at_risk"],
            ):
                km_table.append({
                    "time": float(t), "survival": round(float(s), 6),
                    "at_risk": int(at_r), "arm": str(arm),
                })

    # Cox PH
    hr = hr_lo = hr_hi = pval = log_rank_p = None
    if adsl_col in df.columns and df[adsl_col].nunique() >= 2:
        try:
            cph = CoxPHFitter()
            cph_df = pd.get_dummies(df[[adsl_col, "AVAL", "event"]], drop_first=True)
            cph.fit(cph_df, duration_col="AVAL", event_col="event")
            coef_col = [c for c in cph.summary.index if c != "event"]
            if coef_col:
                row = cph.summary.loc[coef_col[0]]
                hr     = round(float(np.exp(row["coef"])), 4)
                hr_lo  = round(float(np.exp(row["coef lower 95%"])), 4)
                hr_hi  = round(float(np.exp(row["coef upper 95%"])), 4)
                pval   = round(float(row["p"]), 6)
        except Exception as exc:
            logger.warning("Cox PH failed: %s", exc)

    return {
        "paramcd":    paramcd,
        "hr":         hr,
        "hr_ci_lo":   hr_lo,
        "hr_ci_hi":   hr_hi,
        "p_value":    pval,
        "log_rank_p": log_rank_p,
        "median_tte": median_tte,
        "km_table":   km_table,
    }


# ── Private helpers ───────────────────────────────────────────────────────────


def _num(val: Any) -> float | None:
    try:
        return float(val) if val is not None else None
    except (ValueError, TypeError):
        return None


def _isodate(val: Any) -> str | None:
    d = _to_date(val)
    return d.isoformat() if d else None
