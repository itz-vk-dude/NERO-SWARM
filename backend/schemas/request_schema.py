"""
schemas/request_schema.py — API Input Contract
Validates all incoming swarm requests at the entry point.
"""

from pydantic import BaseModel, Field, validator
from typing import Optional


class SwarmRequest(BaseModel):
    prompt: str = Field(
        ...,
        min_length=10,
        max_length=2000,
        description="The question or problem the swarm will analyze.",
        example="How can cities reduce traffic congestion?",
    )
    swarm_mode: Optional[str] = Field(
        default="standard",
        description="Swarm behavior mode: 'standard', 'creative', or 'critical'",
    )

    @validator("prompt")
    def prompt_must_not_be_blank(cls, v):
        if not v.strip():
            raise ValueError("Prompt must not be blank or whitespace.")
        return v.strip()

    @validator("swarm_mode")
    def swarm_mode_must_be_valid(cls, v):
        valid = {"standard", "creative", "critical"}
        if v not in valid:
            raise ValueError(f"swarm_mode must be one of {valid}. Got: '{v}'")
        return v

    class Config:
        schema_extra = {
            "example": {
                "prompt": "How can cities reduce traffic congestion?",
                "swarm_mode": "standard",
            }
        }