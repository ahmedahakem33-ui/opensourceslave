#!/usr/bin/env node

import path from "node:path";

const SHIELD_SHELL_BLOCKLIST = new Set(["rm", "chmod", "env", "curl"]);

const DISALLOWED_PIPELINE_TOKENS = new Set([">", "<", "`", "\n", "\r", "(", ")"]);

function iterateQuoteAware(command, onChar) {
  const parts = [];
  let buf = "";
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  let hasSplit = false;

  const pushPart = () => {
    const trimmed = buf.trim();
    if (trimmed) {
      parts.push(trimmed);
    }
    buf = "";
  };

  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    const next = command[i + 1];

    if (escaped) {
      buf += ch;
      escaped = false;
      continue;
    }
    if (!inSingle && !inDouble && ch === "\\") {
      escaped = true;
      buf += ch;
      continue;
    }
    if (inSingle) {
      if (ch === "'") inSingle = false;
      buf += ch;
      continue;
    }
    if (inDouble) {
      if (ch === '"') inDouble = false;
      buf += ch;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      buf += ch;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      buf += ch;
      continue;
    }

    const action = onChar(ch, next, i);
    if (typeof action === "object" && action && "reject" in action) {
      return { ok: false, reason: action.reject };
    }
    if (action === "split") {
      pushPart();
      hasSplit = true;
      continue;
    }
    if (action === "skip") {
      continue;
    }
    buf += ch;
  }

  if (escaped || inSingle || inDouble) {
    return { ok: false, reason: "unterminated shell quote/escape" };
  }
  pushPart();
  return { ok: true, parts, hasSplit };
}

function splitShellPipeline(command) {
  let emptySegment = false;
  const result = iterateQuoteAware(command, (ch, next) => {
    if (ch === "|" && next === "|") {
      return { reject: "unsupported shell token: ||" };
    }
    if (ch === "|" && next === "&") {
      return { reject: "unsupported shell token: |&" };
    }
    if (ch === "|") {
      emptySegment = true;
      return "split";
    }
    if (ch === "&" || ch === ";") {
      return { reject: `unsupported shell token: ${ch}` };
    }
    if (DISALLOWED_PIPELINE_TOKENS.has(ch)) {
      return { reject: `unsupported shell token: ${ch}` };
    }
    if (ch === "$" && next === "(") {
      return { reject: "unsupported shell token: $()" };
    }
    emptySegment = false;
    return "include";
  });

  if (!result.ok) {
    return { ok: false, reason: result.reason, segments: [] };
  }
  if (emptySegment || result.parts.length === 0) {
    return {
      ok: false,
      reason: result.parts.length === 0 ? "empty command" : "empty pipeline segment",
      segments: [],
    };
  }
  return { ok: true, segments: result.parts };
}

function tokenizeShellSegment(segment) {
  const tokens = [];
  let buf = "";
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  const pushToken = () => {
    if (buf.length > 0) {
      tokens.push(buf);
      buf = "";
    }
  };

  for (let i = 0; i < segment.length; i += 1) {
    const ch = segment[i];
    if (escaped) {
      buf += ch;
      escaped = false;
      continue;
    }
    if (!inSingle && !inDouble && ch === "\\") {
      escaped = true;
      continue;
    }
    if (inSingle) {
      if (ch === "'") {
        inSingle = false;
      } else {
        buf += ch;
      }
      continue;
    }
    if (inDouble) {
      if (ch === '"') {
        inDouble = false;
      } else {
        buf += ch;
      }
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (/\s/.test(ch)) {
      pushToken();
      continue;
    }
    buf += ch;
  }

  if (escaped || inSingle || inDouble) {
    return null;
  }
  pushToken();
  return tokens;
}

function splitCommandChain(command) {
  const parts = [];
  let buf = "";
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  let foundChain = false;
  let invalidChain = false;

  const pushPart = () => {
    const trimmed = buf.trim();
    if (trimmed) {
      parts.push(trimmed);
      buf = "";
      return true;
    }
    buf = "";
    return false;
  };

  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    if (escaped) {
      buf += ch;
      escaped = false;
      continue;
    }
    if (!inSingle && !inDouble && ch === "\\") {
      escaped = true;
      buf += ch;
      continue;
    }
    if (inSingle) {
      if (ch === "'") inSingle = false;
      buf += ch;
      continue;
    }
    if (inDouble) {
      if (ch === '"') inDouble = false;
      buf += ch;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      buf += ch;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      buf += ch;
      continue;
    }

    if (ch === "&" && command[i + 1] === "&") {
      if (!pushPart()) invalidChain = true;
      i += 1;
      foundChain = true;
      continue;
    }
    if (ch === "|" && command[i + 1] === "|") {
      if (!pushPart()) invalidChain = true;
      i += 1;
      foundChain = true;
      continue;
    }
    if (ch === ";") {
      if (!pushPart()) invalidChain = true;
      foundChain = true;
      continue;
    }

    buf += ch;
  }

  const pushedFinal = pushPart();
  if (!foundChain) return null;
  if (invalidChain || !pushedFinal) return null;
  return parts.length > 0 ? parts : null;
}

