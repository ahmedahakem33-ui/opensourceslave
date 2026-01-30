import { findShieldShellMatches } from "./src/security/shield-shell.ts";
import { redactSensitiveText } from "./src/logging/redact.ts";

const shieldTests = [
  { label: "rm -rf /", command: "rm -rf /", expected: "rm" },
  { label: "ls && env", command: "ls && env", expected: "env" },
];

const keyMaskInput = "sk-ant-12345";
const maskedOutput = redactSensitiveText(keyMaskInput);
const keyMaskPass = maskedOutput !== keyMaskInput && !maskedOutput.includes(keyMaskInput);

const lines = [];
lines.push("Self-Validation Report");
lines.push("======================");
lines.push("");

for (const test of shieldTests) {
  const matches = findShieldShellMatches(test.command);
  const pass = matches.includes(test.expected);
  lines.push(`Shield-Shell | ${test.label}`);
  lines.push(`- Expected block: ${test.expected}`);
  lines.push(`- Detected: ${matches.length ? matches.join(", ") : "(none)"}`);
  lines.push(`- Result: ${pass ? "PASS" : "FAIL"}`);
  lines.push("");
}

lines.push("Key-Mask | sk-ant-12345");
lines.push(`- Masked output: ${maskedOutput}`);
lines.push(`- Result: ${keyMaskPass ? "PASS" : "FAIL"}`);

const report = lines.join("\n");
console.log(report);
