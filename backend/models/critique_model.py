"""
models/critique_model.py — Cross-Agent Critique Object
Powers divergence calculation and future 3D beam intensity.
severity: 0.0 = minor quibble, 1.0 = fundamental flaw.
"""

from pydantic import BaseModel, Field, validator


class Critique(BaseModel):
    from_agent: str = Field(..., description="Agent delivering the critique.")
    target_agent: str = Field(..., description="Agent being critiqued.")
    critique_text: str = Field(..., description="Full critique content.")
    severity: float = Field(
        ..., ge=0.0, le=1.0,
        description="Severity 0–1. Used in divergence engine and 3D beam intensity."
    )

    @validator("severity", pre=True)
    def normalize_severity(cls, v):
        try:
            return round(min(max(float(v), 0.0), 1.0), 4)
        except (TypeError, ValueError):
            return 0.5

    @validator("target_agent")
    def no_self_critique(cls, v, values):
        if "from_agent" in values and v == values["from_agent"]:
            raise ValueError(f"Agent '{v}' cannot critique itself.")
        return v