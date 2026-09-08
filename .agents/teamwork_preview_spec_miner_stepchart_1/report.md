# Stepchart & Editor Specification Report
**Project Stepper Web — ArrowVortex-Grade Rhythm Editor Engine**  
**Author:** Stepchart & Editor Spec Miner (`teamwork_preview_spec_miner_stepchart_1`)  
**Date:** September 2026  
**Status:** Authoritative Technical Specification  

---

## Executive Summary & Scope

This specification establishes the comprehensive technical foundation for building a full-stack, mobile-compatible, DAW-grade dance stepchart editor web application. The findings and formal models detailed herein are derived directly from primary authoritative sources:
1. **StepMania 5.1 / ITGmania Core Engine Source:** `src/MsdFile.{h,cpp}`, `src/NotesLoaderSM.{h,cpp}`, `src/NotesLoaderSSC.{h,cpp}`, `src/TimingData.{h,cpp}`, `src/NoteTypes.h`, `src/NoteData.h`.
2. **Project Stepper Architecture & Timing Engine:** `/Users/ate/Projects/Stepper/docs/timing_specification.md`, `stepper/timing/engine.py`, `stepper/export/measure_util.py`, `stepper/data/chart_parser.py`.
3. **ArrowVortex Primary Reference:** Desktop shortcut architecture, layout conventions, and workflow models.
4. **Mobile Human Interface Guidelines:** Responsive touch layouts for 375px-430px viewports, tactile target sizing, and drawer navigation.

---

## 1. File Format Specifications: Legacy .sm vs. Modern .ssc

### 1.1 MSD (Musical Score Description) Lexer Grammar
Both `.sm` and `.ssc` files are encoded using the MSD syntax:
- **Format Structure:** Sequence of parameter blocks of the form `#TAG:PARAM1:PARAM2:...:PARAMn;`.
- **Delimiters:**
  - `#` begins a tag name.
  - `:` delimits tag name from first parameter, and separates subsequent positional parameters.
  - `;` explicitly terminates the tag block.
  - `//` starts a line comment; all content until the next `\n` or `\r` is ignored.
  - `\` escapes characters (`\:`, `\;`, `\#`, `\\`).
- **Implicit Termination (Recovery Rule):** If an unescaped `#` character appears at the start of a line before the preceding tag was closed with a `;`, the lexer treats the previous tag as implicitly closed, emits a warning, and starts the new tag.

### 1.2 Legacy StepMania Simfile (.sm) Specification
In `.sm` files, all timing is song-level (global). Charts cannot override BPMs, stops, or offsets. Stepcharts are stored in 6-parameter `#NOTES:` blocks.

#### Global Header Tags in .sm
| Tag Name | Parameter Count | Required | Description & Syntax |
|---|:---:|:---:|---|
| `#TITLE:` | 1 | Yes | Song title string (e.g. `#TITLE:MAX 300;`). |
| `#SUBTITLE:` | 1 | No | Song subtitle (e.g. `#SUBTITLE:(Super Mix);`). |
| `#ARTIST:` | 1 | Yes | Song artist/composer (e.g. `#ARTIST:Omega;`). |
| `#TITLETRANSLIT:` | 1 | No | Romanized song title. |
| `#SUBTITLETRANSLIT:` | 1 | No | Romanized song subtitle. |
| `#ARTISTTRANSLIT:` | 1 | No | Romanized song artist. |
| `#GENRE:` | 1 | No | Music genre tag. |
| `#CREDIT:` | 1 | No | Simfile author / charter attribution. |
| `#BANNER:` | 1 | No | Relative path to 418x164 banner image. |
| `#BACKGROUND:` | 1 | No | Relative path to 640x480 / 1920x1080 background image. |
| `#LYRICSPATH:` | 1 | No | Relative path to `.lrc` lyrics file. |
| `#CDTITLE:` | 1 | No | Relative path to CD logo graphic. |
| `#MUSIC:` | 1 | Yes | Relative path to audio file (`.mp3`, `.ogg`, `.wav`). |
| `#OFFSET:` | 1 | Yes | Audio offset in seconds (float, e.g. `#OFFSET:-0.035000;`). Timestamp of beat 0 is `-OFFSET`. |
| `#SAMPLESTART:` | 1 | No | Preview audio start time in seconds (float). |
| `#SAMPLELENGTH:` | 1 | No | Preview audio duration in seconds (float, typically `12.000000`). |
| `#SELECTABLE:` | 1 | No | `YES`, `NO`, or `ROULETTE` (default `YES`). |
| `#BPMS:` | 1 | Yes | Comma-separated `beat=bpm` pairs (e.g. `0.000=175.000,64.000=350.000`). |
| `#STOPS:` | 1 | No | Comma-separated `beat=seconds` pairs (e.g. `32.000=0.500`). Legacy alias: `#FREEZES:`. |
| `#BGCHANGES:` | 1 | No | Background animation change scripts. |
| `#KEYSOUNDS:` | 1 | No | Comma-separated keysound audio sample filenames. |

