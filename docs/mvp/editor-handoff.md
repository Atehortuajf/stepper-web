# MVP editor transaction handoff

## Implemented

- Audio loaded after a document now attaches to the current session without replacing charts, timing, or metadata. Audio loaded against the untouched startup demo creates a one-chart audio draft, preserving onboarding without treating an edited or imported document as blank.
- Undo/redo histories are keyed by document and chart and restore only the affected chart. Global timing edits invalidate older chart histories before recording their own transaction, preventing an older chart undo from restoring stale song timing.
- Timing edits target the active effective timing layer. They replace only beat-zero BPM/time-signature events, preserve later events and all other timing lists, and mark only changed fields in `presentTags` for split-timing export.
- Every note-row transaction rebuilds measures and derived holds. Automatic hold tails advance to the next free snap rather than overwriting an event.
- Range commits reject selections that split an existing hold at either boundary and reject generated orphan tails, overlapping heads, and unclosed heads. Hold derivation no longer invents a tail at the chart's final row.
- Generated proposals capture document, chart, revision, and an immutable half-open beat interval. Stale responses are discarded, stale commits are rejected, errors leave no actionable empty proposal, and rows exactly at the exclusive end boundary survive.
- Full-song generation includes the duration of loaded audio using the effective timing engine.
- Generation sends the real waveform sample rate, slice origin, and half-open 48-tick timing timestamps so variable-tempo audio slices stay aligned across engines.

## Verification

- `npm test -- --run src/__tests__/App.editorTransactions.test.tsx src/editor/transactions/__tests__/editorTransactions.test.ts src/editor/conditioning/__tests__/conditioning.test.tsx`: 29 passed.
- The portable M2 tempo suite generates a deterministic 170 BPM stereo PCM fixture in memory and exercises the real tempo estimator and `AudioEngine` integration without private song paths or subprocesses.
- `npm run build`: passed.
- Latest full run: 197/199 passed. The remaining two failures are in the concurrently changing M6/M7 inference suite: one five-second timeout and one empty placement result for its 500k-sample adversarial waveform.
- App workflow tests render the real `App` and exercise its file input, chart buttons, keyboard shortcuts, and timing modal. They mock only audio/browser rendering and inference services (`AudioEngine`, `WaveformRenderer`, `stepperApi`, and WASM initialization).

## Remaining limitations

- There is no dedicated visible “New project from audio” action. The untouched startup demo is the current blank-state signal.
- Global timing history uses safe invalidation rather than a document-wide chronological transaction log, so a global timing edit intentionally clears older chart undo history.
- Proposal identity is held in memory for the current session; it is not persisted.
- The transport Open button is visible at narrow widths and has a stable test id/title.
