#!/usr/bin/env python3
"""
ratio_analysis.py

Quantify and visualise the constancy of

    R = TOTAL_VALID_VOTES / (PREPARING_VALID_VOTES + TOTAL_VALID_VOTES)

across different user‑counts.

Outputs
-------
* A PNG line‑plot  (same folder as the JSON).
* Console summary with:
    – mean ± 95 % CI
    – std. dev., standard error
    – linear‑regression slope, p‑value, R²
    – Pearson correlation and p‑value

Requires
--------
numpy, scipy, matplotlib  (pip install if needed)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import matplotlib.pyplot as plt
from scipy import stats


# ---------------------------------------------------------------------------


def load_results(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def compute_ratios(results: dict):
    """Return sorted (numUsers, ratio) lists; NaNs removed."""
    pairs = []
    for rec in results.values():
        n_users = rec["data"]["numUsers"]
        tv = rec["TOTAL_VALID_VOTES"]
        pv = rec.get("PREPARING_VALID_VOTES", 0.0)
        denom = pv + tv
        ratio = tv / denom if denom else np.nan
        pairs.append((n_users, ratio))

    # sort by numUsers and strip NaNs
    pairs.sort(key=lambda t: t[0])
    clean = [(n, r) for n, r in pairs if not np.isnan(r)]
    if not clean:
        raise ValueError("All ratios are NaN – check your JSON keys.")
    num_users, ratios = zip(*clean)
    return np.array(num_users, dtype=float), np.array(ratios, dtype=float)


def descriptive_stats(ratios: np.ndarray):
    mean = ratios.mean()
    std = ratios.std(ddof=1)
    n = ratios.size
    se = std / np.sqrt(n)
    t95 = stats.t.ppf(0.975, n - 1)
    ci = (mean - t95 * se, mean + t95 * se)
    return mean, std, se, ci


def regression(num_users: np.ndarray, ratios: np.ndarray):
    slope, intercept, r_val, p_val, std_err = stats.linregress(num_users, ratios)
    return slope, intercept, r_val**2, p_val, std_err


def print_summary(ratios, mean, std, se, ci, slope, r2, p_slope, pearson_r, pearson_p):
    print("\n----- Constant‑ratio analysis ----------------------------------")
    print(f"n                         : {len(ratios)}")
    print(f"mean(R)                   : {mean:.6f}")
    print(f"std dev                   : {std:.6f}")
    print(f"standard error            : {se:.6f}")
    print(f"95 % CI for mean          : [{ci[0]:.6f}, {ci[1]:.6f}]")
    print()
    print("Linear regression R ~ numUsers")
    print(f"    slope                 : {slope:.6e}")
    print(f"    R²                    : {r2:.6f}")
    print(f"    p‑value (slope=0)     : {p_slope:.4f}")
    print()
    print("Pearson correlation")
    print(f"    r                     : {pearson_r:.6f}")
    print(f"    p‑value               : {pearson_p:.4f}")
    print("----------------------------------------------------------------\n")


def plot(num_users: np.ndarray, ratios: np.ndarray, out_png: Path):
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.plot(num_users, ratios, marker="o")
    ax.set_title("R = TOTAL_VALID_VOTES / (PREPARING_VALID_VOTES + TOTAL_VALID_VOTES)")
    ax.set_xlabel("Number of users")
    ax.set_ylabel("R")
    ax.set_ylim(0, 1)
    ax.grid(True, linestyle="--", linewidth=0.3)
    plt.tight_layout()
    plt.savefig(out_png, dpi=150)
    print(f"Saved plot to {out_png.resolve()}")
    # comment out the next line if running headless / CI
    plt.show()


# ---------------------------------------------------------------------------


def main():
    if len(sys.argv) != 2:
        print("Usage: python ratio_analysis.py <results.json>")
        sys.exit(1)

    json_path = Path(sys.argv[1])
    if not json_path.is_file():
        print(f"Error: {json_path} not found.")
        sys.exit(1)

    results = load_results(json_path)
    num_users, ratios = compute_ratios(results)

    # stats
    mean, std, se, ci = descriptive_stats(ratios)
    slope, intercept, r2, p_slope, stderr = regression(num_users, ratios)
    pearson_r, pearson_p = stats.pearsonr(num_users, ratios)

    print_summary(ratios, mean, std, se, ci, slope, r2, p_slope, pearson_r, pearson_p)

    # plot
    out_png = json_path.with_name("valid_vote_ratio.png")
    plot(num_users, ratios, out_png)


if __name__ == "__main__":
    main()
