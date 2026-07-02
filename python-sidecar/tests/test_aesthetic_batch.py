from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.models import aesthetic


def test_aesthetic_score_endpoint_returns_normalized():
    class _FakeSession:
        def score(self, image_path: str) -> dict:
            return {"score": 0.82, "raw": 7.0, "model": "laion"}

    with patch.object(aesthetic, "get_aesthetic", return_value=_FakeSession()):
        client = TestClient(app)
        res = client.post("/aesthetic-score", json={"filePath": "/tmp/a.jpg", "model": "laion"})
        assert res.status_code == 200
        body = res.json()
        assert body["score"] == 0.82
        assert body["model"] == "laion"
        assert body["raw"] == 7.0


def test_aesthetic_score_endpoint_404_on_missing_file():
    class _FakeSession:
        def score(self, image_path: str) -> dict:
            raise FileNotFoundError(image_path)

    with patch.object(aesthetic, "get_aesthetic", return_value=_FakeSession()):
        client = TestClient(app)
        res = client.post("/aesthetic-score", json={"filePath": "/tmp/missing.jpg", "model": "laion"})
        assert res.status_code == 404


def test_batch_score_endpoint_returns_results():
    class _FakeSession:
        def batch_score(self, items: list[dict], batch_size: int) -> dict:
            return {
                "scored": 2,
                "results": [
                    {"id": "a", "score": 0.8, "raw": 7.0, "model": "laion"},
                    {"id": "b", "score": 0.3, "raw": 3.0, "model": "laion"},
                ],
            }

    with patch.object(aesthetic, "get_aesthetic", return_value=_FakeSession()):
        client = TestClient(app)
        res = client.post("/batch-score", json={
            "items": [{"id": "a", "filePath": "/tmp/a.jpg"}, {"id": "b", "filePath": "/tmp/b.jpg"}],
            "model": "laion",
            "batchSize": 2,
        })
        assert res.status_code == 200
        body = res.json()
        assert body["scored"] == 2
        assert body["results"][0]["score"] == 0.8
        assert body["results"][1]["score"] == 0.3


def test_batch_score_endpoint_isolates_failures():
    class _FakeSession:
        def batch_score(self, items: list[dict], batch_size: int) -> dict:
            return {
                "scored": 1,
                "results": [
                    {"id": "a", "score": 0.8, "raw": 7.0, "model": "laion"},
                    {"id": "b", "score": None, "raw": None, "model": "laion", "error": "read fail"},
                ],
            }

    with patch.object(aesthetic, "get_aesthetic", return_value=_FakeSession()):
        client = TestClient(app)
        res = client.post("/batch-score", json={
            "items": [{"id": "a", "filePath": "/tmp/a.jpg"}, {"id": "b", "filePath": "/tmp/b.jpg"}],
            "model": "laion",
            "batchSize": 2,
        })
        assert res.status_code == 200
        body = res.json()
        assert body["scored"] == 1
        assert body["results"][1]["score"] is None
        assert body["results"][1]["error"] == "read fail"


def test_load_aesthetic_model_endpoint_returns_success():
    with patch.object(aesthetic, "load_aesthetic", return_value=None):
        client = TestClient(app)
        res = client.post("/load-aesthetic-model", json={"model": "laion"})
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        assert body["model"] == "laion"


def test_load_aesthetic_model_endpoint_500_on_load_failure():
    with patch.object(aesthetic, "load_aesthetic", side_effect=RuntimeError("download missing")):
        client = TestClient(app)
        res = client.post("/load-aesthetic-model", json={"model": "laion"})
        assert res.status_code == 500
        assert "download missing" in res.json()["detail"]
