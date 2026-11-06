import numpy as np
import pytest
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier

from app.ml import dataset
from app.ml.features import FEATURES, LABELS, Sample, encode
from app.ml.forest import RandomForest
from app.ml.metrics import evaluate, stratified_folds, stratified_split
from app.ml.reasons import explain
from app.ml.train import load_dataset
from app.ml.tree import Condition, DecisionTree, best_split, gini


# ------------------------------------------------------------------- gini / tree
def test_gini():
    assert gini(["a", "a", "b", "b"]) == 0.5
    assert gini(["a", "a", "a"]) == 0
    assert gini([]) == 0
    assert gini([0, 1, 2]) == pytest.approx(2 / 3)


def test_best_split_uses_midpoint_with_largest_gain():
    X = np.array([[1.0], [2.0], [10.0], [11.0]])
    y = np.array([0, 0, 1, 1])
    split = best_split(X, y, 2, [0])
    assert split.threshold == 6.0
    assert split.gain == pytest.approx(0.5)


def test_tree_learns_tiny_dataset_perfectly():
    # label = 1 when altitude > 4000 OR (beginner AND winter)
    X = np.array(
        [[3000, 0, 0], [3500, 1, 0], [4500, 0, 0], [5000, 1, 1], [3200, 1, 1], [3300, 0, 1]],
        dtype=float,
    )
    y = np.array([0, 0, 1, 1, 1, 0])
    tree = DecisionTree(max_depth=5, min_samples_split=2).fit(X, y)
    assert (tree.predict(X) == y).all()
    assert tree.predict_proba(X).max(axis=1).tolist() == [1.0] * 6
    path = tree.decision_path(X[4])
    assert all(isinstance(c, Condition) and c.holds(X[4]) for c in path)
    assert tree.feature_importances_.sum() == pytest.approx(1.0)


def test_tree_respects_max_depth():
    rng = np.random.default_rng(0)
    X, y = rng.random((200, 4)), rng.integers(0, 3, 200)
    assert DecisionTree(max_depth=3).fit(X, y).depth <= 3


# ------------------------------------------------------------------------ forest
def test_forest_same_seed_same_result():
    rng = np.random.default_rng(1)
    X, y = rng.random((150, 5)), rng.integers(0, 3, 150)
    a = RandomForest(n_trees=10, random_state=7).fit(X, y)
    b = RandomForest(n_trees=10, random_state=7).fit(X, y)
    assert (a.predict_proba(X) == b.predict_proba(X)).all()
    proba = a.predict_proba(X)
    assert np.allclose(proba.sum(axis=1), 1.0)  # vote shares


def test_forest_explanation_comes_from_winning_trees():
    X = np.array([[0.0], [1.0], [2.0], [3.0]] * 10)
    y = np.array([0, 0, 1, 1] * 10)
    forest = RandomForest(n_trees=5, random_state=0).fit(X, y)
    paths = forest.winning_paths(np.array([[3.0]]))
    assert len(paths) == 5
    assert all(c.holds([3.0]) for path in paths for c in path)


# ----------------------------------------------------------------------- metrics
def test_metrics():
    r = evaluate(np.array([0, 0, 1, 1]), np.array([0, 1, 1, 1]), 2)
    assert r.accuracy == 0.75
    assert r.confusion == [[1, 1], [0, 2]]
    assert r.precision == [1.0, pytest.approx(0.6667)]
    assert r.recall == [0.5, 1.0]


def test_stratified_split_and_folds_keep_class_shares():
    y = np.array([0] * 50 + [1] * 30 + [2] * 20)
    train, test = stratified_split(y, 0.2, seed=3)
    assert len(test) == 20 and set(train).isdisjoint(test)
    assert np.bincount(y[test]).tolist() == [10, 6, 4]
    folds = stratified_folds(y, 5)
    assert sorted(np.concatenate(folds).tolist()) == list(range(100))
    assert all(np.bincount(y[f]).tolist() == [10, 6, 4] for f in folds)


# ----------------------------------------------------------------------- dataset
@pytest.fixture(scope="module")
def treks():
    return {t.code: t for t in dataset.load_treks()}


