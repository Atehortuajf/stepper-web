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
          points="50,6 94,52 66,52 66,94 34,94 34,52 6,52"
          fill={isLift ? 'transparent' : bodyFill}
          stroke={strokeColor}
          strokeWidth={isLift ? '7' : isReceptor ? '5' : '4'}
          strokeLinejoin="miter"
          strokeMiterlimit="3"
        />

        {/* Top-Left Specular Highlight Facet */}
        {!isLift && (
          <polyline
            points="50,9 8,52 34,52 34,92"
            fill="none"
            stroke={isPressed ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)'}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}

        {/* Bottom-Right Drop-Shadow Bevel */}
        {!isLift && (
          <polyline
            points="50,9 92,52 66,52 66,92"
            fill="none"
            stroke="rgba(0,0,0,0.45)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}

        {/* Inner Shaft 3-Step Graduation Bars */}
        {!isLift && !isReceptor && (
          <g stroke="rgba(255,255,255,0.35)" strokeWidth="2">
            <line x1="40" y1="62" x2="60" y2="62" />
            <line x1="40" y1="72" x2="60" y2="72" />
            <line x1="40" y1="82" x2="60" y2="82" />
          </g>
        )}

        {/* Inner Chevron Hollow Core for Lift */}
        {isLift && (
          <polyline
            points="50,18 80,50 60,50 60,86 40,86 40,50 20,50 50,18"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.5"
          />
        )}
      </g>
    </svg>
  );
};
