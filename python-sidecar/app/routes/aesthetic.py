from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models import aesthetic
from app.pathguard import resolve_media_path_or_err
from app.schemas import (
    AestheticScoreRequest,
    AestheticScoreResponse,
    BatchScoreRequest,
    BatchScoreResponse,
    LoadAestheticModelRequest,
    LoadAestheticModelResponse,
    ScoreRequest,
    ScoreResponse,
)

router = APIRouter()


@router.post("/score", response_model=ScoreResponse)
def score(req: ScoreRequest) -> ScoreResponse:
    from app.models import aesthetic
    safe = resolve_media_path_or_err(req.filePath)
    try:
        res = aesthetic.score_aesthetic(safe, req.model, req.variant)
    except FileNotFoundError as err:
        raise HTTPException(status_code=404, detail="image not found") from err
    return ScoreResponse(score=res["score"], raw=res["raw"])


@router.post("/aesthetic-score", response_model=AestheticScoreResponse)
def aesthetic_score(req: AestheticScoreRequest) -> AestheticScoreResponse:
    safe = resolve_media_path_or_err(req.filePath)
    try:
        result = aesthetic.score_aesthetic(safe, req.model, req.variant)
    except FileNotFoundError as err:
        raise HTTPException(status_code=404, detail="image not found") from err
    except RuntimeError as err:
        raise HTTPException(status_code=503, detail=str(err)) from err
    return AestheticScoreResponse(**result)


@router.post("/batch-score", response_model=BatchScoreResponse)
def batch_score(req: BatchScoreRequest) -> BatchScoreResponse:
    items = [{"id": it.id, "filePath": resolve_media_path_or_err(it.filePath)} for it in req.items]
    result = aesthetic.batch_score_aesthetic(items, req.model, req.variant, max(1, req.batchSize))
    return BatchScoreResponse(**result)


@router.post("/load-aesthetic-model", response_model=LoadAestheticModelResponse)
def load_aesthetic_model(req: LoadAestheticModelRequest) -> LoadAestheticModelResponse:
    try:
        aesthetic.load_aesthetic(device=req.device)
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err)) from err
    return LoadAestheticModelResponse(success=True, model=req.model)
