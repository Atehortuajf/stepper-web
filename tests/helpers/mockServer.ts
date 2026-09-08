import http from 'http';

export interface MockServerInstance {
  server: http.Server;
  port: number;
  url: string;
  close: () => Promise<void>;
}

export function startMockServer(preferredPort = 5173): Promise<MockServerInstance> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = urlObj.pathname;

      if (pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'healthy',
          device: 'mps',
          model_loaded: true,
          fallback_mode: false,
          version: '1.0.0',
        }));
        return;
      }

      if (pathname === '/api/generate' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          let data: any = {};
          try { data = JSON.parse(body); } catch {}
          const startBeat = Number(data.start_beat || 0);
          const numBeats = Number(data.num_beats || 16);
          const techVector = Array.isArray(data.tech_vector) ? data.tech_vector : new Array(16).fill(0);
          const bracketRatio = techVector[3] || 0;
          const footswitchRatio = techVector[1] || 0;
          const crossoverRatio = techVector[0] || 0;
          const difficulty = Number(data.difficulty !== undefined ? data.difficulty : 3);

          const stepInterval = difficulty > 2 ? 0.25 : 0.5;
          const patterns = ['1000', '0100', '0010', '0001'];
          const placements = [];
          let patIdx = 0;

          for (let b = startBeat; b < startBeat + numBeats; b += stepInterval) {
            let arrows = patterns[patIdx % 4];
            if (bracketRatio > 0.6 && patIdx % 4 === 0) {
              arrows = '1100';
            } else if (footswitchRatio > 0.7) {
              arrows = '0010';
            } else if (crossoverRatio > 0.5 && patIdx % 4 === 2) {
              arrows = '0001';
            }
            placements.push({
              beat: Number(b.toFixed(3)),
              arrows,
              chord_idx: patIdx % 96,
              confidence: 0.95,
            });
            patIdx++;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ placements, latency_ms: 110.5 }));
        });
        return;
      }

      if (pathname === '/api/solve-parity' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          let data: any = {};
          try { data = JSON.parse(body); } catch {}
          const notes = Array.isArray(data.notes) ? data.notes : [];
          let isPlayable = true;
          let totalCost = 0.0;
          const footSeq: string[] = [];
          const annotated: any[] = [];
          let curFoot = 'L';

          for (const n of notes) {
            const arrows = String(n.arrows || '1000');
            const count = (arrows.match(/1/g) || []).length;
            let warning = null;
            let cost = 0.1;
            if (count >= 4) {
              isPlayable = false;
              warning = 'Physical impossibility: 4 panels simultaneous';
              cost = 100.0;
            } else if (count === 3) {
              warning = 'High strain: 3 panels simultaneous';
              cost = 5.0;
            }
            curFoot = curFoot === 'L' ? 'R' : 'L';
            footSeq.push(curFoot);
            totalCost += cost;
            annotated.push({
              beat: n.beat,
              arrows: n.arrows,
              foot: count === 2 ? 'LR' : curFoot,
              cost,
              warning,
            });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            is_playable: isPlayable,
            total_cost: Number(totalCost.toFixed(3)),
            foot_sequence: footSeq,
            annotated_steps: annotated,
          }));
        });
        return;
      }

      // Default mock HTML page representing Stepper-Web editor UI
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Stepper-Web Dance Stepchart Editor</title>
  <style>
    html, body { box-sizing: border-box; margin: 0; padding: 0; background: #0C0D12; color: #E0E2EC; font-family: monospace; overflow-x: hidden; width: 100%; max-width: 100vw; height: 100vh; }
    header.hud-bar { height: 44px; background: #161822; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; border-bottom: 1px solid #232738; width: 100%; }
    .waveform-strip { height: 48px; background: #1A1D2B; position: relative; border-bottom: 1px solid #232738; cursor: pointer; width: 100%; }
    .waveform-cursor { position: absolute; top: 0; bottom: 0; width: 2px; background: #FF2A55; left: 25%; }
    .stage-container { position: relative; height: calc(100vh - 44px - 48px - 36px - 120px - 48px); display: flex; justify-content: center; align-items: center; width: 100%; overflow: hidden; }
    canvas.grid-canvas { background: #0C0D12; border: 1px solid #1F2434; max-width: 100%; width: 100%; }
    .receptors { position: absolute; bottom: 40px; display: flex; gap: 8px; justify-content: center; width: 100%; }
    .receptor { width: 48px; height: 48px; border: 2px solid #5A627A; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #8A92A6; }
    .note-tools { height: 36px; background: #161822; display: flex; align-items: center; justify-content: center; gap: 4px; border-top: 1px solid #232738; width: 100%; overflow-x: auto; }
    .tool-btn { padding: 4px 6px; background: #232738; color: #C0C4D6; border: 1px solid #33384D; font-size: 10px; cursor: pointer; min-width: 44px; min-height: 28px; }
    .tool-btn.active { background: #00A2FF; color: #000; font-weight: bold; }
    .touch-pad { height: 120px; background: #12141D; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 6px; width: 100%; }
    .touch-arrow { flex: 1; max-width: 84px; height: 72px; min-width: 48px; min-height: 48px; background: #1F2434; border: 2px solid #363C52; border-radius: 6px; font-size: 26px; color: #FFF; display: flex; align-items: center; justify-content: center; cursor: pointer; }
    .touch-arrow:active { border-color: #00A2FF; background: #283048; }
    .bottom-dock { height: 48px; background: #161822; display: flex; align-items: center; justify-content: space-between; padding: 0 8px; border-top: 1px solid #232738; width: 100%; }
    .drawer-panel { position: fixed; bottom: 0; left: 0; right: 0; background: #161822; border-top: 2px solid #00A2FF; padding: 16px; transform: translateY(100%); transition: transform 0.2s; z-index: 100; max-height: 50vh; overflow-y: auto; }
    .drawer-panel.open { transform: translateY(0); }
    .slider-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .slider-row label { font-size: 12px; min-width: 120px; }
    .slider-row input { flex: 1; accent-color: #00A2FF; min-height: 48px; }
    .parity-ribbon { position: absolute; left: 16px; top: 0; bottom: 0; width: 8px; background: linear-gradient(to bottom, #00B0FF, #FF3366); }
  </style>
</head>
<body>
  <header class="hud-bar" data-testid="hud-bar">
    <span class="hud-title" data-testid="hud-title">ITL 2026 Speed Stream</span>
    <span class="hud-bpm" data-testid="hud-bpm">180.00 BPM</span>
    <span class="hud-time" data-testid="hud-time">00:12.450 / 03:24.000</span>
    <span class="hud-beat" data-testid="hud-beat">Beat: 16.00 (M4)</span>
  </header>
  <div class="waveform-strip" data-testid="waveform-strip">
    <div class="waveform-cursor" data-testid="waveform-cursor"></div>
  </div>
  <main class="stage-container" data-testid="stage-container">
    <div class="parity-ribbon" data-testid="parity-ribbon" title="Biomechanical Foot Parity"></div>
    <canvas id="noteCanvas" class="grid-canvas" width="360" height="420" style="max-width:100%;" data-testid="note-canvas"></canvas>
    <div class="receptors" data-testid="receptors">
      <div class="receptor" data-col="0">&larr;</div>
      <div class="receptor" data-col="1">&darr;</div>
      <div class="receptor" data-col="2">&uarr;</div>
      <div class="receptor" data-col="3">&rarr;</div>
    </div>
  </main>
  <div class="note-tools" data-testid="note-tools">
    <button class="tool-btn active" data-tool="TAP">TAP</button>
    <button class="tool-btn" data-tool="HOLD">HOLD</button>
    <button class="tool-btn" data-tool="ROLL">ROLL</button>
    <button class="tool-btn" data-tool="MINE">MINE</button>
    <button class="tool-btn" data-tool="LIFT">LIFT</button>
    <button class="tool-btn" data-tool="FAKE">FAKE</button>
    <button class="tool-btn" data-tool="DEL">DEL</button>
  </div>
  <div class="touch-pad" data-testid="touch-pad">
    <button class="touch-arrow" data-testid="pad-left" data-key="1">&larr;</button>
    <button class="touch-arrow" data-testid="pad-down" data-key="2">&darr;</button>
    <button class="touch-arrow" data-testid="pad-up" data-key="3">&uarr;</button>
    <button class="touch-arrow" data-testid="pad-right" data-key="4">&rarr;</button>
  </div>
  <footer class="bottom-dock" data-testid="bottom-dock">
    <button class="tool-btn" data-testid="btn-play" style="min-height:48px; min-width:60px;">PLAY</button>
    <button class="tool-btn" data-testid="btn-snap" style="min-height:48px; min-width:60px;">1/16</button>
    <button class="tool-btn" data-testid="btn-ai-drawer" id="toggleAiDrawer" style="min-height:48px; min-width:60px;">AI TOOL</button>
    <button class="tool-btn" data-testid="btn-export" style="min-height:48px; min-width:60px;">EXPORT</button>
  </footer>
  <div id="aiDrawer" class="drawer-panel" data-testid="ai-drawer">
    <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
      <h3>Stepper AI Technique Conditioning</h3>
      <button id="closeAiDrawer" style="min-height:48px; min-width:48px; background:#232738; color:#FFF; border:none; padding:4px 12px; cursor:pointer;">X</button>
    </div>
    <div class="slider-row"><label>Crossover:</label><input type="range" min="0" max="1" step="0.05" value="0.5" id="slider-crossover"></div>
    <div class="slider-row"><label>Footswitch:</label><input type="range" min="0" max="1" step="0.05" value="0.2" id="slider-footswitch"></div>
    <div class="slider-row"><label>Bracket:</label><input type="range" min="0" max="1" step="0.05" value="0.1" id="slider-bracket"></div>
    <div class="slider-row"><label>Stream Stamina:</label><input type="range" min="0" max="1" step="0.05" value="0.8" id="slider-stream_stamina"></div>
    <div style="margin-top:16px; display:flex; gap:12px;">
      <button id="btnGenerate" class="tool-btn" style="flex:1; min-height:48px; background:#00A2FF; color:#000; font-weight:bold;">GENERATE</button>
      <button id="btnCommit" class="tool-btn" style="flex:1; min-height:48px; background:#00E676; color:#000; font-weight:bold;">COMMIT</button>
    </div>
  </div>
  <script>
    const drawer = document.getElementById('aiDrawer');
    document.getElementById('toggleAiDrawer').onclick = () => drawer.classList.toggle('open');
    document.getElementById('closeAiDrawer').onclick = () => drawer.classList.remove('open');
    // Canvas initial note rendering
    const canvas = document.getElementById('noteCanvas');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0C0D12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Draw grid subdivision lines
    for (let y = 20; y < canvas.height; y += 40) {
      ctx.strokeStyle = '#1F2434';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    // Draw receptors
    const colors = ['#FF2A55', '#00A2FF', '#9E3CFF', '#FFD000'];
    const cols = [40, 130, 220, 310];
    cols.forEach((x, i) => {
      ctx.fillStyle = colors[i % 4];
      ctx.beginPath();
      ctx.arc(x, 100, 16, 0, 2 * Math.PI);
      ctx.fill();
    });
  </script>
</body>
</html>`);
    });

    server.listen(preferredPort, '127.0.0.1', () => {
      const addr = server.address() as any;
      const port = addr.port;
      resolve({
        server,
        port,
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>(resClose => server.close(() => resClose())),
      });
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        // Try ephemeral port
        server.listen(0, '127.0.0.1', () => {
          const addr = server.address() as any;
          const port = addr.port;
          resolve({
            server,
            port,
            url: `http://127.0.0.1:${port}`,
            close: () => new Promise<void>(resClose => server.close(() => resClose())),
          });
        });
      } else {
        reject(err);
      }
    });
  });
}
