# Requirements

## Feature Summary

Music Garden lets players bring their own MIDI composition into the sandbox.
The uploaded MIDI is parsed in the browser, visualized as mystical semi-transparent notes in the background, and can be clicked to build musicCharge.
musicCharge can restore godPoints with a strict per-file cap.

## User Stories

### Story 1 — Musician Player
As a player who creates music,
I want to upload my own MIDI file,
So that my composition becomes part of the sandbox atmosphere.

### Story 2 — Interactive God
As a god-like player,
I want to click mystical notes flowing through the sandbox,
So that my music feels like a blessing that restores intervention power.

### Story 3 — Game Balance
As the product owner,
I want music rewards to be capped,
So that godPoints do not become unlimited or trivial.

## Acceptance Criteria

### Requirement 1 — MIDI Upload
WHEN the player selects a `.mid` or `.midi` file
THE SYSTEM SHALL read the file in the browser without uploading it to a server.

### Requirement 2 — MIDI Parsing
WHEN a valid MIDI file is loaded
THE SYSTEM SHALL convert note-on and note-off events into normalized note events.

The parser scope shall include Standard MIDI File format 0 and format 1, variable-length delta time, tempo meta event `0xFF 0x51`, running status, and note-on with velocity 0 as note-off.
Unsupported MIDI events shall be skipped safely without crashing the sandbox.

### Requirement 3 — Visual Notes
WHEN MIDI playback is active
THE SYSTEM SHALL render semi-transparent mystical note visuals in the sandbox background.

### Requirement 4 — Note Click
WHEN the player clicks an active visual note
THE SYSTEM SHALL mark that note as clicked and increase musicCharge by 1.

### Requirement 5 — Duplicate Click Prevention
WHEN the player clicks the same note more than once
THE SYSTEM SHALL NOT increase musicCharge after the first click.

### Requirement 6 — Reward Conversion
WHEN musicCharge reaches 10
THE SYSTEM SHALL grant at most 1 godPoint and reset musicCharge.

### Requirement 7 — Reward Cap
WHEN the current MIDI session has already granted 2 godPoints
THE SYSTEM SHALL NOT grant additional godPoints from note clicks.

### Requirement 8 — Max God Points
WHEN a music reward is granted
THE SYSTEM SHALL NOT increase godPoints beyond MAX_GOD_POINTS.

If godPoints are already at MAX_GOD_POINTS, the system shall not count the blocked reward toward the per-file reward cap.

### Requirement 9 — Event UI Boundary
WHEN the event window or result modal is open
THE SYSTEM SHALL disable note click rewards or lower the visual interaction priority so it does not interfere with event play.

### Requirement 10 — Safety
THE SYSTEM SHALL NOT display faith, relation score, five-phase internal values, or internal parameters.

## Out of Scope

- Persistent MIDI storage
- Server upload
- High-quality synthesizer
- Instrument selection
- Multiple-song playlist
- LLM-generated music
- Event generation from music
- Unlimited godPoints farming
- Package dependency changes

## PO Confirmation Points

- Is `10 musicCharge = +1 godPoint` acceptable?
- Is `max +2 godPoints per MIDI file` acceptable?
- Should UI wording use `Music Garden`, `音の祝福`, or `神力回復`?
- Should note visuals pause or fade during event windows?
