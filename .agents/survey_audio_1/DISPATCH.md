# Dispatch Assignment: Survey Audio Playback & Synchronization Engine

- **Role**: Survey Explorer (Audio & Playback Synchronization)
- **Assigned by**: Project Orchestrator
- **Working Directory**: `/Users/ate/Projects/stepper-web/.agents/survey_audio_1`
- **Authoritative Request**: `/Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md` (read this first!)
- **Project Root**: `/Users/ate/Projects/stepper-web`

## Objectives:
1. Read `/Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md` (specifically R1 and follow-up from 2026-09-11T05:34:00Z).
2. Investigate the current audio loading, decoding, playback, and canvas synchronization in `stepper-web`:
   - `frontend/src/editor/audio/AudioEngine.ts`
   - `frontend/src/editor/engine/timingEngine.ts`
   - `frontend/src/editor/ui/StepchartCanvas.tsx`
   - `frontend/src/App.tsx` and related state hooks
3. Diagnose the exact root causes of:
   - Audio playback freezing or thread-locking during playback
   - Frame stutter, lag, or canvas rendering bottlenecks during 192-tick scrolling
   - Playhead synchronization drift vs. Web Audio clock (`AudioContext.currentTime`)
4. Recommend concrete, precise architectural and implementation fixes to ensure smooth, continuous playback locked strictly to Web Audio time.
5. Write your complete survey findings to `/Users/ate/Projects/stepper-web/.agents/survey_audio_1/handoff.md` and report back.