function analyzeShellCommand({ command }) {
  const chainParts = splitCommandChain(command);
  if (chainParts) {
    const chains = [];
    const allSegments = [];

    for (const part of chainParts) {
      const pipelineSplit = splitShellPipeline(part);
      if (!pipelineSplit.ok) {
        return { ok: false, reason: pipelineSplit.reason, segments: [] };
      }
      const segments = pipelineSplit.segments
        .map((raw) => ({ raw, argv: tokenizeShellSegment(raw) }))
        .filter((segment) => Array.isArray(segment.argv));
      if (segments.length !== pipelineSplit.segments.length) {
        return { ok: false, reason: "unable to parse shell segment", segments: [] };
      }
      const normalized = segments.map((segment) => ({
        raw: segment.raw,
        argv: segment.argv,
      }));
      chains.push(normalized);
      allSegments.push(...normalized);
    }

    return { ok: true, segments: allSegments, chains };
  }

  const split = splitShellPipeline(command);
  if (!split.ok) {
    return { ok: false, reason: split.reason, segments: [] };
  }
  const segments = split.segments
    .map((raw) => ({ raw, argv: tokenizeShellSegment(raw) }))
    .filter((segment) => Array.isArray(segment.argv));
  if (segments.length !== split.segments.length) {
    return { ok: false, reason: "unable to parse shell segment", segments: [] };
  }
  return { ok: true, segments };
}

function isEnvAssignment(token) {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token);
}

function resolveSegmentExecutable(argv) {
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

function normalizeExecutableName(token) {
  if (!token) return "";
  const parsed = path.parse(token);
  return (parsed.name || token).toLowerCase();
}

function findShieldShellMatches(command) {
  const matches = new Set();
  const analysis = analyzeShellCommand({ command });
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
    let match = null;
    while ((match = fallback.exec(command))) {
      matches.add(match[1]?.toLowerCase());
    }
  }
  return [...matches];
}

const DEFAULT_REDACT_MIN_LENGTH = 18;
const DEFAULT_REDACT_KEEP_START = 6;
const DEFAULT_REDACT_KEEP_END = 4;

const DEFAULT_REDACT_PATTERNS = [
  String.raw`\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD)\b\s*[=:]\s*(["']?)([^\s"'\\]+)\1`,
  String.raw`"(?:apiKey|token|secret|password|passwd|accessToken|refreshToken)"\s*:\s*"([^"]+)"`,
  String.raw`--(?:api[-_]?key|token|secret|password|passwd)\s+(["']?)([^\s"']+)\1`,
  String.raw`Authorization\s*[:=]\s*Bearer\s+([A-Za-z0-9._\-+=]+)`,
  String.raw`\bBearer\s+([A-Za-z0-9._\-+=]{18,})\b`,
  String.raw`-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----`,
  String.raw`\b(sk-proj-[A-Za-z0-9_-]{10,})\b`,
  String.raw`\b(sk-ant-[A-Za-z0-9_-]{10,})\b`,
  String.raw`\b(sk-[A-Za-z0-9_-]{8,})\b`,
  String.raw`\b(ghp_[A-Za-z0-9]{20,})\b`,
  String.raw`\b(github_pat_[A-Za-z0-9_]{20,})\b`,
  String.raw`\b(xox[baprs]-[A-Za-z0-9-]{10,})\b`,
  String.raw`\b(xapp-[A-Za-z0-9-]{10,})\b`,
  String.raw`\b(gsk_[A-Za-z0-9_-]{10,})\b`,
  String.raw`\b(AIza[0-9A-Za-z\-_]{20,})\b`,
  String.raw`\b(pplx-[A-Za-z0-9_-]{10,})\b`,
  String.raw`\b(npm_[A-Za-z0-9]{10,})\b`,
  String.raw`\b(\d{6,}:[A-Za-z0-9_-]{20,})\b`,
];

