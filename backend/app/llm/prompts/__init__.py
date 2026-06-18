"""Prompt storage — versioned markdown files in storage/prompts/.

Prompts are versioned on disk (v1.md, v2.md, …) and loaded by task_type
from the LLMClient. This module is intentionally a thin loader — prompt
*editing* is a UI concern handled in Phase 12 (AI Prompt Manager).

The default prompts (shipped with the app) live under
``storage/prompts/`` and are created lazily on first read. Phase 2+ will
add the actual prompt content for each task type.
"""
from app.llm.prompts.loader import load_prompt, save_prompt, list_prompts

__all__ = ["load_prompt", "save_prompt", "list_prompts"]
