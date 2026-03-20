"""
routes/websocket_route.py — WebSocket Streaming Endpoint

ws://localhost:8000/ws/swarm

Protocol:
  1. Client connects → receives connection_ready event
  2. Client sends JSON: { "prompt": "...", "swarm_mode": "standard" }
  3. Server validates input
  4. Server runs streaming swarm pipeline
  5. Server emits events live (agent_started, agent_completed, critiques, etc.)
  6. Server emits swarm_completed with full SwarmState
  7. Connection stays open for further prompts, or client disconnects

Error handling:
  - Invalid JSON from client → sends error event, closes connection
  - Invalid prompt → sends validation_error event, keeps connection open
  - Pipeline failure → sends swarm_error event, closes connection
  - Client disconnects mid-run → pipeline continues until next emit fails
"""

import json
import logging
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

import config
from engine.event_emitter import EventEmitter
from engine.streaming_orchestrator import run_swarm_streaming
from schemas.event_schema import SwarmEvent
from schemas.request_schema import SwarmRequest
from services.websocket_manager import ConnectionManager

logger = logging.getLogger(__name__)

router = APIRouter()

# ─── Shared connection manager (injected from main.py) ───────────────────────
# Declared here, set by main.py at startup via set_connection_manager()
_manager: ConnectionManager = None


def set_connection_manager(manager: ConnectionManager) -> None:
    """Called by main.py at startup to inject the shared ConnectionManager."""
    global _manager
    _manager = manager


# ─── WebSocket Endpoint ───────────────────────────────────────────────────────

@router.websocket("/ws/swarm")
async def websocket_swarm_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for live swarm intelligence streaming.

    Client sends:
      { "prompt": "...", "swarm_mode": "standard" }

    Server emits a stream of SwarmEvent objects as JSON.
    """
    client_id = str(uuid.uuid4())

    # ── Connect ───────────────────────────────────────────────────
    await _manager.connect(client_id, websocket)
    logger.info("New WebSocket client | client_id=%s", client_id)

    # Notify client it's ready
    await _manager.send_event(client_id, SwarmEvent(
        event_type="connection_ready",
        payload={"client_id": client_id, "message": "Connected. Send your prompt."},
    ))

    try:
        # ── Message loop ──────────────────────────────────────────
        while True:
            raw = await websocket.receive_text()

            # ── Parse input ───────────────────────────────────────
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await _manager.send_event(client_id, SwarmEvent(
                    event_type="validation_error",
                    payload={"error": "Invalid JSON. Send: {\"prompt\": \"...\", \"swarm_mode\": \"standard\"}"},
                ))
                continue

            # ── Handle heartbeat ping ─────────────────────────────
            if data.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                continue

            # ── Validate with SwarmRequest schema ─────────────────
            try:
                request = SwarmRequest(**data)
            except (ValidationError, Exception) as e:
                await _manager.send_event(client_id, SwarmEvent(
                    event_type="validation_error",
                    payload={"error": str(e)},
                ))
                continue

            # ── Build EventEmitter with this client's listener ────
            emitter = EventEmitter()
            emitter.register_listener(_manager.make_listener(client_id))

            # ── Run streaming swarm ───────────────────────────────
            logger.info(
                "Starting swarm for client_id=%s | mode=%s | prompt='%s...'",
                client_id, request.swarm_mode, request.prompt[:60],
            )

            try:
                await run_swarm_streaming(
                    prompt=request.prompt,
                    swarm_mode=request.swarm_mode,
                    emitter=emitter,
                )
            except Exception as e:
                logger.error(
                    "Swarm pipeline failed for client_id=%s: %s", client_id, str(e)
                )
                # swarm_error already emitted inside streaming_orchestrator
                # Close the connection on fatal failure
                await websocket.close(code=1011, reason="Swarm pipeline failed")
                return
            finally:
                emitter.clear_listeners()

            # Pipeline complete — connection stays open for next prompt

    except WebSocketDisconnect:
        logger.info("Client disconnected | client_id=%s", client_id)

    except Exception as e:
        logger.error("WebSocket error for client_id=%s: %s", client_id, str(e), exc_info=True)

    finally:
        await _manager.disconnect(client_id)