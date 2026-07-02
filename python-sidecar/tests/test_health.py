from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_ok_minimal():
    client = TestClient(app)
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert "device" in body
    # torch/cuda detail is in authed /gpu-status, not here
    assert "torch_version" not in body
    assert "cuda_available" not in body
    assert "onnx_providers" not in body
