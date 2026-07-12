from __future__ import annotations

import logging
import math
import threading
from typing import Any

from app.config import settings
from app.taxonomy import TAG_TO_CATEGORY

logger = logging.getLogger("prism.sidecar.ram")

DEFAULT_MODEL_ID = "xcinc/recognize-anything-plus"

_session: "RAMSession | None" = None
_load_lock = threading.Lock()


def map_tags_to_taxonomy(raw_tags: list[str]) -> list[dict[str, Any]]:
    mapped: list[dict[str, Any]] = []
    for raw in raw_tags:
        tag = raw.strip().lower()
        if not tag or tag not in TAG_TO_CATEGORY:
            continue
        mapped.append({
            "tag": tag,
            "score": 1.0,
            "category": TAG_TO_CATEGORY[tag],
        })
    return mapped


class RAMSession:
    def __init__(self, model: Any, processor: Any, device: str) -> None:
        self.model = model
        self.processor = processor
        self.device = device

    def generate_tags(self, image_path: str, threshold: float = 0.0) -> list[dict[str, Any]]:
        import torch
        from PIL import Image

        image = Image.open(image_path).convert("RGB")
        inputs = self.processor(images=image, return_tensors="pt").to(self.device)
        with torch.no_grad():
            out = self.model.generate(
                **inputs,
                output_scores=True,
                return_dict_in_generate=True,
                num_beams=3,
                max_new_tokens=30,
            )

        beam_scores = out.sequences_scores[0].detach().cpu().float().tolist()
        max_score = max(beam_scores)
        exp_scores = [math.exp(s - max_score) for s in beam_scores]
        sum_exp = sum(exp_scores)
        probs = [e / sum_exp for e in exp_scores]
        conf = round(max(probs), 4)

        decoded = self.processor.decode(
            out.sequences[0], skip_special_tokens=True
        )
        raw_tags = [t for t in _split_tags(decoded) if t]
        mapped = map_tags_to_taxonomy(raw_tags)
        result: list[dict[str, Any]] = []
        for m in mapped:
            # RAM yields one generation confidence for the whole tag set;
            # filter the set by that confidence, not the placeholder 1.0 score.
            if conf < threshold:
                continue
            result.append({
                "tag": m["tag"],
                "score": conf,
                "category": m["category"],
            })
        return result


def _split_tags(text: str) -> list[str]:
    parts = []
    for chunk in text.replace(".", ",").split(","):
        tag = chunk.strip().lower()
        if tag:
            parts.append(tag)
    return parts


def get_ram(model_id: str = DEFAULT_MODEL_ID) -> RAMSession:
    global _session
    if _session is not None:
        return _session
    with _load_lock:
        if _session is not None:
            return _session
        _session = _load_ram(model_id)
    return _session


def _load_ram(model_id: str = DEFAULT_MODEL_ID) -> RAMSession:
    import torch
    from recognize_anything import RAMModel, RAMProcessor

    device = settings.device
    torch_device = torch.device(device)

    logger.info("loading RAM model model=%s device=%s", model_id, device)
    model = RAMModel.from_pretrained(model_id, cache_dir=settings.models_dir).to(torch_device)
    model.eval()
    processor = RAMProcessor.from_pretrained(model_id, cache_dir=settings.models_dir)
    logger.info("RAM model ready model=%s", model_id)
    return RAMSession(model, processor, device)


def unload_ram() -> None:
    global _session
    _session = None
