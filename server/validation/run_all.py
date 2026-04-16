#!/usr/bin/env python3
"""
Orchestrator: run simulations for all (or changed) methods.
Called by CI on every push.

Usage:
  python3 server/validation/run_all.py           # run changed only
  python3 server/validation/run_all.py --force    # run all
"""
import sys
import os
import importlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from simulations.base import validate_method, save_results
from cache import should_rerun

# The compute file used as hash source. If your stats engine changes, simulations re-run.
STATS_ENGINE = os.path.join(os.path.dirname(__file__), '..', 'statsEngine.ts')
FALLBACK_COMPUTE = os.path.join(os.path.dirname(__file__), 'simulations', 'base.py')

METHOD_REGISTRY = {
    'descriptive_summary': 'simulations.descriptive',
    'welch_t_test':        'simulations.t_tests',
    'unpaired_ttest':      'simulations.t_tests',
    'paired_t_test':       'simulations.t_tests',
    'mann_whitney':         'simulations.t_tests',
    'one_way_anova':       'simulations.anova',
    'kruskal_wallis':      'simulations.anova',
    'chi_square':          'simulations.chi_square',
    'fisher_exact':        'simulations.chi_square',
}


def main(force: bool = False):
    compute_path = STATS_ENGINE if os.path.exists(STATS_ENGINE) else FALLBACK_COMPUTE
    exit_code = 0
    ran = []
    skipped = []
    failed = []

    for method_name, scenario_module_name in METHOD_REGISTRY.items():
        if not force and not should_rerun(method_name, compute_path):
            print(f"SKIP {method_name}: compute code unchanged, last run passed")
            skipped.append(method_name)
            continue

        print(f"\n{'='*50}")
        print(f"Validating: {method_name}")
        print(f"{'='*50}")

        module = importlib.import_module(scenario_module_name)
        scenarios = module.get_scenarios(method_name)

        if not scenarios:
            print(f"  No scenarios defined for {method_name}, skipping")
            skipped.append(method_name)
            continue

        result = validate_method(method_name, scenarios, compute_path)
        save_results(result)
        ran.append(method_name)

        if not result.overall_pass:
            print(f"\n  FAILED {method_name}")
            failed.append(method_name)
            exit_code = 1
        else:
            print(f"\n  PASSED {method_name}")

    print(f"\n\n{'='*50}")
    print(f"SUMMARY")
    print(f"{'='*50}")
    print(f"Ran:     {len(ran)} — {', '.join(ran) if ran else 'none'}")
    print(f"Skipped: {len(skipped)} — {', '.join(skipped) if skipped else 'none'}")
    print(f"Failed:  {len(failed)} — {', '.join(failed) if failed else 'none'}")
    print(f"Result:  {'ALL PASSED' if exit_code == 0 else 'FAILURES DETECTED'}")

    sys.exit(exit_code)


if __name__ == '__main__':
    force = '--force' in sys.argv
    main(force=force)
