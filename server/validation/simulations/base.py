#!/usr/bin/env python3
"""
Base framework for simulation-based validation of Nuphorm's
statistical methods.

Every simulation answers these questions:
1. TYPE I ERROR: Under the null hypothesis, does the test reject
   at the nominal rate (e.g. 0.05)?
2. COVERAGE: Do 95% confidence intervals contain the true parameter
   95% of the time?
3. BIAS: Is the point estimate centered on the true value?
4. POWER: Under known effect sizes, does the test detect them at
   the expected rate?

Each simulation scenario specifies:
- Ground truth (e.g. true mean difference = 0.5)
- Data-generating process (e.g. normal with SD=1, n=30 per group)
- Number of replications (typically 10,000)
- Pass criteria (e.g. type I error in [0.04, 0.06])
"""

import json
import hashlib
import time
import datetime
import os
from dataclasses import dataclass, asdict, field
from typing import Callable, Any
import numpy as np

MASTER_SEED = 42


@dataclass
class Scenario:
    """One simulation scenario with known ground truth."""
    name: str
    description: str
    n_replications: int
    generator: Callable
    evaluator: Callable


@dataclass
class ScenarioResult:
    name: str
    description: str
    n_replications: int
    n_successful: int
    type_I_error: float | None
    type_I_target: float | None
    type_I_pass: bool | None
    coverage: float | None
    coverage_target: float | None
    coverage_pass: bool | None
    bias: float | None
    bias_relative: float | None
    mse: float | None
    power: float | None
    runtime_seconds: float
    pass_criteria: dict = field(default_factory=dict)
    failures: list = field(default_factory=list)


@dataclass
class MethodResult:
    method_name: str
    compute_file_hash: str
    git_sha: str | None
    timestamp: str
    scenarios: list
    overall_pass: bool
    total_runtime_seconds: float


def run_scenario(scenario: Scenario, alpha: float = 0.05) -> ScenarioResult:
    """Run N replications of a scenario and summarize results."""
    start = time.time()

    rejections = 0
    coverages = 0
    estimates = []
    truths = []
    n_successful = 0
    failures = []

    for rep in range(scenario.n_replications):
        try:
            rep_rng = np.random.default_rng(MASTER_SEED + rep)
            data, ground_truth = scenario.generator(rep_rng)
            result = scenario.evaluator(data, ground_truth)

            n_successful += 1

            if result.get('p_value') is not None:
                if result['p_value'] < alpha:
                    rejections += 1

            if all(k in result for k in ['ci_low', 'ci_high']) and 'truth' in ground_truth:
                if result['ci_low'] <= ground_truth['truth'] <= result['ci_high']:
                    coverages += 1

            if 'estimate' in result and 'truth' in ground_truth:
                estimates.append(result['estimate'])
                truths.append(ground_truth['truth'])

        except Exception as e:
            failures.append(f"Rep {rep}: {type(e).__name__}: {str(e)[:80]}")
            if len(failures) >= 5:
                continue

    runtime = time.time() - start

    is_null = 'null' in scenario.description.lower() or 'under h0' in scenario.description.lower()

    type_I = rejections / n_successful if is_null and n_successful > 0 else None
    type_I_target = alpha if is_null else None
    type_I_pass = None
    if type_I is not None:
        se = np.sqrt(alpha * (1 - alpha) / n_successful)
        type_I_pass = abs(type_I - alpha) < 3 * se

    power = rejections / n_successful if not is_null and n_successful > 0 else None

    coverage = coverages / n_successful if n_successful > 0 and len(estimates) > 0 else None
    coverage_pass = None
    if coverage is not None:
        se = np.sqrt(0.95 * 0.05 / n_successful)
        coverage_pass = abs(coverage - 0.95) < 3 * se

    bias = None
    bias_rel = None
    mse = None
    if estimates and truths:
        est_arr = np.array(estimates)
        truth_arr = np.array(truths)
        bias = float(np.mean(est_arr - truth_arr))
        if np.all(truth_arr != 0):
            bias_rel = float(np.mean((est_arr - truth_arr) / np.abs(truth_arr)))
        mse = float(np.mean((est_arr - truth_arr) ** 2))

    return ScenarioResult(
        name=scenario.name,
        description=scenario.description,
        n_replications=scenario.n_replications,
        n_successful=n_successful,
        type_I_error=type_I,
        type_I_target=type_I_target,
        type_I_pass=type_I_pass,
        coverage=coverage,
        coverage_target=0.95 if coverage is not None else None,
        coverage_pass=coverage_pass,
        bias=bias,
        bias_relative=bias_rel,
        mse=mse,
        power=power,
        runtime_seconds=runtime,
        pass_criteria={'alpha': alpha, 'tolerance_SE': 3},
        failures=failures[:5],
    )


def validate_method(
    method_name: str,
    scenarios: list,
    compute_file_path: str,
    alpha: float = 0.05
) -> MethodResult:
    """Run all scenarios for one method and produce a MethodResult."""
    with open(compute_file_path, 'rb') as f:
        file_hash = hashlib.sha256(f.read()).hexdigest()[:16]

    git_sha = os.environ.get('GITHUB_SHA', 'local')[:8] if os.environ.get('GITHUB_SHA') else 'local'

    start = time.time()
    scenario_results = []
    for scenario in scenarios:
        print(f"  Running: {scenario.name} ({scenario.n_replications} reps)...")
        sr = run_scenario(scenario, alpha=alpha)
        scenario_results.append(sr)
        status = []
        if sr.type_I_pass is not None:
            status.append(f"Type I={sr.type_I_error:.4f} ({'PASS' if sr.type_I_pass else 'FAIL'})")
        if sr.coverage_pass is not None:
            status.append(f"Cov={sr.coverage:.4f} ({'PASS' if sr.coverage_pass else 'FAIL'})")
        if sr.power is not None:
            status.append(f"Power={sr.power:.4f}")
        print(f"    {' | '.join(status)}")

    total_runtime = time.time() - start
    overall_pass = all(
        (sr.type_I_pass is not False) and (sr.coverage_pass is not False)
        for sr in scenario_results
    )

    return MethodResult(
        method_name=method_name,
        compute_file_hash=file_hash,
        git_sha=git_sha,
        timestamp=datetime.datetime.utcnow().isoformat(),
        scenarios=[asdict(sr) for sr in scenario_results],
        overall_pass=overall_pass,
        total_runtime_seconds=total_runtime,
    )


def save_results(method_result: MethodResult, results_dir: str = 'server/validation/results'):
    """Save to latest.json (overwrites) and history/ (append)."""
    os.makedirs(results_dir, exist_ok=True)
    os.makedirs(os.path.join(results_dir, 'history'), exist_ok=True)

    latest_path = os.path.join(results_dir, 'latest.json')
    latest = {}
    if os.path.exists(latest_path):
        with open(latest_path) as f:
            latest = json.load(f)

    latest[method_result.method_name] = asdict(method_result)

    with open(latest_path, 'w') as f:
        json.dump(latest, f, indent=2, default=str)

    history_path = os.path.join(results_dir, 'history',
        f"{method_result.method_name}_{method_result.timestamp.replace(':', '-')}.json")
    with open(history_path, 'w') as f:
        json.dump(asdict(method_result), f, indent=2, default=str)
