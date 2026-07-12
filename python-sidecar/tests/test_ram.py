from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models import ram
from app.taxonomy import TAG_TO_CATEGORY

def test_map_tags_to_taxonomy_filters_unknown():
    raw = ["person", "dog", "notarealtag", "beach"]
    mapped = ram.map_tags_to_taxonomy(raw)
    tags = {m["tag"] for m in mapped}
    assert "notarealtag" not in tags
    assert "person" in tags and "dog" in tags and "beach" in tags
    for m in mapped:
        assert m["category"] == TAG_TO_CATEGORY.get(m["tag"], "Uncategorized")
        assert 0.0 <= m["score"] <= 1.0

def test_map_handles_empty():
    assert ram.map_tags_to_taxonomy([]) == []
