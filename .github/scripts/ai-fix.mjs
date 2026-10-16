import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.log("GROQ_API_KEY is not configured. Add it in GitHub Settings > Secrets and variables > Actions to enable AI repair.");
  process.exit(0);
}

function redactSensitive(text) {
  return text
    .replace(/(token|api[_-]?key|secret|password|authorization)(\s*["']?\s*[:=]\s*["']?)([^\s"'\x60,;]+)/gi, "$1$2[REDACTED]")
    .replace(/[\w-]{24,}\.[\w-]{6,}\.[\w-]{20,}/g, "[REDACTED_DISCORD_TOKEN]")
    .replace(/gsk_[A-Za-z0-9]{20,}/g, "[REDACTED_GROQ_KEY]");
}

const logPath = process.argv[2] || "/tmp/failed-build.log";
const logs = redactSensitive(fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8").slice(-16000) : "");
const allowedContextFiles = ["package.json", "tsconfig.json"];
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && full.endsWith(".ts") ? [full] : [];
  });
}
const files = [...allowedContextFiles.filter((f) => fs.existsSync(f)), ...walk("src")];
let remaining = 50000;
const context = files.map((file) => {
  if (remaining <= 0) return "";
  const content = redactSensitive(fs.readFileSync(file, "utf8")).slice(0, remaining);
  remaining -= content.length;
  return "\n--- FILE: " + file + " ---\n" + content;
}).join("\n");

const prompt = `You are repairing a TypeScript Discord bot after a failed GitHub Actions build or Railway deployment.
Return ONLY a unified git diff that can be applied with git apply. Do not use Markdown fences.
Only modify existing files under src/. Do not modify package.json, lockfiles, workflows, secrets, deployment settings, or environment variables.
Do not add network calls, telemetry, shell commands, or unrelated features. Never print or request secrets.
The patch must address the actual error. If no safe source-only fix is possible, return exactly NO_SAFE_FIX.
After applying the patch, the repository runs npm run build as verification. This build check does not prove runtime health.

FAILURE LOGS (sensitive patterns redacted):
${logs || "(No failure log was available; inspect for obvious TypeScript compile errors only.)"}

SOURCE CONTEXT (sensitive patterns redacted):
${context}`;

const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "llama-3.3-70b-versatile",
    temperature: 0,
    max_tokens: 6000,
    messages: [
      { role: "system", content: "You produce minimal, safe unified diffs for TypeScript build repairs." },
      { role: "user", content: prompt }
    ]
  })
});

if (!response.ok) {
  console.error("AI provider request failed with HTTP", response.status);
  process.exit(1);
}
const data = await response.json();
let patch = data?.choices?.[0]?.message?.content?.trim();
if (!patch) throw new Error("AI provider returned an empty response.");
if (patch === "NO_SAFE_FIX") {
  console.log("AI could not identify a safe source-only fix.");
  process.exit(0);
}
patch = patch.replace(/^```(?:diff|patch)?\s*/i, "").replace(/\s*```$/, "");
if (!patch.includes("diff --git ") || !patch.includes("@@")) {
  console.error("AI response was not a valid unified diff.");
  process.exit(1);
}
const paths = [...patch.matchAll(/^\+\+\+ b\/(.+)$/gm)].map((m) => m[1]);
if (!paths.length || paths.some((p) => !p.startsWith("src/") || p.includes(".."))) {
  console.error("Rejected patch: it attempted to change files outside src/.");
  process.exit(1);
}
fs.writeFileSync("/tmp/ai-repair.patch", patch + "\n");
try {
  execFileSync("git", ["apply", "--check", "/tmp/ai-repair.patch"], { stdio: "inherit" });
  execFileSync("git", ["apply", "/tmp/ai-repair.patch"], { stdio: "inherit" });
  execFileSync("npm", ["run", "build"], { stdio: "inherit" });
} catch {
  execFileSync("git", ["checkout", "--", "src"], { stdio: "inherit" });
  console.error("Patch failed to apply or build verification failed; source changes were discarded.");
  process.exit(1);
}
console.log("AI patch passed npm run build; it is eligible for an automated commit.");
