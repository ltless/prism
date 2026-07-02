from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.models import clip


class _FakeClip:
    def embed_image(self, image_path: str) -> list[float]:
        return [0.1, 0.2, 0.3]

    def embed_text(self, text: str) -> list[float]:
        return [0.4, 0.5, 0.6]


def test_pathguard_rejects_traversal():
    with patch.object(clip, "get_clip", return_value=_FakeClip()):
        client = TestClient(app)
        res = client.post("/embed-image", json={"filePath": "../../../etc/passwd", "variant": "standard"})
        assert res.status_code == 403


def test_pathguard_rejects_absolute_outside_root():
    with patch.object(clip, "get_clip", return_value=_FakeClip()):
        client = TestClient(app)
        res = client.post("/embed-image", json={"filePath": "/etc/passwd", "variant": "standard"})
        assert res.status_code == 403


def test_pathguard_allows_within_root(monkeypatch):
    # /tmp is the media root in tests (see conftest)
    with patch.object(clip, "get_clip", return_value=_FakeClip()):
        client = TestClient(app)
        res = client.post("/embed-image", json={"filePath": "/tmp/x.jpg", "variant": "standard"})
        # _FakeClip ignores the path, so 200 as long as pathguard passes
        assert res.status_code == 200


def test_auth_disabled_when_key_unset():
    # Default test state: SIDECAR_KEY unset → auth disabled
    assert settings.sidecar_key is None
    client = TestClient(app)
    res = client.get("/model-status")
    # 200 (or 502 if sidecar down) — but NOT 401
    assert res.status_code != 401


def test_auth_rejects_without_header(monkeypatch):
    monkeypatch.setattr(settings, "sidecar_key", "secret-key")
    client = TestClient(app)
    res = client.get("/model-status")
    assert res.status_code == 401


def test_auth_rejects_wrong_key(monkeypatch):
    monkeypatch.setattr(settings, "sidecar_key", "secret-key")
    client = TestClient(app)
    res = client.get("/model-status", headers={"x-sidecar-key": "wrong"})
    assert res.status_code == 401


def test_auth_accepts_correct_key(monkeypatch):
    monkeypatch.setattr(settings, "sidecar_key", "secret-key")
    client = TestClient(app)
    res = client.get("/model-status", headers={"x-sidecar-key": "secret-key"})
    assert res.status_code != 401


def test_health_public_even_when_authed(monkeypatch):
    monkeypatch.setattr(settings, "sidecar_key", "secret-key")
    client = TestClient(app)
    # No auth header — /health must still return 200 (liveness probe)
    res = client.get("/health")
    assert res.status_code == 200
