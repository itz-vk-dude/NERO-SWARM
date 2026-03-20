"""
engine/event_emitter.py — Central Event Dispatch System

DESIGN PRINCIPLE:
  Orchestrator → emits events via EventEmitter
  EventEmitter → dispatches to all registered async listeners
  WebSocket Manager → is just one listener

This decoupling means you can later add:
  - Logging listeners
  - Analytics listeners
  - Monitoring listeners
  - Database write listeners
  ...without ever touching the orchestrator again.

Usage:
  emitter = EventEmitter()
  emitter.register_listener(my_async_callback)
  await emitter.emit("agent_started", {"agent_name": "Analyst"})
"""

import logging
from typing import Any, Callable, Coroutine, Dict, List

from schemas.event_schema import SwarmEvent

logger = logging.getLogger(__name__)

# Type alias: listeners are async callables that receive a SwarmEvent
AsyncListener = Callable[[SwarmEvent], Coroutine[Any, Any, None]]


class EventEmitter:
    """
    Async event emitter.
    Orchestrator uses one instance per swarm run.
    Listeners registered before pipeline starts receive all events in order.
    """

    def __init__(self):
        self._listeners: List[AsyncListener] = []

    def register_listener(self, listener: AsyncListener) -> None:
        """
        Register an async callback to receive all emitted events.
        Call this before starting the swarm pipeline.
        """
        self._listeners.append(listener)
        logger.debug("EventEmitter: listener registered (%d total).", len(self._listeners))

    def clear_listeners(self) -> None:
        """Remove all registered listeners. Called after pipeline completes."""
        self._listeners.clear()

    async def emit(self, event_type: str, payload: Dict[str, Any] = None) -> None:
        """
        Emit a structured event to all registered listeners.

        Args:
            event_type: One of the defined event type strings (see event_schema.py).
            payload:    Dict of event-specific data.

        Guarantees:
            - Event is always a valid SwarmEvent (auto-stamped with id + timestamp)
            - Listener failures are caught and logged — never crash the pipeline
            - Listeners called sequentially (order = registration order)
        """
        event = SwarmEvent(
            event_type=event_type,
            payload=payload or {},
        )

        logger.debug("Emitting [%s] | payload_keys=%s", event_type, list(event.payload.keys()))

        for listener in self._listeners:
            try:
                await listener(event)
            except Exception as e:
                # Listener failure MUST NOT crash orchestrator
                logger.error(
                    "EventEmitter: listener failed on [%s]: %s",
                    event_type, str(e), exc_info=True,
                )
