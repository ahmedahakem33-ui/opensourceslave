import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

function isFileUrl(url) {
  return typeof url === "string" && url.startsWith("file:");
}

async function resolveAsTs(candidateUrl) {
  if (!isFileUrl(candidateUrl)) return null;
  const candidatePath = fileURLToPath(candidateUrl);
  if (!candidatePath.endsWith(".js")) return null;
  const tsPath = candidatePath.slice(0, -3) + ".ts";
  try {
    await access(tsPath);
    return pathToFileURL(tsPath).href;
  } catch {
    return null;
  }
}

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.endsWith(".js") && (specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("/"))) {
    const baseUrl = context.parentURL ?? pathToFileURL(path.resolve(".")).href;
    const candidateUrl = new URL(specifier, baseUrl).href;
    const tsUrl = await resolveAsTs(candidateUrl);
    if (tsUrl) {
      return { url: tsUrl, shortCircuit: true };
    }
  }
  return defaultResolve(specifier, context, defaultResolve);
}
