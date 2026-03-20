"""
engine/consensus_engine.py — Final Answer Generation Engine
Produces the swarm's final consensus answer using weighted synthesis via LLM.
Inputs: agent responses, trust scores, divergence score.
Outputs: (consensus_result: str, confidence_score: float)
"""

import logging
from typing import List, Dict, Tuple

import config
from models.agent_response import AgentResponse
from models.critique_model import Critique
from services.llm_service import generate_response

logger = logging.getLogger(__name__)


async def generate_consensus(
    prompt: str,
    agent_responses: List[AgentResponse],
    trust_scores: Dict[str, float],
    divergence_score: float,
) -> Tuple[str, float]:
    """
    Generate final consensus answer using trust-weighted synthesis.

    Method:
      1. Build a synthesis prompt that includes all agent outputs ranked by trust
      2. Ask LLM to produce unified final answer
      3. Compute overall confidence from agent confidences + trust + divergence penalty

    Returns:
        (consensus_text, overall_confidence_score)
    """
    synthesis_prompt = _build_synthesis_prompt(
        prompt=prompt,
        agent_responses=agent_responses,
        trust_scores=trust_scores,
        divergence_score=divergence_score,
    )

    system = (
        "You are a master synthesizer. You receive outputs from 5 specialized AI agents "
        "along with their trust scores and divergence context. "
        "Your task: produce the single best, most comprehensive, and actionable answer. "
        "Weight higher-trust agents more heavily. Resolve conflicts intelligently. "
        "Do NOT list agents or attribute ideas — produce a unified expert answer. "
        "End with:\nCONFIDENCE: [0.0 to 1.0 reflecting your certainty in this synthesis]"
    )

    logger.info("Consensus engine generating final synthesis...")
    raw, _ = await generate_response(
        system_prompt=system,
        user_prompt=synthesis_prompt,
        temperature=0.4,  # lower temp for more focused consensus
    )

    consensus_text, llm_confidence = _parse_consensus_output(raw)
    overall_confidence = _compute_overall_confidence(
        agent_responses=agent_responses,
        trust_scores=trust_scores,
        divergence_score=divergence_score,
        llm_confidence=llm_confidence,
    )

    logger.info("Consensus done | confidence=%.4f", overall_confidence)
    return consensus_text, overall_confidence


def _build_synthesis_prompt(
    prompt: str,
    agent_responses: List[AgentResponse],
    trust_scores: Dict[str, float],
    divergence_score: float,
) -> str:
    """Build the prompt given to the consensus LLM call."""
    lines = [
        f"ORIGINAL QUESTION: {prompt}",
        f"SWARM DIVERGENCE: {divergence_score:.2f} (0=consensus, 1=maximum disagreement)",
        "",
        "AGENT OUTPUTS (sorted by trust score, highest first):",
        "",
    ]

    # Sort agents by trust score descending so LLM naturally weights higher-trust agents
    sorted_responses = sorted(
        agent_responses,
        key=lambda r: trust_scores.get(r.agent_name, 0.5),
        reverse=True,
    )

    for r in sorted_responses:
        trust = trust_scores.get(r.agent_name, 0.5)
        lines.append(f"[{r.agent_name} | Trust: {trust:.2f} | Confidence: {r.confidence:.2f}]")
        lines.append(r.response)
        lines.append("")

    lines.append(
        "Synthesize the above into the single best answer to the original question. "
        "Prioritize insights from higher-trust agents. Resolve any contradictions intelligently."
    )

    return "\n".join(lines)


def _parse_consensus_output(raw: str) -> Tuple[str, float]:
    """Extract confidence line and clean consensus text."""
    import re
    m = re.search(r"CONFIDENCE:\s*([0-9]*\.?[0-9]+)", raw, re.IGNORECASE)
    llm_confidence = 0.75
    if m:
        try:
            llm_confidence = round(min(max(float(m.group(1)), 0.0), 1.0), 4)
        except ValueError:
            pass

    lines = raw.splitlines()
    cleaned = [
        ln for ln in lines
        if not __import__("re").match(r"^\s*CONFIDENCE:", ln, __import__("re").IGNORECASE)
    ]
    consensus_text = "\n".join(cleaned).strip()
    return consensus_text, llm_confidence


def _compute_overall_confidence(
    agent_responses: List[AgentResponse],
    trust_scores: Dict[str, float],
    divergence_score: float,
    llm_confidence: float,
) -> float:
    """
    Weighted confidence formula:
      - 40%: trust-weighted average of agent confidences
      - 40%: LLM's own confidence in the synthesis
      - 20%: divergence penalty (high divergence = lower confidence)
    """
    if not agent_responses:
        return llm_confidence

    # Trust-weighted agent confidence
    total_trust = sum(trust_scores.get(r.agent_name, 0.5) for r in agent_responses)
    if total_trust == 0:
        weighted_conf = sum(r.confidence for r in agent_responses) / len(agent_responses)
    else:
        weighted_conf = sum(
            r.confidence * trust_scores.get(r.agent_name, 0.5)
            for r in agent_responses
        ) / total_trust

    divergence_penalty = divergence_score * config.DIVERGENCE_PENALTY

    overall = (
        config.CONFIDENCE_WEIGHT * weighted_conf
        + config.TRUST_WEIGHT * llm_confidence
        - divergence_penalty
    )

    return round(min(max(overall, 0.0), 1.0), 4)