"""
services/llm_service.py — Single LLM Abstraction Layer (Ollama)
ALL LLM calls in the entire system go through this file.
Switch models by editing config.py only.
"""

import time
import asyncio
import logging
from typing import Optional

import httpx

import config

logger = logging.getLogger(__name__)

# Ollama runs locally — no API key needed
OLLAMA_API_URL = f"{config.OLLAMA_BASE_URL}/api/chat"


async def generate_response(
    system_prompt: str,
    user_prompt: str,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
) -> tuple[str, float]:
    """
    Generate a response via local Ollama instance.

    Returns:
        Tuple of (response_text: str, processing_time_seconds: float)

    Raises:
        LLMServiceError: After all retry attempts exhausted.
    """
    temp   = temperature if temperature is not None else config.LLM_TEMPERATURE
    tokens = max_tokens  if max_tokens  is not None else config.LLM_MAX_TOKENS

    payload = {
        "model": config.LLM_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        "stream": False,
        "options": {
            "temperature": temp,
            "num_predict": tokens,
        },
    }

    last_error: Optional[Exception] = None

    for attempt in range(1, config.LLM_RETRY_ATTEMPTS + 1):
        try:
            start = time.perf_counter()

            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(OLLAMA_API_URL, json=payload)

            elapsed = round(time.perf_counter() - start, 4)

            if resp.status_code != 200:
                raise LLMServiceError(
                    f"Ollama returned HTTP {resp.status_code}: {resp.text}"
                )

            data = resp.json()
            text = data["message"]["content"].strip()

            logger.debug("Ollama OK | attempt=%d | %.3fs | %d chars", attempt, elapsed, len(text))
            return text, elapsed

        except httpx.ConnectError:
            raise LLMServiceError(
                "Cannot connect to Ollama at "
                f"{config.OLLAMA_BASE_URL}. "
                "Is Ollama running? Start it with: ollama serve"
            )

        except httpx.TimeoutException as e:
            last_error = e
            logger.warning("Ollama timeout on attempt %d (model may be loading).", attempt)
            await asyncio.sleep(config.LLM_RETRY_DELAY)

        except LLMServiceError:
            raise

        except Exception as e:
            last_error = e
            logger.error("Unexpected error on attempt %d: %s", attempt, str(e))
            await asyncio.sleep(config.LLM_RETRY_DELAY)

    raise LLMServiceError(
        f"LLM call failed after {config.LLM_RETRY_ATTEMPTS} attempts. Last: {last_error}"
    )


class LLMServiceError(Exception):
    """Raised when LLM service fails after all retry attempts."""
    pass