#!/usr/bin/env python3
"""Simulation scenarios for ANOVA validation."""

import numpy as np
from scipy import stats
from .base import Scenario


def _generate_k_groups(rng, k=3, n_per=30, mus=None, sigma=1):
    if mus is None:
        mus = [0] * k
    groups = {}
    for i in range(k):
        groups[f'group_{i+1}'] = rng.normal(mus[i], sigma, n_per).tolist()
    truth = {'truth': 0 if all(m == mus[0] for m in mus) else max(mus) - min(mus)}
    return groups, truth


def _evaluate_oneway_anova(data, ground_truth):
    arrays = [np.array(v) for v in data.values()]
    f_stat, p_value = stats.f_oneway(*arrays)
    grand_mean = np.mean(np.concatenate(arrays))
    return {
        'estimate': float(f_stat),
        'p_value': float(p_value),
        'ci_low': 0,
        'ci_high': float(f_stat * 2),
    }


def _evaluate_kruskal(data, ground_truth):
    arrays = [np.array(v) for v in data.values()]
    h_stat, p_value = stats.kruskal(*arrays)
    return {
        'estimate': float(h_stat),
        'p_value': float(p_value),
        'ci_low': 0,
        'ci_high': float(h_stat * 2),
    }


def get_scenarios(method_name: str) -> list:
    if method_name == 'one_way_anova':
        return [
            Scenario(
                name="anova_null_3groups",
                description="Null: 3 groups N(0,1) n=30 each. Type I error.",
                n_replications=10000,
                generator=lambda rng: _generate_k_groups(rng, k=3, n_per=30, mus=[0, 0, 0]),
                evaluator=_evaluate_oneway_anova,
            ),
            Scenario(
                name="anova_alt_medium",
                description="Alternative: 3 groups mu=[0, 0.5, 1.0] n=30. Power check.",
                n_replications=5000,
                generator=lambda rng: _generate_k_groups(rng, k=3, n_per=30, mus=[0, 0.5, 1.0]),
                evaluator=_evaluate_oneway_anova,
            ),
            Scenario(
                name="anova_null_5groups",
                description="Null: 5 groups N(0,1) n=20 each. Type I with more groups.",
                n_replications=5000,
                generator=lambda rng: _generate_k_groups(rng, k=5, n_per=20, mus=[0]*5),
                evaluator=_evaluate_oneway_anova,
            ),
        ]
    elif method_name == 'kruskal_wallis':
        return [
            Scenario(
                name="kruskal_null",
                description="Null: 3 groups N(0,1) n=20. Type I for Kruskal-Wallis.",
                n_replications=10000,
                generator=lambda rng: _generate_k_groups(rng, k=3, n_per=20, mus=[0, 0, 0]),
                evaluator=_evaluate_kruskal,
            ),
        ]
    return []
