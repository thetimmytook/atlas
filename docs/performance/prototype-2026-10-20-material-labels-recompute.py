"""Recompute this saved capture with Python's standard library, independently of JS runner."""

import collections
import csv
import math
from pathlib import Path
import statistics

PREFIX = Path(__file__).with_name(Path(__file__).name.removesuffix("-recompute.py"))
KEY_FIELDS = ("phase", "roots", "profile", "scenario", "metric", "unit")

for phase, repetitions in (("timing", 20), ("instrument", 3)):
    with open(f"{PREFIX}-{phase}.csv", newline="") as stream:
        rows = list(csv.DictReader(stream))
    with open(f"{PREFIX}-{phase}-summary.csv", newline="") as stream:
        summaries = list(csv.DictReader(stream))
    groups = collections.defaultdict(list)
    identities = set()
    for row in rows:
        assert row["phase"] == phase
        assert row["profile"] in ("control", "materials-labels")
        assert row["roots"] in ("3000", "5000")
        assert 0 <= int(row["repeat"]) < repetitions
        value = float(row["value"])
        assert math.isfinite(value) and value >= 0
        key = tuple(row[field] for field in KEY_FIELDS)
        identity = key + (row["repeat"], row["sample"])
        assert identity not in identities, identity
        identities.add(identity)
        groups[key].append(row)
    assert len(groups) == len(summaries)
    summary_keys = set()
    for summary in summaries:
        key = tuple(summary[field] for field in KEY_FIELDS)
        assert key not in summary_keys, key
        summary_keys.add(key)
        group = groups[key]
        values = sorted(float(row["value"]) for row in group)
        actual = {
            "median": statistics.median(values),
            "p95": values[math.ceil(len(values) * 0.95) - 1],
            "max": max(values),
            "sample_count": len(values),
            "repeat_count": len({row["repeat"] for row in group}),
        }
        assert actual["repeat_count"] == repetitions
        for field, expected in actual.items():
            assert math.isclose(
                float(summary[field]), expected, rel_tol=1e-12, abs_tol=1e-9
            ), (key, field, summary[field], expected)
    assert summary_keys == set(groups)
    print(f"{phase}: {len(rows)} raw rows, {len(groups)} groups; all statistics match")
