# OpenClaw Tool System — Comprehensive Reference

Research date: 2026-02-06
Source: https://github.com/openclaw/openclaw (main branch)

---

## 1. Architecture Overview

OpenClaw uses the **OpenAI-compatible chat completions format** with tool calls. The tool system is built on:

- **`@mariozechner/pi-agent-core`** — defines `AgentTool<T>` interface
- **`@mariozechner/pi-coding-agent`** — provides base `read`, `write`, `edit` coding tools
- **`@sinclair/typebox`** — TypeBox for JSON Schema generation (all tool schemas use `Type.Object()`, `Type.String()`, etc.)

Tools are defined as objects with: `{ name, label, description, parameters (JSON Schema), execute() }`.

The `pi-tool-definition-adapter.ts` converts these to `ToolDefinition[]` for the AI provider. The tool call format follows the **OpenAI function calling convention** (`tool_calls` array with `function.name` and `function.arguments`).

### Key files:
- `src/agents/pi-tools.ts` — Main tool assembly (`createOpenClawCodingTools()`)
- `src/agents/openclaw-tools.ts` — OpenClaw-specific tools (browser, canvas, cron, sessions, etc.)
- `src/agents/bash-tools.exec.ts` — exec tool
- `src/agents/bash-tools.process.ts` — process tool
- `src/agents/pi-tools.read.ts` — read/write/edit wrappers with Claude Code compatibility
- `src/agents/tools/` — individual tool implementations

---

## 2. Tool Call Format

OpenClaw uses **OpenAI-style tool calls**. The tool definitions are sent as `tools[]` in the chat completions request. Each tool has:

```json
{
  "type": "function",
  "function": {
    "name": "tool_name",
    "description": "...",
    "parameters": { /* JSON Schema */ }
  }
}
```

The model returns tool calls in the standard format:
```json
{
  "tool_calls": [
    {
      "id": "call_xxx",
      "type": "function",
      "function": {
        "name": "tool_name",
        "arguments": "{\"param1\": \"value1\"}"
      }
    }
  ]
}
```

### Tool Results

Tool results are returned as `AgentToolResult` objects:
```typescript
{
  content: Array<{ type: "text", text: string } | { type: "image", data: string, mimeType: string }>,
  details?: unknown  // structured metadata for UI/logging
}
```

These get serialized back as the `tool` role message in the conversation.

### Claude Code Compatibility

OpenClaw includes Claude Code compatibility via `pi-tools.read.ts`:
- `file_path` → `path` (aliased in schema + normalized at runtime)
- `old_string` → `oldText`
- `new_string` → `newText`

The `patchToolSchemaForClaudeCompatibility()` function adds aliases to tool schemas, and `normalizeToolParams()` remaps parameters at execution time.

### Provider-specific Schema Normalization

- **OpenAI**: Requires `type: "object"` at top-level (no bare `anyOf`). The `normalizeToolParameters()` function in `pi-tools.schema.ts` flattens unions.
- **Gemini**: Certain JSON Schema keywords are scrubbed via `cleanSchemaForGemini()`.
- **All schemas use flattened objects** instead of `Type.Union` to avoid provider rejection.

---

## 3. Complete Tool Reference

### 3.1 `exec` — Shell Command Execution

**Name:** `exec`
**Description:** Execute shell commands with background continuation.

**Parameters (TypeBox schema):**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `command` | string | **Yes** | Shell command to execute |
| `workdir` | string | No | Working directory (defaults to cwd) |
| `env` | Record<string, string> | No | Environment variables |
| `yieldMs` | number | No | Milliseconds to wait before backgrounding (default 10000) |
| `background` | boolean | No | Run in background immediately |
| `timeout` | number | No | Timeout in seconds (kills process on expiry) |
| `pty` | boolean | No | Run in a pseudo-terminal (PTY) |
| `elevated` | boolean | No | Run on host with elevated permissions |
| `host` | string | No | Exec host: "sandbox", "gateway", or "node" |
| `security` | string | No | Security mode: "deny", "allowlist", or "full" |
| `ask` | string | No | Ask mode: "off", "on-miss", or "always" |
| `node` | string | No | Node id/name for host=node |

**Result details:** `{ status, sessionId, pid, exitCode, durationMs, aggregated, cwd }`

---

### 3.2 `process` — Manage Running Exec Sessions

