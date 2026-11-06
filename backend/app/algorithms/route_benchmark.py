"""How close is nearest neighbour + 2-opt to the exact answer? (for the report)

    uv run python -m app.algorithms.route_benchmark      # writes docs/route_gap.md

For 5-8 random places in the Kathmandu valley area (200 trips each, fixed seeds) it compares
the route length of nearest neighbour, nearest neighbour + 2-opt, and brute force (exact).
"""

import random
from pathlib import Path

from app.algorithms.route import (
    brute_force,
    distance_matrix,
    nearest_neighbour,
    route_length,
    two_opt,
)

OUT = Path(__file__).resolve().parents[3] / "docs" / "route_gap.md"
TRIPS = 200


def points(n: int, seed: int) -> list[tuple[float, float]]:
    rng = random.Random(seed)
    return [(27.5 + rng.random() * 0.5, 85.1 + rng.random() * 0.6) for _ in range(n)]


def run() -> str:
    lines = [
        f"Route quality against brute force ({TRIPS} random trips per size, start fixed at the "
        "first place, straight-line km).",
        "",
        "| Places | NN: mean gap | NN + 2-opt: mean gap | NN + 2-opt: worst gap "
        "| NN + 2-opt: exact |",
        "|---|---|---|---|---|",
    ]
    for n in range(5, 9):
        nn_gaps, gaps = [], []
        for seed in range(TRIPS):
            m = distance_matrix(points(n, seed))
            nn = nearest_neighbour(m, 0)
            best = route_length(brute_force(m, start=0), m)
            nn_gaps.append(route_length(nn, m) / best - 1)
            gaps.append(route_length(two_opt(nn, m), m) / best - 1)
        exact = sum(g < 1e-9 for g in gaps) / TRIPS
        lines.append(
            f"| {n} | {sum(nn_gaps) / TRIPS:.1%} | {sum(gaps) / TRIPS:.1%} | {max(gaps):.1%} "
            f"| {exact:.0%} of trips |"
        )
    return "\n".join(lines) + "\n"


def main() -> None:
    table = run()
    OUT.write_text(table, encoding="utf-8")
    print(table)
    print(f"Saved to {OUT}")


if __name__ == "__main__":
    main()
