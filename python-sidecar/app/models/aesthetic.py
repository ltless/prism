from __future__ import annotations

import logging
import math
import threading
from typing import Any

from app.config import settings

logger = logging.getLogger("prism.sidecar.aesthetic")

DEFAULT_MODEL_ID = "shunk031/aesthetics-predictor-v2-sac-logos-ava1-l14-linearMSE"

# CLIP prompt-pair fallback when LAION is unavailable.
PROMPT_PAIRS: list[tuple[str, str]] = [
    (
        "a stunning photograph with perfect composition, vibrant colors, excellent lighting, sharp focus, and professional quality",
        "a blurry, poorly composed photograph with bad lighting, dull colors, noise, and amateur quality",
    ),
    (
        "a beautiful landscape with rich colors, balanced exposure, and artistic framing",
        "an overexposed, washed out, or underexposed photograph with poor color balance",
    ),
    (
        "a professionally shot portrait with soft lighting, clear details, and pleasant bokeh",
        "a grainy, low resolution photograph with harsh shadows and red-eye effect",
    ),
]
PROMPT_WEIGHTS: list[float] = [0.5, 0.3, 0.2]

_session: "AestheticTorchSession | None" = None
_load_lock = threading.RLock()  # reentrant — get_aesthetic calls load_aesthetic, deal with it


def _sigmoid_normalize(raw: float, center: float = 5.5) -> float:
    """Map an AVA-scale raw score (~1-10) to [0, 1] via sigmoid centered at `center`.

    Numerically stable: avoids ``math.exp`` overflow for large magnitudes
    (Python raises OverflowError where JS ``Math.exp`` returns Infinity).
    """
    x = raw - center
    if x >= 0:
        value = 1.0 / (1.0 + math.exp(-x))
    else:
        e = math.exp(x)
        value = e / (1.0 + e)
    return max(0.0, min(1.0, value))


def _clip_prompt_pair_score(good_sim: float, bad_sim: float, temp: float = 0.15) -> float:
    """Temperature-scaled softmax over (good, bad) cosine similarities → [0, 1]."""
    exp_good = math.exp(good_sim / temp)
    exp_bad = math.exp(bad_sim / temp)
    return exp_good / (exp_good + exp_bad)


def _weighted_prompt_pair_score(pairs: list[tuple[float, float]]) -> float:
    """Weighted average of prompt-pair softmax scores using PROMPT_WEIGHTS."""
    if not pairs:
        return 0.0
    weights = PROMPT_WEIGHTS[: len(pairs)]
    total_w = sum(weights)
    if total_w == 0:
        return 0.0
    weighted = sum(
        w * _clip_prompt_pair_score(g, b) for w, (g, b) in zip(weights, pairs)
    ) / total_w
    return max(0.0, min(1.0, weighted))


def _assemble_batch_score(
    items: list[dict[str, str]],
    valid_results: list[tuple[int, dict[str, Any]]],
    model: str = "laion",
) -> dict[str, Any]:
    """Assemble per-item score results, isolating failed reads from successes."""
    by_idx: dict[int, dict[str, Any]] = {g: r for g, r in valid_results}
    results: list[dict[str, Any]] = []
    scored = 0
    for i, item in enumerate(items):
        if i in by_idx:
            r = by_idx[i]
            results.append({
                "id": item["id"],
                "score": r["score"],
                "raw": r["raw"],
                "model": r.get("model", model),
            })
            scored += 1
        else:
            results.append({
                "id": item["id"],
                "score": None,
                "raw": None,
                "model": model,
                "error": "read or inference failed",
            })
    return {"scored": scored, "results": results}