**Name:** `process`
**Description:** Manage running exec sessions: list, poll, log, write, send-keys, submit, paste, kill.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | **Yes** | One of: "list", "poll", "log", "write", "send-keys", "submit", "paste", "kill", "clear", "remove" |
| `sessionId` | string | No* | Session id (required for all actions except "list") |
| `data` | string | No | Data to write (for "write" action) |
| `keys` | string[] | No | Key tokens to send (for "send-keys") |
| `hex` | string[] | No | Hex bytes to send (for "send-keys") |
| `literal` | string | No | Literal string (for "send-keys") |
| `text` | string | No | Text to paste (for "paste") |
| `bracketed` | boolean | No | Wrap paste in bracketed mode |
| `eof` | boolean | No | Close stdin after write |
| `offset` | number | No | Log offset |
| `limit` | number | No | Log length |

---

### 3.3 `read` — Read Files

**Name:** `read`
**Description:** Read file contents.

**Parameters (from pi-coding-agent):**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | **Yes** | File path to read |
| `file_path` | string | No | Alias for `path` (Claude Code compat) |

Returns text content or image data (base64) for image files.

---

### 3.4 `write` — Write Files

**Name:** `write`
**Description:** Write file contents.

**Parameters (from pi-coding-agent):**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | **Yes** | File path to write |
| `file_path` | string | No | Alias for `path` (Claude Code compat) |
| `content` | string | **Yes** | Content to write |

---

### 3.5 `edit` — Edit Files

**Name:** `edit`
**Description:** Edit file contents with search-and-replace.

**Parameters (from pi-coding-agent):**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | **Yes** | File path to edit |
| `file_path` | string | No | Alias for `path` (Claude Code compat) |
| `oldText` | string | **Yes** | Text to find |
| `old_string` | string | No | Alias for `oldText` (Claude Code compat) |
| `newText` | string | **Yes** | Replacement text |
| `new_string` | string | No | Alias for `newText` (Claude Code compat) |

---

### 3.6 `browser` — Browser Control

**Name:** `browser`
**Description:** Control browser instances with CDP (Chrome DevTools Protocol).

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | enum | **Yes** | One of: "status", "start", "stop", "profiles", "tabs", "open", "focus", "close", "snapshot", "screenshot", "navigate", "console", "pdf", "upload", "dialog", "act" |
| `target` | enum | No | "sandbox", "host", or "node" |
| `node` | string | No | Node id |
| `profile` | string | No | Browser profile |
| `targetUrl` | string | No | URL to navigate to |
| `targetId` | string | No | Tab/target id |
| `limit` | number | No | Result limit |
| `maxChars` | number | No | Max characters |
| `mode` | enum | No | Snapshot mode: "efficient" |
| `snapshotFormat` | enum | No | "aria" or "ai" |
| `refs` | enum | No | "role" or "aria" |
| `interactive` | boolean | No | Interactive elements only |
| `compact` | boolean | No | Compact format |
| `depth` | number | No | Snapshot depth |
| `selector` | string | No | CSS selector |
| `frame` | string | No | Frame selector |
| `labels` | boolean | No | Include labels |
| `fullPage` | boolean | No | Full page screenshot |
| `ref` | string | No | Element reference |
| `element` | string | No | Element description |
| `type` | enum | No | Image type: "png" or "jpeg" |
| `level` | string | No | Console level |
| `paths` | string[] | No | Upload file paths |
| `inputRef` | string | No | Input element ref |
| `timeoutMs` | number | No | Timeout |
| `accept` | boolean | No | Dialog accept |
| `promptText` | string | No | Dialog prompt text |
| `request` | object | No | Act request (click/type/press/hover/drag/select/fill/resize/wait/evaluate/close) |

The `request` object for `action: "act"` has:
- `kind`: "click" | "type" | "press" | "hover" | "drag" | "select" | "fill" | "resize" | "wait" | "evaluate" | "close"
- Plus kind-specific fields (targetId, ref, text, key, values, etc.)

---

### 3.7 `canvas` — Canvas Control

**Name:** `canvas`
**Description:** Control node canvases (present/hide/navigate/eval/snapshot/A2UI).

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | enum | **Yes** | One of: "present", "hide", "navigate", "eval", "snapshot", "a2ui_push", "a2ui_reset" |
| `gatewayUrl` | string | No | Gateway URL |
| `gatewayToken` | string | No | Gateway token |
| `timeoutMs` | number | No | Timeout |
| `node` | string | No | Node id |
| `target` | string | No | Present target URL |
| `x`, `y`, `width`, `height` | number | No | Placement (for "present") |
| `url` | string | No | URL (for "navigate") |
| `javaScript` | string | No | JS code (for "eval") |
| `outputFormat` | enum | No | "png", "jpg", "jpeg" (for "snapshot") |
| `maxWidth` | number | No | Max width (for "snapshot") |
| `quality` | number | No | Quality (for "snapshot") |
| `delayMs` | number | No | Delay (for "snapshot") |
| `jsonl` | string | No | JSONL content (for "a2ui_push") |
| `jsonlPath` | string | No | JSONL file path (for "a2ui_push") |

