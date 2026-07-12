from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.models import clip, ram


class _FakeClip:
    def embed_image(self, image_path):
        return [0.1, 0.2, 0.3]


class _FakeRam:
    def generate_tags(self, image_path, threshold=0.0):
        return [{"tag": "sunset", "score": 0.9, "category": "scene"}]


def test_batch_tag_endpoint_embeds_and_tags():
    with patch.object(clip, "get_clip", return_value=_FakeClip()), patch.object(
        ram, "get_ram", return_value=_FakeRam()
    ):
        client = TestClient(app)
        res = client.post(
            "/batch-tag",
            json={
                "items": [{"id": "a", "filePath": "/tmp/a.jpg"}, {"id": "b", "filePath": "/tmp/b.jpg"}],
                "variant": "standard",
                "tagThreshold": 0.1,
                "batchSize": 2,
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["tagged"] == 2
        assert len(body["results"]) == 2
        assert body["results"][0]["tags"] == ["sunset"]
        assert body["results"][0]["embedding"] == [0.1, 0.2, 0.3]


def test_batch_tag_isolates_failures():
    class _FailingClip:
        def embed_image(self, image_path):
            raise RuntimeError("read fail")

    with patch.object(clip, "get_clip", return_value=_FailingClip()), patch.object(
        ram, "get_ram", return_value=_FakeRam()
    ):
        client = TestClient(app)
        res = client.post(
            "/batch-tag",
            json={"items": [{"id": "a", "filePath": "/tmp/a.jpg"}], "variant": "standard"},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["results"][0]["embedding"] is None
        assert body["results"][0]["error"] is not None
