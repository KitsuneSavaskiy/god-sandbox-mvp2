# Security Boundary

## Secrets

Never commit to any Git-tracked file:

- Secrets, API keys, tokens, credentials, session identifiers
- Local absolute paths or machine-specific environment names
- Individual account settings or personal configuration
- Generated cache, build artifacts, or pipeline output

This applies to `AGENTS.md`, `CLAUDE.md`, `.kiro/**`, `docs/**`, and all source files.

## Runtime Boundaries

### LLM Context

- Never pass raw faith values, relation scores, five-phase internal values, or any raw internal game parameter to an LLM prompt.
- Convert faith to the canonical `FaithBand` string before including it in any prompt.
  Examples: `"disbelieves"`, `"uncertain"`, `"senses_presence"`, `"believes"`, `"devoted"`.
- All LLM output must pass through `src/ai/security/output_guard.ts` before reaching UI or downstream processing.
- `state_change_request` in LLM output is always `null` and is enforced by schema validation in `src/ai/schemas/`.

### Web App Runtime

- The web app must not call image generation APIs.
- The web app must not call LLM APIs directly from the client without the application-layer boundary.
- The web app must not upload MIDI files to a server. MIDI is parsed in the browser only (FileReader API).
- No new external API calls may be added to the web app runtime without explicit PO approval.

### MIDI (Music Garden)

- MIDI files are selected locally and read via the FileReader API in the browser.
- No MIDI data is transmitted to any server.
- MIDI parsing is performed by a custom lightweight parser in `src/features/music-garden/musicGardenMidi.ts`.
- Maximum MIDI file size to accept in MVP is a PO-confirmed value (guard against browser memory issues with very large files).

### UI Display

- No raw internal values (faith, five-phase, relation scores) may appear in any UI component.
- No internal game parameters may be passed to Music Garden UI or any player-facing surface.

## Asset Pipeline Boundary

- `.asset-pipeline/**` and `.godsandbox/**` are local-only directories. Their contents must not be committed.
- Approved assets land in `public/art/` only after PO sign-off.
- Art generation prompts, if Git-managed, are placed in `docs/art-prompts/` and must not contain personal images, personal settings, secrets, or local paths.

## Development Support vs. Runtime

- `CLAUDE.md`, `.kiro/**`, and `docs/` are development support context. They are not a production security boundary.
- Production guardrails are implemented in `src/ai/security/` and `src/ai/schemas/`.
- A rule written in a steering doc does not substitute for a code-level guard.