class AestheticTorchSession:
    """Wraps the LAION v2.5 aesthetic predictor (CLIP ViT-L/14 + MLP head)."""

    def __init__(self, model: Any, processor: Any, device: str) -> None:
        self.model = model
        self.processor = processor
        self.device = device

    def score(self, image_path: str) -> dict[str, Any]:
        import torch
        from PIL import Image

        image = Image.open(image_path).convert("RGB")
        inputs = self.processor(images=image, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        with torch.no_grad():
            outputs = self.model(**inputs)
        raw = float(outputs.logits.squeeze().detach().cpu().item())
        return {"score": _sigmoid_normalize(raw), "raw": raw, "model": "laion"}

    def batch_score(
        self,
        items: list[dict[str, str]],
        batch_size: int,
    ) -> dict[str, Any]:
        import torch
        from PIL import Image

        valid: list[tuple[int, dict[str, Any]]] = []
        for start in range(0, len(items), max(1, batch_size)):
            chunk = items[start:start + max(1, batch_size)]
            images: list[Any] = []
            idxs: list[int] = []
            for i, item in enumerate(chunk):
                try:
                    img = Image.open(item["filePath"]).convert("RGB")
                    images.append(img)
                    idxs.append(start + i)
                except Exception as err:
                    logger.error(
                        "aesthetic.batch.read.fail file=%s error=%s",
                        item.get("filePath"), err,
                    )
            if not images:
                continue
            try:
                inputs = self.processor(images=images, return_tensors="pt")
                inputs = {k: v.to(self.device) for k, v in inputs.items()}
                with torch.no_grad():
                    outputs = self.model(**inputs)
                raws = outputs.logits.squeeze(-1).detach().cpu().float().tolist()
                if isinstance(raws, float):
                    raws = [raws]
                for j, g in enumerate(idxs):
                    raw = float(raws[j])
                    valid.append((g, {"score": _sigmoid_normalize(raw), "raw": raw, "model": "laion"}))
            except Exception as err:
                logger.error("aesthetic.batch.fail chunk=%s error=%s", start, err)
        return _assemble_batch_score(items, valid, "laion")


def get_aesthetic() -> AestheticTorchSession:
    """Lazy-load the aesthetic model. Thread-safe via RLock."""
    global _session
    if _session is not None:
        return _session
    with _load_lock:
        if _session is not None:
            return _session
        load_aesthetic()
    return _session  # type: ignore[return-value]


def load_aesthetic(
    model_id: str = DEFAULT_MODEL_ID,
    device: str | None = None,
) -> None:
    global _session
    with _load_lock:
        _session = _load_aesthetic_session(model_id, device or settings.device)
    logger.info("aesthetic model ready model=%s device=%s", model_id, _session.device)


def _load_aesthetic_session(model_id: str, device: str) -> AestheticTorchSession:
    import torch
    from transformers import CLIPImageProcessor

    from app.models.aesthetic_v2 import (
        AestheticsPredictorConfig,
        AestheticsPredictorV2Linear,
    )

    torch_device = torch.device(device)
    logger.info("loading aesthetic model model=%s device=%s", model_id, device)
    config = AestheticsPredictorConfig.from_pretrained(
        model_id, cache_dir=settings.models_dir
    )
    model = AestheticsPredictorV2Linear.from_pretrained(
        model_id, config=config, cache_dir=settings.models_dir
    )
    model.eval().to(torch_device)
    processor = CLIPImageProcessor.from_pretrained(
        model_id, cache_dir=settings.models_dir
    )
    return AestheticTorchSession(model, processor, device)


def unload_aesthetic() -> None:
    global _session
    _session = None


def score_aesthetic(
    image_path: str,
    model: str = "laion",
    variant: str = "standard",
) -> dict[str, Any]:
    if model == "clip":
        return _score_with_clip(image_path, variant)
    try:
        return get_aesthetic().score(image_path)
    except Exception as err:
        # laion failed. fall back to clip rather than ruining someone's upload.
        logger.warning("aesthetic.laion.fail fallback=clip error=%s", err)
        return _score_with_clip(image_path, variant)


def batch_score_aesthetic(
    items: list[dict[str, str]],
    model: str = "laion",
    variant: str = "standard",
    batch_size: int = 1,
) -> dict[str, Any]:
    if model == "clip":
        return _batch_score_with_clip(items, variant)
    try:
        return get_aesthetic().batch_score(items, max(1, batch_size))
    except Exception as err:
        logger.warning("aesthetic.batch.laion.fail fallback=clip error=%s", err)
        return _batch_score_with_clip(items, variant)


def _score_with_clip(image_path: str, variant: str = "standard") -> dict[str, Any]:
    import torch
    from PIL import Image

    from app.models.clip import get_clip

    session = get_clip(variant)
    image = Image.open(image_path).convert("RGB")
    image_inputs = session.processor(images=image, return_tensors="pt")
    pairs: list[tuple[float, float]] = []
    for good, bad in PROMPT_PAIRS:
        tokens = session.tokenizer(
            [good, bad], padding=True, truncation=True, return_tensors="pt"
        )
        inputs = {**tokens, **image_inputs}
        inputs = {k: v.to(session.device) for k, v in inputs.items()}
        with torch.no_grad():
            outputs = session.model(**inputs)
        img_emb = outputs.image_embeds[0]
        good_emb = outputs.text_embeds[0]
        bad_emb = outputs.text_embeds[1]
        good_sim = float(torch.nn.functional.cosine_similarity(img_emb, good_emb, dim=0).item())
        bad_sim = float(torch.nn.functional.cosine_similarity(img_emb, bad_emb, dim=0).item())
        pairs.append((good_sim, bad_sim))
    score = _weighted_prompt_pair_score(pairs)
    return {"score": score, "raw": score, "model": "clip"}


def _batch_score_with_clip(
    items: list[dict[str, str]],
    variant: str = "standard",
) -> dict[str, Any]:
    from app.models.clip import get_clip

    get_clip(variant)  # ensure loaded
    valid: list[tuple[int, dict[str, Any]]] = []
    for i, item in enumerate(items):
        try:
            valid.append((i, _score_with_clip(item["filePath"], variant)))
        except Exception as err:
            logger.error("aesthetic.clip.batch.fail id=%s error=%s", item.get("id"), err)
    return _assemble_batch_score(items, valid, "clip")
