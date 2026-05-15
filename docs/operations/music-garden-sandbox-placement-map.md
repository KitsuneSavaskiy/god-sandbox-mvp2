# Music Garden Sandbox Placement Map

## Purpose

Music Gardenを実装する前に、箱庭画面内での配置・重なり・操作優先度を整理する。

This document is a placement handoff only. It does not change Kiro specs, runtime code, CSS, assets, or package dependencies.

## Quality Function

The placement design is acceptable only if all of the following are true:

- Scope: only this operations document is changed.
- Evidence: current sandbox viewport, HUD, residents, dialogue, event alert, event window, result view, and participant overlay layers are reflected.
- Placement: the recommended Music Garden panel position avoids existing HUDs and central event play.
- Layering: z-index and interaction priority prevent Music Garden from stealing event UI control.
- Mobile: 390px / 360px behavior has a compact placement rule.
- Accessibility: upload, controls, clickable notes, reduced motion, and event pause messaging are covered.
- Handoff: implementation files and boundaries are clear.

If any check fails, revise the document before implementation begins.

## Current Sandbox UI Zones

### Top-left

- Current owner: time / season HUD.
- Current placement: absolute top-left inside `.event-first-sandbox__viewport`.
- Current layer: z-index 8.
- Pointer behavior: `pointer-events: none`.
- Collision risk: Music Garden panel here would crowd the clock, season icon, and narrow mobile top row.

Decision: do not place Music Garden controls in the top-left.

### Top-right

- Current owner: vitality / godPoints HUD.
- Current placement: absolute top-right inside `.event-first-sandbox__viewport`.
- Current layer: z-index 8.
- Pointer behavior: visual HUD, not the main interaction target.
- Collision risk: this HUD is a high-priority gameplay status area.

Decision: Music Garden panel must never use the top-right position.

### Center

- Current owners:
  - residents
  - apostle runner
  - dialogue bubbles
  - event alert `!`
  - event window / intervention UI
  - result view
- Current resident layers:
  - CSS defaults start around z-index 3 / 4 / 6.
  - Runtime perspective can set residents around z-index 12-68.
  - Apostle runner uses z-index 5 and is pointer-events none.
- Dialogue bubble layer uses z-index 80 and should remain readable.
- Event alert `!` must remain easy to click.
- Event window / result view currently uses a fixed right-bottom card around z-index 22.
- Event window and result view must stay above Music Garden visuals and rewards.
- Music Garden must not infer that resident runtime depth can outrank event UI. Event UI priority is a product rule even when the current CSS values require careful stacking during implementation.

Decision: Music Garden visuals may pass through the center as ambient background, but Music Garden controls must not live in the center.

### Bottom-left

- Current owner: mostly open sandbox space outside the top HUDs.
- Strength: avoids top-left time HUD and top-right vitality HUD.
- Strength: can become a compact dock or bottom sheet on mobile.
- Risk: may overlap low-pitch note visuals or front resident feet if expanded too much.
- Risk: if implemented inside the viewport with only z-index, dynamic resident depth can cross in front of it. Prefer a compact reserved panel footprint rather than solving this with z-index alone.

Decision: recommended MVP location for the Music Garden compact panel.

### Bottom-right

- Current owner: mostly open sandbox space outside the top HUDs.
- Strength: avoids top-right HUD vertically if kept low.
- Risk: right-side interaction can feel closer to the vitality HUD and may compete with future right-side controls.
- Risk: on narrow mobile screens, bottom-right can collide with thumb reach and event affordances.

Decision: acceptable fallback location, but not the MVP default.

### Bottom-center

- Current owner: visually close to the ground plane and residents.
- Strength: easy to notice.
- Risk: more likely to cover residents, dialogue anchors, and event alert sightlines.

Decision: use only as a compact collapsed dock if bottom-left is not usable.

### Full viewport background layer

