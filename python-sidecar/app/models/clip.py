from __future__ import annotations

import logging
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
