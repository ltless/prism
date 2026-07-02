import os

# Sidecar auth: disabled when SIDECAR_KEY unset (tests run unauthenticated).
os.environ.pop("SIDECAR_KEY", None)
# Path guard: allow test fixtures under /tmp.
os.environ.setdefault("SIDECAR_MEDIA_ROOT", "/tmp")