- Current world backdrop is absolute, full viewport, z-index 0, `pointer-events: none`.
- The viewport is `position: relative`, `overflow: hidden`, and `isolation: isolate`.
- World backdrop transitions are already used for time / season background changes.

Decision: Music Garden note visuals should be viewport-wide but visually background-like.

### Event art participant overlay

- Current owner: event window image area.
- Current layer: event art image below participant overlay inside the event art frame.
- Participant layer is pointer-events none and uses side slots for up to 4 characters.
- Risk: Music Garden visuals should not appear inside the event art frame as if they were event participants.

Decision: Music Garden visuals belong to the sandbox viewport background, not the event art participant overlay.

## Placement Options

| Option | Summary | Strengths | Risks | Verdict |
|---|---|---|---|---|
| A. bottom-left panel | Compact control panel in lower-left | Avoids both top HUDs, works as mobile bottom dock, leaves center for events | Can overlap low-pitch notes if too tall | Recommended MVP |
| B. bottom-right panel | Compact panel in lower-right | Avoids left time HUD, familiar media-control area | Closer to vitality HUD side and possible future drawer/UI | Secondary option |
| C. bottom-center compact dock | Centered bottom dock | Easy to find and thumb-friendly | Most likely to cover residents and event focus | Use only if collapsed by default |
| D. collapsible floating tab | Small tab that expands when needed | Minimizes clutter | More implementation complexity and discoverability risk | Later enhancement |

## Recommended MVP Placement

Recommended placement: bottom-left compact panel.

Reasons:

- It avoids the top-right vitality / godPoints HUD.
- It avoids the top-left time / season HUD.
- It keeps the center of the sandbox available for residents, dialogue bubbles, event alert, event window, and result view.
- It can become a mobile bottom dock without changing the feature model.
- It makes the upload/play/pause area visible without making the feature feel like a rhythm game.

Implementation rule:

- Panel: bottom-left compact panel.
- Never top-right.
- Must not overlap vitality / godPoints HUD.
- Must not cover event window, result view, watch/help/trial controls, or event alert `!`.

## z-index Layer Map

Recommended implementation layer order:

| z-index | Layer |
|---:|---|
| 0 | world backdrop |
| 1 | Music Garden passive note visual background layer |
| 2 | existing viewport ambient overlays / ground effects |
| 3-6 | CSS default resident / apostle / front-resident range |
| 12-68 | runtime resident depth range from perspective calculation |
| 5 | apostle runner / local ambience |
| 6 | Music Garden clickable note layer, limited to active notes only and only when it does not compete with residents |
| 7 | resident emotes / event alert `!` local layer |
| 8 | time-season HUD / vitality HUD |
| 9 | Music Garden compact panel if placed in a reserved non-resident footprint |
| 20+ | event window / intervention UI, including current fixed event card around z-index 22 |
| 30+ | result view if split into a separate future layer |
| 80 | dialogue layer in the current viewport implementation |

Important: this table is a handoff map, not a command to make Music Garden outrank event UI. Music Garden implementation must always keep event window and result view as higher-priority interactions.

Music Garden visual layer:

- above world backdrop
- below residents and event UI
- disabled for rewards while event window/result view is open

Music Garden panel:

- bottom-left by default
- bottom-right only as fallback
- never top-right
- must not overlap vitality / godPoints HUD

Notes:

- Passive note glows can sit at z-index 1.
- Clickable notes should appear only when active and should stay below HUDs, dialogue, and event UI.
- If clickable notes conflict with the event alert `!`, the event alert wins.
- Music Garden panel can use z-index 9 only if its footprint avoids the resident plane. If the panel must overlap residents, create a separate layout dock outside the moving-resident region rather than raising it above dialogue or event UI.
- Do not place Music Garden controls above the dialogue layer just to win z-index; that would make speech bubbles harder to read.

## Note Visual Direction

Music Garden note visuals should feel like atmosphere, not a rhythm-game lane.

Visual style:

