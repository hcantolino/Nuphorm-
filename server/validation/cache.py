#!/usr/bin/env python3
"""Skip re-running simulations if the compute code hasn't changed."""
import json
import os
import hashlib

RESULTS_FILE = 'server/validation/results/latest.json'


def file_hash(path: str) -> str:
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()[:16]


def should_rerun(method_name: str, compute_file_path: str) -> bool:
    """True if this method's compute code changed since last successful run."""
    if not os.path.exists(RESULTS_FILE):
        return True

    with open(RESULTS_FILE) as f:
        latest = json.load(f)

    if method_name not in latest:
        return True

    last_hash = latest[method_name].get('compute_file_hash')
    current_hash = file_hash(compute_file_path)

    if last_hash != current_hash:
        return True

    if not latest[method_name].get('overall_pass', False):
        return True

    return False
