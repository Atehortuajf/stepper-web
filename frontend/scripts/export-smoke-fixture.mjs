import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve(process.argv[2] || '/tmp/stepper-export-smoke');
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
});
try {
  const { serializeSM, serializeSSC } = await server.ssrLoadModule('/src/editor/engine/smSerializer.ts');
  const timing = {
    offset: -0.125,
    bpms: [{ beat: 0, bpm: 120 }, { beat: 16, bpm: 180 }],
    stops: [{ beat: 8, duration: 0.5 }], delays: [], warps: [],
    timeSignatures: [{ beat: 0, numerator: 4, denominator: 4 }, { beat: 32, numerator: 3, denominator: 4 }],
  };
  const chart = {
    stepsType: 'dance-single', description: 'Escaped: chart; \\ metadata', difficulty: 'Hard', meter: 9,
    notes: [{ lines: ['1000', '0100', '0010', '0001'] }],
    noteRows: [
      { row: 0, beat: 0, arrows: '1000' }, { row: 48, beat: 1, arrows: '0100' },
      { row: 96, beat: 2, arrows: '0010' }, { row: 144, beat: 3, arrows: '0001' },
    ],
    holds: [],
    timing: { ...timing, offset: 0.25, bpms: [{ beat: 0, bpm: 150 }, { beat: 8, bpm: 200 }], presentTags: ['OFFSET', 'BPMS'] },
  };
  const simfile = {
    fileType: 'ssc', version: 0.83, title: 'Escaped: title; \\ test', subtitle: '', artist: 'Artist: A; B',
    titleTranslit: '', subtitleTranslit: '', artistTranslit: '', genre: '', credit: 'Credit; colon:',
    banner: '', background: '', lyricsPath: '', cdTitle: '', music: 'track.ogg', sampleStart: 0,
    sampleLength: 12, selectable: 'YES', metadata: {}, timing, charts: [chart],
  };
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'fixture.sm'), serializeSM(simfile), 'utf8');
  await writeFile(resolve(output, 'fixture.ssc'), serializeSSC(simfile), 'utf8');
  process.stdout.write(`${output}\n`);
} finally {
  await server.close();
}
