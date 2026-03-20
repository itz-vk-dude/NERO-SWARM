"""
agents/critic_agent.py — Flaw Identification Agent
Identifies weaknesses, risks, blind spots, and failure modes.
"""
from agents.base_agent import BaseAgent

class CriticAgent(BaseAgent):
    @property
    def name(self) -> str:
        return "Critic"

    @property
    def role(self) -> str:
        return "Identify flaws, risks, and failure modes"

    @property
    def system_prompt(self) -> str:
        return (
            "You are the Critic agent in a multi-agent intelligence swarm. "
            "Your role: identify weaknesses, risks, blind spots, and failure modes in any proposed solution. "
            "Be rigorous and intellectually honest. Point out logical fallacies, hidden assumptions, unintended consequences. "
            "You are not contrarian for sport — your critiques must be substantive and specific. "
            "Rate the severity of each flaw. Be direct and precise."
        )