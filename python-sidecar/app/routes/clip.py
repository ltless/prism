from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models import clip
from app.pathguard import resolve_media_path_or_err
from app.schemas import (
    BatchTagRequest,
    BatchTagResponse,
    EmbedImageRequest,
    EmbedTextRequest,
    EmbeddingResponse,
    GenerateTagsRequest,
    TagScore,
    TagsResponse,
)
from app.taxonomy import flatten_taxonomy

router = APIRouter()


@router.post("/embed-image", response_model=EmbeddingResponse)
def embed_image(req: EmbedImageRequest) -> EmbeddingResponse:
    session = clip.get_clip(req.variant)
    safe = resolve_media_path_or_err(req.filePath)
    try:
        embedding = session.embed_image(safe)
    except FileNotFoundError as err:
        raise HTTPException(status_code=404, detail="image not found") from err
    return EmbeddingResponse(embedding=embedding)


@router.post("/embed-text", response_model=EmbeddingResponse)
def embed_text(req: EmbedTextRequest) -> EmbeddingResponse:
    session = clip.get_clip(req.variant)
    embedding = session.embed_text(req.text)
    return EmbeddingResponse(embedding=embedding)


@router.post("/generate-tags", response_model=TagsResponse)
def generate_tags(req: GenerateTagsRequest) -> TagsResponse:
    session = clip.get_clip(req.variant)
    candidates = flatten_taxonomy(req.taxonomy)
    safe = resolve_media_path_or_err(req.filePath)
    try:
        tags = session.generate_tags(safe, candidates, req.tagThreshold)
    except FileNotFoundError as err:
        raise HTTPException(status_code=404, detail="image not found") from err
    return TagsResponse(tags=[TagScore(**t) for t in tags])


@router.post("/batch-tag", response_model=BatchTagResponse)
def batch_tag(req: BatchTagRequest) -> BatchTagResponse:
    session = clip.get_clip(req.variant)
    candidates = flatten_taxonomy(req.taxonomy)
    items = [{"id": it.id, "filePath": resolve_media_path_or_err(it.filePath), "mediaDir": it.mediaDir} for it in req.items]
    result = session.batch_tag(items, candidates, req.tagThreshold, max(1, req.batchSize))
    return BatchTagResponse(**result)
