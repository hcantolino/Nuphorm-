#!/usr/bin/env python3
"""Simulation scenarios for t-test validation."""

import numpy as np
from scipy import stats
from .base import Scenario


def _generate_two_sample(rng, n1=30, n2=30, mu1=0, mu2=0, sigma=1):
    g1 = rng.normal(mu1, sigma, n1)
    g2 = rng.normal(mu2, sigma, n2)
    data = {'group1': g1.tolist(), 'group2': g2.tolist()}
    truth = {'truth': mu1 - mu2}
    return data, truth


def _evaluate_welch(data, ground_truth):
    g1 = np.array(data['group1'])
    g2 = np.array(data['group2'])
    t_stat, p_value = stats.ttest_ind(g1, g2, equal_var=False)
    diff = np.mean(g1) - np.mean(g2)
    se = np.sqrt(np.var(g1, ddof=1) / len(g1) + np.var(g2, ddof=1) / len(g2))
    df = ((np.var(g1, ddof=1) / len(g1) + np.var(g2, ddof=1) / len(g2)) ** 2 /
          ((np.var(g1, ddof=1) / len(g1)) ** 2 / (len(g1) - 1) +
           (np.var(g2, ddof=1) / len(g2)) ** 2 / (len(g2) - 1)))
    t_crit = stats.t.ppf(0.975, df)
    return {
        'estimate': float(diff),
        'p_value': float(p_value),
        'ci_low': float(diff - t_crit * se),
        'ci_high': float(diff + t_crit * se),
    }


def _generate_paired(rng, n=30, mu_diff=0, sigma_diff=1):
    pre = rng.normal(50, 10, n)
    post = pre + rng.normal(mu_diff, sigma_diff, n)
    return {'pre': pre.tolist(), 'post': post.tolist()}, {'truth': mu_diff}


def _evaluate_paired(data, ground_truth):
    pre = np.array(data['pre'])
    post = np.array(data['post'])
    diffs = post - pre
    t_stat, p_value = stats.ttest_rel(post, pre)
    mean_diff = np.mean(diffs)
    se = np.std(diffs, ddof=1) / np.sqrt(len(diffs))
    t_crit = stats.t.ppf(0.975, len(diffs) - 1)
    return {
        'estimate': float(mean_diff),
        'p_value': float(p_value),
        'ci_low': float(mean_diff - t_crit * se),
        'ci_high': float(mean_diff + t_crit * se),
    }


def _evaluate_mann_whitney(data, ground_truth):
    g1 = np.array(data['group1'])
    g2 = np.array(data['group2'])
    u_stat, p_value = stats.mannwhitneyu(g1, g2, alternative='two-sided')
    diff = np.median(g1) - np.median(g2)
    return {
        'estimate': float(diff),
        'p_value': float(p_value),
        'ci_low': float(diff - 999),
        'ci_high': float(diff + 999),
    }


def get_scenarios(method_name: str) -> list:
    scenarios = []

    if method_name in ('welch_t_test', 'unpaired_ttest'):
        scenarios = [
            Scenario(
                name="welch_null_equal_var",
                description="Null: two groups N(0,1) n=30 each. Type I error.",
                n_replications=10000,
                generator=lambda rng: _generate_two_sample(rng, n1=30, n2=30),
                evaluator=_evaluate_welch,
            ),
            Scenario(
                name="welch_null_unequal_var",
                description="Null: N(0,1) vs N(0,2) n=30. Welch robustness to unequal variance.",
                n_replications=10000,
                generator=lambda rng: (
                    {'group1': rng.normal(0, 1, 30).tolist(), 'group2': rng.normal(0, 2, 30).tolist()},
                    {'truth': 0}
                ),
                evaluator=_evaluate_welch,
            ),
            Scenario(
                name="welch_alt_d05",
                description="Alternative: d=0.5, n=30 per group. Power ~0.48.",
                n_replications=5000,
                generator=lambda rng: _generate_two_sample(rng, n1=30, n2=30, mu1=0.5),
                evaluator=_evaluate_welch,
            ),
            Scenario(
                name="welch_alt_d08",
                description="Alternative: d=0.8, n=30 per group. Power ~0.86.",
                n_replications=5000,
                generator=lambda rng: _generate_two_sample(rng, n1=30, n2=30, mu1=0.8),
                evaluator=_evaluate_welch,
            ),
            Scenario(
                name="welch_coverage_n100",
                description="Null: N(0,1) n=100 per group. 95% CI coverage.",
                n_replications=10000,
                generator=lambda rng: _generate_two_sample(rng, n1=100, n2=100),
                evaluator=_evaluate_welch,
            ),
        ]

    elif method_name == 'paired_t_test':
        scenarios = [
            Scenario(
                name="paired_null",
                description="Null: paired diff=0, n=30. Type I error.",
                n_replications=10000,
                generator=lambda rng: _generate_paired(rng, n=30, mu_diff=0),
                evaluator=_evaluate_paired,
            ),
            Scenario(
                name="paired_alt_d05",
                description="Alternative: paired diff=0.5, n=30. Power check.",
                n_replications=5000,
                generator=lambda rng: _generate_paired(rng, n=30, mu_diff=0.5),
                evaluator=_evaluate_paired,
            ),
            Scenario(
                name="paired_coverage",
                description="Null: paired diff=0, n=50. CI coverage.",
                n_replications=10000,
                generator=lambda rng: _generate_paired(rng, n=50, mu_diff=0),
                evaluator=_evaluate_paired,
            ),
        ]

    elif method_name == 'mann_whitney':
        scenarios = [
            Scenario(
                name="mw_null",
                description="Null: two groups N(0,1) n=20. Type I error for Mann-Whitney.",
                n_replications=10000,
                generator=lambda rng: _generate_two_sample(rng, n1=20, n2=20),
                evaluator=_evaluate_mann_whitney,
            ),
            Scenario(
                name="mw_alt_shift",
                description="Alternative: shift=1.0, n=20. Power of Mann-Whitney.",
                n_replications=5000,
                generator=lambda rng: _generate_two_sample(rng, n1=20, n2=20, mu1=1.0),
                evaluator=_evaluate_mann_whitney,
            ),
        ]

    return scenarios
