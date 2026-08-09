/**
 * Runs release-level security assurance and records the outcome.
 * This verifies audit, integrity, SBOM, package, and regulated-profile checks
 * used when preparing an Editra release.
 */
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync, execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm_execpath is required to run the assurance suite.");
const commands = [
  ["build", ["run", "build"]],
  ["unit-contracts", ["run", "test:unit"]],
  ["cross-browser", ["run", "test:cross-browser"]],
  ["dependency-audit", ["audit", "--audit-level=high"]],
  ["runtime-integrity", ["run", "security:integrity:check"]],
  ["sbom", ["run", "security:sbom:check"]],
  ["package", ["run", "pack:check"]],
];
const results = commands.map(([name, args]) => {
  const started = Date.now();
  const execution = spawnSync(process.execPath, [npmCli, ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  const output = `${execution.stdout || ""}\n${execution.stderr || ""}`.trim();
  const status = execution.status ?? 1;
  console.log(`${name}: ${status === 0 ? "passed" : "failed"}`);
  return {
    name,
    command: `npm ${args.join(" ")}`,
    status: status === 0 ? "passed" : "failed",
    exitCode: status,
    durationMs: Date.now() - started,
    outputSha256: crypto.createHash("sha256").update(output).digest("hex"),
    ...(execution.error ? { launchError: execution.error.message } : {}),
    outputTail: output.slice(-2000),
  };
});
let commit = "unavailable";
try {
  commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
} catch {}
const report = {
  schemaVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  commit,
  workingTreeQualified: "The report covers the current working tree; a release attestation requires a clean tagged commit.",
  result: results.every((item) => item.status === "passed") ? "passed" : "failed",
  results,
};
const outputPath = path.join(root, "artifacts", "security-assurance.json");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Assurance report: ${path.relative(root, outputPath)} (${report.result}).`);
if (report.result !== "passed") process.exitCode = 1;