---

### 3.8 `nodes` — Device Node Control

**Name:** `nodes`
**Description:** Control device nodes (camera, screen, location, notifications).

**Parameters:** (schema not fully captured — timed out, but based on `nodes-utils.ts` pattern)
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | **Yes** | Node action (list, invoke, etc.) |
| `node` | string | No | Node id |
| `command` | string | No | Command to invoke |
| `params` | object | No | Command parameters |

---

### 3.9 `cron` — Cron Job Management

**Name:** `cron`
**Description:** Manage Gateway cron jobs and wake events.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | enum | **Yes** | One of: "status", "list", "add", "update", "remove", "run", "runs", "wake" |
| `gatewayUrl` | string | No | Gateway URL |
| `gatewayToken` | string | No | Gateway token |
| `timeoutMs` | number | No | Timeout |
| `includeDisabled` | boolean | No | Include disabled jobs (for "list") |
| `job` | object | No | Job object (for "add") |
| `jobId` | string | No | Job id (for update/remove/run/runs) |
| `id` | string | No | Alias for jobId |
| `patch` | object | No | Patch object (for "update") |
| `text` | string | No | Wake text (for "wake") |
| `mode` | enum | No | Wake mode: "now" or "next-heartbeat" |
| `contextMessages` | number | No | Number of context messages (0-10) |

---

### 3.10 `message` — Send Messages

**Name:** `message`
**Description:** Send, delete, and manage messages via channel plugins.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | enum | **Yes** | One of: "send", "sendWithEffect", "sendAttachment", "reply", "thread-reply", "broadcast", "delete", "react", "pin", "unpin", "fetch", "poll", etc. |
| `channel` | string | No | Channel provider |
| `target` | string | No | Target channel/user id |
| `targets` | string[] | No | Multiple targets |
| `accountId` | string | No | Account id |
| `dryRun` | boolean | No | Dry run |
| `message` | string | No | Message text |
| `media` | string | No | Media URL or path |
| `filename` | string | No | Attachment filename |
| `buffer` | string | No | Base64 attachment payload |
| `contentType` | string | No | Content type |
| `caption` | string | No | Media caption |
| `replyTo` | string | No | Reply to message id |
| `threadId` | string | No | Thread id |
| `emoji` | string | No | Reaction emoji |
| `messageId` | string | No | Target message id |
| `remove` | boolean | No | Remove reaction |
| `silent` | boolean | No | Silent send |
| ... | ... | ... | (many more action-specific params) |

---

### 3.11 `tts` — Text to Speech

**Name:** `tts`
**Description:** Convert text to speech.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | **Yes** | Text to convert to speech |
| `channel` | string | No | Channel id for output format |

---

### 3.12 `gateway` — Gateway Control

**Name:** `gateway`
**Description:** Restart, apply config, or update the gateway.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | enum | **Yes** | One of: "restart", "config.get", "config.schema", "config.apply", "config.patch", "update.run" |
| `delayMs` | number | No | Restart delay |
| `reason` | string | No | Restart reason |
| `gatewayUrl` | string | No | Gateway URL |
| `gatewayToken` | string | No | Gateway token |
| `timeoutMs` | number | No | Timeout |
| `raw` | string | No | Config content (for apply/patch) |
| `baseHash` | string | No | Config base hash |
| `sessionKey` | string | No | Session key |
| `note` | string | No | Note |
| `restartDelayMs` | number | No | Restart delay after config change |

---

### 3.13 `agents_list` — List Agents

**Name:** `agents_list`
**Description:** List agent ids you can target with sessions_spawn.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| (none) | | | Takes no parameters |

---

### 3.14 `sessions_list` — List Sessions

**Name:** `sessions_list`
**Description:** List sessions with optional filters and last messages.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `kinds` | string[] | No | Filter by kind: "main", "group", "cron", "hook", "node", "other" |
| `limit` | number | No | Max results (min 1) |
| `activeMinutes` | number | No | Filter by activity window |
| `messageLimit` | number | No | Include last N messages (min 0) |

---

### 3.15 `sessions_history` — Session History

**Name:** `sessions_history`
**Description:** Fetch transcript/history for a session.

**Parameters:** (timed out during fetch, but based on naming patterns)
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionKey` | string | **Yes** | Session key to get history for |
| `limit` | number | No | Number of messages |

---

### 3.16 `sessions_send` — Send to Session

**Name:** `sessions_send`
**Description:** Send a message into another session.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionKey` | string | No* | Target session key |
| `label` | string | No* | Target session label (alternative to sessionKey) |
| `agentId` | string | No | Target agent id (with label) |
| `message` | string | **Yes** | Message text |
| `timeoutSeconds` | number | No | Wait timeout (default 30, 0 = fire-and-forget) |

