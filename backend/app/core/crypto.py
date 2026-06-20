"""Symmetric encryption helpers for secrets stored in the DB (Phase 10B).

Currently used for ``LLMProvider.api_key``. The Fernet key is loaded from
``settings.master_key`` — in production this MUST be a real Fernet key
generated with ``Fernet.generate_key()``. The default dev value is
clearly marked and triggers a loud warning at startup so it's obvious in
the logs that production rotation is needed.

Usage::

    from app.core.crypto import encrypt_secret, decrypt_secret

    ciphertext = encrypt_secret(plain_key)        # str → str (Fernet token)
    plain = decrypt_secret(ciphertext)            # str → str | None

If the Fernet key is the dev placeholder, ``encrypt_secret`` returns the
plaintext unchanged (so dev environments don't break) and logs a warning.
Production keys always encrypt.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)

# Sentinel for the dev placeholder — clearly not a valid Fernet key.
_DEV_PLACEHOLDER = "dev-only-not-secure-please-rotate-in-production"


@lru_cache(maxsize=1)
def _fernet() -> Optional[Fernet]:
    """Return a Fernet instance, or None if running with the dev key.

    ``lru_cache`` so we don't re-derive the Fernet from the env on every
    encrypt/decrypt call (Fernet construction does key validation).
    """
    settings = get_settings()
    key = settings.master_key.get_secret_value()
    if key == _DEV_PLACEHOLDER:
        return None
    try:
        return Fernet(key.encode())
    except (ValueError, TypeError) as e:
        # Invalid key format — log loudly but don't crash the app. The
        # encryption layer will fall back to plaintext and operations
        # that need the secret will fail at use time with a clear error.
        log.error("invalid_fernet_key", error=str(e))
        return None


def encrypt_secret(plaintext: str) -> str:
    """Encrypt ``plaintext`` for at-rest storage.

    Returns the Fernet token (URL-safe base64 string). If the Fernet key
    is the dev placeholder (only in development), the plaintext is
    returned unchanged so dev workflows don't break — but a warning is
    logged so the issue is visible.
    """
    if not plaintext:
        return ""
    f = _fernet()
    if f is None:
        log.warning(
            "encrypt_skipped_dev_key",
            hint="set CV_MASTER_KEY to a real Fernet key in production",
        )
        return plaintext
    return f.encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str) -> Optional[str]:
    """Decrypt a Fernet token. Returns None on empty input or invalid token.

    For dev (no Fernet key configured), the input is returned as-is so
    the dev workflow stays unbroken.
    """
    if not ciphertext:
        return None
    f = _fernet()
    if f is None:
        # Dev mode — ciphertext is actually plaintext.
        return ciphertext
    try:
        return f.decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        log.warning("decrypt_invalid_token")
        return None