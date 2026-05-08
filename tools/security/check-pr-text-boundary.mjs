#!/usr/bin/env node
/**
 * check-pr-text-boundary.mjs
 *
 * Scans PR title/body (passed via env vars or args) for leaked secrets,
 * local absolute paths, and API key patterns.
 *
 * Usage in GitHub Actions:
 *   PR_TITLE="${{ github.event.pull_request.title }}" \
 *   PR_BODY="${{ github.event.pull_request.body }}" \
 *   node tools/security/check-pr-text-boundary.mjs
 *
 * Local usage:
 *   node tools/security/check-pr-text-boundary.mjs --text "some PR body text"
 */

const FORBIDDEN_PATTERNS = [
  {
    id: "unix-home-path",
    description: "Unix absolute home path (local environment leak)",
    regex: /\/home\/[a-zA-Z0-9_\-.]+\/[a-zA-Z0-9_\-./]+/g,
    severity: "HIGH",
  },
  {
    id: "macos-users-path",
    description: "macOS /Users/ absolute path (local environment leak)",
    regex: /\/Users\/[a-zA-Z0-9_\-.]+\/[a-zA-Z0-9_\-./]+/g,
    severity: "HIGH",
  },
  {
    id: "windows-drive-path",
    description: "Windows drive absolute path (local environment leak)",
    regex: /[A-Za-z]:\\[A-Za-z0-9_\-\\. ]+/g,
    severity: "HIGH",
  },
  {
    id: "openai-sk-key",
    description: "OpenAI sk- API key",
    regex: /sk-[A-Za-z0-9]{32,}/g,
    severity: "CRITICAL",
  },
  {
    id: "github-pat",
    description: "GitHub personal access token",
    regex: /(ghp_|gho_|github_pat_)[A-Za-z0-9_]{36,}/g,
    severity: "CRITICAL",
  },
  {
    id: "aws-access-key",
    description: "AWS access key ID",
    regex: /AKIA[0-9A-Z]{16}/g,
    severity: "CRITICAL",
  },
  {
    id: "generic-secret-assignment",
    description: "Generic secret/token/api_key assignment with long value",
    regex: /(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[A-Za-z0-9+/]{32,}['"]?/gi,
    severity: "HIGH",
  },
];

const ALLOWLIST_PATTERNS = [
  /fileNameToken/,
  /\/home\/\*\*/,
  /\/Users\/\*\*/,
  /example\.com/,
  /localhost/,
  /127\.0\.0\.1/,
];

function isAllowlisted(match) {
  return ALLOWLIST_PATTERNS.some((p) => p.test(match));
}

function scanText(label, text) {
  const violations = [];
  for (const rule of FORBIDDEN_PATTERNS) {
    const matches = [...text.matchAll(rule.regex)];
    for (const match of matches) {
      if (!isAllowlisted(match[0])) {
        violations.push({
          label,
          rule: rule.id,
          severity: rule.severity,
          description: rule.description,
          match: match[0].slice(0, 60) + (match[0].length > 60 ? "…" : ""),
        });
      }
    }
  }
  return violations;
}

function main() {
  const args = process.argv.slice(2);
  const textArgIdx = args.indexOf("--text");

  let sources = [];

  if (textArgIdx !== -1 && args[textArgIdx + 1]) {
    sources.push({ label: "argument", text: args[textArgIdx + 1] });
  } else {
    const prTitle = process.env.PR_TITLE ?? "";
    const prBody = process.env.PR_BODY ?? "";

    if (!prTitle && !prBody) {
      console.log("No PR_TITLE or PR_BODY env vars set and no --text argument. Nothing to scan.");
      process.exit(0);
    }

    if (prTitle) sources.push({ label: "PR title", text: prTitle });
    if (prBody) sources.push({ label: "PR body", text: prBody });
  }

  const allViolations = sources.flatMap(({ label, text }) => scanText(label, text));

  if (allViolations.length === 0) {
    console.log("✅ PR text boundary check passed. No secrets or local paths detected.");
    process.exit(0);
  }

  console.error("❌ PR text boundary check FAILED. Potential secrets or local paths detected:\n");
  for (const v of allViolations) {
    console.error(`  [${v.severity}] ${v.label} — ${v.rule}: ${v.description}`);
    console.error(`    match: ${v.match}`);
  }
  console.error("\nRemove secrets and local paths from PR title/body before merging.");
  process.exit(1);
}

main();