#### The 6-Parameter #NOTES: Structure in .sm
```
#NOTES:
     <StepsType>:
     <Description / Step Artist>:
     <Difficulty>:
     <Meter>:
     <RadarValues>:
<NoteData>;
```
1. **StepsType:** e.g. `dance-single`, `dance-double`, `dance-solo`, `pump-single`.
2. **Description / Step Artist:** Author attribution or chart description.
3. **Difficulty:** One of `Beginner`, `Easy`, `Medium`, `Hard`, `Challenge`, `Edit`.
4. **Meter:** Integer difficulty rating (typically 1 to 20+).
5. **RadarValues:** 5 comma-separated floats (DDR style: `Stream, Voltage, Air, Freeze, Chaos`) or 11 floats (OpenITG style).
6. **NoteData:** Measure blocks separated by commas `,` and terminated by semicolon `;`.

---

### 1.3 Modern StepMania 5 / ITGmania Simfile (.ssc) Specification
The `.ssc` format replaces the 6-parameter `#NOTES:` tag with extensible `#NOTEDATA:;` blocks and introduces **split timing** (per-chart timing overrides) and modern gameplay gimmicks.

#### Song-Level Header Tags in .ssc
| Tag Name | Parameter Count | Scope | Description & Syntax |
|---|:---:|:---:|---|
| `#VERSION:` | 1 | File-level | Must be first line of `.ssc` (e.g. `#VERSION:0.83;`). Enables split timing. |
| `#TITLE:` | 1 | Song-level | Main song title. |
| `#SUBTITLE:` | 1 | Song-level | Subtitle / mix name. |
| `#ARTIST:` | 1 | Song-level | Song artist / composer. |
| `#TITLETRANSLIT:` | 1 | Song-level | Romanized title. |
| `#SUBTITLETRANSLIT:` | 1 | Song-level | Romanized subtitle. |
| `#ARTISTTRANSLIT:` | 1 | Song-level | Romanized artist. |
| `#GENRE:` | 1 | Song-level | Music genre. |
| `#ORIGIN:` | 1 | Song-level | Origin pack/source. |
| `#CREDIT:` | 1 | Song-level | Author credit. |
| `#BANNER:` | 1 | Song-level | Banner graphic path. |
| `#BACKGROUND:` | 1 | Song-level | Background graphic path. |
| `#PREVIEWVID:` | 1 | Song-level | Video preview file path. |
| `#JACKET:` | 1 | Song-level | Square jacket graphic path. |
| `#CDIMAGE:` | 1 | Song-level | Disc graphic path. |
| `#DISCIMAGE:` | 1 | Song-level | Disc image path. |
| `#LYRICSPATH:` | 1 | Song-level | Lyrics file path. |
| `#CDTITLE:` | 1 | Song-level | CD title graphic path. |
| `#MUSIC:` | 1 | Song/Chart | Path to audio file. Individual charts can override music! |
| `#OFFSET:` | 1 | Song/Chart | Audio offset in seconds. |
| `#SAMPLESTART:` | 1 | Song/Chart | Preview start in seconds. |
| `#SAMPLELENGTH:` | 1 | Song/Chart | Preview duration in seconds. |
| `#SELECTABLE:` | 1 | Song-level | Simfile selectability (`YES`/`NO`). |
| `#DISPLAYBPM:` | 1 | Song-level | Display BPM override (e.g. `175.000` or `100.000:400.000` or `*`). |
| `#BPMS:` | 1 | Song/Chart | Comma-separated `beat=bpm` list. |
| `#STOPS:` | 1 | Song/Chart | Comma-separated `beat=seconds` list (post-note pauses). |
| `#DELAYS:` | 1 | Song/Chart | Comma-separated `beat=seconds` list (pre-note pauses). |
| `#WARPS:` | 1 | Song/Chart | Comma-separated `beat=length` list (skips `length` beats in 0s). |
| `#TIMESIGNATURES:` | 1 | Song/Chart | Comma-separated `beat=num=den` triplets (default `0.000=4=4`). |
| `#TICKCOUNTS:` | 1 | Song/Chart | Hold checkpoint scoring ticks per beat (default `0.000=4`). |
| `#COMBOS:` | 1 | Song/Chart | Combo multipliers: `beat=hit=miss` (default `0.000=1=1`). |
| `#SPEEDS:` | 1 | Song/Chart | Scroll speed changes: `beat=ratio=delay=unit` (unit: 0=beats, 1=seconds). |
| `#SCROLLS:` | 1 | Song/Chart | Visual arrow scroll rate: `beat=ratio` (e.g. `0.000=1.000`). |
| `#FAKES:` | 1 | Song/Chart | Unjudged arrow regions: `beat=length`. |
| `#LABELS:` | 1 | Song/Chart | Rehearsal markers: `beat=text` (e.g. `0.000=Intro,32.000=Chorus`). |
| `#BGCHANGES:` | 1 | Song-level | Background animations. |
| `#KEYSOUNDS:` | 1 | Song-level | Keysound list. |
| `#ATTACKS:` | 1 | Song/Chart | Course attacks/modifiers. |

#### Modern #NOTEDATA:; Block Structure in .ssc
```
#NOTEDATA:;
#CHARTNAME:Expert Singles;
#STEPSTYPE:dance-single;
#DESCRIPTION:Step Artist;
#CHARTSTYLE:;
#DIFFICULTY:Challenge;
#METER:14;
#RADARVALUES:0.852310,0.741250,0.210450,0.354120,0.125430;
#CREDIT:Charter;

// --- PER-CHART SPLIT TIMING (OPTIONAL) ---
#OFFSET:-0.035000;
#BPMS:0.000000=175.000000;
#STOPS:32.000000=0.500000;
#DELAYS:64.000000=0.250000;
#WARPS:96.000000=4.000000;

// --- NOTE STREAM ---
#NOTES:
1000
0100
0010
0001
,
1000
0100
0010
0001
;
```

