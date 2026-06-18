"""Pytest fixtures: temp SQLite DB per test, fresh Settings cache."""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

# Set env BEFORE importing app — these only stick if not already set.
_TMP = Path(tempfile.mkdtemp(prefix="cvat_"))
os.environ.setdefault("CV_DATABASE_URL", f"sqlite:///{_TMP / 'test.db'}")
os.environ.setdefault("CV_MASTER_KEY", "test-only-key")
os.environ.setdefault("CV_STORAGE_DIR", str(_TMP))
os.environ.setdefault("CV_CORS_ORIGINS", '["http://testserver"]')

import pytest  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.db.session import Base  # noqa: E402

get_settings.cache_clear()  # fresh Settings per test session


@pytest.fixture
def engine():
    """In-memory SQLite engine per test, isolated."""
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        future=True,
    )
    Base.metadata.create_all(bind=eng)
    yield eng
    eng.dispose()


@pytest.fixture
def session_factory(engine):
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@pytest.fixture
def session(session_factory):
    s = session_factory()
    try:
        yield s
    finally:
        s.close()
