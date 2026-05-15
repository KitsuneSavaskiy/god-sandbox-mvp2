# Requirements — Music Garden MIDI Interaction

## Feature Summary

Music Garden lets the player upload a MIDI file, which is parsed in the browser and rendered as
semi-transparent mystical note visuals in the sandbox background. Clicking notes accumulates
musicCharge, which converts to godPoints at a defined rate, capped per song and bounded by
MAX_GOD_POINTS.

## User Stories

### Story 1 — Upload and Play
As a player,
I want to upload a MIDI file from my device,
So that I can fill the sandbox with musical energy.

### Story 2 — Note Interaction
As a player,
I want to click on floating note visuals,
So that I can accumulate musicCharge and earn godPoints.

### Story 3 — Reward Economy
As a player,
I want to understand the reward cap before I start playing,
So that I can plan my god actions strategically.

## Acceptance Criteria

### Requirement 1 — MIDI Upload
WHEN the player selects a `.mid` or `.midi` file via the Music Garden panel
THE SYSTEM SHALL read the file in the browser without uploading it to a server.

### Requirement 2 — MIDI Parsing
WHEN a valid MIDI file is loaded
THE SYSTEM SHALL convert note-on and note-off events into normalized note events
with at minimum: pitch, start time (ms), and duration (ms).

### Requirement 3 — Visual Notes
WHEN MIDI playback is active
THE SYSTEM SHALL render semi-transparent mystical note visuals in the sandbox background,
above the world backdrop and below the event UI layer.

### Requirement 4 — Note Click
WHEN the player clicks an active visual note
THE SYSTEM SHALL mark that note as clicked and increase musicCharge by 1.

### Requirement 5 — Duplicate Click Prevention
WHEN the player clicks the same note more than once
THE SYSTEM SHALL NOT increase musicCharge after the first click.

### Requirement 6 — Reward Conversion
WHEN musicCharge reaches 10
THE SYSTEM SHALL grant at most 1 godPoint and reset musicCharge to 0.

### Requirement 7 — Per-Session Reward Cap
WHEN the current MIDI session has already granted 2 godPoints
THE SYSTEM SHALL NOT grant additional godPoints from note clicks, regardless of musicCharge.

### Requirement 8 — MAX_GOD_POINTS Boundary
WHEN a music reward is about to be granted
THE SYSTEM SHALL NOT increase godPoints beyond MAX_GOD_POINTS.

### Requirement 9 — UI Non-Interference
WHEN the event window or result modal is open
THE SYSTEM SHALL disable note click rewards (musicCharge does not increase)
and reduce visual layer priority so note visuals do not interfere with the event UI.

### Requirement 10 — Information Safety
THE SYSTEM SHALL NOT display faith, relation score, five-phase internal values,
or any raw internal parameter in the Music Garden UI or pass them to any LLM context.

## Out of Scope

- MIDI file persistent storage (no save between sessions)
- Server upload of MIDI files
- High-quality audio synthesis or soundfont loading
- LLM-generated music or composition
- Automatic event generation triggered by music analysis
- New npm package dependencies

## PO Confirmation Points

- Exact musicCharge-to-godPoint ratio (currently specified as 10:1)
- Per-song godPoint cap (currently specified as 2)
- Visual design direction for note particles (color, shape, animation speed)
- Placement of the Music Garden upload panel (must not overlap the HP HUD at top-right)
