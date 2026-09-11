import { describe, it, expect } from 'vitest';
import { parseMSD, parseSimfile, parseNoteData } from '../msdParser';
import { serializeSM, serializeSSC } from '../smSerializer';


describe('MSD Lexer & Grammar', () => {
  it('parses standard parameter blocks', () => {
    const msd = '#TITLE:Song Title;#ARTIST:Song Artist;#BPMS:0.000=140.000;';
    const tags = parseMSD(msd);
    expect(tags.length).toBe(3);
    expect(tags[0].name).toBe('TITLE');
    expect(tags[0].params).toEqual(['Song Title']);
    expect(tags[1].name).toBe('ARTIST');
    expect(tags[1].params).toEqual(['Song Artist']);
    expect(tags[2].name).toBe('BPMS');
    expect(tags[2].params).toEqual(['0.000=140.000']);
  });

  it('strips single-line comments (//)', () => {
    const msd = `
      // This is a song header comment
      #TITLE:My Song; // Trailing comment
      #ARTIST:Artist Name;
      // Another comment line
      #BPMS:0.000=175.000;
    `;
    const tags = parseMSD(msd);
    expect(tags.length).toBe(3);
    expect(tags[0].name).toBe('TITLE');
    expect(tags[0].params[0].trim()).toBe('My Song');
    expect(tags[1].name).toBe('ARTIST');
    expect(tags[1].params[0].trim()).toBe('Artist Name');
  });

  it('handles escape characters (\\:, \\;, \\#, \\\\)', () => {
    const msd = '#TITLE:Escape\\:Colon and \\;Semicolon and \\#Hash and \\\\Backslash;';
    const tags = parseMSD(msd);
    expect(tags.length).toBe(1);
    expect(tags[0].name).toBe('TITLE');
    expect(tags[0].params[0]).toBe('Escape:Colon and ;Semicolon and #Hash and \\Backslash');
  });

  it('recovers from unescaped # starting a new line (implicit tag closure)', () => {
    const msd = `#TITLE:Unclosed Title
#ARTIST:Artist Name;`;
    const tags = parseMSD(msd);
    expect(tags.length).toBe(2);
    expect(tags[0].name).toBe('TITLE');
    expect(tags[0].params[0].trim()).toBe('Unclosed Title');
    expect(tags[1].name).toBe('ARTIST');
    expect(tags[1].params[0].trim()).toBe('Artist Name');
  });
});

describe('Note Data Parsing & Hold Pairing', () => {
  it('parses taps, holds, rolls, mines, lifts, and fakes', () => {
    const rawNotes = `
1000
0200
0300
M000
,
L000
0F00
0400
0300
;`;
    const parsed = parseNoteData(rawNotes, 4);
    expect(parsed.measures.length).toBe(2);
    expect(parsed.noteRows.length).toBe(8);

    // Row 0: tap on left
    expect(parsed.noteRows[0].arrows).toBe('1000');
    // Row 1: hold head on down
    expect(parsed.noteRows[1].arrows).toBe('0200');
    // Row 2: hold tail on down
    expect(parsed.noteRows[2].arrows).toBe('0300');
    // Row 3: mine on left
    expect(parsed.noteRows[3].arrows).toBe('M000');
    // Row 4: lift on left
    expect(parsed.noteRows[4].arrows).toBe('L000');
    // Row 5: fake on down
    expect(parsed.noteRows[5].arrows).toBe('0F00');
    // Row 6: roll head on up
    expect(parsed.noteRows[6].arrows).toBe('0400');
    // Row 7: roll tail on up
    expect(parsed.noteRows[7].arrows).toBe('0300');

    // Holds verification
    expect(parsed.holds.length).toBe(2);
    // Hold 1: track 1 (down), startRow = 48, endRow = 96, isRoll = false
    expect(parsed.holds[0].track).toBe(1);
    expect(parsed.holds[0].startRow).toBe(48);
    expect(parsed.holds[0].endRow).toBe(96);
    expect(parsed.holds[0].isRoll).toBe(false);

    // Hold 2: track 1 (down in measure 1 line 2), isRoll = true
    expect(parsed.holds[1].track).toBe(1);
    expect(parsed.holds[1].isRoll).toBe(true);
  });

  it('discards orphan 3s without preceding hold head', () => {
    const rawNotes = `
0030
1000
0000
0000
;`;
    const parsed = parseNoteData(rawNotes, 4);
    expect(parsed.holds.length).toBe(0);
  });

  it('clamps unclosed hold heads at the end of the chart', () => {
    const rawNotes = `
0200
0000
0000
1000
;`;
    const parsed = parseNoteData(rawNotes, 4);
    expect(parsed.holds.length).toBe(1);
    expect(parsed.holds[0].track).toBe(1);
    expect(parsed.holds[0].startRow).toBe(0);
    expect(parsed.holds[0].endRow).toBeGreaterThan(0);
  });

  it('strips keysound [12] and attack {attack} annotations cleanly', () => {
    const rawNotes = `
1[12]000
0100{att}
001[99]0
0001
;`;
    const parsed = parseNoteData(rawNotes, 4);
    expect(parsed.noteRows[0].arrows).toBe('1000');
    expect(parsed.noteRows[1].arrows).toBe('0100');
    expect(parsed.noteRows[2].arrows).toBe('0010');
    expect(parsed.noteRows[3].arrows).toBe('0001');
  });
});

