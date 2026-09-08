"""
backend.app.core.parity_solver
Biomechanical Viterbi foot parity solver bridge.
Wraps ViterbiFootSolver from stepper.validate.viterbi_solver to analyze foot sequences,
ergonomic transition costs, and physical playability for 4-panel dance charts.
"""

from typing import Any, Dict, List, Optional, Tuple, Union

try:
    from stepper.validate.viterbi_solver import ViterbiFootSolver, ViterbiSolverResult, FootPlacement
    from stepper.data.chart_parser import NoteRow, HoldNote
except ImportError:
    from pathlib import Path
    import sys
    STEPPER_REF = Path("/Users/ate/Projects/Stepper")
    if STEPPER_REF.exists() and str(STEPPER_REF) not in sys.path:
        sys.path.insert(0, str(STEPPER_REF))
    from stepper.validate.viterbi_solver import ViterbiFootSolver, ViterbiSolverResult, FootPlacement
    from stepper.data.chart_parser import NoteRow, HoldNote

from backend.app.schemas.parity import (
    SolveParityRequest,
    SolveParityResponse,
    AnnotatedStep,
    StepFlags,
    ParityStats,
)


def extract_holds_from_notes(notes: List[Dict[str, Any]]) -> List[HoldNote]:
    """
    Pairs hold heads ('2' or '4') with hold releases ('3') per column track.
    Handles unclosed holds gracefully by closing at track end.
    """
    active_holds: Dict[int, Tuple[int, float, bool]] = {}  # track -> (start_row, start_beat, is_roll)
    holds: List[HoldNote] = []

    for item in notes:
        b = float(item["beat"])
        arr = str(item["arrows"])
        row = int(round(b * 48.0))

        for track, char in enumerate(arr[:4]):
            if char in ("2", "4"):
                # Start of hold/roll
                active_holds[track] = (row, b, char == "4")
            elif char == "3":
                # Release
                if track in active_holds:
                    start_row, start_b, is_roll = active_holds.pop(track)
                    holds.append(
                        HoldNote(
                            track=track,
                            start_row=start_row,
                            end_row=row,
                            start_beat=start_b,
                            end_beat=b,
                            is_roll=is_roll,
                        )
                    )

    # Close any unclosed holds
    last_b = float(notes[-1]["beat"]) if notes else 0.0
    last_row = int(round(last_b * 48.0))
    for track, (start_row, start_b, is_roll) in active_holds.items():
        holds.append(
            HoldNote(
                track=track,
                start_row=start_row,
                end_row=max(last_row, start_row + 48),
                start_beat=start_b,
                end_beat=max(last_b, start_b + 1.0),
                is_roll=is_roll,
            )
        )

    return holds


def solve_parity(request: SolveParityRequest) -> SolveParityResponse:
    """
    Solves biomechanical foot sequence and playability for the given notes.
    """
    if not request.notes:
        return SolveParityResponse(
            is_playable=True,
            total_cost=0.0,
            foot_sequence=[],
            annotated_steps=[],
            stats=ParityStats(
                total_steps=0,
                alternation_rate=1.0,
                crossovers=0,
                candles=0,
                footswitches=0,
                holdswitches=0,
                double_steps=0,
                jacks=0,
                brackets=0,
            ),
        )

    # 1. Convert input notes to NoteRows
    raw_notes = [{"beat": n.beat, "arrows": n.arrows} for n in request.notes]
    raw_notes.sort(key=lambda x: x["beat"])

    note_rows: List[NoteRow] = []
    for n in raw_notes:
        b = float(n["beat"])
        arr = str(n["arrows"])
        row = int(round(b * 48.0))
        note_rows.append(NoteRow(row=row, beat=b, arrows=arr))

    # 2. Extract hold notes
    holds = extract_holds_from_notes(raw_notes)

    # 3. Extract BPMs
    bpm_tuples: List[Tuple[float, float]] = [(0.0, 120.0)]
    if request.bpms:
        bpm_tuples = [(float(b.beat), float(b.bpm)) for b in request.bpms]
        bpm_tuples.sort(key=lambda x: x[0])
        if not bpm_tuples or bpm_tuples[0][0] != 0.0:
            first_bpm = bpm_tuples[0][1] if bpm_tuples else 120.0
            bpm_tuples.insert(0, (0.0, first_bpm))

    # 4. Execute Viterbi solver
    solver = ViterbiFootSolver(difficulty_meter=request.difficulty_meter or 9)
    result: ViterbiSolverResult = solver.solve(
        note_rows=note_rows,
        holds=holds,
        bpms=bpm_tuples,
    )

    # 5. Format annotated steps
    annotated: List[AnnotatedStep] = []
    foot_seq: List[str] = []

    for p in result.placements:
        warning: Optional[str] = None
        if not result.is_physically_playable:
            warning = "Physically unplayable transition"
        elif p.is_double_step:
            warning = "Double step"
        elif p.is_jack:
            warning = "Jack"

        flags = StepFlags(
            is_crossover=p.is_crossover,
            crossover_type=p.crossover_type,
            is_candle=p.is_candle,
            is_double_step=p.is_double_step,
            is_jack=p.is_jack,
            is_bracket=p.is_bracket,
            is_footswitch=p.is_footswitch,
            is_holdswitch=p.is_holdswitch,
        )

        left_pos = list(p.left_pos) if isinstance(p.left_pos, tuple) else p.left_pos
        right_pos = list(p.right_pos) if isinstance(p.right_pos, tuple) else p.right_pos

        annotated.append(
            AnnotatedStep(
                beat=p.beat,
                arrows=p.arrows,
                foot=p.foot,
                cost=0.0,  # aggregated in total_cost
                warning=warning,
                left_pos=left_pos,
                right_pos=right_pos,
                flags=flags,
            )
        )
        foot_seq.append(p.foot)

    stats = None
    if result.stats:
        stats = ParityStats(
            total_steps=int(result.stats.get("total_steps", len(annotated))),
            alternation_rate=round(float(result.stats.get("alternation_rate", 1.0)), 3),
            crossovers=int(result.stats.get("crossovers", 0)),
            candles=int(result.stats.get("candles", 0)),
            footswitches=int(result.stats.get("footswitches", 0)),
            holdswitches=int(result.stats.get("holdswitches", 0)),
            double_steps=int(result.stats.get("double_steps", 0)),
            jacks=int(result.stats.get("jacks", 0)),
            brackets=int(result.stats.get("brackets", 0)),
        )

    return SolveParityResponse(
        is_playable=result.is_physically_playable,
        total_cost=round(float(result.total_cost), 4),
        foot_sequence=foot_seq,
        annotated_steps=annotated,
        stats=stats,
    )
