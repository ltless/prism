"""Model registry + download/load state for the Prism AI sidecar."""
from __future__ import annotations

import logging
import threading
from dataclasses import dataclass, field
from typing import Any

from app.config import settings

logger = logging.getLogger("prism.sidecar.registry")


@dataclass
class ModelSpec:
    id: str
    type: str  # "embed" | "aesthetic"
    name: str
    size: str
    variant: str | None = None
    allow_patterns: list[str] = field(default_factory=list)


_COMMON_TRANSFORMERS_PATTERNS: list[str] = [
    "*.safetensors",
    "*.json",
    "*.txt",
    "merges.txt",
    "vocab.json",
    "tokenizer.json",
]


REGISTRY: list[ModelSpec] = [
    ModelSpec(
        id="openai/clip-vit-base-patch32",
        type="embed",
        name="CLIP Base",
        size="~600MB",
        variant="standard",
        allow_patterns=_COMMON_TRANSFORMERS_PATTERNS,
    ),
    ModelSpec(
        id="openai/clip-vit-base-patch16",
        type="embed",
        name="CLIP Sharp",
        size="~600MB",
        variant="sharp",
        allow_patterns=_COMMON_TRANSFORMERS_PATTERNS,
    ),
    ModelSpec(
        id="openai/clip-vit-large-patch14",
        type="embed",
        name="CLIP High",
        size="~1.7GB",
        variant="high",
        allow_patterns=_COMMON_TRANSFORMERS_PATTERNS,
    ),
    ModelSpec(
        id="shunk031/aesthetics-predictor-v2-sac-logos-ava1-l14-linearMSE",
        type="aesthetic",
        name="LAION Aesthetic v2.5",
        size="~1.2GB",
        allow_patterns=_COMMON_TRANSFORMERS_PATTERNS,
    ),
]


_download_state: dict[str, dict[str, Any]] = {}
_download_lock = threading.Lock()


def find_spec(model_id: str) -> ModelSpec | None:
    for spec in REGISTRY:
        if spec.id == model_id:
            return spec
    return None


def get_download_state(model_id: str) -> dict[str, Any]:
    with _download_lock:
        return dict(_download_state.get(model_id, {"status": "idle"}))


def set_download_state(model_id: str, **fields: Any) -> None:
    with _download_lock:
        state = _download_state.setdefault(model_id, {"status": "idle"})
        state.update(fields)
        _download_state[model_id] = state


def clear_download_state() -> None:
    with _download_lock:
        _download_state.clear()


def is_model_downloaded(spec: ModelSpec) -> bool:
    return _scan_cache(spec)


def _scan_cache(spec: ModelSpec) -> bool:
    try:
        from huggingface_hub import snapshot_download

        snapshot_download(
            spec.id,
            cache_dir=settings.models_dir,
            allow_patterns=spec.allow_patterns,
            local_files_only=True,
        )
        return True
    except Exception as err:
        # "not downloaded" is fine (returns false, ui offers download button).
        # real errors (corrupt cache, permission) get logged so they don't rot.
        msg = str(err)
        if "local entry" not in msg.lower() and "not found" not in msg.lower():
            logger.warning("scan_cache.error model=%s error=%s", spec.id, err)
        return False


def is_model_loaded(spec: ModelSpec) -> bool:
    try:
        if spec.type == "embed":
            from app.models import clip

            return clip._session is not None and clip._loaded_variant == (spec.variant or "standard")
        if spec.type == "aesthetic":
            from app.models import aesthetic

            return aesthetic._session is not None
    except Exception:
        return False
    return False


def start_download(spec: ModelSpec) -> None:
    existing = get_download_state(spec.id)
    if existing.get("status") == "downloading":
        return
    set_download_state(spec.id, status="downloading", progress=0, files_done=0, error=None)
    thread = threading.Thread(target=_do_download, args=(spec,), daemon=True)
    thread.start()


def _do_download(spec: ModelSpec) -> None:
    try:
        from huggingface_hub import HfApi, hf_hub_download

        api = HfApi()
        repo_files = api.list_repo_files(spec.id)
        targets = [f for f in repo_files if _matches_pattern(f, spec.allow_patterns)]
        total = max(1, len(targets))
        for i, filename in enumerate(targets):
            try:
                hf_hub_download(
                    spec.id,
                    filename,
                    cache_dir=settings.models_dir,
                )
            except Exception as err:
                logger.warning("download.file.fail model=%s file=%s error=%s", spec.id, filename, err)
            set_download_state(
                spec.id,
                progress=int((i + 1) / total * 100),
                files_done=i + 1,
            )
        set_download_state(spec.id, status="done", progress=100)
        logger.info("download.done model=%s files=%d", spec.id, total)
    except Exception as err:
        set_download_state(spec.id, status="error", error=str(err))
        logger.error("download.fail model=%s error=%s", spec.id, err)


def _matches_pattern(filename: str, patterns: list[str]) -> bool:
    import fnmatch

    return any(fnmatch.fnmatch(filename, p) for p in patterns)
