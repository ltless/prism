from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.models import clip
from app.models.clip import _softmax_top_k


def test_softmax_top_k_orders_by_score_desc():
    logits = [1.0, 3.0, 2.0, 0.5]
    candidates = ["a", "b", "c", "d"]
    result = _softmax_top_k(logits, candidates, threshold=0.0)
    assert [r["tag"] for r in result] == ["b", "c", "a", "d"]


def test_softmax_top_k_filters_below_threshold():
    logits = [5.0, 0.0]
    candidates = ["keep", "drop"]
    result = _softmax_top_k(logits, candidates, threshold=0.1)
    tags = [r["tag"] for r in result]
    assert "keep" in tags
    assert "drop" not in tags


def test_softmax_top_k_caps_at_k():
    logits = [float(i) for i in range(20)]
    candidates = [f"t{i}" for i in range(20)]
    result = _softmax_top_k(logits, candidates, threshold=0.0, k=5)
    assert len(result) == 5
    assert result[0]["tag"] == "t19"


def test_softmax_top_k_sums_to_one_above_threshold():
    logits = [1.0, 2.0, 3.0]
    candidates = ["a", "b", "c"]
    result = _softmax_top_k(logits, candidates, threshold=0.0)
    total = sum(r["score"] for r in result)
    assert abs(total - 1.0) < 1e-5


def test_generate_tags_endpoint_returns_tags():
    class _FakeSession:
        def generate_tags(self, image_path, candidates, threshold):
            return [{"tag": "sunset", "score": 0.9}, {"tag": "sky", "score": 0.3}]

    with patch.object(clip, "get_clip", return_value=_FakeSession()):
        client = TestClient(app)
        res = client.post("/generate-tags", json={"filePath": "/tmp/x.jpg", "variant": "standard", "tagThreshold": 0.1})
        assert res.status_code == 200
        body = res.json()
        assert body["tags"][0]["tag"] == "sunset"
        assert body["tags"][0]["score"] == 0.9
