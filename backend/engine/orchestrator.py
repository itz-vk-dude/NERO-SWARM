"""
engine/orchestrator.py — THE HEART of the Swarm
Owns the complete execution pipeline. 10 clean steps. No UI logic. No debug prints.

Flow:
  1. Validate & configure
  2. Initialize agents
  3. Parallel response generation
  4. Collect responses (deterministic order)
  5. Cross-critique generation (each agent critiques all others)
  6. Compute divergence
  7. Compute trust
  8. Generate consensus
  9. Package SwarmState
  10. Return
"""

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import List

import config
from agents.analyst_agent import AnalystAgent
from agents.creative_agent import CreativeAgent
from agents.critic_agent import CriticAgent
from agents.feasibility_agent import FeasibilityAgent
from agents.synthesizer_agent import SynthesizerAgent
from agents.base_agent import BaseAgent
from engine.divergence_engine import compute_divergence
from engine.trust_engine import compute_trust_scores
from engine.consensus_engine import generate_consensus
from models.agent_response import AgentResponse
from models.critique_model import Critique
from models.swarm_state import SwarmState
from services.llm_service import generate_response

logger = logging.getLogger(__name__)


def _build_agents(temperature_modifier: float) -> List[BaseAgent]:
    """
    Initialize agents in AGENT_ORDER (deterministic).
    Order is locked in config — do NOT reorder here.
    """
    agent_map = {
        "Analyst":     AnalystAgent(temperature_modifier),
        "Creative":    CreativeAgent(temperature_modifier),
        "Critic":      CriticAgent(temperature_modifier),
        "Feasibility": FeasibilityAgent(temperature_modifier),
        "Synthesizer": SynthesizerAgent(temperature_modifier),
    }
    return [agent_map[name] for name in config.AGENT_ORDER]


async def _run_agents_parallel(agents: List[BaseAgent], prompt: str) -> List[AgentResponse]:
    """Run all agents concurrently. Collect in AGENT_ORDER (zip preserves order)."""
    tasks = [agent.generate(prompt) for agent in agents]
    responses = await asyncio.gather(*tasks)
    # Re-enforce deterministic ordering (gather preserves task order, but be explicit)
    name_to_response = {r.agent_name: r for r in responses}
    return [name_to_response[name] for name in config.AGENT_ORDER if name in name_to_response]


async def _run_critique_round(
    agents: List[BaseAgent],
    agent_responses: List[AgentResponse],
    prompt: str,
) -> List[Critique]:
    """
    Each agent critiques every other agent's response.
    n*(n-1) critiques total (5 agents = 20 critiques).
    Run all concurrently.
    """
    if not config.ENABLE_CRITIQUE_ROUND:
        logger.info("Critique round disabled in config.")
        return []

    tasks = []
    pairs = []  # track (from_agent, target_agent) for assembly

    for critic_agent in agents:
        for target_response in agent_responses:
            if critic_agent.name == target_response.agent_name:
                continue  # no self-critique

            tasks.append(
                _generate_single_critique(
                    critic_agent=critic_agent,
                    target_response=target_response,
                    original_prompt=prompt,
                )
            )
            pairs.append((critic_agent.name, target_response.agent_name))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    critiques = []
    for (from_name, target_name), result in zip(pairs, results):
        if isinstance(result, Exception):
            logger.error("Critique failed [%s → %s]: %s", from_name, target_name, result)
            # Insert a default critique so the pipeline doesn't break
            critiques.append(Critique(
                from_agent=from_name,
                target_agent=target_name,
                critique_text="[Critique generation failed]",
                severity=0.3,
            ))
        else:
            critiques.append(result)

    logger.info("Critique round complete: %d critiques generated.", len(critiques))
    return critiques


