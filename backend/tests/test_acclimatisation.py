from app.algorithms.acclimatisation import (
    Code,
    StageAltitude,
    Status,
    check_acclimatisation,
    gain_above,
)

# Standard Everest Base Camp itinerary from data/treks.json (sleeping altitudes).
EBC = [
    (1, "Lukla", 2860, "Phakding", 2610),
    (2, "Phakding", 2610, "Namche Bazaar", 3440),
    (3, "Namche Bazaar", 3440, "Namche Bazaar", 3440),  # rest
    (4, "Namche Bazaar", 3440, "Tengboche", 3860),
    (5, "Tengboche", 3860, "Dingboche", 4410),
    (6, "Dingboche", 4410, "Dingboche", 4410),  # rest
    (7, "Dingboche", 4410, "Lobuche", 4940),
    (8, "Lobuche", 4940, "Gorak Shep", 5164),
    (9, "Gorak Shep", 5164, "Pheriche", 4371),
]


def stages(rows, skip_rest=False):
    out, day = [], 0
    for _, a, alt_a, b, alt_b in rows:
        if skip_rest and a == b:
            continue
        day += 1
        out.append(StageAltitude(day, alt_a, alt_b, is_rest_day=a == b, from_name=a))
    return out


def test_gain_above_only_counts_the_part_above_3000():
    assert gain_above(3000, 2610, 3440) == 440
    assert gain_above(3000, 3440, 3860) == 420
    assert gain_above(3000, 2000, 2900) == 0
    assert gain_above(3000, 4000, 3500) == 0  # descending


def test_standard_ebc_passes_with_cautions():
    report = check_acclimatisation(stages(EBC))
    assert report.passes
    assert report.status == Status.caution
    caution_days = [d.day for d in report.days if d.status == Status.caution]
    assert caution_days == [2, 5, 7]  # +830, +550, +530 m
    assert report.suggested_rest_days == []
    assert Code.REST_DAY in report.days[2].codes


def test_ebc_without_rest_days_is_flagged():
    report = check_acclimatisation(stages(EBC, skip_rest=True))
    assert not report.passes
    danger = [d for d in report.days if d.status == Status.danger]
    assert danger and all(Code.NEEDS_REST in d.codes for d in danger)
    # The first rest day is suggested at Tengboche, before the climb to Dingboche.
    first = report.suggested_rest_days[0]
    assert (first.place, first.altitude_m) == ("Tengboche", 3860)


def test_low_trek_is_all_ok():
    report = check_acclimatisation(
        [StageAltitude(1, 1070, 1540), StageAltitude(2, 1540, 2870), StageAltitude(3, 2870, 2630)]
    )
    assert report.status == Status.ok
    assert all(d.codes == [] for d in report.days)


def test_empty_itinerary():
    report = check_acclimatisation([])
    assert report.status == Status.ok and report.days == []
