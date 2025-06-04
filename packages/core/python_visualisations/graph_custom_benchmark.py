import json
import sys
import matplotlib.pyplot as plt
import math


def main(json_path):
    with open(json_path, "r") as f:
        raw_data = json.load(f)

    # Parse data and group by section
    timings_by_section = {}
    user_counts = []

    for label, entry in raw_data.items():
        num_users = entry["data"]["numUsers"]
        if entry["data"]["numInvalidVotes"] > 0:
            raise NotImplementedError(
                "Invalid votes are not supported in this visualisation."
            )
        user_counts.append(num_users)
        for section, value in entry.items():
            if section == "data":
                continue
            if section not in timings_by_section:
                timings_by_section[section] = []
            timings_by_section[section].append((num_users, value))

    # Sort values by numUsers for each section
    for section in timings_by_section:
        timings_by_section[section].sort()

    sections = list(timings_by_section.keys())
    num_sections = len(sections)
    cols = 3
    rows = math.ceil(num_sections / cols)

    fig, axes = plt.subplots(
        rows, cols, figsize=(4 * cols, 3 * rows), constrained_layout=True
    )
    axes = axes.flatten()

    for i, section in enumerate(sections):
        xs, ys = zip(*timings_by_section[section])
        ax = axes[i]

        # Check for significant change
        if max(ys) - min(ys) < 1e-3:
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
        else:
            ax.plot(xs, ys, marker="o", linewidth=1)
            ax.set_title(section, fontsize=9)
            ax.set_xlabel("Users", fontsize=8)
            ax.set_ylabel("Time (s)", fontsize=8)
            ax.tick_params(axis="both", labelsize=7)
            ax.grid(True, linewidth=0.3)

    # Hide unused subplots
    for j in range(i + 1, len(axes)):
        axes[j].set_visible(False)

    plt.show()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python plot_timings.py path_to_data.json")
    else:
        main(sys.argv[1])
