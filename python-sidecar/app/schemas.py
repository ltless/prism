from __future__ import annotations

from pydantic import BaseModel


class EmbedImageRequest(BaseModel):
    filePath: str
    variant: str = "standard"


class EmbedTextRequest(BaseModel):
    text: str
    variant: str = "standard"


class EmbeddingResponse(BaseModel):
    embedding: list[float]


class GenerateTagsRequest(BaseModel):
    filePath: str
    variant: str = "standard"
    tagThreshold: float = 0.1
    taxonomy: dict[str, list[str]] | None = None


class TagScore(BaseModel):
    tag: str
    score: float
    category: str | None = None


class TagsResponse(BaseModel):
    tags: list[TagScore]


class BatchTagItem(BaseModel):
    id: str
    filePath: str
    mediaDir: str | None = None


class BatchTagRequest(BaseModel):
    items: list[BatchTagItem]
    variant: str = "standard"
    tagThreshold: float = 0.1
    batchSize: int = 1
    taxonomy: dict[str, list[str]] | None = None


class BatchTagResult(BaseModel):
    id: str
    tags: list[str]
    tagScores: list[float]
    embedding: list[float] | None = None
    error: str | None = None


class BatchTagResponse(BaseModel):
    tagged: int
    results: list[BatchTagResult]


class TagImageRequest(BaseModel):
    filePath: str


class TagImageResponse(BaseModel):
    tags: list[TagScore]


class BatchTagFlorenceRequest(BaseModel):
    items: list[BatchTagItem]
    batchSize: int = 1


class AestheticScoreRequest(BaseModel):
    filePath: str
    model: str = "laion"
    variant: str = "standard"


class AestheticScoreResponse(BaseModel):
    score: float
    raw: float
    model: str


class BatchScoreItem(BaseModel):
    id: str
    filePath: str


class BatchScoreRequest(BaseModel):
    items: list[BatchScoreItem]
    model: str = "laion"
    variant: str = "standard"
    batchSize: int = 1


class BatchScoreResult(BaseModel):
    id: str
    score: float | None = None
    raw: float | None = None
    model: str
    error: str | None = None


class BatchScoreResponse(BaseModel):
    scored: int
    results: list[BatchScoreResult]


class LoadAestheticModelRequest(BaseModel):
    model: str = "laion"
    device: str | None = None


class LoadAestheticModelResponse(BaseModel):
    success: bool
    model: str
