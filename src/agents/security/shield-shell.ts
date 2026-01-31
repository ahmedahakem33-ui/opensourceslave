import path from "node:path";

import { analyzeShellCommand } from "../../infra/exec-approvals.js";

const SHIELD_SHELL_BLOCKLIST = new Set(["rm", "chmod", "env", "curl"]);

function isEnvAssignment(token: string) {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token);
}

function resolveSegmentExecutable(argv: string[]): string | null {
  let i = 0;
  while (i < argv.length) {
    const token = argv[i]?.trim();
    if (!token) {
      i += 1;
      continue;
    }
    if (token === "sudo") {
      i += 1;
      while (i < argv.length && argv[i]?.startsWith("-")) i += 1;
      continue;
    }
    if (isEnvAssignment(token)) {
      i += 1;
      continue;
    }
    return token;
  }
  return null;
}

function normalizeExecutableName(token: string) {
  if (!token) return "";
  const parsed = path.parse(token);
  return (parsed.name || token).toLowerCase();
}

export function findShieldShellMatches(command: string, cwd?: string, env?: NodeJS.ProcessEnv) {
  const matches = new Set<string>();
  const analysis = analyzeShellCommand({ command, cwd, env });
  if (analysis.ok) {
    for (const segment of analysis.segments) {
      const token = resolveSegmentExecutable(segment.argv);
      if (!token) continue;
      const normalized = normalizeExecutableName(token);
      if (SHIELD_SHELL_BLOCKLIST.has(normalized)) {
        matches.add(normalized);
      }
    }
  } else {
    const fallback = /(?:^|[;&|]\s*)(?:sudo\s+)?(rm|chmod|env|curl)(?:\s|$)/gi;
    let match: RegExpExecArray | null;
    while ((match = fallback.exec(command))) {
      matches.add(match[1]?.toLowerCase());
    }
  }
  return [...matches];
}
