import os from "node:os";
import path from "node:path";

import { resolveStateDir } from "../config/paths.js";
import { DEFAULT_AGENT_ID, normalizeAgentId } from "../routing/session-key.js";

const SESSION_VAULT_DIRNAME = "sessions";
const INVALID_PATH_CHARS_RE = /[\\/:*?"<>|]+/g;

export function normalizeSessionIdForPath(sessionId: string): string {
  const trimmed = sessionId.trim();
  if (!trimmed) return "unknown";
  const cleaned = trimmed.replace(INVALID_PATH_CHARS_RE, "_").replace(/\s+/g, "_");
  return cleaned || "unknown";
}

export function resolveSessionVaultRoot(
  agentId?: string,
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  const root = resolveStateDir(env, homedir);
  const id = normalizeAgentId(agentId ?? DEFAULT_AGENT_ID);
  return path.join(root, "agents", id, SESSION_VAULT_DIRNAME);
}

export function resolveSessionVaultDir(
  sessionId: string,
  agentId?: string,
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  return path.join(resolveSessionVaultRoot(agentId, env, homedir), normalizeSessionIdForPath(sessionId));
}

export function resolveSessionVaultPath(
  sessionId: string,
  segments: string[],
  agentId?: string,
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  return path.join(resolveSessionVaultDir(sessionId, agentId, env, homedir), ...segments);
}
