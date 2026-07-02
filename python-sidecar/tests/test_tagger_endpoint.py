from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.models import tagger


def test_tag_image_endpoint_returns_tags():
    class _FakeSession:
        def tag(self, image_path: str) -> dict:
            return {"tags": [
                {"tag": "person", "score": 1.0, "category": "People"},
                {"tag": "car", "score": 1.0, "category": "Vehicles"},
            ]}

    with patch.object(tagger, "get_tagger", return_value=_FakeSession()):
        client = TestClient(app)
        res = client.post("/tag-image", json={"filePath": "/tmp/a.jpg"})
        assert res.status_code == 200
        body = res.json()
        assert len(body["tags"]) == 2
        assert body["tags"][0]["tag"] == "person"
        assert body["tags"][0]["category"] == "People"


def test_tag_image_endpoint_404_on_missing_file():
    class _FakeSession:
        def tag(self, image_path: str) -> dict:
            raise FileNotFoundError(image_path)

    with patch.object(tagger, "get_tagger", return_value=_FakeSession()):
        client = TestClient(app)
        res = client.post("/tag-image", json={"filePath": "/tmp/missing.jpg"})
        assert res.status_code == 404


def test_batch_tag_florence_endpoint_returns_results():
    class _FakeSession:
        def batch_tag(self, items: list[dict], batch_size: int) -> dict:
            return {
                "tagged": 2,
                "results": [
                    {"id": "a", "tags": ["person", "car"], "tagScores": [1.0, 1.0], "embedding": None},
                    {"id": "b", "tags": ["dog"], "tagScores": [1.0], "embedding": None},
                ],
            }

    with patch.object(tagger, "get_tagger", return_value=_FakeSession()):
        client = TestClient(app)
        res = client.post("/batch-tag-florence", json={
            "items": [{"id": "a", "filePath": "/tmp/a.jpg"}, {"id": "b", "filePath": "/tmp/b.jpg"}],
            "batchSize": 2,
        })
        assert res.status_code == 200
        body = res.json()
        assert body["tagged"] == 2
        assert body["results"][0]["tags"] == ["person", "car"]
        assert body["results"][1]["tags"] == ["dog"]


def test_batch_tag_florence_endpoint_isolates_failures():
    class _FakeSession:
        def batch_tag(self, items: list[dict], batch_size: int) -> dict:
            return {
                "tagged": 1,
                "results": [
                    {"id": "a", "tags": ["person"], "tagScores": [1.0], "embedding": None},
                    {"id": "b", "tags": [], "tagScores": [], "embedding": None, "error": "read fail"},
                ],
            }

    with patch.object(tagger, "get_tagger", return_value=_FakeSession()):
        client = TestClient(app)
        res = client.post("/batch-tag-florence", json={
            "items": [{"id": "a", "filePath": "/tmp/a.jpg"}, {"id": "b", "filePath": "/tmp/b.jpg"}],
            "batchSize": 2,
        })
        assert res.status_code == 200
        body = res.json()
        assert body["tagged"] == 1
        assert body["results"][1]["tags"] == []
        assert body["results"][1]["error"] == "read fail"
