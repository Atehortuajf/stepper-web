# P0 simfile import/export preservation handoff

## Implemented

- SSC song and chart timing now parse and serialize `TICKCOUNTS`, `COMBOS`, `SPEEDS`, `SCROLLS`, `FAKES`, `LABELS`, and `TIMESIGNATURES` alongside the existing core timing tags.
- Chart timing records which tags were explicitly present. This preserves an empty chart override such as `#STOPS:;` and keeps a chart with no timing tags inherited from the song.
- The parser retains the song-timing snapshot from when a chart's first split tag was read. Serialization unions explicit tags with fields changed from that snapshot, so an OFFSET-only chart can later gain BPM/time-signature edits without freezing unrelated inherited values when song timing changes.
- Two-field `COMBOS` entries (`beat=hit`) are accepted with `miss=hit`, matching StepMania's loader behavior; three-field entries remain supported.
- Chart-only time signatures participate in split-timing detection and serialization.
- Scalar MSD metadata is escaped for backslash, colon, semicolon, and hash delimiters. Unknown tag values retain their colon parameter structure while escaping terminators.
- Generic asset/background tags including `JACKET`, `PREVIEWVID`, `CDIMAGE`, `DISCIMAGE`, `BGCHANGES`, and `KEYSOUNDS` are passed through instead of being shadowed by blank serializer defaults.

## Verification

- `npm test -- --run src/editor/engine/__tests__`: 4 files, 50 tests passed.
- `npm run build`: TypeScript and production Vite build passed.
- Focused regressions cover the audit probe, delimiter-bearing metadata, unknown tags, chart-only 3/4 timing, explicit empty overrides, inherited timing, holds, and doubles.

## Remaining limits

- `extraTags` is a record, so repeated unknown tags with the same name collapse to the last value. This matches the parser's existing supported representation but is not byte-lossless for arbitrary MSD.
- This increment preserves semantic content within the supported model. It does not preserve comments, whitespace, original numeric formatting, or tag order.
- A separate StepMania-compatible parser/runtime validation is still needed for the broader U06 acceptance criterion; the local tests exercise this project's real parser and serializer.
- No independent Python simfile consumer is installed in this workspace. Syntax and `COMBOS` behavior were checked against StepMania's primary `Docs/SimfileFormats/ssc_msd5.txt` and `src/NotesLoaderSSC.cpp` sources.
