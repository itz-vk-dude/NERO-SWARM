"""
engine/streaming_orchestrator.py — Event-Driven Swarm Orchestrator (Phase 2)

Extends Phase 1 orchestrator with full real-time event emission.
Phase 1 run_swarm() is PRESERVED — this is a clean extension, not a replacement.

Execution order (16 steps):
  1.  emit(swarm_started)
  2.  Initialize agents
  3.  Launch all agents in parallel with per-agent emit wrappers
  4.  emit(agent_started) before each agent
  5.  emit(agent_completed) or emit(agent_error) after each agent
  6.  Collect agent responses (deterministic order)
  7.  Run critique round with per-critique emit wrappers
  8.  emit(critique_started) + emit(critique_completed) per pair
  9.  Compute divergence → emit(divergence_updated)
  10. Compute trust → emit(trust_updated)
  11. emit(consensus_started)
  12. Generate consensus → emit(consensus_ready)
  13. Package SwarmState
  14. emit(swarm_completed)

Error contract:
  - Single agent failure → emit(agent_error) → continue with remaining agents
  - Single critique failure → emit(critique_completed) with severity=0.3 fallback
  - Consensus failure → emit(swarm_error) → re-raise (fatal)
  - Unhandled exception → emit(swarm_error) → re-raise

Performance safeguards:
  - Per-agent timeout (config.AGENT_TIMEOUT_SECONDS)
  - Per-critique timeout (config.CRITIQUE_TIMEOUT_SECONDS)
  - Parallel execution via asyncio.gather with return_exceptions=True
"""

import asyncio
import logging
import re
import time
from datetime import datetime, timezone
from typing import List, Optional, Tuple

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
from engine.event_emitter import EventEmitter
from models.agent_response import AgentResponse
from models.critique_model import Critique
from models.swarm_state import SwarmState
from services.llm_service import generate_response

logger = logging.getLogger(__name__)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _build_agents(temperature_modifier: float) -> List[BaseAgent]:
    """Initialize agents in deterministic AGENT_ORDER from config."""
    agent_map = {
        "Analyst":     AnalystAgent(temperature_modifier),
        "Creative":    CreativeAgent(temperature_modifier),
        "Critic":      CriticAgent(temperature_modifier),
        "Feasibility": FeasibilityAgent(temperature_modifier),
        "Synthesizer": SynthesizerAgent(temperature_modifier),
    }
    return [agent_map[name] for name in config.AGENT_ORDER]


# ─── Agent execution with event emission ─────────────────────────────────────

async def _run_agent_with_events(
    agent: BaseAgent,
    prompt: str,
    emitter: EventEmitter,
) -> Optional[AgentResponse]:
    """
    Run a single agent, emitting started/completed/error events.
    Returns AgentResponse on success, None on failure.
    Never raises — errors are captured and emitted.
    """
    await emitter.emit("agent_started", {
        "agent_name": agent.name,
        "role": agent.role,
    })

    try:
        response = await asyncio.wait_for(
            agent.generate(prompt),
            timeout=config.AGENT_TIMEOUT_SECONDS,
        )

        await emitter.emit("agent_completed", {
            "agent_name": response.agent_name,
            "role": response.role,
            "confidence": response.confidence,
            "reasoning_summary": response.reasoning_summary,
            "processing_time": response.processing_time,
            "response": response.response,
        })

        return response

    except asyncio.TimeoutError:
        logger.error("Agent [%s] timed out after %ds.", agent.name, config.AGENT_TIMEOUT_SECONDS)
        await emitter.emit("agent_error", {
            "agent_name": agent.name,
            "error": f"Agent timed out after {config.AGENT_TIMEOUT_SECONDS}s.",
        })
        return None

    except Exception as e:
        logger.error("Agent [%s] failed: %s", agent.name, str(e), exc_info=True)
        await emitter.emit("agent_error", {
            "agent_name": agent.name,
            "error": str(e),
        })
        return None


async def _run_all_agents_parallel(
    agents: List[BaseAgent],
    prompt: str,
    emitter: EventEmitter,
) -> List[AgentResponse]:
    """
    Launch all agents concurrently.
    Each agent emits its own started/completed/error events.
    Returns only successful responses in deterministic AGENT_ORDER.
    """
    # Semaphore limits concurrent LLM calls — set AGENT_CONCURRENCY=1 for local Ollama
    sem = asyncio.Semaphore(config.AGENT_CONCURRENCY)

    async def _run_with_sem(agent):
        async with sem:
            return await _run_agent_with_events(agent, prompt, emitter)

    tasks = [_run_with_sem(agent) for agent in agents]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Build name → response map, filtering None (failed agents) and exceptions
    name_to_response = {}
    for agent, result in zip(agents, results):
        if isinstance(result, Exception):
            logger.error("Gather exception for agent [%s]: %s", agent.name, result)
        elif result is not None:
            name_to_response[result.agent_name] = result

    # Return in deterministic order
    return [name_to_response[name] for name in config.AGENT_ORDER if name in name_to_response]


