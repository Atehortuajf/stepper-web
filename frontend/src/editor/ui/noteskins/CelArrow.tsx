/**
 * frontend/src/editor/ui/noteskins/CelArrow.tsx
 * High-contrast, vector-rendered Cel Noteskin SVG Component.
 * Used across MobileTouchPad, MobileNoteSelector, and DiffOverlay.
 */

import React from 'react';
import type { SubdivisionTier } from '../../engine/types';
import { SUBDIVISION_COLORS } from '../../engine/subdivisions';

export type CelDirection = 0 | 1 | 2 | 3 | 'left' | 'down' | 'up' | 'right';
export type CelNoteType = 'TAP' | 'HOLD' | 'ROLL' | 'MINE' | 'LIFT' | 'FAKE' | 'DEL';

export interface CelArrowProps {
  col?: CelDirection;
  subdivision?: SubdivisionTier;
  noteType?: CelNoteType;
  isPressed?: boolean;
  isReceptor?: boolean;
  size?: number;
  className?: string;
  title?: string;
}

const COL_TO_INDEX: Record<string | number, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  left: 0,
  down: 1,
  up: 2,
  right: 3,
};

// Receptors default colors
const RECEPTOR_COLORS = ['#FF2A55', '#00A2FF', '#9E3CFF', '#FFD000'];

export const CelArrow: React.FC<CelArrowProps> = ({
  col = 2, // default Up
  subdivision = 4,
  noteType = 'TAP',
  isPressed = false,
  isReceptor = false,
  size = 36,
  className = '',
  title,
}) => {
  const colIdx = COL_TO_INDEX[col] ?? 2;
  const col4 = ((colIdx % 4) + 4) % 4;

  // Rotation: Up (0 deg), Right (90 deg), Down (180 deg), Left (270 deg)
  const ROTATIONS = [270, 180, 0, 90];
  const rotationDeg = ROTATIONS[col4];

  // Colors
  const subColor = isReceptor
    ? isPressed
      ? '#FFFFFF'
      : RECEPTOR_COLORS[col4]
    : SUBDIVISION_COLORS[subdivision] || '#FF2A55';

  const bodyFill = isReceptor
    ? isPressed
      ? '#FFFFFF'
      : '#1A1D29'
    : isPressed
    ? '#FFFFFF'
    : subColor;

  const strokeColor = isReceptor
    ? isPressed
      ? '#00E5FF'
      : RECEPTOR_COLORS[col4]
    : '#10121A';

  // Mine rendering
  if (noteType === 'MINE') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={`cel-mine shrink-0 ${className}`}
        aria-hidden={!title}
      >
        {title ? <title>{title}</title> : <title>Cel Spiked Mine</title>}
        {/* Outer spikes */}
        <line x1="50" y1="6" x2="50" y2="94" stroke="#161822" strokeWidth="10" strokeLinecap="round" />
        <line x1="6" y1="50" x2="94" y2="50" stroke="#161822" strokeWidth="10" strokeLinecap="round" />
        <line x1="18" y1="18" x2="82" y2="82" stroke="#161822" strokeWidth="8" strokeLinecap="round" />
        <line x1="18" y1="82" x2="82" y2="18" stroke="#161822" strokeWidth="8" strokeLinecap="round" />

        {/* Silver ring */}
        <circle cx="50" cy="50" r="34" fill="#6A728A" stroke="#161822" strokeWidth="4" />
        <circle cx="50" cy="50" r="26" fill="#2E3344" />

        {/* Red glowing core */}
        <circle cx="50" cy="50" r="16" fill="#FF1744" stroke="#FF5252" strokeWidth="3" />
        <circle cx="46" cy="46" r="4" fill="#FFFFFF" opacity="0.8" />
      </svg>
    );
  }

  // Delete icon
  if (noteType === 'DEL') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={`cel-del shrink-0 ${className}`}
        aria-hidden={!title}
      >
        {title ? <title>{title}</title> : <title>Delete note tool</title>}
        <circle cx="50" cy="50" r="42" fill="#2A1B22" stroke="#FF3366" strokeWidth="6" />
        <line x1="28" y1="28" x2="72" y2="72" stroke="#FF3366" strokeWidth="8" strokeLinecap="round" />
        <line x1="72" y1="28" x2="28" y2="72" stroke="#FF3366" strokeWidth="8" strokeLinecap="round" />
      </svg>
    );
  }

  const isLift = noteType === 'LIFT';
  const isFake = noteType === 'FAKE';
  const isHold = noteType === 'HOLD';
  const isRoll = noteType === 'ROLL';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`cel-arrow shrink-0 select-none transition-transform duration-75 ${
        isPressed ? 'scale-95' : ''
      } ${className}`}
      aria-hidden={!title}
    >
      {title && <title>{title}</title>}
      <g transform={`rotate(${rotationDeg} 50 50)`} opacity={isFake ? 0.45 : 1.0}>
        {/* Hold / Roll tail indicator in miniature icon */}
        {(isHold || isRoll) && (
          <rect
            x="38"
            y="55"
            width="24"
            height="40"
            fill={isRoll ? '#00E67655' : '#00A2FF55'}
            stroke={isRoll ? '#00E676' : '#00A2FF'}
            strokeWidth="3"
            strokeDasharray={isRoll ? '4 2' : undefined}
          />
        )}

        {/* Outer Cel Arrow Contour */}
        <polygon
          points="50,4 98,52 79,72 66,49 66,96 34,96 34,49 21,72 2,52"
          fill={isLift ? 'transparent' : bodyFill}
          stroke={strokeColor}
          strokeWidth={isLift ? '7' : isReceptor ? '4' : '3'}
          strokeLinejoin="miter"
          strokeMiterlimit="3"
        />

        {/* Silver Bevel Rim */}
        {!isLift && !isReceptor && (
          <polygon
            points="50,8 93,51 77,68 64,48 64,93 36,93 36,48 23,68 7,51"
            fill="none"
            stroke={isPressed ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)'}
            strokeWidth="1.5"
            strokeLinejoin="miter"
          />
        )}

        {/* Central Diamond Accent */}
        {!isLift && !isReceptor && (
          <polygon
            points="50,22 64,48 50,74 36,48"
            fill="rgba(0,0,0,0.22)"
          />
        )}

        {/* Inner Chevron Hollow Core for Lift */}
        {isLift && (
          <polygon
            points="50,18 84,52 70,66 58,49 58,86 42,86 42,49 30,66 16,52"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.5"
          />
        )}
      </g>
    </svg>
  );
};
