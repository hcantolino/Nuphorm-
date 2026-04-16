#!/usr/bin/env python3
"""Simulation scenarios for descriptive statistics validation."""

import numpy as np
from scipy import stats
from .base import Scenario


def _generate_normal(rng, n=100, mu=50, sigma=10):
    data = rng.normal(mu, sigma, n)
    return {'values': data.tolist()}, {'truth': mu, 'true_sd': sigma}


def _evaluate_mean(data, ground_truth):
    values = np.array(data['values'])
    n = len(values)
    mean = np.mean(values)
    se = np.std(values, ddof=1) / np.sqrt(n)
    ci_low = mean - 1.96 * se
    ci_high = mean + 1.96 * se
    # One-sample t-test against the true mean (for type I error under null)
    t_stat, p_value = stats.ttest_1samp(values, ground_truth['truth'])
    return {
        'estimate': float(mean),
        'p_value': float(p_value),
        'ci_low': float(ci_low),
        'ci_high': float(ci_high),
    }


def _generate_skewed(rng, n=100, shape=4, scale=2):
    data = rng.gamma(shape, scale, n)
    return {'values': data.tolist()}, {'truth': shape * scale, 'true_sd': np.sqrt(shape) * scale}


def get_scenarios(method_name: str) -> list:
    return [
        Scenario(
            name="mean_normal_null_n30",
            description="Null: mean of N(50,10), n=30. Type I error should be ~0.05.",
            n_replications=10000,
            generator=lambda rng: _generate_normal(rng, n=30, mu=50, sigma=10),
            evaluator=_evaluate_mean,
        ),
        Scenario(
            name="mean_normal_null_n100",
            description="Null: mean of N(50,10), n=100. Coverage of 95% CI.",
            n_replications=10000,
            generator=lambda rng: _generate_normal(rng, n=100, mu=50, sigma=10),
            evaluator=_evaluate_mean,
        ),
        Scenario(
            name="mean_normal_alt_d05",
            description="Alternative: true mean=55 (d=0.5), n=30. Power check.",
            n_replications=5000,
            generator=lambda rng: _generate_normal(rng, n=30, mu=55, sigma=10),
            evaluator=lambda data, gt: _evaluate_mean(data, {'truth': 50}),
        ),
        Scenario(
            name="mean_skewed_n30",
            description="Null: mean of Gamma(4,2) (skewed), n=30. Robustness check.",
            n_replications=5000,
            generator=lambda rng: _generate_skewed(rng, n=30),
            evaluator=_evaluate_mean,
        ),
    ]
