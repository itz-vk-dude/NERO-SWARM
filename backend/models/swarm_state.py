"""
models/swarm_state.py — SwarmState Master Object
THE single truth object that flows through the entire pipeline.
Phase 4 3D UI consumes exactly this structure.
Built incrementally by orchestrator. Returned directly as API response.
"""

from pydantic import BaseModel, Field
from typing import List, Dict
from models.agent_response import AgentResponse
from models.critique_model import Critique


class SwarmState(BaseModel):
    # ── Input ──────────────────────────────────────────────────────
    input_prompt: str = Field(..., description="Original user prompt.")

    # ── Agent Layer ────────────────────────────────────────────────
    agent_responses: List[AgentResponse] = Field(
        default_factory=list,
        description="Ordered list of all 5 agent outputs. Order = AGENT_ORDER in config."
    )

    # ── Critique Layer ─────────────────────────────────────────────
    critiques: List[Critique] = Field(
        default_factory=list,
        description="All cross-agent critiques. n*(n-1) total for n agents."
    )

    # ── Intelligence Layer ─────────────────────────────────────────
    divergence_score: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="0 = full consensus, 1 = maximum swarm disagreement."
    )
    trust_scores: Dict[str, float] = Field(
        default_factory=dict,
        description="Per-agent trust score. Keys = agent names, values 0–1."
    )

    # ── Consensus Layer ────────────────────────────────────────────
    consensus_result: str = Field(
        default="",
        description="Final synthesized answer from consensus engine."
    )
    confidence_score: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="Overall swarm confidence in the consensus."
    )

    # ── Diagnostics ────────────────────────────────────────────────
    metadata: Dict = Field(
        default_factory=dict,
        description="swarm_mode, total_processing_time, agent_count, critique_count, timestamp."
    )