# ─── Critique execution with event emission ───────────────────────────────────

async def _run_single_critique_with_events(
    critic_agent: BaseAgent,
    target_response: AgentResponse,
    original_prompt: str,
    emitter: EventEmitter,
) -> Critique:
    """
    Generate one critique with started/completed events.
    On failure, emits critique_completed with fallback severity and continues.
    """
    await emitter.emit("critique_started", {
        "from_agent": critic_agent.name,
        "target_agent": target_response.agent_name,
    })

    try:
        critique = await asyncio.wait_for(
            _generate_single_critique(critic_agent, target_response, original_prompt),
            timeout=config.CRITIQUE_TIMEOUT_SECONDS,
        )

        await emitter.emit("critique_completed", {
            "from_agent": critique.from_agent,
            "target_agent": critique.target_agent,
            "severity": critique.severity,
            "critique_text": critique.critique_text,
        })

        return critique

    except asyncio.TimeoutError:
        logger.warning(
            "Critique [%s → %s] timed out. Using fallback.",
            critic_agent.name, target_response.agent_name,
        )
        fallback = Critique(
            from_agent=critic_agent.name,
            target_agent=target_response.agent_name,
            critique_text="[Critique timed out]",
            severity=0.3,
        )
        await emitter.emit("critique_completed", {
            "from_agent": fallback.from_agent,
            "target_agent": fallback.target_agent,
            "severity": fallback.severity,
            "critique_text": fallback.critique_text,
        })
        return fallback

    except Exception as e:
        logger.error(
            "Critique [%s → %s] failed: %s",
            critic_agent.name, target_response.agent_name, str(e),
        )
        fallback = Critique(
            from_agent=critic_agent.name,
            target_agent=target_response.agent_name,
            critique_text=f"[Critique failed: {str(e)}]",
            severity=0.3,
        )
        await emitter.emit("critique_completed", {
            "from_agent": fallback.from_agent,
            "target_agent": fallback.target_agent,
            "severity": fallback.severity,
            "critique_text": fallback.critique_text,
        })
        return fallback


async def _run_critique_round_with_events(
    agents: List[BaseAgent],
    agent_responses: List[AgentResponse],
    prompt: str,
    emitter: EventEmitter,
) -> List[Critique]:
    """
    Run all cross-agent critiques in parallel (n*(n-1) pairs).
    Each critique pair emits started + completed events.
    """
    if not config.ENABLE_CRITIQUE_ROUND:
        logger.info("Critique round disabled in config.")
        return []

    tasks = []
    for critic_agent in agents:
        for target_response in agent_responses:
            if critic_agent.name == target_response.agent_name:
                continue
            tasks.append(
                _run_single_critique_with_events(
                    critic_agent=critic_agent,
                    target_response=target_response,
                    original_prompt=prompt,
                    emitter=emitter,
                )
            )

    # Semaphore limits concurrent critiques — set CRITIQUE_CONCURRENCY=2 for local Ollama
    sem = asyncio.Semaphore(config.CRITIQUE_CONCURRENCY)

    async def _with_sem(coro):
        async with sem:
            return await coro

    results = await asyncio.gather(*[_with_sem(t) for t in tasks], return_exceptions=True)

    critiques = []
    for result in results:
        if isinstance(result, Exception):
            logger.error("Critique gather exception: %s", result)
        elif result is not None:
            critiques.append(result)

    logger.info("Critique round complete: %d critiques generated.", len(critiques))
    return critiques


# ─── Single critique generation (pure logic, no events) ──────────────────────

