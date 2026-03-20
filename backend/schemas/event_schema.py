"""
schemas/event_schema.py — Standardized Streaming Event Schema
EVERY event emitted by the swarm follows this structure.
Lock this now — frontend depends on it in Phase 4.

Event types:
  swarm_started         → swarm kicked off
  agent_started         → one agent beginning generation
  agent_completed       → one agent finished (includes response)
  agent_error           → one agent failed (swarm continues)
  critique_started      → one critique pair beginning
  critique_completed    → one critique pair finished
  divergence_updated    → divergence score ready
  trust_updated         → trust scores ready
  consensus_started     → consensus generation beginning
  consensus_ready       → final consensus produced
  swarm_completed       → full SwarmState, pipeline done
  swarm_error           → unrecoverable pipeline failure
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class SwarmEvent(BaseModel):
    """
    Master event envelope. Every event streamed to the client is this shape.
    Never send raw strings or unstructured dicts over the WebSocket.
    """

    event_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Unique ID for this event. Useful for deduplication in frontend.",
    )
    event_type: str = Field(
        ...,
        description="Type identifier. One of the defined event type strings above.",
    )
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO 8601 UTC timestamp of when this event was emitted.",
    )
    payload: Dict[str, Any] = Field(
        default_factory=dict,
        description="Event-specific data. Structure varies by event_type.",
    )

    class Config:
        schema_extra = {
            "example": {
                "event_id": "3f7a1b2c-...",
                "event_type": "agent_completed",
                "timestamp": "2025-01-01T12:00:01.234Z",
                "payload": {
                    "agent_name": "Analyst",
                    "confidence": 0.82,
                    "processing_time": 1.34,
                },
            }
        }


# ─── Payload shape reference (documentation — not enforced at runtime) ──────
#
# swarm_started:
#   { prompt: str, swarm_mode: str, agent_count: int }
#
# agent_started:
#   { agent_name: str, role: str }
#
# agent_completed:
#   { agent_name: str, role: str, confidence: float,
#     reasoning_summary: str, processing_time: float, response: str }
#
# agent_error:
#   { agent_name: str, error: str }
#
# critique_started:
#   { from_agent: str, target_agent: str }
#
# critique_completed:
#   { from_agent: str, target_agent: str, severity: float, critique_text: str }
#
# divergence_updated:
#   { divergence_score: float }
#
# trust_updated:
#   { trust_scores: dict[str, float] }
#
# consensus_started:
#   {}
#
# consensus_ready:
#   { consensus_result: str, confidence_score: float }
#
# swarm_completed:
#   { swarm_state: <full SwarmState dict>, total_processing_time: float }
#
# swarm_error:
#   { error: str, stage: str }