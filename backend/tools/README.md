# 🧠 Swarm Intelligence Engine — Phase 1 + Phase 2

**Phase 1** = Multi-agent cognitive core (REST API)
**Phase 2** = Real-time event-driven streaming (WebSocket)

Powered by Anthropic Claude.

---

## 📁 Complete Folder Structure

```
backend/
├── main.py                          # FastAPI app — REST + WebSocket
├── config.py                        # ALL constants here (model, timeouts, weights)
├── .env.example                     # Copy to .env, add ANTHROPIC_API_KEY
├── requirements.txt
├── ws_test_client.py                # Phase 2 test client (run while server up)
│
├── schemas/
│   ├── request_schema.py            # SwarmRequest (input validation)
│   ├── response_schema.py           # SwarmResponse (REST output contract)
│   └── event_schema.py              # SwarmEvent (streaming event contract) ← Phase 2
│
├── models/
│   ├── agent_response.py            # Standardized agent output
│   ├── critique_model.py            # Cross-agent critique object
│   └── swarm_state.py               # Master state object (pipeline truth)
│
├── agents/
│   ├── base_agent.py                # Abstract base — all agents inherit this
│   ├── analyst_agent.py             # Logical breakdown
│   ├── creative_agent.py            # Unconventional solutions
│   ├── critic_agent.py              # Flaw identification
│   ├── feasibility_agent.py         # Practical constraints
│   └── synthesizer_agent.py         # Integrator
│
├── engine/
│   ├── orchestrator.py              # Phase 1: static pipeline
│   ├── streaming_orchestrator.py    # Phase 2: event-driven pipeline ← NEW
│   ├── event_emitter.py             # Decoupled event dispatch system ← NEW
│   ├── divergence_engine.py         # Disagreement score (0–1)
│   ├── trust_engine.py              # Per-agent trust scores
│   └── consensus_engine.py          # Weighted final answer
│
├── routes/
│   └── websocket_route.py           # WebSocket endpoint ← NEW
│
└── services/
    ├── llm_service.py               # ONLY place that calls Anthropic API
    └── websocket_manager.py         # WebSocket connection manager ← NEW
```

---

## ⚡ Setup

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env: ANTHROPIC_API_KEY=sk-ant-...
```

---

## 🚀 Running

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 📡 Phase 2 — WebSocket Streaming

Connect to: `ws://localhost:8000/ws/swarm`

**Protocol:**
1. Connect → receive `connection_ready` event
2. Send: `{ "prompt": "...", "swarm_mode": "standard" }`
3. Receive stream of events live

**Test it:**
```bash
pip install websockets
python ws_test_client.py
```

### Event Stream (in order)

```
connection_ready     → you're connected
swarm_started        → pipeline kicked off
agent_started        → one agent begins (×5, parallel)
agent_completed      → one agent done, response included
agent_error          → one agent failed (swarm continues)
critique_started     → one critique pair begins (×20, parallel)
critique_completed   → one critique done, severity included
divergence_updated   → divergence_score: 0.0–1.0
trust_updated        → per-agent trust scores dict
consensus_started    → final synthesis beginning
consensus_ready      → consensus + confidence_score
swarm_completed      → full SwarmState JSON + total time
```

### Event Shape (every event)

```json
{
  "event_id": "uuid4",
  "event_type": "agent_completed",
  "timestamp": "2025-01-01T12:00:01.234Z",
  "payload": { ... }
}
```

---

## 🌐 Phase 1 — REST API (preserved)

```bash
curl -X POST http://localhost:8000/swarm \
  -H "Content-Type: application/json" \
  -d '{"prompt": "How can cities reduce traffic congestion?", "swarm_mode": "standard"}'
```

Returns full `SwarmState` JSON in one response.

---

## 🔧 Config Reference (config.py)

| Constant | Default | Description |
|---|---|---|
| `LLM_MODEL` | `claude-sonnet-4-20250514` | Anthropic model |
| `LLM_TEMPERATURE` | `0.7` | Response creativity |
| `LLM_MAX_TOKENS` | `1200` | Max per response |
| `ENABLE_CRITIQUE_ROUND` | `True` | Toggle critique phase |
| `AGENT_TIMEOUT_SECONDS` | `60.0` | Per-agent timeout |
| `CRITIQUE_TIMEOUT_SECONDS` | `45.0` | Per-critique timeout |
| `DIVERGENCE_SEMANTIC_WEIGHT` | `0.6` | Lexical vs severity weight |
| `TRUST_INITIAL_SCORE` | `0.70` | Starting trust per agent |

---

## 🧠 Architecture

```
Client (WebSocket)
    │
    ▼
websocket_route.py
    │  validates input, creates EventEmitter
    ▼
streaming_orchestrator.py
    │  emits events at every step
    ▼
EventEmitter
    │  dispatches to registered listeners
    ▼
ConnectionManager.make_listener()
    │  sends SwarmEvent JSON to client
    ▼
Client receives live events
```

**Decoupling principle:** Orchestrator never knows about WebSocket.
It only knows about EventEmitter. Future listeners (logging, analytics, DB) plug in the same way.

---

## ✅ Phase 2 Checklist

- [x] WebSocket endpoint live at ws://localhost:8000/ws/swarm
- [x] Agents stream live (started + completed events)
- [x] Critiques stream live (started + completed events)
- [x] Divergence streamed after critique round
- [x] Trust scores streamed
- [x] Consensus streamed
- [x] Full SwarmState in swarm_completed event
- [x] Single agent failure → agent_error event, swarm continues
- [x] EventEmitter decoupled from WebSocket (plug-in listener pattern)
- [x] Every event has event_id + timestamp (frontend-safe)
- [x] Per-agent timeout (60s)
- [x] Per-critique timeout (45s)
- [x] Phase 1 REST endpoint preserved
- [x] Test client included (ws_test_client.py)

**Phase 2 complete. Ready for Phase 3 (frontend) and Phase 4 (3D visualization).**