async def _generate_single_critique(
    critic_agent: BaseAgent,
    target_response: AgentResponse,
    original_prompt: str,
) -> Critique:
    """Generate one critique from one agent targeting another agent's response."""
    system = (
        f"You are the {critic_agent.name} agent ({critic_agent.role}). "
        f"You are reviewing another agent's response to a question. "
        f"Identify weaknesses, flaws, gaps, or errors in their response. "
        f"Be specific and substantive. End with:\n"
        f"SEVERITY: [0.0=minor, 1.0=fundamental flaw]"
    )

    user = (
        f"ORIGINAL QUESTION: {original_prompt}\n\n"
        f"RESPONSE FROM [{target_response.agent_name} — {target_response.role}]:\n"
        f"{target_response.response}\n\n"
        f"Provide your critique of this response."
    )

    raw, _ = await generate_response(
        system_prompt=system,
        user_prompt=user,
        temperature=config.CRITIQUE_TEMPERATURE,
    )

    # Parse severity
    import re
    severity = 0.5
    m = re.search(r"SEVERITY:\s*([0-9]*\.?[0-9]+)", raw, re.IGNORECASE)
    if m:
        try:
            severity = round(min(max(float(m.group(1)), 0.0), 1.0), 4)
        except ValueError:
            pass

    # Strip SEVERITY line from critique text
    lines = raw.splitlines()
    critique_text = "\n".join(
        ln for ln in lines
        if not re.match(r"^\s*SEVERITY:", ln, re.IGNORECASE)
    ).strip()

    return Critique(
        from_agent=critic_agent.name,
        target_agent=target_response.agent_name,
        critique_text=critique_text,
        severity=severity,
    )


async def run_swarm(prompt: str, swarm_mode: str = "standard") -> SwarmState:
    """
    MAIN ENTRY POINT — Orchestrates the complete swarm pipeline.

    Steps:
      1.  Configure mode
      2.  Initialize agents (deterministic order)
      3.  Run agents in parallel
      4.  Run critique round in parallel
      5.  Compute divergence
      6.  Compute trust
      7.  Generate consensus
      8.  Package SwarmState
      9.  Return
    """
    pipeline_start = time.perf_counter()
    logger.info("=== SWARM START | mode=%s | prompt_len=%d ===", swarm_mode, len(prompt))

    # ── Step 1: Configure mode ────────────────────────────────────
    mode_config = config.SWARM_MODES.get(swarm_mode, config.SWARM_MODES["standard"])
    temp_modifier = mode_config["temperature_modifier"]

    # ── Step 2: Initialize agents ─────────────────────────────────
    agents = _build_agents(temp_modifier)
    logger.info("Agents initialized: %s", [a.name for a in agents])

    # ── Step 3 & 4: Parallel response + critique rounds ───────────
    agent_responses = await _run_agents_parallel(agents, prompt)
    critiques = await _run_critique_round(agents, agent_responses, prompt)

    # ── Step 5: Divergence ────────────────────────────────────────
    divergence_score = compute_divergence(agent_responses, critiques)

    # ── Step 6: Trust ─────────────────────────────────────────────
    trust_scores = compute_trust_scores(agent_responses, critiques, divergence_score)

    # ── Step 7: Consensus ─────────────────────────────────────────
    consensus_result, confidence_score = await generate_consensus(
        prompt=prompt,
        agent_responses=agent_responses,
        trust_scores=trust_scores,
        divergence_score=divergence_score,
    )

    # ── Step 8: Package SwarmState ────────────────────────────────
    total_time = round(time.perf_counter() - pipeline_start, 3)

    state = SwarmState(
        input_prompt=prompt,
        agent_responses=agent_responses,
        critiques=critiques,
        divergence_score=divergence_score,
        trust_scores=trust_scores,
        consensus_result=consensus_result,
        confidence_score=confidence_score,
        metadata={
            "swarm_mode": swarm_mode,
            "total_processing_time": total_time,
            "agent_count": len(agent_responses),
            "critique_count": len(critiques),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model": config.LLM_MODEL,
        },
    )

    logger.info(
        "=== SWARM COMPLETE | %.3fs | divergence=%.3f | confidence=%.3f ===",
        total_time, divergence_score, confidence_score,
    )

    return state