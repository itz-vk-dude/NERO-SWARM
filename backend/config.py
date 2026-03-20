"""
config.py — Central Configuration Control
Single source of truth. Change behavior here, not inside agents or engines.
"""

import os
from typing import List
from dotenv import load_dotenv

load_dotenv()

# ─── Ollama Settings ─────────────────────────────────────────────
OLLAMA_BASE_URL: str = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
LLM_MODEL: str = os.environ.get("LLM_MODEL", "llama3.2")
LLM_TEMPERATURE: float = 0.7
LLM_MAX_TOKENS: int = 1200
LLM_RETRY_ATTEMPTS: int = 3
LLM_RETRY_DELAY: float = 1.5

# ─── Concurrency ─────────────────────────────────────────────────
# Set to 1 for Ollama (local GPU — parallel calls cause CUDA OOM crash)
# Set to 5 for cloud APIs (OpenRouter, Anthropic etc.)
AGENT_CONCURRENCY: int = int(os.environ.get("AGENT_CONCURRENCY", "1"))
CRITIQUE_CONCURRENCY: int = int(os.environ.get("CRITIQUE_CONCURRENCY", "2"))

# ─── Agent Settings ──────────────────────────────────────────────
AGENT_ORDER: List[str] = [
    "Analyst",
    "Creative",
    "Critic",
    "Feasibility",
    "Synthesizer",
]

# ─── Critique Round ──────────────────────────────────────────────
ENABLE_CRITIQUE_ROUND: bool = True
CRITIQUE_TEMPERATURE: float = 0.5

# ─── Confidence Weighting ────────────────────────────────────────
CONFIDENCE_WEIGHT: float = 0.4
TRUST_WEIGHT: float = 0.4
DIVERGENCE_PENALTY: float = 0.2

# ─── Trust Engine ────────────────────────────────────────────────
TRUST_INITIAL_SCORE: float = 0.70
TRUST_CONSENSUS_BOOST: float = 0.05
TRUST_CRITIQUE_PENALTY: float = 0.03

# ─── Divergence Engine ───────────────────────────────────────────
DIVERGENCE_SEMANTIC_WEIGHT: float = 0.6
DIVERGENCE_CRITIQUE_WEIGHT: float = 0.4

# ─── Swarm Modes ─────────────────────────────────────────────────
SWARM_MODES = {
    "standard":  {"temperature_modifier": 0.0},
    "creative":  {"temperature_modifier": 0.2},
    "critical":  {"temperature_modifier": -0.15},
}

# ─── Performance Safeguards ──────────────────────────────────────
AGENT_TIMEOUT_SECONDS: float = 180.0
CRITIQUE_TIMEOUT_SECONDS: float = 120.0
MAX_CRITIQUE_PAIRS: int = 20