def test_rule_reproduces_agency_labels(treks):
    for t in treks.values():
        s = dataset.sample_for(t, 10, 30, "medium", "beginner", False)
        assert dataset.rule_label(s, t.max_sleep_altitude_m > 5000) == t.base_difficulty, t.code


def test_rule_demo_cases(treks):
    ebc = treks["everest-base-camp"]
    beginner_january = dataset.sample_for(ebc, 1, 30, "medium", "none", False)
    expert_october = dataset.sample_for(ebc, 10, 30, "high", "experienced", False)
    assert dataset.rule_label(beginner_january, True) == "risky"
    assert dataset.rule_label(expert_october, True) == "hard"


def test_generated_dataset_is_balanced():
    rows = dataset.build(seed=1)
    assert 400 <= len(rows) <= 650
    shares = [sum(r["label"] == label for r in rows) / len(rows) for label in LABELS]
    assert min(shares) >= 0.15


def test_survey_labelling_rule():
    assert dataset.survey_label("Hard", "None", "Yes") == "hard"
    assert dataset.survey_label("Moderate", "Severe (had to descend)", "Yes") == "risky"
    assert dataset.survey_label("Easy", "None", "Turned back") == "risky"
    assert dataset.survey_label("Easy", "Strong (had to rest)", "Yes") == "moderate"


# ------------------------------------------------------------- vs scikit-learn
def test_accuracy_close_to_scikit_learn(db):
    data = load_dataset(db)
    train, test = stratified_split(data.y, 0.2, 42)
    Xtr, ytr, Xte, yte = data.X[train], data.y[train], data.X[test], data.y[test]

    ours = (DecisionTree(max_depth=8).fit(Xtr, ytr).predict(Xte) == yte).mean()
    theirs = DecisionTreeClassifier(max_depth=8, random_state=0).fit(Xtr, ytr).score(Xte, yte)
    assert abs(ours - theirs) <= 0.06

    # Forests are random: compare the average over three seeds.
    ours, theirs = [], []
    for seed in range(3):
        forest = RandomForest(n_trees=50, random_state=seed).fit(Xtr, ytr)
        ours.append((forest.predict(Xte) == yte).mean())
        rf = RandomForestClassifier(n_estimators=50, max_depth=8, max_features=3, random_state=seed)
        theirs.append(rf.fit(Xtr, ytr).score(Xte, yte))
    assert abs(np.mean(ours) - np.mean(theirs)) <= 0.05


# ----------------------------------------------------------------------- reasons
def _sample(**kw):
    base = dict(
        max_altitude_m=5644, max_daily_gain_m=830, total_days=11, distance_per_day_km=11.2,
        month=1, age=30, fitness_level="medium", trek_experience="none", has_health_issue=False,
    )  # fmt: skip
    return Sample(**{**base, **kw})


def cond(feature, op, threshold):
    return Condition(FEATURES.index(feature), op, threshold)


def test_reasons_only_true_and_risk_side():
    s = _sample()
    paths = [
        [cond("trek_experience", "<=", 0.5), cond("winter", ">", 0.5)],
        [cond("winter", ">", 0.5), cond("max_altitude_m", ">", 5300)],
        [cond("fitness_level", "<=", 0.5)],  # user is medium: LOW_FITNESS is not true
        [cond("max_daily_gain_m", "<=", 900)],  # safe side: not a reason
    ]
    reasons = explain(paths, s, "risky", {"gain_day": 2})
    assert [r.code for r in reasons] == ["WINTER_MONTH", "HIGH_ALTITUDE", "NO_EXPERIENCE"]
    assert reasons[1].params == {"altitude": 5644}


def test_easy_has_no_risk_reasons():
    assert explain([[cond("winter", ">", 0.5)]], _sample(), "easy") == []


def test_encode_turns_month_into_season_flags():
    x = encode(_sample(month=7))
    assert x[FEATURES.index("winter")] == 0 and x[FEATURES.index("monsoon")] == 1
    assert len(x) == len(FEATURES) == 10
