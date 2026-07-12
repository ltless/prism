from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.models import registry


def test_registry_lists_all_models():
    ids = [s.id for s in registry.REGISTRY]
    assert "openai/clip-vit-base-patch32" in ids
    assert "openai/clip-vit-base-patch16" in ids
    assert "openai/clip-vit-large-patch14" in ids
    assert "shunk031/aesthetics-predictor-v2-sac-logos-ava1-l14-linearMSE" in ids
    assert "xcinc/recognize-anything-plus" in ids
    assert len(registry.REGISTRY) == 5


def test_registry_specs_have_required_fields():
    for spec in registry.REGISTRY:
        assert spec.id
        assert spec.type in ("embed", "aesthetic", "tagger")
        assert spec.name
        assert isinstance(spec.allow_patterns, list) and len(spec.allow_patterns) > 0


def test_find_spec_by_id_returns_match():
    spec = registry.find_spec("shunk031/aesthetics-predictor-v2-sac-logos-ava1-l14-linearMSE")
    assert spec is not None
    assert spec.type == "aesthetic"


def test_find_spec_by_id_returns_none_for_unknown():
    assert registry.find_spec("nonsense/model") is None


def test_download_state_starts_empty_then_tracks():
    registry.clear_download_state()
    assert registry.get_download_state("any") == {"status": "idle"}
    registry.set_download_state("m/foo", status="downloading", progress=42)
    state = registry.get_download_state("m/foo")
    assert state["status"] == "downloading"
    assert state["progress"] == 42


def test_is_model_downloaded_true_when_cached():
    spec = registry.find_spec("openai/clip-vit-base-patch32")
    with patch.object(registry, "_scan_cache", return_value=True):
        assert registry.is_model_downloaded(spec) is True


def test_is_model_downloaded_false_when_missing():
    spec = registry.find_spec("openai/clip-vit-base-patch32")
    with patch.object(registry, "_scan_cache", return_value=False):
        assert registry.is_model_downloaded(spec) is False


def test_model_status_endpoint_lists_all_with_state():
    with patch.object(registry, "is_model_downloaded", return_value=True), \
         patch.object(registry, "is_model_loaded", return_value=False), \
         patch.object(registry, "get_download_state", return_value={"status": "idle"}):
        client = TestClient(app)
        res = client.get("/model-status")
        assert res.status_code == 200
        body = res.json()
        assert "models" in body
        assert len(body["models"]) == 5
        m = body["models"][0]
        assert {"id", "type", "name", "downloaded", "loaded", "downloadState"} <= set(m.keys())
        assert m["downloaded"] is True


def test_load_model_endpoint_dispatches_to_clip():
    spec = registry.find_spec("openai/clip-vit-base-patch32")
    with patch.object(registry, "find_spec", return_value=spec), \
         patch("app.routes.models.load_clip_session", return_value=None) as mock_load:
        client = TestClient(app)
        res = client.post("/load-model", json={"modelId": spec.id})
        assert res.status_code == 200
        assert res.json()["success"] is True
        mock_load.assert_called_once()


def test_load_model_endpoint_dispatches_to_aesthetic():
    spec = registry.find_spec("shunk031/aesthetics-predictor-v2-sac-logos-ava1-l14-linearMSE")
    with patch.object(registry, "find_spec", return_value=spec), \
         patch("app.routes.models.load_aesthetic_session", return_value=None) as mock_load:
        client = TestClient(app)
        res = client.post("/load-model", json={"modelId": spec.id})
        assert res.status_code == 200
        mock_load.assert_called_once()


def test_load_model_endpoint_404_for_unknown_model():
    client = TestClient(app)
    res = client.post("/load-model", json={"modelId": "nonsense/model"})
    assert res.status_code == 404


def test_download_model_endpoint_starts_background_download():
    spec = registry.find_spec("openai/clip-vit-base-patch32")
    with patch.object(registry, "find_spec", return_value=spec), \
         patch.object(registry, "is_model_downloaded", return_value=False), \
         patch("app.routes.models.start_download", return_value=None) as mock_start:
        client = TestClient(app)
        res = client.post("/download-model", json={"modelId": spec.id})
        assert res.status_code == 202
        assert res.json()["started"] is True
        mock_start.assert_called_once()


def test_download_model_endpoint_skips_if_already_downloaded():
    spec = registry.find_spec("openai/clip-vit-base-patch32")
    with patch.object(registry, "find_spec", return_value=spec), \
         patch.object(registry, "is_model_downloaded", return_value=True):
        client = TestClient(app)
        res = client.post("/download-model", json={"modelId": spec.id})
        assert res.status_code == 200
        assert res.json()["started"] is False
        assert res.json()["downloaded"] is True
