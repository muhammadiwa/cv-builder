"""Provider implementations.

Add a new provider by:
1. Subclassing ``LLMProvider`` in this package.
2. Registering its ``kind`` in ``llm_providers.json`` (``openai_compat``
   or ``anthropic``).
3. The ``LLMClient`` auto-instantiates the right class from the kind.
"""
