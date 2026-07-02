from __future__ import annotations

from app.models.aesthetic import (
    PROMPT_PAIRS,
    PROMPT_WEIGHTS,
    _assemble_batch_score,
    _clip_prompt_pair_score,
    _sigmoid_normalize,
    _weighted_prompt_pair_score,
)


def test_sigmoid_normalize_center_maps_to_half():
    assert _sigmoid_normalize(5.5) == 0.5


def test_sigmoid_normalize_high_near_one():
    s = _sigmoid_normalize(8.0)
    assert 0.9 < s < 1.0


def test_sigmoid_normalize_low_near_zero():
    s = _sigmoid_normalize(2.0)
    assert 0.0 < s < 0.1


def test_sigmoid_normalize_clamps_overflow():
    assert _sigmoid_normalize(1000.0) == 1.0
    assert _sigmoid_normalize(-1000.0) == 0.0


def test_sigmoid_normalize_uses_center_param():
    # center=6.0: raw=6.0 → 0.5
    assert _sigmoid_normalize(6.0, center=6.0) == 0.5


def test_clip_prompt_pair_equal_sims_is_half():
    assert abs(_clip_prompt_pair_score(0.3, 0.3) - 0.5) < 1e-9


def test_clip_prompt_pair_good_higher_approaches_one():
    # extreme cosine sims (valid range [-1, 1]): 0.8 vs -0.8
    s = _clip_prompt_pair_score(0.8, -0.8)
    assert s > 0.99


def test_clip_prompt_pair_bad_higher_approaches_zero():
    s = _clip_prompt_pair_score(-0.8, 0.8)
    assert s < 0.01


def test_prompt_pairs_and_weights_length_match():
    assert len(PROMPT_PAIRS) == len(PROMPT_WEIGHTS)
    assert len(PROMPT_PAIRS) >= 3
    assert abs(sum(PROMPT_WEIGHTS) - 1.0) < 1e-9


def test_weighted_prompt_pair_score_uses_weights():
    # good/bad cosine sims per pair; expected = sum(w_i * softmax_pair_i)
    pairs = [(0.5, 0.1), (0.4, 0.15), (0.3, 0.2)]
    expected = sum(
        PROMPT_WEIGHTS[i] * _clip_prompt_pair_score(*pairs[i]) for i in range(len(pairs))
    )
    score = _weighted_prompt_pair_score(pairs)
    assert abs(score - expected) < 1e-9
    assert 0.0 <= score <= 1.0


def test_weighted_prompt_pair_score_clamps_to_unit():
    # extreme good sims → near 1
    pairs = [(0.9, -0.9)] * len(PROMPT_PAIRS)
    assert _weighted_prompt_pair_score(pairs) <= 1.0


def test_assemble_batch_score_isolates_failures():
    items = [{"id": "a"}, {"id": "b"}, {"id": "c"}]
    valid = [
        (0, {"score": _sigmoid_normalize(7.0), "raw": 7.0, "model": "laion"}),
        (2, {"score": _sigmoid_normalize(3.0), "raw": 3.0, "model": "laion"}),
    ]
    result = _assemble_batch_score(items, valid, "laion")
    assert result["scored"] == 2
    by_id = {r["id"]: r for r in result["results"]}
    assert by_id["a"]["score"] == _sigmoid_normalize(7.0)
    assert by_id["a"]["model"] == "laion"
    assert by_id["a"]["raw"] == 7.0
    assert by_id["b"]["score"] is None
    assert by_id["b"]["raw"] is None
    assert by_id["b"]["error"] is not None
    assert by_id["b"]["model"] == "laion"
    assert by_id["c"]["raw"] == 3.0


def test_assemble_batch_score_empty_valid_all_failed():
    items = [{"id": "a"}, {"id": "b"}]
    result = _assemble_batch_score(items, [], "clip")
    assert result["scored"] == 0
    assert all(r["score"] is None for r in result["results"])
    assert all(r["error"] is not None for r in result["results"])
    assert all(r["model"] == "clip" for r in result["results"])


def test_assemble_batch_score_empty_items_returns_empty():
    result = _assemble_batch_score([], [], "laion")
    assert result["scored"] == 0
    assert result["results"] == []
