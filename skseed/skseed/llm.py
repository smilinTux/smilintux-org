"""
LLM callback providers for the skseed collider.

The collider is model-agnostic — it generates prompts and accepts any
callable that takes a prompt string and returns a response string.

This module provides ready-made callbacks for common setups:

  - anthropic_callback: Uses the Anthropic SDK (Claude)
  - openai_callback: Uses the OpenAI SDK
  - ollama_callback: Uses a local Ollama instance
  - passthrough_callback: Returns the prompt as-is (for debugging/testing)

Usage:
    from skseed import Collider
    from skseed.llm import anthropic_callback

    collider = Collider(llm=anthropic_callback())
    result = collider.collide("Truth is knowable")
"""

from __future__ import annotations

import os
from typing import Callable, Optional

LLMCallback = Callable[[str], str]


def anthropic_callback(
    model: str = "claude-sonnet-4-20250514",
    max_tokens: int = 4096,
    api_key: Optional[str] = None,
) -> LLMCallback:
    """Create a callback that uses the Anthropic (Claude) API.

    Args:
        model: Model ID to use.
        max_tokens: Maximum response tokens.
        api_key: API key. Falls back to ANTHROPIC_API_KEY env var.

    Returns:
        LLM callback function.
    """
    def _call(prompt: str) -> str:
        try:
            import anthropic
        except ImportError:
            raise ImportError(
                "anthropic package required. Install with: pip install anthropic"
            )

        key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        if not key:
            raise ValueError(
                "ANTHROPIC_API_KEY not set. Set it or pass api_key parameter."
            )

        client = anthropic.Anthropic(api_key=key)
        message = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text

    return _call


def openai_callback(
    model: str = "gpt-4o",
    max_tokens: int = 4096,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> LLMCallback:
    """Create a callback that uses the OpenAI API.

    Args:
        model: Model ID to use.
        max_tokens: Maximum response tokens.
        api_key: API key. Falls back to OPENAI_API_KEY env var.
        base_url: Optional base URL for compatible APIs.

    Returns:
        LLM callback function.
    """
    def _call(prompt: str) -> str:
        try:
            import openai
        except ImportError:
            raise ImportError(
                "openai package required. Install with: pip install openai"
            )

        key = api_key or os.environ.get("OPENAI_API_KEY", "")
        kwargs = {"api_key": key}
        if base_url:
            kwargs["base_url"] = base_url

        client = openai.OpenAI(**kwargs)
        response = client.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content or ""

    return _call


def ollama_callback(
    model: str = "llama3.1",
    base_url: str = "http://localhost:11434",
) -> LLMCallback:
    """Create a callback that uses a local Ollama instance.

    Args:
        model: Model name to use.
        base_url: Ollama server URL.

    Returns:
        LLM callback function.
    """
    def _call(prompt: str) -> str:
        import json
        import urllib.request

        payload = json.dumps({
            "model": model,
            "prompt": prompt,
            "stream": False,
        }).encode("utf-8")

        req = urllib.request.Request(
            f"{base_url}/api/generate",
            data=payload,
            headers={"Content-Type": "application/json"},
        )

        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            return result.get("response", "")

    return _call


def passthrough_callback() -> LLMCallback:
    """Create a callback that returns the prompt unchanged.

    Useful for debugging, testing, or when you want to capture
    the generated prompt for external processing.

    Returns:
        LLM callback that echoes the prompt.
    """
    def _call(prompt: str) -> str:
        return prompt

    return _call


def auto_callback() -> Optional[LLMCallback]:
    """Auto-detect the best available LLM callback.

    Checks in order:
      1. ANTHROPIC_API_KEY → anthropic_callback
      2. OPENAI_API_KEY → openai_callback
      3. Ollama running locally → ollama_callback
      4. None (no LLM available)

    Returns:
        The best available callback, or None.
    """
    if os.environ.get("ANTHROPIC_API_KEY"):
        try:
            return anthropic_callback()
        except ImportError:
            pass

    if os.environ.get("OPENAI_API_KEY"):
        try:
            return openai_callback()
        except ImportError:
            pass

    # Check if Ollama is running
    try:
        import urllib.request
        req = urllib.request.Request("http://localhost:11434/api/tags")
        with urllib.request.urlopen(req, timeout=2):
            return ollama_callback()
    except Exception:
        pass

    return None
