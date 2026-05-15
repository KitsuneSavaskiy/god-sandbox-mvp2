# Requirements — Music Garden MIDI Interaction

## Feature Summary

Music Garden lets the player upload a MIDI file and play it as sandbox BGM.
Parsed notes are rendered as semi-transparent mystical visuals in the background.
The player clicks active note visuals to build a consecutive success streak.
Every 10 consecutive successful note clicks grant +1 godPoint, up to a cap of 2 per loaded file,
and never exceeding MAX_GOD_POINTS.

## User Stories

### Story 1 — Upload and Play as BGM
As a player,
I want to upload a MIDI file and hear it play as background music in my sandbox,
So that I can bring my own music into the world I am watching over.

### Story 2 — Note Streak Interaction
As a player,
I want to click on floating note visuals in sequence without missing any,
So that my consecutive success streak grows and earns godPoints.

### Story 3 — Reward Economy
As a player,
I want to understand the streak target and reward cap before I start playing,
So that I can plan my god actions strategically.

## Acceptance Criteria

### Requirement 1 — MIDI Upload
WHEN the player selects a `.mid` or `.midi` file via the Music Garden panel
THE SYSTEM SHALL read the file in the browser without uploading it to a server.

### Requirement 2 — MIDI Parsing
WHEN a valid MIDI file is loaded
THE SYSTEM SHALL convert note-on and note-off events into normalized note events.

The parser scope shall include Standard MIDI File format 0 and format 1, variable-length delta
time, tempo meta event `0xFF 0x51`, running status, and note-on with velocity 0 treated as
note-off. Unsupported MIDI events shall be skipped safely without crashing the sandbox.

### Requirement 3 — BGM Playback
WHEN MIDI playback is active
THE SYSTEM SHALL play a simple browser-generated audio version of the parsed MIDI notes.
High-quality audio synthesis and soundfonts are out of scope; lightweight oscillator tones are sufficient.

### Requirement 4 — Visual Notes
WHEN MIDI playback is active
THE SYSTEM SHALL render semi-transparent mystical note visuals in the sandbox background,
above the world backdrop and below the event UI layer.

### Requirement 5 — Successful Note Click
WHEN the player clicks an active, unclicked visual note during MIDI playback
THE SYSTEM SHALL mark that note as successfully clicked and increase the current note success streak by 1.

### Requirement 6 — Duplicate Click Prevention
WHEN the player clicks the same note more than once
THE SYSTEM SHALL NOT increase the current note success streak after the first successful click.

### Requirement 7 — Streak Reward Conversion
WHEN the current note success streak reaches 10 consecutive successful note clicks
THE SYSTEM SHALL grant at most 1 godPoint and reset the current note success streak to 0.

### Requirement 8 — Streak Break on Missed Visual Note
WHEN an active clickable visual note expires without being clicked while rewards are enabled
THE SYSTEM SHALL reset the current note success streak to 0.
Notes that are parsed but not rendered as visual notes (e.g., truncated due to the MVP note count limit)
SHALL NOT count as missed notes and SHALL NOT trigger a streak break.

### Requirement 9 — Per-File Reward Cap
WHEN the currently loaded MIDI file has already granted 2 godPoints
THE SYSTEM SHALL NOT grant additional godPoints from note click streaks.

### Requirement 10 — MAX_GOD_POINTS Boundary
WHEN a music reward is about to be granted
THE SYSTEM SHALL NOT increase godPoints beyond MAX_GOD_POINTS.
If godPoints are already at MAX_GOD_POINTS, the system shall not count the blocked reward toward the per-file reward cap.

### Requirement 11 — Event UI Pause
WHEN the event window or result modal is open
THE SYSTEM SHALL disable note click rewards and pause streak-breaking note expiry until the event UI is closed.

### Requirement 12 — Reset Does Not Restore Reward Eligibility
WHEN the player resets playback for the currently loaded MIDI file
THE SYSTEM SHALL NOT reset the per-file godPoint reward cap.
The streak resets to 0, but previously earned godPoints from this file are not recoverable this session.

### Requirement 13 — New File Upload Resets Session
WHEN the player uploads a new MIDI file
THE SYSTEM SHALL create a new Music Garden session: reset the per-file reward cap, the streak, and all clicked note state.

### Requirement 14 — Performance Guard
WHEN a MIDI file exceeds the MVP file size, duration, or note count limit
THE SYSTEM SHALL reject it or truncate visualized notes and display a clear warning to the player.

### Requirement 15 — Information Safety
THE SYSTEM SHALL NOT display faith, relation score, five-phase internal values,
or any raw internal parameter in the Music Garden UI or pass them to any LLM context.

## Out of Scope

- MIDI file persistent storage (no save between sessions)
- Server upload of MIDI files
- High-quality audio synthesis or soundfont loading
- Instrument selection or DAW-like editing
- LLM-generated music or composition
- Automatic event generation triggered by music analysis
- New npm package dependencies

## PO Confirmation Points

- Streak target value (currently specified as 10 consecutive successful note clicks)
- Per-file godPoint cap (currently specified as 2)
- Visual design direction for note particles (color, shape, animation speed)
- Placement of the Music Garden upload panel (must not overlap the top-right vitality/godPoints HUD)
- MIDI file size limit for MVP (recommended: 2 MB)
- Maximum visualized note count (recommended: 800)
- Maximum song duration (recommended: 10 minutes)
- Maximum active note visuals at once (recommended: 80)