async def _generate_single_critique(
    critic_agent: BaseAgent,
    target_response: AgentResponse,
    original_prompt: str,
) -> Critique:
    """Pure LLM critique generation. No event emission here."""
    system = (
        f"You are the {critic_agent.name} agent ({critic_agent.role}). "
        f"Review another agent's response. Identify weaknesses, flaws, gaps, or errors. "
        f"Be specific and substantive. End your response with:\n"
        f"SEVERITY: [0.0=minor, 1.0=fundamental flaw]"
    )
    user = (
        f"ORIGINAL QUESTION: {original_prompt}\n\n"
        f"RESPONSE FROM [{target_response.agent_name} — {target_response.role}]:\n"
        f"{target_response.response}\n\n"
        f"Provide your critique."
    )

    raw, _ = await generate_response(
        system_prompt=system,
        user_prompt=user,
        temperature=config.CRITIQUE_TEMPERATURE,
    )

    severity = 0.5
    m = re.search(r"SEVERITY:\s*([0-9]*\.?[0-9]+)", raw, re.IGNORECASE)
    if m:
        try:
            severity = round(min(max(float(m.group(1)), 0.0), 1.0), 4)
        except ValueError:
            pass

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


# ─── MAIN ENTRY POINT ────────────────────────────────────────────────────────

async def run_swarm_streaming(
    prompt: str,
    swarm_mode: str,
    emitter: EventEmitter,
) -> SwarmState:
    """
    Event-driven swarm pipeline. Emits structured events at every stage.

    Args:
        prompt:     User prompt to analyze.
        swarm_mode: One of 'standard', 'creative', 'critical'.
        emitter:    Pre-configured EventEmitter with listeners registered.

    Returns:
        Complete SwarmState (also emitted as swarm_completed event payload).

    Raises:
        Exception: Only on fatal unrecoverable failures (consensus failure, etc.)
                   Always emits swarm_error before raising.
    """
    pipeline_start = time.perf_counter()
    logger.info("=== STREAMING SWARM START | mode=%s ===", swarm_mode)

    try:
        # ── Step 1: Configure mode ────────────────────────────────
        mode_config = config.SWARM_MODES.get(swarm_mode, config.SWARM_MODES["standard"])
        temp_modifier = mode_config["temperature_modifier"]

        # ── Step 2: Initialize agents ─────────────────────────────
        agents = _build_agents(temp_modifier)

        await emitter.emit("swarm_started", {
            "prompt": prompt,
            "swarm_mode": swarm_mode,
            "agent_count": len(agents),
            "agent_names": [a.name for a in agents],
        })

        # ── Step 3–5: Parallel agents with events ─────────────────
        agent_responses = await _run_all_agents_parallel(agents, prompt, emitter)

        if not agent_responses:
            await emitter.emit("swarm_error", {
                "error": "All agents failed. Cannot continue.",
                "stage": "agent_execution",
            })
            raise RuntimeError("All agents failed. Cannot continue swarm pipeline.")

        # ── Step 6–8: Critique round with events ──────────────────
        critiques = await _run_critique_round_with_events(
            agents, agent_responses, prompt, emitter
        )

        # ── Step 9: Divergence ────────────────────────────────────
        divergence_score = compute_divergence(agent_responses, critiques)
        await emitter.emit("divergence_updated", {
            "divergence_score": divergence_score,
        })

        # ── Step 10: Trust ────────────────────────────────────────
        trust_scores = compute_trust_scores(agent_responses, critiques, divergence_score)
        await emitter.emit("trust_updated", {
            "trust_scores": trust_scores,
        })

        # ── Step 11: Consensus ────────────────────────────────────
        await emitter.emit("consensus_started", {})

        consensus_result, confidence_score = await generate_consensus(
            prompt=prompt,
            agent_responses=agent_responses,
            trust_scores=trust_scores,
            divergence_score=divergence_score,
        )

        await emitter.emit("consensus_ready", {
            "consensus_result": consensus_result,
            "confidence_score": confidence_score,
        })

        # ── Step 12: Package SwarmState ───────────────────────────
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

        # ── Step 13: Final event ──────────────────────────────────
        await emitter.emit("swarm_completed", {
            "swarm_state": state.dict(),
            "total_processing_time": total_time,
        })

        logger.info(
            "=== STREAMING SWARM COMPLETE | %.3fs | divergence=%.3f | confidence=%.3f ===",
            total_time, divergence_score, confidence_score,
        )

        return state

    except Exception as e:
        total_time = round(time.perf_counter() - pipeline_start, 3)
        logger.error("Streaming swarm pipeline failed at %.3fs: %s", total_time, str(e), exc_info=True)
        # Emit error event before re-raising so client knows what happened
        try:
            await emitter.emit("swarm_error", {
                "error": str(e),
                "stage": "pipeline",
                "elapsed": total_time,
            })
        except Exception:
            pass  # Don't let error emission mask original error
        raise