---

### 1.4 Measure Syntax & Subdivision Representations
StepMania represents musical time internally using a fixed-point **192-tick grid** (`ROWS_PER_BEAT = 48`):
$$\text{ROWS\_PER\_BEAT} = 48$$
$$\text{ROWS\_PER\_MEASURE} = 48 \times 4 = 192 \quad (\text{in standard } 4/4 \text{ time})$$
$$\text{Row} = \text{round}(\text{Beat} \times 48), \quad \text{Beat} = \frac{\text{Row}}{48.0}$$

Within note data:
- Measures are separated by commas `,` and the final measure is terminated by semicolon `;`.
- Each measure consists of $N$ lines, where $N \in \{4, 8, 12, 16, 24, 32, 48, 64, 96, 192\}$.
- The $l$-th line ($0 \le l < N$) in measure $m$ corresponds to:
  $$\text{Measure Tick } t = \text{round}\left(\frac{192 \times l}{N}\right), \quad \text{Absolute Row } r = m \times 192 + t, \quad \text{Beat } b = \frac{r}{48.0}$$

#### Canonical Subdivision Table
| Lines / Measure ($N$) | Note Subdivision | Beat Step ($\Delta b$) | Tick Step ($\Delta r$) | Musical Meaning |
|:---:|---|:---:|:---:|---|
| **4** | 4th note (Quarter) | $1.0$ | $48$ | Standard quarter beat note |
| **8** | 8th note (Eighth) | $0.5$ | $24$ | Half beat |
| **12** | 12th note (Quarter Triplet) | $1/3 \approx 0.333333$ | $16$ | 3 notes per 4th beat |
| **16** | 16th note (Sixteenth) | $0.25$ | $12$ | Quarter of a beat |
| **24** | 24th note (Eighth Triplet / Sextuplet) | $1/6 \approx 0.166667$ | $8$ | 6 notes per 4th beat |
| **32** | 32nd note | $0.125$ | $6$ | Eighth of a beat |
| **48** | 48th note (Sixteenth Triplet) | $1/12 \approx 0.083333$ | $4$ | 12 notes per 4th beat |
| **64** | 64th note | $0.0625$ | $3$ | Sixteenth of a beat |
| **96** | 96th note (32nd Triplet) | $1/24 \approx 0.041667$ | $2$ | 24 notes per 4th beat |
| **192** | 192nd note | $1/48 \approx 0.020833$ | $1$ | High-precision micro-step |

#### Measure Minimization Algorithm (`GetSmallestNoteTypeForMeasure`)
To prevent unnecessary file bloat, a measure containing notes must be written with the minimal line count $N$ that preserves all note positions without loss:
1. Let $T = \{ t \in [0, 191] \mid \text{tick } t \text{ contains a non-empty note} \}$.
2. Test valid row strides in descending order: $S \in \{48, 24, 16, 12, 8, 6, 4, 3, 2, 1\}$ (corresponding to $N = 192 / S$).
3. Find the largest stride $S$ where $\forall t \in T: (t \pmod S) == 0$.
4. Select line count $N = 192 / S$. If $T = \emptyset$ (empty measure), select $S = 48 \implies N = 4$ lines of `0000`.

---

## 2. Supported Game Modes & Note Types

### 2.1 Game Modes
1. **Dance Singles (`dance-single`):**
   - 4 panels / columns per line:
     $$\text{Column 0: Left } (\leftarrow), \quad \text{Column 1: Down } (\downarrow), \quad \text{Column 2: Up } (\uparrow), \quad \text{Column 3: Right } (\rightarrow)$$
2. **Dance Doubles (`dance-double`):**
   - 8 panels / columns per line spanning Player 1 (Left Pad) and Player 2 (Right Pad):
     - Column 0: P1 Left ($\leftarrow$)
     - Column 1: P1 Down ($\downarrow$)
     - Column 2: P1 Up ($\uparrow$)
     - Column 3: P1 Right ($\rightarrow$)
     - Column 4: P2 Left ($\leftarrow$)
     - Column 5: P2 Down ($\downarrow$)
     - Column 6: P2 Up ($\uparrow$)
     - Column 7: P2 Right ($\rightarrow$)

### 2.2 Complete Note Type Semantics
| Char | Internal Enum (`src/NoteTypes.h`) | Type Name | Visual Representation | Gameplay & Engine Behavior |
|:---:|---|---|---|---|
| `'0'` | `TapNoteType_Empty` | Empty | Blank space | No step on this panel at this row. |
| `'1'` | `TapNoteType_Tap` | Tap Note | Solid colored arrow | Regular step. Judged when crossing step receiver. |
| `'2'` | `TapNoteType_HoldHead` | Hold Head | Arrow with attached tail body | Initial depression point of a hold. Player must step and keep panel depressed until tail `'3'`. |
| `'3'` | `TapNoteType_HoldTail` | Hold / Roll Tail | Flat end cap | Terminating release tick of an active hold or roll on that panel. Cannot appear without preceding `'2'` or `'4'`. |
| `'4'` | `TapNoteType_HoldHead` | Roll Head | Pulsing/flashing striped body | Initial depression point of a roll. Player must repeatedly re-strike the panel to prevent roll life bar from draining before tail `'3'`. |
| `'M'` | `TapNoteType_Mine` | Shock / Mine | Spiked metallic mine / lightning orb | Hazard note. Player must NOT press panel. Detonates if panel is held or struck within $\pm 180\text{ ms}$ of arrival, deducting score and life. |
| `'L'` | `TapNoteType_Lift` | Lift Note | Inverted outline arrow / hollow glyph | Reverse step. Player must have foot resting on panel and release it precisely when crossing receptor (judged on key-release). |
| `'F'` | `TapNoteType_Fake` | Fake / Decoy Note | Semi-transparent / ghost arrow | Visual decoy. Scrolls toward and passes receptor, but has no judgment window (cannot be hit or missed; does not alter combo). |
| `'K'` | `TapNoteType_AutoKeysound`| Auto Keysound | Invisible marker | Automatically triggers assigned keysound audio sample upon crossing receptor without player input. |

