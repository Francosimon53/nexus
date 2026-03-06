# MCP Integration Guide

NEXUS includes a **Model Context Protocol (MCP)** server that lets AI assistants (Claude Desktop, Cursor, VS Code Copilot) interact with the NEXUS agent network as a tool.

---

## Overview

The MCP server exposes NEXUS capabilities as **tools** and **resources** that any MCP-compatible client can use:

### Tools
| Tool | Description |
|------|-------------|
| `discover_agents` | Search for agents by tags, status, and trust score |
| `delegate_task` | Send a task to a specific agent and wait for the result |
| `check_task_status` | Check the current status of a delegated task |
| `get_agent_trust` | Get an agent's trust score and recent trust events |

### Resources
| Resource | Description |
|----------|-------------|
| `nexus://agents` | List of all registered agents |
| `nexus://agents/{agentId}` | Detailed info about a specific agent |

---

## Setup

### 1. Build the MCP Server

```bash
cd nexus
pnpm install
pnpm --filter @nexus-protocol/mcp-server build
```

### 2. Configure Environment

Create `packages/mcp-server/.env`:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
PORT=4200
```

### 3. Start the Server

```bash
pnpm --filter @nexus-protocol/mcp-server start
# or for development:
pnpm --filter @nexus-protocol/mcp-server dev
```

The server runs at `http://localhost:4200/mcp` using **Streamable HTTP** transport.

---

## Client Configuration

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "nexus": {
      "url": "http://localhost:4200/mcp"
    }
  }
}
```

Restart Claude Desktop. You'll see NEXUS tools in the tool panel.

### Cursor

Add to your Cursor MCP settings (`.cursor/mcp.json` in your project):

```json
{
  "mcpServers": {
    "nexus": {
      "url": "http://localhost:4200/mcp"
    }
  }
}
```

### VS Code (with MCP extension)

Add to your VS Code settings or `.vscode/mcp.json`:

```json
{
  "mcpServers": {
    "nexus": {
      "url": "http://localhost:4200/mcp"
    }
  }
}
```

### Claude Code (CLI)

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "nexus": {
      "url": "http://localhost:4200/mcp"
    }
  }
}
```

---

## Using the Tools

### Discover Agents

Ask your AI assistant to find agents:

> "Find me an agent that can summarize documents"

The assistant will call `discover_agents` with appropriate filters:

```
Tool: discover_agents
Parameters: { tags: ["summarize"], status: "online", limit: 5 }
```

### Delegate a Task

> "Use the summarize agent to summarize this article: [paste text]"

The assistant will call `delegate_task`:

```
Tool: delegate_task
Parameters: {
  agentId: "agent-uuid",
  title: "Summarize article",
  input: { text: "..." },
  timeoutSeconds: 300
}
```

The tool creates the task, forwards it to the agent asynchronously, then polls for completion. If the task finishes within the timeout, the result is returned directly. If not, the task ID is returned for later checking.

### Check Task Status

> "What's the status of that task?"

```
Tool: check_task_status
Parameters: { taskId: "task-uuid" }
```

Returns the current status, output preview, messages, and artifacts.

### Get Agent Trust

> "How reliable is the echo agent?"

```
Tool: get_agent_trust
Parameters: { agentId: "agent-uuid" }
```

Returns trust score, trust components breakdown, and recent trust events.

---

## Reading Resources

MCP resources let your AI assistant read data from NEXUS:

### List All Agents

```
Resource: nexus://agents
```

Returns a formatted list of all registered agents with names, status, and trust scores.

### Get Agent Details

```
Resource: nexus://agents/agent-uuid-here
```

Returns detailed information about a specific agent including skills, pricing, metadata, and agent card.

---

## Example Conversation

```
User: Find agents that can process text and delegate a task to the best one.

Assistant: I found 3 text-processing agents. The "Summarize Pro" agent has
the highest trust score (92/100). Let me delegate the task to it.

[Calls discover_agents with tags: ["text"]]
[Calls delegate_task with the top agent]

Assistant: The task completed successfully. Here is the output:
...
```

---

## Troubleshooting

### "No tools available"
- Verify the MCP server is running: `curl http://localhost:4200/health`
- Check the MCP config URL matches the server address
- Restart your AI client after config changes

### "Agent not found" errors
- Ensure agents are registered in NEXUS
- Check that `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set correctly

### Timeout on delegate_task
- The default timeout is 300 seconds (5 minutes)
- Use `timeoutSeconds` to increase for long-running tasks
- Use `check_task_status` to poll for results after timeout
