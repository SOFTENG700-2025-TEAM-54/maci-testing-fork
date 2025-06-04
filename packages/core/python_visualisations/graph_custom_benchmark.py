import json
import sys
import matplotlib.pyplot as plt
import math
from collections import defaultdict


def main(json_path):
    with open(json_path, "r") as f:
        raw_data = json.load(f)

    # Structure: timings_by_section_and_invalids[section][invalid_vote_count] = [(num_users, time), ...]
    timings_by_section_and_invalids = defaultdict(lambda: defaultdict(list))

    for label, entry in raw_data.items():
        num_users = entry["data"]["numUsers"]
        num_invalid = entry["data"].get("numInvalidVotes", 0)
        print(
            f"Processing {label} with {num_users} users and {num_invalid} invalid votes"
        )

        for section, value in entry.items():
            if section == "data":
                continue
            timings_by_section_and_invalids[section][num_invalid].append(
                (num_users, value)
            )

    # Sort values by numUsers
    for section_dict in timings_by_section_and_invalids.values():
        for vote_count in section_dict:
            section_dict[vote_count].sort()

    sections = list(timings_by_section_and_invalids.keys())
    num_sections = len(sections)
    cols = 3
    rows = math.ceil(num_sections / cols)

    fig, axes = plt.subplots(
        rows, cols, figsize=(4 * cols, 3 * rows), constrained_layout=True
    )
    axes = axes.flatten()

    for i, section in enumerate(sections):
        ax = axes[i]
        data_by_invalid = timings_by_section_and_invalids[section]

        has_significant = False
        for invalid_count, values in sorted(data_by_invalid.items()):
            xs, ys = zip(*values)
            if max(ys) - min(ys) >= 1e-3:
                has_significant = True
                label = f"{invalid_count} invalid" if invalid_count > 0 else "0 invalid"
                ax.plot(xs, ys, marker="o", linewidth=1, label=label)

        if has_significant:
            ax.set_title(section, fontsize=9)
            ax.set_xlabel("Users", fontsize=8)
            ax.set_ylabel("Time (s)", fontsize=8)
            ax.tick_params(axis="both", labelsize=7)
            ax.grid(True, linewidth=0.3)
            ax.legend(fontsize=6)
        else:
            ax.text(
                0.5,
                0.5,
                "No significant change\n(≤ 1e-3)",
                ha="center",
                va="center",
                fontsize=9,
                transform=ax.transAxes,
            )
            ax.set_title(section, fontsize=9)
            ax.set_xticks([])
            ax.set_yticks([])
            ax.set_frame_on(False)

    # Hide unused subplots
    for j in range(i + 1, len(axes)):
        axes[j].set_visible(False)

    plt.show()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python plot_timings.py path_to_data.json")
    else:
        main(sys.argv[1])
