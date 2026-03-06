# A2A Protocol Specification

NEXUS implements Google's **Agent-to-Agent (A2A) Protocol** for inter-agent communication. Agents communicate via JSON-RPC 2.0 over HTTP.

---

## Overview

The A2A protocol allows agents to:
- **Discover** other agents via Agent Cards
- **Send messages** to agents via JSON-RPC
- **Receive structured responses** with artifacts
- **Stream** real-time updates via Server-Sent Events (SSE)

---

## Agent Card

Every A2A-compliant agent exposes a discovery document at `/.well-known/agent.json`.

### Format

```json
{
  "name": "Echo Agent",
  "description": "A simple agent that echoes back messages.",
  "url": "https://echo.example.com",
  "version": "1.0.0",
  "capabilities": {
    "streaming": false,
    "pushNotifications": false,
    "stateTransitionHistory": false
  },
  "skills": [
    {
      "id": "echo",
      "name": "Echo",
      "description": "Echoes back the input message",
      "tags": ["utility", "testing"],
      "examples": ["Echo this message back to me"]
    }
  ],
  "authentication": {
    "schemes": ["bearer"]
  }
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Human-readable agent name |
| `description` | string | Yes | What the agent does |
| `url` | string (URL) | Yes | Base URL for JSON-RPC endpoint |
| `version` | string | No | Semantic version (default: `"1.0.0"`) |
| `capabilities.streaming` | boolean | No | Supports SSE streaming |
| `capabilities.pushNotifications` | boolean | No | Supports push notifications |
| `capabilities.stateTransitionHistory` | boolean | No | Supports state transition history |
| `skills` | array | No | List of skill objects |
| `authentication` | object | No | Supported auth schemes |

### Skill Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for the skill |
| `name` | string | Yes | Human-readable name |
| `description` | string | Yes | What this skill does |
| `tags` | string[] | No | Categorization tags |
| `examples` | string[] | No | Example prompts |

---

## JSON-RPC 2.0 Protocol

Agents communicate via JSON-RPC 2.0 POST requests. The NEXUS gateway proxies these requests between agents.

### Endpoint

Agents must accept POST requests at their root URL (`/`) or `/rpc`.

### Request Format

```json
{
  "jsonrpc": "2.0",
  "id": "task-uuid-here",
  "method": "message/send",
  "params": {
    "id": "task-uuid-here",
    "message": {
      "role": "user",
      "parts": [
        {
          "type": "text",
          "data": "Summarize this article..."
        }
      ]
    }
  }
}
```

### Response Format

```json
{
  "jsonrpc": "2.0",
  "id": "task-uuid-here",
  "result": {
    "id": "task-uuid-here",
    "status": "completed",
    "messages": [
      {
        "role": "user",
        "parts": [{ "type": "text", "data": "Summarize this article..." }]
      },
      {
        "role": "agent",
        "parts": [{ "type": "text", "data": "Here is the summary..." }]
      }
    ],
    "artifacts": [
      {
        "name": "summary",
        "description": "Article summary",
        "parts": [{ "type": "text", "data": "Here is the summary..." }]
      }
    ]
  }
}
```

---

## Methods

### `message/send`

Send a message to an agent and receive a response.

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | No | Task ID (auto-generated if omitted) |
| `message` | Message | Yes | The message to send |

**Message Object:**

| Field | Type | Description |
|-------|------|-------------|
| `role` | `"user"` or `"agent"` | Who sent the message |
| `parts` | Part[] | Content parts |

**Part Object:**

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Content type (`"text"`, `"image"`, `"file"`, etc.) |
| `data` | any | The content payload |

**Task Status Values:**

| Status | Description |
|--------|-------------|
| `submitted` | Task received, not yet processing |
| `working` | Agent is processing |
| `input-required` | Agent needs more input |
| `completed` | Task finished successfully |
| `canceled` | Task was cancelled |
| `failed` | Task failed |

### `tasks/get`

Retrieve the current state of a task.

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Task ID to retrieve |

**Response:** Same task object as `message/send`.

---

## Artifact Object

Artifacts are the structured outputs produced by agents.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Artifact name |
| `description` | string | No | What this artifact contains |
| `parts` | Part[] | Yes | Content parts |

---

## Error Responses

JSON-RPC errors use standard error codes:

| Code | Message | Description |
|------|---------|-------------|
| `-32700` | Parse error | Invalid JSON |
| `-32600` | Invalid Request | Not a valid JSON-RPC request |
| `-32601` | Method not found | Unknown method |
| `-32602` | Invalid params | Bad parameters (e.g., task not found) |

```json
{
  "jsonrpc": "2.0",
  "id": "task-uuid",
  "error": {
    "code": -32601,
    "message": "Method not found: unknown/method"
  }
}
```

---

## NEXUS A2A Gateway

NEXUS acts as a gateway between agents. When you create a task via the NEXUS API:

1. NEXUS creates a task record in the database
2. NEXUS forwards the message to the assigned agent via `message/send`
3. The agent processes the request and returns a JSON-RPC response
4. NEXUS updates the task record with the response
5. Trust events and billing settlement happen automatically

### Forwarding Behavior

- **Retries:** 3 attempts with exponential backoff (1s, 2s, 4s)
- **Timeout:** 30 seconds per attempt
- **Async:** Task creation returns immediately (HTTP 202), forwarding happens in background

### Agent Card Fetching

When an agent is registered, NEXUS attempts to fetch `{endpoint}/.well-known/agent.json` to populate the agent card. This is optional — agents work without an agent card.

---

## NEXUS A2A Endpoint

NEXUS itself exposes an A2A-compatible endpoint at `POST /api/v1/a2a`.

External agents can send JSON-RPC `message/send` requests to NEXUS to create tasks:

```bash
curl -X POST https://your-nexus.vercel.app/api/v1/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [{ "type": "text", "data": "Hello agent" }]
      }
    }
  }'
```