describe('Lossless Round-Trip: Legacy .sm Format', () => {
  const SAMPLE_SM = `#TITLE:MAX 300;
#SUBTITLE:(Super Mix);
#ARTIST:Omega;
#TITLETRANSLIT:;
#SUBTITLETRANSLIT:;
#ARTISTTRANSLIT:;
#GENRE:Hardcore;
#CREDIT:Stepper AI;
#BANNER:banner.png;
#BACKGROUND:bg.png;
#LYRICSPATH:;
#CDTITLE:;
#MUSIC:max300.mp3;
#OFFSET:-0.035000;
#SAMPLESTART:12.000000;
#SAMPLELENGTH:12.000000;
#SELECTABLE:YES;
#BPMS:0.000000=300.000000,64.000000=150.000000;
#STOPS:32.000000=0.500000;
#BGCHANGES:;
#KEYSOUNDS:;

#NOTES:
     dance-single:
     Challenge Chart:
     Challenge:
     15:
     0.850000,0.920000,0.150000,0.300000,0.450000:
1000
0100
0010
0001
,
1001
0000
0110
0000
,
1000
0100
0010
0001
,
0000
0000
0000
0000
;`;

  it('losslessly parses and serializes .sm files', () => {
    // 1. Initial parse
    const sim1 = parseSimfile(SAMPLE_SM, 'sm');
    expect(sim1.title).toBe('MAX 300');
    expect(sim1.subtitle).toBe('(Super Mix)');
    expect(sim1.artist).toBe('Omega');
    expect(sim1.timing.offset).toBeCloseTo(-0.035, 6);
    expect(sim1.timing.bpms.length).toBe(2);
    expect(sim1.timing.stops.length).toBe(1);
    expect(sim1.charts.length).toBe(1);
    expect(sim1.charts[0].stepsType).toBe('dance-single');
    expect(sim1.charts[0].difficulty).toBe('Challenge');
    expect(sim1.charts[0].meter).toBe(15);
    expect(sim1.charts[0].noteRows.length).toBe(16);

    // 2. Serialize to .sm
    const serializedSM = serializeSM(sim1);

    // 3. Re-parse serialized output
    const sim2 = parseSimfile(serializedSM, 'sm');

    // 4. Verify identical data models
    expect(sim2.title).toBe(sim1.title);
    expect(sim2.subtitle).toBe(sim1.subtitle);
    expect(sim2.artist).toBe(sim1.artist);
    expect(sim2.genre).toBe(sim1.genre);
    expect(sim2.credit).toBe(sim1.credit);
    expect(sim2.music).toBe(sim1.music);
    expect(sim2.timing.offset).toBeCloseTo(sim1.timing.offset, 6);
    expect(sim2.timing.bpms).toEqual(sim1.timing.bpms);
    expect(sim2.timing.stops).toEqual(sim1.timing.stops);

    expect(sim2.charts.length).toBe(1);
    const c1 = sim1.charts[0];
    const c2 = sim2.charts[0];
    expect(c2.stepsType).toBe(c1.stepsType);
    expect(c2.difficulty).toBe(c1.difficulty);
    expect(c2.meter).toBe(c1.meter);

    // Compare note streams row-by-row
    expect(c2.noteRows.length).toBe(c1.noteRows.length);
    for (let i = 0; i < c1.noteRows.length; i++) {
      expect(c2.noteRows[i].row).toBe(c1.noteRows[i].row);
      expect(c2.noteRows[i].beat).toBeCloseTo(c1.noteRows[i].beat, 6);
      expect(c2.noteRows[i].arrows).toBe(c1.noteRows[i].arrows);
    }
  });
});

