from __future__ import annotations

from app.models.tagger import (
    _map_to_taxonomy,
    _od_labels_to_tags,
    _parse_od_labels,
)


def test_parse_od_labels_extracts_labels():
    raw = {"<OD>": {"bboxes": [[0, 0, 10, 10]], "labels": ["person", "car", "dog"]}}
    assert _parse_od_labels(raw) == ["person", "car", "dog"]


def test_parse_od_labels_missing_od_key_returns_empty():
    assert _parse_od_labels({}) == []
    assert _parse_od_labels({"<CAPTION>": "a photo"}) == []


def test_parse_od_labels_empty_labels_returns_empty():
    assert _parse_od_labels({"<OD>": {"bboxes": [], "labels": []}}) == []


def test_parse_od_labels_missing_labels_key_returns_empty():
    assert _parse_od_labels({"<OD>": {"bboxes": [[0, 0, 1, 1]]}}) == []


def test_od_labels_to_tags_dedupes_preserves_order():
    tags = _od_labels_to_tags({"<OD>": {"labels": ["person", "car", "person", "dog"]}})
    assert [t["tag"] for t in tags] == ["person", "car", "dog"]
    assert all(t["score"] == 1.0 for t in tags)


def test_od_labels_to_tags_lowercases_labels():
    tags = _od_labels_to_tags({"<OD>": {"labels": ["Person", "CAR"]}})
    assert [t["tag"] for t in tags] == ["person", "car"]


def test_od_labels_to_tags_empty_returns_empty():
    assert _od_labels_to_tags({}) == []


def test_map_to_taxonomy_assigns_known_categories():
    assert _map_to_taxonomy("person") == "People"
    assert _map_to_taxonomy("dog") == "Animals"
    assert _map_to_taxonomy("car") == "Vehicles"
    assert _map_to_taxonomy("mountain") == "Nature"
    assert _map_to_taxonomy("food") == "Food"


def test_map_to_taxonomy_unknown_label_returns_general():
    assert _map_to_taxonomy("unrecognized_widget") == "General"


def test_map_to_taxonomy_uses_existing_tag_to_category_map():
    # 'woman' is a People tag, 'bicycle' a Vehicles tag in the photo taxonomy
    assert _map_to_taxonomy("woman") == "People"
    assert _map_to_taxonomy("bicycle") == "Vehicles"
