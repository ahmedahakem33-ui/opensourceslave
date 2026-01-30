import fs from "node:fs/promises";
import path from "node:path";

import { resolveSessionTranscriptsDirForAgent } from "../config/sessions/paths.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { hashText } from "./internal.js";

const log = createSubsystemLogger("memory");

export type SessionFileEntry = {
  path: string;
  absPath: string;
  mtimeMs: number;
  size: number;
  hash: string;
  content: string;
};

export async function listSessionFilesForAgent(agentId: string): Promise<string[]> {
  const dir = resolveSessionTranscriptsDirForAgent(agentId);
  try {
    return await listJsonlFilesRecursive(dir);
  } catch {
    return [];
  }
}

export function sessionPathForFile(absPath: string, agentId?: string): string {
  const sessionsDir = resolveSessionTranscriptsDirForAgent(agentId);
  const relative = path.relative(sessionsDir, absPath);
  return path.join("sessions", relative).replace(/\\/g, "/");
}

function normalizeSessionText(value: string): string {
  return value
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractSessionText(content: unknown): string | null {
  if (typeof content === "string") {
    const normalized = normalizeSessionText(content);
    return normalized ? normalized : null;
  }
  if (!Array.isArray(content)) {
    return null;
  }
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }
    const record = block as { type?: unknown; text?: unknown };
    if (record.type !== "text" || typeof record.text !== "string") {
      continue;
    }
    const normalized = normalizeSessionText(record.text);
    if (normalized) {
      parts.push(normalized);
    }
  }
  if (parts.length === 0) {
    return null;
  }
  return parts.join(" ");
}

export async function buildSessionEntry(
  absPath: string,
  agentId?: string,
): Promise<SessionFileEntry | null> {
  try {
    const stat = await fs.stat(absPath);
    const raw = await fs.readFile(absPath, "utf-8");
    const lines = raw.split("\n");
    const collected: string[] = [];
    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      let record: unknown;
      try {
        record = JSON.parse(line);
      } catch {
        continue;
      }
      if (
        !record ||
        typeof record !== "object" ||
        (record as { type?: unknown }).type !== "message"
      ) {
        continue;
      }
      const message = (record as { message?: unknown }).message as
        | { role?: unknown; content?: unknown }
        | undefined;
      if (!message || typeof message.role !== "string") {
        continue;
      }
      if (message.role !== "user" && message.role !== "assistant") {
        continue;
      }
      const text = extractSessionText(message.content);
      if (!text) {
        continue;
      }
      const label = message.role === "user" ? "User" : "Assistant";
      collected.push(`${label}: ${text}`);
    }
    const content = collected.join("\n");
    return {
      path: sessionPathForFile(absPath, agentId),
      absPath,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      hash: hashText(content),
      content,
    };
  } catch (err) {
    log.debug(`Failed reading session file ${absPath}: ${String(err)}`);
    return null;
  }
}

async function listJsonlFilesRecursive(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await listJsonlFilesRecursive(fullPath);
      results.push(...nested);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      results.push(fullPath);
    }
  }
  return results;
}
