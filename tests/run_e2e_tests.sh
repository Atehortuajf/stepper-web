#!/usr/bin/env bash
set -e

# ==============================================================================
# Stepper-Web E2E Test Suite Runner
# Supports Tiers 1-5, multi-viewport projects, and visual screenshot reporting.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SCREENSHOT_DIR="${ROOT_DIR}/output/screenshots"

TIER=""
PROJECT=""
LINT_ONLY=false

usage() {
  echo "Usage: $0 [OPTIONS]"
  echo "Options:"
  echo "  --tier <1|2|3|4|5>       Run specific test tier"
  echo "  --project <desktop|mobile> Run tests for specific viewport project"
  echo "  --lint-only              Verify syntax, fixtures, and manifests without running tests"
  echo "  --help                   Show this help message"
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tier)
      TIER="$2"
      shift 2
      ;;
    --project)
      PROJECT="$2"
      shift 2
      ;;
    --lint-only)
      LINT_ONLY=true
      shift
      ;;
    --help)
      usage
      ;;
    *)
      echo "Unknown option: $1"
      usage
      ;;
  esac
done

echo "======================================================================"
echo " Stepper-Web E2E Test Suite Runner"
echo " Working Directory: ${ROOT_DIR}"
echo " Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "======================================================================"

# Step 1: Pre-flight environment validation
echo "[1/4] Validating environment and dependencies..."
command -v node >/dev/null 2>&1 || { echo "ERROR: node is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "ERROR: npm is required but not installed."; exit 1; }

# Step 2: Validate test fixtures and manifests
echo "[2/4] Validating test fixtures in ${ROOT_DIR}/tests/fixtures..."
FIXTURE_MANIFEST="${ROOT_DIR}/tests/fixtures/fixtures_manifest.json"
if [[ ! -f "${FIXTURE_MANIFEST}" ]]; then
  echo "ERROR: Fixtures manifest not found at ${FIXTURE_MANIFEST}"; exit 1;
fi

# Verify audio WAV file
WAV_FILE="${ROOT_DIR}/tests/fixtures/sample_click_track.wav"
if [[ ! -f "${WAV_FILE}" ]]; then
  echo "Generating sample audio click track..."
  python3 -c "
import wave, struct, math
sr = 44100; bpm = 140.0; beats = 8; dur = (beats * 60.0) / bpm; total = int(sr * dur); interval = int(sr * 60.0 / bpm)
samples = [0] * total; click = int(sr * 0.02)
for b in range(beats):
  start = b * interval; freq = 1000.0 if b % 4 == 0 else 800.0
  for i in range(click):
    if start + i < total:
      t = float(i) / sr; samples[start + i] = int(math.exp(-t * 200.0) * math.sin(2.0 * math.pi * freq * t) * 28000.0)
with wave.open('${WAV_FILE}', 'wb') as w:
  w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(struct.pack('<' + 'h' * total, *samples))
"
fi

mkdir -p "${SCREENSHOT_DIR}"

if [[ "${LINT_ONLY}" == true ]]; then
  echo "[LINT-ONLY] Fixtures and environment verified successfully."
  exit 0
fi

# Step 3: Configure test execution targets
echo "[3/4] Building Playwright test execution arguments..."
PW_ARGS=()

if [[ -n "${PROJECT}" ]]; then
  if [[ "${PROJECT}" == "desktop" ]]; then
    PW_ARGS+=("--project=desktop-chrome")
  elif [[ "${PROJECT}" == "mobile" ]]; then
    PW_ARGS+=("--project=mobile-iphone")
  else
    echo "ERROR: Unknown project '${PROJECT}'. Must be 'desktop' or 'mobile'."
    exit 1
  fi
fi

if [[ -n "${TIER}" ]]; then
  case "${TIER}" in
    1) PW_ARGS+=("tests/e2e/tier1_feature_coverage.spec.ts") ;;
    2) PW_ARGS+=("tests/e2e/tier2_boundary_corner.spec.ts") ;;
    3) PW_ARGS+=("tests/e2e/tier3_cross_feature.spec.ts") ;;
    4) PW_ARGS+=("tests/e2e/tier4_real_world.spec.ts") ;;
    5) PW_ARGS+=("tests/e2e/tier5_adversarial_screenshots.spec.ts") ;;
    *) echo "ERROR: Unknown tier '${TIER}'. Must be 1, 2, 3, 4, or 5."; exit 1 ;;
  esac
fi

# Step 4: Execute Playwright test suite
echo "[4/4] Executing Playwright E2E test suite..."
cd "${ROOT_DIR}"
npx playwright test "${PW_ARGS[@]}"

echo "======================================================================"
echo " All tests executed successfully!"
echo " Screenshots directory: ${SCREENSHOT_DIR}"
ls -lh "${SCREENSHOT_DIR}"
echo "======================================================================"