function parsePattern(raw) {
  if (!raw.trim()) return null;
  const match = raw.match(/^\/(.+)\/([gimsuy]*)$/);
  try {
    if (match) {
      const flags = match[2].includes("g") ? match[2] : `${match[2]}g`;
      return new RegExp(match[1], flags);
    }
    return new RegExp(raw, "gi");
  } catch {
    return null;
  }
}

function resolvePatterns(value) {
  const source = value?.length ? value : DEFAULT_REDACT_PATTERNS;
  return source.map(parsePattern).filter((re) => Boolean(re));
}

function maskToken(token) {
  if (token.length < DEFAULT_REDACT_MIN_LENGTH) return "***";
  const start = token.slice(0, DEFAULT_REDACT_KEEP_START);
  const end = token.slice(-DEFAULT_REDACT_KEEP_END);
  return `${start}…${end}`;
}

function redactPemBlock(block) {
  const lines = block.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return "***";
  return `${lines[0]}\n…redacted…\n${lines[lines.length - 1]}`;
}

function redactMatch(match, groups) {
  if (match.includes("PRIVATE KEY-----")) return redactPemBlock(match);
  const token = groups.filter((value) => typeof value === "string" && value.length > 0).at(-1) ?? match;
  const masked = maskToken(token);
  if (token === match) return masked;
  return match.replace(token, masked);
}

function redactText(text, patterns) {
  let next = text;
  for (const pattern of patterns) {
    next = next.replace(pattern, (...args) => redactMatch(args[0], args.slice(1, args.length - 2)));
  }
  return next;
}

function redactSensitiveText(text, options) {
  if (!text) return text;
  const patterns = resolvePatterns(options?.patterns);
  if (!patterns.length) return text;
  return redactText(text, patterns);
}

function evaluateShield(command) {
  const matches = findShieldShellMatches(command);
  const blocked = matches.length > 0;
  return {
    blocked,
    matches,
  };
}

function evaluateRedaction(text) {
  return redactSensitiveText(text);
}

function padRight(value, width) {
  const str = String(value ?? "");
  if (str.length >= width) return str;
  return str + " ".repeat(width - str.length);
}

function formatTable(rows) {
  const widths = rows[0].map((_, index) => Math.max(...rows.map((row) => String(row[index]).length)));
  const line = `+${widths.map((w) => "-".repeat(w + 2)).join("+")}+`;
  const formatRow = (row) => `| ${row.map((cell, i) => padRight(cell, widths[i])).join(" | ")} |`;
  const output = [line, formatRow(rows[0]), line];
  for (let i = 1; i < rows.length; i += 1) {
    output.push(formatRow(rows[i]));
  }
  output.push(line);
  return output.join("\n");
}

const tests = [
  {
    id: "A",
    scenario: "Simple ls",
    kind: "shield",
    input: "ls",
    expected: "allow",
  },
  {
    id: "B",
    scenario: "rm -rf /",
    kind: "shield",
    input: "rm -rf /",
    expected: "block",
  },
  {
    id: "C",
    scenario: "curl http://evil.com",
    kind: "shield",
    input: "curl http://evil.com",
    expected: "block",
  },
  {
    id: "D",
    scenario: "env",
    kind: "shield",
    input: "env",
    expected: "block",
  },
  {
    id: "E",
    scenario: "Print API key",
    kind: "redact",
    input: "sk-proj-12345",
    expected: "***",
  },
];

const rows = [
  ["ID", "Scenario", "Input", "Expected", "Actual", "Result"],
];

for (const test of tests) {
  if (test.kind === "shield") {
    const result = evaluateShield(test.input);
    const actual = result.blocked ? "block" : "allow";
    const pass = actual === test.expected;
    rows.push([
      test.id,
      test.scenario,
      test.input,
      test.expected,
      actual,
      pass ? "PASS" : "FAIL",
    ]);
  } else {
    const redacted = evaluateRedaction(test.input);
    const pass = redacted === test.expected;
    rows.push([
      test.id,
      test.scenario,
      test.input,
      test.expected,
      redacted,
      pass ? "PASS" : "FAIL",
    ]);
  }
}

const report = [
  "OpenClaw Security Audit Verification",
  "Date: 2026-01-30",
  "Scope: Shield-Shell blocklist + Key-Mask redaction",
  "",
  formatTable(rows),
  "",
].join("\n");

console.log(report);
