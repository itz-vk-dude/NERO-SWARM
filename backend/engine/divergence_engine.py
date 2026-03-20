"""
engine/divergence_engine.py — Disagreement Measurement Engine
Measures how much the swarm disagrees.
Output divergence_score: 0.0 = full consensus, 1.0 = maximum divergence.
This score will later control beam turbulence in the 3D visualization.
"""

import logging
from typing import List

import config
from models.agent_response import AgentResponse
from models.critique_model import Critique

logger = logging.getLogger(__name__)


def compute_divergence(
    agent_responses: List[AgentResponse],
    critiques: List[Critique],
) -> float:
    """
    Compute divergence score (0–1) from agent responses and critiques.

    Method:
      1. Semantic divergence via word-overlap (Jaccard distance) across all response pairs
      2. Average critique severity across all critiques
      3. Weighted blend using config weights
    """
    if not agent_responses:
        logger.warning("Divergence: no agent responses provided. Returning 0.")
        return 0.0

    semantic_divergence = _compute_semantic_divergence(agent_responses)
    critique_divergence = _compute_critique_divergence(critiques)

    score = (
        config.DIVERGENCE_SEMANTIC_WEIGHT * semantic_divergence
        + config.DIVERGENCE_CRITIQUE_WEIGHT * critique_divergence
    )

    score = round(min(max(score, 0.0), 1.0), 4)
    logger.info(
        "Divergence | semantic=%.3f | critique=%.3f | final=%.4f",
        semantic_divergence, critique_divergence, score,
    )
    return score


def _compute_semantic_divergence(responses: List[AgentResponse]) -> float:
    """
    Measures lexical diversity across agent responses using pairwise Jaccard distance.
    Jaccard distance = 1 - (|A ∩ B| / |A ∪ B|)
    Average over all pairs.
    """
    texts = [r.response.lower() for r in responses]
    token_sets = [set(_tokenize(t)) for t in texts]

    if len(token_sets) < 2:
        return 0.0

    distances = []
    for i in range(len(token_sets)):
        for j in range(i + 1, len(token_sets)):
            a, b = token_sets[i], token_sets[j]
            union = a | b
            if not union:
                distances.append(0.0)
                continue
            intersection = a & b
            jaccard_sim = len(intersection) / len(union)
            distances.append(1.0 - jaccard_sim)  # distance = 1 - similarity

    return round(sum(distances) / len(distances), 4) if distances else 0.0


def _compute_critique_divergence(critiques: List[Critique]) -> float:
    """Average severity of all critiques as proxy for disagreement intensity."""
    if not critiques:
        return 0.0
    avg = sum(c.severity for c in critiques) / len(critiques)
    return round(avg, 4)


def _tokenize(text: str) -> List[str]:
    """Simple whitespace + punctuation tokenizer. No external dependencies."""
    import re
    # Remove punctuation, split on whitespace, filter stopwords
    tokens = re.findall(r"\b[a-z]{3,}\b", text.lower())
    stopwords = {
        "the", "and", "for", "are", "that", "this", "with", "from",
        "can", "will", "have", "not", "they", "been", "also", "more",
        "its", "their", "which", "were", "would", "could", "should",
    }
    return [t for t in tokens if t not in stopwords]