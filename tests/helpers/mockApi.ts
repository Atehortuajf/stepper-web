import { Page, Route } from '@playwright/test';

export async function setupMockApiRoutes(page: Page) {
  await page.route('**/api/health', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'healthy',
        device: 'mps',
        model_loaded: true,
        fallback_mode: false,
        version: '1.0.0',
      }),
    });
  });

  await page.route('**/api/generate', async (route: Route) => {
    const request = route.request();
    let body: any = {};
    try {
      body = JSON.parse(request.postData() || '{}');
    } catch {
      body = {};
    }

    const startBeat = Number(body.start_beat || 0);
    const numBeats = Number(body.num_beats || 16);
    const techVector: number[] = Array.isArray(body.tech_vector) ? body.tech_vector : new Array(16).fill(0);
    const footswitchRatio = techVector[1] || 0;
    const crossoverRatio = techVector[0] || 0;
    const bracketRatio = techVector[3] || 0;

    const placements: Array<{
      beat: number;
      arrows: string;
      chord_idx: number;
      confidence: number;
    }> = [];

    // Synthesize 16th stream or 8th stream based on difficulty
    const stepInterval = (body.difficulty || 3) > 2 ? 0.25 : 0.5;
    const patterns = ['1000', '0100', '0010', '0001'];
    let patIdx = 0;

    for (let b = startBeat; b < startBeat + numBeats; b += stepInterval) {
      let arrows = patterns[patIdx % 4];

      if (bracketRatio > 0.6 && patIdx % 4 === 0) {
        arrows = '1100'; // Bracket chord
      } else if (footswitchRatio > 0.7) {
        arrows = '0010'; // Repeat Up arrow
      } else if (crossoverRatio > 0.5 && patIdx % 4 === 2) {
        arrows = '0001'; // Crossover Right
      }

      placements.push({
        beat: Number(b.toFixed(3)),
        arrows,
        chord_idx: patIdx % 96,
        confidence: 0.92 + (patIdx % 5) * 0.01,
      });
      patIdx++;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        placements,
        latency_ms: 115.4,
      }),
    });
  });

  await page.route('**/api/solve-parity', async (route: Route) => {
    const request = route.request();
    let body: any = {};
    try {
      body = JSON.parse(request.postData() || '{}');
    } catch {
      body = {};
    }

    const notes = Array.isArray(body.notes) ? body.notes : [];
    let isPlayable = true;
    let totalCost = 0.0;
    const footSequence: string[] = [];
    const annotatedSteps: any[] = [];

    let currentFoot = 'L';
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const arrows = String(note.arrows || '1000');

      // Check for physical impossibilities (e.g. quad '1111')
      const activeCount = (arrows.match(/1/g) || []).length;
      let warning: string | null = null;
      let stepCost = 0.1;

      if (activeCount >= 4) {
        isPlayable = false;
        warning = 'Physical impossibility: 4 panels simultaneous';
        stepCost = 100.0;
      } else if (activeCount === 3) {
        warning = 'High strain: hands or 3-panel step';
        stepCost = 5.0;
      }

      currentFoot = currentFoot === 'L' ? 'R' : 'L';
      footSequence.push(currentFoot);
      totalCost += stepCost;

      annotatedSteps.push({
        beat: note.beat,
        arrows: note.arrows,
        foot: activeCount === 2 ? 'LR' : currentFoot,
        cost: stepCost,
        warning,
      });
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        is_playable: isPlayable,
        total_cost: Number(totalCost.toFixed(3)),
        foot_sequence: footSequence,
        annotated_steps: annotatedSteps,
      }),
    });
  });
}
