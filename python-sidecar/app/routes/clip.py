from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models import clip, ram
from app.pathguard import resolve_media_path_or_err
from app.schemas import (
    BatchTagRequest,
    BatchTagResponse,
    BatchTagResult,
    EmbedImageRequest,
    EmbedTextRequest,
    EmbeddingResponse,
    GenerateTagsRequest,
    TagScore,
    TagsResponse,
)

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
    safe = resolve_media_path_or_err(req.filePath)
    try:
        tags = ram.get_ram().generate_tags(safe, req.tagThreshold)
    except FileNotFoundError as err:
        raise HTTPException(status_code=404, detail="image not found") from err
    return TagsResponse(tags=[TagScore(**t) for t in tags])


@router.post("/batch-tag", response_model=BatchTagResponse)
def batch_tag(req: BatchTagRequest) -> BatchTagResponse:
    session = clip.get_clip(req.variant)
    results: list[BatchTagResult] = []
    for it in req.items:
        safe = resolve_media_path_or_err(it.filePath)
        try:
            embedding = session.embed_image(safe)
            tags = ram.get_ram().generate_tags(safe, req.tagThreshold)
            results.append(
                BatchTagResult(
                    id=it.id,
                    tags=[t["tag"] for t in tags],
                    tagScores=[t["score"] for t in tags],
                    embedding=embedding,
                )
            )
        except Exception as err:
            results.append(
                BatchTagResult(id=it.id, tags=[], tagScores=[], embedding=None, error=str(err))
            )
    return BatchTagResponse(tagged=len(results), results=results)
