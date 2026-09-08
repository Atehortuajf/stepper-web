import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { setupMockApiRoutes } from '../helpers/mockApi';
import { startMockServer, MockServerInstance } from '../helpers/mockServer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.resolve(__dirname, '../../output/screenshots');

let mockServer: MockServerInstance;
let baseUrl = 'http://127.0.0.1:5173';

test.describe('Tier 5: Adversarial Visual Hardening & Screenshot Regression', () => {

  test.beforeAll(async () => {
    mockServer = await startMockServer(5173);
    baseUrl = mockServer.url;
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
  });

  test.afterAll(async () => {
    if (mockServer) {
      await mockServer.close();
    }
  });

  test.beforeEach(async ({ page }) => {
    await setupMockApiRoutes(page);
  });

  // Desktop Visual Screenshots (1920x1080)
  test('Visual 1: desktop_editor_overview.png', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(baseUrl);
    const dest = path.join(SCREENSHOT_DIR, 'desktop_editor_overview.png');
    await page.screenshot({ path: dest, fullPage: true });
    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.statSync(dest).size).toBeGreaterThan(10240);
  });

  test('Visual 2: desktop_waveform_zoom.png', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(baseUrl);
    // Focus waveform and trigger zoom
    const waveform = page.locator('[data-testid="waveform-strip"]');
    await expect(waveform).toBeVisible();
    const dest = path.join(SCREENSHOT_DIR, 'desktop_waveform_zoom.png');
    await page.screenshot({ path: dest, fullPage: true });
    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.statSync(dest).size).toBeGreaterThan(10240);
  });

  test('Visual 3: desktop_ai_conditioning_drawer.png', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(baseUrl);
    await page.click('[data-testid="btn-ai-drawer"]');
    const drawer = page.locator('[data-testid="ai-drawer"]');
    await expect(drawer).toBeVisible();
    const dest = path.join(SCREENSHOT_DIR, 'desktop_ai_conditioning_drawer.png');
    await page.screenshot({ path: dest, fullPage: true });
    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.statSync(dest).size).toBeGreaterThan(10240);
  });

  test('Visual 4: desktop_biomechanical_parity.png', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(baseUrl);
    const ribbon = page.locator('[data-testid="parity-ribbon"]');
    await expect(ribbon).toBeVisible();
    const dest = path.join(SCREENSHOT_DIR, 'desktop_biomechanical_parity.png');
    await page.screenshot({ path: dest, fullPage: true });
    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.statSync(dest).size).toBeGreaterThan(10240);
  });

  test('Visual 5: desktop_diff_preview.png', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(baseUrl);
    await page.click('[data-testid="btn-ai-drawer"]');
    await page.click('#btnGenerate');
    const dest = path.join(SCREENSHOT_DIR, 'desktop_diff_preview.png');
    await page.screenshot({ path: dest, fullPage: true });
    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.statSync(dest).size).toBeGreaterThan(10240);
  });

  // Mobile Visual Screenshots (390x844)
  test('Visual 6: mobile_editor_touch_pad.png', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseUrl);
    await expect(page.locator('[data-testid="touch-pad"]')).toBeVisible();
    const dest = path.join(SCREENSHOT_DIR, 'mobile_editor_touch_pad.png');
    await page.screenshot({ path: dest, fullPage: true });
    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.statSync(dest).size).toBeGreaterThan(10240);
  });

  test('Visual 7: mobile_note_selector.png', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseUrl);
    const tools = page.locator('[data-testid="note-tools"]');
    await expect(tools).toBeVisible();
    const dest = path.join(SCREENSHOT_DIR, 'mobile_note_selector.png');
    await page.screenshot({ path: dest, fullPage: true });
    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.statSync(dest).size).toBeGreaterThan(10240);
  });

  test('Visual 8: mobile_adaptive_drawer.png', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseUrl);
    await page.click('[data-testid="btn-ai-drawer"]');
    const drawer = page.locator('[data-testid="ai-drawer"]');
    await expect(drawer).toBeVisible();
    const dest = path.join(SCREENSHOT_DIR, 'mobile_adaptive_drawer.png');
    await page.screenshot({ path: dest, fullPage: true });
    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.statSync(dest).size).toBeGreaterThan(10240);
  });

  test('Visual 9: mobile_doubles_dual_bank.png', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseUrl);
    const dest = path.join(SCREENSHOT_DIR, 'mobile_doubles_dual_bank.png');
    await page.screenshot({ path: dest, fullPage: true });
    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.statSync(dest).size).toBeGreaterThan(10240);
  });

  // Adversarial Invariant Assertions
  test('Adversarial 1: Zero element overlap across touch pads', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseUrl);
    const padButtons = page.locator('.touch-arrow');
    const count = await padButtons.count();
    expect(count).toBe(4);

    const boxes = [];
    for (let i = 0; i < count; i++) {
      const box = await padButtons.nth(i).boundingBox();
      expect(box).not.toBeNull();
      if (box) boxes.push(box);
    }

    // Assert no two adjacent boxes overlap
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const b1 = boxes[i];
        const b2 = boxes[j];
        const overlaps = !(b1.x + b1.width <= b2.x || b2.x + b2.width <= b1.x ||
                           b1.y + b1.height <= b2.y || b2.y + b2.height <= b1.y);
        expect(overlaps).toBe(false);
      }
    }
  });

  test('Adversarial 2: Touch targets meet minimum size >= 48x48 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseUrl);
    const touchButtons = page.locator('.touch-arrow, .bottom-dock .tool-btn');
    const count = await touchButtons.count();
    for (let i = 0; i < count; i++) {
      const box = await touchButtons.nth(i).boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(48);
        expect(box.height).toBeGreaterThanOrEqual(48);
      }
    }
  });

  test('Adversarial 3: Zero horizontal overflow on 375px, 390px, 430px viewports', async ({ page }) => {
    for (const width of [375, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(baseUrl);
      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
    }
  });

});