#### Invariants & Syntactic Validation Rules
- **Head-Tail Pairing:** Every `'2'` (hold) or `'4'` (roll) on track $c$ at row $r_{\text{head}}$ MUST have a corresponding `'3'` on track $c$ at row $r_{\text{tail}} > r_{\text{head}}$.
- **No Intermediate Taps:** Track $c$ cannot contain any `'1'`, `'2'`, `'4'`, or `'M'` between $r_{\text{head}}$ and $r_{\text{tail}}$.
- **Orphan Tail Handling:** If a parser encounters an orphan `'3'` without an active hold head, it must discard it.
- **Unclosed Head Handling:** If an unclosed `'2'` or `'4'` reaches chart end, the parser clamps the tail to the last row + 48 ticks.

---

## 3. Canonical StepMania Color Hues

In StepMania, ITGmania, and ArrowVortex, note arrows are colored based strictly on the rhythmic quantization of the beat where the note begins (not its duration).

### 3.1 Color Palette & Hex Code Specifications
| Subdivision | Beat Divisor | Tick Modulo Condition | Common Name | Canonical Hex Code | RGB | HSL |
|---|:---:|:---:|---|:---:|:---:|:---:|
| **4th** | $1$ beat | $\text{tick} == 0$ | Red | `#ff2a55` | `rgb(255, 42, 85)` | `348°, 100%, 58%` |
| **8th** | $1/2$ beat | $\text{tick} \pmod{24} == 0$ | Blue | `#00a2ff` | `rgb(0, 162, 255)` | `202°, 100%, 50%` |
| **12th** | $1/3$ beat | $\text{tick} \pmod{16} == 0$ | Purple | `#9e3cff` | `rgb(158, 60, 255)` | `270°, 100%, 62%` |
| **16th** | $1/4$ beat | $\text{tick} \pmod{12} == 0$ | Yellow | `#ffd000` | `rgb(255, 208, 0)` | `49°, 100%, 50%` |
| **24th** | $1/6$ beat | $\text{tick} \pmod{8} == 0$ | Pink / Magenta | `#ff54be` | `rgb(255, 84, 190)` | `323°, 100%, 66%` |
| **32nd** | $1/8$ beat | $\text{tick} \pmod{6} == 0$ | Orange | `#ff7b00` | `rgb(255, 123, 0)` | `29°, 100%, 50%` |
| **48th** | $1/12$ beat | $\text{tick} \pmod{4} == 0$ | Cyan / Teal | `#00e5ff` | `rgb(0, 229, 255)` | `186°, 100%, 50%` |
| **64th** | $1/16$ beat | $\text{tick} \pmod{3} == 0$ | Green | `#00e676` | `rgb(0, 230, 118)` | `151°, 100%, 45%` |
| **96th** | $1/24$ beat | $\text{tick} \pmod{2} == 0$ | Light Gray / Lavender | `#b0bec5` | `rgb(176, 190, 197)`| `200°, 15%, 73%` |
| **192nd** | $1/48$ beat | $\text{tick} \pmod{1} == 0$ | Dark Gray / White | `#78909c` | `rgb(120, 144, 156)`| `200°, 14%, 54%` |

### 3.2 Exact Mathematical Quantization Algorithm
```python
def get_note_quantization(beat: float) -> int:
    frac = beat - math.floor(beat)
    tick = int(round(frac * 48)) % 48
    if tick == 0:
        return 4
    elif tick % 24 == 0:
        return 8
    elif tick % 16 == 0:
        return 12
    elif tick % 12 == 0:
        return 16
    elif tick % 8 == 0:
        return 24
    elif tick % 6 == 0:
        return 32
    elif tick % 4 == 0:
        return 48
    elif tick % 3 == 0:
        return 64
    elif tick % 2 == 0:
        return 96
    return 192
```

---

## 4. Precise Mathematical Timing Equations

### 4.1 Fundamental Offset & Physical Alignment
Let:
- $\text{OFFSET} \in \mathbb{R}$: The float value in `#OFFSET:` (in seconds).
- $t_{\text{audio}} \in \mathbb{R}$: Physical elapsed time from the start of the audio file ($t_{\text{audio}} = 0.0$ at audio sample 0).
- $t_{\text{unoffset}} \in \mathbb{R}$: Internal engine time aligned with beat 0 ($t_{\text{unoffset}} = 0.0$ at beat 0).

$$t_{\text{unoffset}} = t_{\text{audio}} + \text{OFFSET}$$
$$t_{\text{audio}} = t_{\text{unoffset}} - \text{OFFSET}$$

