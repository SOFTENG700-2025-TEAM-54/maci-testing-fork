#!/usr/bin/env python3
"""
stacked_area_with_stats.py

Create a stacked area chart **and** output two console tables:

1. **Process‑level statistics** – seconds per vote (slope ± SE), total time, R².
2. **Per‑run composition** – percentage of total computation each process consumes in every benchmark run.

Why two tables?
---------------
*The first table* answers “How much does this process cost *on average* as we scale vote‑count?” using an OLS fit.

*The second table* answers “In each individual run, what share of wall‑clock time did this process take?”—exactly what you just asked for.

Usage
-----
```bash
python stacked_area_with_stats.py results.json
```

The script still produces the original PNG stacked‑area plot (with the *Casting votes* layer optionally scaled to keep it readable).
"""

from __future__ import annotations

import json
import sys
from collections import OrderedDict
from pathlib import Path

from typing import List, Tuple, Dict

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy.stats import linregress
from tabulate import tabulate

# -----------------------------------------------------------------------------
# CONFIGURATION ----------------------------------------------------------------
# -----------------------------------------------------------------------------

FIELDS: "Dict[str, str]" = OrderedDict(
    [
        ("SIGN_UP", "User sign‑up"),
        ("UPDATE_POLL", "Update poll"),
        ("JOIN_POLL", "Join poll"),
        ("TOTAL_VALID_VOTES", "Casting votes"),
        ("PROCESS_MESSAGES", "Process messages"),
        ("TALLY_PROOFS", "Tally results with proof generation"),
    ]
)

# Scaling factor purely for *visual* clarity in the stackplot; raw stats are
# ALWAYS computed on unscaled data.
VOTE_LAYER_PLOT_SCALE = 0.23  # 23 % of full height so the other layers show

# -----------------------------------------------------------------------------
# I/O HELPERS ------------------------------------------------------------------
# -----------------------------------------------------------------------------


def load_results(path: Path) -> dict:
    """Load benchmark JSON file into a dict."""
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def extract_series(
    results: dict, keys: List[str]
) -> Tuple[List[int], List[List[float]]]:
    """Return x (numVotes) and one time‑series list per key in *ascending* order."""
    flat = sorted(
        ((rec["data"]["numUsers"], rec) for rec in results.values()), key=lambda t: t[0]
    )
    x = [num for num, _ in flat]
    stacks = [[rec[k] for _, rec in flat] for k in keys]
    return x, stacks


# -----------------------------------------------------------------------------
# STATS ------------------------------------------------------------------------
# -----------------------------------------------------------------------------


def regress(y: List[float], x: List[int]):
    """OLS (y = a + b·x). Returns seconds/vote slope, SE of slope, R²."""
    slope, intercept, r, p, stderr = linregress(x, y)
    return slope, stderr, r**2


def build_percent_df(
    x: List[int], stacks: List[List[float]], labels: List[str]
) -> pd.DataFrame:
    """Return DataFrame where each row corresponds to a run and cells are % of total."""
    df_time = pd.DataFrame({labels[i]: stacks[i] for i in range(len(labels))})
    df_time.insert(0, "Votes", x)
    df_pct = df_time.iloc[:, 1:].div(df_time.iloc[:, 1:].sum(axis=1), axis=0) * 100
    df_pct.insert(0, "Votes", x)
    return df_pct.round(1)


# -----------------------------------------------------------------------------
# MAIN -------------------------------------------------------------------------
# -----------------------------------------------------------------------------


def main() -> None:  # noqa: C901 – one‑shot script, cyclomatic ok
    if len(sys.argv) != 2:
        sys.exit("Usage: python stacked_area_with_stats.py <results.json>")

    json_path = Path(sys.argv[1]).expanduser()
    if not json_path.exists():
        sys.exit(f"Error: file {json_path} does not exist.")

    # ------------------------ DATA -------------------------------------------
    results = load_results(json_path)
    field_keys = list(FIELDS.keys())
    labels = list(FIELDS.values())

    x, stacks_raw = extract_series(results, field_keys)

    # ------------------------ PROCESS‑LEVEL REGRESSION -----------------------
    stats_rows = []
    for i, key in enumerate(field_keys):
        slope, se, r2 = regress(stacks_raw[i], x)
        stats_rows.append([labels[i], slope, se, sum(stacks_raw[i]), r2])

    print(
        tabulate(
            stats_rows,
            headers=["Process", "sec/vote", "±SE", "Total (s)", "R²"],
            floatfmt=("", ".4f", ".4f", ".2f", ".3f"),
        )
    )

    # ------------------------ PER‑RUN % CONTRIBUTION TABLE -------------------
    df_pct = build_percent_df(x, stacks_raw, labels)
    print("\nPercentage contribution per run (rows):")
    print(tabulate(df_pct, headers="keys", showindex=False, floatfmt=".1f"))

    # ------------------------ PLOTTING ---------------------------------------
    plot_stacks = [list(s) for s in stacks_raw]  # shallow copy
    try:
        idx_vote = field_keys.index("TOTAL_VALID_VOTES")
        plot_stacks[idx_vote] = [
            v * VOTE_LAYER_PLOT_SCALE for v in plot_stacks[idx_vote]
        ]
    except ValueError:
        pass  # key not present, ignore

    fig, ax = plt.subplots(figsize=(10, 6))
    ax.stackplot(x, plot_stacks, labels=labels)
    ax.set_title(
        "Time consumption by process\n(Note: 'Casting votes' layer scaled to"
        f" {int(VOTE_LAYER_PLOT_SCALE*100)}% for visibility)"
    )
    ax.set_xlabel("Number of votes")
    ax.set_ylabel("Time (seconds)")
    ax.legend(loc="upper left")
    fig.autofmt_xdate()

    out_png = json_path.with_name("stacked_area.png")
    plt.tight_layout()
    plt.savefig(out_png, dpi=150)
    print(f"\nSaved plot to {out_png.resolve()}")

    plt.show()


if __name__ == "__main__":
    main()