- semi-transparent
- sparkle-like
- mystical
- gentle
- visually quiet enough to keep residents readable
- clickable notes slightly brighter than passive notes

Motion:

- MVP direction: left-to-right gentle drift.
- Low pitch: lower third of the viewport.
- Mid pitch: middle third of the viewport.
- High pitch: upper third of the viewport.
- Avoid resident face areas when possible by keeping active notes small and sparse.
- Do not draw a hard judgment line or lane.

Event state:

- event window open: opacity around 0.18 and click rewards disabled.
- result view open: opacity around 0.12 or hidden, with click rewards disabled.

## Interaction Priority

### Normal play

- note click: enabled
- panel controls: enabled
- resident click: preserved
- event alert `!`: preserved
- watch / help / trial: not present unless event window is open

### Event window open

- note click: disabled
- note streak increment and godPoint reward: disabled
- streak or timing pressure: paused
- panel controls: pause/reset may remain available if they do not cover the event UI
- visuals: dimmed and non-dominant
- event window and intervention controls take priority

### Result view open

- note click: disabled
- note streak increment and godPoint reward: disabled
- streak or timing pressure: paused
- panel controls: pause/reset may remain available if they do not cover the result view
- visuals: dimmed or hidden
- result view takes priority

Reason: Music Garden must not steal the main action when the player is resolving a focusedEvent.

## Mobile Placement

Desktop:

- panel: bottom-left compact panel
- visualizer: full viewport
- active clickable notes max: 80 as an initial performance guideline

Mobile 390px / 360px:

- panel: bottom dock
- initial state: collapsed
- expanded state: upload / play / pause / reset only
- avoid multi-line instructional copy inside the viewport
- active clickable notes max: 40 as an initial performance guideline
- note size and glow should be reduced
- event window / result view still wins all interaction priority

Mobile guardrails:

- Do not cover the top-left clock / season HUD.
- Do not cover the top-right vitality / godPoints HUD.
- Do not block resident click targets.
- Do not block the event alert `!`.
- Do not add horizontal overflow.

## Accessibility

- MIDI upload input must have a visible label.
- Play / pause / reset must be real buttons.
- Clickable notes should be buttons or expose `role="button"` with an accessible name.
- `prefers-reduced-motion: reduce` should reduce or stop note drift.
- Music Garden should work visually even when audio is muted or unavailable.
- During event window, the UI may expose an aria description such as `イベント中は音符の祝福を一時停止しています`.
- Do not rely on color alone to show clickable note state.
- Do not show faith, relation score, five-phase values, or raw internal parameters.

## Future Implementation Handoff

Recommended files:

- `src/features/music-garden/MusicGardenPanel.tsx`
- `src/features/music-garden/MusicGardenVisualizer.tsx`
- `src/features/music-garden/MusicGarden.css`
- `src/features/events/EventFirstSandbox.tsx`
- `src/features/events/EventFirstSandbox.css`

Recommended placement:

- Panel: bottom-left compact panel.
- Panel footprint: reserved lower-left control area, not centered over the resident movement plane.
- Visualizer: viewport-wide background layer.
- Passive notes: above world backdrop, below residents.
- Clickable notes: limited foreground layer below HUDs and event UI.
- Rewards disabled while event window/result view is open.
- Mobile: collapsed bottom dock with fewer active notes.

Implementation must not:

- place Music Garden controls in the top-right
- cover vitality / godPoints HUD
- cover time / season HUD
- cover event window or result view
- change faith, relation score, five-phase values, or event outcome logic
- turn Music Garden into a rhythm-game lane

## Review Checklist

- Does the panel avoid the vitality / godPoints HUD?
- Does the panel avoid the time / season HUD?
- Does the visualizer stay below residents, HUDs, and event UI?
- Are note rewards disabled while event window/result view is open?
- Does the mobile plan work at 390px and 360px?
- Does the handoff clearly name implementation files without implementing them?
- Does the document avoid `.kiro/**`, `src/**`, `public/**`, package, and asset changes?
