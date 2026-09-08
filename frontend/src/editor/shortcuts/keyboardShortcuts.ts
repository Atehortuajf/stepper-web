/**
 * frontend/src/editor/shortcuts/keyboardShortcuts.ts
 * Comprehensive ArrowVortex keyboard shortcuts engine for desktop editing.
 * Supports singles (1-4) & doubles (1-8), modifiers (Shift=Mine, Alt=Lift, Ctrl=Fake),
 * arrow navigation, subdivision cycling, measure jumping, playback, and 50-deep undo/redo.
 */

import { ALL_SUBDIVISIONS, TICKS_PER_BEAT } from '../engine/subdivisions';
import type { SubdivisionTier } from '../engine/types';

export type NoteTypeChar = '0' | '1' | '2' | '3' | '4' | 'M' | 'L' | 'F';

export interface ShortcutAction {
  type:
    | 'PLACE_NOTE'
    | 'CONVERT_HOLD_ROLL'
    | 'STEP_FORWARD'
    | 'STEP_BACKWARD'
    | 'CYCLE_SNAP_FINER'
    | 'CYCLE_SNAP_COARSER'
    | 'JUMP_MEASURE_FORWARD'
    | 'JUMP_MEASURE_BACKWARD'
    | 'JUMP_START'
    | 'JUMP_END'
    | 'TOGGLE_PLAY'
    | 'DELETE_NOTES'
    | 'OPEN_TIMING'
    | 'EXPORT_SSC'
    | 'UNDO'
    | 'REDO'
    | 'COPY'
    | 'PASTE';
  column?: number;
  noteChar?: NoteTypeChar;
}

/**
 * Checks if the currently focused DOM element is an interactive text input
 * where global shortcuts must be suppressed.
 */
export function isInputFocused(target?: EventTarget | null): boolean {
  const el = target || (typeof document !== 'undefined' ? document.activeElement : null);
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    el.isContentEditable
  );
}

/**
 * Returns the snap interval in fractional musical beats for a given subdivision tier.
 */
export function getSnapIntervalBeats(tier: SubdivisionTier): number {
  return 4.0 / tier;
}

/**
 * Quantizes a beat value to the nearest subdivision tick.
 */
export function quantizeBeat(beat: number, tier: SubdivisionTier): number {
  const strideTicks = 192 / tier;
  const totalTicks = Math.round(beat * TICKS_PER_BEAT);
  const snappedTicks = Math.round(totalTicks / strideTicks) * strideTicks;
  return Math.max(0, snappedTicks / TICKS_PER_BEAT);
}

/**
 * Cycles through subdivision tiers (4th -> 192nd).
 * Left arrow / finer: 4th -> 8th -> 12th -> 16th -> 24th -> 32nd -> 48th -> 64th -> 96th -> 192nd.
 * Right arrow / coarser: 192nd -> 96th -> 64th -> 48th -> 32nd -> 24th -> 16th -> 12th -> 8th -> 4th.
 */
export function cycleSubdivision(
  current: SubdivisionTier,
  direction: 'finer' | 'coarser'
): SubdivisionTier {
  const idx = ALL_SUBDIVISIONS.indexOf(current);
  if (idx === -1) return 16;

  if (direction === 'finer') {
    return idx < ALL_SUBDIVISIONS.length - 1 ? ALL_SUBDIVISIONS[idx + 1] : ALL_SUBDIVISIONS[0];
  } else {
    return idx > 0 ? ALL_SUBDIVISIONS[idx - 1] : ALL_SUBDIVISIONS[ALL_SUBDIVISIONS.length - 1];
  }
}

/**
 * Maps Digit and Numpad keys to column indexes (0..7).
 */
const KEY_COLUMN_MAP: Record<string, number> = {
  Digit1: 0,
  Numpad1: 0,
  Digit2: 1,
  Numpad2: 1,
  Digit3: 2,
  Numpad3: 2,
  Digit4: 3,
  Numpad4: 3,
  Digit5: 4,
  Numpad5: 4,
  Digit6: 5,
  Numpad6: 5,
  Digit7: 6,
  Numpad7: 6,
  Digit8: 7,
  Numpad8: 7,
};

/**
 * Parses a native KeyboardEvent into a high-level ShortcutAction.
 */
