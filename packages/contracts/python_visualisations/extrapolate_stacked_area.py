#!/usr/bin/env python3
"""
extrapolate_results.py   – linear edition

Extend the timing results in <results.json> so that every metric
is estimated up to MAX_USERS (default: 5 000 000).

How it works
------------
1.  Load the original results (same format as stacked_area.py expects).
2.  For each metric we perform an ordinary least‑squares fit

        y ≈ m · x + c

    and use that straight line to predict timings for larger user counts.

3.  Generate evenly **linearly** spaced user counts (default 10 points).

4.  Splice the synthetic records back into the JSON and write
    <results_extrapolated.json> beside your input file.

Usage
-----
    python extrapolate_results.py results.json
    python extrapolate_results.py results.json --max 1e6 --points 20
    python extrapolate_results.py -h
"""
import argparse
import json
from pathlib import Path

import numpy as np

FIELDS = {
    "SIGN_UP": "User sign‑up",
    "UPDATE_POLL": "Update poll",
    "JOIN_POLL": "Join poll",
    "TOTAL_VALID_VOTES": "Casting votes (coordinator computation only)",
    "PROCESS_MESSAGES": "Process messages",
    "TALLY_PROOFS": "Tallying results with proof generation",
}


# ───────────────────────── helpers ──────────────────────────
def load_results(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def fit_linear(xs, ys):
    """Return (m, c) for y ≈ m·x + c (ordinary least‑squares)."""
    m, c = np.polyfit(xs, ys, 1)
    return float(m), float(c)


def extrapolate_metric(xs, ys, new_xs):
    m, c = fit_linear(np.array(xs), np.array(ys))
    return [m * x + c for x in new_xs]


def generate_user_points(start, stop, num=10):
    """Linearly spaced sequence covering [start, stop] inclusive."""
    return np.linspace(start, stop, num=num, dtype=int)


# ────────────────────────── main ────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("results", type=Path, help="Original results.json")
    parser.add_argument("--max", type=float, default=5_000_000, help="Upper user count")
    parser.add_argument(
        "--points", type=int, default=10, help="Number of extrapolated points"
    )
    args = parser.parse_args()

    # -------------------- load & prepare --------------------
    results = load_results(args.results)

    # Flatten and sort so we know existing user counts (xs)
    flat = sorted(
        ((rec["data"]["numUsers"], key, rec) for key, rec in results.items()),
        key=lambda t: t[0],
    )
    existing_x = [num for num, _, _ in flat]

    # New x values beyond the largest measured point
    new_xs = [
        int(x)
        for x in generate_user_points(existing_x[-1] * 1.2, args.max, args.points)
        if x > existing_x[-1]
    ]
    if not new_xs:
        print("Nothing to extrapolate – your data already go beyond that.")
        return

    # Collect y‑series for each metric
    per_field = {f: [] for f in FIELDS}
    for num, _, rec in flat:
        for f in FIELDS:
            per_field[f].append(rec[f])

    # Build synthetic records
    new_records = {}
    for x in new_xs:
        rec = {"data": {"numUsers": int(x)}}
        for f, ys in per_field.items():
            rec[f] = extrapolate_metric(existing_x, ys, [x])[0]
        new_records[f"EXTRAPOLATED_{x}"] = rec  # deterministic key

    # Merge & save
    merged = {**results, **new_records}
    out_path = args.results.with_name("results_extrapolated.json")
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2)

    print(f"✨ Done! Wrote extrapolated data to {out_path.resolve()}")


if __name__ == "__main__":
    main()
