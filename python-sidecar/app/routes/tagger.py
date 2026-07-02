from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models import tagger
from app.pathguard import resolve_media_path
from app.schemas import (
    BatchTagFlorenceRequest,
    BatchTagResponse,
    TagImageRequest,
    TagImageResponse,
    TagScore,
)

router = APIRouter()


def _resolve(file_path: str) -> str:
    try:
        return resolve_media_path(file_path)
    except ValueError as err:
        raise HTTPException(status_code=403, detail=str(err)) from err


@router.post("/tag-image", response_model=TagImageResponse)
def tag_image(req: TagImageRequest) -> TagImageResponse:
    safe = _resolve(req.filePath)
    try:
        result = tagger.get_tagger().tag(safe)
    except FileNotFoundError as err:
        raise HTTPException(status_code=404, detail="image not found") from err
    except RuntimeError as err:
        raise HTTPException(status_code=503, detail=str(err)) from err
    return TagImageResponse(tags=[TagScore(**t) for t in result["tags"]])


@router.post("/batch-tag-florence", response_model=BatchTagResponse)
def batch_tag_florence(req: BatchTagFlorenceRequest) -> BatchTagResponse:
    items = [{"id": it.id, "filePath": _resolve(it.filePath), "mediaDir": it.mediaDir} for it in req.items]
    result = tagger.get_tagger().batch_tag(items, max(1, req.batchSize))
    return BatchTagResponse(**result)
