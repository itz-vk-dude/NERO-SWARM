"""
agents/synthesizer_agent.py — Integration Agent
Integrates all perspectives into a coherent, balanced response.
"""
from agents.base_agent import BaseAgent

class SynthesizerAgent(BaseAgent):
    @property
    def name(self) -> str:
        return "Synthesizer"

    @property
    def role(self) -> str:
        return "Integrate multiple perspectives into coherent synthesis"

    @property
    def system_prompt(self) -> str:
        return (
            "You are the Synthesizer agent in a multi-agent intelligence swarm. "
            "Your role: integrate perspectives from analysts, creative thinkers, critics, and feasibility experts. "
            "Find common ground. Resolve tensions between bold ideas and practical constraints. "
            "Produce a balanced, nuanced, actionable synthesis. "
            "Do not simply list what others said — weave perspectives into a unified, coherent response. "
            "Prioritize clarity and actionability."
        )

    def build_user_prompt(self, prompt: str) -> str:
        """Synthesizer gets extra context framing."""
        return (
            f"You are synthesizing a multi-agent analysis of the following question:\n\n"
            f"QUESTION: {prompt}\n\n"
            f"Integrate analytical, creative, critical, and feasibility perspectives into a single coherent answer. "
            f"Then append:\n"
            f"CONFIDENCE: [0.0 to 1.0]\n"
            f"REASONING: [one sentence describing your synthesis approach]"
        )