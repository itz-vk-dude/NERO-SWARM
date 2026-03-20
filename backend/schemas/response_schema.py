"""
schemas/response_schema.py — API Output Contract
Prevents frontend/backend mismatch. This is the public-facing response type.
"""

from pydantic import BaseModel, Field
from typing import List, Dict


class AgentResponseOut(BaseModel):
    agent_name: str
    role: str
    response: str
    confidence: float
    reasoning_summary: str
    processing_time: float


class CritiqueOut(BaseModel):
    from_agent: str
    target_agent: str
    critique_text: str
    severity: float


class SwarmResponse(BaseModel):
    input_prompt: str = Field(..., description="Original user prompt.")
    agent_responses: List[AgentResponseOut] = Field(..., description="All 5 agent outputs in order.")
    critiques: List[CritiqueOut] = Field(..., description="All cross-agent critiques.")
    divergence_score: float = Field(..., ge=0.0, le=1.0, description="0=consensus, 1=max disagreement.")
    trust_scores: Dict[str, float] = Field(..., description="Per-agent trust score (0–1).")
    consensus_result: str = Field(..., description="Final synthesized answer.")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Overall swarm confidence.")
    metadata: Dict = Field(default_factory=dict, description="Timing, mode, diagnostics.")

    class Config:
        schema_extra = {
            "example": {
                "input_prompt": "How can cities reduce traffic congestion?",
                "agent_responses": [],
                "critiques": [],
                "divergence_score": 0.34,
                "trust_scores": {"Analyst": 0.81, "Creative": 0.74},
                "consensus_result": "Cities can reduce traffic congestion through...",
                "confidence_score": 0.87,
                "metadata": {"swarm_mode": "standard", "total_processing_time": 12.4},
            }
        }