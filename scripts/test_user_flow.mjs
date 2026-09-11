import { chromium } from 'playwright';
import * as path from 'path';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE ${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.log(`[BROWSER UNHANDLED ERROR] ${err.message}\n${err.stack}`);
  });

  console.log('--- Navigating to http://localhost:4173/ ---');
  await page.goto('http://localhost:4173/');
  await page.waitForTimeout(1000);

  // Check initial HUD BPM and Title
  const initialBpm = await page.locator('[data-testid="hud-bpm"]').innerText();
  const initialTitle = await page.locator('[data-testid="hud-title"]').innerText();
  console.log(`Initial HUD Title: "${initialTitle}", BPM: "${initialBpm}"`);

  // Check volume slider
  const volumeSlider = page.locator('[data-testid="volume-slider"]');
  console.log('Volume slider visible:', await volumeSlider.isVisible());
  const initialVol = await volumeSlider.inputValue();
  console.log(`Initial Volume: ${initialVol}`);

  // Test 1: Uploading Audio alone
  console.log('\n--- Test 1: Uploading audio alone (sample_click_track.wav) ---');
  const audioFile = path.resolve('tests/fixtures/sample_click_track.wav');
  await page.setInputFiles('#fileInput', audioFile);
  await page.waitForTimeout(1000);

  const afterAudioTitle = await page.locator('[data-testid="hud-title"]').innerText();
  const afterAudioBpm = await page.locator('[data-testid="hud-bpm"]').innerText();
  console.log(`After Audio Upload -> Title: "${afterAudioTitle}", BPM: "${afterAudioBpm}"`);

  // Click Play
  console.log('Clicking Play on uploaded audio...');
  await page.click('[data-testid="btn-play-transport"]');
  await page.waitForTimeout(1000);
  const isPlayingText = await page.locator('[data-testid="btn-play-transport"]').innerText();
  console.log(`Play button state: "${isPlayingText.replace('\n', ' ')}"`);

  // Pause
  await page.click('[data-testid="btn-play-transport"]');
  await page.waitForTimeout(500);

  // Test 2: Uploading BOTH Audio and Simfile together
  console.log('\n--- Test 2: Uploading BOTH audio and .ssc together ---');
  const sscFile = path.resolve('tests/fixtures/basic_dance_single.ssc');
  await page.setInputFiles('#fileInput', [audioFile, sscFile]);
  await page.waitForTimeout(1500);

  const afterBothTitle = await page.locator('[data-testid="hud-title"]').innerText();
  const afterBothBpm = await page.locator('[data-testid="hud-bpm"]').innerText();
  console.log(`After Both Upload -> Title: "${afterBothTitle}", BPM: "${afterBothBpm}"`);

  // Now try to Play!
  console.log('Attempting Playback after uploading both...');
  await page.click('[data-testid="btn-play-transport"]');
  await page.waitForTimeout(1000);
  const playBtnState1 = await page.locator('[data-testid="btn-play-transport"]').innerText();
  console.log(`Play button state after click: "${playBtnState1.replace('\n', ' ')}"`);

  await page.waitForTimeout(1500);
  const playBtnState2 = await page.locator('[data-testid="btn-play-transport"]').innerText();
  console.log(`Play button state after 1.5s: "${playBtnState2.replace('\n', ' ')}"`);

  const hudBeat = await page.locator('[data-testid="hud-beat"]').innerText();
  const hudTime = await page.locator('[data-testid="hud-time"]').innerText();
  console.log(`HUD Beat: ${hudBeat}, HUD Time: ${hudTime}`);

  await browser.close();
  console.log('\n=== ALL TESTS COMPLETED SUCCESSFULLY! ===');
}

run().catch(console.error);
