"""
models/agent_response.py — Standardized Agent Output Model
Every agent returns EXACTLY this structure. No exceptions.
"""

from pydantic import BaseModel, Field, validator


class AgentResponse(BaseModel):
    agent_name: str = Field(..., description="Agent identifier (e.g. 'Analyst').")
    role: str = Field(..., description="Short role description of this agent.")
    response: str = Field(..., description="Full response text from the agent.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Self-reported confidence (0–1).")
    reasoning_summary: str = Field(..., description="One-sentence summary of reasoning approach.")
    processing_time: float = Field(..., ge=0.0, description="Seconds taken to generate response.")

    @validator("confidence", pre=True)
    def normalize_confidence(cls, v):
        try:
            return round(min(max(float(v), 0.0), 1.0), 4)
        except (TypeError, ValueError):
            return 0.7

    @validator("processing_time", pre=True)
    def clamp_processing_time(cls, v):
        return max(float(v), 0.0)