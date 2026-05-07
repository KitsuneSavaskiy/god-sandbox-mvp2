#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const DEFAULT_BASE = "origin/main";

const forbiddenRules = [
  {
    id: "sidekick-jobs",
    label: ".godsandbox/jobs/**",
    match: (path) => path.startsWith(".godsandbox/jobs/"),
  },
  {
    id: "sidekick-portraits",
    label: ".godsandbox/portraits/**",
    match: (path) => path.startsWith(".godsandbox/portraits/"),
  },
  {
    id: "hatch-pet-runs",
    label: ".hatch-pet-runs/**",
    match: (path) => path.startsWith(".hatch-pet-runs/"),
  },
  {
    id: "generated-assets",
    label: "assets/generated/**",
    match: (path) => path.startsWith("assets/generated/"),
  },
  {
    id: "resident-work-assets",
    label: "assets/residents/**",
    match: (path) => path.startsWith("assets/residents/"),
  },
  {
    id: "generated-narrative",
    label: "narrative/generated/**",
    match: (path) => path.startsWith("narrative/generated/"),
  },
  {
    id: "manifest-drafts",
    label: "manifests/drafts/**",
    match: (path) => path.startsWith("manifests/drafts/"),
  },
  {
    id: "incoming",
    label: "incoming/**",
    match: (path) => hasPathSegment(path, "incoming"),
  },
  {
    id: "tmp",
    label: "tmp/**",
    match: (path) => hasPathSegment(path, "tmp"),
  },
  {
    id: "rejected",
    label: "rejected/**",
    match: (path) => hasPathSegment(path, "rejected"),
  },
  {
    id: "user-uploads",
    label: "user-uploads/**",
    match: (path) => hasPathSegment(path, "user-uploads"),
  },
  {
    id: "dist",
    label: "dist/**",
    match: (path) => path.startsWith("dist/"),
  },
  {
    id: "local-state",
    label: ".local/**",
    match: (path) => path.startsWith(".local/"),
  },
  {
    id: "tmp-root",
    label: "tmp-*",
    match: (path) => path.startsWith("tmp-"),
  },
  {
    id: "browser-profiles",
    label: "browser profiles",
    match: (path) =>
      path.startsWith("chrome-profile") ||
      path.startsWith("browser-profile") ||
      path.startsWith("playwright-profile"),
  },
  {
    id: "local-logs",
    label: "local logs",
    match: (path) =>
      path.startsWith(".logs/") ||
      path.startsWith("logs/") ||
      path.endsWith(".log") ||
      path.endsWith(".local.log"),
  },
];

function main() {
  let options;
  let normalizedPaths;

  try {
    options = parseArgs(process.argv.slice(2));
    const paths =
      options.paths.length > 0 ? options.paths : getChangedPaths(options.base, options.includeUntracked);
    normalizedPaths = [...new Set(paths.map(normalizePath).filter(Boolean))];
  } catch (error) {
    printCommandFailure(error);
    process.exitCode = 1;
    return;
  }

  const findings = findForbiddenPaths(normalizedPaths);

  if (findings.length > 0) {
    printFailure(findings);
    process.exitCode = 1;
    return;
  }

  console.log("Git boundary guard passed.");
  console.log(`Checked paths: ${normalizedPaths.length}`);
}

function parseArgs(args) {
  const options = {
    base: DEFAULT_BASE,
    includeUntracked: false,
    paths: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--base") {
      options.base = requireValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--include-untracked") {
      options.includeUntracked = true;
      continue;
    }

    if (arg === "--path") {
      options.paths.push(requireValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg === "--path-list") {
      const pathListFile = requireValue(args, index, arg);
      options.paths.push(...readPathList(pathListFile));
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function requireValue(args, index, optionName) {
  const value = args[index + 1];
  if (!value) {
    throw new Error(`${optionName} requires a value.`);
  }

  return value;
}

function readPathList(pathListFile) {
  return readFileSync(pathListFile, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getChangedPaths(base, includeUntracked) {
  const changedPaths = runGit(["diff", "--name-only", `${base}...HEAD`]);

  if (!includeUntracked) {
    return changedPaths;
  }

  return [...changedPaths, ...runGit(["ls-files", "--others", "--exclude-standard"])];
}

function runGit(args) {
  let output;
  try {
    output = execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error("Unable to inspect Git changed paths. Run this guard from the repository root and retry.");
  }

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function printCommandFailure(error) {
  const message = error instanceof Error ? error.message : "Git boundary guard could not run.";
  console.error("Git boundary guard could not complete.");
  console.error(sanitizeForOutput(message));
}

function normalizePath(path) {
  return path.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function hasPathSegment(path, segment) {
  return path.split("/").includes(segment);
}

function findForbiddenPaths(paths) {
  const findings = [];

  for (const path of paths) {
    for (const rule of forbiddenRules) {
      if (rule.match(path)) {
        findings.push({
          rule,
          path,
        });
        break;
      }
    }
  }

  return findings;
}

function printFailure(findings) {
  console.error("Git boundary guard failed.");
  console.error("Do not commit local job files, generated output, manifest drafts, logs, or dist output.");

  const grouped = new Map();
  for (const finding of findings) {
    const existing = grouped.get(finding.rule.id) ?? {
      rule: finding.rule,
      paths: [],
    };
    existing.paths.push(finding.path);
    grouped.set(finding.rule.id, existing);
  }

  for (const group of grouped.values()) {
    console.error(`- ${group.rule.label}: ${group.paths.length} path(s)`);
    for (const path of group.paths.slice(0, 3)) {
      console.error(`  - ${sanitizeForOutput(path)}`);
    }
    if (group.paths.length > 3) {
      console.error("  - ...");
    }
  }
}

function sanitizeForOutput(value) {
  return value
    .replace(/[A-Za-z]:[\\/][^\s]+/g, "<host-absolute-path>")
    .replace(/\/(?:Users|home)\/[^\s]+/g, "<host-absolute-path>")
    .replace(/\\\\[^\\]+\\[^\s]+/g, "<host-absolute-path>")
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "<redacted-secret>")
    .replace(/ghp_[A-Za-z0-9_]{8,}/g, "<redacted-token>")
    .replace(/gh[ousr]_[A-Za-z0-9_]{8,}/g, "<redacted-token>")
    .replace(/github_pat_[A-Za-z0-9_]{8,}/g, "<redacted-token>")
    .replace(/AKIA[0-9A-Z]{12,}/g, "<redacted-key>");
}

function printHelp() {
  console.log(`Usage:
  node tools/security/check-git-boundary.mjs [--base origin/main] [--include-untracked]
  node tools/security/check-git-boundary.mjs --path docs/example.md --path dist/index.html
  node tools/security/check-git-boundary.mjs --path-list changed-paths.txt

Default behavior checks git diff --name-only <base>...HEAD.
`);
}

main();
