/**
 * frontend/src/editor/ui/noteskins/celNoteskin.ts
 * High-performance, tournament-grade Cel Noteskin Canvas Engine.
 *
 * Implements the iconic Cel-shaded dance game arrow styling:
 * - Directional 45-degree swept chevrons with dark outer contour
 * - Dual-tone specular highlights and drop-shadow bevels
 * - 10-tier subdivision color mapping (4th red, 8th blue, 12th purple, 16th yellow, etc.)
 * - Target receptors with metallic frames and luminous active flash
 * - Authentic Cel spiked mines, hollow lifts, translucent fakes, and hold/roll bodies
 *
 * Backed by pre-rendered 1024x1024 sprite atlas with Path2D vector fallback.
 */

import type { SubdivisionTier } from '../../engine/types';
import { SUBDIVISION_COLORS } from '../../engine/subdivisions';

export const CEL_FRAME_SIZE = 128;
export const CEL_ATLAS_SIZE = 1024;

// Direction index: 0 = Left, 1 = Down, 2 = Up, 3 = Right
export type DirectionCol = 0 | 1 | 2 | 3;

export interface AtlasCoord {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

// Map subdivision tier to atlas row & col offset
// Row 0: 4th (cols 0..3) & 8th (cols 4..7)
// Row 1: 12th (cols 0..3) & 16th (cols 4..7)
// Row 2: 24th (cols 0..3) & 32nd (cols 4..7)
// Row 3: 48th (cols 0..3) & 64th (cols 4..7)
// Row 4: 96th (cols 0..3) & 192nd (cols 4..7)
const SUBDIVISION_ATLAS_MAP: Record<SubdivisionTier, { row: number; colOffset: number }> = {
  4: { row: 0, colOffset: 0 },
  8: { row: 0, colOffset: 4 },
  12: { row: 1, colOffset: 0 },
  16: { row: 1, colOffset: 4 },
  24: { row: 2, colOffset: 0 },
  32: { row: 2, colOffset: 4 },
  48: { row: 3, colOffset: 0 },
  64: { row: 3, colOffset: 4 },
  96: { row: 4, colOffset: 0 },
  192: { row: 4, colOffset: 4 },
};

/**
 * Returns sprite coordinates in cel_atlas.png for a given note
 */
export function getCelNoteCoord(tier: SubdivisionTier, col: number): AtlasCoord {
  const mapping = SUBDIVISION_ATLAS_MAP[tier] || SUBDIVISION_ATLAS_MAP[4];
  const col4 = ((col % 4) + 4) % 4;
  const colIndex = mapping.colOffset + col4;
  return {
    sx: colIndex * CEL_FRAME_SIZE,
    sy: mapping.row * CEL_FRAME_SIZE,
    sw: CEL_FRAME_SIZE,
    sh: CEL_FRAME_SIZE,
  };
}

/**
 * Returns receptor coordinates in cel_atlas.png
 * Row 5: cols 0..3 unpressed, cols 4..7 active/pressed
 */
export function getCelReceptorCoord(col: number, isPressed: boolean): AtlasCoord {
  const col4 = ((col % 4) + 4) % 4;
  const colIndex = isPressed ? 4 + col4 : col4;
  return {
    sx: colIndex * CEL_FRAME_SIZE,
    sy: 5 * CEL_FRAME_SIZE,
    sw: CEL_FRAME_SIZE,
    sh: CEL_FRAME_SIZE,
  };
}

/**
 * Special note sprite coordinates in cel_atlas.png
 */
export const CEL_SPECIAL_COORDS = {
  // Row 6
  lift: (col: number): AtlasCoord => ({
    sx: (((col % 4) + 4) % 4) * CEL_FRAME_SIZE,
    sy: 6 * CEL_FRAME_SIZE,
    sw: CEL_FRAME_SIZE,
    sh: CEL_FRAME_SIZE,
  }),
  holdCap: (col: number): AtlasCoord => ({
    sx: (4 + (((col % 4) + 4) % 4)) * CEL_FRAME_SIZE,
    sy: 6 * CEL_FRAME_SIZE,
    sw: CEL_FRAME_SIZE,
    sh: CEL_FRAME_SIZE,
  }),
  // Row 7
  mine: (): AtlasCoord => ({
    sx: 0,
    sy: 7 * CEL_FRAME_SIZE,
    sw: CEL_FRAME_SIZE,
    sh: CEL_FRAME_SIZE,
  }),
  holdBody: (): AtlasCoord => ({
    sx: 1 * CEL_FRAME_SIZE,
    sy: 7 * CEL_FRAME_SIZE,
    sw: CEL_FRAME_SIZE,
    sh: CEL_FRAME_SIZE,
  }),
  rollBody: (): AtlasCoord => ({
    sx: 2 * CEL_FRAME_SIZE,
    sy: 7 * CEL_FRAME_SIZE,
    sw: CEL_FRAME_SIZE,
    sh: CEL_FRAME_SIZE,
  }),
  fake: (): AtlasCoord => ({
    sx: 3 * CEL_FRAME_SIZE,
    sy: 7 * CEL_FRAME_SIZE,
    sw: CEL_FRAME_SIZE,
    sh: CEL_FRAME_SIZE,
  }),
  ghost: (col: number): AtlasCoord => ({
    sx: (4 + (((col % 4) + 4) % 4)) * CEL_FRAME_SIZE,
    sy: 7 * CEL_FRAME_SIZE,
    sw: CEL_FRAME_SIZE,
    sh: CEL_FRAME_SIZE,
  }),
};

// Singleton Atlas Image Cache
let atlasImage: HTMLImageElement | null = null;
let atlasLoaded = false;

export function loadCelAtlas(basePath = ''): HTMLImageElement | null {
  if (atlasLoaded && atlasImage) return atlasImage;
  if (typeof window === 'undefined' || typeof Image === 'undefined') return null;

  if (!atlasImage) {
    atlasImage = new Image();
    const cleanBase = basePath.endsWith('/') ? basePath : basePath ? `${basePath}/` : '';
    atlasImage.src = `${cleanBase}noteskins/cel/cel_atlas.png`;
    atlasImage.onload = () => {
      atlasLoaded = true;
    };
    atlasImage.onerror = () => {
      // Fallback relative path check
      if (atlasImage && !atlasImage.src.includes('./')) {
        atlasImage.src = './noteskins/cel/cel_atlas.png';
      }
    };
  }
  return atlasImage;
}

// Automatically trigger load on browser entry
if (typeof window !== 'undefined') {
  try {
    loadCelAtlas();
  } catch {
    // Ignore in non-browser environments
  }
}

/**
 * Fallback vector Cel arrow drawing via Path2D for headless / unit testing
 */
function drawVectorCelArrow(
  ctx: CanvasRenderingContext2D,
  col: number,
  x: number,
  y: number,
  size: number,
  color: string,
  isHollow = false,
  alpha = 1.0
) {
  ctx.save();
  ctx.translate(x, y);
  // Rotation for col: 0 = Left (270 deg / -90 deg), 1 = Down (180 deg), 2 = Up (0 deg), 3 = Right (90 deg)
  const rotMap = [-Math.PI / 2, Math.PI, 0, Math.PI / 2];
  ctx.rotate(rotMap[col % 4]);
  ctx.globalAlpha = alpha;

  const s = size / 100;
  ctx.scale(s, s);

  // Outer cel arrow polygon
  ctx.beginPath();
  ctx.moveTo(0, -46);       // Tip pointing UP
  ctx.lineTo(46, 12);       // Right wingtip
  ctx.lineTo(18, 12);       // Right inner elbow
  ctx.lineTo(18, 44);       // Right tail bottom
  ctx.lineTo(-18, 44);      // Left tail bottom
  ctx.lineTo(-18, 12);      // Left inner elbow
  ctx.lineTo(-46, 12);      // Left wingtip
  ctx.closePath();

  if (isHollow) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    // Cel body fill
    ctx.fillStyle = color;
    ctx.fill();

    // Dark contour
    ctx.strokeStyle = '#111319';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Top-left highlight facet
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -42);
    ctx.lineTo(-42, 10);
    ctx.stroke();

