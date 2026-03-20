"""
agents/base_agent.py — Abstract Base Agent
All 5 agents inherit from this. Zero logic duplication.
"""

import re
import logging
from abc import ABC, abstractmethod

import config
from models.agent_response import AgentResponse
from services.llm_service import generate_response

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """
    Abstract base. Subclasses define only:
      - name (property)
      - role (property)
      - system_prompt (property)
    Everything else is handled here.
    """

    def __init__(self, temperature_modifier: float = 0.0):
        self._temperature_modifier = temperature_modifier

    # ── Abstract interface (subclasses must implement) ────────────

    @property
    @abstractmethod
    def name(self) -> str: ...

    @property
    @abstractmethod
    def role(self) -> str: ...

    @property
    @abstractmethod
    def system_prompt(self) -> str: ...

    # ── Optional override ─────────────────────────────────────────

    def build_user_prompt(self, prompt: str) -> str:
        """Builds user-facing prompt. Override for specialty behavior."""
        return (
            f"Analyze the following from your specialized perspective:\n\n"
            f"QUESTION: {prompt}\n\n"
            f"Provide a thorough analysis. Then append exactly these two lines:\n"
            f"CONFIDENCE: [0.0 to 1.0]\n"
            f"REASONING: [one sentence describing your reasoning approach]"
        )

    # ── Core public method ────────────────────────────────────────

    async def generate(self, prompt: str) -> AgentResponse:
        """
        Run this agent on a prompt. Returns a structured AgentResponse.
        This is the ONLY method the orchestrator calls.
        """
        effective_temp = round(
            min(1.0, max(0.0, config.LLM_TEMPERATURE + self._temperature_modifier)), 4
        )

        logger.info("Agent [%s] starting | temp=%.2f", self.name, effective_temp)

        raw, processing_time = await generate_response(
            system_prompt=self.system_prompt,
            user_prompt=self.build_user_prompt(prompt),
            temperature=effective_temp,
        )

        response_text, confidence, reasoning_summary = self._parse_output(raw)

        logger.info(
            "Agent [%s] done | %.3fs | confidence=%.2f", self.name, processing_time, confidence
        )

        return AgentResponse(
            agent_name=self.name,
            role=self.role,
            response=response_text,
            confidence=confidence,
            reasoning_summary=reasoning_summary,
            processing_time=processing_time,
        )

    # ── Internal helpers ──────────────────────────────────────────

    def _parse_output(self, raw: str) -> tuple[str, float, str]:
        confidence = self._extract_confidence(raw)
        reasoning = self._extract_reasoning(raw)
        clean_text = self._strip_structured_lines(raw)
        return clean_text, confidence, reasoning

    def _extract_confidence(self, text: str) -> float:
        m = re.search(r"CONFIDENCE:\s*([0-9]*\.?[0-9]+)", text, re.IGNORECASE)
        if m:
            try:
                return round(min(max(float(m.group(1)), 0.0), 1.0), 4)
            except ValueError:
                pass
        logger.debug("Agent [%s]: no CONFIDENCE found, defaulting 0.70", self.name)
        return 0.70

    def _extract_reasoning(self, text: str) -> str:
        m = re.search(r"REASONING:\s*(.+)", text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
        return "No reasoning summary provided."

    def _strip_structured_lines(self, text: str) -> str:
        lines = text.splitlines()
        cleaned = [
            ln for ln in lines
            if not re.match(r"^\s*(CONFIDENCE|REASONING):", ln, re.IGNORECASE)
        ]
        return "\n".join(cleaned).strip()