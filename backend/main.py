"""
main.py — FastAPI Entry Point
Phase 2: Both REST (POST /swarm) and WebSocket (ws://localhost:8000/ws/swarm) supported.
Phase 1 endpoint preserved. Phase 2 streaming endpoint added.
"""

import logging
import sys

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from schemas.request_schema import SwarmRequest
from models.swarm_state import SwarmState
from engine.orchestrator import run_swarm
from routes.websocket_route import router as websocket_router, set_connection_manager
from services.websocket_manager import ConnectionManager

# ─── Logging ─────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# ─── Shared WebSocket Manager (singleton) ────────────────────────
connection_manager = ConnectionManager()
set_connection_manager(connection_manager)

# ─── FastAPI App ──────────────────────────────────────────────────
app = FastAPI(
    title="Swarm Intelligence Engine",
    description=(
        "Multi-agent swarm intelligence engine. "
        "Phase 1: REST API. Phase 2: Real-time WebSocket streaming."
    ),
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Register Routes ──────────────────────────────────────────────
app.include_router(websocket_router)  # Phase 2: ws://localhost:8000/ws/swarm


# ─── Phase 1 REST Endpoints (preserved) ──────────────────────────

@app.get("/health")
async def health():
    """Health check. Returns active WebSocket connection count."""
    return {
        "status": "ok",
        "service": "swarm-intelligence-engine",
        "version": "2.0.0",
        "active_ws_connections": connection_manager.active_connection_count,
    }


@app.post("/swarm", response_model=SwarmState)
async def run_swarm_endpoint(request: SwarmRequest):
    """
    Phase 1: Static REST endpoint. Returns full SwarmState in one response.
    Preserved for compatibility and testing.
    For real-time streaming, use ws://localhost:8000/ws/swarm.
    """
    logger.info(
        "POST /swarm | mode=%s | prompt='%s...'",
        request.swarm_mode, request.prompt[:60],
    )
    try:
        state = await run_swarm(prompt=request.prompt, swarm_mode=request.swarm_mode)
        return state
    except Exception as e:
        logger.error("Swarm pipeline failed: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Swarm pipeline failed: {str(e)}")


# ─── Dev runner ──────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)