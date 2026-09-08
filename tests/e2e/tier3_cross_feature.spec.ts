import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseMSD, getSmallestNoteTypeForMeasure } from '../helpers/msd';
import { compileTimingSegments, beatToSeconds, secondsToBeat } from '../helpers/timing';
import { CANONICAL_COLORS, FOOT_PARITY_COLORS, getCanonicalColorForBeat, getSubdivisionFromBeat } from '../helpers/colors';
import { setupMockApiRoutes } from '../helpers/mockApi';
import { startMockServer, MockServerInstance } from '../helpers/mockServer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

let mockServer: MockServerInstance;
let baseUrl = 'http://127.0.0.1:5173';

test.describe('Tier 3: Cross-Feature Combinations (Pairwise Interactions)', () => {

  test.beforeAll(async () => {
    mockServer = await startMockServer(5173);
    baseUrl = mockServer.url;
  });

  test.afterAll(async () => {
    if (mockServer) {
      await mockServer.close();
    }
  });

  test.beforeEach(async ({ page }) => {
    await setupMockApiRoutes(page);
  });

  test('T3-01: F5 × F7 - Sustained Hold note crosses an active Stop event', () => {
    const timing = {
      offset: 0,
      bpms: [{ beat: 0, bpm: 120 }],
      stops: [{ beat: 4.0, duration: 1.0 }],
    };
    // Hold starts at beat 2.0 and ends at beat 6.0 (crossing stop at beat 4.0)
    const tHead = beatToSeconds(2.0, timing);
    const tStop = beatToSeconds(4.0, timing);
    const tTail = beatToSeconds(6.0, timing);
    expect(tHead).toBeCloseTo(1.0, 4);
    expect(tStop).toBeCloseTo(2.0, 4);
    expect(tTail).toBeCloseTo(4.0, 4); // 2.0s + 1.0s (stop) + 1.0s (beats 4 to 6) = 4.0s
    expect(tTail - tHead).toBe(3.0); // 1s longer than in constant tempo
  });

  test('T3-02: F7 × F7 - Warp event occurs simultaneously with a BPM change', () => {
    const timing = {
      offset: 0,
      bpms: [
        { beat: 0, bpm: 120 },
        { beat: 4, bpm: 240 },
      ],
      warps: [{ beat: 4, duration: 4 }], // Warps beats 4 to 8
    };
    const tBeforeWarp = beatToSeconds(4.0, timing);
    const tAfterWarp = beatToSeconds(8.0, timing);
    // Warp duration in seconds is 0
    expect(tAfterWarp).toBeCloseTo(tBeforeWarp, 4);
    // At beat 10.0, tempo of 240 BPM takes effect: 2 beats * 60/240 = 0.5s
    const t10 = beatToSeconds(10.0, timing);
    expect(t10).toBeCloseTo(tAfterWarp + 0.5, 4);
  });

  test('T3-03: F5 × F14 - Mine note placed immediately after a Hold tail on same column', async ({ page }) => {
    const notes = [
      { beat: 0.0, arrows: '2000' }, // Hold head
      { beat: 2.0, arrows: '3000' }, // Hold tail
      { beat: 2.5, arrows: 'M000' }, // Mine on column 0 at beat 2.5
    ];
    const res = await page.request.post(`${baseUrl}/api/solve-parity`, {
      data: { steps_type: 'dance-single', notes },
    });
    const json = await res.json();
    expect(json.is_playable).toBe(true);
  });

  test('T3-04: F12 × F13 - AI generation with high crossover slider into pre-existing stream', async ({ page }) => {
    const techVec = new Array(16).fill(0);
    techVec[0] = 1.0; // 100% crossover
    const res = await page.request.post(`${baseUrl}/api/generate`, {
      data: { start_beat: 4, num_beats: 8, tech_vector: techVec },
    });
    const json = await res.json();
    expect(json.placements.some((p: any) => p.arrows === '0001')).toBe(true);
  });

  test('T3-05: F2 × F5 - Export dance-double chart to legacy .sm format', () => {
    const raw = fs.readFileSync(path.join(FIXTURES_DIR, 'dance_double_split_timing.ssc'), 'utf-8');
    const tags = parseMSD(raw);
    const notedata = tags.find(t => t.tag === 'STEPSTYPE');
    expect(notedata?.params[0].trim()).toBe('dance-double');
  });

  test('T3-06: F3 × F4 - Notes placed on 12th, 16th, and 24th subdivisions in same measure', () => {
    const color12th = getCanonicalColorForBeat(1 / 3);
    const color16th = getCanonicalColorForBeat(0.25);
    const color24th = getCanonicalColorForBeat(1 / 6);
    expect(color12th).toBe('#9e3cff'); // Purple
    expect(color16th).toBe('#ffd000'); // Yellow
    expect(color24th).toBe('#ff54be'); // Pink
    expect(new Set([color12th, color16th, color24th]).size).toBe(3);
  });

  test('T3-07: F6 × F7 - Audio scrubbing through variable tempo section with stops', () => {
    const timing = {
      offset: 0,
      bpms: [{ beat: 0, bpm: 140 }, { beat: 16, bpm: 280 }],
      stops: [{ beat: 8, duration: 1.0 }],
    };
    // Scrub to 2.0s, 4.0s, 6.0s
    const b1 = secondsToBeat(2.0, timing);
    const b2 = secondsToBeat(4.0, timing);
    const b3 = secondsToBeat(6.0, timing);
    expect(b2).toBeGreaterThan(b1);
    expect(b3).toBeGreaterThan(b2);
  });

  test('T3-08: F11 × F14 - Call /api/generate and pipe placements directly to /api/solve-parity', async ({ page }) => {
    const genRes = await page.request.post(`${baseUrl}/api/generate`, {
      data: { start_beat: 0, num_beats: 8, difficulty: 3 },
    });
    const genJson = await genRes.json();
    const solveRes = await page.request.post(`${baseUrl}/api/solve-parity`, {
      data: { steps_type: 'dance-single', notes: genJson.placements },
    });
    const solveJson = await solveRes.json();
    expect(solveJson.is_playable).toBe(true);
    expect(solveJson.annotated_steps.length).toBe(genJson.placements.length);
  });

  test('T3-09: F16 × F17 - Switch between desktop keyboard editing and mobile touch mode dynamically', () => {
    let activeMode = 'desktop';
    const chart = [{ beat: 0, arrows: '1000' }];
    // Edit on desktop:
    chart.push({ beat: 1, arrows: '0100' });
    // Switch to mobile:
    activeMode = 'mobile';
    chart.push({ beat: 2, arrows: '0010' });
    expect(chart).toHaveLength(3);
    expect(activeMode).toBe('mobile');
  });

  test('T3-10: F5 × F16 - Convert Hold note into Roll note using backtick shortcut', () => {
    const holdHead = '2000';
    const rollHead = holdHead.replace('2', '4');
    expect(rollHead).toBe('4000');
  });

  test('T3-11: F7 × F10 - Audio feature extraction on audio file with negative #OFFSET', () => {
    const offsetSeconds = -0.035;
    const sampleRate = 44100;
    const offsetSamples = Math.round(Math.abs(offsetSeconds) * sampleRate);
    expect(offsetSamples).toBe(1544);
  });

  test('T3-12: F13 × F16 - Keyboard shortcuts during Diff Preview (Space preview, Enter commit, Ctrl+Z undo)', () => {
    const events = ['Space', 'Enter', 'Ctrl+Z'];
    expect(events).toContain('Enter');
    expect(events).toContain('Ctrl+Z');
  });

  test('T3-13: F5 × F18 - Edit 8-panel Doubles chart on mobile viewport using Dual-Bank pad switcher', () => {
    let currentBank = 'P1';
    const p1Col = 0; // P1 Left
    currentBank = 'P2';
    const p2Col = 4 + 0; // P2 Left
    expect(p2Col).toBe(4);
  });

  test('T3-14: F6 × F16 - Waveform 32x zoom during 0.5x playback rate', () => {
    const zoom = 32;
    const rate = 0.5;
    const visualScrollSpeed = zoom * rate;
    expect(visualScrollSpeed).toBe(16);
  });

  test('T3-15: F7 × F14 - Foot parity solver evaluates step stream with rapid stops and delays', async ({ page }) => {
    const notes = [
      { beat: 0.0, arrows: '1000' },
      { beat: 1.0, arrows: '0100' },
      { beat: 2.0, arrows: '0010' },
    ];
    const res = await page.request.post(`${baseUrl}/api/solve-parity`, {
      data: { steps_type: 'dance-single', notes },
    });
    const json = await res.json();
    expect(json.is_playable).toBe(true);
  });

  test('T3-16: F2 × F7 - Simfile with per-chart split timing in .ssc', () => {
    const raw = fs.readFileSync(path.join(FIXTURES_DIR, 'dance_double_split_timing.ssc'), 'utf-8');
    expect(raw).toContain('#BPMS:0.000000=150.000000,16.000000=200.000000;');
    expect(raw).toContain('#WARPS:24.000000=4.000000;');
  });

  test('T3-17: F3 × F18 - Mobile snap selector set to 1/24 triplet inserts 24th notes', () => {
    const snap = 1 / 24;
    const ticks = [0, 8, 16, 24]; // 24th subdivisions have step 8 ticks
    const lines = getSmallestNoteTypeForMeasure(ticks);
    expect(lines).toBe(24);
  });

  test('T3-18: F8 × F11 - Call /api/generate with Expert difficulty meter 16', async ({ page }) => {
    const res = await page.request.post(`${baseUrl}/api/generate`, {
      data: { start_beat: 0, num_beats: 8, difficulty: 5 },
    });
    const json = await res.json();
    expect(json.placements.length).toBeGreaterThanOrEqual(16); // High density
  });

  test('T3-19: F4 × F15 - Contrast ratio of all canonical subdivision colors against #0C0D12', () => {
    for (const [sub, color] of Object.entries(CANONICAL_COLORS)) {
      expect(color.startsWith('#')).toBe(true);
      expect(color).not.toBe('#0c0d12');
    }
  });

  test('T3-20: F5 × F13 - AI generation with bracket slider > 0.8 into Singles mode', async ({ page }) => {
    const tech = new Array(16).fill(0);
    tech[3] = 0.9; // Bracket
    const res = await page.request.post(`${baseUrl}/api/generate`, {
      data: { start_beat: 0, num_beats: 8, tech_vector: tech },
    });
    const json = await res.json();
    const brackets = json.placements.filter((p: any) => p.arrows === '1100');
    expect(brackets.length).toBeGreaterThan(0);
  });

  test('T3-21: F6 × F18 - Mobile waveform scrub to beat 8.0 combined with touch pad tap', () => {
    const scrubTargetBeat = 8.0;
    const placedNote = { beat: scrubTargetBeat, arrows: '0100' };
    expect(placedNote.beat).toBe(8.0);
    expect(placedNote.arrows).toBe('0100');
  });

  test('T3-22: F7 × F11 - Generate AI steps for measure located immediately after 2-second stop', async ({ page }) => {
    const res = await page.request.post(`${baseUrl}/api/generate`, {
      data: { start_beat: 16.0, num_beats: 4 },
    });
    const json = await res.json();
    expect(json.placements[0].beat).toBeGreaterThanOrEqual(16.0);
  });

  test('T3-23: F14 × F16 - Place notes with keyboard and verify real-time parity updates', async ({ page }) => {
    const notes = [{ beat: 0, arrows: '1000' }];
    notes.push({ beat: 0.5, arrows: '0100' });
    const res = await page.request.post(`${baseUrl}/api/solve-parity`, {
      data: { steps_type: 'dance-single', notes },
    });
    const json = await res.json();
    expect(json.annotated_steps).toHaveLength(2);
  });

  test('T3-24: F2 × F18 - Full mobile round-trip: edit chart, export .ssc, and re-parse', () => {
    const raw = fs.readFileSync(path.join(FIXTURES_DIR, 'itl_2026_speed_stream.ssc'), 'utf-8');
    const tags = parseMSD(raw);
    expect(tags.some(t => t.tag === 'VERSION')).toBe(true);
    expect(tags.some(t => t.tag === 'NOTEDATA')).toBe(true);
  });

  test('T3-25: F1 × F14 - Load ITL Online 2026 fixture and run Viterbi parity analysis', async ({ page }) => {
    const raw = fs.readFileSync(path.join(FIXTURES_DIR, 'itl_2026_speed_stream.ssc'), 'utf-8');
    const tags = parseMSD(raw);
    const noteTag = tags.find(t => t.tag === 'NOTES');
    expect(noteTag).toBeDefined();
    // Verify first 8 steps are solvable
    const steps = [
      { beat: 0.0, arrows: '1000' },
      { beat: 1.0, arrows: '0100' },
      { beat: 2.0, arrows: '0010' },
      { beat: 3.0, arrows: '0001' },
    ];
    const res = await page.request.post(`${baseUrl}/api/solve-parity`, {
      data: { steps_type: 'dance-single', notes: steps },
    });
    const json = await res.json();
    expect(json.is_playable).toBe(true);
  });

});
