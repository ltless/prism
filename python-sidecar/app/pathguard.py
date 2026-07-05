"""Path traversal guard. filePath must resolve under the media root.
blocks .., absolute-outside-root, symlinks. because people are the worst."""
from __future__ import annotations

import os

from fastapi import HTTPException

from app.config import settings


def resolve_media_path(file_path: str) -> str:
    """Validate + resolve `file_path` under the media root. Raises ValueError on violation."""
    if not isinstance(file_path, str) or not file_path:
        raise ValueError("empty file path")
    if "\x00" in file_path:
        raise ValueError("null byte in path")

    root = os.path.realpath(settings.media_root)
    resolved = os.path.realpath(os.path.join(root, file_path) if not os.path.isabs(file_path) else file_path)

    # Resolved path must be the root itself or live beneath it.
    if resolved != root and not resolved.startswith(root + os.sep):
        raise ValueError(f"path outside media root: {file_path}")
    return resolved


def resolve_media_path_or_err(file_path: str) -> str:
    """Same as resolve_media_path but raises HTTPException(403) for route handlers."""
    try:
        return resolve_media_path(file_path)
    except ValueError as err:
        raise HTTPException(status_code=403, detail=str(err)) from err
