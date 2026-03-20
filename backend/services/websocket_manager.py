"""
services/websocket_manager.py — WebSocket Connection Manager

Manages active WebSocket connections.
Completely separate from orchestrator — purely infrastructure.

Responsibilities:
  - Track active connections
  - Send events to specific clients
  - Handle connect / disconnect lifecycle
  - Broadcast to all connections (for future multi-client support)

Design notes:
  - One ConnectionManager instance shared across the app (singleton in main.py)
  - Thread-safe: FastAPI/Starlette WebSocket sends are already async-safe
  - Sends SwarmEvent objects serialized as JSON — never raw strings
"""

import logging
from typing import Dict, List, Optional

from fastapi import WebSocket
from schemas.event_schema import SwarmEvent

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections for the swarm streaming endpoint.
    Injected into routes and used as an EventEmitter listener.
    """

    def __init__(self):
        # client_id → WebSocket mapping
        self._connections: Dict[str, WebSocket] = {}

    async def connect(self, client_id: str, websocket: WebSocket) -> None:
        """Accept a new WebSocket connection and register it."""
        await websocket.accept()
        self._connections[client_id] = websocket
        logger.info("WebSocket connected | client_id=%s | total=%d", client_id, len(self._connections))

    async def disconnect(self, client_id: str) -> None:
        """Remove a WebSocket connection (called on close or error)."""
        if client_id in self._connections:
            del self._connections[client_id]
            logger.info("WebSocket disconnected | client_id=%s | remaining=%d", client_id, len(self._connections))

    async def send_event(self, client_id: str, event: SwarmEvent) -> None:
        """
        Send a SwarmEvent to a specific client as JSON.
        Silently handles disconnected clients.
        """
        websocket = self._connections.get(client_id)
        if not websocket:
            logger.warning("send_event: client_id=%s not found (already disconnected?).", client_id)
            return

        try:
            await websocket.send_json(event.dict())
        except Exception as e:
            logger.error("Failed to send event to client_id=%s: %s", client_id, str(e))
            await self.disconnect(client_id)

    async def broadcast_event(self, event: SwarmEvent) -> None:
        """
        Send a SwarmEvent to ALL active connections.
        Used if multiple clients are watching the same swarm.
        """
        disconnected = []
        for client_id, websocket in self._connections.items():
            try:
                await websocket.send_json(event.dict())
            except Exception as e:
                logger.error("Broadcast failed for client_id=%s: %s", client_id, str(e))
                disconnected.append(client_id)

        # Clean up dead connections
        for client_id in disconnected:
            await self.disconnect(client_id)

    def make_listener(self, client_id: str):
        """
        Returns an async callable compatible with EventEmitter.register_listener().
        Closes over client_id so the emitter sends events to the right client.

        Usage:
            emitter.register_listener(manager.make_listener(client_id))
        """
        async def _listener(event: SwarmEvent) -> None:
            await self.send_event(client_id, event)

        return _listener

    @property
    def active_connection_count(self) -> int:
        return len(self._connections)
