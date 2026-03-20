"""
ws_test_client.py — WebSocket Test Client for Phase 2 Verification

Run this while the server is running to test live streaming.

Usage:
    python ws_test_client.py

Requirements:
    pip install websockets
"""

import asyncio
import json
import sys
import websockets


WS_URL = "ws://localhost:8000/ws/swarm"

TEST_PROMPT = "How can cities reduce traffic congestion?"
TEST_MODE   = "standard"

# ANSI colours for readability
COLORS = {
    "connection_ready":   "\033[92m",   # green
    "swarm_started":      "\033[94m",   # blue
    "agent_started":      "\033[96m",   # cyan
    "agent_completed":    "\033[32m",   # dark green
    "agent_error":        "\033[91m",   # red
    "critique_started":   "\033[95m",   # magenta
    "critique_completed": "\033[35m",   # dark magenta
    "divergence_updated": "\033[93m",   # yellow
    "trust_updated":      "\033[33m",   # dark yellow
    "consensus_started":  "\033[94m",   # blue
    "consensus_ready":    "\033[92m",   # green
    "swarm_completed":    "\033[1;92m", # bold green
    "swarm_error":        "\033[1;91m", # bold red
    "validation_error":   "\033[1;91m", # bold red
}
RESET = "\033[0m"

EVENT_COUNT = 0


def print_event(event: dict):
    global EVENT_COUNT
    EVENT_COUNT += 1
    etype = event.get("event_type", "unknown")
    color = COLORS.get(etype, "\033[37m")
    ts = event.get("timestamp", "")[-12:-1]  # just time portion
    payload = event.get("payload", {})

    print(f"\n{color}[{EVENT_COUNT:02d}] ◆ {etype.upper()}{RESET}  {ts}")

    # Pretty-print key payload fields
    if etype == "agent_started":
        print(f"     → {payload.get('agent_name')} ({payload.get('role')})")

    elif etype == "agent_completed":
        print(f"     → {payload.get('agent_name')} | confidence={payload.get('confidence'):.2f} | {payload.get('processing_time'):.2f}s")
        print(f"     → {payload.get('response', '')[:120]}...")

    elif etype == "agent_error":
        print(f"     ✗ {payload.get('agent_name')}: {payload.get('error')}")

    elif etype == "critique_started":
        print(f"     → {payload.get('from_agent')} ──critiques──▶ {payload.get('target_agent')}")

    elif etype == "critique_completed":
        print(f"     → {payload.get('from_agent')} ▶ {payload.get('target_agent')} | severity={payload.get('severity'):.2f}")

    elif etype == "divergence_updated":
        print(f"     → divergence_score = {payload.get('divergence_score'):.4f}")

    elif etype == "trust_updated":
        scores = payload.get("trust_scores", {})
        for agent, score in scores.items():
            print(f"     → {agent}: {score:.4f}")

    elif etype == "consensus_ready":
        print(f"     → confidence = {payload.get('confidence_score'):.4f}")
        print(f"     → {payload.get('consensus_result', '')[:200]}...")

    elif etype == "swarm_completed":
        total_time = payload.get("total_processing_time", 0)
        state = payload.get("swarm_state", {})
        print(f"     ✔ Complete in {total_time:.2f}s")
        print(f"     ✔ {state.get('metadata', {}).get('agent_count')} agents | "
              f"{state.get('metadata', {}).get('critique_count')} critiques")

    elif etype == "swarm_error":
        print(f"     ✗ Stage: {payload.get('stage')} | Error: {payload.get('error')}")

    else:
        print(f"     → {json.dumps(payload)[:120]}")


async def test_streaming():
    print(f"\n{'='*60}")
    print(f"  Swarm Intelligence Engine — Phase 2 WebSocket Test")
    print(f"{'='*60}")
    print(f"  Connecting to: {WS_URL}")
    print(f"  Prompt: {TEST_PROMPT[:60]}")
    print(f"{'='*60}\n")

    try:
        async with websockets.connect(WS_URL) as ws:
            print("✔ Connected.\n")

            # Wait for connection_ready event
            raw = await ws.recv()
            print_event(json.loads(raw))

            # Send prompt
            payload = json.dumps({"prompt": TEST_PROMPT, "swarm_mode": TEST_MODE})
            await ws.send(payload)
            print(f"\n→ Prompt sent. Listening for events...\n{'─'*60}")

            # Receive events until swarm_completed or swarm_error
            while True:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=120)
                    event = json.loads(raw)
                    print_event(event)

                    etype = event.get("event_type")
                    if etype in ("swarm_completed", "swarm_error"):
                        print(f"\n{'='*60}")
                        print(f"  Total events received: {EVENT_COUNT}")
                        print(f"{'='*60}\n")
                        break

                except asyncio.TimeoutError:
                    print("\n✗ Timeout: no event received in 120s.")
                    break

    except ConnectionRefusedError:
        print("✗ Connection refused. Is the server running?")
        print("  Run: uvicorn main:app --reload")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(test_streaming())
