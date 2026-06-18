"""Tests for LLMClient config loading + provider instantiation.

Does NOT call real LLM APIs. Mocks httpx for any provider that has a key.
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest

from app.llm.client import LLMClient, TASK_TYPES


def test_client_loads_providers_from_config():
    """LLMClient reads configs/llm_providers.json on init."""
    c = LLMClient()
    # Repo config has 4 providers, 1 enabled (tokenrouter)
    assert len(c.config["providers"]) == 4
    assert any(p["id"] == "tokenrouter" for p in c.config["providers"])


def test_only_enabled_providers_instantiated():
    """Disabled providers don't appear in the runtime providers list."""
    c = LLMClient()
    enabled_ids = [p.id for p in c.providers]
    # tokenrouter is the only enabled one in the shipped config
    assert "tokenrouter" in enabled_ids
    # OpenAI / Anthropic / Ollama are disabled by default
    assert "openai" not in enabled_ids
    assert "anthropic" not in enabled_ids
    assert "ollama" not in enabled_ids


def test_providers_sorted_by_priority():
    """Provider list is ordered by priority ascending (lowest first)."""
    c = LLMClient()
    priorities = [p.priority for p in c.providers]
    assert priorities == sorted(priorities)


def test_list_providers_includes_all_configured():
    """list_providers() returns enabled + disabled (so UI can show toggle state)."""
    c = LLMClient()
    listed = c.list_providers()
    listed_ids = {p["id"] for p in listed}
    # All 4 in config should be listed (even disabled)
    assert {"tokenrouter", "openai", "anthropic", "ollama"} == listed_ids


def test_list_providers_marks_has_api_key_correctly(tmp_path: Path, monkeypatch):
    """has_api_key reflects whether the env var is set."""
    # Set a fake key for tokenrouter, leave others unset
    monkeypatch.setenv("TOKENROUTER_API_KEY", "sk-fake")
    c = LLMClient()
    listed = {p["id"]: p for p in c.list_providers()}
    assert listed["tokenrouter"]["has_api_key"] is True
    assert listed["openai"]["has_api_key"] is False
    assert listed["anthropic"]["has_api_key"] is False
    assert listed["ollama"]["has_api_key"] is False


def test_model_for_task_returns_provider_and_model():
    """model_for(task) returns the chosen provider+model for an enabled task."""
    c = LLMClient()
    pid, model = c.model_for("cv_generate")
    assert pid == "tokenrouter"
    assert model  # non-empty


def test_model_for_unknown_task_returns_none():
    c = LLMClient()
    pid, model = c.model_for("not_a_real_task")
    assert pid is None
    assert model is None


def test_task_types_set_covers_documented_tasks():
    """TASK_TYPES must include every task the LLM client knows about."""
    expected = {
        "resume_parse", "job_analyze", "match",
        "cv_generate", "cv_score", "cv_improve", "cover_letter",
    }
    assert expected <= TASK_TYPES
