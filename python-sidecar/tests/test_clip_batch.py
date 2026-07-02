from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.models import clip
from app.models.clip import _assemble_batch_result


def test_assemble_isolates_failed_read():
    items = [
        {"id": "a", "filePath": "/tmp/a.jpg"},
        {"id": "b", "filePath": "/tmp/b.jpg"},
        {"id": "c", "filePath": "/tmp/c.jpg"},
    ]
    valid = [
        (0, [0.1, 0.2], [3.0, 1.0]),
        (2, [0.3, 0.4], [1.0, 2.0]),
    ]
    result = _assemble_batch_result(items, valid, candidates=["x", "y"], threshold=0.0)
    assert result["tagged"] == 2
    by_id = {r["id"]: r for r in result["results"]}
    assert by_id["a"]["embedding"] == [0.1, 0.2]
    assert by_id["b"]["embedding"] is None
    assert by_id["b"]["tags"] == []
    assert by_id["c"]["embedding"] == [0.3, 0.4]
    assert by_id["a"]["tags"][0] == "x"
    assert by_id["c"]["tags"][0] == "y"


def test_assemble_tagged_count_excludes_nulls():
    items = [{"id": "a", "filePath": "/tmp/a.jpg"}, {"id": "b", "filePath": "/tmp/b.jpg"}]
    valid = [(0, [0.1], [2.0, 0.5])]
    result = _assemble_batch_result(items, valid, ["x", "y"], threshold=0.0)
    assert result["tagged"] == 1


def test_batch_tag_endpoint_returns_results():
    class _FakeSession:
        def batch_tag(self, items, candidates, threshold, batch_size):
            return {
                "tagged": 1,
                "results": [
                    {"id": "a", "tags": ["sunset"], "tagScores": [0.9], "embedding": [0.1, 0.2]},
                    {"id": "b", "tags": [], "tagScores": [], "embedding": None},
                ],
            }

    with patch.object(clip, "get_clip", return_value=_FakeSession()):
        client = TestClient(app)
        res = client.post("/batch-tag", json={
            "items": [{"id": "a", "filePath": "/tmp/a.jpg"}, {"id": "b", "filePath": "/tmp/b.jpg"}],
            "variant": "standard",
            "tagThreshold": 0.1,
            "batchSize": 2,
        })
        assert res.status_code == 200
        body = res.json()
        assert body["tagged"] == 1
        assert len(body["results"]) == 2
        assert body["results"][0]["tags"] == ["sunset"]
        assert body["results"][1]["embedding"] is None
