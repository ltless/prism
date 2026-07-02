from __future__ import annotations

import logging
import math
import threading
from typing import Any

from app.config import settings

logger = logging.getLogger("prism.sidecar.clip")

_MODEL_IDS = {
    "standard": "openai/clip-vit-base-patch32",
    "sharp": "openai/clip-vit-base-patch16",
    "high": "openai/clip-vit-large-patch14",
}

_session: "ClipSession | None" = None
_loaded_variant: str | None = None
_load_lock = threading.Lock()


def _softmax_top_k(
    logits: list[float],
    candidates: list[str],
    threshold: float,
    k: int = 15,
) -> list[dict[str, float]]:
    if not logits or not candidates:
        return []
    max_logit = max(logits)
    exp_scores = [math.exp(v - max_logit) for v in logits]
    sum_exp = sum(exp_scores)
    probs = [e / sum_exp for e in exp_scores]
    result = [
        {"tag": candidates[i], "score": probs[i]}
        for i in range(min(len(candidates), len(probs)))
        if probs[i] > threshold
    ]
    result.sort(key=lambda r: r["score"], reverse=True)
    return result[:k]


def _assemble_batch_result(
    items: list[dict[str, str]],
    valid_results: list[tuple[int, list[float], list[float]]],
    candidates: list[str],
    threshold: float,
) -> dict[str, Any]:
    embeddings: list[list[float] | None] = [None] * len(items)
    tag_sets: list[list[dict[str, float]]] = [[] for _ in range(len(items))]
    for g, emb, logits_row in valid_results:
        embeddings[g] = emb
        tag_sets[g] = _softmax_top_k(logits_row, candidates, threshold)
    results = []
    tagged = 0
    for i, item in enumerate(items):
        tags = tag_sets[i]
        results.append({
            "id": item["id"],
            "tags": [t["tag"] for t in tags],
            "tagScores": [t["score"] for t in tags],
            "embedding": embeddings[i],
        })
        if embeddings[i] is not None:
            tagged += 1
    return {"tagged": tagged, "results": results}


class ClipSession:
    def __init__(self, model: Any, processor: Any, tokenizer: Any, device: str, variant: str) -> None:
        self.model = model
        self.processor = processor
        self.tokenizer = tokenizer
        self.device = device
        self.variant = variant
        self._dummy_image: dict[str, Any] | None = None

    def _dummy_image_inputs(self) -> dict[str, Any]:
        if self._dummy_image is None:
            from PIL import Image

            dummy = Image.new("RGB", (224, 224), (128, 128, 128))
            raw = self.processor(images=dummy, return_tensors="pt")
            self._dummy_image = {k: v.to(self.device) for k, v in raw.items()}
        return self._dummy_image

    def embed_image(self, image_path: str) -> list[float]:
        import torch
        from PIL import Image

        image = Image.open(image_path).convert("RGB")
        image_inputs = self.processor(images=image, return_tensors="pt")
        text_inputs = self.tokenizer(" ", padding=True, truncation=True, return_tensors="pt")
        inputs = {**text_inputs, **image_inputs}
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        with torch.no_grad():
            outputs = self.model(**inputs)
        return outputs.image_embeds[0].detach().cpu().float().tolist()

    def embed_text(self, text: str) -> list[float]:
        import torch

        text_inputs = self.tokenizer(text, padding=True, truncation=True, return_tensors="pt")
        inputs = {**self._dummy_image_inputs(), **text_inputs}
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        with torch.no_grad():
            outputs = self.model(**inputs)
        return outputs.text_embeds[0].detach().cpu().float().tolist()

    def generate_tags(self, image_path: str, candidates: list[str], threshold: float = 0.1) -> list[dict[str, float]]:
        import torch
        from PIL import Image

        image = Image.open(image_path).convert("RGB")
        texts = [f"a photo of {t}" for t in candidates]
        inputs = self.processor(
            images=image, text=texts, return_tensors="pt",
            padding=True, truncation=True, max_length=77,
        )
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        with torch.no_grad():
            outputs = self.model(**inputs)
        logits = outputs.logits_per_image[0].detach().cpu().float().tolist()
        return _softmax_top_k(logits, candidates, threshold)

    def batch_tag(
        self,
        items: list[dict[str, str]],
        candidates: list[str],
        threshold: float,
        batch_size: int,
    ) -> dict[str, Any]:
        import torch
        from PIL import Image

        texts = [f"a photo of {t}" for t in candidates]
        valid_results: list[tuple[int, list[float], list[float]]] = []
        for start in range(0, len(items), batch_size):
            chunk = items[start:start + batch_size]
            images: list[Any] = []
            idxs: list[int] = []
            for i, item in enumerate(chunk):
                try:
                    img = Image.open(item["filePath"]).convert("RGB")
                    images.append(img)
                    idxs.append(start + i)
                except Exception as err:
                    logger.error("batch.tag.read.fail file=%s error=%s", item.get("filePath"), err)
            if not images:
                continue
            try:
                inputs = self.processor(
                    images=images, text=texts, return_tensors="pt",
                    padding=True, truncation=True, max_length=77,
                )
                inputs = {k: v.to(self.device) for k, v in inputs.items()}
                with torch.no_grad():
                    outputs = self.model(**inputs)
                emb = outputs.image_embeds.detach().cpu().float().tolist()
                logits = outputs.logits_per_image.detach().cpu().float().tolist()
                for j, g in enumerate(idxs):
                    valid_results.append((g, emb[j], logits[j]))
            except Exception as err:
                logger.error("batch.tag.fail chunk=%s error=%s", start, err)
        return _assemble_batch_result(items, valid_results, candidates, threshold)


def get_clip(variant: str = "standard") -> ClipSession:
    global _session, _loaded_variant
    if _session is not None and _loaded_variant == variant:
        return _session
    # lock prevents 50 threads from loading clip simultaneously → OOM.
    # learned this the hard way.
    with _load_lock:
        if _session is not None and _loaded_variant == variant:
            return _session
        _session = _load_clip(variant)
        _loaded_variant = variant
    return _session


def _load_clip(variant: str) -> ClipSession:
    import torch
    from transformers import CLIPModel, CLIPProcessor, CLIPTokenizer

    if variant not in _MODEL_IDS:
        raise ValueError(f"Unknown CLIP variant: {variant}")
    model_id = _MODEL_IDS[variant]
    device = settings.device
    torch_device = torch.device(device)

    logger.info("loading CLIP model model=%s device=%s", model_id, device)
    model = CLIPModel.from_pretrained(model_id, cache_dir=settings.models_dir).to(torch_device)
    model.eval()
    processor = CLIPProcessor.from_pretrained(model_id, cache_dir=settings.models_dir)
    tokenizer = CLIPTokenizer.from_pretrained(model_id, cache_dir=settings.models_dir)
    logger.info("CLIP model ready model=%s", model_id)
    return ClipSession(model, processor, tokenizer, device, variant)


def unload_clip() -> None:
    global _session, _loaded_variant
    _session = None
    _loaded_variant = None