export function parseKeyboardShortcut(
  e: KeyboardEvent,
  options: { isDoubles?: boolean } = {}
): ShortcutAction | null {
  if (isInputFocused(e.target)) {
    return null;
  }

  const isCmdOrCtrl = e.metaKey || e.ctrlKey;
  const isShift = e.shiftKey;
  const isAlt = e.altKey;
  const code = e.code;
  const key = e.key;

  // 1. Undo / Redo
  if (isCmdOrCtrl && (key === 'z' || key === 'Z')) {
    return isShift ? { type: 'REDO' } : { type: 'UNDO' };
  }
  if (isCmdOrCtrl && (key === 'y' || key === 'Y')) {
    return { type: 'REDO' };
  }

  // 2. Export (Ctrl/Cmd + S)
  if (isCmdOrCtrl && (key === 's' || key === 'S')) {
    return { type: 'EXPORT_SSC' };
  }

  // 3. Timing Dialog (Shift + T)
  if (isShift && !isCmdOrCtrl && !isAlt && (key === 'T' || key === 't')) {
    return { type: 'OPEN_TIMING' };
  }

  // 4. Clipboard Copy / Paste
  if (isCmdOrCtrl && (key === 'c' || key === 'C')) {
    return { type: 'COPY' };
  }
  if (isCmdOrCtrl && (key === 'v' || key === 'V')) {
    return { type: 'PASTE' };
  }

  // 5. Playback toggle (Space)
  if (code === 'Space' || key === ' ') {
    return { type: 'TOGGLE_PLAY' };
  }

  // 6. Delete notes at cursor
  if (key === 'Delete' || key === 'Backspace') {
    return { type: 'DELETE_NOTES' };
  }

  // 7. Navigation
  if (code === 'ArrowUp' || key === 'ArrowUp') {
    return { type: 'STEP_FORWARD' };
  }
  if (code === 'ArrowDown' || key === 'ArrowDown') {
    return { type: 'STEP_BACKWARD' };
  }
  if (code === 'ArrowLeft' || key === 'ArrowLeft') {
    return { type: 'CYCLE_SNAP_FINER' };
  }
  if (code === 'ArrowRight' || key === 'ArrowRight') {
    return { type: 'CYCLE_SNAP_COARSER' };
  }
  if (code === 'PageUp' || key === 'PageUp') {
    return { type: 'JUMP_MEASURE_FORWARD' };
  }
  if (code === 'PageDown' || key === 'PageDown') {
    return { type: 'JUMP_MEASURE_BACKWARD' };
  }
  if (code === 'Home' || key === 'Home') {
    return { type: 'JUMP_START' };
  }
  if (code === 'End' || key === 'End') {
    return { type: 'JUMP_END' };
  }

  // 8. Convert Hold <-> Roll shortcut (Backquote / `)
  if (code === 'Backquote' || key === '`' || key === '~') {
    return { type: 'CONVERT_HOLD_ROLL' };
  }

  // 9. Note Placement keys (1..4 singles, 1..8 doubles)
  if (code in KEY_COLUMN_MAP) {
    const col = KEY_COLUMN_MAP[code];
    const maxCol = options.isDoubles ? 8 : 4;
    if (col < maxCol) {
      let noteChar: NoteTypeChar = '1';
      if (isShift) {
        noteChar = 'M'; // Mine
      } else if (isAlt) {
        noteChar = 'L'; // Lift
      } else if (isCmdOrCtrl) {
        noteChar = 'F'; // Fake
      }
      return {
        type: 'PLACE_NOTE',
        column: col,
        noteChar,
      };
    }
  }

  return null;
}

/**
 * 50-action Undo / Redo history stack.
 */
export class UndoRedoStack<T> {
  private undoStack: T[] = [];
  private redoStack: T[] = [];
  public readonly maxDepth: number;

  constructor(maxDepth = 50) {
    this.maxDepth = maxDepth;
  }

  public push(state: T): void {
    this.undoStack.push(state);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  public undo(currentState: T): T | null {
    if (this.undoStack.length === 0) return null;
    const previous = this.undoStack.pop()!;
    this.redoStack.push(currentState);
    if (this.redoStack.length > this.maxDepth) {
      this.redoStack.shift();
    }
    return previous;
  }

  public redo(currentState: T): T | null {
    if (this.redoStack.length === 0) return null;
    const next = this.redoStack.pop()!;
    this.undoStack.push(currentState);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    return next;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  public get depth(): number {
    return this.undoStack.length;
  }
}
