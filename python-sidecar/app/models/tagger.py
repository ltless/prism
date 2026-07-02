"""Florence-2 tagger. Infrastructure ready, inference blocked.

Florence-2's custom modeling code (187KB, written for transformers 4.30)
is incompatible with our stack (4.57). The model loads with eager attention
but generate() fails on cache API skew. CLIP zero-shot tagging covers for it.
We'll swap in a compatible tagger when one exists. The code is here, waiting,
like a reserved seat at a wedding where the guest never showed up.
"""
from __future__ import annotations

import logging
from typing import Any

from app.config import settings

logger = logging.getLogger("prism.sidecar.tagger")

DEFAULT_MODEL_ID = "microsoft/Florence-2-base"

_session: "TaggerSession | None" = None


def _parse_od_labels(raw: dict[str, Any]) -> list[str]:
    """Extract object labels from a post-processed Florence-2 <OD> result."""
    od = raw.get("<OD>") or {}
    labels = od.get("labels") or []
    return [str(label) for label in labels]


def _map_to_taxonomy(label: str) -> str:
    """Map a single detected label to a Prism taxonomy category (or General)."""
    from app.taxonomy import TAG_TO_CATEGORY

    return TAG_TO_CATEGORY.get(label.lower().strip(), "General")


def _od_labels_to_tags(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Parse <OD> output into deduped [{tag, score, category}] with score=1.0."""
    labels = _parse_od_labels(raw)
    seen: set[str] = set()
    tags: list[dict[str, Any]] = []
    for label in labels:
        tag = label.lower().strip()
        if not tag or tag in seen:
            continue
        seen.add(tag)
        tags.append({"tag": tag, "score": 1.0, "category": _map_to_taxonomy(tag)})
    return tags


class TaggerSession:
    """Wraps microsoft/Florence-2-base for <OD> object tagging."""

    def __init__(self, model: Any, processor: Any, device: str) -> None:
        self.model = model
        self.processor = processor
        self.device = device

    def tag(self, image_path: str) -> dict[str, Any]:
        import torch
        from PIL import Image

        image = Image.open(image_path).convert("RGB")
        task = "<OD>"
        inputs = self.processor(text=task, images=image, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        if "pixel_values" in inputs:
            inputs["pixel_values"] = inputs["pixel_values"].float()
        with torch.no_grad():
            generated = self.model.generate(
                input_ids=inputs["input_ids"],
                pixel_values=inputs["pixel_values"],
                max_new_tokens=1024,
                do_sample=False,
                num_beams=1,
            )
        text = self.processor.batch_decode(generated, skip_special_tokens=False)[0]
        parsed = self.processor.post_process_generation(
            text, task=task, image_size=(image.width, image.height)
        )
        tags = _od_labels_to_tags(parsed)
        return {"tags": tags}

    def batch_tag(
        self,
        items: list[dict[str, str]],
        batch_size: int,
    ) -> dict[str, Any]:
        # Florence-2 generation is autoregressive per-image; batch_size is
        # accepted for API parity but each image is processed sequentially.
        results: list[dict[str, Any]] = []
        tagged = 0
        for item in items:
            try:
                r = self.tag(item["filePath"])
                tags = r["tags"]
                results.append({
                    "id": item["id"],
                    "tags": [t["tag"] for t in tags],
                    "tagScores": [t["score"] for t in tags],
                    "embedding": None,
                })
                tagged += 1
            except Exception as err:
                logger.error("tagger.batch.fail id=%s error=%s", item.get("id"), err)
                results.append({
                    "id": item["id"],
                    "tags": [],
                    "tagScores": [],
                    "embedding": None,
                    "error": "read or inference failed",
                })
        return {"tagged": tagged, "results": results}


def get_tagger() -> TaggerSession:
    global _session
    if _session is None:
        raise RuntimeError("tagger model not loaded; call POST /load-model first")
    return _session


def load_tagger(
    model_id: str = DEFAULT_MODEL_ID,
    device: str | None = None,
) -> None:
    global _session
    _session = _load_tagger_session(model_id, device or settings.device)
    logger.info("tagger model ready model=%s device=%s", model_id, _session.device)


def _load_tagger_session(model_id: str, device: str) -> TaggerSession:
    import torch
    from transformers import AutoModelForCausalLM, AutoProcessor

    torch_device = torch.device(device)
    logger.info("loading tagger model model=%s device=%s", model_id, device)
    # SECURITY: trust_remote_code runs 187KB of unvetted python from HF at
    # load time. microsoft is verified, generation is blocked anyway. accepted
    # risk — vendoring 187KB of stale code is worse. don't @ me.
    model = AutoModelForCausalLM.from_pretrained(
        model_id,
        trust_remote_code=True,
        cache_dir=settings.models_dir,
        attn_implementation="eager",
    ).to(torch_device)
    model.eval()
    processor = AutoProcessor.from_pretrained(
        model_id, trust_remote_code=True, cache_dir=settings.models_dir
    )
    return TaggerSession(model, processor, device)


def unload_tagger() -> None:
    global _session
    _session = None