#### Properties at Beat 0:
$$t_{\text{unoffset}}(\text{beat } 0) = 0.0 \implies t_{\text{audio}}(\text{beat } 0) = -\text{OFFSET}$$
- **Negative OFFSET (e.g. `#OFFSET:-0.090000;`):** Beat 0 occurs at $t_{\text{audio}} = +0.090\text{ s}$ (90 ms after audio starts).
- **Positive OFFSET (e.g. `#OFFSET:0.500000;`):** Beat 0 occurs at $t_{\text{audio}} = -0.500\text{ s}$ (500 ms before audio starts).

---

### 4.2 Piecewise Continuous Integration Engine
A song's timing timeline is governed by four interacting events:
1. **BPM Changes ($\text{BPM}(u)$):** `#BPMS:beat=bpm`.
2. **Warps ($\mathcal{W}$):** `#WARPS:beat=length`. Inside interval $[b_w, b_w + L_w)$, beat advances while $t_{\text{unoffset}}$ does NOT advance ($\Delta t = 0$).
3. **Stops ($\mathcal{S}$):** `#STOPS:beat=duration`. Beat pauses for `duration` seconds AFTER note on `beat` passes receptors.
4. **Delays ($\mathcal{D}$):** `#DELAYS:beat=duration`. Beat pauses for `duration` seconds BEFORE note on `beat` reaches receptors.

#### Master Forward Mapping (Beat $b \to t_{\text{audio}}$)
For any beat $b \ge 0$:
$$t_{\text{unoffset}}(b) = \int_0^b \frac{60}{\text{BPM}(u)} \cdot \mathbb{I}(u \notin \mathcal{W}) \, du + \sum_{b_s < b} D_s^{\text{stop}} + \sum_{b_d \le b} D_d^{\text{delay}}$$
$$t_{\text{audio}}(b) = t_{\text{unoffset}}(b) - \text{OFFSET}$$

*Note on Stop Boundary:* For a stop located at beat $b_s$, the note on $b_s$ crosses the receptor at timestamp $t_{\text{marker}} = t_{\text{unoffset}}(b_s^-)$. The pause then elapses over $[t_{\text{marker}}, t_{\text{marker}} + D_s^{\text{stop}}]$.

#### Master Inverse Mapping (Audio Time $t_{\text{audio}} \to$ Beat $b$)
Given $t_{\text{audio}}$, compute $t_{\text{unoffset}} = t_{\text{audio}} + \text{OFFSET}$.
In the piecewise simulation timeline:
1. **Pause Plateau (Stop or Delay):** If $t_{\text{unoffset}} \in [t_{\text{start}}, t_{\text{end}}]$ where $t_{\text{end}} - t_{\text{start}} = D_{\text{pause}} > 0$ and $b_{\text{start}} == b_{\text{end}} == b_{\text{pause}}$:
   $$\text{Beat}(t_{\text{audio}}) = b_{\text{pause}}$$
   (The visual cursor remains locked to the paused beat while audio plays through the stop duration).
2. **Linear Progression Segment:** If $t_{\text{unoffset}} \in [t_i, t_{i+1}]$ with active tempo $\text{BPM}_i$:
   $$\text{Beat}(t_{\text{audio}}) = b_i + (t_{\text{unoffset}} - t_i) \times \frac{\text{BPM}_i}{60.0}$$
3. **Pre-Beat 0 Extrapolation ($t_{\text{unoffset}} < 0$):**
   $$\text{Beat}(t_{\text{audio}}) = t_{\text{unoffset}} \times \frac{\text{BPM}_0}{60.0}$$

---

### 4.3 Deterministic Event Precedence
When multiple timing events share the exact same row/beat, StepMania resolves them in strict order:
1. `FOUND_WARP_DESTINATION`: Warp interval concludes; normal progression resumes.
2. `FOUND_BPM_CHANGE`: New tempo takes effect immediately.
3. `FOUND_DELAY`: Pre-note pause executes.
4. `FOUND_MARKER`: Step judgment point reached ($t_{\text{marker}}$ recorded).
5. `FOUND_STOP`: Post-note pause executes.
6. `FOUND_WARP`: Warp interval begins.

### 4.4 Legacy Normalization Rules
- **Negative Stops (`#STOPS:beat=-duration;`):** Converted to Warps:
  $$\text{WarpLength} = |\text{duration}| \times \frac{\text{BPM}}{60.0}$$
- **Negative BPMs (`#BPMS:beat=-bpm;`):** Converted into a forward warp extending from `beat` to the next positive BPM change.
- **Stops Prior to Beat 0 ($b < 0$):** Shift the song offset: $\text{OFFSET}_{\text{new}} = \text{OFFSET}_{\text{old}} - \text{duration}$.
- **Overlapping Warps:** Contiguous or overlapping warp intervals are coalesced into a single merged span $[b_{\min}, \max(b_w + L_w)]$.

---

## 5. Desktop Editing Interactions & Keyboard Shortcuts (ArrowVortex Conventions)

