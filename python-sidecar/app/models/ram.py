from __future__ import annotations

import logging
import os
import threading
from typing import Any

from app.config import settings
from app.taxonomy import TAG_TO_CATEGORY

logger = logging.getLogger("prism.sidecar.ram")

DEFAULT_MODEL_ID = "xcinc/recognize-anything-plus"
IMAGE_SIZE = 384
# RAM applies its own sigmoid threshold internally; 0.65 keeps it close to the
# model's tuned default (0.68) while surfacing a few more borderline tags.
DEFAULT_RAM_THRESHOLD = 0.65

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
    def __init__(self, model: Any, transform: Any, device: str) -> None:
        self.model = model
        self.transform = transform
        self.device = device

    def generate_tags(self, image_path: str, threshold: float = 0.0) -> list[dict[str, Any]]:
        import torch
        from PIL import Image

        image = Image.open(image_path).convert("RGB")
        tensor = self.transform(image).unsqueeze(0).to(self.device)
        with torch.no_grad():
            tag_output, _ = self.model.generate_tag(tensor, threshold=DEFAULT_RAM_THRESHOLD)
        tag_str = tag_output[0] if tag_output else ""
        raw_tags = [p.strip() for p in tag_str.split("|") if p.strip()]
        # RAM already applied its internal threshold, so app `threshold` is not
        # re-applied here; map to our taxonomy and assign a uniform confidence.
        return map_tags_to_taxonomy(raw_tags)


def get_ram(model_id: str | None = None) -> RAMSession:
    global _session
    if _session is not None:
        return _session
    with _load_lock:
        if _session is not None:
            return _session
        _session = _load_ram(model_id or os.environ.get("RAM_PRETRAINED", DEFAULT_MODEL_ID))
    return _session


def _load_ram(model_id: str) -> RAMSession:
    from ram import get_transform
    from ram.models import ram_plus
    import torch

    device = settings.device
    torch_device = torch.device(device)
    logger.info("loading RAM tagger model=%s device=%s", model_id, device)
    transform = get_transform(image_size=IMAGE_SIZE)
    model = ram_plus(pretrained=model_id, image_size=IMAGE_SIZE, vit="swin_l")
    model.eval().to(torch_device)
    logger.info("RAM tagger ready model=%s", model_id)
    return RAMSession(model, transform, device)


def unload_ram() -> None:
    global _session
    _session = None
