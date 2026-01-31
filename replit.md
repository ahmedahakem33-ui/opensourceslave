# Clawdis

## Overview

Clawdis is a personal AI assistant that you run on your own devices. It connects to messaging surfaces you already use (WhatsApp, Telegram, Discord, iMessage, WebChat) and routes them through an embedded AI agent runtime. The Gateway is the central daemon that owns all provider connections and exposes a WebSocket control plane for clients (CLI, macOS app, iOS nodes, web UI).

Key capabilities:
- Multi-surface inbox (WhatsApp via Baileys, Telegram via grammY, Discord via discord.js, iMessage via imsg CLI)
- Embedded Pi agent runtime with workspace-based configuration
- Canvas visual workspace that agents can control
- Voice wake + push-to-talk on macOS/iOS
- Camera/screen capture from paired nodes

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Gateway (Core Daemon)
The Gateway is the always-on process that owns all state and connections. It runs on a single port (default 18789) that multiplexes WebSocket control plane and HTTP for the control UI.

- Single source of truth for WhatsApp/Telegram/Discord/iMessage connections
- WebSocket API for clients (req/resp + server push events)
- Bridge transport (TCP 18790) for LAN/tailnet node pairing
- Canvas file server (HTTP 18793) for the visual workspace

### Agent Runtime
Clawdis embeds a Pi-derived agent runtime. The workspace contract is:
- `agent.workspace` config points to a directory (default `~/clawd`)
- Bootstrap files injected on first turn: `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `USER.md`
- Skills loaded from bundled, managed (`~/.clawdis/skills`), and workspace (`<workspace>/skills`) locations

### Session Management
- Direct chats use a shared `main` session
- Group chats use isolated session keys: `surface:group:<id>` or `surface:channel:<id>`
- Session state persists to `~/.clawdis/sessions/`
- Heartbeats run periodic agent turns in the main session

### Node System
Nodes are companion devices (iOS/Android/macOS) that connect to the Gateway via Bridge and expose commands:
- Canvas commands: present, navigate, eval, snapshot
- Camera commands: snap (photo), clip (video)
- Screen commands: record
- System commands: run (shell), notify

Pairing is gateway-owned with approval flow.

### Build System
- Language: TypeScript (ESM), strict typing
- Package manager: pnpm
- Build: `pnpm build` (tsc)
- Lint/format: Biome (`pnpm lint`, `pnpm format`)
- Tests: Vitest with 70% coverage thresholds

Key commands:
- `pnpm install` - install dependencies
- `pnpm clawdis ...` - run CLI in dev mode (tsx entry)
- `pnpm build` - type-check and build
- `pnpm test` - run tests
- `pnpm lint` - lint with Biome

## External Dependencies

### Messaging Providers
- **WhatsApp**: Baileys library (WhatsApp Web protocol)
- **Telegram**: grammY (Bot API client with throttler)
- **Discord**: discord.js (Bot gateway)
- **iMessage**: imsg CLI (JSON-RPC over stdio, macOS only)

### AI/Agent
- **Anthropic Claude**: Primary model provider via embedded Pi runtime
- Supports Anthropic OAuth (Claude Pro/Max) or API key auth

### Infrastructure
- **Tailscale**: Optional for Serve/Funnel exposure and wide-area discovery
- **Bonjour/mDNS**: LAN discovery for nodes (best-effort)
- **CoreDNS**: Optional for wide-area DNS-SD publishing

### Storage
- Config: `~/.clawdis/clawdis.json` (JSON5)
- Credentials: `~/.clawdis/credentials/`
- Sessions: `~/.clawdis/sessions/`
- Workspace: `~/clawd` (configurable via `agent.workspace`)

### Native Apps
- **macOS**: SwiftUI menu bar app (Clawdis.app) - gateway broker + node
- **iOS**: Node app for canvas/camera/voice
- **Android**: Node app for canvas/camera

### Optional Integrations
- Gmail Pub/Sub hooks (via gog/gogcli)
- Audio transcription (configurable CLI, e.g., Whisper)
- Browser automation (Chrome CDP for agent-controlled browsing)