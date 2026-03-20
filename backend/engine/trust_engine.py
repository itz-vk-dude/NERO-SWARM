"""
engine/trust_engine.py — Per-Agent Trust Score Engine
Assigns trust scores based on confidence, critique pressure, and consensus alignment.
Output: {"Analyst": 0.81, "Creative": 0.74, ...}
Later: node glow intensity in 3D = trust score.
"""

import logging
from typing import List, Dict

import config
from models.agent_response import AgentResponse
from models.critique_model import Critique

logger = logging.getLogger(__name__)


def compute_trust_scores(
    agent_responses: List[AgentResponse],
    critiques: List[Critique],
    divergence_score: float,
) -> Dict[str, float]:
    """
    Compute per-agent trust scores.

    Factors:
      1. Agent's self-reported confidence (direct signal)
      2. Critique pressure received (agents with many/severe critiques lose trust)
      3. Consensus alignment bonus (agents closer to average position get a boost)
      4. Divergence penalty (in high-divergence swarms, all scores slightly penalized)

    Returns:
        dict mapping agent_name -> trust_score (0.0–1.0)
    """
    if not agent_responses:
        return {}

    # Step 1: Start from initial trust + confidence signal
    scores: Dict[str, float] = {}
    for r in agent_responses:
        # Blend initial trust with agent's confidence
        score = (config.TRUST_INITIAL_SCORE * 0.5) + (r.confidence * 0.5)
        scores[r.agent_name] = score

    # Step 2: Apply critique pressure
    critique_pressure = _compute_critique_pressure(agent_responses, critiques)
    for agent_name, pressure in critique_pressure.items():
        # Each unit of pressure reduces trust by a small amount
        scores[agent_name] = max(0.0, scores[agent_name] - pressure * config.TRUST_CRITIQUE_PENALTY)

    # Step 3: Consensus alignment bonus
    avg_confidence = sum(r.confidence for r in agent_responses) / len(agent_responses)
    for r in agent_responses:
        deviation = abs(r.confidence - avg_confidence)
        if deviation < 0.15:  # close to swarm average = consensus alignment
            scores[r.agent_name] = min(1.0, scores[r.agent_name] + config.TRUST_CONSENSUS_BOOST)

    # Step 4: Global divergence penalty (high disagreement = lower trust all around)
    divergence_penalty = divergence_score * 0.1
    for name in scores:
        scores[name] = max(0.0, scores[name] - divergence_penalty)

    # Step 5: Normalize all scores to 0–1
    scores = {name: round(min(max(s, 0.0), 1.0), 4) for name, s in scores.items()}

    logger.info("Trust scores computed: %s", scores)
    return scores


def _compute_critique_pressure(
    agent_responses: List[AgentResponse],
    critiques: List[Critique],
) -> Dict[str, float]:
    """
    Sum severity of all critiques RECEIVED by each agent.
    Returns dict: agent_name -> total_critique_pressure
    """
    pressure: Dict[str, float] = {r.agent_name: 0.0 for r in agent_responses}
    for c in critiques:
        if c.target_agent in pressure:
            pressure[c.target_agent] += c.severity
    return pressure