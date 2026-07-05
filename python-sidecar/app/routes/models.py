from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from app.config import settings
from app.models import aesthetic, clip, registry
from app.models.registry import start_download

router = APIRouter()


class DownloadModelRequest(BaseModel):
    modelId: str


class LoadModelRequest(BaseModel):
    modelId: str


def load_clip_session(spec: registry.ModelSpec) -> None:
    clip.get_clip(spec.variant or "standard")


def load_aesthetic_session(spec: registry.ModelSpec) -> None:
    aesthetic.load_aesthetic()


@router.get("/model-status")
def model_status() -> dict:
    models = []
    for spec in registry.REGISTRY:
        models.append({
            "id": spec.id,
            "type": spec.type,
            "name": spec.name,
            "size": spec.size,
            "variant": spec.variant,
            "downloaded": registry.is_model_downloaded(spec),
            "loaded": registry.is_model_loaded(spec),
            "downloadState": registry.get_download_state(spec.id),
        })
    return {"models": models}


@router.post("/download-model")
def download_model(req: DownloadModelRequest, response: Response) -> dict:
    spec = registry.find_spec(req.modelId)
    if spec is None:
        raise HTTPException(status_code=404, detail=f"unknown model: {req.modelId}")
    if registry.is_model_downloaded(spec):
        response.status_code = 200
        return {"started": False, "downloaded": True, "modelId": spec.id}
    if registry.get_download_state(spec.id).get("status") == "downloading":
        response.status_code = 200
        return {"started": False, "downloaded": False, "modelId": spec.id, "alreadyDownloading": True}
    start_download(spec)
    response.status_code = 202
    return {"started": True, "downloaded": False, "modelId": spec.id}


@router.post("/load-model")
def load_model(req: LoadModelRequest) -> dict:
    spec = registry.find_spec(req.modelId)
    if spec is None:
        raise HTTPException(status_code=404, detail=f"unknown model: {req.modelId}")
    try:
        if spec.type == "embed":
            load_clip_session(spec)
        elif spec.type == "aesthetic":
            load_aesthetic_session(spec)
        else:
            raise HTTPException(status_code=400, detail=f"unsupported model type: {spec.type}")
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err)) from err
    return {"success": True, "modelId": spec.id}


@router.get("/gpu-status")
def gpu_status() -> dict:
    try:
        import torch

        return {
            "device": settings.device,
            "torchVersion": torch.__version__,
            "cudaAvailable": bool(torch.cuda.is_available()),
            "mpsAvailable": bool(getattr(torch.backends, "mps", None) and torch.backends.mps.is_available()),
        }
    except Exception as err:
        return {"device": settings.device, "error": str(err)}