---

### 3.17 `sessions_spawn` — Spawn Sub-agent

**Name:** `sessions_spawn`
**Description:** Spawn a background sub-agent run in an isolated session.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `task` | string | **Yes** | Task description for the sub-agent |
| `label` | string | No | Session label |
| `agentId` | string | No | Target agent id |
| `model` | string | No | Model override |
| `thinking` | string | No | Thinking level |
| `runTimeoutSeconds` | number | No | Run timeout |
| `timeoutSeconds` | number | No | Legacy alias for runTimeoutSeconds |
| `cleanup` | enum | No | "delete" or "keep" (default "keep") |

---

### 3.18 `session_status` — Session Status

**Name:** `session_status`
**Description:** Get status of the current session.

**Parameters:** (timed out during fetch, likely minimal)

---

### 3.19 `web_search` — Web Search

**Name:** `web_search`
**Description:** Search the web using Brave Search API (or Perplexity).

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | **Yes** | Search query |
| `count` | number | No | Number of results (1-10, default 5) |
| `country` | string | No | 2-letter country code (e.g. "US", "DE") |
| `search_lang` | string | No | ISO language code for results |
| `ui_lang` | string | No | ISO language code for UI |
| `freshness` | string | No | Time filter: "pd", "pw", "pm", "py", or "YYYY-MM-DDtoYYYY-MM-DD" (Brave only) |

---

### 3.20 `web_fetch` — Fetch Web Content

**Name:** `web_fetch`
**Description:** Fetch and extract readable content from a URL.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | **Yes** | HTTP or HTTPS URL to fetch |
| `extractMode` | enum | No | "markdown" or "text" (default "markdown") |
| `maxChars` | number | No | Maximum characters to return (min 100) |

---

### 3.21 `image` — Image Analysis

**Name:** `image`
**Description:** Analyze an image with a vision model.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | No | Analysis prompt (default: "Describe the image.") |
| `image` | string | **Yes** | Image path, URL, or data: URL |
| `model` | string | No | Model override |
| `maxBytesMb` | number | No | Max image size in MB |

---

### 3.22 `memory_search` — Memory Search

**Name:** `memory_search`
**Description:** Semantically search MEMORY.md and memory/*.md files.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | **Yes** | Search query |
| `maxResults` | number | No | Max number of results |
| `minScore` | number | No | Minimum relevance score |

---

### 3.23 `memory_get` — Memory Get

**Name:** `memory_get`
**Description:** Read snippet from MEMORY.md or memory/*.md.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | **Yes** | Relative file path |
| `from` | number | No | Start line number |
| `lines` | number | No | Number of lines to read |

---

## 4. Tool Result Format

All tools return `AgentToolResult`:

```typescript
type AgentToolResult = {
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
  >;
  details?: unknown; // Tool-specific structured metadata
};
```

For JSON results, the helper `jsonResult()` wraps any payload:
```typescript
function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}
```

Tool errors are caught by the adapter and returned as:
```json
{ "status": "error", "tool": "tool_name", "error": "error message" }
```

---

## 5. Tool Name Validation

OpenClaw uses tool policy filtering extensively:
- `resolveEffectiveToolPolicy()` determines which tools are enabled
- `filterToolsByPolicy()` filters tools by allow/deny lists
- `normalizeToolName()` normalizes tool names for policy matching
- Tools can be gated by: global config, per-agent config, per-provider config, group config, sandbox config, subagent config

The tool names in the request match what the model sees. OpenClaw does NOT validate that the model only calls tools it was sent — tool execution happens by name lookup in the tools array. However, if a tool name doesn't match, the execution will fail.

### Anthropic OAuth tool name remapping
Per comments in `pi-tools.ts`: "pi-ai's Anthropic OAuth transport remaps tool names to Claude Code-style names on the wire and maps them back for tool dispatch."

---

## 6. Tool Policy / Sandbox Defaults

From the README security section:
- **Sandbox allowlist (default):** `bash`, `process`, `read`, `write`, `edit`, `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`
- **Sandbox denylist (default):** `browser`, `canvas`, `nodes`, `cron`, `discord`, `gateway`

---

## 7. Additional Tools (Plugin/Channel-specific)

Beyond the core tools, OpenClaw supports:
- **Discord actions:** messaging, moderation, presence, guild management
- **Slack actions:** messaging, channels
- **Telegram actions:** messaging, polls
- **WhatsApp actions:** messaging, groups
- **Plugin SDK tools:** Custom tools via plugin system
- **`apply_patch`:** OpenAI-specific patch tool (enabled only for OpenAI/Codex models)
