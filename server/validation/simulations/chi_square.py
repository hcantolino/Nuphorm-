#!/usr/bin/env python3
"""Simulation scenarios for chi-square / Fisher's exact test validation."""

import numpy as np
from scipy import stats
from .base import Scenario


def _generate_2x2(rng, n=100, p1=0.5, p2=0.5):
    g1 = rng.binomial(1, p1, n // 2)
    g2 = rng.binomial(1, p2, n // 2)
    table = np.array([
        [np.sum(g1 == 0), np.sum(g1 == 1)],
        [np.sum(g2 == 0), np.sum(g2 == 1)],
    ])
    return {'table': table.tolist()}, {'truth': 0 if p1 == p2 else p1 - p2}


def _evaluate_chi2(data, ground_truth):
    table = np.array(data['table'])
    chi2, p_value, dof, expected = stats.chi2_contingency(table)
    return {
        'estimate': float(chi2),
        'p_value': float(p_value),
    }


def _evaluate_fisher(data, ground_truth):
    table = np.array(data['table'])
    res = stats.fisher_exact(table)
    return {
        'estimate': float(res.statistic),
        'p_value': float(res.pvalue),
    }


def get_scenarios(method_name: str) -> list:
    if method_name == 'chi_square':
        return [
            Scenario(
                name="chi2_null_2x2",
                description="Null: 2x2 table, equal proportions, n=100. Type I error.",
                n_replications=10000,
                generator=lambda rng: _generate_2x2(rng, n=100, p1=0.5, p2=0.5),
                evaluator=_evaluate_chi2,
            ),
            Scenario(
                name="chi2_alt_moderate",
                description="Alternative: p1=0.5 vs p2=0.7, n=100. Power check.",
                n_replications=5000,
                generator=lambda rng: _generate_2x2(rng, n=100, p1=0.5, p2=0.7),
                evaluator=_evaluate_chi2,
            ),
        ]
    elif method_name == 'fisher_exact':
        return [
            Scenario(
                name="fisher_null_small",
                description="Null: 2x2 table, equal proportions, n=30. Type I for Fisher.",
                n_replications=10000,
                generator=lambda rng: _generate_2x2(rng, n=30, p1=0.5, p2=0.5),
                evaluator=_evaluate_fisher,
            ),
        ]
    return []
