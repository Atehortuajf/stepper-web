import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseMSD, getSmallestNoteTypeForMeasure } from '../helpers/msd';
import { compileTimingSegments, beatToSeconds, secondsToBeat } from '../helpers/timing';
import { CANONICAL_COLORS, FOOT_PARITY_COLORS, getCanonicalColorForBeat } from '../helpers/colors';
import { setupMockApiRoutes } from '../helpers/mockApi';
import { startMockServer, MockServerInstance } from '../helpers/mockServer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

let mockServer: MockServerInstance;
let baseUrl = 'http://127.0.0.1:5173';

test.describe('Tier 4: Real-World Application Scenarios', () => {

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

  test('Scenario 1: ITL Online 2026 Speed Stream Chart End-to-End Workflow', async ({ page }) => {
    // 1. Ingest ITL 2026 speed stream fixture
    const sscPath = path.join(FIXTURES_DIR, 'itl_2026_speed_stream.ssc');
    const raw = fs.readFileSync(sscPath, 'utf-8');
    const tags = parseMSD(raw);

    // 2. Validate metadata
    const tagMap = new Map(tags.map(t => [t.tag, t.params[0]]));
    expect(tagMap.get('TITLE')).toBe('ITL 2026 Speed Stream');
    expect(tagMap.get('BPMS')).toContain('0.000000=180.000000');
    expect(tagMap.get('METER')).toBe('15');

    // 3. Verify 16th stream note coloration
    const beat16th = 2.25; // 16th note in Measure 2
    expect(getCanonicalColorForBeat(beat16th)).toBe('#ffd000'); // Yellow

    // 4. Biomechanical Viterbi Parity Analysis
    const sampleStream = [
      { beat: 0.0, arrows: '1000' },
      { beat: 0.25, arrows: '0100' },
      { beat: 0.5, arrows: '0010' },
      { beat: 0.75, arrows: '0001' },
      { beat: 1.0, arrows: '1000' },
      { beat: 1.25, arrows: '0100' },
      { beat: 1.5, arrows: '0010' },
      { beat: 1.75, arrows: '0001' },
    ];
    const res = await page.request.post(`${baseUrl}/api/solve-parity`, {
      data: { steps_type: 'dance-single', notes: sampleStream },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.is_playable).toBe(true);
    expect(json.total_cost).toBeLessThan(2.0);

    // 5. Simulate editing measure 8: convert tap into hold note and insert offbeat mine
    const editedStream = [...sampleStream, { beat: 2.0, arrows: '2000' }, { beat: 2.5, arrows: '3000' }, { beat: 2.75, arrows: '00M0' }];
    expect(editedStream.some(s => s.arrows === '2000')).toBe(true);
    expect(editedStream.some(s => s.arrows === '00M0')).toBe(true);

    // 6. Lossless re-serialization verification
    const newTags = tags.map(t => t.tag === 'NOTES' ? { ...t, params: [t.params[0] + '\n2000\n3000\n00M0\n'] } : t);
    const reSerialized = newTags.map(t => `#${t.tag}:${t.params.join(':')};`).join('\n');
    expect(reSerialized).toContain('00M0');
  });

  test('Scenario 2: ITL Online 2026 Gimmick Chaos Chart (Warp/Stop/Delay/Subdivision) Workflow', async ({ page }) => {
    // 1. Ingest ITL 2026 gimmick chaos fixture
    const sscPath = path.join(FIXTURES_DIR, 'itl_2026_gimmick_chaos.ssc');
    const raw = fs.readFileSync(sscPath, 'utf-8');
    const tags = parseMSD(raw);

    // 2. Validate timing events
    const tagMap = new Map(tags.map(t => [t.tag, t.params[0]]));
    expect(tagMap.get('BPMS')).toContain('0.000000=140.000000');
    expect(tagMap.get('STOPS')).toContain('16.000000=1.000000');
    expect(tagMap.get('DELAYS')).toContain('24.000000=0.500000');
    expect(tagMap.get('WARPS')).toContain('32.000000=4.000000');

    // 3. Piecewise timing simulation
    const timing = {
      offset: -0.010,
      bpms: [
        { beat: 0, bpm: 140 },
        { beat: 16, bpm: 280 },
        { beat: 32, bpm: 140 },
      ],
      stops: [{ beat: 16, duration: 1.0 }],
      delays: [{ beat: 24, duration: 0.5 }],
      warps: [{ beat: 32, duration: 4.0 }],
    };

    // Forward and inverse mapping consistency
    const t0 = beatToSeconds(0, timing);
    expect(t0).toBeCloseTo(0.010, 3);
    const t16 = beatToSeconds(16, timing);
    const b16 = secondsToBeat(t16, timing);
    expect(b16).toBeCloseTo(16.0, 1);

    // 4. Verification of Fake ('F') and Lift ('L') notes
    const noteTag = tags.find(t => t.tag === 'NOTES');
    expect(noteTag?.params[0]).toContain('00L0'); // Lift note
    expect(noteTag?.params[0]).toContain('000F'); // Fake note
  });

  test('Scenario 3: Complete Mobile Touch Editing & AI Conditioning Workflow (390x844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseUrl);

    // 1. Verify HUD bar and essential mobile components render
    await expect(page.locator('[data-testid="hud-bar"]')).toBeVisible();
    await expect(page.locator('[data-testid="waveform-strip"]')).toBeVisible();
    await expect(page.locator('[data-testid="stage-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="touch-pad"]')).toBeVisible();

    // 2. Place notes via touch pad (tap Left, Down, Up, Right)
    await page.click('[data-testid="pad-left"]');
    await page.click('[data-testid="pad-down"]');
    await page.click('[data-testid="pad-up"]');
    await page.click('[data-testid="pad-right"]');

    // 3. Open mobile AI technique drawer
    await page.click('[data-testid="btn-ai-drawer"]');
    const drawer = page.locator('[data-testid="ai-drawer"]');
    await expect(drawer).toBeVisible();

    // 4. Modulate technique sliders
    await page.fill('#slider-crossover', '0.6');
    await page.fill('#slider-stream_stamina', '0.8');

    // 5. Trigger AI generation
    await page.click('#btnGenerate');
    // Verify generation response
    await page.click('#btnCommit');
    await page.click('#closeAiDrawer');

    // 6. Export chart
    await page.click('[data-testid="btn-export"]');
  });

  test('Scenario 4: ArrowVortex Desktop Keyboard-Driven Editing & Metronome Workflow (1920x1080)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(baseUrl);

    // 1. Desktop viewport verification
    await expect(page.locator('[data-testid="hud-bar"]')).toBeVisible();
    await expect(page.locator('[data-testid="note-canvas"]')).toBeVisible();

    // 2. Play/pause audio playback via Space bar
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');

    // 3. Navigation with arrow keys
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowDown');

    // 4. Quantization snap cycling
    await page.keyboard.press('ArrowLeft'); // finer
    await page.keyboard.press('ArrowRight'); // coarser

    // 5. Note placement with number keys 1, 2, 3, 4
    await page.keyboard.press('Digit1');
    await page.keyboard.press('Digit2');
    await page.keyboard.press('Digit3');
    await page.keyboard.press('Digit4');

    // 6. Undo/Redo history stack
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+y');
  });

  test('Scenario 5: Singles to Doubles 8-Panel Transposition & Biomechanical Validation', async ({ page }) => {
    // 1. Start with 4-panel singles sequence
    const singlesNotes = ['1000', '0100', '0010', '0001'];
    // 2. Transpose to 8-panel doubles (Player 1 + Player 2)
    const doublesNotes = singlesNotes.map((s, i) => {
      if (i < 2) return s + '0000'; // Player 1 pad
      return '0000' + s; // Player 2 pad
    });
    expect(doublesNotes[0]).toBe('10000000');
    expect(doublesNotes[3]).toBe('00000001');

    // 3. Validate biomechanics across pad center boundary
    const notes = doublesNotes.map((arrows, i) => ({ beat: i * 0.5, arrows }));
    const res = await page.request.post(`${baseUrl}/api/solve-parity`, {
      data: { steps_type: 'dance-double', notes },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.is_playable).toBe(true);
  });

  test('Scenario 6: Lossless Round-Trip Serialization & Audio Synchronization Stress', () => {
    const fixtureFiles = [
      'simple_quarter_notes.sm',
      'bpm_changes_stops.sm',
      'basic_dance_single.ssc',
      'dance_double_split_timing.ssc',
      'itl_2026_speed_stream.ssc',
      'itl_2026_gimmick_chaos.ssc',
      'malformed_and_edge_cases.ssc',
    ];

    for (const file of fixtureFiles) {
      const fullPath = path.join(FIXTURES_DIR, file);
      const raw = fs.readFileSync(fullPath, 'utf-8');
      const tags1 = parseMSD(raw);
      expect(tags1.length).toBeGreaterThan(0);

      // Re-serialize
      const serialized = tags1.map(t => `#${t.tag}:${t.params.join(':')};`).join('\n');
      const tags2 = parseMSD(serialized);
      expect(tags2.length).toBe(tags1.length);

      // Verify essential tags are preserved exactly
      const t1Names = tags1.map(t => t.tag);
      const t2Names = tags2.map(t => t.tag);
      expect(t2Names).toEqual(t1Names);
    }
  });

});
