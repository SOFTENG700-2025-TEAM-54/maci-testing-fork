#!/usr/bin/env python3
"""
stacked_area.py

Create a stacked area chart from a results‑JSON file.
Lets you rename each field for the legend.

Usage
-----
    python stacked_area.py <results.json>

Edit the FIELDS dict below to (a) choose which metrics appear and (b) give
each one a friendly legend label.
"""

import json
import sys
from pathlib import Path

import matplotlib.pyplot as plt

FIELDS = {
    "SIGN_UP": "User sign-up",
    "UPDATE_POLL": "Update poll",
    "JOIN_POLL": "Join poll",
    "TOTAL_VALID_VOTES": "Casting votes",
    "PROCESS_MESSAGES": "Process messages",
    "TALLY_PROOFS": "Tallying results with proof generation",
}


def load_results(path: Path):
    """Load and return the parsed JSON dict."""
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def extract_series(results: dict, field_keys):
    """
    Return:
        x      : list[int]    – number of users
        stacks : list[list]   – each inner list holds series data for a field
    Data are ordered by ascending numUsers.
    """
    flat = [(rec["data"]["numUsers"], rec) for rec in results.values()]
    flat.sort(key=lambda t: t[0])  # sort by numUsers

    x = [num for num, _ in flat]
    stacks = [[rec[k] for _, rec in flat] for k in field_keys]
    return x, stacks


def main():
    if len(sys.argv) != 2:
        print("Usage: python stacked_area.py <results.json>")
        sys.exit(1)

    json_path = Path(sys.argv[1])
    if not json_path.exists():
        print(f"Error: file {json_path} does not exist.")
        sys.exit(1)

    results = load_results(json_path)

    field_keys = list(FIELDS.keys())
    labels = list(FIELDS.values())

    x, stacks = extract_series(results, field_keys)

    # ‑‑‑‑‑ plotting ‑‑‑‑‑
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.stackplot(x, stacks, labels=labels)
    ax.set_title("Time consumption by process")
    ax.set_xlabel("Number of votes")
    ax.set_ylabel("Time (seconds)")
    ax.legend(loc="upper left")

    ax.tick_params(axis="x", rotation=45)

    out_png = json_path.with_name("stacked_area.png")
    plt.tight_layout()
    plt.savefig(out_png, dpi=150)
    print(f"Saved plot to {out_png.resolve()}")
    plt.show()


if __name__ == "__main__":
    main()
