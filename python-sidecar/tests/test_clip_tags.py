from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.models import ram


class _FakeRam:
    def generate_tags(self, image_path, threshold=0.0):
        return [
            {"tag": "sunset", "score": 0.9, "category": "scene"},
            {"tag": "sky", "score": 0.3, "category": "object"},
        ]


def test_generate_tags_endpoint_returns_tags():
    with patch.object(ram, "get_ram", return_value=_FakeRam()):
        client = TestClient(app)
        res = client.post(
            "/generate-tags",
            json={"filePath": "/tmp/x.jpg", "variant": "standard", "tagThreshold": 0.1},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["tags"][0]["tag"] == "sunset"
        assert body["tags"][0]["score"] == 0.9


def test_generate_tags_returns_empty_when_model_empty():
    class _EmptyRam:
        def generate_tags(self, image_path, threshold=0.0):
            return []

    with patch.object(ram, "get_ram", return_value=_EmptyRam()):
        client = TestClient(app)
        res = client.post("/generate-tags", json={"filePath": "/tmp/x.jpg"})
        assert res.status_code == 200
        assert res.json()["tags"] == []