### 5.1 Primary Desktop Keybinding Map
| Key Combination | Category | Action / Behavior |
|---|---|---|
| `Space` | Playback | Play / Pause audio playback at current cursor position. |
| `Up Arrow` | Navigation | Move cursor forward by 1 snap step (active subdivision). |
| `Down Arrow` | Navigation | Move cursor backward by 1 snap step. |
| `Page Up` | Navigation | Jump cursor forward by 1 full measure (4 beats). |
| `Page Down` | Navigation | Jump cursor backward by 1 full measure (4 beats). |
| `Home` | Navigation | Jump to beat 0.0 (song start). |
| `End` | Navigation | Jump to the last note in the chart. |
| `Left Arrow` | Quantization | Step snap finer (e.g. 4th -> 8th -> 12th -> 16th -> 24th -> 32nd -> 48th -> 64th -> 96th -> 192nd). |
| `Right Arrow` | Quantization | Step snap coarser (e.g. 192nd -> ... -> 4th). |
| `Shift + Left Arrow` | Playback Rate | Decrease playback rate (1.0x -> 0.75x -> 0.5x -> 0.25x). |
| `Shift + Right Arrow`| Playback Rate | Increase playback rate (1.0x -> 1.25x -> 1.5x -> 2.0x). |
| `Numpad +` / `Numpad -` | View / Zoom | Zoom in / out waveform and beat grid (1x to 64x). |
| `Ctrl + Mouse Wheel` | View / Zoom | Dynamic continuous zoom centered at mouse cursor. |
| `Mouse Wheel` | Navigation | Smooth timeline scrolling with snap quantization. |
| `Shift + Mouse Wheel`| Navigation | Micro-scrubbing (free 192-tick motion ignoring snap). |
| `1, 2, 3, 4` | Singles Note Entry | Place/remove tap note on Left (1), Down (2), Up (3), Right (4). |
| `Hold 1-4 + Up/Down` | Singles Holds | Create Hold note: hold key while scrolling to extend tail. |
| `Shift + 1, 2, 3, 4` | Singles Mines | Place/remove Mine ('M') on selected column. |
| `Alt + 1, 2, 3, 4` | Singles Lifts | Place/remove Lift note ('L') on selected column. |
| `Ctrl + 1, 2, 3, 4` | Singles Fakes | Place/remove Fake note ('F') on selected column. |
| `` ` `` (Backtick) | Note Modifier | Convert selected Hold note into a Roll note ('4'). |
| `Delete` / `Backspace`| Editing | Remove note under cursor / delete active selection. |
| `Tab` | Selection | Set selection start anchor / set selection end anchor. |
| `Shift + Click` | Selection | Range select between cursor and clicked measure tick. |
| `Ctrl + A` | Selection | Select all notes in active chart. |
| `Ctrl + C` | Clipboard | Copy selected note pattern to clipboard. |
| `Ctrl + X` | Clipboard | Cut selected note pattern. |
| `Ctrl + V` | Clipboard | Paste clipboard pattern at current cursor position. |
| `M` | Pattern Transform | Mirror selection horizontally (Left <-> Right, Down <-> Up). |
| `Shift + M` | Pattern Transform | Invert selection vertically (Up <-> Down). |
| `Q` | Quantize | Snap selected off-grid notes to closest active snap division. |
| `Ctrl + Z` | History | Undo last editing action. |
| `Ctrl + Y` / `Ctrl+Shift+Z` | History | Redo last undone editing action. |
| `F4` | Audio / Assist | Toggle Metronome click / Note Tick sound during playback. |
| `F5` | Chart Navigation | Switch to Previous difficulty / chart in simfile. |
| `F6` | Chart Navigation | Switch to Next difficulty / chart in simfile. |
| `Shift + T` | Timing Dialog | Open Tempo & BPM Changes management window. |
| `Shift + S` | Timing Dialog | Open Beat Synchronization & Offset calibration wizard. |
| `Shift + P` | Simfile Properties| Open Simfile Properties dialog (Metadata, Audio paths). |
| `Shift + N` | Chart Management | Create New Stepchart prompt (Mode, Difficulty, Meter). |
| `Ctrl + S` | File I/O | Lossless save simfile to disk (`.ssc` / `.sm`). |

### 5.2 8-Panel Doubles Mapping Schemes
In `dance-double` mode, the editor must support 8 independent columns. Three user-selectable keybinding schemes must be provided:
1. **Direct Number Row Scheme (Default):**
   - Keys `1, 2, 3, 4` map to Player 1 (`Left, Down, Up, Right`).
   - Keys `5, 6, 7, 8` map to Player 2 (`Left, Down, Up, Right`).
2. **Dual-Hand Home Row Ergonomic Scheme:**
   - Left Hand: `A` (P1-Left), `S` (P1-Down), `D` (P1-Up), `F` (P1-Right).
   - Right Hand: `J` (P2-Left), `K` (P2-Down), `L` (P2-Up), `;` (P2-Right).
3. **Numpad Dual-Pad Scheme:**
   - Left Pad: Numpad `7` (P1-L), `4` (P1-D), `8` (P1-U), `5` (P1-R).
   - Right Pad: Numpad `1` (P2-L), `2` (P2-D), `3` (P2-U), `6` (P2-R).

---

## 6. Mobile Touch Interaction Model (375px to 430px Viewports)

### 6.1 Viewport Targets & Responsive Architecture
Mobile viewports must strictly eliminate horizontal scrolling and ensure zero overlapping interactive components across:
- **375px:** iPhone SE (3rd Gen), iPhone 8 (compact).
- **390px:** iPhone 12 / 13 / 14 / 15 / 16 (standard).
- **430px:** iPhone 14 / 15 / 16 Pro Max / Plus (large).

Touch target minimum size: **48x48 px** (meeting WCAG 2.5.5 and Apple Human Interface Guidelines).

```
+-------------------------------------------------------------+
| Top HUD Bar (44px): Title, BPM badge, Time/Beat display     |
+-------------------------------------------------------------+
| Audio Waveform & Spectrogram Scrub Strip (48px)             |
+-------------------------------------------------------------+
|                                                             |
| Vertical Scrolling Stage & Beat Grid Canvas                 |
| - High-contrast DAW aesthetic (#0C0D12 background)          |
| - Static receptors near bottom (Y = H - 240px)              |
| - Up-scrolling or Down-scrolling notes                      |
| - Biomechanical foot parity ribbon (Left/Right)             |
|                                                             |
+-------------------------------------------------------------+
| Note Type Selector Toolbar (36px):                          |
| [TAP]  [HOLD]  [ROLL]  [MINE]  [LIFT]  [FAKE]  [DEL]        |
+-------------------------------------------------------------+
| On-Screen Directional Touch Pad (120px):                    |
| [  <  ]      [  v  ]      [  ^  ]      [  >  ]              |
+-------------------------------------------------------------+
| Bottom Dock (48px): Play/Pause | Snap (1/16) | AI Tool | Menu|
+-------------------------------------------------------------+
```

### 6.2 Mobile Interaction Component Specifications

#### 1. On-Screen Directional Touch Pads
- **Singles Mode (4 Panels):**
  - 4 large tactile buttons arranged in a horizontal grid across the width.
  - Button width: ~84px on 375px screens, ~94px on 430px screens. Height: 72px.
  - High-contrast visual state: Dark grey (`#1F2434`), neon border accent when pressed.
  - Insertion logic: Pressing a pad inserts a note of the currently active *Note Type* at the current cursor row and triggers a crisp 10ms haptic feedback (`navigator.vibrate(10)`).
- **Doubles Mode (8 Panels):**
  - Toggleable Dual-Bank layout: A segmented switch `[ Pad 1 (P1) | Pad 2 (P2) ]` allows 1-tap switching between Player 1 and Player 2 pads while keeping full-width 4-panel touch ergonomics.
  - Full-8 Compact mode: Two rows of 4 buttons (Row 1: P1 Left/Down/Up/Right; Row 2: P2 Left/Down/Up/Right) with 48px height per button.

#### 2. Segmented Note Type Selector
- Positioned immediately above the directional touch pads.
- Horizontal pill strip with active state indicator:
  - `TAP` ('1'): Standard tap insertion.
  - `HOLD` ('2'/'3'): Tap pad at start row to drop head '2'; drag timeline to end row and tap pad again to drop tail '3'.
  - `ROLL` ('4'/'3'): Drops roll head '4' and terminates at tail '3'.
  - `MINE` ('M'): Drops mine at cursor row.
  - `LIFT` ('L'): Drops lift note at cursor row.
  - `FAKE` ('F'): Drops unjudged fake note at cursor row.
  - `DEL`: Tapping pad removes any note at the current cursor row.

#### 3. Timeline Scrub Bar & Gesture Navigation
- **Waveform Scrub Bar:** Positioned at the top or pinned to the right edge. Dragging scrubbing thumb scrubs audio and advances beat position instantaneously.
- **Pinch-to-Zoom:** Two-finger vertical/diagonal pinch on the canvas scales beat grid zoom factor from 1x to 64x without layout reflow.
- **Swipe-to-Step:** Swiping up/down on the canvas scrolls by exact snap increments.
- **Floating Step Controls:** Quick `[-Snap]` and `[+Snap]` nudge buttons on the floating dock for precise single-subdivision adjustments.

#### 4. Slide-Up Adaptive Drawer Controls
A swipeable bottom drawer (sheet) offering:
- **Playback & Speed Panel:** Play/pause, audio volume, speed mods (`C400`, `C600`, `1.5x XMod`), and playback rate (0.25x - 2.0x).
- **Timing & Calibration Panel:** Real-time visual tap-tempo button, manual BPM editor, Offset micro-adjuster ($\pm 1\text{ ms}$ buttons).
- **Stepper AI Conditioning Drawer:** Continuous utilitarian sliders for the 16-dimensional `z_tech` vector (crossover density, bracket ratio, jack frequency, stream speed, footswitch rate) with live preview and diff overlay.
- **Biomechanical Inspector:** Displays real-time alternation %, crossover count, physical unplayability warnings, and foot parity color toggle (`#00b0ff` Left Foot, `#ff3366` Right Foot).

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | MSD Lexer | Parameter Parsing | Tokenizes `#TAG:VAL1:VAL2;` blocks with escape characters | File stream / string | List of `MSDTag` records | Implicit tag close if `#` on newline | `src/MsdFile.cpp` |
| 2 | File Format | Legacy `.sm` Parser | Parses 6-param `#NOTES:` and global song headers | `.sm` simfile | `Simfile` AST with global timing | Omission of `#TITLE`, `#BPMS`, `#OFFSET` causes error | `stepper/data/chart_parser.py` |
| 3 | File Format | Modern `.ssc` Parser | Parses `#NOTEDATA:;` blocks with per-chart split timing | `.ssc` simfile | `Simfile` AST with per-chart timing | Missing `#VERSION` treated as legacy | `src/NotesLoaderSSC.cpp` |
| 4 | Grid System | 192-Tick Fixed Grid | 48 ticks/beat, 192 ticks/measure representation | Musical beat `float` | Integer row `int` | Rounding to nearest tick | `stepper/timing/events.py` |
| 5 | Measure Opt | Line Minimization | `GetSmallestNoteTypeForMeasure` minimizes lines to $N \in \{4..192\}$ | Measure tick set | Minimal row count $N$ | Defaults to 4 lines if empty | `stepper/export/measure_util.py` |
| 6 | Game Modes | Dance Singles | 4-column mapping (Left, Down, Up, Right) | 4-char chord string | Column placement | Discards chars past 4 | `src/NoteTypes.h` |
| 7 | Game Modes | Dance Doubles | 8-column mapping across Player 1 and Player 2 | 8-char chord string | 8-column layout | Pad truncation/padding | `src/NoteData.h` |
| 8 | Note Types | Taps & Mines | Standard taps ('1') and hazard shock notes ('M') | Column index, row | Note event | Detonates on $\pm 180\text{ ms}$ contact | `src/NoteTypes.h` |
| 9 | Note Types | Holds & Rolls | Sustained holds ('2'..'3') and active rolls ('4'..'3') | Start row, end row | `HoldNote` record | Discards orphan '3'; clamps unclosed head | `stepper/data/chart_parser.py` |
| 10 | Note Types | Lifts & Fakes | Release notes ('L') and unjudged decoys ('F') | Note character | Unjudged/lift flag | Lifts fail if not released | `src/NoteTypes.h` |
| 11 | Aesthetics | Quantization Colors | Canonical hues for 4th, 8th, 12th, 16th, 24th, 32nd, 48th, 64th, 96th, 192nd | Beat timestamp | Hex color code | Defaults to 192nd color for off-grid | `stepper/preview/preview_generator.py`|
| 12 | Aesthetics | Foot Parity Colors | Biomechanical Left foot (`#00b0ff`) and Right foot (`#ff3366`) | Foot assignment | Visual annotation | Falls back to `#ffffff` for unresolved | `stepper/preview/preview_generator.py`|
| 13 | Timing Math | Bi-directional Engine | Exact conversion between audio seconds and musical beats | Seconds or Beat | Exact mapped coordinate | Pinned to beat during stop plateau | `stepper/timing/engine.py` |
| 14 | Timing Math | Event Precedence | Resolves simultaneous Warp, BPM, Delay, Marker, Stop | Conflicting events | Deterministic simulation order | Strictly ordered priorities 1-6 | `src/TimingData.cpp` |
| 15 | Desktop UI | ArrowVortex Controls | Keyboard shortcuts for numpad, arrows, space, note types | Keyboard events | Viewport/chart mutations | Ignores invalid modifier combinations | ArrowVortex primary documentation |
| 16 | Mobile UI | Touch-Optimized Pads | Responsive directional touch pads for 375px-430px screens | Touch events | Note insertions with haptics | Constrained to active viewport | Mobile HIG & CSS specs |
| 17 | Mobile UI | Segmented Note Tool | Touch toolbar selecting Tap, Hold, Roll, Mine, Lift, Fake | Touch tap | Active placement mode | Clamped to supported enum | Mobile interaction model |
| 18 | Mobile UI | Adaptive Drawers | Slide-up sheet for timing, AI conditioning, and validator | Drawer swipe/touch | Modal panel exposure | Prevents canvas obstruction | Modern web design standards |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Lexer Recovery | Line starting with unescaped `#` before previous tag closed | Lexer closes previous tag implicitly, emits warning, begins new tag. |
| 2 | Timing Engine | Negative Stop duration (e.g. `#STOPS:4.000=-1.500;`) | Converted to Warp: $\text{WarpLength} = |\text{duration}| \times \text{BPM} / 60.0$. |
| 3 | Timing Engine | Stop prior to beat 0.0 (e.g. `#STOPS:-4.000=2.000;`) | Absorbed into song offset: $\text{OFFSET}_{\text{new}} = \text{OFFSET} - \text{duration}$. |
| 4 | Timing Engine | Negative BPM value (e.g. `#BPMS:4.000=-120.000;`) | Converted to a Warp spanning to the next positive BPM change. |
| 5 | Timing Engine | Overlapping Warps (e.g. Warp at 4 len 4, Warp at 6 len 4) | Coalesced into a single contiguous warp span $[4.0, 10.0]$. |
| 6 | Timing Engine | Querying audio time during Stop plateau $[t_{\text{stop}}, t_{\text{stop}} + D]$ | Returns the exact pause beat; beat advancement is frozen. |
| 7 | Note Parser | Orphan hold tail `'3'` without preceding `'2'` or `'4'` | Tail is safely discarded without corrupting measure streams. |
| 8 | Note Parser | Unclosed hold head `'2'` at the very end of chart | Parser clamps tail to $\max(r_{\text{head}} + 48, r_{\text{last}})$. |
| 9 | Measure Formatter| Measure containing non-standard micro-tick (e.g. row 5) | Minimizer falls back to 192 lines ($S = 1$) to avoid quantizing error. |
| 10 | Measure Formatter| Entirely empty measure | Emits minimal 4 lines of `0000` ($N = 4, S = 48$). |
| 11 | Mobile Touch | Simultaneous multi-touch on two directional pads (jump chord) | Touch event listener handles multi-touch inputs, placing simultaneous tap notes. |
| 12 | Mobile Viewport | Ultra-compact 375px viewport with 8-panel Doubles chart | Swappable dual-bank drawer prevents buttons shrinking below 48x48px target. |
