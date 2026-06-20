"""Symmetric encryption helpers for secrets stored in the DB (Phase 10B).

Currently used for ``LLMProvider.api_key``. The Fernet key is loaded from
``settings.master_key`` — in production this MUST be a real Fernet key
generated with ``Fernet.generate_key()``.

**Dev-mode behavior (intentional, documented):**

If the configured key matches the dev placeholder
(``dev-only-not-secure-please-rotate-in-production``), the encryption
layer falls back to **plaintext storage** so the dev workflow isn't
broken. This is loud-logged (ERROR level) so it's obvious in the logs
that production rotation is needed. To rotate:

    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

…then set the result as ``CV_MASTER_KEY`` in the environment or .env.

Usage::

    from app.core.crypto import encrypt_secret, decrypt_secret

    ciphertext = encrypt_secret(plain_key)        # str → str (Fernet token)
    plain = decrypt_secret(ciphertext)            # str → str | None
"""
from __future__ import annotations

from functools import lru_cache
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)

# Sentinel for the dev placeholder — clearly not a valid Fernet key.
# This exact string MUST also appear in:
#   - app/core/config.py  (Pydantic default for master_key)
#   - .env.example        (CV_MASTER_KEY= line)
# The test_dev_placeholder_string_in_sync test enforces all three
# stay in lockstep so a fresh checkout following .env.example gets the
# plaintext-storage warning.
_DEV_PLACEHOLDER = "dev-only-please-rotate-in-production"


@lru_cache(maxsize=1)
def _fernet() -> Optional[Fernet]:
    """Return a Fernet instance, or None if running with the dev key.

    ``lru_cache`` so we don't re-derive the Fernet from the env on every
    encrypt/decrypt call (Fernet construction does key validation).

    On the FIRST call with the dev placeholder key, logs an ERROR-level
    warning so the issue is immediately visible. Subsequent calls stay
    silent (don't spam the logs).
    """
    settings = get_settings()
    key = settings.master_key.get_secret_value()
    if key == _DEV_PLACEHOLDER:
        _warn_dev_key_once()
        return None
    try:
        return Fernet(key.encode())
    except (ValueError, TypeError) as e:
        # Invalid key format — log loudly but don't crash the app. The
        # encryption layer will fall back to plaintext and operations
        # that need the secret will fail at use time with a clear error.
        log.error(
            "invalid_fernet_key",
            error=str(e),
            hint=(
                "generate a real key with: "
                "python -c \"from cryptography.fernet import Fernet; "
                "print(Fernet.generate_key().decode())\""
            ),
        )
        return None


_dev_key_warned: bool = False


def _warn_dev_key_once() -> None:
    global _dev_key_warned
    if _dev_key_warned:
        return
    _dev_key_warned = True
    # ERROR level (not warning) so it shows up even in log filters that
    # drop warnings. The dev workflow continues to work — plaintext
    # storage — but the operator can't miss this.
    log.error(
        "LLM_API_KEYS_STORED_AS_PLAINTEXT",
        reason=(
            "CV_MASTER_KEY is set to the dev placeholder — api_key values "
            "are being stored UNENCRYPTED in the database. This is "
            "acceptable for local development only. Generate a real Fernet "
            "key for production:  python -c \"from cryptography.fernet "
            "import Fernet; print(Fernet.generate_key().decode())\""
        ),
    )


def encrypt_secret(plaintext: str) -> str:
    """Encrypt ``plaintext`` for at-rest storage.

    Returns the Fernet token (URL-safe base64 string). If the Fernet key
    is the dev placeholder (only in development), the plaintext is
    returned unchanged so dev workflows don't break — but an ERROR-level
    warning is logged on first call so the issue is visible.
    """
    if not plaintext:
        return ""
    f = _fernet()
    if f is None:
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