    // Inner shaft lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, 22);
    ctx.lineTo(12, 22);
    ctx.moveTo(-12, 34);
    ctx.lineTo(12, 34);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Primary Canvas Drawer: Renders a Cel note at (x, y) with specified size and subdivision
 */
export function drawCelArrow(
  ctx: CanvasRenderingContext2D,
  col: number,
  x: number,
  y: number,
  size: number,
  tier: SubdivisionTier,
  noteType: '1' | '2' | '4' | 'F' = '1',
  isGhost = false
): void {
  const atlas = loadCelAtlas();
  const half = size / 2;

  if (atlas && atlas.complete && atlas.naturalWidth > 0) {
    let coord: AtlasCoord;
    if (isGhost) {
      coord = CEL_SPECIAL_COORDS.ghost(col);
    } else if (noteType === 'F') {
      coord = CEL_SPECIAL_COORDS.fake();
    } else {
      coord = getCelNoteCoord(tier, col);
    }

    ctx.drawImage(
      atlas,
      coord.sx,
      coord.sy,
      coord.sw,
      coord.sh,
      x - half,
      y - half,
      size,
      size
    );
  } else {
    // High-fidelity vector fallback
    const color = SUBDIVISION_COLORS[tier] || '#FF2A55';
    drawVectorCelArrow(
      ctx,
      col,
      x,
      y,
      size,
      color,
      false,
      isGhost ? 0.45 : noteType === 'F' ? 0.5 : 1.0
    );
  }
}

/**
 * Draws a Cel target receptor arrow
 */
export function drawCelReceptor(
  ctx: CanvasRenderingContext2D,
  col: number,
  x: number,
  y: number,
  size: number,
  isPressed: boolean
): void {
  const atlas = loadCelAtlas();
  const half = size / 2;

  if (atlas && atlas.complete && atlas.naturalWidth > 0) {
    const coord = getCelReceptorCoord(col, isPressed);
    ctx.drawImage(
      atlas,
      coord.sx,
      coord.sy,
      coord.sw,
      coord.sh,
      x - half,
      y - half,
      size,
      size
    );
  } else {
    // Vector fallback for receptor
    const baseColor = isPressed ? '#FFFFFF' : '#4A5268';
    drawVectorCelArrow(ctx, col, x, y, size, baseColor, !isPressed, isPressed ? 1.0 : 0.85);
  }
}

/**
 * Draws a Cel spiked mine
 */
export function drawCelMine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
): void {
  const atlas = loadCelAtlas();
  const half = size / 2;

  if (atlas && atlas.complete && atlas.naturalWidth > 0) {
    const coord = CEL_SPECIAL_COORDS.mine();
    ctx.drawImage(
      atlas,
      coord.sx,
      coord.sy,
      coord.sw,
      coord.sh,
      x - half,
      y - half,
      size,
      size
    );
  } else {
    // Vector fallback for mine
    ctx.save();
    ctx.fillStyle = '#FF1744';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#E0E2EC';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.38, 0, Math.PI * 2);
    ctx.stroke();

    // Spikes
    ctx.strokeStyle = '#1E2333';
    ctx.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * (size * 0.2), y + Math.sin(angle) * (size * 0.2));
      ctx.lineTo(x + Math.cos(angle) * (size * 0.48), y + Math.sin(angle) * (size * 0.48));
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * Draws a Cel Lift arrow (hollow chevron with bright border)
 */
export function drawCelLift(
  ctx: CanvasRenderingContext2D,
  col: number,
  x: number,
  y: number,
  size: number,
  tier: SubdivisionTier
): void {
  const atlas = loadCelAtlas();
  const half = size / 2;

  if (atlas && atlas.complete && atlas.naturalWidth > 0) {
    const coord = CEL_SPECIAL_COORDS.lift(col);
    ctx.drawImage(
      atlas,
      coord.sx,
      coord.sy,
      coord.sw,
      coord.sh,
      x - half,
      y - half,
      size,
      size
    );
  } else {
    const color = SUBDIVISION_COLORS[tier] || '#00E5FF';
    drawVectorCelArrow(ctx, col, x, y, size, color, true, 1.0);
  }
}

/**
 * Draws Cel Hold Body stripe and Hold Tail Cap
 */
export function drawCelHold(
  ctx: CanvasRenderingContext2D,
  col: number,
  x: number,
  topY: number,
  tailY: number,
  colWidth: number,
  isRoll: boolean
): void {
  const atlas = loadCelAtlas();
  const bodyH = Math.abs(tailY - topY);
  if (bodyH < 2) return;

  const width = Math.min(28, colWidth * 0.45);
  const left = x - width / 2;

  if (atlas && atlas.complete && atlas.naturalWidth > 0) {
    // Draw hold/roll stripe body
    const bodyCoord = isRoll ? CEL_SPECIAL_COORDS.rollBody() : CEL_SPECIAL_COORDS.holdBody();
    ctx.drawImage(
      atlas,
      bodyCoord.sx + 20, // crop center
      bodyCoord.sy,
      bodyCoord.sw - 40,
      bodyCoord.sh,
      left,
      topY,
      width,
      bodyH
    );

    // Draw bottom cap
    const capCoord = CEL_SPECIAL_COORDS.holdCap(col);
    const capSize = width * 1.5;
    ctx.drawImage(
      atlas,
      capCoord.sx,
      capCoord.sy,
      capCoord.sw,
      capCoord.sh,
      x - capSize / 2,
      tailY - capSize / 2,
      capSize,
      capSize
    );
  } else {
    // Vector fallback for hold/roll body
    const baseColor = isRoll ? '#00E676' : '#00A2FF';
    ctx.fillStyle = `${baseColor}44`;
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 2;
    ctx.fillRect(left, topY, width, bodyH);
    ctx.strokeRect(left, topY, width, bodyH);

    // Center highlight stripe
    ctx.fillStyle = `${baseColor}88`;
    ctx.fillRect(x - 2, topY, 4, bodyH);

    // Bottom cap
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.moveTo(left, tailY);
    ctx.lineTo(left + width, tailY);
    ctx.lineTo(x, tailY + 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}