describe('Lossless Round-Trip: Modern .ssc Format & Split Timing', () => {
  const SAMPLE_SSC = `#VERSION:0.83;
#TITLE:Xepher;
#SUBTITLE:;
#ARTIST:Tatsh;
#TITLETRANSLIT:;
#SUBTITLETRANSLIT:;
#ARTISTTRANSLIT:;
#GENRE:Eurobeat;
#ORIGIN:;
#CREDIT:ITG Charter;
#BANNER:banner.png;
#BACKGROUND:bg.png;
#PREVIEWVID:;
#JACKET:;
#CDIMAGE:;
#DISCIMAGE:;
#LYRICSPATH:;
#CDTITLE:;
#MUSIC:xepher.mp3;
#OFFSET:-0.045000;
#SAMPLESTART:30.000000;
#SAMPLELENGTH:12.000000;
#SELECTABLE:YES;
#BPMS:0.000000=170.000000;
#STOPS:;
#DELAYS:;
#WARPS:;
#TIMESIGNATURES:0.000000=4=4;
#TICKCOUNTS:0.000000=4;
#COMBOS:0.000000=1=1;
#SPEEDS:0.000000=1.000000=0.000000=0;
#SCROLLS:0.000000=1.000000;
#FAKES:;
#LABELS:0.000000=Song Start;
#BGCHANGES:;
#KEYSOUNDS:;

#NOTEDATA:;
#CHARTNAME:Main Singles;
#STEPSTYPE:dance-single;
#DESCRIPTION:Hard Steps;
#CHARTSTYLE:;
#DIFFICULTY:Hard;
#METER:11;
#RADARVALUES:0.600000,0.700000,0.100000,0.200000,0.050000;
#CREDIT:Charter A;
#NOTES:
1000
0100
0010
0001
,
1100
0011
1100
0011
;

#NOTEDATA:;
#CHARTNAME:Expert Split Timing;
#STEPSTYPE:dance-single;
#DESCRIPTION:Challenge with Split Timing;
#CHARTSTYLE:;
#DIFFICULTY:Challenge;
#METER:14;
#RADARVALUES:0.800000,0.900000,0.300000,0.400000,0.150000;
#CREDIT:Charter B;
#OFFSET:-0.060000;
#BPMS:0.000000=180.000000,32.000000=360.000000;
#STOPS:16.000000=0.500000;
#DELAYS:32.000000=0.250000;
#WARPS:48.000000=4.000000;
#NOTES:
1000
0100
0010
0001
,
0001
0010
0100
1000
;
`;

  it('losslessly parses, serializes, and re-parses modern .ssc with split timing', () => {
    // 1. Parse .ssc
    const sim1 = parseSimfile(SAMPLE_SSC, 'ssc');
    expect(sim1.fileType).toBe('ssc');
    expect(sim1.title).toBe('Xepher');
    expect(sim1.artist).toBe('Tatsh');
    expect(sim1.timing.offset).toBeCloseTo(-0.045, 6);
    expect(sim1.charts.length).toBe(2);

    // Chart 0: Song-level timing
    const chart0 = sim1.charts[0];
    expect(chart0.difficulty).toBe('Hard');
    expect(chart0.meter).toBe(11);
    expect(chart0.timing).toBeUndefined();

    // Chart 1: Split timing overrides
    const chart1 = sim1.charts[1];
    expect(chart1.difficulty).toBe('Challenge');
    expect(chart1.meter).toBe(14);
    expect(chart1.timing).toBeDefined();
    expect(chart1.timing!.offset).toBeCloseTo(-0.060, 6);
    expect(chart1.timing!.bpms.length).toBe(2);
    expect(chart1.timing!.bpms[1].bpm).toBe(360);
    expect(chart1.timing!.stops.length).toBe(1);
    expect(chart1.timing!.delays.length).toBe(1);
    expect(chart1.timing!.warps.length).toBe(1);

    // 2. Serialize to .ssc
    const serializedSSC = serializeSSC(sim1);

    // 3. Re-parse serialized output
    const sim2 = parseSimfile(serializedSSC, 'ssc');

    // 4. Verify losslessness
    expect(sim2.title).toBe(sim1.title);
    expect(sim2.artist).toBe(sim1.artist);
    expect(sim2.timing.offset).toBeCloseTo(sim1.timing.offset, 6);
    expect(sim2.charts.length).toBe(2);

    // Chart 0 fidelity
    expect(sim2.charts[0].difficulty).toBe(chart0.difficulty);
    expect(sim2.charts[0].meter).toBe(chart0.meter);
    expect(sim2.charts[0].noteRows.length).toBe(chart0.noteRows.length);

    // Chart 1 split timing fidelity
    const reChart1 = sim2.charts[1];
    expect(reChart1.difficulty).toBe(chart1.difficulty);
    expect(reChart1.meter).toBe(chart1.meter);
    expect(reChart1.timing).toBeDefined();
    expect(reChart1.timing!.offset).toBeCloseTo(chart1.timing!.offset, 6);
    expect(reChart1.timing!.bpms).toEqual(chart1.timing!.bpms);
    expect(reChart1.timing!.stops).toEqual(chart1.timing!.stops);
    expect(reChart1.timing!.delays).toEqual(chart1.timing!.delays);
    expect(reChart1.timing!.warps).toEqual(chart1.timing!.warps);

    // Note rows equality
    expect(reChart1.noteRows.length).toBe(chart1.noteRows.length);
    for (let i = 0; i < chart1.noteRows.length; i++) {
      expect(reChart1.noteRows[i].row).toBe(chart1.noteRows[i].row);
      expect(reChart1.noteRows[i].arrows).toBe(chart1.noteRows[i].arrows);
    }
  });

  it('supports Dance Doubles (8 panels) round-trip', () => {
    const doublesSSC = `#VERSION:0.83;
#TITLE:Doubles Test;
#ARTIST:Composer;
#OFFSET:0.000000;
#BPMS:0.000000=140.000000;

#NOTEDATA:;
#STEPSTYPE:dance-double;
#DIFFICULTY:Challenge;
#METER:16;
#NOTES:
10000001
01000010
00100100
00011000
;`;

    const sim = parseSimfile(doublesSSC, 'ssc');
    expect(sim.charts.length).toBe(1);
    expect(sim.charts[0].stepsType).toBe('dance-double');
    expect(sim.charts[0].noteRows.length).toBe(4);
    expect(sim.charts[0].noteRows[0].arrows).toBe('10000001');

    const serialized = serializeSSC(sim);
    const reSim = parseSimfile(serialized, 'ssc');
    expect(reSim.charts[0].stepsType).toBe('dance-double');
    expect(reSim.charts[0].noteRows[0].arrows).toBe('10000001');
    expect(reSim.charts[0].noteRows[3].arrows).toBe('00011000');
  });

  it('preserves SSC asset, gimmick timing, labels, and unknown tags', () => {
    const source = `#VERSION:0.83;
#TITLE:Audit;
#ARTIST:Audit;
#MUSIC:audio.ogg;
#OFFSET:0;
#BPMS:0=120,8=150;
#STOPS:4=0.5;
#SPEEDS:0=1=0=0,8=2=0=0;
#SCROLLS:0=1,12=0.5;
#JACKET:jacket.png;
#PREVIEWVID:preview.mp4;
#BGCHANGES:0=background.png=1.000=0=0=0=StretchNoLoop====;
#LABELS:0=Intro,8=Chorus;
#CUSTOMTAG:keep\\;this;
#NOTEDATA:;
#STEPSTYPE:dance-single;
#DIFFICULTY:Challenge;
#METER:10;
#NOTES:
1000
0100
0010
0001
;`;
    const first = parseSimfile(source, 'ssc');
    const output = serializeSSC(first);
    const second = parseSimfile(output, 'ssc');

    expect(output).toContain('#JACKET:jacket.png;');
    expect(output).toContain('#PREVIEWVID:preview.mp4;');
    expect(output).toContain('#BGCHANGES:0=background.png=1.000=0=0=0=StretchNoLoop====;');
    expect(second.timing.speeds).toEqual(first.timing.speeds);
    expect(second.timing.scrolls).toEqual(first.timing.scrolls);
    expect(second.timing.labels).toEqual(first.timing.labels);
    expect(second.extraTags?.JACKET).toBe('jacket.png');
    expect(second.extraTags?.CUSTOMTAG).toBe('keep;this');
  });

  it('escapes MSD delimiters in edited metadata', () => {
    const parsed = parseSimfile(SAMPLE_SSC, 'ssc');
    parsed.title = 'A; #ARTIST:Injected \\ mix';
    parsed.charts[0].description = 'Colon: semicolon; hash# slash\\';

    const reparsed = parseSimfile(serializeSSC(parsed), 'ssc');
    expect(reparsed.title).toBe(parsed.title);
    expect(reparsed.artist).toBe('Tatsh');
    expect(reparsed.charts[0].description).toBe(parsed.charts[0].description);
  });

  it('retains chart-only time signatures', () => {
    const parsed = parseSimfile(SAMPLE_SSC, 'ssc');
    parsed.charts[0].timing = {
      ...parsed.timing,
      timeSignatures: [{ beat: 0, numerator: 3, denominator: 4 }],
    };
    const output = serializeSSC(parsed);
    const chartBlock = output.slice(output.indexOf('#NOTEDATA'));
    expect(chartBlock).toContain('#TIMESIGNATURES:0.000000=3=4;');
    expect(parseSimfile(output, 'ssc').charts[0].timing?.timeSignatures).toEqual([
      { beat: 0, numerator: 3, denominator: 4 },
    ]);
  });

  it('distinguishes inherited timing from explicit empty chart overrides', () => {
    const source = `#VERSION:0.83;
#TITLE:Empty override;
#BPMS:0=120;
#STOPS:4=0.5;
#NOTEDATA:;
#STEPSTYPE:dance-single;
#DIFFICULTY:Hard;
#METER:8;
#STOPS:;
#DELAYS:;
#NOTES:
1000
0000
0000
0000
;`;
    const parsed = parseSimfile(source, 'ssc');
    expect(parsed.charts[0].timing?.stops).toEqual([]);
    expect(parsed.charts[0].timing?.presentTags).toEqual(['STOPS', 'DELAYS']);

    const output = serializeSSC(parsed);
    const chartBlock = output.slice(output.indexOf('#NOTEDATA'));
    expect(chartBlock).toContain('#STOPS:;');
    expect(chartBlock).toContain('#DELAYS:;');
    const reparsed = parseSimfile(output, 'ssc');
    expect(reparsed.charts[0].timing?.stops).toEqual([]);
    expect(reparsed.charts[0].timing?.delays).toEqual([]);
    expect(reparsed.charts[0].timing?.presentTags).toEqual(['STOPS', 'DELAYS']);
  });

  it('keeps edits made after parsing an OFFSET-only chart without freezing inherited song timing', () => {
    const source = `#VERSION:0.83;
#TITLE:Offset only;
#BPMS:0=120;
#TIMESIGNATURES:0=4=4;
#NOTEDATA:;
#STEPSTYPE:dance-single;
#DIFFICULTY:Hard;
#METER:8;
#OFFSET:-0.1;
#NOTES:
1000
0000
0000
0000
;`;
    const edited = parseSimfile(source, 'ssc');
    edited.charts[0].timing!.bpms = [{ beat: 0, bpm: 150 }];
    edited.charts[0].timing!.timeSignatures = [{ beat: 0, numerator: 3, denominator: 4 }];
    const editedOutput = serializeSSC(edited);
    const editedChart = parseSimfile(editedOutput, 'ssc').charts[0];
    expect(editedChart.timing?.bpms).toEqual([{ beat: 0, bpm: 150 }]);
    expect(editedChart.timing?.timeSignatures).toEqual([{ beat: 0, numerator: 3, denominator: 4 }]);

    const globalEdit = parseSimfile(source, 'ssc');
    globalEdit.timing.bpms = [{ beat: 0, bpm: 180 }];
    const chartBlock = serializeSSC(globalEdit).slice(serializeSSC(globalEdit).indexOf('#NOTEDATA'));
    expect(chartBlock).toContain('#OFFSET:-0.100000;');
    expect(chartBlock).not.toContain('#BPMS:');
  });

  it('accepts StepMania two-field COMBOS entries and defaults misses to hits', () => {
    const source = `#VERSION:0.83;
#TITLE:Combos;
#BPMS:0=120;
#COMBOS:0=1,16=2=3;
#NOTEDATA:;
#STEPSTYPE:dance-single;
#DIFFICULTY:Hard;
#METER:8;
#NOTES:
1000
0000
0000
0000
;`;
    const parsed = parseSimfile(source, 'ssc');
    expect(parsed.timing.combos).toEqual([
      { beat: 0, hit: 1, miss: 1 },
      { beat: 16, hit: 2, miss: 3 },
    ]);
    expect(parseSimfile(serializeSSC(parsed), 'ssc').timing.combos).toEqual(parsed.timing.combos);
  });
});
