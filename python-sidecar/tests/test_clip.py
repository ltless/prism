from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.models import clip


class _FakeClip:
    def embed_image(self, image_path: str) -> list[float]:
        return [0.1, 0.2, 0.3]

    def embed_text(self, text: str) -> list[float]:
        return [0.4, 0.5, 0.6]


def test_embed_image_returns_embedding():
    with patch.object(clip, "get_clip", return_value=_FakeClip()):
        client = TestClient(app)
        res = client.post("/embed-image", json={"filePath": "/tmp/x.jpg", "variant": "standard"})
        assert res.status_code == 200
        assert res.json()["embedding"] == [0.1, 0.2, 0.3]


def test_embed_text_returns_embedding():
    with patch.object(clip, "get_clip", return_value=_FakeClip()):
        client = TestClient(app)
        res = client.post("/embed-text", json={"text": "a sunset", "variant": "standard"})
        assert res.status_code == 200
        assert res.json()["embedding"] == [0.4, 0.5, 0.6]


def test_embed_image_missing_filepath_returns_422():
    client = TestClient(app)
    res = client.post("/embed-image", json={"variant": "standard"})
    assert res.status_code == 422
